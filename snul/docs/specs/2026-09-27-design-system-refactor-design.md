# SNUL Design System Refactor — Design

**Date:** 2026-09-27
**Status:** Draft for review
**Scope:** `frontend/SNUL/snul` design tokens, stylesheets, and component visual specs
**Supersedes:** nothing. The current palette (Arctic Frost & Deep Navy) is retained and becomes the canonical identity.

---

## 1. Overview

The SNUL frontend already has a sound design foundation: 45 palette primitives defined in
exactly one file, a semantic layer on top, four wired font families, and consistent spacing,
radius, elevation and motion scales. The problem is not the palette. The problem is that
**five different naming conventions** describe the same concepts, and **696 hardcoded hex
colours** bypass the token system entirely.

The result is that the design system is authoritative in name only. No contributor can tell
which token name is correct, so drift accumulates in whichever file they happen to be editing.

This refactor keeps the sapphire brand identity and rebuilds the architecture around it so the
system is enforceable rather than merely documented. It is executed in phases, beginning with a
**pixel-identical** foundation pass, then migrating screens in independently shippable batches.

### Goals

1. One name per concept, and a single obvious way to colour any element.
2. Raw hex confined to a single file, enforced by a build-time rule.
3. A visual language that reads as clinical precision: dense, crisp, data-first.
4. Every colour token dark-ready, so a future dark theme needs no component changes.
5. Each phase independently shippable, verifiable, and revertable.

### Non-goals

1. **No dark mode ships.** The site stays light-only. Tokens become dark-*ready*; no toggle,
   no persistence, no `prefers-color-scheme` behaviour.
2. **The brand palette does not change.** `--color-primary-600: #0C63B8` and the surrounding
   Arctic Frost ramps are retained.
3. **`tailwind.config.js` is not modified.** All 43 of its colour aliases already resolve
   correctly, and Tailwind is not a source of drift here. Leaving it untouched preserves the
   must-not-change hash guarantee at no cost.
4. **No layout or information-architecture changes.** This is a design-system refactor, not an
   information redesign. Route structure, page composition, and API integration are out of scope.
5. **No backend changes.**

---

## 2. Current State — Audit

### 2.1 Inventory

| Metric | Value |
|---|---|
| Custom properties defined | 347 |
| Stylesheets | 7 (`design-tokens`, `tokens`, `base`, `components`, `main`, `globals`, `motion`) |
| Stylesheet lines | 3,914 |
| UI components | 28 |
| Total components | 36 |
| Views | 56 |
| Raw hex occurrences in views/components | 696 across 45 files |
| Test suite | 19 files, 95 tests |

### 2.2 The five naming systems

| System | Location | Size |
|---|---|---|
| `--color-*` primitives | `design-tokens.css` | 45 |
| `--bg-*` / `--fg-*` / `--brand` / `--border` semantics | `design-tokens.css` | ~60 |
| `--wl-*` WELCO compatibility aliases | `tokens.css` | 153 of 207 definitions; 155 usages |
| `--platform-*` ad-hoc | `views/HomeView.vue` | 8 |
| Raw hex literals | 45 view/component files | 696 |

Worst offenders by hex count: `HomeView.vue` (86), `DataState.vue` (64),
`MostSellingProductsView.vue` (63), `AboutAdminView.vue` (45), `HeroAdminView.vue` (45).

### 2.3 Defects to fix

| # | Defect | Evidence | Impact |
|---|---|---|---|
| D1 | `--shadow-sm` and `--shadow-md` self-reference | `tokens.css:71-72` | Invalid at computed-value time, so every consumer renders with **no shadow** |
| D1b | `--shadow-xl` silently remapped to the `lg` value | `tokens.css:73` | The 5-step shadow ramp collapses to 4. Safe to delete: 0 consumers |
| D2 | `.page-btn` defined twice | `base.css:588`, `main.css:381` | Inconsistent rendering depending on cascade order |
| D3 | `.sr-only` defined twice | `components.css:1307`, `globals.css:70` | Same |
| D4 | Stale WELCO storage key still written | `theme.service.ts:15` (`welco-theme`) | Cross-project state bleed |
| D5 | Stale brand comment contradicts the palette | `tailwind.config.js` says "teal/coral brand"; palette is sapphire | Misleads contributors |
| D6 | No rule preventing new raw hex | — | Drift re-accumulates after any cleanup |

### 2.3a D1 is a visual fix, not a neutral cleanup

This correction was added after measuring the actual impact, and it changes the phase plan.

Cascade order is `design-tokens.css` → `tokens.css` → `components.css` → `base.css` → `main.css`
(`main.css` imports `base.css`, which imports `tokens.css`, which imports `design-tokens.css`).
So `tokens.css:71` — the self-referential declaration — is the winning one, and it is invalid at
computed-value time. The consequence is not subtle:

- `var(--shadow-sm)` and `var(--shadow-md)` have **88 direct consumers** in total, and every one
  of them currently renders **no shadow**.
- `var(--shadow-card)` (49) and `var(--shadow-hover)` (19) alias `md`/`lg` and inherit the
  breakage — 68 more.
- A further 43 consumers reach these transitively through `--wl-shadow-*` aliases.

Therefore fixing D1 is a **deliberate, visible change**: **156** declarations that were
silently dead become live elevation (199 including the transitive `--wl-shadow-*` consumers).
It cannot live inside a phase whose gate is "pixel-identical".

Mitigation: `--shadow-xl` has 0 consumers, so deleting the `tokens.css:73` remap is visually
neutral. Only the `sm`/`md` restoration changes rendering, and that change is reviewed against a
visual diff in its own step (Phase 1B) rather than smuggled into the structural pass.

### 2.4 Constraints carried forward

1. `tailwind.config.js` must remain byte-identical (hash guarantee).
2. `main.css` currently sits under the must-not-change hash list. **This must be resolved
   before Phase 1 starts**, because D2 (duplicate `.page-btn`) can only be fixed at source in
   `base.css`, and the `main.css` duplicate is a `:hover` override that has to be reconciled.
   Three options, to be chosen at Phase 1 kickoff:
   - **Relax the guarantee for `main.css`** — preferred. The file is a legitimate layer-3/4
     stylesheet and holding it byte-frozen blocks a real defect fix.
   - **Keep the guarantee** — D2 is then fixed in `base.css` only, and the `main.css` duplicate
     is annotated as superseded dead code. The rendering defect remains, so this option is
     recorded as a known limitation rather than a fix.
   - **Move the rule** — relocate the canonical `.page-btn` rules into `components.css` and
     delete both copies, leaving `main.css` untouched. Preserves the guarantee and fixes the
     defect; the cost is one more stylesheet owning component rules.

   This is the only open decision blocking Phase 1.
3. Dark mode remains disabled. `theme.service.ts` continues to lock the site to light. This
   refactor does not relax that.

---

## 3. Key Design Decisions

### 3.1 Retain the sapphire identity

The Arctic Frost & Deep Navy palette is a real asset: a recognised clinical-manufacturer
character that distinguishes SNUL from generic SaaS. Only the architecture changes. Primitives,
their contrast relationships, and the four-font pairing are all preserved.

### 3.2 Layered token architecture

```
design-tokens.css   Layer 1  primitives   --color-*     the ONLY place a hex may appear
       ↓
tokens.css          Layer 2  semantic     --bg-* --fg-* --border --brand --ring-*
       ↓                              + spacing / type / radius / elevation / motion scales
components.css      Layer 3  component    consumes layer 2 only; primitives are forbidden
       ↓
per-view <style>    Layer 4  layout       scoped; token-driven; no new hex
```

The load order already satisfies this: `main.css` imports `base.css`, which imports
`tokens.css`, which imports `design-tokens.css`.

### 3.3 Enforced rules

These are build-time rules, not documentation:

1. **Hex is legal only in `design-tokens.css`.** A check fails the build on any hex literal in
   layers 2–4.
2. **No component may reference `--color-*`.** Primitives are not a valid dependency; only
   semantic tokens are. This is what keeps the system dark-ready.
3. **Every semantic token is an alias, not a literal**, so overriding the layer-1 primitive
   re-themes the whole system.
4. **One name per concept.** `--wl-*` is deprecated, counted, and must reach zero usages before
   the alias block is deleted.

### 3.4 Why aliases are drained rather than deleted immediately

An undefined custom property fails **silently**: `color: var(--typo)` does not error, it
inherits. So a mass rename of 155 usages in a single commit risks invisible, wide-spread
regressions with no compiler signal.

Draining instead keeps every alias rendering correctly until its call sites are converted and
verified in a batch. This is why the approach is chosen over a single-shot rename, despite the
larger number of commits.

### 3.5 Visual language: clinical precision, dense and data-first

The product is a B2B medical-procurement platform whose core surfaces are comparison tables,
RFQ negotiation tables, and quote forms. Density and numeric legibility outrank decoration.

| Aspect | Decision |
|---|---|
| Density | 4px spacing scale retained; control heights normalised to 32px (default) and 40px (large). Current sprawl is 9 distinct values: 20/24/32/34/36/40/44/46/48px |
| Radii | Four steps retained — `--radius-xs` 6px, `--radius-sm` 8px, `--radius-md` 12px, `--radius-lg` 16px — plus `--radius-pill`. `--radius-xl` (20px, 8 consumers) and `--radius-2xl` (24px, 0 consumers) are retired |
| Elevation | Hairline borders carry structure; shadow is reserved for overlays (modals, popovers, toasts) |
| Numerals | Tabular figures on all numeric columns, right-aligned |
| Focus | Visible `--ring-focus` on every interactive element, ≥3:1 against adjacent colour |
| Type | Pinned to existing `--text-*` tokens; no ad-hoc sizes |
| Motion | Existing `motion.css`; `prefers-reduced-motion` remains a hard safety net |

Radius is a case where the tokens are sound but bypassed. Across views and components there are
**1,017 `border-radius` declarations: 538 (53%) reference a token, 331 (33%) are raw pixel
literals spanning 13 distinct values** (3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 999, 9999px).
Migrating those 331 literals to the four retained steps is part of the per-batch work, not a
token change.

Retiring `--radius-xl` is also a visual change: 20px becomes 16px at its 8 consumers, so it
belongs in the Phase 1B visual-diff review. Retiring `--radius-2xl` has 0 consumers and is
pixel-neutral.

---

## 4. Rollout Phases

### Phase 0 — Baseline

Screenshot a fixed set of key screens in both locales and record the 12 must-not-change
hashes. This is the comparison baseline for every later phase.

### Phase 1A — Structural foundation (pixel-neutral)

| Work | Detail |
|---|---|
| Fix D2, D3 | Remove duplicate `.page-btn` / `.sr-only` definitions per the §2.4 item 2 decision |
| Fix D4 | Remove the `welco-theme` legacy storage key write |
| Fix D5 | Correct the stale "teal/coral" comment |
| Fix D6 | Add the hex-location lint rule, scoped to run in report-only mode first |
| Unify | Promote canonical semantic names; mark `--wl-*` deprecated with a counted usage metric |
| Formalise | Document the spacing / type / radius / elevation scales in one place |

**Gate:** `vue-tsc` clean, 95 tests pass, `npm run build` succeeds, the 11 hash-guaranteed
files are unchanged, and **every baseline screenshot is pixel-identical.**

`main.css` is excluded from that count only if the §2.4 item 2 decision relaxed its guarantee;
if the guarantee was kept, all 12 must be unchanged. Either way the pixel-identical screenshot
comparison is the authoritative check — the hashes are a safety net, not the gate.

Any visual difference means Phase 1A is wrong and must be corrected before continuing.

### Phase 1B — Shadow restoration (deliberate visual change)

Fix D1 and D1b by deleting `tokens.css:71-73`. This is separated from 1A because it is not
visually neutral: it activates **156** previously-dead shadow declarations (88 direct
`var(--shadow-sm|md)` plus the 68 consumers of the `--shadow-card` / `--shadow-hover`
aliases; 199 if the 43 transitive `--wl-shadow-*` consumers are included).

**Gate:** typecheck, tests, build, and a **reviewed visual diff** of the affected screens. The
expected result is added elevation on cards, menus and popovers — a deliberate correction, not
a regression. If a diff shows something other than added shadow, that is a genuine regression
and must be investigated before continuing.

### Phase 2+ — Screen migration batches

One user journey per batch, ordered by traffic:

1. Public journey — home, categories, marketplace, product detail, provider storefront
2. Buyer flows — RFQ list/detail, cart, checkout, quote detail
3. Auth — login, register, verification, password reset
4. Provider console — dashboard, products, RFQs, quotes
5. Admin — users, companies, categories, content, hero, sales, settings

Per batch: convert that journey's raw hex to semantic tokens, align components to the density
and radius specs, and adopt the state coverage matrix in §5.

**Gate per batch:** typecheck, tests, build, hash-guaranteed files unchanged, and a visual
review of every screen in the batch against §3.5.

### Final phase — Drain the alias layer

Delete the `--wl-*` block once the usage counter reaches zero. Gate: counter = 0, and the full
suite green.

---

## 5. State Coverage

The RFQ, quote and admin tables are where missing states hurt most, so each migrated screen
must handle all of:

| State | Requirement |
|---|---|
| First run, no data | Explain what will appear and how to create it; never a bare blank area |
| Loading | Skeleton matching final layout, so nothing reflows on arrival |
| Failure | Name the failure and offer a retry; never swallow the error |
| No permission | Explain the requirement, do not show an empty table implying no data |
| Slow network | Keep navigation responsive; do not block the shell on one request |
| Partial | Distinguish "none exist" from "none loaded yet" |

---

## 6. Accessibility Requirements

1. Body text ≥ 4.5:1 against its background; large text and UI boundaries ≥ 3:1.
2. Contrast is verified **per semantic token pair**, not per component, because components
   reference tokens rather than literals. This is only possible once §3.3 rule 2 holds.
3. Every interactive element has a visible focus indicator.
4. Tabular numerals in data tables, with right alignment.
5. `prefers-reduced-motion` neutralises entrance, stagger and hover motion (already
   implemented in `motion.css`; extended to any new motion added during migration).

---

## 7. Testing Strategy

1. **Existing suite is the regression floor** — 19 files, 95 tests, must stay green throughout.
2. **New guard tests in Phase 1:**
   - **No raw hex outside `design-tokens.css`.** Scans `src/assets/*.css` plus every
     `.vue` scoped style, so it covers files outside the test graph. Lands in report-only mode
     first (§4 Phase 1) and becomes a build failure once the count reaches zero.
   - **No component references a `--color-*` primitive.** Enforces §3.3 rule 2, which is what
     keeps the system dark-ready.
   - **No self-referential custom property**, verified by a script over `src/assets/*.css`
     rather than only by a unit test.
   - **`--wl-*` usage counter is monotonically non-increasing**, asserted per batch.
   - **Hash check** for the files under the must-not-change guarantee.
3. **Visual regression** via baseline screenshot comparison per batch (§Phase 0).
4. **Contrast assertions** on the semantic token pairs, as data.

---

## 8. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Phase 1 silently changes rendering | Pixel-identical screenshot gate; any diff blocks the phase |
| 696 hex migrations introduce subtle contrast regressions | Contrast is asserted per token pair, so a bad mapping fails in CI not in review |
| `--wl-*` layer never reaches zero and becomes permanent debris | Usage counter is a tracked, asserted metric with a deletion gate |
| Batch migration stalls partway | Each batch is independently shippable; partial completion still improves the system |
| Dark mode pressure returns mid-refactor | §3.3 rule 2 makes it cheap: one `:root[data-theme="dark"]` block, no component changes |
| Scope creep into layout redesign | §1 non-goals are explicit; layout changes require a separate spec |

---

## 9. Design Rationale

**Why keep the palette.** Sapphire-on-arctic-slate reads as a medical manufacturer, which is
what SNUL sells. A neutral-grey "modern SaaS" palette would make the product indistinguishable
from any other marketplace and would discard accumulated brand equity. The palette was never
the problem.

**Why layered tokens with a single hex home.** Drift happens when a contributor cannot tell
which of several valid-looking names is canonical. Forbidding hex outside one file, and
forbidding components from touching primitives, removes the ambiguity that produced 696
literals in the first place.

**Why drain rather than rename.** Because an undefined custom property inherits silently, a
155-site rename carries invisible-regression risk with no compiler feedback. Draining trades
commit count for correctness.

**Why dense and data-first.** The core workflows are tabular and numeric — comparing suppliers,
negotiating multi-currency quotes, auditing RFQs. Airy, decorative design costs visible rows
per screen and hurts the one thing users actually came to do.

**Why enforce rather than document.** A rule in a README is bypassed on the first deadline.
A rule that fails the build is not.
