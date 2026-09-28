import { ref } from 'vue'
import type { CreateQuotePayload, CreateRfqPayload, QuoteDto, RfqDto } from '../domain/models/sales'
import type { SalesRepository } from '../domain/ports/sales-repository'
import { toastService } from '../infrastructure/feedback/toast.service'
import { t } from '../i18n'

export type SalesResult = { ok: true } | { ok: false; error: string }

export class SalesService {
  readonly rfqs = ref<RfqDto[]>([])
  readonly quotes = ref<QuoteDto[]>([])
  readonly loading = ref(false)
  readonly rfqPage = ref(1)
  readonly rfqTotalPages = ref(1)
  readonly rfqTotalCount = ref(0)
  readonly quotePage = ref(1)
  readonly quoteTotalPages = ref(1)
  readonly quoteTotalCount = ref(0)
  readonly pageSize = ref(10)

  private readonly repo: SalesRepository

  constructor(repo: SalesRepository) {
    this.repo = repo
  }

  /** Backend RFQDto carries no total — derive it from the requester's line prices. */
  private withTotals(rfq: RfqDto): RfqDto {
    if (!rfq) return rfq
    const items = Array.isArray(rfq.items) ? rfq.items : []
    const total = items.reduce((s, i) => {
      // The buyer's target-currency price is what the totals must reflect; the
      // base price is only the provider's reference point.
      const price = i?.requestedPrice != null ? i.requestedPrice : (i?.unitPrice ?? 0)
      return s + price * (i?.quantity ?? 1)
    }, 0)
    return { ...rfq, items, total }
  }

  async loadRfqs(params: { pageNumber?: number; pageSize?: number; searchTerm?: string; status?: string } = {}): Promise<void> {
    this.loading.value = true
    try {
      const pageNumber = params.pageNumber ?? this.rfqPage.value
      const pageSize = params.pageSize ?? 50
      const res = await this.repo.getRfqs({ pageNumber, pageSize, searchTerm: params.searchTerm, status: params.status })
      const data = Array.isArray(res?.data) ? res.data : []
      this.rfqs.value = data.map((r) => this.withTotals(r))
      this.rfqTotalCount.value = res?.totalCount ?? this.rfqs.value.length
      this.rfqTotalPages.value = res?.totalPages || Math.ceil(this.rfqTotalCount.value / pageSize) || 1
      this.rfqPage.value = pageNumber
    } catch {
      this.rfqs.value = []
    } finally {
      this.loading.value = false
    }
  }

  async loadQuotes(params: { pageNumber?: number; pageSize?: number; searchTerm?: string; status?: string } = {}): Promise<void> {
    this.loading.value = true
    try {
      const pageNumber = params.pageNumber ?? this.quotePage.value
      const pageSize = params.pageSize ?? 50
      const res = await this.repo.getQuotes({ pageNumber, pageSize, searchTerm: params.searchTerm, status: params.status })
      this.quotes.value = Array.isArray(res?.data) ? res.data : []
      this.quoteTotalCount.value = res?.totalCount ?? this.quotes.value.length
      this.quoteTotalPages.value = res?.totalPages || Math.ceil(this.quoteTotalCount.value / pageSize) || 1
      this.quotePage.value = pageNumber
    } catch {
      this.quotes.value = []
    } finally {
      this.loading.value = false
    }
  }

  async loadAll(): Promise<void> {
    const results = await Promise.allSettled([this.loadRfqs({ pageSize: 50 }), this.loadQuotes({ pageSize: 50 })])
    for (const r of results) {
      if (import.meta.env.DEV && r.status === 'rejected') console.warn('[sales] loadAll part failed', r.reason)
    }
  }

  async getRfq(id: string): Promise<RfqDto | null> {
    try {
      return this.withTotals(await this.repo.getRfqById(id))
    } catch {
      return null
    }
  }

  async getQuote(id: string): Promise<QuoteDto | null> {
    try {
      return await this.repo.getQuoteById(id)
    } catch {
      return null
    }
  }

  async createRfq(payload: CreateRfqPayload): Promise<SalesResult & { rfq?: RfqDto }> {
    try {
      const rfq = this.withTotals(await this.repo.createRfq(payload))
      this.rfqs.value = [rfq, ...this.rfqs.value]
      toastService.success(t('sales.rfqSubmitted', { rfqNumber: rfq.rfqNumber }))
      return { ok: true, rfq }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }

  async createQuote(payload: CreateQuotePayload): Promise<SalesResult & { quoteId?: string }> {
    try {
      const quoteId = await this.repo.createQuote(payload)
      await this.loadAll()
      toastService.success(t('sales.quoteCreated'))
      return { ok: true, quoteId }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }

  async approveQuote(id: string): Promise<SalesResult> {
    try {
      await this.repo.approveQuote(id)
      toastService.success(t('sales.quoteApproved'))
      await this.loadAll()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }

  async declineQuote(id: string): Promise<SalesResult> {
    try {
      await this.repo.declineQuote(id)
      toastService.success(t('sales.quoteDeclined'))
      await this.loadAll()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }

  async updateRfqStatus(id: string, status: string): Promise<SalesResult> {
    try {
      await this.repo.updateRfqStatus(id, status)
      await this.loadAll()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }

  async createProductInquiry(productId: string, name: string, organization: string, message: string, email?: string): Promise<SalesResult> {
    try {
      await this.repo.createProductInquiry({ productId, name, organization, message, email })
      toastService.success(t('common.savedSuccessfully'))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }

  async loadProductInquiries(query: import('../domain/ports/sales-repository').ProductInquiryQuery = {}) {
    return await this.repo.getProductInquiries(query)
  }

  async getProductInquiry(id: string) {
    return await this.repo.getProductInquiryById(id)
  }

  async deleteProductInquiry(id: string): Promise<SalesResult> {
    try {
      await this.repo.deleteProductInquiry(id)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }
}
