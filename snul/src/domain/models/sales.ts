export type RfqStatus = 'Pending' | 'Quoted' | 'Ordered' | 'Cancelled'
export type QuoteStatus = 'Draft' | 'Sent' | 'Approved' | 'Declined' | 'Expired'

export const RFQ_STATUSES: RfqStatus[] = ['Pending', 'Quoted', 'Ordered', 'Cancelled']
export const QUOTE_STATUSES: QuoteStatus[] = ['Draft', 'Sent', 'Approved', 'Declined', 'Expired']

export interface RfqItemDto {
  id: string
  rfqId: string
  productId: string
  productNameEn: string
  productNameAr?: string | null
  quantity: number
  notes?: string | null
  unitPrice?: number
  baseCurrency?: string
  requestedCurrency?: string
  basePrice?: number
  requestedPrice?: number
  exchangeRate?: number
  imageGradient?: string
  /** stored attachment name resolved via `/files/{name}` — see ATTACHMENT-INTEGRATION.md */
  imageName?: string | null
}

export interface RfqDto {
  id: string
  rfqNumber: string
  companyId: string
  companyName?: string
  userId?: string
  status: RfqStatus
  assignedSalesRepId?: string | null
  items: RfqItemDto[]
  total?: number
  currency?: string
  requestedCurrency?: string
  baseCurrency?: string
  note?: string
  createdAt: string
}

export interface CreateRfqItemPayload {
  productId: string
  quantity: number
  unitPrice: number
  notes?: string
}

export interface CreateRfqPayload {
  companyId: string
  note?: string
  items: CreateRfqItemPayload[]
}

export interface QuoteItemDto {
  id: string
  quoteId: string
  productId: string
  productNameEn: string
  productNameAr?: string | null
  quantity: number
  unitPrice: number
}

export interface QuoteDto {
  id: string
  quoteNumber: string
  rfqId: string
  rfqNumber?: string
  amount: number
  currency?: string
  validUntil: string
  status: QuoteStatus
  items: QuoteItemDto[]
  createdAt: string
}

export interface CreateQuoteItemPayload {
  productId: string
  quantity: number
  unitPrice: number
}

export interface CreateQuotePayload {
  rfqId: string
  amount: number
  validUntil: string
  items: CreateQuoteItemPayload[]
}
