<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { commerceService, companyService, salesService, services } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import AccountNav from '../../components/account/AccountNav.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import DataState from '../../components/ui/DataState.vue'
import BackButton from '../../components/ui/BackButton.vue'
import type { QuoteDto } from '../../domain/models/sales'
import { formatPrice } from '../../utils/format'

const route = useRoute()
const router = useRouter()
const quote = ref<QuoteDto | null>(null)
const loading = ref(true)
const acting = ref(false)
const placingOrder = ref(false)

const localized = (en: string, ar: string) => (locale.value === 'ar' ? ar : en)

onMounted(async () => {
  try {
    const id = String(route.params.id)
    const found = await salesService.getQuote(id)
    quote.value = found
  } finally {
    loading.value = false
  }
})

async function decide(approve: boolean) {
  if (!quote.value) return
  const ok = await confirmService.confirm({
    title: t(approve ? 'sales.approve' : 'sales.decline'),
    message: t(approve ? 'sales.approveConfirm' : 'sales.declineConfirm'),
    variant: approve ? 'primary' : 'danger',
    confirmText: t(approve ? 'sales.approve' : 'sales.decline'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return
  acting.value = true
  try {
    const res = approve
      ? await salesService.approveQuote(quote.value.id)
      : await salesService.declineQuote(quote.value.id)
    if (res.ok) {
      const refreshed = await salesService.getQuote(quote.value.id)
      if (refreshed) quote.value = refreshed
    } else {
      toastService.error(res.error)
    }
  } finally {
    acting.value = false
  }
}

async function placeOrderFromQuote() {
  if (!quote.value || !quote.value.items.length || placingOrder.value) return
  const ok = await confirmService.confirm({
    title: t('sales.placeOrder'),
    message: t('sales.placeOrderConfirm'),
    variant: 'primary',
    confirmText: t('sales.placeOrder'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return
  placingOrder.value = true
  try {
    let companyId: string | undefined
    const rfq = await salesService.getRfq(quote.value.rfqId)
    companyId = rfq?.companyId
    if (!companyId) {
      await companyService.loadMyCompany().catch(() => {})
      companyId = companyService.myCompany.value?.id ?? undefined
    }
    if (!companyId) {
      toastService.info(t('distributor.pendingApproval'))
      return
    }
    const myCompanyId = companyService.myCompany.value?.id
    if (myCompanyId && rfq && rfq.companyId !== myCompanyId) {
      toastService.error(t('common.error'))
      return
    }
    const currencyCode = quote.value.currency || 'USD'
    const currencyId = services.marketplaceService.currencies.value.find((c) => c.code === currencyCode)?.id
    const res = await commerceService.placeOrder({
      companyId,
      currencyId,
      currencyCode,
      quoteId: quote.value.id,
      items: quote.value.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    })
    if (res.ok && res.order) {
      void router.push({ name: 'account-order-detail', params: { id: res.order.id } })
    } else if (!res.ok) {
      toastService.error(res.error)
    }
  } finally {
    placingOrder.value = false
  }
}
</script>

<template>
  <div class="page-shell quote-detail-view">
    <BackButton fallback="/account/quotes" variant="minimal" class="mb-3" />

    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/account">{{ t('account.dashboard') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <router-link to="/account/quotes">{{ t('sales.quoteTitle') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ quote?.quoteNumber ?? '…' }}</span>
    </nav>

    <SkeletonLoader v-if="loading" type="order-detail" />
    <DataState
      v-else-if="!quote"
      :empty="true"
      :empty-title="t('sales.noQuotes')"
      :empty-description="t('sales.noQuotesDesc')"
      :action-text="t('account.quotes')"
      min-height="320px"
      @action="router.push({ name: 'account-quotes' })"
    />

    <template v-else-if="quote">
      <header class="detail-header">
        <div class="header-main">
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('account.quoteDossier', { count: quote.items.length }) }}</span>
          </div>
          <h1 class="mono quote-heading">{{ quote.quoteNumber }}</h1>
          <p class="mono quote-sub">
            <span>{{ t('account.refRfq', { number: quote.rfqNumber ?? '' }) }}</span>
            <span>•</span>
            <span>{{ t('account.validThroughDate', { date: new Date(quote.validUntil).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }) }}</span>
          </p>
        </div>

        <StatusPill :status="quote.status" />
      </header>

      <AccountNav />

      <div class="detail-grid">
        <main class="manifest-card">
          <div class="manifest-head">
            <div class="manifest-title-group">
              <span class="material-symbols-outlined text-[18px] text-indigo-600">format_list_bulleted</span>
              <h2 class="manifest-title">{{ t('sales.lineItems') }}</h2>
            </div>
            <span class="mono item-chip">{{ t('account.itemsCount', { count: quote.items.length }) }}</span>
          </div>

          <div class="items-stack">
            <article v-for="it in quote.items" :key="it.id" class="line-item-row">
              <div class="item-primary">
                <h3 class="item-title">{{ localized(it.productNameEn, it.productNameAr || it.productNameEn) }}</h3>
                <div class="item-math mono">
                  <span>{{ t('account.qtyUnits', { count: it.quantity }) }}</span>
                  <span>•</span>
                  <span>{{ formatPrice(it.unitPrice, locale) }} {{ quote.currency || 'USD' }} {{ t('account.perUnitShort') }}</span>
                </div>
              </div>

              <div class="item-subtotal mono">
                {{ formatPrice(it.quantity * it.unitPrice, locale) }} {{ quote.currency || 'USD' }}
              </div>
            </article>
          </div>
        </main>

        <aside class="side-panel">
          <section class="card amount-card">
            <h2 class="side-title mono">{{ t('sales.amount') }}</h2>
            <div class="amount-val-box">
              <span class="mono amount-label">{{ t('commerce.total') }}</span>
              <strong class="mono amount-big">
                ${{ formatPrice(quote.amount, locale) }} {{ quote.currency || 'USD' }}
              </strong>
            </div>
            <div class="validity-row mono">
              <span class="material-symbols-outlined text-[15px] text-slate-400">schedule</span>
              <span>{{ t('account.validThroughDate', { date: new Date(quote.validUntil).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }) }}</span>
            </div>
          </section>

          <section
            v-if="quote.status === 'Sent' || quote.status === 'Draft'"
            class="card decision-card"
          >
            <h2 class="side-title mono">{{ t('account.quotesAwaiting') }}</h2>
            <p class="decision-desc mono">{{ t('sales.convertedToOrder') }}</p>

            <div class="decision-btns-stack">
              <button
                class="btn-approve mono"
                type="button"
                :disabled="acting"
                @click="decide(true)"
              >
                <span class="material-symbols-outlined text-[18px]">verified</span>
                <span>{{ acting ? t('account.processing') : t('sales.approve') }}</span>
              </button>
              <button
                class="btn-decline mono"
                type="button"
                :disabled="acting"
                @click="decide(false)"
              >
                <span class="material-symbols-outlined text-[18px]">cancel</span>
                <span>{{ t('sales.decline') }}</span>
              </button>
            </div>
          </section>

          <section v-else-if="quote.status === 'Approved'" class="card approved-card">
            <div class="approved-head mono">
              <span class="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{{ t('sales.statusApproved') }}</span>
            </div>
            <p class="decision-desc mono">{{ t('sales.convertedToOrder') }}</p>
            <button
              class="btn-place-order mono"
              type="button"
              :disabled="placingOrder || !quote.items.length"
              @click="placeOrderFromQuote"
            >
              <span class="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
              <span>{{ placingOrder ? t('sales.placingOrder') : t('sales.placeOrder') }}</span>
            </button>
            <button
              class="btn-view-order mono btn-view-order--secondary"
              type="button"
              @click="router.push({ name: 'account-orders' })"
            >
              <span class="material-symbols-outlined text-[16px]">receipt_long</span>
              <span>{{ t('account.orders') }}</span>
            </button>
          </section>

          <div class="side-actions-stack">
            <button
              type="button"
              class="btn-back-quotes mono"
              @click="router.push({ name: 'account-quotes' })"
            >
              <span class="material-symbols-outlined text-[16px] icon--directional">arrow_back</span>
              <span>{{ t('account.backToQuotes') }}</span>
            </button>
            <button
              type="button"
              class="btn-back-quotes mono"
              @click="router.push({ name: 'account-rfq-detail', params: { id: quote.rfqId } })"
            >
              <span class="material-symbols-outlined text-[16px]">description</span>
              <span>{{ t('sales.rfqDetail') }}</span>
            </button>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.quote-detail-view {
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

.quote-heading {
  font-size: 1.68rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.1;
}

.quote-sub {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11.5px;
  color: var(--wl-muted);
  margin: 0.35rem 0 0;
}

/* Detail 2-Column Grid */
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: var(--wl-page-gap, 1.5rem);
  align-items: start;
}

.manifest-card {
  background: var(--wl-surface);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-lg, 8px);
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
  border-bottom: 1px solid var(--wl-border);
}

.manifest-title-group {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.manifest-title {
  font-size: 14.5px;
  font-weight: 800;
  color: var(--fg-heading, #102A43);
  margin: 0;
}

.item-chip {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--border, #D9E2EC);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-xs, 3px);
}

.items-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.line-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--wl-border);
}

.item-primary {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.item-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--fg-heading, #102A43);
  margin: 0;
}

.item-math {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 11.5px;
  color: var(--fg-muted, #627D98);
}

.item-subtotal {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--fg-heading, #102A43);
}

/* Sidebar */
.side-panel {
  display: flex;
  flex-direction: column;
  gap: var(--wl-page-gap, 1.25rem);
}

.card {
  background: var(--wl-surface);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-lg, 8px);
  padding: var(--wl-card-padding, 1.25rem);
  box-shadow: var(--shadow-sm);
}

.side-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--brand);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin: 0 0 0.75rem;
}

.amount-val-box {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--wl-border);
}

.amount-label {
  font-size: 11px;
  color: var(--wl-muted);
  font-weight: 700;
}

.amount-big {
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.validity-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 11.5px;
  color: var(--wl-muted);
  margin-top: 0.65rem;
}

.decision-desc {
  font-size: 12px;
  color: var(--wl-muted);
  line-height: 1.45;
  margin: 0 0 1rem;
}

.decision-btns-stack {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.btn-approve {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 44px;
  background: var(--color-success-500, #198754);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm, 4px);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px -1px rgba(25, 135, 84, 0.25);
  transition: all 0.18s ease;
}

.btn-approve:hover:not(:disabled) {
  background: var(--color-success-600, #157347);
}

.btn-decline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 44px;
  background: var(--surface, #ffffff);
  color: var(--fg-danger, #DC3545);
  border: 1px solid var(--border-danger, #FFDAD6);
  border-radius: var(--radius-sm, 4px);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-decline:hover:not(:disabled) {
  background: var(--color-danger-50, #FFF8F7);
}

.approved-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 12px;
  font-weight: 700;
  color: var(--fg-success, #198754);
  margin-bottom: 0.4rem;
}

.btn-view-order {
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
}

.btn-place-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 44px;
  width: 100%;
  background: var(--color-success-500, #198754);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm, 4px);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px -1px rgba(25, 135, 84, 0.25);
  transition: all 0.18s ease;
  margin-bottom: 0.65rem;
}

.btn-place-order:hover:not(:disabled) {
  background: var(--color-success-600, #157347);
}

.btn-place-order:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-view-order--secondary {
  background: var(--surface, #ffffff);
  color: var(--primary, #0F3D56);
  border: 1px solid var(--border, #D9E2EC);
}

.side-actions-stack {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.btn-back-quotes {
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

.btn-back-quotes:hover {
  border-color: var(--primary, #0F3D56);
  color: var(--primary, #0F3D56);
  background: var(--brand-soft, #EDF4FF);
}

@media (max-width: 900px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>





