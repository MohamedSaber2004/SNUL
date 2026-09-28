<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { salesService } from '../../di/container'
import AccountNav from '../../components/account/AccountNav.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import ChainSteps from '../../components/ui/ChainSteps.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import DataState from '../../components/ui/DataState.vue'
import BackButton from '../../components/ui/BackButton.vue'
import FileUpload from '../../components/ui/FileUpload.vue'
import { toUploadPlace } from '../../application/attachment.service'
import { resolveFileUrl } from '../../utils/file-url'
import type { RfqDto } from '../../domain/models/sales'
import { formatPrice } from '../../utils/format'
import { parseNegotiationNote } from '../../utils/negotiation'

const route = useRoute()
const router = useRouter()
const rfq = ref<RfqDto | null>(null)
const loading = ref(true)
const linkedQuote = ref<{ id: string; status: string } | null>(null)
const rfqAttachment = ref<string | null>(null)

// NOTE: backend has no RFQ attachment linkage yet — FileUpload here is
// reference-only (uploads immediately, renders a link, never stored on the
// RFQ payload). Reset on id change so a prior RFQ's file never bleeds through.
// (Tickets append `[attachment:name]` into the message payload — see
// MyTicketsView.vue:58 — but RFQs expose no post-create note/update endpoint
// to persist it, so we deliberately do not invent one here.)
watch(
  () => route.params.id,
  () => {
    rfqAttachment.value = null
  },
)

const localized = (en: string, ar: string) => (locale.value === 'ar' ? ar : en)

onMounted(async () => {
  try {
    const id = String(route.params.id)
    const found = await salesService.getRfq(id)
    rfq.value = found
    if (found) {
      linkedQuote.value = salesService.quotes.value.find((q) => q.rfqId === found.id) ?? null
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page-shell rfq-detail-view">
    <BackButton fallback="/account/rfqs" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/account">{{ t('account.dashboard') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <router-link to="/account/rfqs">{{ t('sales.rfqTitle') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ rfq?.rfqNumber ?? '…' }}</span>
    </nav>

    <SkeletonLoader v-if="loading" type="order-detail" />
    <DataState
      v-else-if="!rfq"
      :empty="true"
      :empty-title="t('sales.noRfqs')"
      :empty-description="t('sales.noRfqsDesc')"
      :action-text="t('account.rfqs')"
      min-height="320px"
      @action="router.push({ name: 'account-rfqs' })"
    />

    <template v-else-if="rfq">
      <!-- Executive Header -->
      <header class="detail-header">
        <div class="header-main">
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('account.rfqDossier', { count: rfq.items.length }) }}</span>
          </div>
          <h1 class="mono rfq-heading">{{ rfq.rfqNumber }}</h1>
          <p class="mono rfq-sub">
            <span>{{ t('sales.submittedAt') }} {{ new Date(rfq.createdAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</span>
            <span v-if="rfq.companyName">•</span>
            <span v-if="rfq.companyName">{{ rfq.companyName }}</span>
          </p>
        </div>

        <StatusPill :status="rfq.status" />
      </header>

      <!-- Account Navigation Tab Bar -->
      <AccountNav />

      <!-- Chain Stepper Card -->
      <div class="stepper-card">
        <ChainSteps
          :steps="[t('sales.statusPending'), t('sales.statusQuoted'), t('sales.statusOrdered')]"
          :current="['Pending', 'Quoted', 'Ordered'].indexOf(rfq.status)"
        />
      </div>

      <!-- Detail 2-Column Grid -->
      <div class="detail-grid">
        <!-- Main: Line Items -->
        <main class="manifest-card">
          <div class="manifest-head">
            <div class="manifest-title-group">
              <span class="material-symbols-outlined text-[18px] text-indigo-600">checklist</span>
              <h2 class="manifest-title">{{ t('sales.lineItems') }}</h2>
            </div>
            <span class="mono item-chip">{{ t('account.itemsCount', { count: rfq.items.length }) }}</span>
          </div>

          <div class="items-stack">
            <article v-for="it in rfq.items" :key="it.id" class="rfq-item-card">
              <div class="thumb-box" :style="{ background: it.imageGradient || 'var(--wl-surface-soft)' }">
                <img
                  v-if="it.imageName"
                  :src="resolveFileUrl(it.imageName)"
                  :alt="localized(it.productNameEn, it.productNameEn)"
                  class="thumb-img"
                  loading="lazy"
                />
                <span v-else class="material-symbols-outlined text-[20px] text-slate-400">precision_manufacturing</span>
              </div>

              <div class="rfq-item-details">
                <h3 class="rfq-item-name">{{ localized(it.productNameEn, it.productNameAr || it.productNameEn) }}</h3>
                <div class="rfq-item-qty mono">
                  {{ t('account.qtyUnits', { count: it.quantity }) }} ·
                  {{ formatPrice(it.requestedPrice ?? it.unitPrice ?? 0, locale) }}
                  {{ it.requestedCurrency || rfq.requestedCurrency || rfq.currency || 'USD' }}
                  {{ t('account.perUnitShort') }}
                </div>
                <div
                  v-if="it.baseCurrency && it.requestedCurrency && it.baseCurrency !== it.requestedCurrency"
                  class="rfq-item-conversion mono"
                >
                  {{ t('sales.baseUnitPrice') }}:
                  {{ formatPrice(it.basePrice ?? 0, locale) }} {{ it.baseCurrency }}
                  <span v-if="it.exchangeRate"> · {{ t('sales.exchangeRateUsed') }}: {{ it.exchangeRate }}</span>
                </div>
                <div v-if="it.notes" class="rfq-item-notes mono">
                  <span class="font-bold">{{ t('account.specLabel') }}</span> {{ it.notes }}
                </div>
              </div>
            </article>
          </div>

          <!-- Currency Conversion Summary -->
          <div
            v-if="rfq.baseCurrency && rfq.requestedCurrency && rfq.baseCurrency !== rfq.requestedCurrency"
            class="currency-conversion-banner mono"
          >
            <span class="material-symbols-outlined text-[20px]">currency_exchange</span>
            <div>
              <strong>{{ t('sales.rfqCurrencyTitle') }}</strong>
              <p>
                {{ t('sales.requestedCurrency') }}: <strong>{{ rfq.requestedCurrency }}</strong>
                · {{ t('sales.convertedFromBase') }}: <strong>{{ rfq.baseCurrency }}</strong>
              </p>
            </div>
          </div>

          <!-- Price Negotiation Banner if present -->
          <div v-if="parseNegotiationNote(rfq.note).isNegotiation" class="negotiation-summary-card">
            <div class="negotiation-summary-header">
              <span class="material-symbols-outlined text-emerald-600">handshake</span>
              <div>
                <strong class="mono text-emerald-800">{{ t('sales.negotiateTotal') }}</strong>
                <p class="mono text-xs text-emerald-700">
                  {{ t('sales.proposedTarget') }}: <strong>{{ parseNegotiationNote(rfq.note).targetTotal }}</strong>
                  <span v-if="parseNegotiationNote(rfq.note).discountPercent">({{ parseNegotiationNote(rfq.note).discountPercent }}% {{ t('provider.requestedDiscount') }})</span>
                </p>
              </div>
            </div>
            <p v-if="parseNegotiationNote(rfq.note).reason" class="negotiation-reason-text">
              <em>"{{ parseNegotiationNote(rfq.note).reason }}"</em>
            </p>
          </div>

          <!-- Notes Callout Banner if present -->
          <div v-if="parseNegotiationNote(rfq.note).cleanNote" class="notes-banner mono">
            <span class="material-symbols-outlined text-[16px] text-indigo-600">sticky_note_2</span>
            <span><strong>{{ t('sales.notes') }}:</strong> {{ parseNegotiationNote(rfq.note).cleanNote }}</span>
          </div>
        </main>

        <!-- Sidebar: Estimated Total & Linked Quote -->
        <aside class="side-panel">
          <section class="card total-card">
            <h2 class="side-title mono">{{ t('commerce.total') }}</h2>
            <div class="amount-val-box">
              <span class="mono amount-label">{{ t('sales.amount') }}</span>
              <strong class="mono amount-big">
                {{ formatPrice(rfq.total ?? 0, locale) }}
                {{ rfq.requestedCurrency || rfq.currency || 'USD' }}
              </strong>
              <div
                v-if="rfq.baseCurrency && rfq.requestedCurrency && rfq.baseCurrency !== rfq.requestedCurrency"
                class="amount-conversion mono"
              >
                {{ t('sales.convertedFromBase') }}: {{ rfq.baseCurrency }}
              </div>
            </div>
          </section>

          <!-- Supporting Document -->
          <section class="card attach-card">
            <h2 class="side-title mono">{{ t('attachment.uploadFile') }}</h2>
            <FileUpload v-model="rfqAttachment" :place="toUploadPlace('rfq')" />
            <a
              v-if="rfqAttachment"
              :href="resolveFileUrl(rfqAttachment)"
              target="_blank"
              rel="noopener noreferrer"
              class="mono attach-link"
            >{{ rfqAttachment }}</a>
          </section>

          <!-- Linked Quote Card -->
          <section v-if="linkedQuote" class="card linked-card">
            <div class="linked-head">
              <h2 class="side-title mono">{{ t('sales.quoteTitle') }}</h2>
              <StatusPill :status="linkedQuote.status" />
            </div>
            <p class="linked-desc mono">{{ t('account.linkedQuoteDesc') }}</p>

            <button
              type="button"
              class="btn-view-quote mono"
              @click="router.push({ name: 'account-quote-detail', params: { id: linkedQuote.id } })"
            >
              <span class="material-symbols-outlined text-[16px]">visibility</span>
              <span>{{ t('marketplace.viewDetails') }}</span>
            </button>
          </section>

          <!-- Action Stack -->
          <div class="side-actions-stack">
            <button
              type="button"
              class="btn-back-rfqs mono"
              @click="router.push({ name: 'account-rfqs' })"
            >
              <span class="material-symbols-outlined text-[16px] icon--directional">arrow_back</span>
              <span>{{ t('account.backToRfqs') }}</span>
            </button>
            <button
              type="button"
              class="btn-create-rfq mono"
              @click="router.push({ name: 'account-rfqs' })"
            >
              <span class="material-symbols-outlined text-[16px]">add_circle</span>
              <span>{{ t('sales.submitRfq') }}</span>
            </button>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rfq-detail-view {
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

/* Header */
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.header-main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
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
  width: fit-content;
  margin-bottom: 0.4rem;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-primary);
}

.rfq-heading {
  font-size: 1.68rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.1;
}

.rfq-sub {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11.5px;
  color: var(--wl-muted);
  margin: 0.35rem 0 0;
}

/* Stepper Card */
.stepper-card {
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-card, 8px);
  padding: var(--wl-card-padding, 1.25rem 1.5rem);
  box-shadow: var(--shadow-sm);
}

/* Detail 2-Column Grid */
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: var(--wl-page-gap, 1.5rem);
  align-items: start;
}

.manifest-card {
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-card, 8px);
  padding: var(--wl-card-padding, 1.5rem);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.manifest-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border, #D9E2EC);
}

.manifest-title-group {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.manifest-title {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--fg-heading, #102A43);
  margin: 0;
}

.item-chip {
  font-size: 11px;
  font-weight: 600;
  color: var(--fg-muted, #627D98);
  background: var(--surface-subtle, #F7F9FB);
  border: 1px solid var(--border, #D9E2EC);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-xs, 3px);
}

.items-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.rfq-item-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--surface-subtle, #F7F9FB);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-card, 8px);
}

.thumb-box {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-sm, 4px);
  overflow: hidden;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 1px solid var(--border, #D9E2EC);
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rfq-item-details {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
}

.rfq-item-name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--fg-heading, #102A43);
  margin: 0;
}

.rfq-item-qty {
  font-size: 11.5px;
  color: var(--fg-muted, #627D98);
}

.rfq-item-notes {
  font-size: 11px;
  color: var(--fg-muted, #627D98);
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #D9E2EC);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-xs, 3px);
  width: fit-content;
  margin-top: 0.25rem;
}

.notes-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
  color: var(--primary, #0F3D56);
  background: var(--brand-soft, #EDF4FF);
  border: 1px solid var(--border, #D9E2EC);
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm, 4px);
}

.negotiation-summary-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 0.85rem 1rem;
  border-radius: var(--radius-sm, 4px);
  margin-top: 1rem;
}

/* RFQ currency conversion summary */
.currency-conversion-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  background: var(--primary-soft);
  border: 1px solid var(--border);
  border-inline-start: 3px solid var(--primary);
  padding: 0.85rem 1rem;
  border-radius: var(--radius-sm, 4px);
  margin-top: 1rem;
}

.currency-conversion-banner strong {
  color: var(--primary);
}

.currency-conversion-banner p {
  margin: 0.15rem 0 0;
  font-size: 12px;
  color: var(--fg-muted);
}

.rfq-item-conversion {
  font-size: 11px;
  color: var(--fg-muted);
}

.amount-conversion {
  font-size: 11px;
  font-weight: 400;
  color: var(--fg-muted);
  margin-top: 2px;
}

.negotiation-summary-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.negotiation-reason-text {
  font-size: 12px;
  color: #065f46;
  margin: 0;
  padding-inline-start: 2rem;
}

/* Sidebar */
.side-panel {
  display: flex;
  flex-direction: column;
  gap: var(--wl-page-gap, 1.25rem);
}

.card {
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-card, 8px);
  padding: var(--wl-card-padding, 1.25rem);
  box-shadow: var(--shadow-sm);
}

.side-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--primary, #0F3D56);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin: 0;
}

.amount-val-box {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-top: 0.65rem;
}

.amount-label {
  font-size: 11px;
  color: var(--fg-muted, #627D98);
  font-weight: 700;
}

.amount-big {
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--fg-heading, #102A43);
}

.linked-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.linked-desc {
  font-size: 12px;
  color: var(--fg-muted, #627D98);
  margin: 0.5rem 0 1rem;
  line-height: 1.45;
}

.attach-card {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.attach-link {
  font-size: 11.5px;
  color: var(--secondary, #147D92);
  word-break: break-all;
}

.btn-view-quote {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 44px;
  width: 100%;
  background: var(--primary, #0F3D56);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm, 4px);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px -1px rgba(15, 61, 86, 0.25);
  transition: all 0.18s ease;
}

.btn-view-quote:hover {
  background: var(--color-brand-800, #0B2B3D);
}

.side-actions-stack {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.btn-back-rfqs {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 44px;
  background: var(--surface, #ffffff);
  color: var(--fg-muted, #627D98);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-sm, 4px);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-back-rfqs:hover {
  border-color: var(--primary, #0F3D56);
  color: var(--primary, #0F3D56);
  background: var(--brand-soft, #EDF4FF);
}

.btn-create-rfq {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 44px;
  background: var(--brand-soft, #EDF4FF);
  color: var(--primary, #0F3D56);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-sm, 4px);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-create-rfq:hover {
  background: var(--primary, #0F3D56);
  color: #ffffff;
}

@media (max-width: 900px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>





