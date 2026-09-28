import type { CompanyDto } from './company'

export interface CategoryDto {
  id: string
  slug?: string
  nameEn: string
  nameAr: string
  descriptionEn?: string
  descriptionAr?: string
  /** stored attachment name (place=1) resolved via `/files/{name}` �?" see ATTACHMENT-INTEGRATION.md */
  imageName?: string | null
  icon?: string
  productCount?: number
  parentCategoryId?: string | null
  isActive?: boolean
}

/**
 * Server-side paging for the "Browse by Category" grid, which hits the
 * paginated `GET /categories` route.
 *
 * This is deliberately distinct from `getCategories()`, which hits the
 * unpaginated `GET /categories/all` route. The clinical-specialty filter needs
 * every category so it can match client-side; the grid only needs one page.
 * Keeping them on separate methods stops one section's paging from silently
 * truncating the other's filter options.
 */
export interface CategoryQuery {
  pageNumber?: number
  pageSize?: number
  searchTerm?: string
  isActive?: boolean
}

/** One provider offering a SKU, with that provider's listing. */
export interface SkuProviderDto {
  company: CompanyDto | null
  listing: ProductDto
}

export interface CurrencyDto {
  id: string
  nameEn: string
  nameAr: string
  code: string
  symbol: string
  symbolNative?: string
  decimalDigits?: number
  isActive: boolean
}


export interface CreateProductPayload {
  nameEn: string
  nameAr: string
  sku: string
  slug: string
  description?: string
  price: number
  stock: number
  specifications?: string
  imageName?: string | null
  material?: string
  lengthCm?: number
  currencyId?: string | null
  categoryId: string
}

export interface UpdateProductPayload {
  nameEn: string
  nameAr: string
  sku: string
  slug: string
  description?: string
  price: number
  stock: number
  specifications?: string
  imageName?: string | null
  material?: string
  lengthCm?: number
  currencyId?: string | null
  categoryId: string
  isActive?: boolean
}

export interface CreateCategoryPayload {
  nameEn: string
  nameAr: string
  description?: string
  imageName?: string | null
  parentCategoryId?: string | null
}

export interface UpdateCategoryPayload {
  nameEn: string
  nameAr: string
  description?: string
  imageName?: string | null
  parentCategoryId?: string | null
  isActive?: boolean
}

export interface ProductDto {
  id: string
  sku: string
  slug?: string
  nameEn: string
  nameAr: string
  description?: string
  descriptionEn: string
  descriptionAr: string
  categoryId: string
  categoryNameEn: string
  categoryNameAr: string
  supplierId: string
  supplierNameEn: string
  supplierNameAr: string
  /** Owning provider company (mediator model; null = legacy/global item). */
  companyId?: string | null
  companyName?: string | null
  manufacturerEn: string
  manufacturerAr: string
  price: number
  currency: string
  currencyId?: string | null
  currencyCode?: string
  currencySymbol?: string
  originalPrice?: number
  stock: number
  unit: string
  unitAr: string
  minOrderQty: number
  /** stored attachment name (place=1) resolved via `/files/{name}` — see ATTACHMENT-INTEGRATION.md */
  imageName?: string | null
  imageGradient: string
  material?: string
  lengthCm?: number
  specifications?: string
  isActive: boolean
  isFeatured?: boolean
  isNew?: boolean
  rating: number
  reviewCount: number
  createdAt: string
  videos?: ProductMediaDto[]
}

export interface ProductMediaDto {
  id?: string
  productId: string
  type: number // 1=Image, 2=Video, 3=Document
  url: string
  title?: string
  duration?: string
  sortOrder: number
}

export interface CartItem {
  product: ProductDto
  quantity: number
}

export interface QuoteRequestDto {
  id: string
  items: CartItem[]
  total: number
  currency: string
  status: 'pending' | 'quoted' | 'ordered'
  createdAt: string
  deliveryZone?: string
  note?: string
}

export function localizedName(item: { nameEn: string; nameAr: string }, locale: string): string {
  return locale === 'ar' ? item.nameAr : item.nameEn
}

// Currency CRUD removed: currencies are seeded ISO data, rates are dynamic (see prompt.txt dynamic currency system)
// Product creation still references currencyId (selected from seeded list via getCurrencies)

