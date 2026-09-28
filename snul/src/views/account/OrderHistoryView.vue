<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { commerceService } from '../../di/container'
import AccountNav from '../../components/account/AccountNav.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import DataState from '../../components/ui/DataState.vue'
import BackButton from '../../components/ui/BackButton.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { ORDER_STATUSES } from '../../domain/models/commerce'
import { formatPrice } from '../../utils/format'

const router = useRouter()
const orders = commerceService.orders

const searchQuery = ref('')
const statusFilter = ref('')
const localPage = ref(1)
const pageSize = 10

const pageLoading = ref(true)
const loadData = async () => {
  try {
    await commerceService.loadOrders({ page: 1, pageSize: 50 })
  } finally {
    pageLoading.value = false
  }
}

const filteredOrders = computed(() => {
  const rawList = Array.isArray(orders.value) ? orders.value : []
  let list = rawList
  if (statusFilter.value) {
    list = list.filter((o) => o && String(o.status || '').toLowerCase() === String(statusFilter.value).toLowerCase())
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter((o) => {
      if (!o) return false
      const matchNum = o.orderNumber ? String(o.orderNumber).toLowerCase().includes(q) : false
      const matchId = o.id ? String(o.id).toLowerCase().includes(q) : false
      const matchItems = Array.isArray(o.items) && o.items.some((it) => {
        if (!it) return false
        const en = it.productNameEn ? String(it.productNameEn).toLowerCase().includes(q) : false
        const ar = it.productNameAr ? String(it.productNameAr).toLowerCase().includes(q) : false
        const pid = it.productId ? String(it.productId).toLowerCase().includes(q) : false
        return en || ar || pid
      })
      return matchNum || matchId || matchItems
    })
  }
  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredOrders.value.length / pageSize)))

const paginatedOrders = computed(() => {
  const start = (localPage.value - 1) * pageSize
  return filteredOrders.value.slice(start, start + pageSize)
})

const onSearch = () => {
  localPage.value = 1
}

const clearFilters = () => {
  searchQuery.value = ''
  statusFilter.value = ''
  localPage.value = 1
}

const goPage = (p: number) => {
  if (p < 1 || p > totalPages.value) return
  localPage.value = p
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="page-shell order-history-view">
    <BackButton fallback="/account" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/account">{{ t('account.dashboard') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('commerce.ordersTitle') }}</span>
    </nav>

    <!-- Executive Header -->
    <header class="page-header">
      <div>
        <div class="header-chip mono">
          <span class="pulse-dot"></span>
          <span>{{ t('account.ordersLedger', { count: filteredOrders.length }) }}</span>
        </div>
        <h1 class="header-title">{{ t('commerce.ordersTitle') }}</h1>
        <p class="header-subtitle">{{ t('commerce.ordersSubtitle') }}</p>
      </div>
    </header>

    <AccountNav />

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
      <button v-if="searchQuery || statusFilter" type="button" class="clear-filters-btn mono" @click="clearFilters">
        <span class="material-symbols-outlined text-[14px]">filter_alt_off</span>
        {{ t('common.clearFilters') }}
      </button>
    </div>

    <!-- Table or DataState -->
    <DataState
      :loading="pageLoading || commerceService.loading.value"
      :empty="!filteredOrders.length && !pageLoading && !commerceService.loading.value"
      :empty-title="searchQuery || statusFilter ? t('common.noResults') : t('commerce.noOrders')"
      :empty-description="searchQuery || statusFilter ? t('common.searchResults') : t('commerce.noOrdersDesc')"
      :empty-variant="searchQuery || statusFilter ? 'search' : 'default'"
      :action-text="searchQuery || statusFilter ? t('common.clearFilters') : t('nav.marketplace')"
      skeleton-type="table"
      :skeleton-count="6"
      min-height="320px"
      @action="searchQuery || statusFilter ? clearFilters() : router.push({ name: 'marketplace' })"
    >
      <div class="table-card">
        <div class="table-wrap">
          <table class="exec-table">
            <thead>
              <tr>
                <th>{{ t('commerce.orderNumber') }}</th>
                <th>{{ t('commerce.placed') }}</th>
                <th>{{ t('marketplace.products') }}</th>
                <th>{{ t('commerce.total') }}</th>
                <th>{{ t('commerce.status') }}</th>
                <th class="text-end">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="o in paginatedOrders"
                :key="o.id"
                class="exec-row"
                @click="router.push({ name: 'account-order-detail', params: { id: o.id } })"
              >
                <td>
                  <strong class="mono order-num">{{ o.orderNumber || '—' }}</strong>
                </td>
                <td class="mono text-xs text-slate-500">{{ new Date(o.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</td>
                <td>
                  <div class="product-names-cell">
                    <span
                      v-for="(item, idx) in (o.items ?? []).slice(0, 2)"
                      :key="item?.id || idx"
                      class="product-name-pill"
                    >
                      {{ locale === 'ar' ? (item?.productNameAr || item?.productNameEn || '—') : (item?.productNameEn || item?.productNameAr || '—') }}
                      <span v-if="item && item.quantity > 1" class="qty-tag">×{{ item.quantity }}</span>
                    </span>
                    <span v-if="(o.items ?? []).length > 2" class="more-badge mono">+{{ (o.items ?? []).length - 2 }} {{ t('common.more') }}</span>
                  </div>
                </td>
                <td>
                  <strong class="mono amount-text">
                    {{ formatPrice(o.totalAmount, locale) }} {{ o.currencyCode }}
                  </strong>
                </td>
                <td>
                  <StatusPill :status="o.status" />
                </td>
                <td class="text-end">
                  <span class="row-link mono">
                    <span>{{ t('marketplace.viewDetails') }}</span>
                    <span class="icon--directional text-[14px]">→</span>
                  </span>
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
  </div>
</template>

<style scoped>
.order-history-view {
  width: 100%;
}

.crumb-bar {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 11px;
  color: var(--wl-muted);
}

.crumb-bar a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.crumb-bar a:hover {
  color: var(--wl-primary);
}

.crumb-sep {
  color: var(--wl-muted-soft);
}

.crumb-active {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.header-chip {
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

.header-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: 1.68rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.1;
}

.header-subtitle {
  font-size: 13.5px;
  color: var(--wl-muted);
  margin: 0.25rem 0 0;
}

/* Table Card */
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
  cursor: pointer;
  transition: background 0.15s ease;
}

.exec-row:hover {
  background: var(--wl-surface-soft);
}

.exec-row:hover .row-link {
  color: var(--wl-primary);
  transform: translateX(2px);
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

.items-badge {
  font-size: 11px;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
}

.amount-text {
  font-size: 13.5px;
  color: var(--wl-ink-strong);
}

.row-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-muted-soft);
  transition: all 0.15s ease;
}

.text-end {
  text-align: end;
}

/* ── Search & Filter Bar ── */
.search-filter-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
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

.clear-btn:hover { color: var(--wl-primary); }

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
  border: 1px solid var(--color-danger-100, #FFDAD6);
  border-radius: var(--radius-sm, 4px);
  font-size: 12px;
  font-weight: 700;
  color: var(--wl-danger);
  background: var(--wl-danger-soft);
  cursor: pointer;
  transition: all 0.15s;
}

.clear-filters-btn:hover { background: rgba(242, 109, 109, 0.22); }

/* ── Product Names Cell ── */
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
</style>





