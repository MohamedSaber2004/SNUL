<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ProviderLayout from '../../components/layout/ProviderLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import { salesService, companyService } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { t, locale } from '../../i18n'
import type { RfqDto, RfqItemDto, QuoteDto } from '../../domain/models/sales'
import { parseNegotiationNote } from '../../utils/negotiation'
import { formatPrice } from '../../utils/format'

const localized = (en?: string | null, ar?: string | null) =>
  locale.value === 'ar' ? ar || en || '' : en || ar || ''

/* ---- RFQ multi-currency helpers -------------------------------------------
 * The buyer negotiates in their own currency; the API stores one unitPrice and
 * carries base/requested/rate in the line note. These read both back so a
 * provider can see what the client actually asked for. */

const getItemRequestedCurrency = (it: Partial<RfqItemDto>, rfq?: RfqDto | null): string => {
  return it.requestedCurrency || rfq?.requestedCurrency || rfq?.currency || 'USD'
}

const getItemBaseCurrency = (it: Partial<RfqItemDto>, rfq?: RfqDto | null): string => {
  return it.baseCurrency || rfq?.baseCurrency || 'USD'
}

const getItemRequestedUnitPrice = (it: RfqItemDto): number => {
  if (it.requestedPrice != null && it.requestedPrice > 0) return it.requestedPrice
  return it.unitPrice || 0
}

const getItemBaseUnitPrice = (it: RfqItemDto): number => {
  if (it.basePrice != null && it.basePrice > 0) return it.basePrice
  return it.unitPrice || 0
}

const getItemRequestedTotal = (it: RfqItemDto): number => {
  return getItemRequestedUnitPrice(it) * (it.quantity || 1)
}

const getItemBaseTotal = (it: RfqItemDto): number => {
  return getItemBaseUnitPrice(it) * (it.quantity || 1)
}

const hasConversion = (rfq?: RfqDto | null): boolean => {
  if (!rfq) return false
  const rCur = rfq.requestedCurrency || rfq.currency
  return Boolean(rfq.baseCurrency && rCur && rfq.baseCurrency !== rCur)
}

const hasItemConversion = (it: RfqItemDto, rfq?: RfqDto | null): boolean => {
  const bCur = getItemBaseCurrency(it, rfq)
  const rCur = getItemRequestedCurrency(it, rfq)
  return Boolean(bCur && rCur && bCur !== rCur)
}

const selectedRfqTotal = computed(() => {
  if (!selectedRfq.value?.items || !selectedRfq.value.items.length) return selectedRfq.value?.total || 0
  return selectedRfq.value.items.reduce((sum, it) => sum + getItemRequestedTotal(it), 0)
})

const selectedRfqBaseTotal = computed(() => {
  if (!selectedRfq.value?.items || !selectedRfq.value.items.length) return 0
  return selectedRfq.value.items.reduce((sum, it) => sum + getItemBaseTotal(it), 0)
})

const rfqs = salesService.rfqs
const quotes = salesService.quotes
const loading = ref(true)
const fetchError = ref('')
const search = ref('')
const statusFilter = ref('all')
const tab = ref<'all' | 'negotiations' | 'quotes'>('all')
const page = ref(1)
const pageSize = 10

// Action states
const acting = ref('')
const selectedRfq = ref<RfqDto | null>(null)
const showDetailModal = ref(false)

// Counter-offer modal
const showCounterModal = ref(false)
const counterRfq = ref<RfqDto | null>(null)
const counterAmount = ref<number | null>(null)
const counterNote = ref('')
const counterValidityDays = ref(14)
const submittingCounter = ref(false)

const loadData = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    await Promise.all([
      companyService.loadMyCompany().catch(() => null),
      salesService.loadRfqs({ pageSize: 50 }),
      salesService.loadQuotes({ pageSize: 50 }),
    ])
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadData()
})

interface EnhancedRfq extends RfqDto {
  negotiation: ReturnType<typeof parseNegotiationNote>
}

const enhancedRfqs = computed<EnhancedRfq[]>(() => {
  return rfqs.value.map((r) => ({
    ...r,
    negotiation: parseNegotiationNote(r.note),
  }))
})

// Metrics
const totalRfqsCount = computed(() => rfqs.value.length)
const negotiationsCount = computed(() => enhancedRfqs.value.filter((r) => r.negotiation.isNegotiation).length)
const quotesCount = computed(() => quotes.value.length)

const filteredRfqs = computed(() => {
  let list = enhancedRfqs.value

  if (tab.value === 'negotiations') {
    list = list.filter((r) => r.negotiation.isNegotiation)
  }

  if (statusFilter.value !== 'all') {
    list = list.filter((r) => String(r.status || '').toLowerCase() === statusFilter.value.toLowerCase())
  }

  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter((r) => {
      const num = r.rfqNumber?.toLowerCase() || ''
      const comp = r.companyName?.toLowerCase() || ''
      const note = r.note?.toLowerCase() || ''
      const hasItem = Array.isArray(r.items) && r.items.some((it) =>
        (it.productNameEn?.toLowerCase() || '').includes(q) ||
        (it.productNameAr?.toLowerCase() || '').includes(q) ||
        (it.productId?.toLowerCase() || '').includes(q)
      )
      return num.includes(q) || comp.includes(q) || note.includes(q) || hasItem
    })
  }

  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRfqs.value.length / pageSize)))
const paginatedRfqs = computed(() =>
  filteredRfqs.value.slice((page.value - 1) * pageSize, page.value * pageSize)
)

const openDetails = (rfq: RfqDto) => {
  selectedRfq.value = rfq
  showDetailModal.value = true
}

const handleAcceptNegotiation = async (rfq: EnhancedRfq) => {
  const targetPriceStr = rfq.negotiation.targetTotal || 'Proposed Price'
  const ok = await confirmService.confirm({
    title: t('provider.acceptNegotiation'),
    message: `${t('provider.proposedTargetPrice')}: ${targetPriceStr}. ${t('provider.acceptSuccess')}`,
    variant: 'primary',
    confirmText: t('provider.acceptNegotiation'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return

  acting.value = rfq.id
  try {
    // Generate validUntil date 14 days from now
    const d = new Date()
    d.setDate(d.getDate() + 14)
    const validUntil = d.toISOString().split('T')[0]

    // Create quote reflecting client's negotiated total if items exist
    const items = Array.isArray(rfq.items) && rfq.items.length ? rfq.items : []
    const lines = items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || 0,
    }))

    const targetNum = parseFloat((rfq.negotiation.targetTotal || '').replace(/[^0-9.]/g, '')) || (rfq.total || 0)
    const res = await salesService.createQuote({
      rfqId: rfq.id,
      amount: targetNum,
      validUntil: validUntil || '',
      items: lines.length ? lines : [{ productId: 'custom', quantity: 1, unitPrice: targetNum }],
    })

    if (res.ok) {
      toastService.success(t('provider.acceptSuccess'))
      await loadData()
    } else {
      toastService.error(res.error)
    }
  } finally {
    acting.value = ''
  }
}

const openCounterModal = (rfq: EnhancedRfq) => {
  counterRfq.value = rfq
  // Pre-fill counter amount with target total or current total
  const parsedNum = parseFloat((rfq.negotiation.targetTotal || '').replace(/[^0-9.]/g, ''))
  counterAmount.value = !isNaN(parsedNum) ? parsedNum : (rfq.total || 0)
  counterNote.value = ''
  counterValidityDays.value = 14
  showCounterModal.value = true
}

const submitCounterOffer = async () => {
  if (!counterRfq.value || !counterAmount.value || counterAmount.value <= 0) {
    toastService.info(t('sales.targetPriceValidation'))
    return
  }

  submittingCounter.value = true
  try {
    const d = new Date()
    d.setDate(d.getDate() + (counterValidityDays.value || 14))
    const validUntil = d.toISOString().split('T')[0]

    const rfq = counterRfq.value
    const items = Array.isArray(rfq.items) && rfq.items.length ? rfq.items : []
    const lines = items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity || 1,
      unitPrice: Math.round(((counterAmount.value || 0) / (items.length || 1)) / (it.quantity || 1)),
    }))

    const res = await salesService.createQuote({
      rfqId: rfq.id,
      amount: counterAmount.value,
      validUntil: validUntil || '',
      items: lines.length ? lines : [{ productId: 'custom', quantity: 1, unitPrice: counterAmount.value }],
    })

    if (res.ok) {
      toastService.success(t('provider.counterSuccess'))
      showCounterModal.value = false
      await loadData()
    } else {
      toastService.error(res.error)
    }
  } finally {
    submittingCounter.value = false
  }
}

const handleDecline = async (rfq: RfqDto) => {
  const ok = await confirmService.confirm({
    title: t('sales.decline'),
    message: t('provider.declineSuccess'),
    variant: 'danger',
    confirmText: t('sales.statusDeclined'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return

  acting.value = rfq.id
  try {
    const res = await salesService.updateRfqStatus(rfq.id, 'Declined')
    if (res.ok) {
      toastService.success(t('provider.declineSuccess'))
      await loadData()
    } else {
      toastService.error(res.error)
    }
  } finally {
    acting.value = ''
  }
}
</script>

<template>
  <ProviderLayout>
    <div class="provider-quotes-view">
      <!-- Header -->
      <header class="view-header">
        <div>
          <span class="mono eyebrow">{{ t('provider.dashboard') }} · {{ t('admin.commerce') }}</span>
          <h1 class="view-title">{{ t('provider.quotes') }}</h1>
          <p class="view-desc">{{ t('provider.quotesDesc') }}</p>
        </div>
        <div class="header-actions">
          <BaseButton variant="ghost" icon="refresh" :loading="loading" @click="loadData">
            {{ t('common.refresh') }}
          </BaseButton>
        </div>
      </header>

      <!-- KPI Summary Cards -->
      <div class="kpi-grid">
        <button type="button" class="kpi-card" :class="{ 'is-active': tab === 'all' }" :aria-pressed="tab === 'all'" @click="tab = 'all'">
          <span class="kpi-icon-box bg-primary-soft" aria-hidden="true">
            <span class="material-symbols-outlined text-primary">request_quote</span>
          </span>
          <span class="kpi-info">
            <span class="kpi-label mono">{{ t('sales.rfqTitle') }}</span>
            <strong class="kpi-value mono">{{ totalRfqsCount }}</strong>
          </span>
        </button>

        <button type="button" class="kpi-card kpi-card--highlight" :class="{ 'is-active': tab === 'negotiations' }" :aria-pressed="tab === 'negotiations'" @click="tab = 'negotiations'">
          <span class="kpi-icon-box bg-emerald-soft" aria-hidden="true">
            <span class="material-symbols-outlined text-emerald-600">handshake</span>
          </span>
          <span class="kpi-info">
            <span class="kpi-label mono">{{ t('provider.negotiationRequests') }}</span>
            <strong class="kpi-value mono text-emerald-600">{{ negotiationsCount }}</strong>
          </span>
          <span v-if="negotiationsCount > 0" class="negotiation-ping-badge mono" aria-hidden="true">{{ negotiationsCount }}</span>
        </button>

        <button type="button" class="kpi-card" :class="{ 'is-active': tab === 'quotes' }" :aria-pressed="tab === 'quotes'" @click="tab = 'quotes'">
          <span class="kpi-icon-box bg-gold-soft" aria-hidden="true">
            <span class="material-symbols-outlined text-gold">verified</span>
          </span>
          <span class="kpi-info">
            <span class="kpi-label mono">{{ t('sales.quoteTitle') }}</span>
            <strong class="kpi-value mono">{{ quotesCount }}</strong>
          </span>
        </button>
      </div>

      <!-- Quotes List Tab vs RFQ List Tab -->
      <template v-if="tab === 'quotes'">
        <div class="table-card">
          <div class="table-card-head">
            <h2 class="section-title">{{ t('sales.quoteTitle') }} ({{ quotes.length }})</h2>
          </div>

          <DataState :loading="loading" :error="fetchError" :empty="!quotes.length" :empty-text="t('sales.noQuotes')" @retry="loadData">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr class="mono">
                    <th>{{ t('sales.quoteTitle') }}</th>
                    <th>{{ t('sales.requestDate') }}</th>
                    <th class="num">{{ t('commerce.total') }}</th>
                    <th>{{ t('sales.validThrough') }}</th>
                    <th>{{ t('commerce.status') }}</th>
                    <th class="text-end">{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="q in quotes" :key="q.id">
                    <td>
                      <strong class="mono">{{ q.quoteNumber }}</strong>
                    </td>
                    <td class="mono text-muted text-sm">
                      {{ q.createdAt ? new Date(q.createdAt).toLocaleDateString() : '—' }}
                    </td>
                    <td class="num">
                      <strong class="mono text-primary">{{ formatPrice(q.amount, q.currency || 'USD') }}</strong>
                    </td>
                    <td class="mono text-sm">
                      {{ q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—' }}
                    </td>
                    <td>
                      <StatusPill :status="q.status" />
                    </td>
                    <td class="text-end">
                      <span class="mono text-sm text-muted">{{ q.currency || 'USD' }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DataState>
        </div>
      </template>

      <!-- RFQs & Price Negotiations Tab -->
      <template v-else>
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
              <option value="Pending">{{ t('account.pipeStatusPending') }}</option>
              <option value="Quoted">{{ t('admin.pipeQuoted') }}</option>
              <option value="Declined">{{ t('sales.statusDeclined') }}</option>
            </select>
          </div>
        </div>

        <!-- RFQs / Inquiries Table -->
        <div class="table-card">
          <DataState :loading="loading" :error="fetchError" :empty="!paginatedRfqs.length" :empty-text="t('sales.noRfqs')" @retry="loadData">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr class="mono">
                    <th>{{ t('admin.rfqColumn') }}</th>
                    <th>{{ t('account.company') }}</th>
                    <th>{{ t('cart.trayHeading') }}</th>
                    <th class="num">{{ t('commerce.total') }} / {{ t('provider.proposedTargetPrice') }}</th>
                    <th>{{ t('commerce.status') }}</th>
                    <th class="text-end">{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="rfq in paginatedRfqs" :key="rfq.id" :class="{ 'row-negotiation': rfq.negotiation.isNegotiation }">
                    <!-- RFQ Number & Negotiation Tag -->
                    <td>
                      <div class="rfq-id-cell">
                        <strong class="mono rfq-num">{{ rfq.rfqNumber }}</strong>
                        <span v-if="rfq.negotiation.isNegotiation" class="negotiation-pill mono">
                          <span class="material-symbols-outlined text-[13px]">handshake</span>
                          <span>{{ t('provider.negotiationRequests') }}</span>
                          <strong v-if="rfq.negotiation.discountPercent">(-{{ rfq.negotiation.discountPercent }}%)</strong>
                        </span>
                        <span class="mono text-xs text-muted">
                          {{ rfq.createdAt ? new Date(rfq.createdAt).toLocaleDateString() : '—' }}
                        </span>
                      </div>
                    </td>

                    <!-- Client Company -->
                    <td>
                      <div class="client-cell">
                        <strong class="client-name">{{ rfq.companyName || 'Verified Client' }}</strong>
                        <span v-if="rfq.negotiation.reason" class="client-reason" :title="rfq.negotiation.reason">
                          <span class="material-symbols-outlined text-[14px] text-muted">chat</span>
                          <span>{{ rfq.negotiation.reason }}</span>
                        </span>
                      </div>
                    </td>

                    <!-- Items Summary -->
                    <td>
                      <div class="items-cell">
                        <span class="items-count-badge mono">
                          {{ Array.isArray(rfq.items) ? rfq.items.length : 0 }} {{ t('marketplace.products') }}
                        </span>
                        <div class="items-snippet mono">
                          <span v-for="(it, i) in (rfq.items || []).slice(0, 2)" :key="i" class="item-chip">
                            {{ localized(it.productNameEn, it.productNameAr) }} (x{{ it.quantity }})
                          </span>
                          <span v-if="(rfq.items?.length || 0) > 2" class="more-items">
                            +{{ (rfq.items?.length || 0) - 2 }}
                          </span>
                        </div>
                      </div>
                    </td>

                    <!-- Price / Negotiated Price -->
                    <td class="num">
                      <div class="price-cell mono">
                        <template v-if="rfq.negotiation.isNegotiation && rfq.negotiation.targetTotal">
                          <div class="target-price-badge">
                            <span class="target-lbl">{{ t('provider.proposedTargetPrice') }}:</span>
                            <strong class="target-val">{{ rfq.negotiation.targetTotal }}</strong>
                          </div>
                          <span v-if="rfq.total" class="original-price-striked">
                            {{ t('commerce.subtotal') }}: {{ formatPrice(rfq.total, locale) }} {{ rfq.requestedCurrency || rfq.currency || 'USD' }}
                          </span>
                        </template>
                        <template v-else>
                          <strong class="regular-total">
                            {{ formatPrice(rfq.total || 0, locale) }} {{ rfq.requestedCurrency || rfq.currency || 'USD' }}
                          </strong>
                        </template>
                      </div>
                    </td>

                    <!-- Status -->
                    <td>
                      <StatusPill :status="rfq.status" />
                    </td>

                    <!-- Actions -->
                    <td class="text-end">
                      <div class="action-btn-group">
                        <!-- If price negotiation pending -->
                        <template v-if="rfq.negotiation.isNegotiation && rfq.status === 'Pending'">
                          <button
                            type="button"
                            class="action-btn btn-accept"
                            :title="t('provider.acceptNegotiation')"
                            :disabled="acting === rfq.id"
                            @click="handleAcceptNegotiation(rfq)"
                          >
                            <span class="material-symbols-outlined text-[16px]">check_circle</span>
                            <span>{{ t('provider.acceptNegotiation') }}</span>
                          </button>

                          <button
                            type="button"
                            class="action-btn btn-counter"
                            :title="t('provider.counterOffer')"
                            :disabled="acting === rfq.id"
                            @click="openCounterModal(rfq)"
                          >
                            <span class="material-symbols-outlined text-[16px]">rate_review</span>
                            <span>{{ t('provider.counterOffer') }}</span>
                          </button>
                        </template>

                        <!-- Standard RFQ actions -->
                        <template v-else-if="rfq.status === 'Pending'">
                          <button
                            type="button"
                            class="action-btn btn-counter"
                            :title="t('sales.createQuote')"
                            @click="openCounterModal(rfq)"
                          >
                            <span class="material-symbols-outlined text-[16px]">edit_note</span>
                            <span>{{ t('sales.createQuote') }}</span>
                          </button>
                        </template>

                        <button
                          type="button"
                          class="action-btn btn-view"
                          :title="t('common.details')"
                          :aria-label="t('common.details')"
                          @click="openDetails(rfq)"
                        >
                          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">visibility</span>
                        </button>

                        <button
                          v-if="rfq.status === 'Pending'"
                          type="button"
                          class="action-btn btn-decline"
                          :title="t('sales.statusDeclined')"
                          :aria-label="t('sales.statusDeclined')"
                          :disabled="acting === rfq.id"
                          @click="handleDecline(rfq)"
                        >
                          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
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
      </template>

      <!-- RFQ Detail Modal -->
      <BaseModal v-model="showDetailModal" :title="`${t('sales.rfqDetail')} · ${selectedRfq?.rfqNumber || ''}`" size="lg">
        <div v-if="selectedRfq" class="detail-modal-body">
          <!-- Negotiation Banner if present -->
          <div v-if="parseNegotiationNote(selectedRfq.note).isNegotiation" class="negotiation-banner">
            <span class="material-symbols-outlined text-[20px] text-emerald-600">handshake</span>
            <div>
              <strong class="banner-title">{{ t('provider.negotiationRequests') }}</strong>
              <p class="banner-desc">
                {{ t('provider.proposedTargetPrice') }}:
                <strong class="text-emerald-700">{{ parseNegotiationNote(selectedRfq.note).targetTotal }}</strong>
                <span v-if="parseNegotiationNote(selectedRfq.note).discountPercent">
                  ({{ t('provider.requestedDiscount') }}: {{ parseNegotiationNote(selectedRfq.note).discountPercent }}%)
                </span>
              </p>
              <p v-if="parseNegotiationNote(selectedRfq.note).reason" class="banner-reason">
                <em>"{{ parseNegotiationNote(selectedRfq.note).reason }}"</em>
              </p>
            </div>
          </div>

          <!-- Metadata Grid -->
          <div class="detail-grid mono">
            <div class="detail-item">
              <span class="lbl">{{ t('account.company') }}</span>
              <strong class="val">{{ selectedRfq.companyName || '—' }}</strong>
            </div>
            <div class="detail-item">
              <span class="lbl">{{ t('sales.requestDate') }}</span>
              <strong class="val">{{ selectedRfq.createdAt ? new Date(selectedRfq.createdAt).toLocaleString() : '—' }}</strong>
            </div>
            <div class="detail-item">
              <span class="lbl">{{ t('commerce.status') }}</span>
              <StatusPill :status="selectedRfq.status" />
            </div>
          </div>

          <!-- Line Items Table -->
          <div class="line-items-section">
            <h3 class="section-sub mono">{{ t('sales.lineItems') }}</h3>
            <table class="line-items-table mono">
              <thead>
                <tr>
                  <th>{{ t('marketplace.products') }}</th>
                  <th class="text-center">{{ t('marketplace.quantity') }}</th>
                  <th class="text-end">{{ t('admin.quoteUnitPrice') }}</th>
                  <th class="text-end">{{ t('sales.amount') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(it, idx) in selectedRfq.items || []" :key="idx">
                  <td>
                    <strong>{{ localized(it.productNameEn, it.productNameAr) }}</strong>
                    <div class="text-xs text-muted">{{ it.productId }}</div>
                    <div
                      v-if="hasItemConversion(it, selectedRfq)"
                      class="text-xs conversion-tag mono"
                    >
                      {{ getItemBaseCurrency(it, selectedRfq) }} → {{ getItemRequestedCurrency(it, selectedRfq) }}
                      <span v-if="it.exchangeRate"> · {{ t('sales.exchangeRateUsed') }}: {{ it.exchangeRate }}</span>
                    </div>
                  </td>
                  <td class="text-center">{{ it.quantity }}</td>
                  <td class="text-end">
                    <div>{{ formatPrice(getItemRequestedUnitPrice(it), locale) }} {{ getItemRequestedCurrency(it, selectedRfq) }}</div>
                    <div v-if="hasItemConversion(it, selectedRfq)" class="text-xs text-muted mono">
                      {{ t('sales.baseUnitPrice') }}: {{ formatPrice(getItemBaseUnitPrice(it), locale) }} {{ getItemBaseCurrency(it, selectedRfq) }}
                    </div>
                  </td>
                  <td class="text-end">
                    <strong>{{ formatPrice(getItemRequestedTotal(it), locale) }} {{ getItemRequestedCurrency(it, selectedRfq) }}</strong>
                    <div v-if="hasItemConversion(it, selectedRfq)" class="text-xs text-muted mono">
                      {{ formatPrice(getItemBaseTotal(it), locale) }} {{ getItemBaseCurrency(it, selectedRfq) }}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Dual-currency totals footer -->
            <div v-if="selectedRfq?.items?.length" class="detail-totals mono">
              <div class="detail-total-row">
                <span>{{ t('sales.requestedCurrency') }}</span>
                <strong>
                  {{ formatPrice(selectedRfqTotal, locale) }}
                  {{ selectedRfq?.requestedCurrency || selectedRfq?.currency || 'USD' }}
                </strong>
              </div>
              <div v-if="hasConversion(selectedRfq)" class="detail-total-row is-base">
                <span>{{ t('sales.basePricingNote') }}</span>
                <strong>
                  {{ formatPrice(selectedRfqBaseTotal, locale) }}
                  {{ selectedRfq?.baseCurrency || 'USD' }}
                </strong>
              </div>
              <div v-if="hasConversion(selectedRfq)" class="detail-total-hint">
                {{ t('sales.conversionSummary', {
                  base: selectedRfq?.baseCurrency || 'USD',
                  requested: selectedRfq?.requestedCurrency || selectedRfq?.currency || 'USD',
                }) }}
              </div>
            </div>
          </div>

          <!-- Note -->
          <div v-if="parseNegotiationNote(selectedRfq.note).cleanNote" class="detail-note">
            <span class="mono text-xs text-muted">{{ t('sales.notes') }}:</span>
            <p>{{ parseNegotiationNote(selectedRfq.note).cleanNote }}</p>
          </div>
        </div>
      </BaseModal>

      <!-- Counter-Offer Modal -->
      <BaseModal v-model="showCounterModal" :title="t('provider.counterOffer')" size="md">
        <div v-if="counterRfq" class="counter-modal-body">
          <!-- Remind the provider which currency the client negotiated in, so
               the counter-offer is not accidentally quoted in the wrong unit. -->
          <div v-if="hasConversion(counterRfq)" class="currency-reminder-box mono">
            <span class="material-symbols-outlined text-[16px]">currency_exchange</span>
            <div>
              <span class="reminder-label">{{ t('sales.clientRequestedCurrency') }}:</span>
              <strong class="reminder-value">
                {{ counterRfq.requestedCurrency || counterRfq.currency }}
              </strong>
              <span class="reminder-label">
                ({{ t('sales.convertedFromBase') }}: {{ counterRfq.baseCurrency }})
              </span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-lbl mono">
          {{ t('provider.counterAmount') }}
          ({{ counterRfq?.requestedCurrency || counterRfq?.currency || 'USD' }}) *
        </label>
            <input
              v-model.number="counterAmount"
              type="number"
              min="1"
              step="any"
              class="form-input mono"
              :placeholder="String(counterRfq.total || 0)"
            />
          </div>

          <div class="form-group">
            <label class="form-lbl mono">{{ t('sales.validThrough') }}</label>
            <input
              v-model.number="counterValidityDays"
              type="number"
              min="1"
              max="90"
              class="form-input mono"
            />
          </div>

          <div class="form-group">
            <label class="form-lbl mono">{{ t('provider.counterNote') }}</label>
            <textarea
              v-model="counterNote"
              rows="3"
              class="form-textarea"
              :placeholder="t('provider.counterNote')"
            ></textarea>
          </div>

          <div class="modal-actions">
            <BaseButton variant="ghost" @click="showCounterModal = false">{{ t('common.cancel') }}</BaseButton>
            <BaseButton variant="primary" :loading="submittingCounter" @click="submitCounterOffer">
              {{ t('provider.counterOffer') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>
    </div>
  </ProviderLayout>
</template>

<style scoped>
.provider-quotes-view {
  width: 100%;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
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
  position: relative;
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

.kpi-card--highlight.is-active {
  border-color: var(--wl-success);
  box-shadow: 0 4px 12px rgba(var(--wl-success-rgb), 0.14);
}

.kpi-icon-box {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
}

.bg-primary-soft { background: var(--wl-primary-soft); }
.bg-emerald-soft { background: var(--wl-success-soft); }
.bg-gold-soft { background: var(--wl-gold-soft); }
.text-gold { color: var(--wl-gold); }

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

.negotiation-ping-badge {
  position: absolute;
  top: var(--space-2);
  inset-inline-end: var(--space-2);
  background: var(--wl-success);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
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

.table-card-head {
  padding: var(--space-4);
  border-bottom: 1px solid var(--wl-border);
}

.section-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
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

.row-negotiation {
  background: rgba(var(--wl-success-rgb), 0.06);
}

.row-negotiation:hover {
  background: rgba(var(--wl-success-rgb), 0.1);
}

.rfq-id-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.rfq-num {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
}

.negotiation-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  background: var(--wl-success-soft);
  color: var(--wl-success);
  border: 1px solid rgba(var(--wl-success-rgb), 0.35);
  font-size: 11px;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  width: fit-content;
}

.client-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.client-name {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
}

.client-reason {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--wl-muted);
  max-width: 250px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.price-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-1);
}

.target-price-badge {
  display: flex;
  flex-direction: column;
}

.target-lbl {
  font-size: 10px;
  color: var(--wl-success);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.target-val {
  font-size: var(--step-0);
  color: var(--wl-success);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.regular-total {
  font-variant-numeric: tabular-nums;
}

.original-price-striked {
  font-size: 11px;
  color: var(--wl-muted);
  text-decoration: line-through;
}

.regular-total {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
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

.btn-accept {
  background: var(--wl-success);
  color: #fff;
}
.btn-accept:hover {
  background: color-mix(in srgb, var(--wl-success) 88%, black);
}

.btn-counter {
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  border: 1px solid var(--wl-border);
}
.btn-counter:hover {
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

.btn-decline {
  background: transparent;
  color: var(--wl-danger);
  border: 1px solid transparent;
  padding: var(--space-2);
}
.btn-decline:hover {
  background: var(--wl-danger-soft);
  border-color: var(--wl-border);
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

.negotiation-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background: var(--wl-success-soft);
  border: 1px solid rgba(var(--wl-success-rgb), 0.4);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.banner-title {
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  display: block;
}

.banner-desc {
  font-size: var(--step--1);
  color: var(--wl-success);
  margin: var(--space-1) 0;
}

.banner-reason {
  font-size: var(--step--1);
  color: var(--wl-ink-strong);
  margin-top: var(--space-1);
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

.detail-note {
  background: var(--wl-surface-soft);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--step--1);
  color: var(--wl-ink-strong);
}

/* Counter Modal */
.counter-modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* RFQ multi-currency display */
.currency-reminder-box {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-inline-start: 3px solid var(--primary);
  border-radius: var(--radius-md);
  background: var(--primary-soft);
  font-size: 12px;
  line-height: 1.5;
}

.reminder-label { color: var(--fg-muted); }
.reminder-value { color: var(--primary); }

.conversion-tag {
  font-size: 10px;
  color: var(--primary);
  margin-top: 2px;
}

.detail-totals {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border);
  font-size: 12px;
}

.detail-total-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.detail-total-row.is-base { color: var(--fg-muted); }

.detail-total-hint {
  font-size: 11px;
  color: var(--fg-subtle);
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

.form-input,
.form-textarea {
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  outline: none;
}

.form-input:focus,
.form-textarea:focus {
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
