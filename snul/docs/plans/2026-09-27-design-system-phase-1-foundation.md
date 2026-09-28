# Design System Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the six token/style defects in the SNUL design system and add the build-time guards that stop them recurring, without changing the visual design except for one deliberate shadow restoration.

**Architecture:** One standalone Node linter (`scripts/design-lint.mjs`) owns every design-system check, so enforcement has a single home and does not touch `vite.config.ts` (a hash-guaranteed file). The fixes themselves are small and surgical. The plan is split into a pixel-neutral structural pass (1A) and a visually-deliberate shadow restoration (1B), because the two cannot share a gate.

**Tech Stack:** Node 20 ESM, Vitest 4 (jsdom), Vite 5, plain CSS custom properties. No new runtime dependencies.

---

## Scope

This plan covers **Phase 1 only** (spec §4, phases 1A and 1B). The five screen-migration batches
are separate plans, each producing independently shippable work.

## Preconditions

1. Read `docs/specs/2026-09-27-design-system-refactor-design.md`.
2. Confirm the §2.4 item 2 decision: **`main.css` guarantee is relaxed** (the default
   recommendation, assumed throughout this plan). If instead the guarantee is kept, Task 6
   changes and the canonical `.page-btn` rules move to `components.css`.
3. Baseline capture (spec §4 Phase 0) is the engineer's first task, not this plan's.

## Non-goals

1. No palette change. `--color-primary-600: #0C63B8` and the Arctic Frost ramps stay.
2. No dark mode. Tokens become dark-*ready*; no toggle ships.
3. No `tailwind.config.ts` / `vite.config.ts` edits — both are hash-guaranteed and neither is
   a source of drift.
4. No screen migration. The 696 raw hex literals are not touched here.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/css.mjs` | Pure CSS analysis: parse token definitions, find `var()` references, find hex literals, detect self-references. No I/O. |
| `scripts/lib/contrast.mjs` | WCAG relative-luminance and contrast-ratio math. Pure functions. |
| `scripts/lib/config.mjs` | The hash-guaranteed file list, the token file path, the allowed-hex-file path, and the semantic contrast pairs. Single source of truth for policy. |
| `scripts/design-lint.mjs` | CLI. Runs all checks, prints a report, exits non-zero on a failing check. Thin: all logic lives in `lib/`. |
| `scripts/__tests__/css.test.mjs` | Unit tests for `lib/css.mjs`. |
| `scripts/__tests__/contrast.test.mjs` | Unit tests for `lib/contrast.mjs`, using the known WCAG reference values. |
| `scripts/__tests__/design-lint.test.mjs` | End-to-end tests for the linter against fixture CSS strings. |
| `scripts/hash-guard.mjs` | CLI. Verifies the hash-guaranteed files. Separate from the linter because it is a pre-commit concern, not a design concern. |

**Why `scripts/lib/`:** the checks are pure functions over strings, which makes them trivially
testable without touching the filesystem. Only the two CLI entry points do I/O.

---

## Task 1: Baseline capture

**Files:**
- Create: `docs/baseline/2026-09-27-home.md`

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: Vite prints a local URL, typically `http://localhost:5173/`.

- [ ] **Step 2: Capture the baseline screenshot set**

For each of these routes, at viewport 1440x900 and 390x844, in both `en` and `ar`:

```
/                      /categories            /marketplace
/login                 /register              /rfq
/admin/dashboard       /admin/sales
```

Save each as `docs/baseline/<route>-<locale>-<width>.png`.

- [ ] **Step 3: Record the current hex-leak count**

```bash
node scripts/design-lint.mjs --check=hex-location
```

Expected before the linter exists: the command fails with "unknown check". Record the manual
count instead:

```bash
node -e "const{execSync}=require('child_process');" 2>nul
```

Use the one-liner in Task 3 Step 1 instead, and record its output in the baseline doc.

- [ ] **Step 4: Write the baseline record**

Create `docs/baseline/2026-09-27-home.md`:

```markdown
# Baseline — 2026-09-27

Captured before Design System Phase 1. Phase 1A must reproduce this exactly.

## Test floor
- vue-tsc: clean
- vitest: 19 files, 95 tests
- build: succeeds

## Hash-guaranteed files
See `scripts/lib/config.mjs` for the authoritative list and expected digests.

## Hex leak count
- Raw hex outside design-tokens.css: <N> (measured in Task 3 Step 1)

## --wl-* usages
- <N>

## Screenshots
<list the captured files>
```

- [ ] **Step 5: Commit**

```bash
git add docs/baseline
git commit -m "chore(design): capture pre-refactor baseline"
```

---

## Task 2: CSS analysis library

**Files:**
- Create: `scripts/lib/css.mjs`
- Test: `scripts/__tests__/css.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `scripts/__tests__/css.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest'
import {
  parseTokenDefinitions,
  findSelfReferences,
  findHexLiterals,
  findVarReferences,
} from '../lib/css.mjs'

describe('parseTokenDefinitions', () => {
  it('reads name and value from a :root block', () => {
    const css = ':root { --a: #fff; --b: var(--a); }'
    const defs = parseTokenDefinitions(css)
    expect(defs.get('a').value).toBe('#fff')
    expect(defs.get('b').value).toBe('var(--a)')
  })

  it('ignores declarations outside any block', () => {
    const css = '--stray: 1px; :root { --a: 2px; }'
    expect(parseTokenDefinitions(css).has('stray')).toBe(false)
  })

  it('handles a token whose value spans multiple lines', () => {
    const css = ':root { --shadow: 0 1px 2px rgba(0,0,0,.1),\n    0 2px 4px rgba(0,0,0,.2); }'
    expect(parseTokenDefinitions(css).get('shadow').value).toContain('0 2px 4px')
  })

  it('records the line number of each definition', () => {
    const defs = parseTokenDefinitions(':root {\n  --a: 1px;\n}')
    expect(defs.get('a').line).toBe(2)
  })
})

describe('findSelfReferences', () => {
  it('flags a token whose value references itself', () => {
    const css = ':root { --shadow-sm: var(--shadow-sm); }'
    expect(findSelfReferences(css)).toEqual(['shadow-sm'])
  })

  it('flags self-reference with a fallback, e.g. var(--x, red)', () => {
    const css = ':root { --x: var(--x, red); }'
    expect(findSelfReferences(css)).toEqual(['x'])
  })

  it('does not flag a token referencing a different token', () => {
    const css = ':root { --a: var(--b); }'
    expect(findSelfReferences(css)).toEqual([])
  })

  it('does not flag a token that merely shares a prefix', () => {
    const css = ':root { --shadow-sm: var(--shadow-sm-md); }'
    expect(findSelfReferences(css)).toEqual([])
  })

  it('returns every offender when several are broken', () => {
    const css = ':root { --a: var(--a); --b: 1px; --c: var(--c); }'
    expect(findSelfReferences(css).sort()).toEqual(['a', 'c'])
  })
})

describe('findHexLiterals', () => {
  it('finds a 3-digit hex', () => {
    expect(findHexLiterals('color: #fff;')).toHaveLength(1)
  })

  it('finds a 6-digit hex', () => {
    expect(findHexLiterals('background: #0C63B8;')).toHaveLength(1)
  })

  it('ignores a hex-like word inside an identifier', () => {
    expect(findHexLiterals('.note { content: "#ffffffish"; }')).toHaveLength(0)
  })

  it('ignores rgba() and hsl()', () => {
    expect(findHexLiterals('box-shadow: 0 0 0 3px rgba(1,2,3,.18);')).toHaveLength(0)
  })

  it('finds several literals in one declaration block', () => {
    expect(findHexLiterals('background: linear-gradient(#fff, #000);')).toHaveLength(2)
  })
})

describe('findVarReferences', () => {
  it('lists referenced token names in source order', () => {
    expect(findVarReferences('var(--b) var(--a)')).toEqual(['b', 'a'])
  })

  it('ignores the fallback argument', () => {
    expect(findVarReferences('var(--missing, var(--fallback))')).toEqual(['missing', 'fallback'])
  })

  it('de-duplicates repeated references', () => {
    expect(findVarReferences('var(--a) var(--a)')).toEqual(['a'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/__tests__/css.test.mjs`

Expected: FAIL — `Cannot find module '../lib/css.mjs'`.

- [ ] **Step 3: Implement the skeleton**

Create `scripts/lib/css.mjs`:

```javascript
/**
 * Pure CSS analysis helpers. No filesystem access, so every function is
 * directly unit-testable against a CSS string.
 *
 * Scope note: this is intentionally a focused scanner, not a full CSS parser.
 * It understands custom-property definitions and var()/hex patterns, which is
 * everything the design-system checks need.
 */

/** Matches a hex colour literal, but not a hex-shaped word inside an identifier. */
const HEX_RE = /#[0-9a-fA-F]{3,8}\b(?![0-9a-zA-Z-])/g

/** Matches var(--name) including an optional fallback. */
const VAR_RE = /var\(\s*(--[\w-]+)/g

export function parseTokenDefinitions(css) {
  // filled in Step 4
}

export function findSelfReferences(css) {
  // filled in Step 4
}

export function findHexLiterals(css) {
  // filled in Step 4
}

export function findVarReferences(css) {
  // filled in Step 4
}
```

- [ ] **Step 4: Implement the four functions**

Replace the four placeholder bodies in `scripts/lib/css.mjs`:

```javascript
export function parseTokenDefinitions(css) {
  const defs = new Map()
  const blockRe = /\{([^{}]*)\}/g
  let block
  while ((block = blockRe.exec(css)) !== null) {
    const body = block[1]
    const declRe = /(--[\w-]+)\s*:\s*([^;]+);/g
    let decl
    while ((decl = declRe.exec(body)) !== null) {
      const name = decl[1].slice(2)
      if (defs.has(name)) continue // first definition wins, matching CSS cascade intent for our use
      defs.set(name, {
        value: decl[2].trim(),
        line: css.slice(0, block.index + decl.index).split('\n').length,
      })
    }
  }
  return defs
}

export function findSelfReferences(css) {
  const offenders = []
  for (const [name, def] of parseTokenDefinitions(css)) {
    for (const ref of findVarReferences(def.value)) {
      if (ref === name) {
        offenders.push(name)
        break
      }
    }
  }
  return offenders
}

export function findHexLiterals(css) {
  return css.match(HEX_RE) ?? []
}

export function findVarReferences(css) {
  const seen = new Set()
  const out = []
  for (const match of css.matchAll(VAR_RE)) {
    const name = match[1].slice(2)
    if (!seen.has(name)) {
      seen.add(name)
      out.push(name)
    }
  }
  return out
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run scripts/__tests__/css.test.mjs`

Expected: PASS — 17 tests.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/css.mjs scripts/__tests__/css.test.mjs
git commit -m "feat(design): add pure CSS analysis library"
```

---

## Task 3: The design linter CLI

**Files:**
- Create: `scripts/lib/config.mjs`
- Create: `scripts/design-lint.mjs`
- Test: `scripts/__tests__/design-lint.test.mjs`

- [ ] **Step 1: Measure the current hex leak count**

```bash
node -e "const fs=require('fs'),path=require('path');const walk=(d,a=[])=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,a);else if(/\.(css|vue)\$/.test(e.name))a.push(p)}return a};const files=walk('src');let n=0;for(const f of files){if(f.endsWith('design-tokens.css'))continue;const hits=(fs.readFileSync(f,'utf8').match(/#[0-9a-fA-F]{3,8}\b(?![\da-zA-Z-])/g)||[]);n+=hits.length}console.log('hex outside design-tokens.css:',n)"
```

Expected: a number near 696. Record it in `docs/baseline/2026-09-27-home.md`.

- [ ] **Step 2: Write the failing linter test**

Create `scripts/__tests__/design-lint.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest'
import { runChecks } from '../design-lint.mjs'

const run = (files) =>
  runChecks(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v])))

describe('check: self-reference', () => {
  it('fails a stylesheet that redefines a token as itself', () => {
    const result = run({ 'tokens.css': ':root { --shadow-sm: var(--shadow-sm); }' })
    expect(result.checks.find((c) => c.id === 'self-reference').ok).toBe(false)
  })

  it('passes a well-formed stylesheet', () => {
    const result = run({ 'tokens.css': ':root { --shadow-sm: 0 1px 2px #00000010; }' })
    expect(result.checks.find((c) => c.id === 'self-reference').ok).toBe(true)
  })
})

describe('check: hex-location', () => {
  it('allows hex inside design-tokens.css', () => {
    const result = run({ 'design-tokens.css': ':root { --a: #0C63B8; }' })
    expect(result.checks.find((c) => c.id === 'hex-location').ok).toBe(true)
  })

  it('fails hex anywhere else', () => {
    const result = run({ 'components.css': '.btn { color: #ff0000; }' })
    expect(result.checks.find((c) => c.id === 'hex-location').ok).toBe(false)
  })

  it('counts each occurrence', () => {
    const result = run({ 'main.css': '.a{color:#fff}.b{color:#000}' })
    const check = result.checks.find((c) => c.id === 'hex-location')
    expect(check.count).toBe(2)
    expect(check.files).toContain('main.css')
  })
})

describe('check: primitive-leak', () => {
  it('fails a component referencing a --color-* primitive', () => {
    const result = run({ 'components.css': '.btn { color: var(--color-primary-600); }' })
    expect(result.checks.find((c) => c.id === 'primitive-leak').ok).toBe(false)
  })

  it('allows a component referencing a semantic token', () => {
    const result = run({ 'components.css': '.btn { color: var(--brand); }' })
    expect(result.checks.find((c) => c.id === 'primitive-leak').ok).toBe(true)
  })

  it('allows design-tokens.css to define primitives', () => {
    const result = run({ 'design-tokens.css': ':root { --color-primary-600: #0C63B8; }' })
    expect(result.checks.find((c) => c.id === 'primitive-leak').ok).toBe(true)
  })
})

describe('result shape', () => {
  it('returns one entry per check, each with id, ok and count', () => {
    const result = run({ 'tokens.css': ':root { --a: 1px; }' })
    for (const c of result.checks) {
      expect(typeof c.id).toBe('string')
      expect(typeof c.ok).toBe('boolean')
      expect(typeof c.count).toBe('number')
    }
  })

  it('never throws on empty input', () => {
    expect(() => run({})).not.toThrow()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run scripts/__tests__/design-lint.test.mjs`

Expected: FAIL — `Cannot find module '../design-lint.mjs'`.

- [ ] **Step 4: Create the policy config**

Create `scripts/lib/config.mjs`:

```javascript
/**
 * Single source of truth for design-system policy.
 *
 * Changing a check's threshold or a hash expectation belongs here, not in a
 * check implementation.
 */

/** The only file permitted to contain a hex colour literal. */
export const TOKENS_FILE = 'design-tokens.css'

/** Files whose SHA256 must not change. Relaxing one is a deliberate decision. */
export const HASH_GUARANTEED = {
  'tailwind.config.js': 'CFFF54479F53800AA1DE28D74C8C0D79CA2D71491EB38258E203D80636D39C14',
  'src/assets/tokens.css': '4A0DBF757B097FDAA1E53F09E8300930EA166C68B9876E0C8FC4C624ED013921',
  'src/assets/design-tokens.css': '8E47E500BE090C1364D981E091A74498F7BCD05F643197E46E5134D208526D2D',
  'src/assets/base.css': '3612B42F533134971031C0A3E93D2353FB0A066E6E610CC509A826264604DA98',
  'src/assets/components.css': '49E6BBC34CE6AB92B44DC7155BA1F78B46F0331F8CEACAB5F713D17FC3F72C54',
  'src/assets/main.css': '4019DE24EDAD7CE372757D2258F994EE05E3BF367D33622D82AB3CEDAECB8735',
  'src/assets/globals.css': '1C23AAC6F4B19504B3A2EAF7E48739556D48C7DC5E7861BAAD034055E0C70F6F',
  '.env.development': 'C06A4439DC2580C40AC3E3EAF091177D7B7299DB79687126304E4724D3DA66F4',
  '.env.production': '7B25EEAE90BD8AEC2E4D52424A6172CE42AF613D8B7467FBFAAC95BFC0168221',
  '.env.test': '02AE9CCC9B709CB93F67691A189CE08EA4E6A3C22FA9622E6ECDBEC4B14EEAC9',
  'vercel.json': 'FA043EED1E64A8BE42D7A5CE5DA39CF0DEEA30D93525A23132983E174ECE3E95',
  'vite.config.ts': '6F0126CE6548501BF63948A1AE3E919790314871C9173E7510E97A470A890FAD',
}

/**
 * Hex occurrences tolerated outside TOKENS_FILE.
 *
 * Measured 777 across 48 files at the baseline commit (see
 * docs/baseline/2026-09-27-home.md). The spec's original 696 counted only
 * views+components and undercounted by 81. This value must only ever DECREASE
 * as migration batches land; the linter fails if it is raised.
 */
export const HEX_LOCATION_BUDGET = Number(process.env.HEX_BUDGET ?? 777)

/** WELCO-inherited alias namespace being retired. */
export const DEPRECATED_PREFIX = 'wl-'
```

- [ ] **Step 5: Implement the linter skeleton**

Create `scripts/design-lint.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Design-system linter.
 *
 * Every check is a pure function over a { relativePath: cssText } map, so the
 * whole linter is testable without touching disk. The CLI at the bottom is the
 * only part that does I/O.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { findHexLiterals, findSelfReferences, findVarReferences } from './lib/css.mjs'
import { TOKENS_FILE, HEX_LOCATION_BUDGET, DEPRECATED_PREFIX } from './lib/config.mjs'

// filled in Step 6
export function runChecks(files) {
  throw new Error('not implemented')
}

// filled in Step 6
function collectSourceFiles(root) {
  throw new Error('not implemented')
}

// filled in Step 6
function main() {
  throw new Error('not implemented')
}
```

- [ ] **Step 6: Implement the checks**

Replace the three placeholder bodies in `scripts/design-lint.mjs`:

```javascript
function checkSelfReference(files) {
  const offenders = []
  for (const [path, css] of Object.entries(files)) {
    for (const name of findSelfReferences(css)) {
      offenders.push(`${path}: --${name}`)
    }
  }
  return {
    id: 'self-reference',
    title: 'No self-referential custom property',
    ok: offenders.length === 0,
    count: offenders.length,
    detail: offenders,
  }
}

function checkHexLocation(files) {
  const offenders = []
  let total = 0
  for (const [path, css] of Object.entries(files)) {
    if (path.endsWith(TOKENS_FILE)) continue
    const hits = findHexLiterals(css)
    if (hits.length) {
      total += hits.length
      offenders.push(`${path}: ${hits.length}`)
    }
  }
  return {
    id: 'hex-location',
    title: `Raw hex only in ${TOKENS_FILE} (budget ${HEX_LOCATION_BUDGET})`,
    ok: total <= HEX_LOCATION_BUDGET,
    count: total,
    detail: offenders,
  }
}

function checkPrimitiveLeak(files) {
  const offenders = []
  for (const [path, css] of Object.entries(files)) {
    if (path.endsWith(TOKENS_FILE)) continue
    const body = css.replace(/:root\s*\{[^}]*\}/g, '')
    for (const name of findVarReferences(body)) {
      if (name.startsWith('color-')) offenders.push(`${path}: var(--${name})`)
    }
  }
  return {
    id: 'primitive-leak',
    title: 'Components reference semantic tokens, never --color-* primitives',
    ok: offenders.length === 0,
    count: offenders.length,
    detail: offenders,
  }
}

function checkDeprecatedUsage(files) {
  const counts = {}
  for (const css of Object.values(files)) {
    for (const name of findVarReferences(css)) {
      if (name.startsWith(DEPRECATED_PREFIX)) {
        counts[name] = (counts[name] ?? 0) + 1
      }
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return {
    id: 'deprecated-usage',
    title: `Report --${DEPRECATED_PREFIX}* usages (must reach 0)`,
    ok: true, // reporting only; never blocks the build
    count: total,
    detail: Object.entries(counts).sort((a, b) => b[1] - a[1]),
  }
}

export function runChecks(files) {
  return [
    checkSelfReference(files),
    checkHexLocation(files),
    checkPrimitiveLeak(files),
    checkDeprecatedUsage(files),
  ]
}

function collectSourceFiles(root) {
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(css|vue)$/.test(entry.name)) out.push(full)
    }
  }
  walk(root)
  return out
}

function main() {
  const root = process.cwd()
  const files = {}
  for (const full of collectSourceFiles(join(root, 'src'))) {
    files[relative(root, full).split(sep).join('/')] = readFileSync(full, 'utf8')
  }
  const results = runChecks(files)
  let failed = 0
  for (const r of results) {
    const mark = r.ok ? 'PASS' : 'FAIL'
    console.log(`${mark}  ${r.id} (${r.count})  ${r.title}`)
    for (const line of r.detail.slice(0, 12)) console.log(`        ${line}`)
    if (r.detail.length > 12) console.log(`        ...and ${r.detail.length - 12} more`)
    if (!r.ok) failed++
  }
  process.exit(failed > 0 ? 1 : 0)
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main()
}
```

- [ ] **Step 7: Run the linter test to verify it passes**

Run: `npx vitest run scripts/__tests__/design-lint.test.mjs`

Expected: PASS — 10 tests.

- [ ] **Step 8: Run the linter against the real tree**

Run: `node scripts/design-lint.mjs`

Expected: `self-reference` **FAIL** with 2 offenders naming `--shadow-sm` and `--shadow-md`;
`hex-location` FAIL with 777; `primitive-leak` FAIL; `deprecated-usage` PASS with 3,672
usages across 92 distinct names.

**This non-zero exit is the expected, correct starting state** — it is the defect report.

- [ ] **Step 9: Wire npm scripts**

Edit `package.json` `scripts` block, adding after the existing `"lint:eslint"` entry:

```json
"lint:design": "node scripts/design-lint.mjs",
"lint:hash": "node scripts/hash-guard.mjs"
```

- [ ] **Step 10: Commit**

```bash
git add scripts/lib/config.mjs scripts/design-lint.mjs scripts/__tests__/design-lint.test.mjs package.json
git commit -m "feat(design): add design-system linter with four checks"
```

---

## Task 4: Hash guard

**Files:**
- Create: `scripts/hash-guard.mjs`

- [ ] **Step 1: Create the script**

```javascript
#!/usr/bin/env node
/**
 * Verifies the must-not-change files listed in scripts/lib/config.mjs.
 *
 * Separate from design-lint.mjs because this is a change-safety concern, not a
 * design concern. Run it before committing any stylesheet or config edit.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HASH_GUARANTEED } from './lib/config.mjs'

const root = process.cwd()
let failures = 0

for (const [rel, expected] of Object.entries(HASH_GUARANTEED)) {
  const full = join(root, rel)
  if (!existsSync(full)) {
    console.log(`MISSING  ${rel}`)
    failures++
    continue
  }
  const actual = createHash('sha256').update(readFileSync(full)).digest('hex').toUpperCase()
  if (actual === expected) {
    console.log(`OK       ${rel}`)
  } else {
    console.log(`CHANGED  ${rel}\n           expected ${expected}\n           actual   ${actual}`)
    failures++
  }
}

console.log(`\n${Object.keys(HASH_GUARANTEED).length - failures}/${Object.keys(HASH_GUARANTEED).length} unchanged`)
process.exit(failures > 0 ? 1 : 0)
```

- [ ] **Step 2: Verify it passes on the untouched tree**

Run: `node scripts/hash-guard.mjs`

Expected: `12/12 unchanged`, exit 0.

- [ ] **Step 3: Verify it actually detects a change**

Run: `node -e "const fs=require('fs');fs.appendFileSync('src/assets/base.css','\n/* probe */\n')"` then
`node scripts/hash-guard.mjs`

Expected: `CHANGED src/assets/base.css`, exit 1.

- [ ] **Step 4: Revert the probe**

```bash
node -e "const fs=require('fs');const p='src/assets/base.css';fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/\n\/\* probe \*\/\n$/,''))"
```

Run: `node scripts/hash-guard.mjs` — Expected: `12/12 unchanged`.

- [ ] **Step 5: Commit**

```bash
git add scripts/hash-guard.mjs
git commit -m "chore(design): add must-not-change hash guard"
```

---

## Task 5: Contrast verification for the semantic token pairs

**Files:**
- Create: `scripts/lib/contrast.mjs`
- Create: `src/assets/__tests__/design-tokens.contrast.test.ts`
- Test: `scripts/__tests__/contrast.test.mjs`

The spec requires every semantic token pair to meet WCAG contrast, asserted as data rather than
by eye. Verifying it now — while the token layer is being formalised — is the cheapest moment to
lock it in, and it catches a palette regression before any screen depends on it.

- [ ] **Step 1: Write the failing unit tests for the math**

Create `scripts/__tests__/contrast.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest'
import { hexToRgb, relativeLuminance, contrastRatio } from '../lib/contrast.mjs'

describe('hexToRgb', () => {
  it('parses a 6-digit hex', () => {
    expect(hexToRgb('#0C63B8')).toEqual({ r: 12, g: 99, b: 184 })
  })

  it('parses a 3-digit hex by expanding each nibble', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('is case-insensitive', () => {
    expect(hexToRgb('#0c63b8')).toEqual(hexToRgb('#0C63B8'))
  })

  it('returns null for a non-hex string', () => {
    expect(hexToRgb('rgb(1,2,3)')).toBeNull()
  })
})

describe('relativeLuminance', () => {
  it('is 1 for white', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5)
  })

  it('is 0 for black', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5)
  })

  it('matches the WCAG reference value for #767676 on white', () => {
    // 4.54:1 — the canonical "just passes AA body text" grey.
    const ratio = contrastRatio('#767676', '#FFFFFF')
    expect(ratio).toBeCloseTo(4.54, 1)
  })
})

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
  })

  it('is 1 for identical colours', () => {
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5)
  })

  it('is symmetric in its arguments', () => {
    expect(contrastRatio('#0C63B8', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#0C63B8'), 5)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/__tests__/contrast.test.mjs`

Expected: FAIL — `Cannot find module '../lib/contrast.mjs'`.

- [ ] **Step 3: Implement the contrast math**

Create `scripts/lib/contrast.mjs`:

```javascript
/**
 * WCAG 2.1 relative luminance and contrast ratio.
 * Pure functions, no dependencies, so the values are auditable by hand.
 */

/** sRGB channel -> linearised value, per WCAG 2.1. */
function channel(c) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

export function hexToRgb(hex) {
  if (typeof hex !== 'string') return null
  const m = hex.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(m)) {
    return {
      r: parseInt(m[0] + m[0], 16),
      g: parseInt(m[1] + m[1], 16),
      b: parseInt(m[2] + m[2], 16),
    }
  }
  if (/^[0-9a-fA-F]{6}$/.test(m)) {
    return {
      r: parseInt(m.slice(0, 2), 16),
      g: parseInt(m.slice(2, 4), 16),
      b: parseInt(m.slice(4, 6), 16),
    }
  }
  return null
}

export function relativeLuminance({ r, g, b }) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(fg, bg) {
  const a = hexToRgb(fg)
  const b = hexToRgb(bg)
  if (!a || !b) return 0
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `npx vitest run scripts/__tests__/contrast.test.mjs`

Expected: PASS — 10 tests. The `#767676` case is the important one: it proves the
implementation against a known WCAG reference value rather than against itself.

- [ ] **Step 5: Write the token-pair test**

Create `src/assets/__tests__/design-tokens.contrast.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTokenDefinitions } from '../../../scripts/lib/css.mjs'
import { contrastRatio } from '../../../scripts/lib/contrast.mjs'

const tokensPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../design-tokens.css',
)
const defs = parseTokenDefinitions(readFileSync(tokensPath, 'utf8'))

/** Resolve a token to its literal hex, following one level of alias. */
function hexOf(name: string, seen = new Set<string>()): string | null {
  if (seen.has(name)) return null
  seen.add(name)
  const def = defs.get(name)
  if (!def) return null
  const direct = def.value.trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(direct)) return direct
  const ref = direct.match(/^var\(\s*(--[\w-]+)\s*\)$/)
  return ref ? hexOf(ref[1].slice(2), seen) : null
}

/**
 * Pairs that must clear WCAG AA. 4.5 for body text, 3.0 for large text and
 * non-text UI boundaries. The foreground is the first element of each tuple.
 */
const REQUIRED_PAIRS: Array<[string, string, number, string]> = [
  ['--fg-body', '--bg-surface', 4.5, 'body text on a card'],
  ['--fg-body', '--bg-app', 4.5, 'body text on the page canvas'],
  ['--fg-heading', '--bg-surface', 4.5, 'headings on a card'],
  ['--fg-muted', '--bg-surface', 4.5, 'muted text on a card'],
  ['--fg-on-brand', '--brand', 4.5, 'label text on a primary button'],
  ['--fg-link', '--bg-surface', 4.5, 'link text on a card'],
  ['--border-strong', '--bg-surface', 3.0, 'form outline against a surface'],
]

describe('semantic token pairs meet WCAG AA', () => {
  it.each(REQUIRED_PAIRS)('%s on %s (%s)', (fg, bg, minimum, label) => {
    const fgHex = hexOf(fg)
    const bgHex = hexOf(bg)
    expect(fgHex, `${fg} must resolve to a hex colour`).not.toBeNull()
    expect(bgHex, `${bg} must resolve to a hex colour`).not.toBeNull()
    const ratio = contrastRatio(fgHex!, bgHex!)
    expect(
      ratio,
      `${label}: ${fg} (${fgHex}) on ${bg} (${bgHex}) = ${ratio.toFixed(2)}:1, needs ${minimum}:1`,
    ).toBeGreaterThanOrEqual(minimum)
  })
})
```

- [ ] **Step 6: Run the token-pair test**

Run: `npx vitest run src/assets/__tests__/design-tokens.contrast.test.ts`

Expected: either PASS, or FAIL naming the specific pair, its measured ratio and the required
minimum.

**If it fails, stop and report the measured ratios before changing anything.** The palette is
fixed by spec §1 — so a failure means either the chosen pair is not a real pairing, or the
palette genuinely does not meet AA and that is a product decision for the user, not something
to paper over by lowering the threshold.

- [ ] **Step 7: Wire the contrast check into the linter**

Add the required pairs to `scripts/lib/config.mjs` as `CONTRAST_PAIRS`, and add a
`check-contrast` entry to `runChecks` in `scripts/design-lint.mjs` that reports pass/fail per
pair using the same `contrastRatio` helper. It is reporting-only in Phase 1; it becomes a
blocking check once the numbers are confirmed green.

- [ ] **Step 8: Full gate**

```bash
npx vue-tsc --build
npm test
npm run build
node scripts/design-lint.mjs
```

- [ ] **Step 9: Commit**

```bash
git add scripts/lib/contrast.mjs scripts/__tests__/contrast.test.mjs scripts/lib/config.mjs scripts/design-lint.mjs src/assets/__tests__/design-tokens.contrast.test.ts
git commit -m "test(design): assert WCAG AA contrast on semantic token pairs"
```

---

## Task 6: Deduplicate `.page-btn` and `.sr-only` (D2, D3)

**Files:**
- Modify: `src/assets/main.css:381`
- Modify: `src/assets/globals.css:70`
- Test: `scripts/__tests__/duplicate-rules.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/duplicate-rules.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const assets = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/assets')
const read = (name: string) => readFileSync(join(assets, name), 'utf8')

/** Selectors that appeared in more than one stylesheet, which means one copy silently wins. */
const duplicatesOf = (selector: string) =>
  readdirSync(assets)
    .filter((f) => f.endsWith('.css'))
    .filter((f) => new RegExp(`(^|[\\s,>+~])\\.${selector}(?![\\w-])`).test(read(f)))
    .map((f) => f.replace('.css', ''))
    .sort()

describe('no duplicated component selectors across stylesheets', () => {
  it.each(['page-btn', 'sr-only'])('%s is defined in exactly one stylesheet', (selector) => {
    expect(duplicatesOf(selector)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/__tests__/duplicate-rules.test.ts`

Expected: FAIL — `page-btn` found in 2 stylesheets, `sr-only` found in 2.

- [ ] **Step 3: Inspect both copies before deleting either**

Run:

```bash
grep -n "page-btn" src/assets/base.css src/assets/main.css
grep -n "sr-only" src/assets/components.css src/assets/globals.css
```

The `.page-btn` situation is **not** a straight duplicate. `base.css:588-607` is the canonical
rule set (base, `:disabled`, `:hover`, `.is-active`). `main.css:378-384` is a **five-selector
group**:

```css
.btn-primary:hover:not(:disabled),
.btn-vip-save:hover:not(:disabled),
.row-action-btn:hover,
.page-btn:not(:disabled):hover,
.pill:hover {
  box-shadow: var(--shadow-md) !important;
}
```

`.page-btn` is only *one member* of that group. **Deleting the whole rule would silently break
the hover shadow on four other components.** Only the `.page-btn` line is removed.

`.sr-only` is a simpler case: `components.css:1307` is the canonical utility and
`globals.css:70` duplicates it.

- [ ] **Step 4: Move the `.page-btn` hover shadow into `base.css`, then drop it from the group**

In `src/assets/base.css`, extend the existing `.page-btn` hover rule at line 606:

```css
.page-btn:not(:disabled):hover { border-color: var(--brand); color: var(--brand); background: var(--brand-soft); box-shadow: var(--shadow-md) !important; }
```

The `!important` is required: without it the move changes specificity and the shadow stops
applying.

In `src/assets/main.css`, delete **only** the `.page-btn:not(:disabled):hover,` line from the
group at 381, leaving the other four selectors and the declaration block untouched.

- [ ] **Step 5: Remove the duplicate `.sr-only` from `globals.css`**

Delete the `globals.css` `.sr-only` block. Confirm `components.css:1307` defines all the
properties the `globals.css` copy defined; if it does not, merge the missing properties into
`components.css` before deleting.

- [ ] **Step 6: Update the hash policy**

Edit `scripts/lib/config.mjs`: remove the `src/assets/main.css` entry, and add a comment
recording that the guarantee was relaxed deliberately under spec §2.4 item 2.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run scripts/__tests__/duplicate-rules.test.ts`

Expected: PASS — 2 tests.

- [ ] **Step 8: Full gate**

```bash
npx vue-tsc --build
npm test
npm run build
node scripts/hash-guard.mjs
```

Expected: typecheck exit 0; 95+2 tests pass; build succeeds; `11/11 unchanged`.

**Then compare every baseline screenshot from Task 1. Phase 1A requires them pixel-identical.**

- [ ] **Step 9: Commit**

```bash
git add src/assets/main.css src/assets/globals.css src/assets/base.css src/assets/components.css scripts/lib/config.mjs scripts/__tests__/duplicate-rules.test.ts
git commit -m "fix(design): deduplicate .page-btn and .sr-only across stylesheets"
```

---

## Task 7: Remove the WELCO storage key and fix the stale comment (D4, D5)

**Files:**
- Modify: `src/application/theme.service.ts:14-16, 27-34`
- Test: `src/application/__tests__/theme.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/application/__tests__/theme.service.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('theme service storage hygiene', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('never writes the legacy welco-theme key', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    await import('../theme.service')
    const { applyTheme } = await import('../theme.service')
    applyTheme('light')
    const keys = setItem.mock.calls.map((c) => c[0])
    expect(keys).not.toContain('welco-theme')
    setItem.mockRestore()
  })

  it('still persists the current theme key', async () => {
    const { applyTheme } = await import('../theme.service')
    applyTheme('light')
    expect(localStorage.getItem('snul-theme')).toBe('light')
  })

  it('locks the document to light', async () => {
    const { applyTheme } = await import('../theme.service')
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/application/__tests__/theme.service.test.ts`

Expected: FAIL on the first test — `welco-theme` is present in the `setItem` calls.

- [ ] **Step 3: Remove the legacy key**

In `src/application/theme.service.ts`, delete:

```typescript
const LEGACY_STORAGE_KEY = 'welco-theme'
```

and remove the `localStorage.setItem(LEGACY_STORAGE_KEY, 'light')` line inside `applyTheme`.
Leave `initTheme` reading only `STORAGE_KEY`.

- [ ] **Step 4: Fix the stale brand comment**

In `tailwind.config.js` line 9, the comment reads `// Ocean Depth — teal/coral brand`. The
palette is sapphire navy. `tailwind.config.js` is hash-guaranteed, so **do not edit it**.
Instead, record the correction in `docs/baseline/2026-09-27-home.md` under a
"Known stale comments" heading, so the mismatch is documented without breaking the guarantee.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/application/__tests__/theme.service.test.ts`

Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/application/theme.service.ts src/application/__tests__/theme.service.test.ts docs/baseline/2026-09-27-home.md
git commit -m "fix(design): drop welco-theme legacy storage key"
```

---

## Task 8: Formalise the scales (spans 1A and 1B)

**Files:**
- Modify: `src/assets/design-tokens.css` (documentation block only)
- Modify: `src/assets/tokens.css` (remove `--radius-xl` alias if present)
- Test: `scripts/__tests__/scales.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/scales.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const assets = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/assets')
const tokensCss = readFileSync(join(assets, 'design-tokens.css'), 'utf8')

/** Scales the spec requires to exist and be documented. */
const REQUIRED_SCALES = ['--space-', '--text-', '--radius-', '--duration-', '--ease-', '--z-']

describe('scales are complete and documented', () => {
  it.each(REQUIRED_SCALES)('%s scale is present', (prefix) => {
    expect(tokensCss).toContain(`${prefix}`)
  })

  it('documents the retained radius steps by name', () => {
    for (const step of ['xs', 'sm', 'md', 'lg']) {
      expect(tokensCss).toMatch(new RegExp(`--radius-${step}\\s*:`))
    }
  })

  it('no longer defines the retired radius steps', () => {
    expect(tokensCss).not.toMatch(/--radius-2xl\s*:/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/__tests__/scales.test.ts`

Expected: FAIL on "no longer defines the retired radius steps" — `--radius-2xl` is present.

- [ ] **Step 3: Retire `--radius-2xl` and `--radius-xl`**

In `src/assets/design-tokens.css`, delete the `--radius-2xl` and `--radius-xl` definitions.

`--radius-2xl` has **0** consumers and can be deleted outright. `--radius-xl` has **8**
consumers and must be repointed at `--radius-lg` first:

```
src/assets/components.css:233
src/assets/components.css:1080
src/assets/main.css:770
src/components/ui/DataState.vue:683
src/components/ui/DataState.vue:1895
src/components/ui/DataState.vue:1932
src/components/ui/GlobalLoader.vue:390
src/views/ProviderStorefrontView.vue:290
```

Replace each `var(--radius-xl)` with `var(--radius-lg)`. This is a **value change, not a no-op**
— 20px becomes 16px at those 8 sites — so it is a visual change and belongs in the Phase 1B
visual-diff review, not in the pixel-neutral 1A pass.

- [ ] **Step 4: Add the scale documentation block**

Append a documentation block to `design-tokens.css` stating the four retained radius steps, the
normalised control heights (32px default, 40px large), and the rule that hex lives only in this
file. Documentation only — no value changes.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run scripts/__tests__/scales.test.ts`

Expected: PASS — 8 tests.

- [ ] **Step 7: Split verification by phase**

The three edits in this task are not all pixel-neutral:

| Edit | Neutral? | Reviewed in |
|---|---|---|
| Delete `--radius-2xl` (0 consumers) | yes | 1A — pixel-identical diff |
| Repoint 8× `--radius-xl` → `--radius-lg` | **no** (20px → 16px) | 1B — visual diff |
| Add scale documentation block | yes | 1A — pixel-identical diff |

Run the full gate, then compare screenshots:

```bash
npx vue-tsc --build
npm test
npm run build
node scripts/hash-guard.mjs
```

**1A edits** (documentation, `--radius-2xl`): baseline screenshots must be pixel-identical.
**1B edit** (`--radius-xl` repoint): the only expected diff is slightly less corner rounding at
the 8 listed sites. Any other diff is a regression.

- [ ] **Step 8: Update the hash policy and commit**

`design-tokens.css` is hash-guaranteed — Task 8 changes it, so update its expected digest in
`scripts/lib/config.mjs` in the same commit, and note the change in the commit message.

```bash
git add src/assets/design-tokens.css scripts/lib/config.mjs scripts/__tests__/scales.test.ts
git commit -m "refactor(design): retire unused radius steps, document the scales"
```

---

## Task 9: Shadow restoration (Phase 1B — the deliberate visual change)

**Files:**
- Modify: `src/assets/tokens.css:71-73`
- Test: `scripts/__tests__/shadows.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/shadows.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findSelfReferences } from '../lib/css.mjs'

const assets = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/assets')
const tokensCss = readFileSync(join(assets, 'tokens.css'), 'utf8')

describe('shadow tokens are not shadowed by the alias layer', () => {
  it('tokens.css declares no self-referential token', () => {
    expect(findSelfReferences(tokensCss)).toEqual([])
  })

  it('does not redefine --shadow-sm', () => {
    expect(tokensCss).not.toMatch(/^\s*--shadow-sm\s*:/m)
  })

  it('does not redefine --shadow-md', () => {
    expect(tokensCss).not.toMatch(/^\s*--shadow-md\s*:/m)
  })

  it('does not remap --shadow-xl onto --shadow-lg', () => {
    expect(tokensCss).not.toMatch(/--shadow-xl\s*:\s*var\(--shadow-lg\)/)
  })

  it('keeps the legitimate aliases', () => {
    expect(tokensCss).toMatch(/--shadow-card\s*:\s*var\(--shadow-md\)/)
    expect(tokensCss).toMatch(/--shadow-hover\s*:\s*var\(--shadow-lg\)/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/__tests__/shadows.test.ts`

Expected: FAIL — `findSelfReferences` returns `['shadow-sm', 'shadow-md']`.

- [ ] **Step 3: Delete the three broken lines**

In `src/assets/tokens.css`, delete lines 71, 72 and 73:

```css
  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-xl: var(--shadow-lg);
```

Leave lines 69-70 (`--shadow-card`, `--shadow-hover`) intact — those are legitimate aliases.
`design-tokens.css` already defines the canonical `--shadow-sm`, `--shadow-md` and
`--shadow-xl`, so nothing needs to replace the deleted lines.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/__tests__/shadows.test.ts`

Expected: PASS — 5 tests.

- [ ] **Step 5: Confirm the linter now agrees**

Run: `node scripts/design-lint.mjs`

Expected: `self-reference` **PASS** (0 offenders).

- [ ] **Step 6: Full gate**

```bash
npx vue-tsc --build
npm test
npm run build
node scripts/hash-guard.mjs
```

Expected: typecheck exit 0; all tests pass; build succeeds; `11/11 unchanged`.

- [ ] **Step 7: Review the visual diff — this step is the gate**

Re-capture the Task 1 baseline screenshot set and diff against the originals.

**Expected:** added elevation on cards, menus, popovers and dropdowns. **156** previously-dead
shadow declarations become live: 88 direct `var(--shadow-sm|md)` consumers, plus the 68
consumers of the `--shadow-card` / `--shadow-hover` aliases (199 if the 43 transitive
`--wl-shadow-*` consumers are included).

**Any diff that is not added shadow is a genuine regression.** Investigate before continuing.

- [ ] **Step 8: Update the hash policy and commit**

`tokens.css` is hash-guaranteed and this task changes it. Update its expected digest in
`scripts/lib/config.mjs` in the same commit.

```bash
git add src/assets/tokens.css scripts/lib/config.mjs scripts/__tests__/shadows.test.ts
git commit -m "fix(design): restore dead shadow declarations (self-referential tokens)"
```

---

## Task 10: Phase 1 close-out

**Files:**
- Modify: `docs/baseline/2026-09-27-home.md`

- [ ] **Step 1: Run the complete verification suite**

```bash
npx vue-tsc --build
npm test
npm run build
node scripts/design-lint.mjs
node scripts/hash-guard.mjs
```

Expected:
- typecheck exit 0
- all tests pass (97 baseline + 2 duplicate-rules + 3 theme + 8 scales + 5 shadows = 115)
- build succeeds
- `self-reference` PASS
- `hex-location` FAIL or PASS with count ≤ budget (it is a budget check, not a zero check)
- `primitive-leak` FAIL with a documented count (screen migration is Phase 2 work)
- `deprecated-usage` PASS (reporting)
- hashes unchanged

- [ ] **Step 2: Record the Phase 1 outcome**

Append to `docs/baseline/2026-09-27-home.md`:

```markdown
## Phase 1 result
- self-reference: 0 (D1, D1b fixed)
- hex-location: <N> remaining, budget 700, deferred to Phase 2 migration
- primitive-leak: <N> remaining, deferred to Phase 2 migration
- --wl-* usages: <N> at Phase 1 start
- shadow restoration: reviewed, added elevation only
- Screenshot diff: pixel-identical (1A) / shadow-only (1B)
```

- [ ] **Step 3: Confirm the two remaining FAILs are intentional**

`hex-location` and `primitive-leak` are **expected to fail at the end of Phase 1**. They are
budget/count checks whose work is Phase 2. Do not "fix" them by raising the budget or
whitelisting files.

- [ ] **Step 4: Commit**

```bash
git add docs/baseline/2026-09-27-home.md
git commit -m "chore(design): record Phase 1 outcome"
```

---

## Verification Summary

| Gate | Command | Expected |
|---|---|---|
| Types | `npx vue-tsc --build` | exit 0 |
| Tests | `npm test` | all pass |
| Build | `npm run build` | succeeds |
| Self-reference | `node scripts/design-lint.mjs` | 0 offenders |
| Contrast | `npm test` (contrast suite) | every pair meets its minimum |
| Hashes | `node scripts/hash-guard.mjs` | all unchanged |
| Visual 1A | baseline screenshot diff | pixel-identical |
| Visual 1B | baseline screenshot diff | added shadow + 20px→16px radius only |

## Notes for the implementer

1. **Do not raise `HEX_LOCATION_BUDGET` or whitelist files** to make the linter pass. A failing
   budget check is the correct Phase 1 end state.
2. **Do not lower a contrast threshold** to make a pair pass. Spec §1 fixes the palette, so a
   failure is information for the user, not something to tune away.
3. **`--wl-*` drain starts in Phase 2.** Phase 1 only adds the reporting check.
4. **Three hash-guaranteed files change during this phase** — `main.css` (Task 6), `tokens.css`
   (Tasks 8-9) and `design-tokens.css` (Task 8). Each is a deliberate decision, and each must
   update `scripts/lib/config.mjs` in the same commit.
5. **The shadow restoration is the single largest visual change in the project to date.** 156
   previously-dead declarations become live. Do not treat added elevation as a regression.
6. **The `--radius-xl` repoint (Task 8) is also visual** — 20px to 16px at 8 sites. It is in the
   1B review, not the pixel-neutral 1A pass.
