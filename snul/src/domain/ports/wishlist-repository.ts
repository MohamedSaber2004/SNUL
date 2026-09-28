import type { ProductDto } from '../models/marketplace'

export interface WishlistRepository {
  getWishlist(): Promise<ProductDto[]>
  addToWishlist(productId: string): Promise<void>
  removeFromWishlist(productId: string): Promise<void>
  isInWishlist(productId: string): Promise<boolean>
}
