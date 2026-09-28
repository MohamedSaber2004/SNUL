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
} from '../models/marketplace'
import type { CompanyDto } from '../models/company'
import type { PaginatedResult } from '../models/location'

export interface MarketplaceQuery {
  search?: string
  sku?: string
  categoryId?: string
  page?: number
  pageSize?: number
  sortBy?: 'price-asc' | 'price-desc' | 'newest'
  inStockOnly?: boolean
  material?: string
  lengthMin?: number
  lengthMax?: number
  priceMin?: number
  priceMax?: number
  currencyId?: string
}

export interface MarketplaceRepository {
  getProducts(query?: MarketplaceQuery): Promise<PaginatedResult<ProductDto>>
  getProductById(id: string): Promise<ProductDto | null>
  getProductVideos(productId: string): Promise<ProductMediaDto[]>
  updateProductVideos(productId: string, videos: ProductMediaDto[]): Promise<ProductMediaDto[]>
  createProduct(payload: CreateProductPayload): Promise<ProductDto>
  updateProduct(id: string, payload: UpdateProductPayload): Promise<ProductDto>
  deleteProduct(id: string): Promise<void>
  /** Provider's own catalog. Uses GET products/mine when the backend
   *  ships it, otherwise filters the shared list by supplierId. */
  getMyProducts(companyId: string, query?: MarketplaceQuery): Promise<PaginatedResult<ProductDto>>

  getCategories(): Promise<CategoryDto[]>
  /** Server-paginated list (`GET /categories`), used by the landing category grid. */
  getCategoriesPaginated(query?: CategoryQuery): Promise<PaginatedResult<CategoryDto>>
  getCategoryById(id: string): Promise<CategoryDto | null>
  getCategoryProviders(categoryId: string, query?: { page?: number; pageSize?: number }): Promise<PaginatedResult<CompanyDto>>
  getSkuProviders(sku: string): Promise<SkuProviderDto[]>
  createCategory(payload: CreateCategoryPayload): Promise<CategoryDto>
  updateCategory(id: string, payload: UpdateCategoryPayload): Promise<CategoryDto>
  deleteCategory(id: string): Promise<void>

  getFeaturedProducts(): Promise<ProductDto[]>
  getMostSellingProducts(limit?: number): Promise<ProductDto[]>
  getCurrencies(): Promise<CurrencyDto[]>
}
