<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { authService, salesService } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { t, locale } from '../../i18n'
import type { QuoteDto, RfqDto } from '../../domain/models/sales'
import { RFQ_STATUSES, QUOTE_STATUSES } from '../../domain/models/sales'
import { formatPrice } from '../../utils/format'
import { parseNegotiationNote } from '../../utils/negotiation'

const route = useRoute()
const router = useRouter()

const rfqs = salesService.rfqs
const quotes = salesService.quotes
const rfqTotalCount = salesService.rfqTotalCount
const loading = ref(true)
const fetchError = ref('')

// Tab Switcher state
const activeTab = ref<'rfqs' | 'quotes'>((route.query.tab as 'rfqs' | 'quotes') || 'rfqs')
const setTab = (tab: 'rfqs' | 'quotes') => {
  activeTab.value = tab
  void router.replace({ query: { ...route.query, tab } })
}

// Quote Creation Modal
const showQuoteForm = ref(false)
const targetRfq = ref<RfqDto | null>(null)
const quoteForm = ref<{ lines: { productId: string; productName: string; quantity: number; unitPrice: number }[]; validUntil: string }>({
  lines: [],
  validUntil: '',
})
const formLoading = ref(false)
const formError = ref('')

// Quote Details Modal & Action State
const selectedQuote = ref<QuoteDto | null>(null)
const showQuoteDetailModal = ref(false)
const quoteActionLoading = ref(false)

const pipelineStages = computed(() => {
  const all = rfqs.value
  const pending = all.filter((r) => r.status === 'Pending').length
  const quoted = all.filter((r) => r.status === 'Quoted').length
  const ordered = all.filter((r) => r.status === 'Ordered').length
  const cancelled = all.filter((r) => r.status === 'Cancelled').length
  const total = all.length || 1

  return [
    { label: t('account.pipeStatusPending'), count: pending, pct: Math.round((pending / total) * 100), color: 'var(--wl-warning)', icon: 'hourglass_top' },
    { label: t('admin.pipeQuoted'), count: quoted, pct: Math.round((quoted / total) * 100), color: 'var(--wl-primary)', icon: 'description' },
    { label: t('admin.pipeOrdered'), count: ordered, pct: Math.round((ordered / total) * 100), color: 'var(--wl-success)', icon: 'verified' },
    { label: `${t('admin.pipeArchived')} / ${t('admin.pipeOther')}`, count: cancelled, pct: Math.round((cancelled / total) * 100), color: 'var(--wl-muted)', icon: 'inventory' },
  ]
})

// RFQ Filters & Search (Local)
const rfqSearch = ref('')
const rfqStatusFilter = ref('')
const rfqLocalPage = ref(1)
const rfqPageSize = 10

const filteredRfqs = computed(() => {
  const rawList = Array.isArray(rfqs.value) ? rfqs.value : []
  let list = rawList
  if (rfqStatusFilter.value) {
    list = list.filter((r) => r && String(r.status || '').toLowerCase() === String(rfqStatusFilter.value).toLowerCase())
  }
  if (rfqSearch.value.trim()) {
    const q = rfqSearch.value.trim().toLowerCase()
    list = list.filter((r) => {
      if (!r) return false
      const matchNum = r.rfqNumber ? String(r.rfqNumber).toLowerCase().includes(q) : false
      const matchId = r.id ? String(r.id).toLowerCase().includes(q) : false
      const matchComp = r.companyName ? String(r.companyName).toLowerCase().includes(q) : false
      const matchNote = r.note ? String(r.note).toLowerCase().includes(q) : false
      const matchItems = Array.isArray(r.items) && r.items.some((it) => {
        if (!it) return false
        const en = it.productNameEn ? String(it.productNameEn).toLowerCase().includes(q) : false
        const ar = it.productNameAr ? String(it.productNameAr).toLowerCase().includes(q) : false
        const pid = it.productId ? String(it.productId).toLowerCase().includes(q) : false
        return en || ar || pid
      })
      return matchNum || matchId || matchComp || matchNote || matchItems
    })
  }
  return list
})

const rfqTotalPages = computed(() => Math.max(1, Math.ceil(filteredRfqs.value.length / rfqPageSize)))
const paginatedRfqs = computed(() => {
  const start = (rfqLocalPage.value - 1) * rfqPageSize
  return filteredRfqs.value.slice(start, start + rfqPageSize)
})

const onRfqSearch = () => {
  rfqLocalPage.value = 1
}

const clearRfqFilters = () => {
  rfqSearch.value = ''
  rfqStatusFilter.value = ''
  rfqLocalPage.value = 1
}

const goRfqPage = (p: number) => {
  if (p < 1 || p > rfqTotalPages.value) return
  rfqLocalPage.value = p
}

// Quotes Filters & Search (Local)
const quoteSearch = ref('')
const quoteStatusFilter = ref('')
const quoteLocalPage = ref(1)
const quotePageSize = 10

const filteredQuotes = computed(() => {
  const rawList = Array.isArray(quotes.value) ? quotes.value : []
  let list = rawList
  if (quoteStatusFilter.value) {
    list = list.filter((q) => q && String(q.status || '').toLowerCase() === String(quoteStatusFilter.value).toLowerCase())
  }
  if (quoteSearch.value.trim()) {
    const q = quoteSearch.value.trim().toLowerCase()
    list = list.filter((qt) => {
      if (!qt) return false
      const matchNum = qt.quoteNumber ? String(qt.quoteNumber).toLowerCase().includes(q) : false
      const matchId = qt.id ? String(qt.id).toLowerCase().includes(q) : false
      const matchRfq = qt.rfqNumber ? String(qt.rfqNumber).toLowerCase().includes(q) : false
      const rfq = getRfqForQuote(qt)
      const matchComp = rfq?.companyName ? String(rfq.companyName).toLowerCase().includes(q) : false
      return matchNum || matchId || matchRfq || matchComp
    })
  }
  return list
})

const quoteTotalPages = computed(() => Math.max(1, Math.ceil(filteredQuotes.value.length / quotePageSize)))
const paginatedQuotes = computed(() => {
  const start = (quoteLocalPage.value - 1) * quotePageSize
  return filteredQuotes.value.slice(start, start + quotePageSize)
})

const onQuoteSearch = () => {
  quoteLocalPage.value = 1
}

const clearQuoteFilters = () => {
  quoteSearch.value = ''
  quoteStatusFilter.value = ''
  quoteLocalPage.value = 1
}

const goQuotePage = (p: number) => {
  if (p < 1 || p > quoteTotalPages.value) return
  quoteLocalPage.value = p
}

onMounted(async () => {
  if (authService.isAdmin.value) {
    void router.replace('/admin')
    return
  }
  loading.value = true
  fetchError.value = ''
  try {
    await salesService.loadAll()
    if (route.query.quoteId) {
      const target = quotes.value.find((q) => q.id === route.query.quoteId)
      if (target) {
        viewQuoteDetail(target)
        activeTab.value = 'quotes'
      }
    }
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
})

watch(() => route.query.tab, (newTab) => {
  if (newTab === 'quotes' || newTab === 'rfqs') {
    activeTab.value = newTab
  }
})

const quoteAmount = computed(() => quoteForm.value.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0))

function openQuote(r: RfqDto) {
  targetRfq.value = r
  quoteForm.value = {
    lines: r.items.map((it) => ({
      productId: it.productId,
      productName: it.productNameEn,
      quantity: it.quantity,
      unitPrice: it.unitPrice ?? 0,
    })),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  }
  formError.value = ''
  showQuoteForm.value = true
}

async function submitQuote() {
  if (!targetRfq.value) return
  if (quoteForm.value.lines.some((l) => l.unitPrice <= 0)) {
    formError.value = t('common.error')
    return
  }
  formLoading.value = true
  formError.value = ''
  try {
    const res = await salesService.createQuote({
      rfqId: targetRfq.value.id,
      amount: quoteAmount.value,
      validUntil: new Date(quoteForm.value.validUntil).toISOString(),
      items: quoteForm.value.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice })),
    })
    if (res.ok) {
      toastService.success(t('sales.quoteCreated'))
      showQuoteForm.value = false
      activeTab.value = 'quotes'
      if (res.quoteId) {
        const created = quotes.value.find((q) => q.id === res.quoteId)
        if (created) viewQuoteDetail(created)
      }
    } else {
      formError.value = res.error
    }
  } finally {
    formLoading.value = false
  }
}

function getLinkedQuote(rfqId: string): QuoteDto | undefined {
  return quotes.value.find((q) => q.rfqId === rfqId)
}

function getRfqForQuote(q: QuoteDto): RfqDto | undefined {
  return rfqs.value.find((r) => r.id === q.rfqId || (q.rfqNumber && r.rfqNumber === q.rfqNumber))
}

const quoteDetailsLoading = ref(false)

async function viewQuoteDetail(q: QuoteDto) {
  selectedQuote.value = q
  showQuoteDetailModal.value = true
  // List payloads omit line items — fetch the full quote so the items
  // table fills in (same pattern as the orders details modal).
  quoteDetailsLoading.value = true
  try {
    const fresh = await salesService.getQuote(q.id)
    if (fresh && selectedQuote.value?.id === q.id) selectedQuote.value = fresh
  } finally {
    quoteDetailsLoading.value = false
  }
}

function viewLinkedQuoteForRfq(rfqId: string) {
  const linked = getLinkedQuote(rfqId)
  if (linked) {
    viewQuoteDetail(linked)
  }
}

async function handleQuoteDecision(quoteId: string, approve: boolean) {
  const ok = await confirmService.confirm({
    title: t(approve ? 'admin.approveOnBehalf' : 'sales.decline'),
    message: t(approve ? 'admin.approveOnBehalfConfirm' : 'sales.declineConfirm'),
    variant: approve ? 'primary' : 'danger',
    confirmText: t(approve ? 'sales.approve' : 'sales.decline'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return
  quoteActionLoading.value = true
  try {
    const res = approve
      ? await salesService.approveQuote(quoteId)
      : await salesService.declineQuote(quoteId)
    if (res.ok) {
      if (selectedQuote.value && selectedQuote.value.id === quoteId) {
        const fresh = await salesService.getQuote(quoteId)
        if (fresh) selectedQuote.value = fresh
      }
    }
  } finally {
    quoteActionLoading.value = false
  }
}
</script>

<template>
  <AdminLayout>
    <div class="sales-admin-view">
      <!-- Executive Header -->
      <header class="sales-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.salesEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('admin.sales') }}</h1>
          <p class="head-subtitle">{{ t('admin.salesDesc') }}</p>
        </div>

        <span class="mono count-badge">{{ rfqTotalCount }} {{ t('admin.inquiriesInPipeline') }}</span>
      </header>

      <!-- RFQ Pipeline Conversion Funnel -->
      <div v-if="rfqs.length" class="pipeline-card">
        <div class="pipeline-header">
          <div>
            <div class="pipeline-eyebrow mono">
              <span class="pulse-dot"></span>
              <span>{{ t('admin.commercialVelocity') }}</span>
            </div>
            <h2 class="pipeline-title">{{ t('admin.conversionPipeline') }}</h2>
          </div>
          <span class="mono pipeline-counter">{{ rfqs.length }} {{ t('admin.activeInquiries') }}</span>
        </div>

        <div class="pipeline-grid">
          <div
            v-for="step in pipelineStages"
            :key="step.label"
            class="pipeline-cell"
            :class="{ 'is-active': step.count > 0 }"
          >
            <div class="step-top">
              <span class="material-symbols-outlined step-glyph" :style="{ color: step.color }">{{ step.icon }}</span>
              <span class="step-label mono">{{ step.label }}</span>
            </div>
            <div class="step-value-row">
              <strong class="step-num mono">{{ step.count }}</strong>
              <span class="step-pct mono">{{ step.pct }}%</span>
            </div>
            <div class="step-track">
              <div
                class="step-fill"
                :style="{ width: `${Math.max(step.pct, step.count > 0 ? 12 : 4)}%`, background: step.color }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- B2B Pricing & Approval Workflow Banner -->
      <div class="workflow-banner">
        <div class="workflow-banner__head">
          <div class="workflow-banner__badge">
            <span class="material-symbols-outlined text-[18px]">account_tree</span>
          </div>
          <div>
            <h3 class="workflow-banner__title mono">{{ t('admin.quoteWorkflowTitle') }}</h3>
            <p class="workflow-banner__desc">{{ t('admin.quoteWorkflowDesc') }}</p>
          </div>
        </div>
        <div class="workflow-banner__steps">
          <div class="workflow-chip">
            <span class="chip-num mono">1</span>
            <div class="chip-text">
              <strong class="chip-title">{{ t('admin.quoteStep1') }}</strong>
              <span class="chip-sub">{{ locale === 'ar' ? 'طلب تسعير العميل' : 'Buyer RFQ' }}</span>
            </div>
          </div>
          <span class="workflow-arrow icon--directional">→</span>
          <div class="workflow-chip">
            <span class="chip-num mono">2</span>
            <div class="chip-text">
              <strong class="chip-title">{{ t('admin.quoteStep2') }}</strong>
              <span class="chip-sub">{{ locale === 'ar' ? 'تسعير فريق المبيعات' : 'Staff Pricing' }}</span>
            </div>
          </div>
          <span class="workflow-arrow icon--directional">→</span>
          <div class="workflow-chip is-highlight">
            <span class="chip-num mono">3</span>
            <div class="chip-text">
              <strong class="chip-title">{{ t('admin.quoteStep3') }}</strong>
              <span class="chip-sub">{{ locale === 'ar' ? 'موافقة العميل' : 'Customer Approval' }}</span>
            </div>
          </div>
          <span class="workflow-arrow icon--directional">→</span>
          <div class="workflow-chip">
            <span class="chip-num mono">4</span>
            <div class="chip-text">
              <strong class="chip-title">{{ t('admin.quoteStep4') }}</strong>
              <span class="chip-sub">{{ locale === 'ar' ? 'تحويل لأمر توريد' : 'Convert to Order' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs for Sales Management -->
      <div class="sales-tabs-bar">
        <button
          type="button"
          class="sales-tab mono"
          :class="{ 'is-active': activeTab === 'rfqs' }"
          @click="setTab('rfqs')"
        >
          <span class="material-symbols-outlined tab-icon">inbox</span>
          <span>{{ t('admin.tabRfqs') }}</span>
          <span class="tab-count-pill">{{ rfqs.length }}</span>
        </button>
        <button
          type="button"
          class="sales-tab mono"
          :class="{ 'is-active': activeTab === 'quotes' }"
          @click="setTab('quotes')"
        >
          <span class="material-symbols-outlined tab-icon">description</span>
          <span>{{ t('admin.tabQuotes') }}</span>
          <span class="tab-count-pill tab-count-pill--purple">{{ quotes.length }}</span>
        </button>
      </div>

      <!-- Tab 1: RFQ Search & Filter Bar -->
      <div v-if="activeTab === 'rfqs'" class="search-filter-bar">
        <div class="search-wrap">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            v-model="rfqSearch"
            type="text"
            class="search-input mono"
            :placeholder="t('common.searchPlaceholder') + ' — ' + t('admin.rfqColumn')"
            @input="onRfqSearch"
          />
          <button v-if="rfqSearch" type="button" class="clear-btn" @click="rfqSearch = ''; onRfqSearch()">
            <span class="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
        <select v-model="rfqStatusFilter" class="filter-select mono" @change="onRfqSearch">
          <option value="">{{ t('common.all') }} {{ t('commerce.status') }}</option>
          <option v-for="s in RFQ_STATUSES" :key="s" :value="s">{{ s }}</option>
        </select>
        <button v-if="rfqSearch || rfqStatusFilter" type="button" class="clear-filters-btn mono" @click="clearRfqFilters">
          <span class="material-symbols-outlined text-[14px]">filter_alt_off</span>
          {{ t('common.clearFilters') }}
        </button>
      </div>

      <!-- Tab 1: RFQs Executive Table / DataState -->
      <DataState
        v-if="activeTab === 'rfqs'"
        :loading="loading && !rfqs.length"
        :error="fetchError && !rfqs.length ? fetchError : null"
        :empty="!filteredRfqs.length && !loading && !fetchError"
        :empty-title="rfqSearch || rfqStatusFilter ? t('common.noResults') : t('admin.noOpenRfqs')"
        :empty-description="t('sales.noRfqsDesc')"
        skeleton-type="table"
        :skeleton-count="6"
        min-height="320px"
        @retry="salesService.loadAll"
      >
        <div class="table-card">
          <div class="table-wrap">
            <table class="exec-table">
              <thead>
                <tr>
                  <th>{{ t('admin.rfqColumn') }}</th>
                  <th>{{ t('account.company') }}</th>
                  <th>{{ t('sales.requestDate') }}</th>
                  <th>{{ t('marketplace.products') }}</th>
                  <th>{{ t('sales.amount') }}</th>
                  <th>{{ t('commerce.status') }}</th>
                  <th class="text-end">{{ t('admin.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in paginatedRfqs" :key="r.id" class="exec-row">
                  <td>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <strong class="mono rfq-num">{{ r.rfqNumber || '—' }}</strong>
                      <span v-if="parseNegotiationNote(r.note).isNegotiation" style="display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; color: #065f46; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 1px 6px; border-radius: 9999px; width: fit-content;" class="mono">
                        <span class="material-symbols-outlined" style="font-size: 13px;">handshake</span>
                        <span>{{ parseNegotiationNote(r.note).targetTotal }}</span>
                        <span v-if="parseNegotiationNote(r.note).discountPercent">(-{{ parseNegotiationNote(r.note).discountPercent }}%)</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong class="company-name">{{ r.companyName || '—' }}</strong>
                  </td>
                  <td class="mono text-xs text-slate-500">{{ new Date(r.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</td>
                  <td>
                    <div class="product-names-cell">
                      <span
                        v-for="(item, idx) in (r.items ?? []).slice(0, 2)"
                        :key="item?.id || idx"
                        class="product-name-pill"
                      >
                        {{ locale === 'ar' ? (item?.productNameAr || item?.productNameEn || '—') : (item?.productNameEn || item?.productNameAr || '—') }}
                        <span v-if="item && item.quantity > 1" class="qty-tag">×{{ item.quantity }}</span>
                      </span>
                      <span v-if="(r.items ?? []).length > 2" class="more-badge mono">+{{ (r.items ?? []).length - 2 }} {{ t('common.more') }}</span>
                    </div>
                  </td>
                  <td>
                    <div class="mono amount-block">
                      <strong class="amount-num">
                        {{ formatPrice(r.total ?? 0, locale) }} {{ r.requestedCurrency || r.currency || 'USD' }}
                      </strong>
                      <div
                        v-if="r.baseCurrency && r.requestedCurrency && r.baseCurrency !== r.requestedCurrency"
                        class="conversion-line"
                        :title="`${t('sales.baseCurrency')}: ${r.baseCurrency} · ${t('sales.requestedCurrency')}: ${r.requestedCurrency}`"
                      >
                        {{ r.baseCurrency }} → {{ r.requestedCurrency }}
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusPill :status="r.status" />
                  </td>
                  <td class="text-end">
                    <div class="action-btn-group">
                      <button
                        v-if="r.status === 'Pending'"
                        type="button"
                        class="btn-issue-quote mono"
                        @click="openQuote(r)"
                      >
                        <span class="material-symbols-outlined text-[15px]">request_quote</span>
                        <span>{{ t('admin.issueQuote') }}</span>
                      </button>

                      <template v-else-if="r.status === 'Quoted'">
                        <button
                          v-if="getLinkedQuote(r.id)"
                          type="button"
                          class="btn-view-quote mono"
                          @click="viewLinkedQuoteForRfq(r.id)"
                        >
                          <span class="material-symbols-outlined text-[15px]">visibility</span>
                          <span>{{ t('admin.viewQuote') }}</span>
                        </button>
                        <button
                          type="button"
                          class="btn-reprice mono"
                          :title="t('admin.reissueQuote')"
                          @click="openQuote(r)"
                        >
                          <span class="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                      </template>

                      <template v-else-if="r.status === 'Ordered'">
                        <button
                          v-if="getLinkedQuote(r.id)"
                          type="button"
                          class="btn-view-quote mono"
                          @click="viewLinkedQuoteForRfq(r.id)"
                        >
                          <span class="material-symbols-outlined text-[15px]">visibility</span>
                          <span>{{ t('admin.viewQuote') }}</span>
                        </button>
                        <span v-else class="mono text-xs text-slate-400">—</span>
                      </template>

                      <span v-else class="mono text-xs text-slate-400">—</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <AppPagination
            :page="rfqLocalPage"
            :total-pages="rfqTotalPages"
            :total-items="filteredRfqs.length"
            :page-size="rfqPageSize"
            variant="table"
            @change="goRfqPage"
          />
        </div>
      </DataState>

      <!-- Tab 2: Quote Search & Filter Bar -->
      <div v-if="activeTab === 'quotes'" class="search-filter-bar">
        <div class="search-wrap">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            v-model="quoteSearch"
            type="text"
            class="search-input mono"
            :placeholder="t('common.searchPlaceholder') + ' — ' + t('sales.quoteTitle')"
            @input="onQuoteSearch"
          />
          <button v-if="quoteSearch" type="button" class="clear-btn" @click="quoteSearch = ''; onQuoteSearch()">
            <span class="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
        <select v-model="quoteStatusFilter" class="filter-select mono" @change="onQuoteSearch">
          <option value="">{{ t('common.all') }} {{ t('commerce.status') }}</option>
          <option v-for="s in QUOTE_STATUSES" :key="s" :value="s">{{ s }}</option>
        </select>
        <button v-if="quoteSearch || quoteStatusFilter" type="button" class="clear-filters-btn mono" @click="clearQuoteFilters">
          <span class="material-symbols-outlined text-[14px]">filter_alt_off</span>
          {{ t('common.clearFilters') }}
        </button>
      </div>

      <!-- Tab 2: Quotes Executive Table / DataState -->
      <DataState
        v-if="activeTab === 'quotes'"
        :loading="loading && !quotes.length"
        :error="fetchError && !quotes.length ? fetchError : null"
        :empty="!filteredQuotes.length && !loading && !fetchError"
        :empty-title="quoteSearch || quoteStatusFilter ? t('common.noResults') : t('admin.noQuotesYet')"
        :empty-description="t('admin.noQuotesYetDesc')"
        skeleton-type="table"
        :skeleton-count="6"
        min-height="320px"
        @retry="salesService.loadAll"
      >
        <div class="table-card">
          <div class="table-wrap">
            <table class="exec-table">
              <thead>
                <tr>
                  <th>{{ t('sales.quoteTitle') }}</th>
                  <th>{{ t('sales.rfqTitle') }}</th>
                  <th>{{ t('admin.quoteCustomer') }}</th>
                  <th>{{ t('sales.requestDate') }}</th>
                  <th>{{ t('sales.validThrough') }}</th>
                  <th>{{ t('sales.amount') }}</th>
                  <th>{{ t('commerce.status') }}</th>
                  <th class="text-end">{{ t('admin.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="q in paginatedQuotes" :key="q.id" class="exec-row">
                  <td>
                    <strong class="mono rfq-num">{{ q.quoteNumber }}</strong>
                  </td>
                  <td>
                    <span class="mono text-xs text-slate-600 font-semibold">{{ q.rfqNumber || '—' }}</span>
                  </td>
                  <td>
                    <strong class="company-name">{{ getRfqForQuote(q)?.companyName || t('admin.institutionalClientFallback') }}</strong>
                  </td>
                  <td class="mono text-xs text-slate-500">{{ new Date(q.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</td>
                  <td class="mono text-xs" :class="new Date(q.validUntil) < new Date() && q.status !== 'Approved' ? 'text-rose-600 font-bold' : 'text-slate-500'">
                    {{ new Date(q.validUntil).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}
                  </td>
                  <td>
                    <strong class="mono amount-num">
                      {{ formatPrice(q.amount, locale) }} {{ q.currency || 'USD' }}
                    </strong>
                  </td>
                  <td>
                    <StatusPill :status="q.status" />
                  </td>
                  <td class="text-end">
                    <div class="action-btn-group">
                      <button
                        type="button"
                        class="btn-view-quote mono"
                        @click="viewQuoteDetail(q)"
                      >
                        <span class="material-symbols-outlined text-[15px]">visibility</span>
                        <span>{{ t('marketplace.viewDetails') }}</span>
                      </button>

                      <template v-if="q.status === 'Sent' || q.status === 'Draft'">
                        <button
                          type="button"
                          class="btn-quick-approve mono"
                          :disabled="quoteActionLoading"
                          :title="t('admin.approveOnBehalf')"
                          @click="handleQuoteDecision(q.id, true)"
                        >
                          <span class="material-symbols-outlined text-[16px]">verified</span>
                        </button>
                        <button
                          type="button"
                          class="btn-quick-decline mono"
                          :disabled="quoteActionLoading"
                          :title="t('sales.decline')"
                          @click="handleQuoteDecision(q.id, false)"
                        >
                          <span class="material-symbols-outlined text-[16px]">cancel</span>
                        </button>
                      </template>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <AppPagination
            :page="quoteLocalPage"
            :total-pages="quoteTotalPages"
            :total-items="filteredQuotes.length"
            :page-size="quotePageSize"
            variant="table"
            @change="goQuotePage"
          />
        </div>
      </DataState>

      <!-- Quote Details & Decision Modal -->
      <BaseModal
        v-model="showQuoteDetailModal"
        :title="`${selectedQuote?.quoteNumber ?? ''} — ${t('admin.quoteDetails')}`"
        max-width="720px"
      >
        <div v-if="selectedQuote" class="quote-modal-body">
          <!-- Status Banner Explanation -->
          <div
            class="quote-workflow-alert"
            :class="{
              'is-awaiting': selectedQuote.status === 'Sent' || selectedQuote.status === 'Draft',
              'is-approved': selectedQuote.status === 'Approved',
              'is-declined': selectedQuote.status === 'Declined',
              'is-expired': selectedQuote.status === 'Expired'
            }"
          >
            <div class="alert-icon-box">
              <span class="material-symbols-outlined text-[20px]">
                {{
                  selectedQuote.status === 'Approved' ? 'check_circle' :
                  selectedQuote.status === 'Declined' ? 'cancel' :
                  selectedQuote.status === 'Expired' ? 'schedule' : 'hourglass_top'
                }}
              </span>
            </div>
            <div class="alert-content">
              <div class="alert-title mono">
                {{
                  selectedQuote.status === 'Approved' ? t('admin.approvedByCustomerOrStaff') :
                  selectedQuote.status === 'Declined' ? t('admin.quoteDeclinedNote') :
                  selectedQuote.status === 'Expired' ? t('admin.quoteExpiredNote') :
                  t('admin.awaitingCustomerApproval')
                }}
              </div>
              <p class="alert-desc">
                {{
                  selectedQuote.status === 'Approved' ? t('admin.quoteCustomerApprovedNote') :
                  selectedQuote.status === 'Declined' ? t('admin.quoteDeclinedNote') :
                  selectedQuote.status === 'Expired' ? t('admin.quoteExpiredNote') :
                  t('admin.quoteCustomerAwaitingNote')
                }}
              </p>
            </div>
          </div>

          <!-- Summary Grid -->
          <div class="quote-summary-grid">
            <div class="summary-tile">
              <span class="summary-label mono">{{ t('admin.quoteCustomer') }}</span>
              <strong class="summary-value">{{ getRfqForQuote(selectedQuote)?.companyName || t('admin.institutionalClientFallback') }}</strong>
            </div>
            <div class="summary-tile">
              <span class="summary-label mono">{{ t('sales.rfqTitle') }}</span>
              <strong class="summary-value mono">{{ selectedQuote.rfqNumber || '—' }}</strong>
            </div>
            <div class="summary-tile">
              <span class="summary-label mono">{{ t('sales.requestDate') }}</span>
              <strong class="summary-value mono">{{ new Date(selectedQuote.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</strong>
            </div>
            <div class="summary-tile">
              <span class="summary-label mono">{{ t('sales.validThrough') }}</span>
              <strong class="summary-value mono" :class="new Date(selectedQuote.validUntil) < new Date() && selectedQuote.status !== 'Approved' ? 'text-rose-600 font-bold' : ''">
                {{ new Date(selectedQuote.validUntil).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}
              </strong>
            </div>
          </div>

          <!-- Line Items Table -->
          <div class="pricing-table-wrap">
            <table class="modal-pricing-table">
              <thead>
                <tr>
                  <th>{{ t('admin.quoteProduct') }}</th>
                  <th class="text-end">{{ t('marketplace.quantity') }}</th>
                  <th class="text-end">{{ t('admin.quoteUnitPrice') }}</th>
                  <th class="text-end">{{ t('admin.quoteSubtotal') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="quoteDetailsLoading && !selectedQuote.items.length">
                  <td colspan="4" class="text-center mono">{{ t('common.loading') }}…</td>
                </tr>
                <tr v-for="it in selectedQuote.items" :key="it.id">
                  <td class="product-title-cell">{{ locale === 'ar' ? (it.productNameAr || it.productNameEn) : it.productNameEn }}</td>
                  <td class="text-end mono">{{ it.quantity }}</td>
                  <td class="text-end mono">
                    {{ formatPrice(it.unitPrice, locale) }} {{ selectedQuote.currency || 'USD' }}
                  </td>
                  <td class="text-end mono subtotal-num">
                    {{ formatPrice(it.quantity * it.unitPrice, locale) }} {{ selectedQuote.currency || 'USD' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Total Footer Box -->
          <div class="quote-modal-total-bar">
            <div class="status-summary-side">
              <StatusPill :status="selectedQuote.status" />
            </div>
            <div class="total-quote-box">
              <span class="total-label mono">{{ t('commerce.total') }}</span>
              <strong class="total-value mono">
                {{ formatPrice(selectedQuote.amount, locale) }} {{ selectedQuote.currency || 'USD' }}
              </strong>
            </div>
          </div>

          <!-- Modal Action Buttons -->
          <div class="quote-modal-actions">
            <template v-if="selectedQuote.status === 'Sent' || selectedQuote.status === 'Draft'">
              <BaseButton
                variant="primary"
                :loading="quoteActionLoading"
                @click="handleQuoteDecision(selectedQuote.id, true)"
              >
                <span class="material-symbols-outlined text-[18px]">verified</span>
                <span>{{ t('admin.approveOnBehalf') }}</span>
              </BaseButton>
              <BaseButton
                variant="danger"
                :loading="quoteActionLoading"
                @click="handleQuoteDecision(selectedQuote.id, false)"
              >
                <span class="material-symbols-outlined text-[18px]">cancel</span>
                <span>{{ t('sales.decline') }}</span>
              </BaseButton>
            </template>
            <BaseButton variant="secondary" @click="showQuoteDetailModal = false">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>

      <!-- Issue Quotation Modal -->
      <BaseModal
        v-model="showQuoteForm"
        :title="`${t('admin.issueQuote')} — ${targetRfq?.rfqNumber ?? ''}`"
        max-width="640px"
      >
        <form class="modal-form-stack" @submit.prevent="submitQuote">
          <!-- Warn the rep which currency the client negotiated in, so the
               quote is not issued in the wrong unit. -->
          <div
            v-if="targetRfq?.baseCurrency && targetRfq.baseCurrency !== (targetRfq.requestedCurrency || targetRfq.currency)"
            class="currency-reminder-box mono"
          >
            <span class="material-symbols-outlined text-[16px]">currency_exchange</span>
            <div>
              <span class="reminder-label">{{ t('sales.requestedCurrency') }}:</span>
              <strong class="reminder-value">
                {{ targetRfq.requestedCurrency || targetRfq.currency || 'USD' }}
              </strong>
              <span class="reminder-label">
                ({{ t('sales.convertedFromBase') }}: {{ targetRfq.baseCurrency }})
              </span>
            </div>
          </div>
          <div class="pricing-table-wrap">
            <table class="modal-pricing-table">
              <thead>
                <tr>
                  <th>{{ t('admin.quoteProduct') }}</th>
                  <th class="text-end">{{ t('marketplace.quantity') }}</th>
                  <th class="text-end">
                    {{ t('admin.quoteUnitPrice') }}
                    ({{ targetRfq?.requestedCurrency || targetRfq?.currency || 'USD' }})
                  </th>
                  <th class="text-end">{{ t('admin.quoteSubtotal') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="l in quoteForm.lines" :key="l.productId">
                  <td class="product-title-cell">{{ l.productName }}</td>
                  <td class="text-end mono">{{ l.quantity }}</td>
                  <td class="text-end">
                    <input
                      v-model.number="l.unitPrice"
                      type="number"
                      min="0.01"
                      step="0.01"
                      class="pricing-input mono"
                      required
                    />
                  </td>
                  <td class="text-end mono subtotal-num">
                    {{ formatPrice(l.quantity * l.unitPrice, locale) }}
                    {{ targetRfq?.requestedCurrency || targetRfq?.currency || 'USD' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="quote-summary-bar">
            <div class="validity-input-wrap">
              <label class="validity-label mono">{{ t('sales.validThrough') }}</label>
              <input v-model="quoteForm.validUntil" type="date" class="validity-date-input mono" required />
            </div>

            <div class="total-quote-box">
              <span class="total-label mono">{{ t('admin.totalProposal') }}</span>
              <strong class="total-value mono">
                {{ formatPrice(quoteAmount, locale) }}
                {{ targetRfq?.requestedCurrency || targetRfq?.currency || 'USD' }}
              </strong>
            </div>
          </div>

          <p v-if="formError" class="modal-error-banner">{{ formError }}</p>

          <div class="modal-btn-grid">
            <BaseButton type="submit" :loading="formLoading" variant="primary" block>
              {{ t('common.save') }}
            </BaseButton>
            <BaseButton variant="secondary" block @click="showQuoteForm = false">
              {{ t('common.cancel') }}
            </BaseButton>
          </div>
        </form>
      </BaseModal>
    </div>
  </AdminLayout>
</template>

<style scoped>
.sales-admin-view {
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

.sales-head {
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

/* Pipeline Conversion Card */
.pipeline-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  padding: 1.25rem 1.5rem;
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pipeline-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.pipeline-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--wl-primary);
  letter-spacing: 0.05em;
}

.pipeline-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0.2rem 0 0;
}

.pipeline-counter {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-muted);
}

.pipeline-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.pipeline-cell {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.step-top {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.step-glyph {
  font-size: 18px;
}

.step-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-ink-soft);
}

.step-value-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.step-num {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.step-pct {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-muted);
}

.step-track {
  height: 6px;
  background: var(--wl-surface-hover);
  border-radius: 9999px;
  overflow: hidden;
}

.step-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.3s ease;
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

.rfq-num {
  font-size: 13px;
  color: var(--wl-ink-strong);
  font-weight: 700;
}

.company-name {
  font-size: 13.5px;
  color: var(--wl-ink-strong);
}

.items-pill {
  font-size: 11px;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
}

.amount-num {
  font-size: 13.5px;
  color: var(--wl-ink-strong);
}

/* RFQ multi-currency display */
.amount-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.conversion-line {
  font-size: 11px;
  font-weight: 400;
  color: var(--fg-muted);
}

.currency-reminder-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-md, 6px);
  background: var(--primary-soft);
  border: 1px solid var(--border);
  border-inline-start: 3px solid var(--primary);
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: var(--space-3, 12px);
}

.reminder-label { color: var(--fg-muted); }
.reminder-value { color: var(--primary); }

.btn-issue-quote {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  border-radius: 8px;
  padding: 0.35rem 0.75rem;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-issue-quote:hover {
  background: var(--wl-primary-hover);
}

.text-end {
  text-align: end;
}

/* Modals */
.modal-form-stack {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.pricing-table-wrap {
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  overflow: hidden;
}

.modal-pricing-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.modal-pricing-table th {
  background: var(--wl-surface-soft);
  padding: 0.6rem 0.85rem;
  font-size: 11px;
  color: var(--wl-muted);
  font-weight: 700;
  text-transform: uppercase;
  border-bottom: 1px solid var(--wl-border);
}

.modal-pricing-table td {
  padding: 0.6rem 0.85rem;
  border-bottom: 1px solid var(--wl-border);
  vertical-align: middle;
}

.product-title-cell {
  font-weight: 600;
  color: var(--wl-ink-strong);
}

.pricing-input {
  width: 90px;
  height: 36px;
  padding: 0 8px;
  text-align: end;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: 6px;
  font-size: 13px;
  color: var(--wl-ink-strong);
  outline: none;
}

.pricing-input:focus {
  border-color: var(--wl-primary);
}

.subtotal-num {
  font-weight: 700;
  color: var(--wl-ink-strong);
}

.quote-summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  padding: 0.85rem 1.15rem;
}

.validity-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.validity-label {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--wl-muted);
  text-transform: uppercase;
}

.validity-date-input {
  height: 38px;
  padding: 0 10px;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: 8px;
  font-size: 12.5px;
  color: var(--wl-ink-strong);
  outline: none;
}

.validity-date-input:focus {
  border-color: var(--wl-primary);
}

.total-quote-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.total-label {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--wl-muted);
  text-transform: uppercase;
}

.total-value {
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--wl-primary);
}

.modal-error-banner {
  background: var(--wl-danger-soft);
  border: 1px solid rgba(237, 66, 69, 0.35);
  color: var(--wl-danger);
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  font-size: 12.5px;
}

.modal-btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

/* Workflow Banner */
.workflow-banner {
  background: linear-gradient(135deg, var(--wl-surface) 0%, rgba(105, 169, 255, 0.14) 100%);
  border: 1px solid rgba(151, 190, 255, 0.35);
  border-radius: 14px;
  padding: 1.15rem 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.workflow-banner__head {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}

.workflow-banner__badge {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--wl-primary);
  flex-shrink: 0;
}

.workflow-banner__title {
  font-size: 13.5px;
  font-weight: 800;
  color: var(--wl-ink);
  margin: 0;
}

.workflow-banner__desc {
  font-size: 12px;
  color: var(--wl-muted);
  margin: 0.2rem 0 0;
  line-height: 1.45;
}

.workflow-banner__steps {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.workflow-chip {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  padding: 0.45rem 0.75rem;
  box-shadow: var(--shadow-xs);
}

.workflow-chip.is-highlight {
  background: linear-gradient(180deg, rgba(62, 215, 180, 0.16), rgba(62, 215, 180, 0.07));
  border-color: rgba(62, 215, 180, 0.45);
}

.chip-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  font-size: 10.5px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.workflow-chip.is-highlight .chip-num {
  background: var(--wl-success);
  color: var(--wl-on-primary);
}

.chip-text {
  display: flex;
  flex-direction: column;
}

.chip-title {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
}

.chip-sub {
  font-size: 10px;
  color: var(--wl-muted);
}

.workflow-arrow {
  font-size: 15px;
  color: var(--wl-muted-soft);
  font-weight: 700;
}

/* Tabs Bar */
.sales-tabs-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1.5px solid var(--wl-border);
  padding-bottom: 0.5rem;
}

.sales-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.15rem;
  border-radius: 10px;
  background: transparent;
  border: 1px solid transparent;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--wl-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.sales-tab:hover {
  background: var(--wl-surface-soft);
  color: var(--wl-ink);
}

.sales-tab.is-active {
  background: var(--wl-primary-soft);
  border-color: rgba(var(--wl-primary-rgb), 0.3);
  color: var(--wl-primary);
}

.tab-icon {
  font-size: 18px;
}

.tab-count-pill {
  font-size: 10px;
  font-weight: 800;
  padding: 0.15rem 0.45rem;
  border-radius: 9999px;
  background: var(--wl-surface-hover);
  color: var(--wl-ink-soft);
}

.tab-count-pill--purple {
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
}

/* Actions Group */
.action-btn-group {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  justify-content: flex-end;
}

.btn-view-quote {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--wl-surface-soft);
  color: var(--wl-ink-soft);
  border: 1px solid var(--wl-border-strong);
  border-radius: 7px;
  padding: 0.35rem 0.65rem;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-view-quote:hover {
  background: var(--wl-surface-hover);
  color: var(--wl-ink-strong);
}

.btn-reprice {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--wl-surface);
  color: var(--wl-muted);
  border: 1px solid var(--wl-border);
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-reprice:hover {
  background: var(--wl-surface-soft);
  color: var(--wl-primary);
  border-color: rgba(var(--wl-primary-rgb), 0.3);
}

.btn-quick-approve {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: var(--wl-success-soft);
  color: var(--wl-success);
  border: 1px solid rgba(62, 215, 180, 0.4);
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-quick-approve:hover {
  background: rgba(62, 215, 180, 0.22);
  color: var(--wl-success);
}

.btn-quick-decline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: var(--wl-danger-soft);
  color: var(--wl-danger);
  border: 1px solid rgba(237, 66, 69, 0.35);
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-quick-decline:hover {
  background: rgba(242, 109, 109, 0.22);
  color: var(--wl-danger);
}

/* Quote Detail Modal Body */
.quote-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.quote-workflow-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  border: 1px solid;
}

.quote-workflow-alert.is-awaiting {
  background: var(--wl-warning-soft);
  border-color: rgba(254, 231, 92, 0.35);
  color: var(--wl-warning);
}

.quote-workflow-alert.is-approved {
  background: var(--wl-success-soft);
  border-color: rgba(62, 215, 180, 0.4);
  color: var(--wl-success);
}

.quote-workflow-alert.is-declined {
  background: var(--wl-danger-soft);
  border-color: rgba(237, 66, 69, 0.35);
  color: var(--wl-danger);
}

.quote-workflow-alert.is-expired {
  background: var(--wl-surface-soft);
  border-color: var(--wl-border);
  color: var(--wl-muted);
}

.alert-icon-box {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin-top: 2px;
}

.alert-title {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.alert-desc {
  font-size: 12px;
  margin: 0.2rem 0 0;
  line-height: 1.45;
  color: var(--wl-ink-soft);
}

.quote-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.75rem;
}

.summary-tile {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 8px;
  padding: 0.65rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.summary-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-muted);
  text-transform: uppercase;
}

.summary-value {
  font-size: 12.5px;
  color: var(--wl-ink-strong);
}

.quote-modal-total-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  padding: 0.75rem 1.15rem;
}

.quote-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
  margin-top: 0.5rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--wl-border);
}
</style>





