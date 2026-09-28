<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { salesService } from '../../di/container'
import AccountNav from '../../components/account/AccountNav.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import DataState from '../../components/ui/DataState.vue'
import BackButton from '../../components/ui/BackButton.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { QUOTE_STATUSES } from '../../domain/models/sales'
import { formatPrice } from '../../utils/format'

const router = useRouter()
const quotes = salesService.quotes

const searchQuery = ref('')
const statusFilter = ref('')
const localPage = ref(1)
const pageSize = 10

const pageLoading = ref(true)
const loadData = async () => {
  try {
    await salesService.loadQuotes({ pageNumber: 1, pageSize: 50 })
  } finally {
    pageLoading.value = false
  }
}

const filteredQuotes = computed(() => {
  const rawList = Array.isArray(quotes.value) ? quotes.value : []
  let list = rawList
  if (statusFilter.value) {
    list = list.filter((q) => q && String(q.status || '').toLowerCase() === String(statusFilter.value).toLowerCase())
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter((qt) => {
      if (!qt) return false
      const matchNum = qt.quoteNumber ? String(qt.quoteNumber).toLowerCase().includes(q) : false
      const matchId = qt.id ? String(qt.id).toLowerCase().includes(q) : false
      const matchRfq = qt.rfqNumber ? String(qt.rfqNumber).toLowerCase().includes(q) : false
      return matchNum || matchId || matchRfq
    })
  }
  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredQuotes.value.length / pageSize)))

const paginatedQuotes = computed(() => {
  const start = (localPage.value - 1) * pageSize
  return filteredQuotes.value.slice(start, start + pageSize)
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
  <div class="page-shell quote-list-view">
    <BackButton fallback="/account" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/account">{{ t('account.dashboard') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('sales.quoteTitle') }}</span>
    </nav>

    <!-- Executive Header -->
    <header class="page-header">
      <div>
        <div class="header-chip mono">
          <span class="pulse-dot"></span>
          <span>{{ t('account.quoteLedger', { count: filteredQuotes.length }) }}</span>
        </div>
        <h1 class="header-title">{{ t('sales.quoteTitle') }}</h1>
        <p class="header-subtitle">{{ t('sales.quoteSubtitle') }}</p>
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
          :placeholder="t('common.searchPlaceholder') + ' — ' + t('sales.quoteTitle')"
          @input="onSearch"
        />
        <button v-if="searchQuery" type="button" class="clear-btn" @click="searchQuery = ''; onSearch()">
          <span class="material-symbols-outlined text-[14px]">close</span>
        </button>
      </div>
      <select v-model="statusFilter" class="filter-select mono" @change="onSearch">
        <option value="">{{ t('common.all') }} {{ t('commerce.status') }}</option>
        <option v-for="s in QUOTE_STATUSES" :key="s" :value="s">{{ s }}</option>
      </select>
      <button v-if="searchQuery || statusFilter" type="button" class="clear-filters-btn mono" @click="clearFilters">
        <span class="material-symbols-outlined text-[14px]">filter_alt_off</span>
        {{ t('common.clearFilters') }}
      </button>
    </div>

    <DataState
      :loading="pageLoading || salesService.loading.value"
      :empty="!filteredQuotes.length && !pageLoading && !salesService.loading.value"
      :empty-title="searchQuery || statusFilter ? t('common.noResults') : t('sales.noQuotes')"
      :empty-description="searchQuery || statusFilter ? t('common.searchResults') : t('sales.noQuotesDesc')"
      :empty-variant="searchQuery || statusFilter ? 'search' : 'default'"
      :action-text="searchQuery || statusFilter ? t('common.clearFilters') : t('account.rfqs')"
      skeleton-type="table"
      :skeleton-count="6"
      min-height="320px"
      @action="searchQuery || statusFilter ? clearFilters() : router.push({ name: 'account-rfqs' })"
    >
      <div class="table-card">
        <div class="table-wrap">
          <table class="exec-table">
            <thead>
              <tr>
                <th>{{ t('sales.requestDate') }}</th>
                <th>{{ t('sales.quoteTitle') }}</th>
                <th>{{ t('sales.rfqTitle') }}</th>
                <th>{{ t('sales.validThrough') }}</th>
                <th>{{ t('sales.amount') }}</th>
                <th>{{ t('commerce.status') }}</th>
                <th class="text-end">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="q in paginatedQuotes"
                :key="q.id"
                class="exec-row"
                @click="router.push({ name: 'account-quote-detail', params: { id: q.id } })"
              >
                <td class="mono text-xs text-slate-500">{{ new Date(q.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</td>
                <td>
                  <strong class="mono quote-num">{{ q.quoteNumber }}</strong>
                </td>
                <td class="mono text-xs text-slate-600">{{ q.rfqNumber }}</td>
                <td class="mono text-xs text-slate-500">{{ new Date(q.validUntil).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</td>
                <td>
                  <strong class="mono amount-text">
                    {{ formatPrice(q.amount, locale) }} {{ q.currency || 'USD' }}
                  </strong>
                </td>
                <td>
                  <StatusPill :status="q.status" />
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
          :total-items="filteredQuotes.length"
          :page-size="pageSize"
          variant="table"
          @change="goPage"
        />
      </div>
    </DataState>
  </div>
</template>

<style scoped>
.quote-list-view {
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

.quote-num {
  font-size: 13px;
  color: var(--wl-ink-strong);
  font-weight: 700;
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
  border-radius: var(--radius-sm, 4px);
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
</style>





