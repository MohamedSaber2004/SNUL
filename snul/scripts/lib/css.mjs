/**
 * Pure CSS analysis helpers. No filesystem access, so every function is
 * directly unit-testable against a CSS string.
 *
 * Scope note: this is intentionally a focused scanner, not a full CSS parser.
 * It understands custom-property definitions and var()/hex patterns, which is
 * everything the design-system checks need. Native CSS nesting (`&:hover`) is
 * not understood, and only parseTokenDefinitions masks comments: findHexLiterals
 * and findVarReferences are raw text scans, so a hex or a var() that only
 * appears inside a comment is still reported by them.
 */

/** Matches a hex colour literal, but not a hex-shaped word inside an identifier. */
const HEX_RE = /#[0-9a-fA-F]{3,8}\b(?![0-9a-zA-Z-])/g

/** Matches var(--name) including an optional fallback. */
const VAR_RE = /var\(\s*(--[\w-]+)/g

/**
 * Comments. A `}` or a `--x: ...;` inside one would otherwise close a block
 * early or register as a real declaration, and both failures are silent.
 */
const COMMENT_RE = /\/\*[\s\S]*?\*\//g

/**
 * Blanks out comments so the block and declaration matchers only see real CSS.
 * Every character becomes exactly one space and newlines are left in place, so
 * the result has the same length and the same line numbering as the input --
 * which matters, because parseTokenDefinitions derives `line` from character
 * offsets into the original string.
 *
 * Quoted strings are deliberately not masked. A value such as
 * `--font-sans: "Inter", -apple-system` is genuine data, and blanking the
 * family names corrupts it. So `content: "{}"` remains a known limitation: the
 * `{` in a quoted string can still disturb block matching. For the same reason a
 * block-comment delimiter sequence inside a quoted string is masked as though
 * it were a real comment. There are no such occurrences in the repo.
 */
function maskComments(css) {
  return css.replace(COMMENT_RE, (comment) => comment.replace(/[^\r\n]/g, ' '))
}

/**
 * Reads custom-property definitions as a Map of name -> { value, line }.
 *
 * The first definition of a name is the one that lands in the map, so existing
 * callers see no change. Because that is not what CSS itself would do, every
 * later definition of the same name is recorded on the returned map's
 * `duplicates` array. Each entry is { name, value, line } for the *later*
 * definition; compare `value` against `defs.get(name).value` to tell an
 * identical redeclaration from a conflicting one.
 *
 * ⚠ DO NOT WIRE A FAILING `duplicate-definition` CHECK TO `duplicates`.
 * This scanner has no selector context, so it cannot distinguish a genuine
 * shadowed global token from the canonical scoped-override theming pattern.
 * Measured on the real corpus: 49 duplicates, 45 with differing values — and
 * almost all are legitimate, e.g. `.stat--rose { --stat-bg }`,
 * `.global-loader--sm { --logo-size }`, `[dir="rtl"] { --flip: -1 }`. A check
 * built on this signal would fail on ~48 non-defects on day one.
 *
 * ⚠ `duplicates` is an own property on the Map instance, so it is silently lost
 * by `new Map(defs)`, `Object.fromEntries(defs)`, `structuredClone(defs)` and
 * `{ ...defs }`. `JSON.stringify(defs)` returns `{"duplicates":[...]}` — not a
 * record of definitions. Read `defs.duplicates` directly off the returned map,
 * and never copy the map before doing so. (Vitest's toEqual/toMatchObject on a
 * Map compare entries only, so tests using them are unaffected.)
 */
export function parseTokenDefinitions(css) {
  const masked = maskComments(css)
  const defs = new Map()
  const duplicates = []
  const blockRe = /\{([^{}]*)\}/g
  let block
  while ((block = blockRe.exec(masked)) !== null) {
    const body = block[1]
    // A declaration ends at a `;` or at the end of the body, which is exactly
    // where the block's closing `}` sits -- the trailing `;` is optional in
    // CSS. The `\s*` before the terminator keeps the captured value trimmed.
    const declRe = /(--[\w-]+)\s*:\s*([^;{}]+?)\s*(?:;|$)/g
    let decl
    while ((decl = declRe.exec(body)) !== null) {
      const name = decl[1].slice(2)
      // `block[1]` starts at block.index + 1, so the declaration's offset in
      // the original text is block.index + 1 + decl.index.
      const def = {
        value: decl[2].trim(),
        line: masked.slice(0, block.index + 1 + decl.index).split('\n').length,
      }
      if (defs.has(name)) {
        // Not a cascade: the CSS cascade is last-wins for equal specificity,
        // and this scanner never looks at specificity at all.
        duplicates.push({ name, value: def.value, line: def.line })
        continue
      }
      defs.set(name, def)
    }
  }
  defs.duplicates = duplicates
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
