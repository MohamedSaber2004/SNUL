import { WISHLIST_ROUTES } from '../../config/api.config'
import type { WishlistRepository } from '../../domain/ports/wishlist-repository'
import type { ProductDto } from '../../domain/models/marketplace'
import type { HttpClient } from '../../infrastructure/http/http-client'
import { ApiError } from '../../infrastructure/http/api-error'

export class ApiWishlistRepository implements WishlistRepository {
  constructor(private readonly http: HttpClient) {}

  async getWishlist(): Promise<ProductDto[]> {
    try {
      const data = await this.http.get<ProductDto[] | { data: ProductDto[] }>(WISHLIST_ROUTES.list, { showFeedback: false })
      if (Array.isArray(data)) return data as ProductDto[]
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>
        if (Array.isArray(obj.data)) return obj.data as ProductDto[]
        if (Array.isArray(obj.Data)) return obj.Data as ProductDto[]
      }
      return []
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 404)) return []
      throw e
    }
  }

  async addToWishlist(productId: string): Promise<void> {
    await this.http.post<void>(WISHLIST_ROUTES.add(productId), {}, { showFeedback: false })
  }

  async removeFromWishlist(productId: string): Promise<void> {
    await this.http.del<void>(WISHLIST_ROUTES.remove(productId), { showFeedback: false })
  }

  async isInWishlist(productId: string): Promise<boolean> {
    try {
      const data = await this.http.get<boolean | { data: boolean }>(WISHLIST_ROUTES.check(productId), { showFeedback: false })
      if (typeof data === 'boolean') return data
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>
        if (typeof obj.data === 'boolean') return obj.data as boolean
        if (typeof obj.Data === 'boolean') return obj.Data as boolean
      }
      return false
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return false
      return false
    }
  }
}
