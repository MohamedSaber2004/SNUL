<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { useCart } from '../../composables/useCart'
import { commerceService, salesService, companyService, authService, services } from '../../di/container'
import ChainSteps from '../../components/ui/ChainSteps.vue'
import BackButton from '../../components/ui/BackButton.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { distinctCurrenciesFromAddresses } from '../../utils/country-currency-map'

const router = useRouter()
const {
  items,
  displayTotal,
  targetCurrency,
  lineCount,
  quoteNote,
  clear,
  getServerLine,
  resolveCurrencyId,
  setTargetCurrency,
  unconvertedIds,
  totalPending,
  canSubmitOrder,
  refreshServerTotal,
  toRfqItems,
} = useCart()

/** Integer thousands formatting; null renders as "…" (total not quoted yet). */
const fmtQuote = (v: number | null) =>
  v == null ? '…' : v.toLocaleString(locale.value === 'ar' ? 'ar-EG' : 'en-US')

const localized = (en: string, ar: string) => (locale.value === 'ar' ? ar : en)

const placing = ref(false)
const submittingRfq = ref(false)
const error = ref<string | null>(null)
/** Flips as soon as the order is accepted so the step indicator advances
 *  before the redirect, instead of being pinned to a hardcoded 1. */
const orderPlaced = ref(false)
const isRefreshingRates = ref(false)

const checkoutStep = computed(() => (orderPlaced.value || placing.value ? 2 : 1))

/** Reason the CTAs are blocked, for aria-describedby / title on both of them. */
const blockedReason = computed(() =>
  unconvertedIds.value.length
    ? t('cart.rateUnavailable', { count: unconvertedIds.value.length })
    : '',
)

const addressCurrencyOptions = ref<string[]>([])

/** Switching the quote currency re-prices the cart, so any stale error about
 *  the previous total must go with it. */
function selectCurrency(code: string) {
  error.value = null
  setTargetCurrency(code)
}

async function handleRefreshRates() {
  if (isRefreshingRates.value) return
  isRefreshingRates.value = true
  error.value = null
  try {
    services.exchangeRateService.clearCache()
    await refreshServerTotal(true)
    toastService.success(t('cart.liveRateBadge'))
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('common.networkError')
  } finally {
    isRefreshingRates.value = false
  }
}

onMounted(async () => {
  if (!items.value.length) {
    void router.replace({ name: 'marketplace' })
    return
  }
  // Needed to resolve the cart currency code to its id for the order payload.
  void services.marketplaceService.loadCurrencies().catch(() => {})
  try { await services.exchangeRateService.loadLatest('USD') } catch { }
  try { await refreshServerTotal() } catch { }
  // Derive address-based currency options
  try {
    await services.locationService.loadCountries().catch(() => {})
    await companyService.loadMyCompany().catch(() => {})
    const cid = companyService.myCompany.value?.id
    if (cid) {
      await companyService.loadCompanyAddresses(cid).catch(() => {})
      const addrs = companyService.companyAddresses.value as unknown as { countryId: string }[]
      const countries = services.locationService.countries.value as unknown as { id: string; code?: string | null; nameEn?: string | null; nameAr?: string | null }[]
      addressCurrencyOptions.value = distinctCurrenciesFromAddresses(addrs, countries)
    }
  } catch { }
})

async function placeOrder() {
  if (!items.value.length || placing.value) return
  // Never submit a cart whose total is unknown: `canSubmitOrder` is false while
  // the quote is pending or any line failed currency conversion.
  if (!canSubmitOrder.value) {
    error.value = blockedReason.value || t('common.error')
    return
  }
  placing.value = true
  error.value = null
  try {
    const code = targetCurrency.value.toUpperCase()
    // useCart already upper-cases both sides of the code→id lookup, so a
    // lower-case currency code in the DB still resolves. Reusing it here is
    // what stopped the order payload losing `currencyId`.
    const currencyId = resolveCurrencyId()
    const res = await commerceService.placeOrder({
      userId: authService.user.value?.id ?? undefined,
      companyId: companyService.myCompany.value?.id ?? undefined,
      currencyId,
      currencyCode: code,
      // `convertedUnit` is the single rounded figure the cart displays; the old
      // inline map sent the un-rounded one and disagreed with its own total.
      items: items.value.map((i) => ({ productId: i.product.id, quantity: i.quantity, unitPrice: getServerLine(i.product.id)?.convertedUnit ?? i.product.price })),
    })
    if (res.ok && res.order) {
      orderPlaced.value = true
      clear()
      void router.replace({ name: 'order-confirmation', params: { orderNumber: res.order.orderNumber } })
    } else if (!res.ok) {
      error.value = res.error
    }
  } catch (err) {
    // A synchronous throw (or a rejected promise) must not abort silently.
    error.value = err instanceof Error ? err.message : t('common.networkError')
  } finally {
    placing.value = false
  }
}

async function convertToQuote() {
  if (!items.value.length || submittingRfq.value) return
  if (!authService.isAuthenticated) {
    void router.push({ name: 'login', query: { redirect: '/checkout' } })
    return
  }
  if (!canSubmitOrder.value) {
    error.value = blockedReason.value || t('common.error')
    return
  }
  error.value = null
  await companyService.loadMyCompany()
  const company = companyService.myCompany.value
  if (!company) { toastService.info(t('distributor.pendingApproval')); return }
  submittingRfq.value = true
  try {
    const tCur = targetCurrency.value.toUpperCase()
    const firstProductCurrency = (items.value[0]?.product.currencyCode || items.value[0]?.product.currency || 'USD').toUpperCase()
    const currencyHeaderPrefix = `[REQUESTED_CURRENCY: ${tCur} (Base: ${firstProductCurrency})]`
    const finalNote = quoteNote.value ? `${currencyHeaderPrefix}\n\n${quoteNote.value}` : currencyHeaderPrefix

    const res = await salesService.createRfq({
      companyId: company.id,
      note: finalNote,
      // toRfqItems() carries the same rounded unit price the summary shows plus
      // the per-line currency note. Building items inline here would send the
      // raw product price and silently drop the conversion.
      items: toRfqItems(),
    })
    if (res.ok && res.rfq) {
      clear()
      toastService.success(t('sales.rfqSubmitted', { rfqNumber: res.rfq.rfqNumber }))
      void router.push({ name: 'account-rfq-detail', params: { id: res.rfq.id } })
    } else if (!res.ok) error.value = res.error
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('common.networkError')
  } finally { submittingRfq.value = false }
}
</script>

<template>
  <div class="page-shell checkout-page">
    <!-- Breadcrumb & Back -->
    <div class="checkout-nav">
      <BackButton fallback="/cart" variant="ghost" />
      <nav class="breadcrumb mono" :aria-label="t('common.breadcrumb')">
        <router-link to="/marketplace">{{ t('nav.marketplace') }}</router-link>
        <span class="sep icon--directional" aria-hidden="true">/</span>
        <router-link to="/cart">{{ t('nav.cart') }}</router-link>
        <span class="sep icon--directional" aria-hidden="true">/</span>
        <span class="current">{{ t('nav.checkout') }}</span>
      </nav>
    </div>

    <!-- Header Section -->
    <header class="checkout-hero">
      <div class="checkout-hero__info">
        <div class="checkout-eyebrow mono">
          <span class="secure-dot" aria-hidden="true"></span>
          <span>{{ t('checkout.secureTitle') }}</span>
        </div>
        <h1 class="checkout-title">{{ t('commerce.checkoutTitle') }}</h1>
        <p class="checkout-desc">{{ t('commerce.checkoutSubtitle') }}</p>
      </div>
    </header>

    <!-- Progress Stepper -->
    <div class="stepper-wrap">
      <ChainSteps
        :steps="[t('marketplace.quoteCart'), t('commerce.orderSummary'), t('commerce.orderConfirmationTitle')]"
        :current="checkoutStep"
      />
    </div>

    <!-- Localised headline + the server detail, instead of a raw untranslated
         string. Cleared on every retry / CTA press. -->
    <div v-if="error" class="modal-error checkout-error" role="alert" aria-live="assertive">
      <span class="material-symbols-outlined text-[18px]">error</span>
      <span class="checkout-error__text">
        <strong>{{ t('common.error') }}</strong>
        <span>{{ error }}</span>
      </span>
    </div>

    <div class="checkout-layout">
      <!-- Left Column: Order Items -->
      <main class="checkout-main">
        <!-- Currency Selection Row - address based -->
        <div class="curr-selector-card">
          <div class="curr-selector-left">
            <span class="mono curr-label">{{ t('checkout.currency') }}:</span>
            <div class="curr-chips">
              <template v-if="addressCurrencyOptions.length>1">
                <button v-for="code in addressCurrencyOptions" :key="code" type="button" class="curr-chip mono" :class="{ active: code===targetCurrency }" @click="selectCurrency(code)">{{ code }}</button>
              </template>
              <span v-else class="curr-chip mono active" :title="t('checkout.exchangeLocked')">{{ targetCurrency }}</span>
            </div>
          </div>
          <span class="curr-lock mono">{{ addressCurrencyOptions.length>1 ? t('cart.activeCurrency') : t('checkout.exchangeLocked') }}</span>
        </div>
        <!-- An unconverted line has no price, so the total is unknown: a hard
             error (not a warning) that blocks both CTAs until the buyer retries. -->
        <div v-if="unconvertedIds.length" id="rate-error" class="rate-error mono" role="alert">
          <span class="material-symbols-outlined text-[15px]">error</span>
          <span class="rate-error__text">{{ t('cart.rateUnavailable', { count: unconvertedIds.length }) }}</span>
          <button
            type="button"
            class="rate-retry-btn mono"
            :disabled="isRefreshingRates"
            @click="handleRefreshRates"
          >
            <span class="material-symbols-outlined text-[15px]" :class="{ 'spin-anim': isRefreshingRates }">refresh</span>
            <span>{{ t('common.retry') }}</span>
          </button>
        </div>

        <!-- Verified Items Summary Section -->
        <section class="checkout-card" aria-labelledby="items-heading">
          <div class="checkout-card__head">
            <h2 id="items-heading" class="card-heading">
              <span>{{ t('commerce.orderSummary') }}</span>
              <span class="item-count-chip mono">{{ t('account.itemsCount', { count: lineCount }) }}</span>
            </h2>
          </div>

          <div class="line-items-list">
            <article v-for="it in items" :key="it.product.id" class="line-item">
              <div class="line-item__thumb" :style="{ background: it.product.imageGradient || 'var(--wl-surface-soft)' }">
                <AppImage
                  :src="it.product.imageName"
                  placeholder-type="product"
                  :placeholder-text="it.product.sku"
                  :alt="localized(it.product.nameEn, it.product.nameAr)"
                  fit="contain"
                  class="line-item__thumb-img"
                />
              </div>

              <div class="line-item__info">
                <h3 class="line-item__name">{{ localized(it.product.nameEn, it.product.nameAr) }}</h3>
                <div class="line-item__sub mono">
                  <span>SKU: {{ it.product.sku }}</span>
                  <!-- Never invent a material spec for an order line: an empty
                       `material` means we do not know it, and this text reaches
                       a commercial summary and the RFQ. -->
                  <template v-if="it.product.material">
                    <span class="dot-sep" aria-hidden="true">•</span>
                    <span>{{ it.product.material }}</span>
                  </template>
                </div>
              </div>

              <div class="line-item__pricing">
                <!-- Same rounded figure the summary total is summed from. -->
                <div class="mono line-item__calc">
                  <span>{{ it.quantity }} × {{ fmtQuote(getServerLine(it.product.id)?.convertedUnit ?? null) }} {{ targetCurrency }}</span>
                </div>
                <strong class="mono line-item__total">
                  {{ fmtQuote(getServerLine(it.product.id)?.lineTotal ?? null) }} {{ targetCurrency }}
                </strong>
              </div>
            </article>
          </div>
        </section>

      </main>

      <!-- Right Column: Commercial Summary (Sticky) -->
      <aside class="checkout-summary-col">
        <div class="summary-card">
          <div class="summary-head">
            <h2 class="summary-title">{{ t('commerce.orderSummary') }}</h2>
            <span class="summary-badge mono">{{ t('checkout.escrowSecure') }}</span>
          </div>

          <div class="summary-rows">
            <div class="summary-row">
              <span class="mono">{{ lineCount }} {{ t('marketplace.products') }}</span>
              <span class="summary-curr mono">{{ targetCurrency }}</span>
            </div>

            <div class="summary-row">
              <span class="mono">{{ t('commerce.subtotal') }}</span>
              <strong class="mono">{{ fmtQuote(displayTotal) }} {{ targetCurrency }}</strong>
            </div>

            <!-- The "Duties & Taxes" row used to render a label with no value at
                 all, so the total silently equalled the subtotal. It is gone;
                 the note below states plainly that duties are not included. -->

            <div class="summary-divider"></div>

            <div class="summary-row summary-row--total">
              <span class="total-label mono">{{ t('commerce.total') }}</span>
              <strong class="total-val mono">
                {{ fmtQuote(displayTotal) }} <span class="total-curr">{{ targetCurrency }}</span>
              </strong>
            </div>

            <div v-if="totalPending && !unconvertedIds.length" class="total-pending mono" aria-live="polite">
              <span class="material-symbols-outlined text-[15px] spin-anim">hourglass_top</span>
              <span>{{ t('common.loading') }}</span>
            </div>
          </div>

          <div class="summary-note-box mono">
            <span class="material-symbols-outlined text-[15px]">info</span>
            <span>{{ t('commerce.dutiesNote') }}</span>
          </div>

          <div class="summary-actions">
            <button
              class="btn btn-primary btn-block btn-lg"
              type="button"
              :disabled="placing || !canSubmitOrder"
              :title="!canSubmitOrder ? blockedReason || undefined : undefined"
              :aria-describedby="!canSubmitOrder && unconvertedIds.length ? 'rate-error' : undefined"
              @click="placeOrder"
            >
              <span class="material-symbols-outlined text-[18px]">verified</span>
              <span>{{ placing ? t('commerce.placingOrder') : t('commerce.placeOrder') }}</span>
            </button>

            <button
              class="btn btn-ghost btn-block"
              type="button"
              :disabled="submittingRfq || !canSubmitOrder"
              :title="!canSubmitOrder ? blockedReason || undefined : undefined"
              :aria-describedby="!canSubmitOrder && unconvertedIds.length ? 'rate-error' : undefined"
              @click="convertToQuote"
            >
              <span class="material-symbols-outlined text-[16px]">request_quote</span>
              <span>{{ t('checkout.convertToQuote') }}</span>
            </button>

            <router-link to="/cart" class="btn btn-ghost btn-block btn-sm">
              <span class="material-symbols-outlined text-[16px] icon--directional">arrow_back</span>
              <span>{{ t('common.back') }}</span>
            </router-link>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.checkout-page {
  width: 100%;
}

.checkout-nav {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

/* Kept byte-identical to the cart breadcrumb: same scale, spacing, hover and
   current-crumb treatment on both commerce steps. */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--wl-muted);
}

.breadcrumb a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.breadcrumb a:hover {
  color: var(--wl-primary);
}

.breadcrumb a:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.breadcrumb .sep {
  color: var(--wl-border);
}

.breadcrumb .current {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

/* Header */
.checkout-hero {
  margin-bottom: var(--space-6);
}

.checkout-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: var(--space-1);
}

.secure-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: var(--wl-success);
  box-shadow: 0 0 0 3px rgba(var(--wl-success-rgb), 0.2);
}

.checkout-title {
  font-family: var(--wl-font-display);
  font-size: clamp(var(--text-3xl), 3.2vw, var(--text-4xl));
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  line-height: 1.1;
  margin: 0 0 var(--space-1);
}

.checkout-desc {
  font-size: var(--text-base);
  color: var(--wl-ink-soft);
  margin: 0;
}

.stepper-wrap {
  margin-bottom: var(--space-8);
}

/* Layout */
.checkout-layout {
  display: grid;
  grid-template-columns: 1fr 390px;
  gap: var(--space-8);
  align-items: start;
}

.checkout-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Currency Card — one card radius for the whole marketplace surface. */
.curr-selector-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  flex-wrap: wrap;
  gap: var(--space-3);
}

.curr-selector-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.curr-label {
  font-size: var(--step--1);
  color: var(--wl-muted);
  font-weight: 700;
  letter-spacing: 0.06em;
}

/* An unconverted line leaves the total unknown, so this is a blocking error
   (danger tokens + retry) rather than an advisory warning. */
.rate-error {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--wl-danger-soft);
  border: 1px solid var(--wl-danger);
  color: var(--wl-danger);
  border-radius: var(--radius-md);
  font-size: var(--step--1);
  font-weight: 600;
}

.rate-error__text {
  flex: 1;
  min-width: 0;
}

.rate-retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 32px;
  padding: 0 var(--space-3);
  background: var(--wl-surface);
  border: 1px solid var(--wl-danger);
  border-radius: var(--radius-sm);
  color: var(--wl-danger);
  font-size: var(--step--1);
  font-weight: 700;
  cursor: pointer;
}

.rate-retry-btn:hover:not(:disabled) {
  background: var(--wl-danger);
  color: var(--wl-on-primary);
}

.rate-retry-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.rate-retry-btn:focus-visible {
  outline: 2px solid var(--wl-danger);
  outline-offset: 2px;
}

.spin-anim {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Localised headline plus the server detail. */
.checkout-error {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.checkout-error__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.curr-chips {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* Was ~28px tall. Desktop gets 32px; touch gets the 44px floor. */
.curr-chip {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--wl-border);
  font-size: var(--step--1);
  background: var(--wl-surface-soft);
  color: var(--wl-ink-soft);
  cursor: pointer;
  border-radius: var(--radius-full);
  font-weight: 700;
  transition: all 0.16s var(--wl-ease-spring);
}

.curr-chip:hover:not(:disabled) {
  border-color: var(--wl-primary);
  color: var(--wl-primary);
}

.curr-chip:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.curr-chip.active {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border-color: var(--wl-primary);
  box-shadow: var(--wl-primary-shadow);
}

.curr-lock {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

/* Cards */
.checkout-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-card);
  padding: var(--space-5);
  box-shadow: var(--shadow-card);
}

.checkout-card__head {
  margin-bottom: var(--space-4);
}

.card-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--wl-font-display);
  font-size: var(--text-xl);
  font-weight: 800;
  letter-spacing: -0.015em;
  color: var(--wl-ink-strong);
  margin: 0;
}

.item-count-chip {
  font-size: var(--step--1);
  font-weight: 600;
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
}

/* Line items */
.line-items-list {
  display: flex;
  flex-direction: column;
}

.line-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--wl-surface-soft);
}

.line-item:last-child {
  border-bottom: none;
}

.line-item__thumb {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  border: 1px solid var(--wl-border);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}

/* `fit="contain"` is set on the <AppImage> child, which owns the object-fit.
   Declaring `cover` here fought it and cropped surgical instruments. */
.line-item__thumb-img {
  width: 100%;
  height: 100%;
}

.line-item__info {
  flex: 1;
  min-width: 0;
}

.line-item__name {
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0 0 var(--space-1);
  line-height: 1.3;
}

.line-item__sub {
  font-size: var(--step--1);
  color: var(--wl-muted);
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.dot-sep {
  opacity: 0.5;
}

.line-item__pricing {
  text-align: end;
  flex-shrink: 0;
}

.line-item__calc {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.line-item__total {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
  font-weight: 700;
}

/* Summary Card */
.checkout-summary-col {
  position: sticky;
  top: calc(var(--wl-header-height) + 20px);
}

.summary-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-card);
  padding: var(--space-5);
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
}

.summary-card::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--wl-gradient-gold);
}

.summary-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.summary-title {
  font-family: var(--wl-font-display);
  font-size: var(--text-xl);
  font-weight: 800;
  letter-spacing: -0.015em;
  color: var(--wl-ink-strong);
  margin: 0;
}

/* Was green here and brand-navy in the cart. The two files render the same
   commercial summary surface, so they now share one badge treatment. */
.summary-badge {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid var(--wl-border);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
}

.summary-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--step-0);
}

.summary-divider {
  height: 1px;
  background: var(--wl-border);
  margin: var(--space-1) 0;
}

.summary-curr {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
}

.total-label {
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.total-val {
  font-size: var(--text-2xl);
  font-weight: 800;
  color: var(--wl-ink-strong);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.total-curr {
  font-size: var(--text-base);
  color: var(--wl-primary);
}

.total-pending {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.summary-note-box {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--step--1);
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin: var(--space-4) 0 var(--space-5);
  line-height: 1.5;
}

.summary-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

@media (max-width: 980px) {
  .checkout-layout {
    grid-template-columns: 1fr;
  }
  .checkout-summary-col {
    position: static;
  }
}

/* Let a line item reflow instead of pushing the page sideways. */
@media (max-width: 480px) {
  .line-item {
    flex-wrap: wrap;
  }
  .line-item__info {
    flex: 1;
  }
  .line-item__pricing {
    width: 100%;
    text-align: start;
  }
}

/* --wl-touch-min floor for touch pointers. */
@media (pointer: coarse) {
  .curr-chip {
    min-height: var(--wl-touch-min);
  }
  .rate-retry-btn {
    min-height: var(--wl-touch-min);
  }
}
</style>




