<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { useCart } from '../../composables/useCart'
import { salesService, companyService, authService, services, locationService } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import EmptyState from '../../components/ui/EmptyState.vue'
import QuantityStepper from '../../components/ui/QuantityStepper.vue'
import type { CurrencyDto } from '../../domain/models/marketplace'
import BackButton from '../../components/ui/BackButton.vue'
import AppImage from '../../components/ui/AppImage.vue'
import {
  distinctCurrenciesFromAddresses,
  resolveCurrencyCountry,
  currencyDisplaySymbol,
} from '../../utils/country-currency-map'

const router = useRouter()
const {
  items,
  displayTotal,
  serverTotalLoading,
  targetCurrency,
  count,
  quoteNote,
  unconvertedIds,
  setQty,
  remove,
  clear,
  setNote,
  toRfqItems,
  getServerLine,
  setTargetCurrency,
  refreshServerTotal,
} = useCart()
const localized = (en?: string | null, ar?: string | null) =>
  locale.value === 'ar' ? ar || en || '' : en || ar || ''
/** Backend totals only — no client-side math. Null until quoted. */
const fmtQuote = (v: number | null) =>
  v == null ? '…' : v.toLocaleString(locale.value === 'ar' ? 'ar-EG' : 'en-US')

const submittingRfq = ref(false)
const availableCurrencies = ref<CurrencyDto[]>([])
const addressCurrencies = ref<string[]>([])
const showCurrencyDropdown = ref(false)
const currencySearchQuery = ref('')
const currencyDropdownEl = ref<HTMLElement | null>(null)
const isRefreshingRates = ref(false)

// Total price negotiation state
const enableNegotiation = ref(false)
const targetProposedTotal = ref<number | null>(null)
const negotiationReason = ref('')

const requestedDiscountPercent = computed(() => {
  if (!displayTotal.value || !targetProposedTotal.value || targetProposedTotal.value >= displayTotal.value) return 0
  return Math.round(((displayTotal.value - targetProposedTotal.value) / displayTotal.value) * 100)
})

/** Base currencies present in the cart that differ from the target, so the
 *  buyer can see exactly what their RFQ is being converted from. */
const distinctBaseCurrencies = computed(() => {
  const set = new Set<string>()
  for (const it of items.value) {
    const c = (it.product.currencyCode || it.product.currency || 'USD').toUpperCase()
    if (c !== targetCurrency.value.toUpperCase()) set.add(c)
  }
  return Array.from(set)
})

function onDocumentClick(e: MouseEvent) {
  if (showCurrencyDropdown.value && currencyDropdownEl.value) {
    if (!currencyDropdownEl.value.contains(e.target as Node)) {
      showCurrencyDropdown.value = false
    }
  }
}

onMounted(async () => {
  document.addEventListener('click', onDocumentClick)
  try {
    await services.marketplaceService.loadCurrencies()
    availableCurrencies.value = services.marketplaceService.currencies.value.filter((c) => c.isActive)
  } catch {
    availableCurrencies.value = []
  }
  try { await services.exchangeRateService.loadLatest('USD') } catch { }
  try { await refreshServerTotal() } catch { }
  try {
    await services.locationService.loadCountries().catch(() => {})
    // /companies/my requires auth — skip for guests to avoid a 401.
    if (authService.isAuthenticated) {
      await companyService.loadMyCompany().catch(() => {})
      const cid = companyService.myCompany.value?.id
      if (cid) {
        await companyService.loadCompanyAddresses(cid).catch(() => {})
        const addrs = companyService.companyAddresses.value as unknown as { countryId: string }[]
        const countries = locationService.countries.value as unknown as { id: string; code?: string | null; nameEn?: string | null; nameAr?: string | null }[]
        const distinct = distinctCurrenciesFromAddresses(addrs, countries)
        addressCurrencies.value = distinct
        if (distinct.length > 0) {
          const current = targetCurrency.value.toUpperCase()
          if (!distinct.includes(current)) {
            const preferred = distinct[0] as string
            if (preferred) setTargetCurrency(preferred)
          }
        }
      }
    }
    if (items.value.length && targetCurrency.value === 'USD' && !addressCurrencies.value.length) {
      const firstCur = (items.value[0]?.product.currencyCode || 'USD').toUpperCase()
      if (firstCur !== 'USD') setTargetCurrency(firstCur)
    }
  } catch { }
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})

const activeCurrencyMeta = computed(() => {
  const code = targetCurrency.value.toUpperCase()
  const foundCur = availableCurrencies.value.find((c) => (c.code || '').toUpperCase() === code)
  const res = resolveCurrencyCountry(
    code,
    availableCurrencies.value,
    locationService.countries.value,
    locale.value,
  )
  const symbol = currencyDisplaySymbol(foundCur || { code }, locale.value)
  const isAddress = addressCurrencies.value.includes(code)
  return {
    code,
    symbol,
    countryName: localized(res.countryNameEn || null, res.countryNameAr || null),
    currencyName: localized(foundCur?.nameEn || res.currencyNameEn, foundCur?.nameAr || res.currencyNameAr),
    flag: res.flag,
    isAddress,
  }
})

interface QuickCurrencyOption {
  code: string
  symbol: string
  flag: string
  countryName: string
  currencyName: string
  title: string
  isAddress: boolean
}

// Distinct original currencies of items currently in the cart
const cartOriginalCurrencies = computed(() => {
  const set = new Set<string>()
  for (const it of items.value) {
    const code = (it.product.currencyCode || it.product.currency || 'USD').toUpperCase()
    if (code) set.add(code)
  }
  return Array.from(set)
})

// Curated list of quick switcher options (addresses + items + current + regional favorites)
const quickCurrencyOptions = computed<QuickCurrencyOption[]>(() => {
  const list: string[] = []
  for (const code of addressCurrencies.value) {
    if (code && !list.includes(code)) list.push(code)
  }
  for (const code of cartOriginalCurrencies.value) {
    if (code && !list.includes(code)) list.push(code)
  }
  const current = targetCurrency.value.toUpperCase()
  if (current && !list.includes(current)) list.push(current)

  for (const c of availableCurrencies.value.slice(0, 8)) {
    const code = (c.code || '').toUpperCase()
    if (code && !list.includes(code)) list.push(code)
  }

  return list.map((code) => {
    const found = availableCurrencies.value.find((c) => (c.code || '').toUpperCase() === code)
    const res = resolveCurrencyCountry(
      code,
      availableCurrencies.value,
      locationService.countries.value,
      locale.value,
    )
    const symbol = currencyDisplaySymbol(found || { code }, locale.value)
    const countryName = localized(res.countryNameEn || null, res.countryNameAr || null)
    const currencyName = localized(found?.nameEn || res.currencyNameEn, found?.nameAr || res.currencyNameAr)
    return {
      code,
      symbol,
      flag: res.flag,
      countryName,
      currencyName,
      title: countryName ? `${countryName} (${currencyName})` : `${currencyName} (${code})`,
      isAddress: addressCurrencies.value.includes(code),
    }
  })
})

// Searchable full list of all available currencies
const filteredAllCurrencies = computed(() => {
  const q = currencySearchQuery.value.trim().toLowerCase()
  const source = availableCurrencies.value

  return source
    .map((c) => {
      const code = (c.code || '').toUpperCase()
      const res = resolveCurrencyCountry(
        code,
        availableCurrencies.value,
        locationService.countries.value,
        locale.value,
      )
      const symbol = currencyDisplaySymbol(c, locale.value)
      const countryName = localized(res.countryNameEn || null, res.countryNameAr || null)
      const currencyName = localized(c.nameEn, c.nameAr)
      const isAddress = addressCurrencies.value.includes(code)
      return {
        code,
        symbol,
        flag: res.flag,
        countryName,
        currencyName,
        title: countryName || currencyName,
        isAddress,
      }
    })
    .filter((c) => {
      if (!c) return false
      if (!q) return true
      const matchCode = c.code ? String(c.code).toLowerCase().includes(q) : false
      const matchCountry = c.countryName ? String(c.countryName).toLowerCase().includes(q) : false
      const matchCurrency = c.currencyName ? String(c.currencyName).toLowerCase().includes(q) : false
      const matchSymbol = c.symbol ? String(c.symbol).toLowerCase().includes(q) : false
      return matchCode || matchCountry || matchCurrency || matchSymbol
    })
})

function selectCurrency(code: string) {
  setTargetCurrency(code)
  showCurrencyDropdown.value = false
  currencySearchQuery.value = ''
}

async function handleRefreshRates() {
  if (isRefreshingRates.value) return
  isRefreshingRates.value = true
  try {
    services.exchangeRateService.clearCache()
    await refreshServerTotal()
    toastService.success(t('cart.liveRateBadge'))
  } catch {
    // fallback
  } finally {
    isRefreshingRates.value = false
  }
}

const goCheckout = () => {
  if (!items.value.length) return
  void router.push({ name: 'checkout' })
}

const handleClear = async () => {
  const ok = await confirmService.confirm({
    title: t('common.delete'),
    message: t('cart.confirmClear'),
    variant: 'danger',
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return
  clear()
}

const handleRemove = async (id: string) => {
  const ok = await confirmService.confirm({
    title: t('marketplace.remove'),
    message: t('cart.confirmRemove'),
    variant: 'danger',
    confirmText: t('marketplace.remove'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return
  remove(id)
}

const submitRfq = async () => {
  if (!items.value.length || submittingRfq.value) return
  if (!authService.isAuthenticated) {
    toastService.info(t('sales.submitRfq'))
    void router.push({ name: 'login', query: { redirect: '/cart' } })
    return
  }
  if (enableNegotiation.value) {
    if (!targetProposedTotal.value || targetProposedTotal.value <= 0) {
      toastService.info(t('sales.targetPriceValidation'))
      return
    }
  }

  // Force-refresh company data (bypass cache) to guarantee we have a fresh companyId
  await companyService.loadMyCompany(true)
  const company = companyService.myCompany.value

  // Resolve companyId: prefer company.id, fall back to the id stored on the auth user
  const companyId: string | null | undefined =
    company?.id || authService.user.value?.companyId || null

  if (!companyId) {
    toastService.info(t('distributor.pendingApproval'))
    return
  }
  submittingRfq.value = true
  try {
    let finalNote = quoteNote.value || ''
    const tCur = targetCurrency.value.toUpperCase()
    const firstProductCurrency = (items.value[0]?.product.currencyCode || items.value[0]?.product.currency || 'USD').toUpperCase()
    // Tag the RFQ with the currency the buyer is negotiating in, so every
    // provider and sales rep can see the target without inferring it.
    const currencyHeaderPrefix = `[REQUESTED_CURRENCY: ${tCur} (Base: ${firstProductCurrency})]`
    if (enableNegotiation.value && targetProposedTotal.value) {
      const negotiationPrefix = `[PRICE_NEGOTIATION: TARGET_TOTAL=${targetProposedTotal.value} ${tCur} (Discount: ${requestedDiscountPercent.value}%)][REASON: ${negotiationReason.value || 'N/A'}]`
      finalNote = `${currencyHeaderPrefix}\n${negotiationPrefix}${finalNote ? `\n\n${finalNote}` : ''}`
    } else {
      finalNote = finalNote ? `${currencyHeaderPrefix}\n\n${finalNote}` : currencyHeaderPrefix
    }

    const res = await salesService.createRfq({
      companyId,
      note: finalNote || undefined,
      items: toRfqItems(),
    })
    if (res.ok && res.rfq) {
      clear()
      void router.push({ name: 'account-rfq-detail', params: { id: res.rfq.id } })
    } else if (!res.ok) {
      toastService.error(res.error)
    }
  } finally {
    submittingRfq.value = false
  }
}
</script>

<template>
  <div class="page-shell cart-page">
    <!-- Breadcrumb & Back Action -->
    <div class="cart-nav">
      <BackButton fallback="/marketplace" variant="ghost" />
      <nav class="breadcrumb mono" :aria-label="t('common.breadcrumb')">
        <router-link to="/">{{ t('nav.home') }}</router-link>
        <span class="sep icon--directional" aria-hidden="true">/</span>
        <router-link to="/marketplace">{{ t('nav.marketplace') }}</router-link>
        <span class="sep icon--directional" aria-hidden="true">/</span>
        <span class="current">{{ t('marketplace.quoteCart') }}</span>
      </nav>
    </div>

    <!-- Header Section -->
    <header class="cart-hero anim-fade-in-up">
      <div class="cart-hero__info">
        <div class="cart-eyebrow mono">
          <span class="cart-dot" aria-hidden="true"></span>
          <span>{{ t('cart.trayEyebrow', { count }) }}</span>
        </div>
        <h1 class="cart-title">{{ t('marketplace.quoteCart') }}</h1>
        <p class="cart-desc">{{ t('marketplace.checkoutSubtitle') }}</p>
      </div>

      <div class="cart-hero__actions">
        <button class="btn btn-ghost" type="button" @click="router.push({ name: 'marketplace' })">
          <span class="material-symbols-outlined text-[16px] icon--directional">arrow_back</span>
          <span>{{ t('marketplace.continueShopping') }}</span>
        </button>
        <button v-if="items.length" class="btn btn-ghost text-danger" type="button" @click="handleClear">
          <span class="material-symbols-outlined text-[16px]">delete_sweep</span>
          <span>{{ t('common.delete') }}</span>
        </button>
      </div>
    </header>

    <!-- Empty State -->
    <EmptyState
      v-if="!items.length"
      :title="t('marketplace.cartEmpty')"
      :description="t('marketplace.cartEmptyDesc')"
      :action-text="t('marketplace.browseMarketplace')"
      icon="shopping_basket"
      @action="router.push({ name: 'marketplace' })"
    />

    <!-- Cart Layout -->
    <div v-else class="cart-layout">
      <!-- Main Column: Sterile Tray Line Items -->
      <main class="cart-main">
        <!-- Active Currency Hub & Multi-Currency Switcher -->
        <section v-reveal class="currency-hub-card" aria-labelledby="curr-hub-heading">
          <!-- Left: Active Currency Status Dossier -->
          <div class="curr-hub__main">
            <div class="curr-hub__badge-group">
              <span class="fx-live-pill mono">
                <span class="fx-dot" :class="{ 'is-spinning': isRefreshingRates }"></span>
                <span>{{ t('cart.liveRateBadge') }}</span>
              </span>
              <span v-if="activeCurrencyMeta.isAddress" class="address-curr-badge mono">
                <span class="material-symbols-outlined text-[13px]">location_on</span>
                <span>{{ t('cart.addressCurrencyTag') }}</span>
              </span>
            </div>

            <div class="curr-hub__active-hero">
              <span class="active-flag" aria-hidden="true">{{ activeCurrencyMeta.flag }}</span>
              <div class="active-titles">
                <div class="active-code-line">
                  <strong class="active-code mono">{{ activeCurrencyMeta.code }}</strong>
                  <span class="active-symbol-badge mono">{{ activeCurrencyMeta.symbol }}</span>
                </div>
                <div class="active-country-desc">
                  <template v-if="activeCurrencyMeta.countryName">
                    <span>{{ activeCurrencyMeta.countryName }}</span>
                    <span class="dot-sep">•</span>
                  </template>
                  <span>{{ activeCurrencyMeta.currencyName }}</span>
                </div>
              </div>
            </div>

            <p class="curr-hub__hint mono">{{ t('cart.currencyHelp') }}</p>
          </div>

          <!-- Right: Smart Currency Switcher Chips & More Dropdown -->
          <div class="curr-hub__controls">
            <div class="chips-label-row">
              <span class="mono chips-lbl">{{ t('cart.activeCurrency') }}</span>
              <button
                type="button"
                class="btn-refresh-rates mono"
                :title="t('cart.refreshRates')"
                :disabled="isRefreshingRates"
                @click="handleRefreshRates"
              >
                <span class="material-symbols-outlined text-[15px]" :class="{ 'spin-anim': isRefreshingRates }">sync</span>
                <span>{{ t('cart.refreshRates') }}</span>
              </button>
            </div>

            <!-- Quick Pills -->
            <div class="curr-pills-wrap">
              <button
                v-for="opt in quickCurrencyOptions"
                :key="opt.code"
                type="button"
                class="curr-pill mono interactive-lift"
                :class="{ 'is-active': opt.code === targetCurrency }"
                :title="opt.title"
                @click="setTargetCurrency(opt.code)"
              >
                <span class="pill-flag">{{ opt.flag }}</span>
                <span class="pill-code">{{ opt.code }}</span>
                <span class="pill-sym">{{ opt.symbol }}</span>
                <span v-if="opt.isAddress" class="pill-addr-dot" :title="t('cart.addressCurrencyTag')">📍</span>
                <span v-if="opt.code === targetCurrency" class="material-symbols-outlined text-[13px] check-icon">check</span>
              </button>

              <!-- More Currencies Dropdown Trigger -->
              <div ref="currencyDropdownEl" class="more-curr-wrapper">
                <button
                  type="button"
                  class="curr-pill curr-pill--more mono"
                  :class="{ 'is-open': showCurrencyDropdown }"
                  @click.stop="showCurrencyDropdown = !showCurrencyDropdown"
                >
                  <span class="material-symbols-outlined text-[16px]">travel_explore</span>
                  <span>{{ t('cart.selectOtherCurrency') }}</span>
                  <span class="material-symbols-outlined text-[16px] chev-icon">expand_more</span>
                </button>

                <!-- Popover -->
                <div v-if="showCurrencyDropdown" class="curr-dropdown-popover" @click.stop>
                  <div class="popover-search-wrap">
                    <span class="material-symbols-outlined search-ic">search</span>
                    <input
                      v-model="currencySearchQuery"
                      type="text"
                      class="popover-search-input mono"
                      :placeholder="t('cart.searchCurrency')"
                      autofocus
                    />
                    <button
                      v-if="currencySearchQuery"
                      type="button"
                      class="clear-search-btn"
                      @click="currencySearchQuery = ''"
                    >
                      <span class="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>

                  <div class="popover-items-list">
                    <div v-if="!filteredAllCurrencies.length" class="popover-empty mono">
                      No currencies found
                    </div>
                    <button
                      v-for="c in filteredAllCurrencies"
                      :key="c.code"
                      type="button"
                      class="popover-item-btn mono"
                      :class="{ 'is-active': c.code === targetCurrency }"
                      @click="selectCurrency(c.code)"
                    >
                      <span class="p-flag">{{ c.flag }}</span>
                      <div class="p-info">
                        <div class="p-line-1">
                          <strong class="p-country">{{ c.title }}</strong>
                          <span v-if="c.isAddress" class="p-addr-badge">📍 {{ t('cart.addressCurrencyTag') }}</span>
                        </div>
                        <div class="p-line-2">
                          <span>{{ c.currencyName }}</span>
                        </div>
                      </div>
                      <span class="p-code-badge">{{ c.code }}</span>
                      <span class="p-sym-badge">{{ c.symbol }}</span>
                      <span v-if="c.code === targetCurrency" class="material-symbols-outlined text-[16px] text-indigo-600">check_circle</span>
                    </button>
                  </div>

                  <div class="popover-footer mono">
                    <span>{{ t('cart.allCurrenciesCount', { count: availableCurrencies.length || 155 }) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <div v-if="unconvertedIds.length" class="rate-warn mono" role="alert">
          <span class="material-symbols-outlined text-[14px]">warning</span>
          <span>{{ t('cart.rateUnavailable', { count: unconvertedIds.length }) }}</span>
        </div>

        <!-- Items Article List -->
        <section v-reveal class="cart-items-card" aria-labelledby="tray-heading">
          <div class="items-card-head">
            <h2 id="tray-heading" class="items-heading">
              <span>{{ t('cart.trayHeading') }}</span>
              <span class="items-count-pill mono">{{ t('cart.itemsCount', { count }) }}</span>
            </h2>
          </div>

          <div class="cart-lines-list">
            <article v-for="(it, i) in items" :key="it.product.id" v-reveal="i" class="cart-line">
              <div class="cart-line__media">
                <div class="cart-thumb" :style="{ background: it.product.imageGradient || 'var(--wl-surface-soft)' }">
                  <AppImage
                    :src="it.product.imageName"
                    placeholder-type="product"
                    :placeholder-text="it.product.sku"
                    :alt="localized(it.product.nameEn, it.product.nameAr)"
                    fit="contain"
                    class="cart-thumb__img"
                  />
                </div>

                <div class="cart-line__details">
                  <h3 class="cart-line__title" dir="auto">{{ localized(it.product.nameEn, it.product.nameAr) }}</h3>
                  <div class="cart-line__title-alt mono" dir="auto" :lang="locale === 'ar' ? 'en' : 'ar'">
                    {{ locale === 'ar' ? it.product.nameEn : it.product.nameAr }}
                  </div>
                  <div class="cart-line__meta mono">
                    <span>SKU: {{ it.product.sku }}</span>
                    <span class="dot">•</span>
                    <span>{{ t('marketplace.minOrder', { qty: it.product.minOrderQty }) }}</span>
                  </div>
                  <div class="cart-line__price mono">
                    <div class="active-unit-price">
                      <strong class="active-unit-val">{{ (getServerLine(it.product.id)?.ceiledUnit ?? Math.ceil(it.product.price)).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ (it.product.currencyCode || 'USD').toUpperCase() }}</strong>
                      <span class="active-unit-per">{{ t('account.perUnitShort') }}</span>
                    </div>
                    <div v-if="getServerLine(it.product.id)" class="orig-price-wrap">
                      <span class="orig-pill">≈ {{ getServerLine(it.product.id)!.convertedUnit.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ targetCurrency }}</span>
                      <span class="material-symbols-outlined text-[12px] conv-arrow icon--directional">arrow_forward</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="cart-line__controls">
                <QuantityStepper
                  :model-value="it.quantity"
                  :min="it.product.minOrderQty"
                  :max="it.product.stock"
                  @update:model-value="setQty(it.product.id, $event)"
                />

                <div class="cart-line__total mono">
                  <span class="total-lbl">{{ t('commerce.subtotal') }}</span>
                  <strong class="total-fig">
                    <span class="total-sym">{{ activeCurrencyMeta.symbol }}</span>
                    <span>{{ fmtQuote(getServerLine(it.product.id)?.lineTotal ?? null) }}</span>
                    <span class="total-code">{{ targetCurrency }}</span>
                  </strong>
                </div>

                <button
                  type="button"
                  class="line-remove-btn"
                  :title="t('marketplace.remove')"
                  :aria-label="t('marketplace.remove')"
                  @click="handleRemove(it.product.id)"
                >
                  <span class="material-symbols-outlined text-[18px]">delete_outline</span>
                </button>
              </div>
            </article>
          </div>
        </section>
      </main>

      <!-- Right Column: Order / Quote Summary -->
      <aside class="cart-summary-col">
        <div class="summary-card anim-fade-in-up">
          <div class="summary-head">
            <h2 class="summary-title">{{ t('commerce.orderSummary') }}</h2>
            <span class="summary-badge mono">{{ t('cart.directRfqBadge') }}</span>
          </div>

          <div class="summary-rows">
            <div class="summary-row">
              <span class="mono">{{ count }} {{ t('marketplace.products') }}</span>
              <strong class="mono">{{ activeCurrencyMeta.symbol }} {{ fmtQuote(displayTotal) }} {{ targetCurrency }}</strong>
            </div>

            <div class="summary-divider"></div>

            <div class="summary-row summary-row--total">
              <span class="total-lbl mono">{{ t('commerce.total') }}</span>
              <strong class="total-val mono">
                <span class="total-sym">{{ activeCurrencyMeta.symbol }}</span>
                <span>{{ fmtQuote(displayTotal) }}</span>
                <span class="total-curr">{{ targetCurrency }}</span>
                <span v-if="serverTotalLoading" class="mono" aria-hidden="true">…</span>
              </strong>
            </div>

            <div class="fx-live-note">
              <span class="material-symbols-outlined text-[15px] text-emerald-600">currency_exchange</span>
              <span>{{ t('cart.currencyHelp') }}</span>
            </div>
          </div>

          <!-- Notes Section -->
          <div class="notes-block">
            <label for="cart-quote-notes" class="notes-lbl mono">{{ t('sales.notes') }}</label>
            <textarea
              id="cart-quote-notes"
              :value="quoteNote"
              :placeholder="t('marketplace.quoteNotePlaceholder')"
              rows="3"
              class="notes-textarea"
              @input="setNote(($event.target as HTMLTextAreaElement).value)"
            ></textarea>
          </div>

          <!-- Price Negotiation Section -->
          <div class="negotiation-card" :class="{ 'is-active': enableNegotiation }">
            <div class="negotiation-toggle" @click="enableNegotiation = !enableNegotiation">
              <label class="toggle-checkbox" @click.stop>
                <input
                  v-model="enableNegotiation"
                  type="checkbox"
                  class="sr-only"
                />
                <span class="custom-checkbox" :class="{ 'is-checked': enableNegotiation }">
                  <span v-if="enableNegotiation" class="material-symbols-outlined text-[14px]">check</span>
                </span>
              </label>
              <div class="toggle-text">
                <span class="negotiation-title mono">{{ t('sales.negotiateTotal') }}</span>
                <p class="negotiation-desc">{{ t('sales.negotiateTotalDesc') }}</p>
              </div>
            </div>

            <div v-if="enableNegotiation" class="negotiation-fields">
              <div class="form-group">
                <div class="field-label-row">
                  <label for="cart-target-price" class="notes-lbl mono">{{ t('sales.proposedTarget') }}</label>
                  <span v-if="requestedDiscountPercent > 0" class="discount-pill mono">
                    -{{ requestedDiscountPercent }}% {{ t('provider.requestedDiscount') }}
                  </span>
                </div>
                <div class="price-input-wrap">
                  <span class="price-currency-tag mono">{{ activeCurrencyMeta.symbol }} ({{ targetCurrency }})</span>
                  <input
                    id="cart-target-price"
                    v-model.number="targetProposedTotal"
                    type="number"
                    min="1"
                    :placeholder="displayTotal ? String(Math.round(displayTotal * 0.9)) : '0'"
                    class="price-input mono"
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="cart-negotiation-reason" class="notes-lbl mono">{{ t('sales.negotiationReason') }}</label>
                <textarea
                  id="cart-negotiation-reason"
                  v-model="negotiationReason"
                  rows="2"
                  :placeholder="t('sales.negotiationReasonPlaceholder')"
                  class="notes-textarea"
                ></textarea>
              </div>

              <div v-if="targetProposedTotal" class="negotiation-badge-row mono">
                <span class="material-symbols-outlined text-[16px] text-emerald-600">handshake</span>
                <span>
                  {{ t('sales.negotiationSummary', {
                    target: `${activeCurrencyMeta.symbol} ${targetProposedTotal.toLocaleString()} ${targetCurrency}`,
                    discount: requestedDiscountPercent
                  }) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="summary-actions">
            <!-- RFQ Requested Currency Notice: the RFQ is submitted in the
                 target currency, not the products' base currency. -->
            <div class="rfq-currency-chip mono">
              <span class="material-symbols-outlined text-[16px]">currency_exchange</span>
              <div class="rfq-currency-text">
                <span class="rfq-currency-label">{{ t('sales.rfqCurrencyTitle') }}:</span>
                <strong class="rfq-currency-value">{{ targetCurrency }}</strong>
                <span v-if="distinctBaseCurrencies.length" class="rfq-currency-from">
                  ({{ t('sales.convertedFromBase') }}: {{ distinctBaseCurrencies.join(', ') }})
                </span>
              </div>
            </div>

            <button class="btn btn-primary btn-press btn-block btn-lg" type="button" @click="goCheckout">
              <span class="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
              <span>{{ t('commerce.placeOrder') }} · {{ activeCurrencyMeta.symbol }} {{ fmtQuote(displayTotal) }} {{ targetCurrency }}</span>
            </button>

            <button
              class="btn btn-ghost btn-block"
              type="button"
              :disabled="submittingRfq"
              @click="submitRfq"
            >
              <span class="material-symbols-outlined text-[18px]">request_quote</span>
              <span>{{ submittingRfq ? t('sales.submittingRfq') : t('sales.submitRfq') }}</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.cart-page {
  width: 100%;
}

.cart-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11px;
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

.breadcrumb .sep {
  color: var(--wl-border);
}

.breadcrumb .current {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

/* Hero Header */
.cart-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1.5rem;
  flex-wrap: wrap;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--wl-border);
  margin-bottom: 2rem;
}

.cart-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.35rem;
}

.cart-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--wl-primary);
  box-shadow: 0 0 0 3px var(--wl-primary-soft);
}

.cart-title {
  font-family: var(--wl-font-display);
  font-size: clamp(1.85rem, 3.2vw, 2.4rem);
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  line-height: 1.1;
  margin: 0 0 0.35rem;
}

.cart-desc {
  font-size: 0.95rem;
  color: var(--wl-ink-soft);
  margin: 0;
}

.cart-hero__actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.text-danger {
  color: var(--wl-danger) !important;
}

/* Layout */
.cart-layout {
  display: grid;
  grid-template-columns: 1fr 390px;
  gap: 2.25rem;
  align-items: start;
}

.cart-main {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* =========================================================================
   Active Currency Hub & Smart Switcher
   ========================================================================= */
.currency-hub-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--wl-radius-card, 16px);
  padding: 1.25rem 1.5rem;
  box-shadow: var(--wl-shadow-card, 0 1px 3px rgba(0, 10, 25, 0.05));
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  position: relative;
}

.curr-hub__main {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 240px;
}

.curr-hub__badge-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.fx-live-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-success);
  background: var(--wl-success-soft);
  border: 1px solid rgba(87, 242, 135, 0.35);
  padding: 0.18rem 0.55rem;
  border-radius: 9999px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.fx-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success-500, #198754);
  box-shadow: 0 0 0 2px rgba(25, 135, 84, 0.2);
}

.address-curr-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--primary, #0F3D56);
  background: var(--brand-soft, #EDF4FF);
  border: 1px solid var(--border, #D9E2EC);
  padding: 0.18rem 0.55rem;
  border-radius: var(--radius-xs, 3px);
}

.curr-hub__active-hero {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.active-flag {
  font-size: 32px;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 10, 25, 0.1));
}

.active-titles {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.active-code-line {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.active-code {
  font-size: 1.28rem;
  font-weight: 800;
  color: var(--fg-heading, #102A43);
  letter-spacing: -0.01em;
  line-height: 1.1;
}

.active-symbol-badge {
  font-size: 12px;
  font-weight: 800;
  color: var(--primary, #0F3D56);
  background: var(--brand-soft, #EDF4FF);
  border: 1px solid var(--border, #D9E2EC);
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-xs, 3px);
  line-height: 1.2;
}

.active-country-desc {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--fg-muted, #627D98);
}

.dot-sep {
  opacity: 0.5;
}

.curr-hub__hint {
  font-size: 11px;
  color: var(--fg-muted, #627D98);
  margin: 0;
  line-height: 1.4;
}

/* Right: Switcher Controls */
.curr-hub__controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 280px;
  max-width: 600px;
}

.chips-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.chips-lbl {
  font-size: 11px;
  font-weight: 700;
  color: var(--fg-muted, #627D98);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.btn-refresh-rates {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--fg-muted, #627D98);
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: var(--radius-xs, 3px);
  transition: all 0.15s ease;
}

.btn-refresh-rates:hover:not(:disabled) {
  color: var(--brand);
  background: var(--wl-primary-soft);
}

.btn-refresh-rates:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spin-anim {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.curr-pills-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  position: relative;
}

.curr-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: 38px;
  padding: 0 var(--space-3);
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: var(--radius-sm);
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-strong);
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: var(--shadow-card);
}

.curr-pill:hover:not(:disabled) {
  border-color: var(--wl-primary);
  color: var(--wl-primary);
  transform: translateY(-1px);
}

.curr-pill:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.curr-pill.is-active {
  background: var(--wl-primary);
  border-color: var(--wl-primary);
  color: var(--wl-on-primary);
  box-shadow: var(--wl-primary-shadow);
}

.curr-pill.is-active .pill-sym {
  background: rgba(255, 255, 255, 0.22);
  color: var(--wl-on-primary);
}

.curr-pill.is-active .check-icon {
  color: var(--wl-on-primary);
}

.pill-flag {
  font-size: 14px;
}

.pill-code {
  font-weight: 800;
}

.pill-sym {
  font-size: 11px;
  opacity: 0.85;
  background: var(--wl-surface-soft);
  padding: 0.1rem 0.35rem;
  border-radius: var(--radius-sm);
}

.pill-addr-dot {
  font-size: 11px;
}

.curr-pill--more {
  background: var(--wl-surface-soft);
  border-style: dashed;
  color: var(--wl-muted);
}

.curr-pill--more:hover,
.curr-pill--more.is-open {
  border-style: solid;
  border-color: var(--wl-primary);
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
}

.chev-icon {
  transition: transform 0.18s ease;
}

.curr-pill--more.is-open .chev-icon {
  transform: rotate(180deg);
}

/* More Currencies Dropdown Popover */
.more-curr-wrapper {
  position: relative;
}

.curr-dropdown-popover {
  position: absolute;
  top: calc(100% + 8px);
  inset-inline-end: 0;
  width: 330px;
  max-width: 90vw;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-hover);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  z-index: 70;
  animation: popoverFadeIn 0.16s ease-out;
}

@keyframes popoverFadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.popover-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-ic {
  position: absolute;
  inset-inline-start: var(--space-2);
  font-size: 18px;
  color: var(--wl-muted);
  pointer-events: none;
}

.popover-search-input {
  width: 100%;
  height: 38px;
  padding: 0 var(--space-2);
  padding-inline-start: 34px;
  padding-inline-end: 28px;
  background: var(--wl-surface-soft);
  border: 1.5px solid var(--wl-border);
  border-radius: var(--radius-sm);
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
  outline: none;
  transition: all 0.15s ease;
}

.popover-search-input:focus {
  background: var(--wl-surface);
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.clear-search-btn {
  position: absolute;
  inset-inline-end: 8px;
  background: transparent;
  border: none;
  color: var(--wl-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 0.2rem;
}

.popover-items-list {
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-inline-end: 0.2rem;
}

.popover-items-list::-webkit-scrollbar {
  width: 5px;
}
.popover-items-list::-webkit-scrollbar-thumb {
  background: var(--wl-surface-hover);
  border-radius: 4px;
}

.popover-item-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  text-align: start;
  cursor: pointer;
  transition: all 0.14s ease;
  width: 100%;
}

.popover-item-btn:hover {
  background: var(--wl-surface-soft);
  border-color: var(--wl-border);
}

.popover-item-btn.is-active {
  background: var(--wl-primary-soft);
  border-color: rgba(var(--wl-primary-rgb), 0.3);
}

.p-flag {
  font-size: 18px;
  flex-shrink: 0;
}

.p-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}

.p-line-1 {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.p-country {
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.p-addr-badge {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-primary);
}

.p-line-2 {
  font-size: var(--step--1);
  color: var(--wl-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.p-code-badge {
  font-size: var(--step--1);
  font-weight: 800;
  color: var(--wl-ink-strong);
  background: var(--wl-surface-soft);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.p-sym-badge {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  padding: var(--space-1) var(--space-1);
  border-radius: var(--radius-sm);
}

.popover-empty {
  padding: var(--space-6) var(--space-3);
  text-align: center;
  font-size: var(--step-0);
  color: var(--wl-muted);
}

.popover-footer {
  padding-top: var(--space-2);
  border-top: 1px solid var(--wl-border);
  font-size: var(--step--1);
  font-weight: 600;
  color: var(--wl-muted);
  text-align: center;
}

.rate-warn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--wl-warning-soft);
  border: 1px solid var(--wl-warning);
  color: var(--wl-amber);
  border-radius: var(--radius-md);
  font-size: var(--step--1);
  font-weight: 600;
}

/* Items Card */
.cart-items-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  box-shadow: var(--shadow-card);
}

.items-card-head {
  margin-bottom: var(--space-4);
}

.items-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--wl-font-display);
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.015em;
  color: var(--wl-ink-strong);
  margin: 0;
}

.items-count-pill {
  font-size: var(--step--1);
  font-weight: 600;
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
}

/* Lines */
.cart-lines-list {
  display: flex;
  flex-direction: column;
}

.cart-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--wl-surface-soft);
  flex-wrap: wrap;
}

.cart-line:last-child {
  border-bottom: none;
}

.cart-line__media {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex: 1;
  min-width: 260px;
}

.cart-thumb {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  border: 1px solid var(--wl-border);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}

.cart-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cart-line__details {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}

.cart-line__title {
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.3;
}

.cart-line__title-alt {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.cart-line__meta {
  font-size: var(--step--1);
  color: var(--wl-muted);
  display: flex;
  gap: var(--space-1);
}

.cart-line__price {
  font-size: var(--step--1);
  color: var(--wl-ink-strong);
  font-weight: 600;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.orig-price-wrap {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.orig-pill {
  font-size: var(--step--1);
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.conv-arrow {
  color: var(--wl-muted);
}

.active-unit-price {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-1);
}

.active-unit-val {
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-strong);
}

.active-unit-code {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
}

.active-unit-per {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.cart-line__controls {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-shrink: 0;
}

.cart-line__total {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-1);
  min-width: 110px;
}

.total-lbl {
  font-size: var(--step--1);
  color: var(--wl-muted);
  letter-spacing: 0.05em;
}

.total-fig {
  font-size: var(--step-0);
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.line-remove-btn {
  background: none;
  border: 1px solid var(--wl-border);
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  color: var(--wl-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.15s ease;
}

.line-remove-btn:hover:not(:disabled) {
  background: var(--wl-danger-soft);
  border-color: var(--wl-danger);
  color: var(--wl-danger);
}

.line-remove-btn:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

/* Summary Column */
.cart-summary-col {
  position: sticky;
  top: calc(var(--wl-header-height) + 20px);
}

.summary-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
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
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.015em;
  color: var(--wl-ink-strong);
  margin: 0;
}

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

.summary-row--total {
  font-size: var(--step-0);
}

.total-lbl {
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.total-val {
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.total-curr {
  font-size: 0.95rem;
  color: var(--wl-primary);
}

.total-sym {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--wl-primary);
  margin-inline-end: var(--space-1);
}

.total-code {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
  margin-inline-start: var(--space-1);
}

.sum-code {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
  margin-inline-start: var(--space-1);
}

.fx-live-note {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--wl-success-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-sm);
  font-size: var(--step--1);
  color: var(--wl-success);
  margin-top: var(--space-3);
  line-height: 1.4;
}

/* Notes Block */
.notes-block {
  margin: var(--space-4) 0 var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.notes-lbl {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.05em;
}

.notes-textarea {
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  background: var(--wl-surface);
  font-family: var(--wl-font-body);
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
  resize: vertical;
  line-height: 1.5;
  transition: border-color 0.18s var(--wl-ease-spring), box-shadow 0.18s var(--wl-ease-spring);
}

.notes-textarea:focus {
  outline: none;
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.summary-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* RFQ Requested Currency Notice */
.rfq-currency-chip {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-inline-start: 3px solid var(--primary);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--fg-muted);
  font-size: var(--text-xs);
  line-height: 1.5;
  margin-bottom: var(--space-1);
}

.rfq-currency-text {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
}

.rfq-currency-label {
  color: var(--fg-muted);
}

.rfq-currency-value {
  color: var(--primary);
}

.rfq-currency-from {
  color: var(--fg-subtle);
}

/* Price Negotiation Card */
.negotiation-card {
  margin-bottom: var(--space-4);
  border: 1px dashed var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  background: var(--wl-surface-soft);
  transition: all 0.2s ease;
}

.negotiation-card.is-active {
  border: 1px solid var(--wl-primary);
  background: var(--wl-surface);
  box-shadow: 0 4px 12px rgba(179, 139, 45, 0.08);
}

.negotiation-toggle {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  cursor: pointer;
  user-select: none;
}

.toggle-checkbox {
  margin-top: 2px;
  cursor: pointer;
}

.custom-checkbox {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-xs, 4px);
  border: 1.5px solid var(--wl-border);
  background: var(--wl-surface);
  display: grid;
  place-items: center;
  color: #fff;
  transition: all 0.15s ease;
}

.custom-checkbox.is-checked {
  background: var(--wl-primary);
  border-color: var(--wl-primary);
}

.toggle-text {
  flex: 1;
}

.negotiation-title {
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-strong);
  display: block;
}

.negotiation-desc {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin: var(--space-1) 0 0;
  line-height: 1.35;
}

.negotiation-fields {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--wl-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}

.discount-pill {
  font-size: 11px;
  font-weight: 700;
  color: #059669;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 1px 8px;
  border-radius: var(--radius-full);
}

.price-input-wrap {
  display: flex;
  align-items: center;
  border: 1.5px solid var(--wl-border);
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.price-input-wrap:focus-within {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.price-currency-tag {
  padding: 0 var(--space-3);
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  border-inline-end: 1px solid var(--wl-border);
  height: 38px;
  display: flex;
  align-items: center;
}

.price-input {
  flex: 1;
  height: 38px;
  padding: 0 var(--space-3);
  border: none;
  background: transparent;
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-strong);
  outline: none;
}

.negotiation-badge-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--wl-success-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-sm);
  font-size: var(--step--1);
  color: var(--wl-ink-strong);
}

@media (max-width: 980px) {
  .cart-layout {
    grid-template-columns: 1fr;
  }
  .cart-summary-col {
    position: static;
  }
}
</style>

