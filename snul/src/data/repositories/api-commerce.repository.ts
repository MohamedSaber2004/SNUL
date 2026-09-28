import { COMMERCE_ROUTES } from '../../config/api.config'
import type { PaginatedResult } from '../../domain/models/location'
import type {
  CartDto,
  CreateOrderPayload,
  OrderDto,
} from '../../domain/models/commerce'
import type { CommerceRepository, CommerceQuery } from '../../domain/ports/commerce-repository'
import type { HttpClient } from '../../infrastructure/http/http-client'

export class ApiCommerceRepository implements CommerceRepository {
  constructor(private readonly http: HttpClient) {}

  private extractList<T>(raw: unknown): T[] {
    if (Array.isArray(raw)) return raw as T[]
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      if (Array.isArray(obj.data)) return obj.data as T[]
      if (Array.isArray(obj.Data)) return obj.Data as T[]
    }
    return []
  }

  async getOrders(query: CommerceQuery = {}): Promise<PaginatedResult<OrderDto>> {
    const params = new URLSearchParams()
    if (query.pageNumber) params.set('pageNumber', String(query.pageNumber))
    if (query.pageSize) params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize))))
    if (query.status) params.set('status', query.status)
    if (query.searchTerm) params.set('searchTerm', query.searchTerm)
    if (query.companyId) params.set('companyId', query.companyId)
    const qs = params.toString()
    try {
      const raw = await this.http.get<unknown>(qs ? `${COMMERCE_ROUTES.orders}?${qs}` : COMMERCE_ROUTES.orders, { showFeedback: false })
      if (Array.isArray(raw)) return { isSuccess: true, data: raw as OrderDto[], totalCount: raw.length, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200 }
      if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>
        const rawData = obj.data ?? obj.Data
        const data = Array.isArray(rawData) ? (rawData as OrderDto[]) : []
        return {
          isSuccess: (obj.isSuccess ?? obj.IsSuccess ?? true) as boolean,
          data,
          totalCount: (obj.totalCount ?? obj.TotalCount ?? data.length) as number,
          pageNumber: (obj.pageNumber ?? obj.PageNumber ?? query.pageNumber ?? 1) as number,
          pageSize: (obj.pageSize ?? obj.PageSize ?? query.pageSize ?? 10) as number,
          totalPages: (obj.totalPages ?? obj.TotalPages ?? 1) as number,
          hasPreviousPage: (obj.hasPreviousPage ?? obj.HasPreviousPage ?? false) as boolean,
          hasNextPage: (obj.hasNextPage ?? obj.HasNextPage ?? false) as boolean,
          message: (obj.message ?? obj.Message ?? 'OK') as string,
          statusCode: (obj.statusCode ?? obj.StatusCode ?? 200) as number,
        }
      }
    } catch {
      // Graceful fallback for cold gateway or not found
    }
    return { isSuccess: true, data: [], totalCount: 0, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200 }
  }

  async getOrderById(id: string): Promise<OrderDto> {
    return await this.http.get<OrderDto>(COMMERCE_ROUTES.orderById(id), { showFeedback: false })
  }

  async createOrder(payload: CreateOrderPayload): Promise<OrderDto> {
    return await this.http.post<OrderDto>(COMMERCE_ROUTES.orders, payload)
  }

  async trackOrder(orderNumber: string): Promise<OrderDto> {
    const raw = await this.http.get<unknown>(COMMERCE_ROUTES.orderTrack(orderNumber), { showFeedback: false })
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      if (obj.data && typeof obj.data === 'object') return obj.data as OrderDto
      if (obj.isSuccess === false) throw new Error((obj.message as string) || 'Order not found')
    }
    return raw as OrderDto
  }

  async updateOrderStatus(id: string, status: string): Promise<string> {
    return await this.http.put<string>(COMMERCE_ROUTES.orderStatus(id), { status }, { showFeedback: false })
  }

  async createCart(body: { userId?: string; sessionId?: string; currencyId?: string }): Promise<CartDto> {
    return await this.http.post<CartDto>(COMMERCE_ROUTES.carts, body, { showFeedback: false })
  }

  async addItem(cartId: string, body: { productId: string; quantity: number; unitPriceSnapshot: number }): Promise<CartDto> {
    return await this.http.post<CartDto>(COMMERCE_ROUTES.cartItems(cartId), body, { showFeedback: false })
  }

  async getBySession(sessionId: string): Promise<CartDto> {
    return await this.http.get<CartDto>(COMMERCE_ROUTES.cartBySession(sessionId), { showFeedback: false })
  }

  async clearCart(cartId: string): Promise<void> {
    await this.http.post<void>(COMMERCE_ROUTES.cartClear(cartId), {}, { showFeedback: false })
  }

}
