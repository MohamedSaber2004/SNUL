import { MARKETPLACE_ROUTES } from '../../config/api.config'
import type { MarketplaceRepository, MarketplaceQuery } from '../../domain/ports/marketplace-repository'
import type { PaginatedResult } from '../../domain/models/location'
import type {
  CategoryDto,
  ProductDto,
  ProductMediaDto,
  CurrencyDto,
  CreateProductPayload,
  UpdateProductPayload,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  CategoryQuery,
  SkuProviderDto,
} from '../../domain/models/marketplace'
import type { CompanyDto } from '../../domain/models/company'
import type { HttpClient } from '../../infrastructure/http/http-client'
import { ApiError } from '../../infrastructure/http/api-error'

function toPaginated<T>(raw: unknown): PaginatedResult<T> | null {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if ('data' in obj || 'Data' in obj) {
      const rawData = obj.data ?? obj.Data
      const data = Array.isArray(rawData) ? (rawData as T[]) : []
      return {
        isSuccess: (obj.isSuccess ?? obj.IsSuccess ?? true) as boolean,
        data,
        totalCount: (obj.totalCount ?? obj.TotalCount ?? data.length) as number,
        pageNumber: (obj.pageNumber ?? obj.PageNumber ?? 1) as number,
        pageSize: (obj.pageSize ?? obj.PageSize ?? (data.length || 10)) as number,
        totalPages: (obj.totalPages ?? obj.TotalPages ?? 1) as number,
        hasPreviousPage: (obj.hasPreviousPage ?? obj.HasPreviousPage ?? false) as boolean,
        hasNextPage: (obj.hasNextPage ?? obj.HasNextPage ?? false) as boolean,
        message: (obj.message ?? obj.Message ?? 'OK') as string,
        statusCode: (obj.statusCode ?? obj.StatusCode ?? 200) as number,
      }
    }
  }
  return null
}

const normalizeProduct = (p: ProductDto): ProductDto => {
  if (!p || typeof p !== 'object') return p
  const raw = p as unknown as Record<string, unknown>

  // Currency fallbacks
  if (!p.currency && p.currencyCode) p.currency = p.currencyCode
  if (!p.currencySymbol && p.currencyCode) {
    p.currencySymbol = p.currencyCode === 'USD' ? '$' : p.currencyCode === 'EUR' ? '€' : p.currencyCode === 'AED' ? 'AED' : p.currencyCode
  } else if (!p.currencySymbol) {
    p.currencySymbol = p.currency || '$'
  }

  // Units and stock defaults
  if (!p.unit) p.unit = 'pcs'
  if (!p.unitAr) p.unitAr = 'قطعة'
  if (!p.minOrderQty) p.minOrderQty = 1
  p.price = typeof p.price === 'number' ? p.price : Number(raw.price ?? raw.Price ?? 0) || 0
  p.stock = typeof p.stock === 'number' ? p.stock : Number(raw.stock ?? raw.Stock ?? 0) || 0
  if (typeof p.isActive !== 'boolean') p.isActive = true
  if (typeof p.rating !== 'number') p.rating = 0
  if (typeof p.reviewCount !== 'number') p.reviewCount = 0

  // Handle names
  const rawName = (raw.name ?? raw.Name) as string | undefined
  if (!p.nameEn && rawName) p.nameEn = rawName
  if (!p.nameAr && rawName) p.nameAr = rawName
  if (!p.nameEn && p.nameAr) p.nameEn = p.nameAr
  if (!p.nameAr && p.nameEn) p.nameAr = p.nameEn

  // Handle description: backend returns `description`
  const rawDesc = (raw.description ?? raw.Description ?? '') as string
  if (!p.descriptionEn && rawDesc) p.descriptionEn = rawDesc
  if (!p.descriptionAr && rawDesc) p.descriptionAr = rawDesc
  if (!p.description && (p.descriptionEn || p.descriptionAr || rawDesc)) {
    p.description = p.descriptionEn || p.descriptionAr || rawDesc
  }

  // Handle images: support imageName, imageUrl, image, imagePath, fileUrl, photo
  if (!p.imageName) {
    p.imageName = (raw.imageName ?? raw.ImageName ?? raw.imageUrl ?? raw.ImageUrl ?? raw.image ?? raw.Image ?? raw.fileUrl ?? raw.FileUrl ?? raw.photo ?? null) as string | null
  }

  // Gradient seeds
  if (typeof p.imageGradient !== 'string' && typeof p.imageName === 'string' && p.imageName) {
    const seeds = [`${p.id}${p.nameEn}`.split('').reduce((a, c) => a + c.charCodeAt(0), 0)]
    const gradients = [
      'linear-gradient(160deg,#122C3E,#0B1D2A)',
      'linear-gradient(160deg,#0E7169,#0B1D2A)',
      'linear-gradient(160deg,#7C4A1D,#3B2A18)',
      'linear-gradient(160deg,#5C7686,#2A3A44)',
      'linear-gradient(160deg,#A63A2E,#4A1B15)',
    ]
    p.imageGradient = gradients[(seeds[0] ?? 0) % gradients.length] || gradients[0] || ''
  } else if (!p.imageGradient) {
    p.imageGradient = 'linear-gradient(160deg,#122C3E,#0B1D2A)'
  }
  return p
}

const normalizeCategory = (c: CategoryDto): CategoryDto => {
  if (!c || typeof c !== 'object') return c
  const raw = c as unknown as Record<string, unknown>
  // Backend returns a single `Description`; frontend renders descriptionEn/Ar
  const description =
    (raw.description as string | undefined) ??
    (raw.Description as string | undefined) ??
    c.descriptionEn ??
    c.descriptionAr ??
    ''
  if (!c.descriptionEn && description) c.descriptionEn = description
  if (!c.descriptionAr && description) c.descriptionAr = description
  const parentId =
    (c.parentCategoryId as string | null | undefined) ??
    (raw.parentCategoryId as string | null | undefined) ??
    (raw.ParentCategoryId as string | null | undefined) ??
    null
  c.parentCategoryId = parentId
  if (typeof c.isActive !== 'boolean') {
    const rawActive = (raw.isActive ?? raw.IsActive) as boolean | undefined
    c.isActive = typeof rawActive === 'boolean' ? rawActive : true
  }
  if (typeof c.productCount !== 'number') {
    const rawCount = Number(raw.productCount ?? raw.ProductCount ?? 0)
    c.productCount = Number.isFinite(rawCount) ? rawCount : 0
  }
  return c
}

export class ApiMarketplaceRepository implements MarketplaceRepository {
  constructor(private readonly http: HttpClient) {}

  async getProducts(query: MarketplaceQuery = {}): Promise<PaginatedResult<ProductDto>> {
    const params = new URLSearchParams()
    if (query.search) params.set('SearchTerm', query.search)
    if (query.sku) params.set('Sku', query.sku)
    if (query.categoryId) params.set('categoryId', query.categoryId)
    if (query.sortBy === 'price-asc') params.set('sortBy', 'price-asc')
    if (query.sortBy === 'price-desc') params.set('sortBy', 'price-desc')
    if (query.sortBy === 'newest') params.set('sortBy', 'newest')
    if (query.inStockOnly) params.set('inStockOnly', 'true')
    if (query.material) params.set('material', query.material)
    if (query.lengthMin != null) params.set('lengthMin', String(query.lengthMin))
    if (query.lengthMax != null) params.set('lengthMax', String(query.lengthMax))
    if (query.priceMin != null) params.set('priceMin', String(query.priceMin))
    if (query.priceMax != null) params.set('priceMax', String(query.priceMax))
    if (query.currencyId) params.set('currencyId', query.currencyId)
    params.set('pageNumber', String(query.page ?? 1))
    params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize ?? 12))))
    const qs = params.toString()
    const path = `${MARKETPLACE_ROUTES.products}?${qs}`
    const raw = await this.http.get<unknown>(path, { showFeedback: false })
    if (Array.isArray(raw)) {
      const page = query.page ?? 1
      const pageSize = query.pageSize ?? 10
      const totalCount = raw.length
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
      const data = (raw.slice((page - 1) * pageSize, page * pageSize) as ProductDto[]).map(normalizeProduct)
      return {
        isSuccess: true,
        data,
        totalCount,
        pageNumber: page,
        pageSize,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
        message: 'OK',
        statusCode: 200,
      }
    }
    const paginated = toPaginated<ProductDto>(raw)
    if (paginated) {
      paginated.data = (paginated.data || []).map(normalizeProduct)
      return paginated
    }
    return {
      isSuccess: true,
      data: [],
      totalCount: 0,
      pageNumber: query.page ?? 1,
      pageSize: query.pageSize ?? 12,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
      message: 'OK',
      statusCode: 200,
    }
  }

  async getMyProducts(companyId: string, query: MarketplaceQuery = {}): Promise<PaginatedResult<ProductDto>> {
    // The owning company is resolved server-side from the caller's claims, so
    // there is nothing to filter here and no owner-id guess to get wrong.
    const params = new URLSearchParams()
    if (query.search) params.set('SearchTerm', query.search)
    if (query.sku) params.set('Sku', query.sku)
    if (query.categoryId) params.set('categoryId', query.categoryId)
    params.set('pageNumber', String(query.page ?? 1))
    params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize ?? 12))))
    const raw = await this.http.get<unknown>(`${MARKETPLACE_ROUTES.myProducts}?${params.toString()}`, { showFeedback: false })
    if (Array.isArray(raw)) {
      const items = (raw as ProductDto[]).map(normalizeProduct)
      const page = query.page ?? 1
      const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 12))
      const totalCount = items.length
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
      return {
        isSuccess: true,
        data: items.slice((page - 1) * pageSize, page * pageSize),
        totalCount,
        pageNumber: page,
        pageSize,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
        message: 'OK',
        statusCode: 200,
      }
    }
    const paged = raw as PaginatedResult<ProductDto> | null
    if (paged && Array.isArray(paged.data)) {
      return { ...paged, data: paged.data.map(normalizeProduct) }
    }
    return {
      isSuccess: true,
      data: [],
      totalCount: 0,
      pageNumber: query.page ?? 1,
      pageSize: query.pageSize ?? 12,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
      message: 'OK',
      statusCode: 200,
    }
  }

  async getProductById(id: string): Promise<ProductDto | null> {
    try {
      const data = await this.http.get<ProductDto>(MARKETPLACE_ROUTES.productById(id), { showFeedback: false })
      if (data && typeof data === 'object') {
        const raw = data as unknown as Record<string, unknown>
        const candidate = (raw.data ?? raw.Data ?? data) as ProductDto
        if (candidate && candidate.id) {
          return normalizeProduct(candidate)
        }
      }
    } catch {
      // No data-derivation fallback: a failed GET stays a failure. Resolving the
      // id through a search would silently substitute a different product.
      return null
    }
    // Reached when the response carried no usable product.
    return null
  }


  async getProductVideos(productId: string): Promise<ProductMediaDto[]> {
    const data = await this.http.get<ProductMediaDto[] | { data: ProductMediaDto[] }>(
      `${MARKETPLACE_ROUTES.productById(productId)}/videos`,
      { showFeedback: false },
    )
    if (Array.isArray(data)) return data as ProductMediaDto[]
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>
      if (Array.isArray(obj.data)) return obj.data as ProductMediaDto[]
      if (Array.isArray(obj.Data)) return obj.Data as ProductMediaDto[]
    }
    return []
  }

  async updateProductVideos(productId: string, videos: ProductMediaDto[]): Promise<ProductMediaDto[]> {
    await this.http.put(
      `${MARKETPLACE_ROUTES.productById(productId)}/videos`,
      { videos },
      { showFeedback: false },
    )
    return videos
  }

  /**
   * Server-paginated category list (`GET /categories`).
   *
   * Used by the "Browse by Category" grid. Intentionally NOT interchangeable
   * with `getCategories()` below, which returns every category from
   * `GET /categories/all` for the clinical-specialty filter — the two landing
   * sections must not share a source, or paging one truncates the other.
   */
  async getCategoriesPaginated(query: CategoryQuery = {}): Promise<PaginatedResult<CategoryDto>> {
    const pageNumber = query.pageNumber ?? 1
    const pageSize = query.pageSize ?? 10
    const params = new URLSearchParams()
    params.set('pageNumber', String(pageNumber))
    params.set('pageSize', String(pageSize))
    if (query.searchTerm?.trim()) params.set('searchTerm', query.searchTerm.trim())
    if (typeof query.isActive === 'boolean') params.set('isActive', String(query.isActive))

    const raw = await this.http.get<unknown>(`${MARKETPLACE_ROUTES.categories}?${params.toString()}`, {
      showFeedback: false,
    })

    const build = (
      list: CategoryDto[],
      totalCount: number,
      totalPages: number,
    ): PaginatedResult<CategoryDto> => ({
      isSuccess: true,
      data: list.map(normalizeCategory),
      totalCount,
      pageNumber,
      pageSize,
      totalPages,
      hasPreviousPage: pageNumber > 1,
      hasNextPage: pageNumber < totalPages,
      message: '',
      statusCode: 200,
    })

    const paginated = toPaginated<CategoryDto>(raw)
    if (paginated) {
      return { ...paginated, data: paginated.data.map(normalizeCategory) }
    }

    if (Array.isArray(raw)) {
      const list = raw as CategoryDto[]
      return build(list, list.length, 1)
    }

    const obj = (raw ?? {}) as Record<string, unknown>
    const list = (
      Array.isArray(obj.data) ? obj.data : Array.isArray(obj.Data) ? obj.Data : []
    ) as CategoryDto[]
    return build(list, list.length, 1)
  }

  /**
   * Every category, unpaginated (`GET /categories/all`).
   *
   * Used by the clinical-specialty filter, which matches on name/slug
   * client-side and therefore needs the complete set rather than a page of it.
   */
  async getCategories(): Promise<CategoryDto[]> {
    // /categories/all is the unpaginated list. Without it the paginated route
    // silently returns page 1 only, so every category past the first page
    // disappears from navigation trees, filters and landing pages.
    const raw = await this.http.get<unknown>(MARKETPLACE_ROUTES.categoriesAll, { showFeedback: false })
    let list: CategoryDto[]
    if (Array.isArray(raw)) {
      list = raw as CategoryDto[]
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      if (Array.isArray(obj.data)) list = obj.data as CategoryDto[]
      else if (Array.isArray(obj.Data)) list = obj.Data as CategoryDto[]
      else {
        const paginated = toPaginated<CategoryDto>(raw)
        list = paginated ? paginated.data : (raw as CategoryDto[])
      }
    } else {
      list = raw as CategoryDto[]
    }
    return list.map(normalizeCategory)
  }

  async getFeaturedProducts(): Promise<ProductDto[]> {
    try {
      const raw = await this.http.get<unknown>(`${MARKETPLACE_ROUTES.products}?pageSize=6`, { showFeedback: false })
      if (Array.isArray(raw)) return (raw as ProductDto[]).map(normalizeProduct)
      if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>
        if (Array.isArray(obj.data)) return (obj.data as ProductDto[]).map(normalizeProduct)
        if (Array.isArray(obj.Data)) return (obj.Data as ProductDto[]).map(normalizeProduct)
        const paginated = toPaginated<ProductDto>(raw)
        if (paginated) return paginated.data.map(normalizeProduct)
      }
      return []
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 401)) {
        return []
      }
      throw e
    }
  }

  /** "Most selling" strip — served by the dedicated backend route, which
   *  aggregates order-item quantities in a rolling window and backfills with
   *  active catalog items. */
  async getMostSellingProducts(limit: number = 8): Promise<ProductDto[]> {
    const raw = await this.http.get<unknown>(
      `${MARKETPLACE_ROUTES.mostSelling}?limit=${Math.min(50, Math.max(1, limit))}`,
      { showFeedback: false },
    )
    if (Array.isArray(raw)) return (raw as ProductDto[]).map(normalizeProduct)
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      if (Array.isArray(obj.data)) return (obj.data as ProductDto[]).map(normalizeProduct)
      if (Array.isArray(obj.Data)) return (obj.Data as ProductDto[]).map(normalizeProduct)
    }
    return []
  }

  async createProduct(payload: CreateProductPayload): Promise<ProductDto> {
    const raw = await this.http.post<ProductDto>(MARKETPLACE_ROUTES.products, payload)
    return normalizeProduct(raw)
  }

  async updateProduct(id: string, payload: UpdateProductPayload): Promise<ProductDto> {
    const raw = await this.http.put<ProductDto>(MARKETPLACE_ROUTES.productById(id), { id, ...payload })
    return normalizeProduct(raw)
  }

  async deleteProduct(id: string): Promise<void> {
    await this.http.del<void>(MARKETPLACE_ROUTES.productById(id))
  }

  async getCategoryById(id: string): Promise<CategoryDto | null> {
    try {
      const raw = await this.http.get<CategoryDto>(MARKETPLACE_ROUTES.categoryById(id), { showFeedback: false })
      return normalizeCategory(raw)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null
      throw e
    }
  }

  async createCategory(payload: CreateCategoryPayload): Promise<CategoryDto> {
    const raw = await this.http.post<CategoryDto>(MARKETPLACE_ROUTES.categories, payload)
    return normalizeCategory(raw)
  }

  async updateCategory(id: string, payload: UpdateCategoryPayload): Promise<CategoryDto> {
    const raw = await this.http.put<CategoryDto>(MARKETPLACE_ROUTES.categoryById(id), { id, ...payload })
    return normalizeCategory(raw)
  }

  async deleteCategory(id: string): Promise<void> {
    await this.http.del<void>(MARKETPLACE_ROUTES.categoryById(id))
  }

  async getCategoryProviders(
    categoryId: string,
    query: { page?: number; pageSize?: number } = {},
  ): Promise<PaginatedResult<CompanyDto>> {
    const page = query.page ?? 1
    const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 12))
    const params = new URLSearchParams()
    params.set('pageNumber', String(page))
    params.set('pageSize', String(pageSize))
    // The backend resolves ownership server-side (active products in this
    // category or a direct child, joined to approved+active provider companies).
    const raw = await this.http.get<unknown>(
      `${MARKETPLACE_ROUTES.categoryProviders(categoryId)}?${params.toString()}`,
      { showFeedback: false },
    )
    if (Array.isArray(raw)) {
      const items = raw as CompanyDto[]
      const totalCount = items.length
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
      return {
        isSuccess: true,
        data: items.slice((page - 1) * pageSize, page * pageSize),
        totalCount,
        pageNumber: page,
        pageSize,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
        message: 'OK',
        statusCode: 200,
      }
    }
    const paged = raw as PaginatedResult<CompanyDto> | null
    if (paged && Array.isArray(paged.data)) return paged
    return {
      isSuccess: true,
      data: [],
      totalCount: 0,
      pageNumber: page,
      pageSize,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
      message: 'OK',
      statusCode: 200,
    }
  }

  /** SKU providers — one entry per provider offering the SKU, resolved
   *  server-side. */
  async getSkuProviders(sku: string): Promise<SkuProviderDto[]> {
    const needle = sku.trim()
    if (!needle) return []
    const raw = await this.http.get<unknown>(`${MARKETPLACE_ROUTES.skuProviders(needle)}`, { showFeedback: false })
    if (Array.isArray(raw)) return raw as SkuProviderDto[]
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      if (Array.isArray(obj.data)) return obj.data as SkuProviderDto[]
      if (Array.isArray(obj.Data)) return obj.Data as SkuProviderDto[]
    }
    return []
  }

  async getCurrencies(): Promise<CurrencyDto[]> {
    // GET /api/v1/currencies/all returns the full unpaginated list, so there is
    // no page-walking loop to maintain here.
    const raw = await this.http.get<unknown>(MARKETPLACE_ROUTES.currenciesAll, { showFeedback: false })
    const items = (Array.isArray(raw)
      ? raw
      : ((raw as Record<string, unknown> | null)?.data ?? (raw as Record<string, unknown> | null)?.Data ?? [])) as CurrencyDto[]
    // Defensive dedupe: seeded currency data can carry duplicate codes.
    const seenId = new Set<string>()
    const seenCode = new Set<string>()
    const result: CurrencyDto[] = []
    for (const c of items) {
      if (!c) continue
      const code = (c.code || '').trim().toUpperCase()
      if (c.id && seenId.has(c.id)) continue
      if (code && seenCode.has(code)) continue
      if (c.id) seenId.add(c.id)
      if (code) seenCode.add(code)
      result.push(c)
    }
    return result
  }

}
