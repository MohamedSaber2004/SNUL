<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ProviderLayout from '../../components/layout/ProviderLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import { commerceService, companyService } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { t, locale } from '../../i18n'
import type { OrderDto } from '../../domain/models/commerce'
import { ORDER_STATUSES } from '../../domain/models/commerce'
import { formatPrice } from '../../utils/format'

const router = useRouter()
const localized = (en?: string | null, ar?: string | null) =>
  locale.value === 'ar' ? ar || en || '' : en || ar || ''

const orders = commerceService.orders
const loading = ref(true)
const fetchError = ref('')
const search = ref('')
const statusFilter = ref('all')
const page = ref(1)
const pageSize = 10

// Action states
const acting = ref('')
const selectedOrder = ref<OrderDto | null>(null)
const showDetailModal = ref(false)

// Status update modal
const showStatusModal = ref(false)
const targetOrder = ref<OrderDto | null>(null)
const newStatus = ref('')
const trackingNumber = ref('')
const updatingStatus = ref(false)

const loadOrders = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    await Promise.all([
      companyService.loadMyCompany().catch(() => null),
      commerceService.loadOrders({ page: 1, pageSize: 50 }),
    ])
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadOrders()
})

// Metrics
const totalOrdersCount = computed(() => orders.value.length)
const pendingCount = computed(() => orders.value.filter((o) => (o.status || '').toLowerCase() === 'pending').length)
const processingCount = computed(() => orders.value.filter((o) => ['confirmed', 'processing'].includes((o.status || '').toLowerCase())).length)
const completedCount = computed(() => orders.value.filter((o) => ['shipped', 'delivered', 'completed'].includes((o.status || '').toLowerCase())).length)

const filteredOrders = computed(() => {
  let list = orders.value

  if (statusFilter.value !== 'all') {
    list = list.filter((o) => String(o.status || '').toLowerCase() === statusFilter.value.toLowerCase())
  }

  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter((o) => {
      const num = o.orderNumber?.toLowerCase() || ''
      const id = o.id?.toLowerCase() || ''
      const hasItem = Array.isArray(o.items) && o.items.some((it) =>
        (it.productNameEn?.toLowerCase() || '').includes(q) ||
        (it.productNameAr?.toLowerCase() || '').includes(q) ||
        (it.productId?.toLowerCase() || '').includes(q)
      )
      return num.includes(q) || id.includes(q) || hasItem
    })
  }

  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredOrders.value.length / pageSize)))
const paginatedOrders = computed(() =>
  filteredOrders.value.slice((page.value - 1) * pageSize, page.value * pageSize)
)

const openDetails = (order: OrderDto) => {
  selectedOrder.value = order
  showDetailModal.value = true
}

const openStatusModal = (order: OrderDto) => {
  targetOrder.value = order
  newStatus.value = order.status || 'Confirmed'
  trackingNumber.value = (order as unknown as { trackingNumber?: string }).trackingNumber || ''
  showStatusModal.value = true
}

const submitStatusUpdate = async () => {
  if (!targetOrder.value || !newStatus.value) return

  updatingStatus.value = true
  try {
    const res = await commerceService.updateOrderStatus(targetOrder.value.id, newStatus.value)
    if (res.ok) {
      toastService.success(t('provider.statusUpdated'))
      showStatusModal.value = false
      await loadOrders()
    } else {
      toastService.error(res.error)
    }
  } finally {
    updatingStatus.value = false
  }
}
</script>

<template>
  <ProviderLayout>
    <div class="provider-orders-view">
      <!-- Header -->
      <header class="view-header">
        <div>
          <span class="mono eyebrow">{{ t('provider.dashboard') }} · {{ t('admin.commerce') }}</span>
          <h1 class="view-title">{{ t('provider.orders') }}</h1>
          <p class="view-desc">{{ t('provider.ordersDesc') }}</p>
        </div>
        <div class="header-actions">
          <BaseButton variant="ghost" icon="support_agent" @click="router.push('/provider/support')">
            {{ t('provider.support') }}
          </BaseButton>
          <BaseButton variant="ghost" icon="refresh" :loading="loading" @click="loadOrders">
            {{ t('common.refresh') }}
          </BaseButton>
        </div>
      </header>

      <!-- KPI Metrics -->
      <div class="kpi-grid">
        <button type="button" class="kpi-card" :class="{ 'is-active': statusFilter === 'all' }" :aria-pressed="statusFilter === 'all'" @click="statusFilter = 'all'">
          <span class="kpi-icon-box bg-primary-soft" aria-hidden="true">
            <span class="material-symbols-outlined text-primary">local_shipping</span>
          </span>
          <span class="kpi-info">
            <span class="kpi-label mono">{{ t('commerce.ordersTitle') }}</span>
            <strong class="kpi-value mono">{{ totalOrdersCount }}</strong>
          </span>
        </button>

        <button type="button" class="kpi-card" :class="{ 'is-active': statusFilter === 'Pending' }" :aria-pressed="statusFilter === 'Pending'" @click="statusFilter = 'Pending'">
          <span class="kpi-icon-box bg-amber-soft" aria-hidden="true">
            <span class="material-symbols-outlined text-amber-600">hourglass_top</span>
          </span>
          <span class="kpi-info">
            <span class="kpi-label mono">{{ t('account.pipeStatusPending') }}</span>
            <strong class="kpi-value mono text-amber-600">{{ pendingCount }}</strong>
          </span>
        </button>

        <button type="button" class="kpi-card" :class="{ 'is-active': statusFilter === 'Confirmed' }" :aria-pressed="statusFilter === 'Confirmed'" @click="statusFilter = 'Confirmed'">
          <span class="kpi-icon-box bg-blue-soft" aria-hidden="true">
            <span class="material-symbols-outlined text-blue-600">sync</span>
          </span>
          <span class="kpi-info">
            <span class="kpi-label mono">{{ t('account.processing') }}</span>
            <strong class="kpi-value mono text-blue-600">{{ processingCount }}</strong>
          </span>
        </button>

        <button type="button" class="kpi-card" :class="{ 'is-active': statusFilter === 'Delivered' }" :aria-pressed="statusFilter === 'Delivered'" @click="statusFilter = 'Delivered'">
          <span class="kpi-icon-box bg-emerald-soft" aria-hidden="true">
            <span class="material-symbols-outlined text-emerald-600">check_circle</span>
          </span>
          <span class="kpi-info">
            <span class="kpi-label mono">{{ t('account.stepDelivered') }}</span>
            <strong class="kpi-value mono text-emerald-600">{{ completedCount }}</strong>
          </span>
        </button>
      </div>

      <!-- Filter Controls -->
      <div class="filter-bar">
        <div class="search-input-wrap">
          <span class="material-symbols-outlined search-ic">search</span>
          <input
            v-model="search"
            type="search"
            :placeholder="t('common.searchPlaceholder')"
            class="search-input"
          />
        </div>

        <div class="filter-actions">
          <select v-model="statusFilter" class="filter-select mono">
            <option value="all">{{ t('common.all') }} {{ t('commerce.status') }}</option>
            <option v-for="st in ORDER_STATUSES" :key="st" :value="st">{{ st }}</option>
          </select>
        </div>
      </div>

      <!-- Orders Table -->
      <div class="table-card">
        <DataState :loading="loading" :error="fetchError" :empty="!paginatedOrders.length" :empty-text="t('commerce.noOrders')" @retry="loadOrders">
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr class="mono">
                  <th>{{ t('commerce.orderNumber') }}</th>
                  <th>{{ t('commerce.placed') }}</th>
                  <th>{{ t('cart.trayHeading') }}</th>
                  <th class="num">{{ t('commerce.total') }}</th>
                  <th>{{ t('commerce.status') }}</th>
                  <th class="text-end">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="order in paginatedOrders" :key="order.id">
                  <td>
                    <div class="order-id-cell">
                      <strong class="mono order-num">{{ order.orderNumber }}</strong>
                      <span class="mono text-xs text-muted">ID: {{ order.id.slice(0, 8) }}…</span>
                    </div>
                  </td>

                  <td class="mono text-muted text-sm">
                    {{ order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—' }}
                  </td>

                  <td>
                    <div class="items-cell">
                      <span class="items-count-badge mono">
                        {{ Array.isArray(order.items) ? order.items.length : 0 }} {{ t('marketplace.products') }}
                      </span>
                      <div class="items-snippet mono">
                        <span v-for="(it, i) in (order.items || []).slice(0, 2)" :key="i" class="item-chip">
                          {{ localized(it.productNameEn, it.productNameAr) }} (x{{ it.quantity }})
                        </span>
                        <span v-if="(order.items?.length || 0) > 2" class="more-items">
                          +{{ (order.items?.length || 0) - 2 }}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td class="num">
                    <strong class="mono total-fig">{{ formatPrice(order.totalAmount, order.currencyCode || 'USD') }}</strong>
                  </td>

                  <td>
                    <StatusPill :status="order.status" />
                  </td>

                  <td class="text-end">
                    <div class="action-btn-group">
                      <button
                        type="button"
                        class="action-btn btn-status"
                        :title="t('common.edit')"
                        @click="openStatusModal(order)"
                      >
                        <span class="material-symbols-outlined text-[16px]">tune</span>
                        <span>{{ t('common.edit') }}</span>
                      </button>

                      <button
                        type="button"
                        class="action-btn btn-view"
                        :title="t('common.details')"
                        :aria-label="t('common.details')"
                        @click="openDetails(order)"
                      >
                        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">visibility</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="pagination-footer">
              <AppPagination v-model:page="page" :total-pages="totalPages" />
          </div>
        </DataState>
      </div>

      <!-- Order Detail Modal -->
      <BaseModal v-model="showDetailModal" :title="`${t('commerce.orderDetailTitle')} · ${selectedOrder?.orderNumber || ''}`" size="lg">
        <div v-if="selectedOrder" class="detail-modal-body">
          <div class="detail-grid mono">
            <div class="detail-item">
              <span class="lbl">{{ t('commerce.orderNumber') }}</span>
              <strong class="val">{{ selectedOrder.orderNumber }}</strong>
            </div>
            <div class="detail-item">
              <span class="lbl">{{ t('commerce.placed') }}</span>
              <strong class="val">{{ selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString() : '—' }}</strong>
            </div>
            <div class="detail-item">
              <span class="lbl">{{ t('commerce.status') }}</span>
              <StatusPill :status="selectedOrder.status" />
            </div>
          </div>

          <!-- Line items -->
          <div class="line-items-section">
            <h3 class="section-sub mono">{{ t('sales.lineItems') }}</h3>
            <table class="line-items-table mono">
              <thead>
                <tr>
                  <th>{{ t('marketplace.products') }}</th>
                  <th class="text-center">{{ t('marketplace.quantity') }}</th>
                  <th class="text-end">{{ t('admin.quoteUnitPrice') }}</th>
                  <th class="text-end">{{ t('admin.quoteSubtotal') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(it, idx) in selectedOrder.items || []" :key="idx">
                  <td>
                    <strong>{{ localized(it.productNameEn, it.productNameAr) }}</strong>
                    <div class="text-xs text-muted">{{ it.productId }}</div>
                  </td>
                  <td class="text-center">{{ it.quantity }}</td>
                  <td class="text-end">{{ formatPrice(it.unitPrice || 0, selectedOrder.currencyCode || 'USD') }}</td>
                  <td class="text-end"><strong>{{ formatPrice((it.unitPrice || 0) * (it.quantity || 1), selectedOrder.currencyCode || 'USD') }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Total Summary -->
          <div class="order-summary-box mono">
            <span class="summary-lbl">{{ t('commerce.total') }}:</span>
            <strong class="summary-val">{{ formatPrice(selectedOrder.totalAmount, selectedOrder.currencyCode || 'USD') }}</strong>
          </div>

          <!-- Escalation Notice -->
          <div class="support-callout">
            <span class="material-symbols-outlined text-amber-600">help</span>
            <div class="callout-text">
              <span>{{ t('provider.supportDesc') }}</span>
              <router-link to="/provider/support" class="callout-link mono">{{ t('provider.contactAdmin') }} →</router-link>
            </div>
          </div>
        </div>
      </BaseModal>

      <!-- Update Order Status Modal -->
      <BaseModal v-model="showStatusModal" :title="t('common.edit')" size="md">
        <div v-if="targetOrder" class="status-modal-body">
          <div class="form-group">
            <label class="form-lbl mono">{{ t('commerce.status') }} *</label>
            <select v-model="newStatus" class="form-select mono">
              <option v-for="st in ORDER_STATUSES" :key="st" :value="st">{{ st }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-lbl mono">{{ t('commerce.trackingTitle') }}</label>
            <input
              v-model="trackingNumber"
              type="text"
              class="form-input mono"
              placeholder="e.g. DHL-9843248324"
            />
          </div>

          <div class="modal-actions">
            <BaseButton variant="ghost" @click="showStatusModal = false">{{ t('common.cancel') }}</BaseButton>
            <BaseButton variant="primary" :loading="updatingStatus" @click="submitStatusUpdate">
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>
    </div>
  </ProviderLayout>
</template>

<style scoped>
.provider-orders-view {
  width: 100%;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

.eyebrow {
  font-size: var(--step--1);
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.05em;
  display: block;
}

.view-title {
  font-family: var(--wl-font-display);
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--wl-ink-strong);
  margin: var(--space-1) 0;
}

.view-desc {
  font-size: var(--step-0);
  color: var(--wl-muted);
  max-width: 600px;
}

/* KPI Cards */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  width: 100%;
  font: inherit;
  color: inherit;
  text-align: start;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.kpi-card:hover {
  border-color: var(--wl-border-strong);
  transform: translateY(-1px);
}

.kpi-card:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.kpi-card.is-active {
  border-color: var(--wl-primary);
  box-shadow: 0 4px 12px rgba(var(--wl-gold-rgb), 0.14);
}

.kpi-icon-box {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
}

.bg-primary-soft { background: var(--wl-primary-soft); }
.bg-amber-soft { background: var(--wl-warning-soft); }
.bg-blue-soft { background: var(--wl-info-soft); }
.bg-emerald-soft { background: var(--wl-success-soft); }

.kpi-info {
  display: flex;
  flex-direction: column;
}

.kpi-label {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.kpi-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  font-variant-numeric: tabular-nums;
}

/* Filter Bar */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.search-input-wrap {
  position: relative;
  flex: 1;
  min-width: 260px;
}

.search-ic {
  position: absolute;
  inset-inline-start: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--wl-muted);
  font-size: 18px;
}

.search-input {
  width: 100%;
  height: 40px;
  padding-inline-start: 36px;
  padding-inline-end: var(--space-3);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.search-input:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.filter-select {
  height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step--1);
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.filter-select:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.search-input:focus-visible,
.filter-select:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 1px;
}

/* Table Card */
.table-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table-wrap {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--wl-border);
  text-align: start;
  vertical-align: middle;
}

.data-table th {
  background: var(--wl-surface-soft);
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.data-table th.num,
.data-table td.num {
  text-align: end;
}

.data-table tbody tr {
  transition: background 0.12s ease;
}

.data-table tbody tr:hover {
  background: var(--wl-surface-soft);
}

.order-id-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.order-num {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
}

.items-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  align-items: flex-start;
}

.items-count-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-muted);
}

.items-snippet {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.item-chip {
  font-size: 11px;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-xs);
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more-items {
  font-size: 11px;
  color: var(--wl-muted);
}

.total-fig {
  font-size: var(--step-0);
  color: var(--wl-primary);
  font-variant-numeric: tabular-nums;
}

/* Actions */
.action-btn-group {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  border: none;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.action-btn:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-status {
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  border: 1px solid var(--wl-border);
}
.btn-status:hover {
  background: var(--wl-primary);
  color: #fff;
}

.btn-view {
  background: var(--wl-surface-soft);
  color: var(--wl-muted);
  border: 1px solid var(--wl-border);
  padding: var(--space-2);
}
.btn-view:hover {
  color: var(--wl-ink-strong);
  border-color: var(--wl-border-strong);
}

.pagination-footer {
  padding: var(--space-4);
  display: flex;
  justify-content: center;
  border-top: 1px solid var(--wl-border);
}

/* Detail Modal */
.detail-modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--wl-surface-soft);
  border-radius: var(--radius-md);
}

.detail-grid .val {
  font-variant-numeric: tabular-nums;
}

.detail-item {
  display: flex;
  flex-direction: column;
}

.detail-item .lbl {
  font-size: 11px;
  color: var(--wl-muted);
}

.detail-item .val {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
}

.line-items-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.section-sub {
  font-size: var(--step--1);
  color: var(--wl-muted);
  text-transform: uppercase;
}

.line-items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--step--1);
}

.line-items-table th,
.line-items-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--wl-border);
}

.line-items-table th {
  background: var(--wl-surface-soft);
  color: var(--wl-muted);
}

.order-summary-box {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--wl-surface-soft);
  border-radius: var(--radius-md);
}

.summary-lbl {
  font-size: var(--step-0);
  color: var(--wl-muted);
}

.summary-val {
  font-size: 1.25rem;
  color: var(--wl-ink-strong);
}

.support-callout {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--wl-warning-soft);
  border: 1px solid rgba(var(--wl-warning-rgb), 0.35);
  border-radius: var(--radius-md);
  font-size: var(--step--1);
}

.callout-text {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
}

.callout-link {
  color: var(--wl-primary);
  font-weight: 700;
  text-decoration: none;
}
.callout-link:hover {
  text-decoration: underline;
}

/* Status Modal */
.status-modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-lbl {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
}

.form-select,
.form-input {
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  outline: none;
}

.form-select:focus,
.form-input:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

@media (max-width: 768px) {
  .view-header {
    flex-direction: column;
  }
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 640px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
  .action-btn-group {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
}

@media (prefers-reduced-motion: reduce) {
  .kpi-card,
  .action-btn,
  .data-table tbody tr {
    transition: none;
  }
  .kpi-card:hover {
    transform: none;
  }
}
</style>
