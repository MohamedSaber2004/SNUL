<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import { commerceService, companyRepository } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t, locale } from '../../i18n'
import type { OrderDto } from '../../domain/models/commerce'
import { ORDER_STATUSES } from '../../domain/models/commerce'
import type { CompanyDto } from '../../domain/models/company'
import { formatPrice } from '../../utils/format'

const orders = commerceService.orders
const loading = ref(true)
const fetchError = ref('')
const acting = ref('')
const searchQuery = ref('')
const statusFilter = ref('')
const providerFilter = ref('')
const localPage = ref(1)
const pageSize = 10

const providersList = ref<CompanyDto[]>([])

const NEXT: Record<string, string> = {
  Pending: 'Confirmed',
  Confirmed: 'Shipped',
  Shipped: 'Delivered',
}

async function fetchProviders() {
  try {
    const res = await companyRepository.getProvidersDirectory({ pageSize: 50 }).catch(() => null)
    const list = Array.isArray(res?.data) ? res.data : []
    const allComps = await companyRepository.getCompanies({ pageSize: 50 }).catch(() => null)
    const compList = Array.isArray(allComps?.data) ? allComps.data : []
    const map = new Map<string, CompanyDto>()
    for (const c of [...list, ...compList]) {
      if (c && c.id) map.set(c.id, c)
    }
    providersList.value = Array.from(map.values())
  } catch {
    // Non-blocking
  }
}

const providerMap = computed(() => {
  const map = new Map<string, CompanyDto>()
  for (const p of providersList.value) {
    if (p?.id) map.set(p.id, p)
  }
  return map
})

function getOrderProviderId(o: OrderDto | null): string | null {
  if (!o) return null
  if (o.companyId) return o.companyId
  const anyO = o as unknown as Record<string, unknown>
  if (anyO.providerId) return String(anyO.providerId)
  if (Array.isArray(o.items)) {
    for (const it of o.items) {
      const anyIt = it as unknown as Record<string, unknown>
      if (anyIt.companyId) return String(anyIt.companyId)
      if (anyIt.providerId) return String(anyIt.providerId)
    }
  }
  return null
}

function getOrderProviderName(o: OrderDto | null): string {
  if (!o) return ''
  const anyO = o as unknown as Record<string, unknown>
  if (anyO.providerName) return String(anyO.providerName)
  if (anyO.companyName) return String(anyO.companyName)
  const pid = getOrderProviderId(o)
  if (pid && providerMap.value.has(pid)) {
    const comp = providerMap.value.get(pid)!
    return comp.name
  }
  if (Array.isArray(o.items)) {
    for (const it of o.items) {
      const anyIt = it as unknown as Record<string, unknown>
      if (anyIt.providerName) return String(anyIt.providerName)
      if (anyIt.companyName) return String(anyIt.companyName)
    }
  }
  return ''
}

const providerOptions = computed(() => {
  const map = new Map<string, { id: string; name: string }>()
  for (const p of providersList.value) {
    if (p?.id && p?.name) {
      map.set(p.id, { id: p.id, name: p.name })
    }
  }
  for (const o of orders.value) {
    const pid = getOrderProviderId(o)
    const pname = getOrderProviderName(o)
    if (pid && pname && !map.has(pid)) {
      map.set(pid, { id: pid, name: pname })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
})

async function fetchOrders() {
  loading.value = true
  fetchError.value = ''
  try {
    await commerceService.loadOrders({ page: 1, pageSize: 50, companyId: providerFilter.value || undefined })
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

const filteredOrders = computed(() => {
  const rawList = Array.isArray(orders.value) ? orders.value : []
  let list = rawList
  if (statusFilter.value) {
    list = list.filter((o) => o && String(o.status || '').toLowerCase() === String(statusFilter.value).toLowerCase())
  }
  if (providerFilter.value) {
    const pf = providerFilter.value.toLowerCase()
    list = list.filter((o) => {
      const pid = getOrderProviderId(o)?.toLowerCase()
      const pname = getOrderProviderName(o).toLowerCase()
      return pid === pf || pname.includes(pf)
    })
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter((o) => {
      if (!o) return false
      const matchNum = o.orderNumber ? String(o.orderNumber).toLowerCase().includes(q) : false
      const matchId = o.id ? String(o.id).toLowerCase().includes(q) : false
      const matchProvider = getOrderProviderName(o).toLowerCase().includes(q)
      const matchItems = Array.isArray(o.items) && o.items.some((it) => {
        if (!it) return false
        const en = it.productNameEn ? String(it.productNameEn).toLowerCase().includes(q) : false
        const ar = it.productNameAr ? String(it.productNameAr).toLowerCase().includes(q) : false
        const pid = it.productId ? String(it.productId).toLowerCase().includes(q) : false
        return en || ar || pid
      })
      return matchNum || matchId || matchProvider || matchItems
    })
  }
  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredOrders.value.length / pageSize)))

const paginatedOrders = computed(() => {
  const start = (localPage.value - 1) * pageSize
  return filteredOrders.value.slice(start, start + pageSize)
})

function onSearch() {
  localPage.value = 1
}

function clearFilters() {
  searchQuery.value = ''
  statusFilter.value = ''
  providerFilter.value = ''
  localPage.value = 1
}

onMounted(async () => {
  await Promise.all([fetchOrders(), fetchProviders()])
})

async function advance(o: OrderDto) {
  const next = NEXT[o.status]
  if (!next) return
  acting.value = o.id
  try {
    const res = await commerceService.updateOrderStatus(o.id, next)
    if (res.ok) {
      await fetchOrders()
      const fresh = commerceService.orders.value.find((x) => x.id === o.id) ?? null
      if (fresh && selectedOrder.value?.id === o.id) selectedOrder.value = fresh
    } else if (res.error) {
      toastService.error(res.error)
    }
  } finally {
    acting.value = ''
  }
}

// --- Order details modal ---
const showDetailsModal = ref(false)
const selectedOrder = ref<OrderDto | null>(null)
const detailsLoading = ref(false)

async function openDetails(o: OrderDto) {
  selectedOrder.value = o
  showDetailsModal.value = true
  detailsLoading.value = true
  try {
    const fresh = await commerceService.getOrder(o.id)
    if (fresh) selectedOrder.value = fresh
  } finally {
    detailsLoading.value = false
  }
}

function closeDetails() {
  showDetailsModal.value = false
  selectedOrder.value = null
}

const detailsSubtotal = (order: OrderDto): number =>
  (order.items ?? []).reduce((s, it) => s + (it?.quantity ?? 0) * (it?.unitPrice ?? 0), 0)

function goPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  localPage.value = p
}
</script>

<template>
  <AdminLayout>
    <div class="orders-admin-view">
      <!-- Executive Header -->
      <header class="orders-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.ordersEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('admin.orders') }}</h1>
          <p class="head-subtitle">{{ t('admin.ordersDesc') }}</p>
        </div>

        <div class="head-actions">
          <span class="mono count-badge">{{ t('admin.consignmentsTracked', { count: filteredOrders.length }) }}</span>
        </div>
      </header>

      <!-- Search & Filter Bar -->
      <div class="search-filter-bar">
        <div class="search-wrap">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            v-model="searchQuery"
            type="text"
            class="search-input mono"
            :placeholder="t('common.searchPlaceholder') + ' — ' + t('commerce.orderNumber')"
            @input="onSearch"
          />
          <button v-if="searchQuery" type="button" class="clear-btn" @click="searchQuery = ''; onSearch()">
            <span class="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
        <select v-model="statusFilter" class="filter-select mono" @change="onSearch">
          <option value="">{{ t('common.all') }} {{ t('commerce.status') }}</option>
          <option v-for="s in ORDER_STATUSES" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-model="providerFilter" class="filter-select mono" @change="onSearch">
          <option value="">{{ t('common.all') }} {{ t('nav.providers') }}</option>
          <option v-for="p in providerOptions" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
        <button v-if="searchQuery || statusFilter || providerFilter" type="button" class="clear-filters-btn mono" @click="clearFilters">
          <span class="material-symbols-outlined text-[14px]">filter_alt_off</span>
          {{ t('common.clearFilters') }}
        </button>
      </div>

      <!-- Executive Table / DataState -->
      <DataState
        :loading="loading && !orders.length"
        :error="fetchError && !orders.length ? fetchError : null"
        :empty="!filteredOrders.length && !loading && !fetchError"
        :empty-title="searchQuery || statusFilter || providerFilter ? t('common.noResults') : t('admin.noOrdersYet')"
        :empty-description="searchQuery || statusFilter || providerFilter ? t('common.searchResults') : t('commerce.noOrdersDesc')"
        :empty-variant="searchQuery || statusFilter || providerFilter ? 'search' : 'default'"
        skeleton-type="table"
        :skeleton-count="6"
        min-height="320px"
        @retry="fetchOrders"
      >
        <div class="table-card">
          <div class="table-wrap">
            <table class="exec-table">
              <thead>
                <tr>
                  <th>{{ t('commerce.orderNumber') }}</th>
                  <th>{{ t('commerce.placed') }}</th>
                  <th>{{ t('nav.providers') }}</th>
                  <th>{{ t('commerce.total') }}</th>
                  <th>{{ t('commerce.status') }}</th>
                  <th class="text-end">{{ t('admin.viewDetails') }}</th>
                  <th class="text-end">{{ t('admin.quickActions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="o in paginatedOrders" :key="o.id" class="exec-row">
                  <td>
                    <strong class="mono order-num">{{ o.orderNumber || '—' }}</strong>
                  </td>
                  <td class="mono text-xs text-slate-500">{{ new Date(o.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</td>
                  <td>
                    <div v-if="getOrderProviderName(o)" class="provider-cell">
                      <span class="material-symbols-outlined text-[15px] text-teal-600">storefront</span>
                      <strong class="mono text-xs text-slate-800">{{ getOrderProviderName(o) }}</strong>
                    </div>
                    <span v-else class="mono text-xs text-muted">—</span>
                  </td>
                  <td>
                    <strong class="mono amount-num">
                      {{ formatPrice(o.totalAmount, locale) }} {{ o.currencyCode }}
                    </strong>
                  </td>
                  <td>
                    <StatusPill :status="o.status" />
                  </td>
                  <td class="text-end">
                    <button
                      type="button"
                      class="row-action-btn"
                      :title="t('admin.viewDetails')"
                      :aria-label="t('admin.viewDetails')"
                      @click="openDetails(o)"
                    >
                      <span class="material-symbols-outlined text-[18px]">visibility</span>
                    </button>
                  </td>
                  <td class="text-end">
                    <button
                      v-if="NEXT[o.status]"
                      type="button"
                      class="btn-advance mono"
                      :disabled="acting === o.id"
                      @click="advance(o)"
                    >
                      <span class="material-symbols-outlined text-[15px] icon--directional">arrow_forward</span>
                      <span>{{ t('commerce.markAs', { status: NEXT[o.status] as string }) }}</span>
                    </button>
                    <span v-else class="mono text-xs text-slate-400">{{ t('admin.orderCompleted') }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <AppPagination
            :page="localPage"
            :total-pages="totalPages"
            :total-items="filteredOrders.length"
            :page-size="pageSize"
            variant="table"
            @change="goPage"
          />
        </div>
      </DataState>

      <!-- Order Details Modal -->
      <BaseModal
        v-model="showDetailsModal"
        :title="selectedOrder ? `${t('commerce.orderNumber')} ${selectedOrder.orderNumber || '—'}` : t('admin.orderDetails')"
        max-width="720px"
        @close="closeDetails"
      >
        <div v-if="detailsLoading && !selectedOrder" class="details-loading">
          {{ t('common.loading') }}
        </div>
        <div v-else-if="selectedOrder" class="order-details">
          <div class="order-status-bar">
            <StatusPill :status="selectedOrder.status" />
            <span class="mono order-date">{{
              new Date(selectedOrder.createdAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')
            }}</span>
            <BaseButton
              v-if="NEXT[selectedOrder.status]"
              variant="primary"
              size="sm"
              :loading="acting === selectedOrder.id"
              @click="advance(selectedOrder)"
            >
              <span class="material-symbols-outlined text-[16px] icon--directional">arrow_forward</span>
              <span>{{ t('commerce.markAs', { status: NEXT[selectedOrder.status] as string }) }}</span>
            </BaseButton>
          </div>

          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k mono">{{ t('commerce.orderNumber') }}</span>
              <strong class="detail-v mono">{{ selectedOrder.orderNumber || '—' }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('commerce.status') }}</span>
              <strong class="detail-v">{{ selectedOrder.status }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('commerce.total') }}</span>
              <strong class="detail-v mono"
                >{{ formatPrice(selectedOrder.totalAmount, locale) }}
                {{ selectedOrder.currencyCode }}</strong
              >
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('nav.providers') }}</span>
              <strong class="detail-v mono">{{ getOrderProviderName(selectedOrder) || '—' }}</strong>
            </div>
          </div>

          <div class="items-wrap">
            <table class="modal-items-table">
              <thead>
                <tr>
                  <th>{{ t('admin.quoteProduct') }}</th>
                  <th class="text-end">{{ t('marketplace.quantity') }}</th>
                  <th class="text-end">{{ t('admin.quoteUnitPrice') }}</th>
                  <th class="text-end">{{ t('admin.quoteSubtotal') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="it in selectedOrder.items ?? []" :key="it?.id || it?.productId">
                  <td>{{ locale === 'ar' ? (it?.productNameAr || it?.productNameEn) : (it?.productNameEn || it?.productNameAr) }}</td>
                  <td class="text-end mono">{{ it?.quantity ?? 0 }}</td>
                  <td class="text-end mono">{{ formatPrice(it?.unitPrice ?? 0, locale) }}</td>
                  <td class="text-end mono">{{ Math.ceil((it?.quantity ?? 0) * (it?.unitPrice ?? 0)).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="order-total-bar">
            <span class="mono total-label">{{ t('commerce.total') }}</span>
            <strong class="mono total-value"
              >{{ Math.ceil(detailsSubtotal(selectedOrder)).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}
              {{ selectedOrder.currencyCode }}</strong
            >
          </div>

          <div class="modal-foot">
            <BaseButton variant="secondary" @click="closeDetails">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>
    </div>
  </AdminLayout>
</template>

<style scoped>
.orders-admin-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Search & Filter Bar ── */
.search-filter-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 200px;
  max-width: 420px;
}

.search-icon {
  position: absolute;
  inset-inline-start: 0.75rem;
  font-size: 18px;
  color: var(--wl-muted-soft);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 38px;
  padding: 0 2.2rem 0 2.5rem;
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  font-size: 12.5px;
  color: var(--wl-ink-strong);
  background: var(--wl-surface-soft);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.search-input:focus {
  border-color: var(--border-focus);
  box-shadow: var(--ring-focus);
  background: var(--bg-surface);
}

.clear-btn {
  position: absolute;
  inset-inline-end: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--wl-muted-soft);
  display: flex;
  align-items: center;
  padding: 0.2rem;
  border-radius: 4px;
}

.clear-btn:hover { color: var(--brand); }

.filter-select {
  height: 38px;
  padding: 0 0.85rem;
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  font-size: 12.5px;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}

.filter-select:focus { border-color: var(--border-focus); box-shadow: var(--ring-focus); }

.clear-filters-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  height: 38px;
  padding: 0 0.85rem;
  border: 1px solid var(--border-danger, #FFDAD6);
  border-radius: var(--radius-sm, 4px);
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-danger, #DC3545);
  background: var(--color-danger-50, #FFF8F7);
  cursor: pointer;
  transition: all 0.15s;
}

.clear-filters-btn:hover { background: var(--color-danger-100, #FFDAD6); }

.orders-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  letter-spacing: 0.06em;
  margin-bottom: 0.5rem;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-primary);
}

.head-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: 1.68rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.1;
}

.head-subtitle {
  font-size: 13.5px;
  color: var(--wl-muted);
  margin: 0.25rem 0 0;
}

.count-badge {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
}

/* Executive Table */
.table-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-xs);
}

.table-wrap {
  overflow-x: auto;
}

.exec-table {
  width: 100%;
  border-collapse: collapse;
  text-align: start;
}

.exec-table thead th {
  background: var(--wl-surface-soft);
  border-bottom: 1px solid var(--wl-border);
  padding: 0.85rem 1.25rem;
  font-family: var(--wl-font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.exec-row {
  height: 52px;
  border-bottom: 1px solid var(--wl-border);
  transition: background 0.15s ease;
}

.exec-row:hover {
  background: var(--wl-surface-soft);
}

.exec-row td {
  padding: 0.65rem 1.25rem;
  vertical-align: middle;
}

.order-num {
  font-size: 13px;
  color: var(--wl-ink-strong);
  font-weight: 700;
}

.items-pill {
  font-size: 11px;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
}

.product-names-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-width: 240px;
}

.product-name-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 12px;
  font-weight: 600;
  color: var(--wl-ink);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qty-tag {
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
}

.more-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  align-self: flex-start;
}

.amount-num {
  font-size: 13.5px;
  color: var(--wl-ink-strong);
}

.incoterm-tag {
  font-size: 10.5px;
  font-weight: 800;
  color: var(--wl-info);
  background: var(--wl-info-soft);
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
}

.btn-advance {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  color: var(--wl-primary);
  border-radius: 8px;
  padding: 0.35rem 0.75rem;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-advance:hover:not(:disabled) {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
}

.btn-advance:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.text-end {
  text-align: end;
}

.row-actions {
  display: flex;
  gap: 0.4rem;
  justify-content: flex-end;
  align-items: center;
}

.row-action-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  color: var(--wl-muted);
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.row-action-btn:hover {
  color: var(--wl-primary);
  border-color: var(--wl-primary);
}

.details-loading {
  padding: 2rem;
  text-align: center;
  color: var(--wl-muted);
}

.order-details {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.order-status-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 10px;
}

.order-date {
  font-size: 11.5px;
  color: var(--wl-muted);
  margin-inline-start: auto;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  background: var(--wl-surface-soft);
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--wl-border);
}

.detail-k {
  font-size: 10px;
  color: var(--wl-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-v {
  font-size: 0.85rem;
  color: var(--wl-ink-strong);
}

.items-wrap {
  overflow-x: auto;
  border: 1px solid var(--wl-border);
  border-radius: 10px;
}

.modal-items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.modal-items-table thead th {
  background: var(--wl-surface-soft);
  border-bottom: 1px solid var(--wl-border);
  padding: 0.6rem 0.9rem;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--wl-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: start;
}

.modal-items-table tbody td {
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid var(--wl-border);
  color: var(--wl-ink-strong);
}

.modal-items-table tbody tr:last-child td {
  border-bottom: none;
}

.order-total-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  border-radius: 10px;
}

.total-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.total-value {
  font-size: 1rem;
  color: var(--wl-ink-strong);
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.25rem;
}

/* ── Head Actions ── */
.head-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.provider-cell {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--slate-50, #f8fafc);
  padding: 0.25rem 0.55rem;
  border-radius: 6px;
  border: 1px solid var(--slate-200, #e2e8f0);
}
</style>





