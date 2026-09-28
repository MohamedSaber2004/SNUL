import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findVarReferences } from '../lib/css.mjs'
import { runChecks } from '../design-lint.mjs'

const run = (files) => runChecks(files)

/**
 * Repo root, so a CLI fixture can copy the real `scripts/` tree. Derived from
 * this file rather than `process.cwd()` so the test does not depend on where it
 * was launched from — and via `fileURLToPath` with no relative argument, because
 * under the jsdom environment `new URL('../../', …)` resolves against the
 * document base (`http://localhost:3000/`) and returns an http URL.
 */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * `hex-location` is a ratchet, not a zero check: it passes while the count sits
 * at or below HEX_LOCATION_BUDGET (777 at the baseline commit). Pinning the
 * budget is what turns these into exemption-vs-violation assertions instead of
 * trivially-true ones.
 */
const runWithBudget = async (budget, files) => {
  vi.stubEnv('HEX_BUDGET', String(budget))
  vi.resetModules()
  const fresh = await import('../design-lint.mjs')
  return fresh.runChecks(files)
}
const runAtBudgetZero = (files) => runWithBudget(0, files)

const tempDirs = []
afterEach(() => {
  vi.unstubAllEnvs()
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const check = (result, id) => result.checks.find((c) => c.id === id)

describe('check: self-reference', () => {
  it('fails a stylesheet that redefines a token as itself', () => {
    const result = run({ 'tokens.css': ':root { --shadow-sm: var(--shadow-sm); }' })
    expect(check(result, 'self-reference').ok).toBe(false)
  })

  it('passes a well-formed stylesheet', () => {
    const result = run({ 'tokens.css': ':root { --shadow-sm: 0 1px 2px #00000010; }' })
    expect(check(result, 'self-reference').ok).toBe(true)
  })

  it('does not see through a commented-out self-reference', () => {
    const result = run({ 'tokens.css': ':root { /* --x: var(--x); */ --a: 1px; }' })
    expect(check(result, 'self-reference').ok).toBe(true)
  })
})

describe('check: hex-location', () => {
  it('allows hex inside design-tokens.css', async () => {
    const result = await runAtBudgetZero({ 'src/assets/design-tokens.css': ':root { --a: #0C63B8; }' })
    expect(check(result, 'hex-location').ok).toBe(true)
  })

  it('does not exempt a look-alike file elsewhere in the tree', async () => {
    // TOKENS_FILE is a full repo-relative path precisely so that a bare
    // endsWith() match cannot exempt an unrelated file.
    const result = await runAtBudgetZero({ 'src/views/design-tokens.css': '.a{color:#ff0000}' })
    const c = check(result, 'hex-location')
    expect(c.ok).toBe(false)
    expect(c.count).toBe(1)
    expect(c.files).toContain('src/views/design-tokens.css')
  })

  it('fails hex anywhere else', async () => {
    const result = await runAtBudgetZero({ 'components.css': '.btn { color: #ff0000; }' })
    expect(check(result, 'hex-location').ok).toBe(false)
  })

  it('counts each occurrence and lists the file', () => {
    const result = run({ 'main.css': '.a{color:#fff}.b{color:#000}' })
    const c = check(result, 'hex-location')
    expect(c.count).toBe(2)
    expect(c.files).toContain('main.css')
  })

  it('passes at exactly the budget and fails one occurrence over', async () => {
    const one = await runWithBudget(1, { 'main.css': '.a{color:#fff}' })
    expect(check(one, 'hex-location')).toMatchObject({ ok: true, count: 1, budget: 1 })
    const two = await runWithBudget(1, { 'main.css': '.a{color:#fff}.b{color:#000}' })
    expect(check(two, 'hex-location')).toMatchObject({ ok: false, count: 2, budget: 1 })
  })
})

describe('check: primitive-leak', () => {
  it('fails a component referencing a --color-* primitive', () => {
    const result = run({ 'components.css': '.btn { color: var(--color-primary-600); }' })
    expect(check(result, 'primitive-leak').ok).toBe(false)
  })

  it('allows a component referencing a semantic token', () => {
    const result = run({ 'components.css': '.btn { color: var(--brand); }' })
    expect(check(result, 'primitive-leak').ok).toBe(true)
  })

  it('allows design-tokens.css to derive semantics from primitives', () => {
    const result = run({
      'src/assets/design-tokens.css': ':root { --bg-app: var(--color-neutral-50); }',
    })
    expect(check(result, 'primitive-leak').ok).toBe(true)
  })

  it('exempts both token layers, so a primitive aliased in layer 2 is not a leak', () => {
    const leak = 'var(--color-success-100)'
    const result = run({
      'src/assets/tokens.css': `:root { --color-success-100: ${leak}; }`,
      'src/assets/components.css': `.card { border-color: ${leak}; }`,
    })
    const c = check(result, 'primitive-leak')
    expect(c.ok).toBe(false)
    expect(c.count).toBe(1)
    expect(c.files).toEqual(['src/assets/components.css'])
  })

  it('exempts a whole file, not just its :root block', () => {
    const result = run({
      'src/assets/tokens.css': '.utility { color: var(--color-danger-500); }',
    })
    expect(check(result, 'primitive-leak').ok).toBe(true)
  })

  /**
   * The exemption set is keyed on the full repo-relative path, not the bare
   * filename. Matched as a bare name, `endsWith('tokens.css')` exempted *any*
   * file ending in that string, so a new `src/views/tokens.css` holding 200
   * `var(--color-*)` references would report PASS (0) and exit 0.
   */
  it('does not exempt a look-alike file elsewhere in the tree', () => {
    const result = run({
      'src/assets/tokens.css': ':root { --color-success-100: var(--color-success-500); }',
      'src/views/tokens.css': '.card { border-color: var(--color-danger-500); }',
    })
    const c = check(result, 'primitive-leak')
    expect(c.ok).toBe(false)
    expect(c.count).toBe(1)
    expect(c.files).toEqual(['src/views/tokens.css'])
  })

  it('tallies occurrences, so the same primitive twice in one file counts twice', () => {
    const result = run({
      'src/assets/components.css':
        '.a{color:var(--color-brand-200)}.b{border-color:var(--color-brand-200)}',
    })
    const c = check(result, 'primitive-leak')
    expect(c.count).toBe(2)
    // `files` still de-duplicates: one path, two occurrences.
    expect(c.files).toEqual(['src/assets/components.css'])
  })

  it('gives each offender a line number', () => {
    const result = run({
      'src/assets/base.css': '.a{color:red}\n.b{color:var(--color-info-100)}\n.c{x:1}',
    })
    expect(check(result, 'primitive-leak').detail).toEqual([
      'src/assets/base.css:2: var(--color-info-100)',
    ])
  })
})

describe('check: deprecated-usage', () => {
  it('reports usage without failing, even when the count is non-zero', () => {
    const result = run({ 'src/views/Thing.vue': '.a{color:var(--wl-primary)}' })
    expect(check(result, 'deprecated-usage')).toMatchObject({ ok: true, count: 1 })
  })

  it('agrees with VAR_RE on a short boundary name, so neither can drift', () => {
    const css = '.a{color:var(--wl-2fa)}'
    expect(findVarReferences(css)).toEqual(['wl-2fa'])
    expect(check(run({ 'a.css': css }), 'deprecated-usage').count).toBe(1)
  })
})

describe('result shape', () => {
  it('returns one entry per check, each fully shaped', () => {
    const result = run({ 'tokens.css': ':root { --a: 1px; }' })
    expect(result.checks).toHaveLength(4)
    for (const c of result.checks) {
      expect(typeof c.id).toBe('string')
      expect(typeof c.title).toBe('string')
      expect(typeof c.unit).toBe('string')
      expect(typeof c.ok).toBe('boolean')
      expect(typeof c.count).toBe('number')
      expect(Array.isArray(c.files)).toBe(true)
      expect(Array.isArray(c.detail)).toBe(true)
    }
  })

  it('never throws on empty input', () => {
    expect(() => run({})).not.toThrow()
  })
})

describe('runChecks over several files', () => {
  const files = {
    'src/assets/design-tokens.css': ':root { --color-primary-600: #0C63B8; }',
    'src/assets/components.css': '.a{color:var(--color-primary-600);box-shadow:0 0 #000}',
    'src/components/ui/Thing.vue':
      '.b{color:var(--wl-primary);border-color:var(--wl-secondary);background:#fff}',
  }
  const result = run(files)

  it('attributes hex-location to the files that actually hold hexes', () => {
    const c = check(result, 'hex-location')
    expect(c.files).toEqual(['src/assets/components.css', 'src/components/ui/Thing.vue'])
    expect(c.count).toBe(2)
  })

  it('exempts the token file and blames the component for its primitive', () => {
    const c = check(result, 'primitive-leak')
    expect(c.files).toEqual(['src/assets/components.css'])
    expect(c.count).toBe(1)
  })

  it('attributes deprecated usage per file, de-duplicated', () => {
    // Two distinct --wl-* names in one file: the tally counts both occurrences
    // while `files` still lists the path once, so the two are not the same number.
    const c = check(result, 'deprecated-usage')
    expect(c.count).toBe(2)
    expect(c.files).toEqual(['src/components/ui/Thing.vue'])
  })
})

describe('CLI', () => {
  /**
   * The `invokedDirectly` guard used to hand-roll `file://${argv[1]}`, which
   * diverges from `import.meta.url` when the checkout path holds a character the
   * URL grammar reads as a delimiter. The linter then exited 0 having printed
   * nothing, on a tree full of violations — the one failure a CI check cannot be
   * allowed to make. Copied under a `#`-bearing path and asserted directly.
   */
  it('still reports and exits 1 when the checkout path contains a #', () => {
    const dir = mkdtempSync(join(tmpdir(), 'design-lint-#'))
    tempDirs.push(dir)
    cpSync(join(REPO_ROOT, 'scripts'), join(dir, 'scripts'), { recursive: true })
    mkdirSync(join(dir, 'src', 'assets'), { recursive: true })
    writeFileSync(
      join(dir, 'src', 'assets', 'components.css'),
      '.btn { color: var(--color-primary-600); }\n',
      'utf8'
    )

    const res = spawnSync(process.execPath, ['scripts/design-lint.mjs'], {
      cwd: dir,
      encoding: 'utf8',
    })

    expect(res.status).toBe(1)
    expect(res.stdout).toContain('FAIL  primitive-leak')
    expect(res.stdout).toContain('src/assets/components.css:1: var(--color-primary-600)')
  })

  it('marks a budgeted check that is sitting exactly on its line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'design-lint-at-budget-'))
    tempDirs.push(dir)
    cpSync(join(REPO_ROOT, 'scripts'), join(dir, 'scripts'), { recursive: true })
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src', 'main.css'), '.a{color:#fff}', 'utf8')

    const res = spawnSync(process.execPath, ['scripts/design-lint.mjs'], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, HEX_BUDGET: '1' },
    })

    expect(res.status).toBe(0)
    expect(res.stdout).toContain('PASS  hex-location (1)')
    expect(res.stdout).toContain('[AT BUDGET — no headroom]')
  })

  /**
   * The `invokedDirectly` backstop used to test
   * `process.argv[1].endsWith('design-lint.mjs')`, which matched any path whose
   * *tail* was that name. So a wrapper that merely imported this module ran
   * `main()` and `process.exit(1)` inside the importing process — and the old
   * comment claimed the guard "cannot be defeated by a file merely containing
   * this one's name", which is exactly what this fixture does. The tree below
   * holds a real violation, so a spurious `main()` is observable as exit 1 plus
   * CLI output rather than merely as a hung process.
   */
  it('does not run the CLI when the entry script only contains this module name', () => {
    const dir = mkdtempSync(join(tmpdir(), 'design-lint-wrapper-'))
    tempDirs.push(dir)
    cpSync(join(REPO_ROOT, 'scripts'), join(dir, 'scripts'), { recursive: true })
    mkdirSync(join(dir, 'src', 'assets'), { recursive: true })
    writeFileSync(
      join(dir, 'src', 'assets', 'components.css'),
      '.btn { color: var(--color-primary-600); }\n',
      'utf8'
    )
    mkdirSync(join(dir, 'scripts', 'bin'), { recursive: true })
    writeFileSync(
      join(dir, 'scripts', 'bin', 'check-design-lint.mjs'),
      "import '../design-lint.mjs'\n",
      'utf8'
    )

    const res = spawnSync(process.execPath, ['scripts/bin/check-design-lint.mjs'], {
      cwd: dir,
      encoding: 'utf8',
    })

    expect(res.status).toBe(0)
    expect(res.stdout).toBe('')
    expect(res.stderr).toBe('')
  })
})
