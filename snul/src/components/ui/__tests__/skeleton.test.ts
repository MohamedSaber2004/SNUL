import { describe, it, expect } from 'vitest'
import { defaultSkeletonCount, type SkeletonType } from '../skeleton'

const ALL_TYPES: SkeletonType[] = [
  'text',
  'card',
  'circle',
  'table-row',
  'custom',
  'product-card',
  'catalog-grid',
  'category-grid',
  'stats-grid',
  'table',
  'pdp',
  'list',
  'form',
  'location-grid',
  'hero',
  'pills',
  'provider-grid',
  'provider-cards',
  'store-hero',
  'store-rows',
  'ticket',
  'track',
  'cert-grid',
  'address-grid',
  'order-detail',
  'order-confirm',
  'help-grid',
  'profile',
  'about',
]

describe('defaultSkeletonCount', () => {
  it('defines a numeric default for every union member', () => {
    for (const t of ALL_TYPES) {
      expect(typeof defaultSkeletonCount(t)).toBe('number')
    }
  })

  it('matches the 11 DataState direct defaults exactly', () => {
    expect(defaultSkeletonCount('product-card')).toBe(4)
    expect(defaultSkeletonCount('catalog-grid')).toBe(4)
    expect(defaultSkeletonCount('category-grid')).toBe(8)
    expect(defaultSkeletonCount('stats-grid')).toBe(4)
    expect(defaultSkeletonCount('location-grid')).toBe(3)
    expect(defaultSkeletonCount('pills')).toBe(6)
    expect(defaultSkeletonCount('provider-grid')).toBe(4)
    expect(defaultSkeletonCount('provider-cards')).toBe(4)
    expect(defaultSkeletonCount('cert-grid')).toBe(4)
    expect(defaultSkeletonCount('help-grid')).toBe(6)
    expect(defaultSkeletonCount('address-grid')).toBe(4)
  })

  it('returns 6 for the four types used without explicit count', () => {
    expect(defaultSkeletonCount('about')).toBe(6)
    expect(defaultSkeletonCount('order-confirm')).toBe(6)
    expect(defaultSkeletonCount('order-detail')).toBe(6)
    expect(defaultSkeletonCount('profile')).toBe(6)
  })

  it('is pure (same input twice gives same output)', () => {
    for (const t of ALL_TYPES) {
      const first = defaultSkeletonCount(t)
      const second = defaultSkeletonCount(t)
      expect(second).toBe(first)
    }
  })

  // These two types diverged before unification: DataState defaulted both to 4
  // while SkeletonLoader defaulted both to 6. The shared module pins DataState's
  // values; no current call site renders these without an explicit count, so this
  // is visually neutral.
  it('pins the two formerly-divergent types to DataState values', () => {
    expect(defaultSkeletonCount('catalog-grid')).toBe(4)
    expect(defaultSkeletonCount('provider-cards')).toBe(4)
  })
})
