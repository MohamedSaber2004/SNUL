import type { PaginatedResult } from '../models/location'
import type {
  CreateOrderPayload,
  OrderDto,
} from '../models/commerce'

export interface CommerceQuery {
  pageNumber?: number
  pageSize?: number
  status?: string
  searchTerm?: string
  companyId?: string
}

export interface CommerceRepository {
  getOrders(query?: CommerceQuery): Promise<PaginatedResult<OrderDto>>
  getOrderById(id: string): Promise<OrderDto>
  createOrder(payload: CreateOrderPayload): Promise<OrderDto>
  trackOrder(orderNumber: string): Promise<OrderDto>
  updateOrderStatus(id: string, status: string): Promise<string>
}
