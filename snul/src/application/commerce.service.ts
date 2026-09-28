import { ref } from 'vue'
import type {
  CreateOrderPayload,
  OrderDto,
} from '../domain/models/commerce'
import type { CommerceRepository } from '../domain/ports/commerce-repository'
import { toastService } from '../infrastructure/feedback/toast.service'
import { t } from '../i18n'

export type CommerceResult = { ok: true } | { ok: false; error: string }

export class CommerceService {
  readonly orders = ref<OrderDto[]>([])
  readonly loading = ref(false)
  readonly totalCount = ref(0)
  readonly totalPages = ref(1)
  readonly page = ref(1)
  readonly pageSize = ref(10)

  private readonly repo: CommerceRepository

  constructor(repo: CommerceRepository) {
    this.repo = repo
  }

  async loadOrders(params: { status?: string; searchTerm?: string; page?: number; pageSize?: number; companyId?: string } = {}): Promise<void> {
    this.loading.value = true
    try {
      const pageNumber = params.page ?? this.page.value
      const pSize = params.pageSize ?? this.pageSize.value
      const res = await this.repo.getOrders({ pageNumber, pageSize: pSize, status: params.status, searchTerm: params.searchTerm, companyId: params.companyId })
      this.orders.value = Array.isArray(res?.data) ? res.data : []
      this.totalCount.value = res?.totalCount ?? this.orders.value.length
      this.totalPages.value = res?.totalPages || Math.ceil((this.totalCount.value) / pSize) || 1
      this.page.value = pageNumber
    } catch {
      this.orders.value = []
      this.totalCount.value = 0
      this.totalPages.value = 1
    } finally {
      this.loading.value = false
    }
  }

  async getOrder(id: string): Promise<OrderDto | null> {
    try {
      return await this.repo.getOrderById(id)
    } catch {
      return null
    }
  }

  async trackOrder(orderNumber: string): Promise<OrderDto | null> {
    try {
      return await this.repo.trackOrder(orderNumber)
    } catch {
      return null
    }
  }

  async placeOrder(payload: CreateOrderPayload): Promise<CommerceResult & { order?: OrderDto }> {
    try {
      const order = await this.repo.createOrder(payload)
      this.orders.value = [order, ...this.orders.value]
      toastService.success(t('commerce.orderPlaced', { orderNumber: order.orderNumber }))
      return { ok: true, order }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }

  async updateOrderStatus(id: string, status: string): Promise<CommerceResult> {
    try {
      await this.repo.updateOrderStatus(id, status)
      toastService.success(t('commerce.statusUpdated'))
      await this.loadOrders()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }
}

export function buildCreateCartPayload(userId: string | null, sessionId: string, currencyId?: string) {
  return userId ? { userId, currencyId } : { sessionId, currencyId }
}
