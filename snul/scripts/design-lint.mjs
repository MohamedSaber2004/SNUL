#!/usr/bin/env node
/**
 * Design-system linter.
 *
 * Every check is a pure function over a `{ relativePath: cssText }` map, so the
 * whole linter is testable without touching disk. The CLI at the bottom is the
 * only part that does I/O.
 *
 * `.vue` files are read as plain text. Their `<style>` blocks are ordinary CSS
 * and every pattern these checks look at sits inside them, so single-file
 * components are scanned with no extraction step. The cost is that the template
 * is scanned too, and `hex-location` counts hexes there: five exist today —
 * `AppHeader.vue:184` (`:style` fallback), `WhatsAppFab.vue:34` (SVG `fill`),
 * and three in one `style` attribute at `SalesAdminView.vue:484`. Those are a
 * distinct migration surface from a scoped `<style>` block, because an inline
 * binding cannot take a `var()` from a stylesheet the way a rule can.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findHexLiterals, findSelfReferences } from './lib/css.mjs'
import {
  TOKENS_FILE,
  HEX_LOCATION_BUDGET,
  DEPRECATED_PREFIX,
  PRIMITIVE_EXEMPT_FILES,
} from './lib/config.mjs'

/** Most detail lines printed per check before the report collapses into a count. */
const DETAIL_LIMIT = 12

/**
 * `primitive-leak` is the one check whose `detail` is one line *per occurrence*
 * rather than a rolled-up summary, so 12 lines showed 6% of a real 203-entry
 * backlog and hid which files were worst. It gets its own cap; the per-file and
 * per-name checks keep 12, which is already generous for them.
 */
const DETAIL_LIMIT_BY_CHECK = { 'primitive-leak': 50 }

/**
 * `var(--<DEPRECATED_PREFIX>*)` with the name captured.
 *
 * This is the one check that cannot use `findVarReferences`: that function
 * de-duplicates within a file, which is right for "which tokens does this file
 * touch" but wrong for a usage tally. On the real tree it collapses 3,672
 * occurrences into 1,093 distinct (file, name) pairs, so the magnitude recorded
 * in docs/baseline/2026-09-27-home.md would be unreachable. The prefix stays
 * interpolated from config so the policy still has one home.
 *
 * Mirrors VAR_RE in lib/css.mjs, including the optional whitespace. That
 * duplication is deliberate and must stay: the two regexes answer different
 * questions, so a tightening of VAR_RE (the *token* grammar is a spec decision)
 * must not silently shrink this *usage* tally. A name dropped here is a name
 * the retirement count forgets, which is how a token gets deleted while still
 * in use. A test pins that they currently agree on a boundary name.
 */
const DEPRECATED_USE_RE = new RegExp(`var\\(\\s*--(${DEPRECATED_PREFIX}[\\w-]+)`, 'g')

/**
 * `var(--color-*)` with the name captured and nothing de-duplicated.
 *
 * For the same reason as DEPRECATED_USE_RE, this cannot use `findVarReferences`:
 * that function de-duplicates within a file, which is right for "which tokens
 * does this file touch" and wrong for a usage tally. On the real tree
 * `components.css` alone references the same primitive 40 times, and
 * de-duplication reported 138 of 203 occurrences — a third of the backlog
 * invisible to the number the migration programme drives to zero.
 *
 * Duplicates VAR_RE's prefix grammar rather than deriving from it, for the same
 * reason DEPRECATED_USE_RE does. See the note there.
 *
 * Mirrors VAR_RE in lib/css.mjs, including the optional whitespace.
 */
const PRIMITIVE_USE_RE = /var\(\s*(--color-[\w-]+)/g

/**
 * Accumulates offenders as human-readable `detail` lines plus the `paths` they
 * came from. `paths` de-duplicates, so a file with three offenders still appears
 * once there. `detail` does not: a check that tallies *occurrences* adds one
 * line each, while a check that tallies distinct references de-duplicates
 * before calling `add`. Which of the two a check does is stated by its `unit`.
 */
function offenders() {
  const detail = []
  const paths = new Set()
  return {
    add(detailLine, path) {
      detail.push(detailLine)
      paths.add(path)
    },
    paths,
    detail,
  }
}

/** 1-based line number of a character offset, counting `\n` only so CRLF agrees with editors. */
function lineNumberAt(css, offset) {
  let line = 1
  for (let i = 0; i < offset; i++) {
    if (css.charCodeAt(i) === 10) line++
  }
  return line
}

/**
 * A token defined in terms of itself resolves to nothing, so every consumer
 * silently renders unstyled. A single occurrence of this dead pattern disabled
 * 156 `box-shadow` declarations before Phase 1B, so it is a hard failure.
 */
function checkSelfReference(files) {
  const found = offenders()
  for (const [path, css] of Object.entries(files)) {
    for (const name of findSelfReferences(css)) {
      found.add(`${path}: --${name}`, path)
    }
  }
  return {
    id: 'self-reference',
    title: 'No self-referential custom property',
    unit: 'distinct (file, name) pairs',
    ok: found.detail.length === 0,
    count: found.detail.length,
    files: [...found.paths],
    detail: found.detail,
  }
}

/**
 * Raw hex outside the token file is a bypass of the palette. This is a budget,
 * not a zero check: 777 occurrences were already in the tree at the baseline
 * commit, so the ratchet fails only when the count rises above that line and
 * passes once migration batches start paying it down.
 */
function checkHexLocation(files) {
  const found = offenders()
  let total = 0
  for (const [path, css] of Object.entries(files)) {
    if (path.endsWith(TOKENS_FILE)) continue
    const hits = findHexLiterals(css)
    if (hits.length === 0) continue
    total += hits.length
    found.add(`${path}: ${hits.length}`, path)
  }
  return {
    id: 'hex-location',
    title: `Raw hex only in ${TOKENS_FILE} (budget ${HEX_LOCATION_BUDGET})`,
    unit: 'occurrences',
    ok: total <= HEX_LOCATION_BUDGET,
    count: total,
    budget: HEX_LOCATION_BUDGET,
    files: [...found.paths],
    detail: found.detail,
  }
}

/**
 * Components must reach for semantic tokens (`--brand`, `--surface`), never for
 * the raw palette scale. The exemption is by path — see
 * `PRIMITIVE_EXEMPT_FILES` in config.mjs for why it is not a `:root` strip, and
 * why the entries there are full repo-relative paths rather than bare filenames.
 * They are compared as a suffix, which is now equivalent to an exact match
 * because `main()` keys every file as `src/<path-relative-to-src>`: a shorter
 * suffix cannot be satisfied without also being a path under `src/`.
 *
 * Detail lines carry a line number, because a bare `var(--color-success-100)` in
 * a 34KB stylesheet is not a place anyone can act on.
 */
function checkPrimitiveLeak(files) {
  const found = offenders()
  for (const [path, css] of Object.entries(files)) {
    if (PRIMITIVE_EXEMPT_FILES.some((exempt) => path.endsWith(exempt))) continue
    for (const match of css.matchAll(PRIMITIVE_USE_RE)) {
      const line = lineNumberAt(css, match.index)
      found.add(`${path}:${line}: var(${match[1]})`, path)
    }
  }
  return {
    id: 'primitive-leak',
    title: 'Components reference semantic tokens, never --color-* primitives',
    unit: 'occurrences',
    ok: found.detail.length === 0,
    count: found.detail.length,
    files: [...found.paths],
    detail: found.detail,
  }
}

/**
 * The `--wl-*` aliases inherited from the WELCO project are being retired. This
 * is a progress meter, not a defect: the drain is spread over many migration
 * batches, so failing the build on it would block all of them. It never sets
 * `ok` to false.
 */
function checkDeprecatedUsage(files) {
  const counts = new Map()
  const filesWithUsage = new Set()
  for (const [path, css] of Object.entries(files)) {
    for (const [, name] of css.matchAll(DEPRECATED_USE_RE)) {
      counts.set(name, (counts.get(name) ?? 0) + 1)
      filesWithUsage.add(path)
    }
  }
  const detail = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, n]) => `--${name}: ${n}`)
  let total = 0
  for (const n of counts.values()) total += n
  return {
    id: 'deprecated-usage',
    title: `Report --${DEPRECATED_PREFIX}* usages (must reach 0)`,
    unit: 'occurrences',
    ok: true,
    count: total,
    files: [...filesWithUsage],
    detail,
  }
}

/** Runs every check over a `{ relativePath: cssText }` map. Pure; no disk access. */
export function runChecks(files) {
  return {
    checks: [
      checkSelfReference(files),
      checkHexLocation(files),
      checkPrimitiveLeak(files),
      checkDeprecatedUsage(files),
    ],
  }
}

/** Walks `root` for `.css` and `.vue` sources, returning POSIX paths relative to it. */
function collectSourceFiles(root) {
  const base = resolve(root)
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(css|vue)$/.test(entry.name)) out.push(relative(base, full).split(sep).join('/'))
    }
  }
  walk(base)
  return out.sort()
}

function main() {
  const srcDir = join(process.cwd(), 'src')
  const files = {}
  for (const rel of collectSourceFiles(srcDir)) {
    files[`src/${rel}`] = readFileSync(join(srcDir, rel), 'utf8')
  }
  const { checks } = runChecks(files)
  console.log(`design-lint: ${Object.keys(files).length} files\n`)
  let failed = 0
  for (const check of checks) {
    // A ratchet sitting exactly on its line passes with zero headroom, which in
    // the report reads exactly like a comfortable pass. Say so.
    const atBudget = check.budget !== undefined && check.count === check.budget
    const suffix = atBudget ? '  [AT BUDGET — no headroom]' : ''
    const headline = `${check.ok ? 'PASS' : 'FAIL'}  ${check.id} (${check.count})  ${check.title}`
    console.log(`${headline}${suffix}`)
    const limit = DETAIL_LIMIT_BY_CHECK[check.id] ?? DETAIL_LIMIT
    for (const line of check.detail.slice(0, limit)) console.log(`        ${line}`)
    if (check.detail.length > limit) {
      console.log(`        ...and ${check.detail.length - limit} more`)
    }
    if (!check.ok) failed++
  }
  process.exit(failed > 0 ? 1 : 0)
}

// The test suite imports this module, so the CLI must only run when this file is
// the process's entry point, and a false negative here is the worst failure this
// file can have: the linter exits 0 having printed nothing, which is
// indistinguishable from a clean tree.
//
// The first clause is that test, exactly: `pathToFileURL` is the platform's own
// answer to "what URL is this path". Hand-rolling `file://${p}` diverged from
// `import.meta.url` for any checkout path holding a character the URL grammar
// reads as a delimiter (`#`, `?`, `%`), and a repo checked out under such a path
// passed silently. The second is a backstop for the same class of breakage, plus
// symlinked and UNC entries where the two paths name the same file differently.
// It matches on the *basename*, not the path tail: `endsWith` also matched any
// longer name, so a wrapper such as `scripts/bin/check-design-lint.mjs` that only
// imported this module satisfied the guard and killed the importing process with
// `process.exit(1)`.
//
// What the backstop guarantees is that an argv[1] naming *this* file still runs
// the checks. It does not, and cannot, guarantee that no other module can reach
// `main()`: any copy of this file under a different directory is still invoked by
// basename. That is the intended trade — the backstop can fail by running a check
// that should have been skipped (a visible spurious failure) but not by skipping a
// check that should have run, which is the failure that reaches CI as a silent
// pass.
const invokedDirectly = Boolean(
  process.argv[1] &&
    (pathToFileURL(process.argv[1]).href === import.meta.url ||
      basename(process.argv[1]) === 'design-lint.mjs')
)

if (invokedDirectly) main()
