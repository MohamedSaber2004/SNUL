/**
 * Single source of truth for design-system policy.
 *
 * A check's threshold, its token-file exemption, or a file's expected digest
 * belongs here rather than in a check implementation, so tightening a rule is
 * a one-line policy edit instead of a code change. Nothing in this module
 * touches the filesystem or reads the environment beyond HEX_BUDGET.
 */

/**
 * The only stylesheet permitted to contain raw hex colour literals. Every other
 * `.css`/`.vue` file is expected to reach for a token instead. Matched as a
 * path suffix, so `src/assets/design-tokens.css` qualifies.
 *
 * Will change: only if the palette is split, in which case this becomes a set
 * exactly like `PRIMITIVE_EXEMPT_FILES` below.
 *
 * This is a full repo-relative path, not a bare filename, and must stay that
 * way. `design-lint.mjs` matches it with `path.endsWith`, so a bare name would
 * exempt *any* file whose path ended in `design-tokens.css` — a new
 * `src/views/design-tokens.css` full of hex would report clean and exit 0.
 * `PRIMITIVE_EXEMPT_FILES` had exactly that hole and it was closed; this value
 * is the same check, one function over.
 */
export const TOKENS_FILE = 'src/assets/design-tokens.css'

/**
 * Files permitted to reference a `--color-*` primitive, so they are exempt from
 * the `primitive-leak` check. Entries are full repo-relative paths, and must stay
 * that way: as bare filenames the set exempted *any* file whose path ended in
 * `tokens.css`, so a new `src/views/tokens.css` full of `var(--color-*)` would
 * report clean and exit 0.
 *
 * There are two entries because there are two token layers, and both legitimately
 * alias the raw palette:
 *
 * - `src/assets/design-tokens.css` — layer 1, the hex home: the `--color-*`
 *   scale is defined here in hex, which is why this file is exempt from
 *   `hex-location` rather than from this check. Its primitive *references* are a
 *   separate matter, and are what need exempting here: it also carries a block
 *   of semantic derivations beside the scale (`--bg-app: var(--color-neutral-50)`,
 *   `--fg-heading`, `--brand`), and spec §3.2 puts `--bg-*`/`--fg-*`/`--brand` in
 *   layer 2 — so "layer 1, where the scale is defined" was the wrong reason to
 *   exempt it from *this* check. §3.3 rule 3 makes those references aliases rather
 *   than literals, so re-theming a layer-1 primitive has to move them; a file that
 *   both defines the palette and derives semantics from it cannot be forbidden
 *   from referencing it.
 * - `src/assets/tokens.css` — layer 2 proper, where the semantic tokens are
 *   *derived* from the palette (spec §3.3 rule 3), e.g.
 *   `--color-success-100: var(--color-success-500)`. It defines no `--color-*` of
 *   its own, so every one of its primitive references is a legal alias.
 *
 * This is a path set rather than a `:root` block strip because a block strip
 * cannot express "only these two files": a `[^}]*` regex runs to the next `}`
 * anywhere in the file, so a truncated stylesheet stripped its whole tail and
 * reported clean, while a `:root, :root[data-theme="dark"] {` selector stripped
 * nothing at all. Both failures were silent.
 *
 * Will change: only when the palette is split into a third file, or when the two
 * layers are merged into one.
 */
export const PRIMITIVE_EXEMPT_FILES = [
  'src/assets/design-tokens.css',
  'src/assets/tokens.css',
]

/**
 * Files whose SHA256 must not change without a deliberate, documented decision.
 * Read by `scripts/hash-guard.mjs`, not by the linter.
 *
 * The list is kept in step with the `-text` entries in `.gitattributes`; the
 * three `.env` files carry CRLF endings, so without that attribute git would
 * normalise them on checkout and silently invalidate their digests.
 *
 * Will change: Phase 1 removes entries as migration batches land (`main.css` in
 * Task 6, then `tokens.css`, `design-tokens.css` and `base.css` in the later
 * tasks). Every removal or digest change must be recorded in the "Hash changes"
 * table of `docs/baseline/2026-09-27-home.md` in the same commit.
 */
export const HASH_GUARANTEED = {
  'tailwind.config.js': 'CFFF54479F53800AA1DE28D74C8C0D79CA2D71491EB38258E203D80636D39C14',
  'src/assets/tokens.css': '67482C423A07F6BFE04E1BAB85980B0CCE9B0B5A165636C25610A0D5B4482B13',
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
 * Measured 777 across 48 files at the baseline commit — see
 * `docs/baseline/2026-09-27-home.md`, which also records why the design spec's
 * 696 undercounted (it looked only at `src/views` and `src/components`).
 *
 * The value is a ratchet, not a target: it must only ever DECREASE, and each
 * decrease should land in the same commit as the batch that earned it. The
 * `HEX_BUDGET` env override exists so CI can pin the current value explicitly
 * rather than inheriting whatever a later edit left in this file.
 */
export const HEX_LOCATION_BUDGET = Number(process.env.HEX_BUDGET ?? 777)

/**
 * Namespace prefix of the WELCO-inherited aliases being retired. Anything
 * matching `--${DEPRECATED_PREFIX}*` is legacy debt rather than a defect, so
 * the check that counts it reports without failing.
 *
 * Will change: the prefix stops being special once the count reaches 0, at
 * which point the reporting check should be deleted rather than inverted.
 */
export const DEPRECATED_PREFIX = 'wl-'
