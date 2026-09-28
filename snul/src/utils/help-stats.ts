/* Hero telemetry: API rows -> what the Help Center hero paints.
 *
 * The hero used to hardcode four business claims. They are now rows in
 * `help/site-stats`, and the table that holds them ships unseeded, so the
 * common case on a fresh database is an empty list. That case is expressed
 * here as an explicit empty render model: no placeholder figure, no default
 * claim, nothing for the template to fall back on. The split between the badge
 * and the metrics is the whole point of the mapping, so it lives in a pure
 * function that can be tested without mounting the view.
 */

import type { HelpSiteStatDto } from '../domain/models/content'
import { localizedText } from './help-localize'

/**
 * The one `statKey` that changes where a value is painted. It is the only key
 * the frontend gives meaning to: it is a chip over the hero image rather than a
 * figure in the telemetry row.
 */
export const HELP_SLA_STAT_KEY = 'slaBadge'

/** One figure in the telemetry row. `label` is `''` when no caption is published. */
export interface HeroTelemetryMetric {
  key: string
  value: string
  label: string
}

export interface HeroTelemetry {
  /** Badge text, or `null` when no badge is published. */
  badge: string | null
  metrics: HeroTelemetryMetric[]
}

/** Fresh empty render model per call, so no caller can poison a shared instance. */
const empty = (): HeroTelemetry => ({ badge: null, metrics: [] })

/**
 * Map published stats onto the hero's render model.
 *
 * - Rows are kept in the order the API returned them, which is `SortOrder`. The
 *   count is whatever the admin published; nothing is truncated or re-sorted.
 * - `statKey` decides the slot, not the presence of a caption. A metric whose
 *   label was left blank keeps its slot and renders its value alone, because
 *   the badge is positioned over the image and a blank-caption metric landing
 *   there would be a layout accident. Dropping the row instead would silently
 *   withdraw a claim the admin published.
 * - A row with no value has no claim left to make, so it is skipped entirely -
 *   which is also how a withdrawn badge disappears.
 * - A row with `isVisible: false` is skipped: the endpoint is documented as
 *   visible-only, so such a row is a leak, not a claim.
 * - A caption is trimmed, so the template's emptiness test is a real test.
 */
export function toHeroTelemetry(
  stats: HelpSiteStatDto[] | null | undefined,
  locale: string | undefined,
): HeroTelemetry {
  if (!Array.isArray(stats) || stats.length === 0) return empty()

  const metrics: HeroTelemetryMetric[] = []
  let badge: string | null = null

  for (const stat of stats) {
    if (!stat) continue
    // A withdrawn claim (`isVisible: false`) must never paint, even if the
    // endpoint leaks it or a stale cache serves it. `undefined` (older rows
    // without the flag) still renders.
    if (stat.isVisible === false) continue
    const value = typeof stat.value === 'string' ? stat.value.trim() : ''
    if (!value) continue

    if (stat.statKey === HELP_SLA_STAT_KEY) {
      // Last one wins, so a duplicated key cannot leave two badges in the DOM.
      badge = value
      continue
    }

    metrics.push({
      key: stat.statKey,
      value,
      label: caption(locale, stat.label, stat.labelAr),
    })
  }

  if (badge === null && metrics.length === 0) return empty()
  return { badge, metrics }
}

/**
 * Localised caption, normalised so a whitespace-only label is indistinguishable
 * from a missing one.
 *
 * `localizedText` deliberately preserves whatever it is given - trimming is its
 * caller's business - and the template tests the caption for emptiness to decide
 * whether to paint a caption element at all. Without this, a label of `'  '`
 * would pass that test and leave an empty `<span>` behind it.
 */
function caption(locale: string | undefined, en?: string | null, ar?: string | null): string {
  return localizedText(locale, en, ar).trim()
}
