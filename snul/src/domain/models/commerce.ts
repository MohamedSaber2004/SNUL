export type OrderStatus = 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Cancelled'

export interface CartItemDto {
  id: string
  cartId: string
  productId: string
  productNameEn: string
  quantity: number
  unitPriceSnapshot: number
}

export interface CartDto {
  id: string
  userId?: string | null
  sessionId?: string | null
  currencyId?: string | null
  currencyCode?: string
  currencySymbol?: string
  items: CartItemDto[]
  isActive: boolean
  createdAt: string
}

export interface OrderItemDto {
  id: string
  orderId: string
  productId: string
  productNameEn: string
  productNameAr?: string | null
  quantity: number
  unitPrice: number
}

export interface OrderDto {
  id: string
  orderNumber: string
  status: OrderStatus
  userId?: string | null
  companyId?: string | null
  currencyId?: string | null
  currencyCode: string
  currencySymbol: string
  incotermId?: string | null
  incotermCode?: string
  totalAmount: number
  items: OrderItemDto[]
  isActive: boolean
  createdAt: string
}

export interface CreateOrderItemPayload {
  productId: string
  quantity: number
  unitPrice: number
}

export interface CreateOrderPayload {
  userId?: string
  companyId?: string
  currencyId?: string
  currencyCode?: string
  incotermCode?: string
  destinationCountryId?: string
  quoteId?: string
  items: CreateOrderItemPayload[]
}



export interface InvoiceDto {
  id: string
  invoiceNumber: string
  orderId: string
  amount: number
  status: 'Paid' | 'Pending' | 'Overdue'
  fileUrl?: string
}

export const ORDER_STATUSES: OrderStatus[] = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled']
