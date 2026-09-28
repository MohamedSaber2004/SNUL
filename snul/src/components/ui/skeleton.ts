export type SkeletonType =
  | 'text'
  | 'card'
  | 'circle'
  | 'table-row'
  | 'custom'
  | 'product-card'
  | 'catalog-grid'
  | 'category-grid'
  | 'stats-grid'
  | 'table'
  | 'pdp'
  | 'list'
  | 'form'
  | 'location-grid'
  | 'hero'
  | 'pills'
  | 'provider-grid'
  | 'provider-cards'
  | 'store-hero'
  | 'store-rows'
  | 'ticket'
  | 'track'
  | 'cert-grid'
  | 'address-grid'
  | 'order-detail'
  | 'order-confirm'
  | 'help-grid'
  | 'profile'
  | 'about'

const SKELETON_DEFAULTS: Record<SkeletonType, number> = {
  // Matches current DataState direct defaults (11 branched types in DataState gridCount).
  'product-card': 4,
  'catalog-grid': 4,
  'category-grid': 8,
  'stats-grid': 4,
  'location-grid': 3,
  'pills': 6,
  'provider-grid': 4,
  'provider-cards': 4,
  'cert-grid': 4,
  'help-grid': 6,
  'address-grid': 4,
  // Preserves SkeletonLoader effective default of 6 for these six call sites (no explicit :count today).
  'about': 6,
  'order-confirm': 6,
  'order-detail': 6,
  'profile': 6,
  // Preserves DataState fallthrough (?? 1) for every other type.
  'text': 1,
  'card': 1,
  'circle': 1,
  'table-row': 1,
  'custom': 1,
  'table': 1,
  'pdp': 1,
  'list': 1,
  'form': 1,
  'hero': 1,
  'store-hero': 1,
  'store-rows': 1,
  'ticket': 1,
  'track': 1,
}

export function defaultSkeletonCount(type: SkeletonType): number {
  return SKELETON_DEFAULTS[type]
}
