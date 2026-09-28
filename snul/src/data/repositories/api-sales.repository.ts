import { SALES_ROUTES } from '../../config/api.config'
import { parseRfqCurrencyNote, parseRfqHeaderCurrency } from '../../utils/rfq-currency'
import type { PaginatedResult } from '../../domain/models/location'
import type {
  CreateQuotePayload,
  CreateRfqPayload,
  QuoteDto,
  QuoteItemDto,
  QuoteStatus,
  RfqDto,
  RfqItemDto,
  RfqStatus,
} from '../../domain/models/sales'
import { QUOTE_STATUSES, RFQ_STATUSES } from '../../domain/models/sales'
import type { ProductInquiryDto, ProductInquiryQuery, SalesRepository, SalesQuery } from '../../domain/ports/sales-repository'
import type { HttpClient } from '../../infrastructure/http/http-client'

type RawObj = Record<string, unknown>

const asObj = (v: unknown): RawObj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as RawObj) : {})

const pickStr = (o: RawObj, ...keys: string[]): string => {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

const pickNum = (o: RawObj, ...keys: string[]): number | undefined => {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  }
  return undefined
}

const pickArr = (o: RawObj, ...keys: string[]): unknown[] => {
  for (const k of keys) {
    const v = o[k]
    if (Array.isArray(v)) return v
  }
  return []
}

function normalizeStatus<T extends string>(value: unknown, known: readonly T[], fallback: T): T {
  if (typeof value === 'number' && Number.isInteger(value)) {
    if (value >= 1 && value <= known.length) return known[value - 1] as T
    if (value === 0) return known[0] as T
  }
  const s = String(value ?? '').trim()
  if (!s) return fallback
  const hit = known.find((k) => k.toLowerCase() === s.toLowerCase())
  return (hit ?? (s as T))
}

const normalizeRfqStatus = (v: unknown): RfqStatus => normalizeStatus<RfqStatus>(v, RFQ_STATUSES, 'Pending')
const normalizeQuoteStatus = (v: unknown): QuoteStatus =>
  normalizeStatus<QuoteStatus>(v, QUOTE_STATUSES, 'Draft')

function normalizeRfqItem(raw: unknown, rfqId: string): RfqItemDto {
  const o = asObj(raw)
  const product = asObj(o.product ?? o.Product)
  const nameEn =
    pickStr(o, 'productNameEn', 'ProductNameEn', 'nameEn', 'NameEn') ||
    pickStr(product, 'nameEn', 'NameEn', 'name', 'Name') ||
    pickStr(o, 'name', 'Name', 'productName', 'ProductName', 'title', 'Title')
  const nameAr =
    pickStr(o, 'productNameAr', 'ProductNameAr', 'nameAr', 'NameAr') ||
    pickStr(product, 'nameAr', 'NameAr')
  const rawNotes = pickStr(o, 'notes', 'Notes', 'note', 'Note') || null
  // The buyer encodes their target currency in the item note; the API stores
  // only unitPrice, so the tag is the transport for dual-currency negotiation.
  const currencyMeta = parseRfqCurrencyNote(rawNotes)
  const rawUnitPrice = pickNum(o, 'unitPrice', 'UnitPrice', 'price', 'Price')
  const unitPrice = currencyMeta.requestedPrice ?? rawUnitPrice ?? 0
  const basePrice = currencyMeta.basePrice ?? (currencyMeta.hasConversion ? rawUnitPrice : unitPrice)
  const requestedPrice = currencyMeta.requestedPrice ?? unitPrice
  return {
    id: pickStr(o, 'id', 'Id') || `${rfqId}:${pickStr(o, 'productId', 'ProductId')}`,
    rfqId: pickStr(o, 'rfqId', 'RfqId') || rfqId,
    productId: pickStr(o, 'productId', 'ProductId'),
    productNameEn: nameEn,
    productNameAr: nameAr || null,
    quantity: pickNum(o, 'quantity', 'Quantity') ?? 1,
    notes: currencyMeta.cleanNote || rawNotes,
    unitPrice,
    baseCurrency: currencyMeta.baseCurrency,
    requestedCurrency: currencyMeta.requestedCurrency,
    basePrice,
    requestedPrice,
    exchangeRate: currencyMeta.rate,
    imageGradient: pickStr(o, 'imageGradient', 'ImageGradient') || undefined,
    imageName: pickStr(o, 'imageName', 'ImageName', 'image', 'Image') || null,
  }
}

function normalizeRfq(raw: unknown): RfqDto {
  const o = asObj(raw)
  const id = pickStr(o, 'id', 'Id')
  const items = pickArr(o, 'items', 'Items', 'rfqItems', 'RfqItems', 'lines', 'Lines')
  const rawNote = pickStr(o, 'note', 'Note', 'notes', 'Notes') || undefined
  const headerCurrency = parseRfqHeaderCurrency(rawNote)
  const normalizedItems = items.map((it) => normalizeRfqItem(it, id))
  const requestedCurrency =
    headerCurrency.requestedCurrency ||
    normalizedItems.find((it) => it.requestedCurrency)?.requestedCurrency ||
    pickStr(o, 'currency', 'Currency') ||
    'USD'
  const baseCurrency = headerCurrency.baseCurrency || normalizedItems.find((it) => it.baseCurrency)?.baseCurrency || 'USD'
  // Back-fill per-item currency so every line is renderable even when only the
  // header carried the tag.
  for (const it of normalizedItems) {
    if (!it.requestedCurrency) it.requestedCurrency = requestedCurrency
    if (!it.baseCurrency) it.baseCurrency = baseCurrency
    if (it.basePrice == null) it.basePrice = it.unitPrice ?? 0
    if (it.requestedPrice == null) it.requestedPrice = it.unitPrice ?? 0
  }
  return {
    id,
    rfqNumber: pickStr(o, 'rfqNumber', 'RfqNumber', 'number', 'Number') || id,
    companyId: pickStr(o, 'companyId', 'CompanyId'),
    companyName: pickStr(o, 'companyName', 'CompanyName', 'company', 'Company'),
    userId: pickStr(o, 'userId', 'UserId') || undefined,
    status: normalizeRfqStatus(o.status ?? o.Status),
    assignedSalesRepId: pickStr(o, 'assignedSalesRepId', 'AssignedSalesRepId') || null,
    items: normalizedItems,
    total: pickNum(o, 'total', 'Total', 'amount', 'Amount'),
    currency: requestedCurrency,
    requestedCurrency,
    baseCurrency,
    note: rawNote,
    createdAt: pickStr(o, 'createdAt', 'CreatedAt'),
  }
}

function normalizeQuoteItem(raw: unknown, quoteId: string): QuoteItemDto {
  const base = normalizeRfqItem(raw, quoteId)
  const o = asObj(raw)
  return {
    id: base.id,
    quoteId: pickStr(o, 'quoteId', 'QuoteId', 'rfqId', 'RfqId') || quoteId,
    productId: base.productId,
    productNameEn: base.productNameEn,
    productNameAr: base.productNameAr,
    quantity: base.quantity,
    unitPrice: pickNum(o, 'unitPrice', 'UnitPrice', 'price', 'Price') ?? base.unitPrice ?? 0,
  }
}

function normalizeQuote(raw: unknown): QuoteDto {
  const o = asObj(raw)
  const id = pickStr(o, 'id', 'Id')
  const items = pickArr(o, 'items', 'Items', 'quoteItems', 'QuoteItems', 'lines', 'Lines')
  return {
    id,
    quoteNumber: pickStr(o, 'quoteNumber', 'QuoteNumber', 'number', 'Number') || id,
    rfqId: pickStr(o, 'rfqId', 'RfqId'),
    rfqNumber: pickStr(o, 'rfqNumber', 'RfqNumber') || undefined,
    amount: pickNum(o, 'amount', 'Amount', 'total', 'Total') ?? 0,
    currency: pickStr(o, 'currency', 'Currency') || undefined,
    validUntil: pickStr(o, 'validUntil', 'ValidUntil'),
    status: normalizeQuoteStatus(o.status ?? o.Status),
    items: items.map((it) => normalizeQuoteItem(it, id)),
    createdAt: pickStr(o, 'createdAt', 'CreatedAt'),
  }
}

function toPaginated<T>(raw: unknown, query: SalesQuery, normalize: (v: unknown) => T): PaginatedResult<T> {
  const fallback = {
    isSuccess: false, data: [] as T[], totalCount: 0,
    pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10,
    totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200,
  }
  if (Array.isArray(raw)) {
    const data = raw.map(normalize)
    return { ...fallback, isSuccess: true, data, totalCount: data.length }
  }
  const res = asObj(raw)
  const list = pickArr(res, 'data', 'Data')
  const data = list.map(normalize)
  return {
    isSuccess: Boolean(res.isSuccess ?? res.IsSuccess ?? true),
    data,
    totalCount: pickNum(res, 'totalCount', 'TotalCount') ?? data.length,
    pageNumber: pickNum(res, 'pageNumber', 'PageNumber') ?? query.pageNumber ?? 1,
    pageSize: pickNum(res, 'pageSize', 'PageSize') ?? query.pageSize ?? 10,
    totalPages: pickNum(res, 'totalPages', 'TotalPages') ?? 1,
    hasPreviousPage: Boolean(res.hasPreviousPage ?? res.HasPreviousPage),
    hasNextPage: Boolean(res.hasNextPage ?? res.HasNextPage),
    message: pickStr(res, 'message', 'Message') || 'OK',
    statusCode: pickNum(res, 'statusCode', 'StatusCode') ?? 200,
  }
}

export class ApiSalesRepository implements SalesRepository {
  constructor(private readonly http: HttpClient) {}

  private async getRfqsList(query: SalesQuery): Promise<PaginatedResult<RfqDto>> {
    const params = new URLSearchParams()
    if (query.pageNumber) params.set('pageNumber', String(query.pageNumber))
    if (query.pageSize) params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize))))
    if (query.searchTerm) params.set('searchTerm', query.searchTerm)
    if (query.status) params.set('status', query.status)
    const qs = params.toString()
    try {
      const raw = await this.http.get<unknown>(qs ? `${SALES_ROUTES.rfqs}?${qs}` : SALES_ROUTES.rfqs, { showFeedback: false })
      return toPaginated<RfqDto>(raw, query, normalizeRfq)
    } catch {
      return { isSuccess: false, data: [], totalCount: 0, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200 }
    }
  }

  async getRfqs(query: SalesQuery = {}): Promise<PaginatedResult<RfqDto>> {
    return await this.getRfqsList(query)
  }

  async getRfqById(id: string): Promise<RfqDto> {
    const raw = await this.http.get<unknown>(SALES_ROUTES.rfqById(id), { showFeedback: false })
    const o = asObj(raw)
    const payload = o.data && typeof o.data === 'object' ? o.data : raw
    return normalizeRfq(payload)
  }

  async createRfq(payload: CreateRfqPayload): Promise<RfqDto> {
    const raw = await this.http.post<unknown>(SALES_ROUTES.rfqs, payload)
    const o = asObj(raw)
    const data = o.data && typeof o.data === 'object' ? o.data : raw
    return normalizeRfq(data)
  }

  async updateRfqStatus(id: string, status: string): Promise<string> {
    return await this.http.put<string>(SALES_ROUTES.rfqStatus(id), { status })
  }

  private async getQuotesList(query: SalesQuery): Promise<PaginatedResult<QuoteDto>> {
    const params = new URLSearchParams()
    if (query.pageNumber) params.set('pageNumber', String(query.pageNumber))
    if (query.pageSize) params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize))))
    if (query.searchTerm) params.set('searchTerm', query.searchTerm)
    if (query.status) params.set('status', query.status)
    const qs = params.toString()
    try {
      const raw = await this.http.get<unknown>(qs ? `${SALES_ROUTES.quotes}?${qs}` : SALES_ROUTES.quotes, { showFeedback: false })
      return toPaginated<QuoteDto>(raw, query, normalizeQuote)
    } catch {
      return { isSuccess: false, data: [], totalCount: 0, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200 }
    }
  }

  async getQuotes(query: SalesQuery = {}): Promise<PaginatedResult<QuoteDto>> {
    return await this.getQuotesList(query)
  }

  async getQuoteById(id: string): Promise<QuoteDto> {
    const raw = await this.http.get<unknown>(SALES_ROUTES.quoteById(id), { showFeedback: false })
    const o = asObj(raw)
    const payload = o.data && typeof o.data === 'object' ? o.data : raw
    return normalizeQuote(payload)
  }

  async createQuote(payload: CreateQuotePayload): Promise<string> {
    return await this.http.post<string>(SALES_ROUTES.quotes, payload)
  }

  async approveQuote(id: string): Promise<string> {
    return await this.http.post<string>(SALES_ROUTES.quoteApprove(id), {}, { showFeedback: false })
  }

  async declineQuote(id: string): Promise<string> {
    return await this.http.post<string>(SALES_ROUTES.quoteDecline(id), {}, { showFeedback: false })
  }

  async createProductInquiry(payload: { productId: string; name: string; organization: string; message: string; email?: string }): Promise<unknown> {
    return await this.http.post<unknown>(SALES_ROUTES.productInquiries, payload, { showFeedback: true })
  }

  async getProductInquiries(query: ProductInquiryQuery = {}): Promise<PaginatedResult<ProductInquiryDto>> {
    const params = new URLSearchParams()
    if (query.pageNumber) params.set('pageNumber', String(query.pageNumber))
    if (query.pageSize) params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize))))
    if (query.searchTerm) params.set('searchTerm', query.searchTerm)
    if (query.productId) params.set('productId', query.productId)
    const qs = params.toString()
    const raw = await this.http.get<unknown>(qs ? `${SALES_ROUTES.productInquiries}?${qs}` : SALES_ROUTES.productInquiries, { showFeedback: false })
    if (Array.isArray(raw)) return { isSuccess: true, data: raw as ProductInquiryDto[], totalCount: raw.length, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200 }
    return raw as PaginatedResult<ProductInquiryDto>
  }

  async getProductInquiryById(id: string): Promise<ProductInquiryDto> {
    return await this.http.get<ProductInquiryDto>(SALES_ROUTES.productInquiryById(id), { showFeedback: false })
  }

  async deleteProductInquiry(id: string): Promise<void> {
    await this.http.del<void>(SALES_ROUTES.productInquiryById(id), { showFeedback: false })
  }
}
