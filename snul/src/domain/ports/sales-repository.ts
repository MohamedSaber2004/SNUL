import type { PaginatedResult } from '../models/location'
import type { CreateQuotePayload, CreateRfqPayload, QuoteDto, RfqDto } from '../models/sales'

export interface SalesQuery {
  pageNumber?: number
  pageSize?: number
  searchTerm?: string
  status?: string
}

export interface ProductInquiryDto {
  id: string
  productId: string
  productNameEn?: string | null
  productNameAr?: string | null
  productSku?: string | null
  name: string
  organization: string
  message: string
  email?: string | null
  createdAt: string
}

export interface ProductInquiryQuery extends SalesQuery {
  searchTerm?: string
  productId?: string
}

export interface SalesRepository {
  getRfqs(query?: SalesQuery): Promise<PaginatedResult<RfqDto>>
  getRfqById(id: string): Promise<RfqDto>
  createRfq(payload: CreateRfqPayload): Promise<RfqDto>
  updateRfqStatus(id: string, status: string): Promise<string>
  getQuotes(query?: SalesQuery): Promise<PaginatedResult<QuoteDto>>
  getQuoteById(id: string): Promise<QuoteDto>
  createQuote(payload: CreateQuotePayload): Promise<string>
  approveQuote(id: string): Promise<string>
  declineQuote(id: string): Promise<string>
  createProductInquiry(payload: { productId: string; name: string; organization: string; message: string; email?: string }): Promise<unknown>
  getProductInquiries(query?: ProductInquiryQuery): Promise<PaginatedResult<ProductInquiryDto>>
  getProductInquiryById(id: string): Promise<ProductInquiryDto>
  deleteProductInquiry(id: string): Promise<void>
}
