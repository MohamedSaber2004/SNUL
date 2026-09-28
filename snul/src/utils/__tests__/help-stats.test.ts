import { describe, it, expect } from 'vitest'
import { toHeroTelemetry, HELP_SLA_STAT_KEY } from '../help-stats'
import type { HelpSiteStatDto } from '../../domain/models/content'

/** Build a stat with the four contract fields, so each test states only what it varies. */
function stat(over: Partial<HelpSiteStatDto> = {}): HelpSiteStatDto {
  return {
    id: 'id-1',
    statKey: 'lotTraceable',
    value: '100%',
    label: 'LOT TRACEABLE',
    sortOrder: 0,
    isVisible: true,
    ...over,
  }
}

describe('toHeroTelemetry', () => {
  it('publishes nothing at all when the table is unseeded', () => {
    // The table ships empty on purpose. No placeholders, no zeroed metrics.
    expect(toHeroTelemetry([], 'en')).toEqual({ badge: null, metrics: [] })
  })

  it('publishes nothing when the list is missing or not an array', () => {
    expect(toHeroTelemetry(undefined, 'en')).toEqual({ badge: null, metrics: [] })
    expect(toHeroTelemetry(null, 'en')).toEqual({ badge: null, metrics: [] })
    expect(toHeroTelemetry({ data: [] } as unknown as HelpSiteStatDto[], 'en')).toEqual({
      badge: null,
      metrics: [],
    })
  })

  it('splits the list into the badge and the metrics', () => {
    const result = toHeroTelemetry(
      [
        stat({ id: 'a', statKey: 'lotTraceable', value: '100%', label: 'LOT TRACEABLE' }),
        stat({ id: 'b', statKey: 'slaBadge', value: '< 2h SLA', label: null }),
        stat({ id: 'c', statKey: 'isoStandard', value: 'ISO 13485', label: 'AUDITED PROTOCOL' }),
        stat({ id: 'd', statKey: 'resolutionRate', value: '99.4%', label: 'RESOLUTION RATE' }),
      ],
      'en',
    )

    expect(result.badge).toBe('< 2h SLA')
    expect(result.metrics.map((m) => m.value)).toEqual(['100%', 'ISO 13485', '99.4%'])
  })

  it('classifies the badge by statKey, not by an empty label', () => {
    // A metric whose caption was left blank by an admin stays a metric: the
    // badge is absolutely positioned over the hero image, so keying off label
    // emptiness would teleport a value up there.
    const result = toHeroTelemetry(
      [
        stat({ id: 'a', statKey: 'resolutionRate', value: '99.4%', label: null }),
        stat({ id: 'b', statKey: HELP_SLA_STAT_KEY, value: '< 2h SLA', label: 'ignored caption' }),
      ],
      'en',
    )

    expect(result.badge).toBe('< 2h SLA')
    expect(result.metrics).toEqual([{ key: 'resolutionRate', value: '99.4%', label: '' }])
  })

  it('never uses the badge label as a metric caption', () => {
    const result = toHeroTelemetry(
      [stat({ statKey: HELP_SLA_STAT_KEY, value: '< 2h SLA', label: 'response time' })],
      'en',
    )
    expect(result.metrics).toEqual([])
  })

  it('renders in the order the API returned, without re-sorting or truncating', () => {
    const result = toHeroTelemetry(
      [
        stat({ id: 'a', statKey: 'resolutionRate', value: 'third', sortOrder: 3 }),
        stat({ id: 'b', statKey: 'isoStandard', value: 'first', sortOrder: 1 }),
        stat({ id: 'c', statKey: 'lotTraceable', value: 'second', sortOrder: 2 }),
        stat({ id: 'd', statKey: 'extra', value: 'fourth', sortOrder: 4 }),
        stat({ id: 'e', statKey: 'extraTwo', value: 'fifth', sortOrder: 5 }),
      ],
      'en',
    )

    expect(result.metrics.map((m) => m.value)).toEqual(['third', 'first', 'second', 'fourth', 'fifth'])
  })

  it('treats a stat key it has never seen as an ordinary metric', () => {
    const result = toHeroTelemetry([stat({ statKey: 'onTimeDelivery', value: '98%', label: 'ON TIME' })], 'en')
    expect(result.badge).toBeNull()
    expect(result.metrics).toEqual([{ key: 'onTimeDelivery', value: '98%', label: 'ON TIME' }])
  })

  it('drops a stat with no value, because there is no claim left to show', () => {
    const result = toHeroTelemetry(
      [
        stat({ id: 'a', statKey: 'lotTraceable', value: '100%', label: 'LOT TRACEABLE' }),
        stat({ id: 'b', statKey: 'isoStandard', value: '', label: 'AUDITED PROTOCOL' }),
        stat({ id: 'c', statKey: 'resolutionRate', value: '   ', label: 'RESOLUTION RATE' }),
        stat({ id: 'd', statKey: HELP_SLA_STAT_KEY, value: '', label: null }),
      ],
      'en',
    )

    expect(result.badge).toBeNull()
    expect(result.metrics).toEqual([{ key: 'lotTraceable', value: '100%', label: 'LOT TRACEABLE' }])
  })

  it('keeps a value with a blank caption rather than dropping the claim', () => {
    const result = toHeroTelemetry([stat({ value: 'ISO 13485', label: '  ' })], 'en')
    expect(result.metrics).toEqual([{ key: 'lotTraceable', value: 'ISO 13485', label: '' }])
  })

  it('localises the caption in the Arabic locale when labelAr is present', () => {
    const result = toHeroTelemetry([stat({ label: 'LOT TRACEABLE', labelAr: 'تتبع الشحنة' })], 'ar')
    expect(result.metrics[0].label).toBe('تتبع الشحنة')
  })

  it('falls back to the English caption when labelAr is missing or blank', () => {
    expect(toHeroTelemetry([stat({ label: 'LOT TRACEABLE', labelAr: null })], 'ar').metrics[0].label).toBe(
      'LOT TRACEABLE',
    )
    expect(toHeroTelemetry([stat({ label: 'LOT TRACEABLE', labelAr: '   ' })], 'ar').metrics[0].label).toBe(
      'LOT TRACEABLE',
    )
  })

  it('ignores labelAr outside the Arabic locale', () => {
    expect(toHeroTelemetry([stat({ label: 'LOT TRACEABLE', labelAr: 'تتبع الشحنة' })], 'en').metrics[0].label).toBe(
      'LOT TRACEABLE',
    )
  })

  it('does not localise the badge text', () => {
    // The badge is a single chip, not a caption/value pair; Arabic value text
    // is left to the admin who publishes it.
    const result = toHeroTelemetry(
      [stat({ statKey: HELP_SLA_STAT_KEY, value: '< 2h SLA', label: null, labelAr: 'أقل من ساعتين' })],
      'ar',
    )
    expect(result.badge).toBe('< 2h SLA')
  })

  it('skips null entries without collapsing the rest of the list', () => {
    const result = toHeroTelemetry(
      [null, stat({ id: 'a', value: '100%', label: 'LOT TRACEABLE' }), undefined] as unknown as HelpSiteStatDto[],
      'en',
    )
    expect(result.metrics).toEqual([{ key: 'lotTraceable', value: '100%', label: 'LOT TRACEABLE' }])
  })

  it('does not mutate the stats it is given', () => {
    const input = [stat({ id: 'a', label: 'LOT TRACEABLE', labelAr: 'تتبع' }), stat({ id: 'b' })]
    const snapshot = JSON.stringify(input)
    toHeroTelemetry(input, 'ar')
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it('lets the last duplicated badge win, without a metric row or a throw', () => {
    const result = toHeroTelemetry(
      [
        stat({ id: 'a', statKey: HELP_SLA_STAT_KEY, value: 'first' }),
        stat({ id: 'b', statKey: 'lotTraceable', value: '100%', label: 'LOT TRACEABLE' }),
        stat({ id: 'c', statKey: HELP_SLA_STAT_KEY, value: 'second' }),
      ],
      'en',
    )
    expect(result.badge).toBe('second')
    expect(result.metrics).toEqual([{ key: 'lotTraceable', value: '100%', label: 'LOT TRACEABLE' }])
  })

  it('skips a withdrawn claim while keeping one without the flag', () => {
    const result = toHeroTelemetry(
      [
        stat({ id: 'a', statKey: 'lotTraceable', value: '100%', label: 'LOT TRACEABLE', isVisible: false }),
        stat({ id: 'b', statKey: 'isoStandard', value: 'ISO 13485', label: 'AUDITED PROTOCOL', isVisible: undefined }),
        stat({ id: 'c', statKey: HELP_SLA_STAT_KEY, value: '< 2h SLA', isVisible: false }),
      ],
      'en',
    )
    expect(result.badge).toBeNull()
    expect(result.metrics).toEqual([{ key: 'isoStandard', value: 'ISO 13485', label: 'AUDITED PROTOCOL' }])
  })

  it('survives a missing statKey or sortOrder without reordering', () => {
    const rows = [
      stat({ id: 'a', statKey: 'resolutionRate', value: 'third' }),
      { ...stat({ id: 'b', statKey: 'isoStandard', value: 'first' }), sortOrder: undefined },
      { ...stat({ id: 'c', value: 'second' }), statKey: undefined },
    ] as unknown as HelpSiteStatDto[]
    const result = toHeroTelemetry(rows, 'en')
    expect(result.metrics.map((m) => m.value)).toEqual(['third', 'first', 'second'])
  })

  it('returns a fresh empty model every time, so callers cannot poison each other', () => {
    const first = toHeroTelemetry([], 'en')
    first.metrics.push({ key: 'lotTraceable', value: '100%', label: 'LOT TRACEABLE' })
    expect(toHeroTelemetry([], 'en')).toEqual({ badge: null, metrics: [] })
  })
})
