import { ref } from 'vue'
import { t } from '../i18n'
import type {
  CategoryDto,
  ProductDto,
  ProductMediaDto,
  CurrencyDto,
  CreateProductPayload,
  UpdateProductPayload,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from '../domain/models/marketplace'
import type { MarketplaceRepository, MarketplaceQuery } from '../domain/ports/marketplace-repository'
import type { PaginatedResult } from '../domain/models/location'

export class MarketplaceService {
  private repo: MarketplaceRepository

  products = ref<ProductDto[]>([])
  featured = ref<ProductDto[]>([])
  mostSelling = ref<ProductDto[]>([])
  categories = ref<CategoryDto[]>([])
  currencies = ref<CurrencyDto[]>([])
  loading = ref(false)
  error = ref<string | null>(null)
  totalCount = ref(0)
  page = ref(1)
  pageSize = ref(10)
  totalPages = ref(1)

  constructor(repo: MarketplaceRepository) {
    this.repo = repo
  }

  async loadProducts(query: MarketplaceQuery = {}) {
    this.loading.value = true
    this.error.value = null
    try {
      const res: PaginatedResult<ProductDto> = await this.repo.getProducts({
        page: this.page.value,
        pageSize: this.pageSize.value,
        ...query,
      })
      this.products.value = res.data
      this.totalCount.value = res.totalCount
      this.page.value = res.pageNumber
      this.totalPages.value = res.totalPages
    } catch (e: unknown) {
      this.error.value = e instanceof Error ? e.message : t('common.loadFailed')
    } finally {
      this.loading.value = false
    }
  }

  async loadCategories() {
    this.categories.value = await this.repo.getCategories()
  }

  async loadCurrencies() {
    this.currencies.value = await this.repo.getCurrencies()
  }

  async loadFeatured() {
    this.featured.value = await this.repo.getFeaturedProducts()
  }

  async loadMostSelling(limit: number = 8) {
    this.mostSelling.value = await this.repo.getMostSellingProducts(limit)
  }

  async getProduct(id: string) {
    return this.repo.getProductById(id)
  }

  async getProductVideos(productId: string): Promise<ProductMediaDto[]> {
    return this.repo.getProductVideos(productId)
  }

  async updateProductVideos(productId: string, videos: ProductMediaDto[]): Promise<ProductMediaDto[]> {
    return this.repo.updateProductVideos(productId, videos)
  }

  async createProduct(payload: CreateProductPayload): Promise<ProductDto> {
    const created = await this.repo.createProduct(payload)
    this.products.value.unshift(created)
    this.totalCount.value++
    return created
  }

  async updateProduct(id: string, payload: UpdateProductPayload): Promise<ProductDto> {
    const updated = await this.repo.updateProduct(id, payload)
    const idx = this.products.value.findIndex((p) => p.id === id)
    if (idx !== -1) {
      this.products.value[idx] = updated
    }
    return updated
  }

  async deleteProduct(id: string): Promise<void> {
    await this.repo.deleteProduct(id)
    this.products.value = this.products.value.filter((p) => p.id !== id)
    this.totalCount.value = Math.max(0, this.totalCount.value - 1)
  }

  async getCategories() {
    if (!this.categories.value.length) await this.loadCategories()
    return this.categories.value
  }

  async getCategory(id: string) {
    return this.repo.getCategoryById(id)
  }

  async createCategory(payload: CreateCategoryPayload): Promise<CategoryDto> {
    const created = await this.repo.createCategory(payload)
    this.categories.value.push(created)
    return created
  }

  async updateCategory(id: string, payload: UpdateCategoryPayload): Promise<CategoryDto> {
    const updated = await this.repo.updateCategory(id, payload)
    const idx = this.categories.value.findIndex((c) => c.id === id)
    if (idx !== -1) {
      this.categories.value[idx] = updated
    }
    return updated
  }

  async deleteCategory(id: string): Promise<void> {
    await this.repo.deleteCategory(id)
    this.categories.value = this.categories.value.filter((c) => c.id !== id)
  }


}
