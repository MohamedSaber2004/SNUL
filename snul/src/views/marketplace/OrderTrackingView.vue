<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { commerceService } from '../../di/container'
import ChainSteps from '../../components/ui/ChainSteps.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import BackButton from '../../components/ui/BackButton.vue'
import type { OrderDto } from '../../domain/models/commerce'
import { formatPrice } from '../../utils/format'

const router = useRouter()
const query = ref('')
const order = ref<OrderDto | null>(null)
const tracking = ref(false)
const notFound = ref(false)

const localized = (en: string, ar: string) => (locale.value === 'ar' ? ar : en)

async function track() {
  if (!query.value.trim()) return
  tracking.value = true
  notFound.value = false
  order.value = null
  try {
    const found = await commerceService.trackOrder(query.value.trim())
    if (!found) {
      notFound.value = true
    } else {
      order.value = found
    }
  } finally {
    tracking.value = false
  }
}
</script>

<template>
  <div class="page-shell track-order-view">
    <BackButton fallback="/" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('nav.trackOrder') }}</span>
    </nav>

    <!-- Executive Header -->
    <header class="tracking-head">
      <div class="head-chip mono">
        <span class="pulse-dot"></span>
        <span>{{ t('commerce.trackingEyebrow') }}</span>
      </div>
      <h1 class="head-title">{{ t('commerce.trackingTitle') }}</h1>
      <p class="head-subtitle">{{ t('commerce.trackingSubtitle') }}</p>
    </header>

    <!-- 48px Search Input Card -->
    <div class="track-search-card">
      <form class="track-form" @submit.prevent="track">
        <div class="input-icon-wrap">
          <span class="material-symbols-outlined search-icon">local_shipping</span>
          <input
            v-model="query"
            class="vip-track-input mono"
            :placeholder="t('commerce.trackingPlaceholder')"
            :aria-label="t('commerce.orderNumber')"
            required
          />
        </div>
        <button
          class="btn-track-submit mono"
          type="submit"
          :disabled="tracking || !query.trim()"
        >
          <span v-if="tracking" class="material-symbols-outlined spin-glyph">progress_activity</span>
          <span v-else class="material-symbols-outlined text-[18px]">search</span>
          <span>{{ tracking ? t('commerce.locating') : t('commerce.track') }}</span>
        </button>
      </form>
    </div>

    <div v-if="tracking && !order" class="tracking-results-stack" role="status" aria-live="polite">
      <SkeletonLoader type="track" :count="1" />
    </div>

    <div v-if="notFound" class="result-not-found-card">
      <div class="not-found-circle">
        <span class="material-symbols-outlined text-[32px]">inventory_2</span>
      </div>
      <h2 class="not-found-title">{{ t('commerce.notFound') }}</h2>
      <p class="not-found-desc">{{ t('commerce.notFoundDesc') }}</p>
    </div>

    <div v-else-if="order" class="tracking-results-stack">
      <div class="result-card">
        <div class="card-head-row">
          <div>
            <span class="mono ref-label">{{ t('commerce.consignmentLabel') }}</span>
            <h2 class="mono order-heading">#{{ order.orderNumber }}</h2>
            <span class="mono order-date-text">{{ new Date(order.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</span>
          </div>

          <StatusPill :status="order.status" />
        </div>

        <div class="stepper-zone">
          <ChainSteps
            :steps="['Pending', 'Confirmed', 'Shipped', 'Delivered']"
            :current="Math.max(0, ['Pending', 'Confirmed', 'Shipped', 'Delivered'].indexOf(order.status))"
          />
        </div>

        <div class="card-foot-summary">
          <span class="mono foot-label">{{ t('commerce.total') }}</span>
          <strong class="mono foot-total">
            {{ formatPrice(order.totalAmount, locale) }} {{ order.currencyCode }}
          </strong>
        </div>
      </div>

      <!-- Line Items Card -->
      <div class="result-card">
        <div class="items-head">
          <span class="material-symbols-outlined text-[18px] text-indigo-600">inventory</span>
          <h3 class="items-title">{{ t('commerce.orderSummary') }}</h3>
          <span class="mono items-count">({{ order.items.length }} items)</span>
        </div>

        <div class="line-items-stack">
          <div v-for="it in order.items" :key="it.id" class="line-item-row">
            <div class="line-item-name">{{ localized(it.productNameEn, it.productNameEn) }}</div>
            <div class="line-item-meta mono">
              <span>{{ it.quantity }} × {{ formatPrice(it.unitPrice, locale) }} {{ order.currencyCode }}</span>
              <button
                type="button"
                class="view-link-btn"
                @click="router.push({ name: 'marketplace' })"
              >
                {{ t('marketplace.viewDetails') }} <span class="icon--directional">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="action-footer-row">
        <button
          type="button"
          class="btn-action-ghost mono"
          @click="router.push({ name: 'marketplace' })"
        >
          <span class="material-symbols-outlined text-[16px]">storefront</span>
          <span>{{ t('marketplace.browseMarketplace') }}</span>
        </button>
        <button
          type="button"
          class="btn-action-ghost mono"
          @click="query = ''; order = null"
        >
          <span class="material-symbols-outlined text-[16px]">search</span>
          <span>{{ t('commerce.track') }} Another Consignment</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.track-order-view {
  max-width: 860px;
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

.tracking-head {
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

/* Track Search Card */
.track-search-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  padding: 1.25rem;
  box-shadow: var(--shadow-xs);
}

.track-form {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.input-icon-wrap {
  position: relative;
  flex: 1;
  min-width: 260px;
}

.search-icon {
  position: absolute;
  inset-inline-start: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 20px;
  color: var(--wl-muted-soft);
  pointer-events: none;
}

.vip-track-input {
  width: 100%;
  height: 48px;
  padding: 0 14px;
  padding-inline-start: 42px;
  background: var(--wl-surface-soft);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 14px;
  color: var(--wl-ink-strong);
  outline: none;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.vip-track-input:focus {
  background: var(--wl-surface);
  border-color: var(--wl-primary);
  box-shadow: 0 0 0 3px rgba(105, 169, 255, 0.12);
}

.btn-track-submit {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 48px;
  padding: 0 1.5rem;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px -2px rgba(105, 169, 255, 0.35);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-track-submit:hover:not(:disabled) {
  background: var(--wl-primary-hover);
  transform: translateY(-1px);
}

.btn-track-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spin-glyph {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Not Found Card */
.result-not-found-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  padding: 3.5rem 1.5rem;
  text-align: center;
  box-shadow: var(--shadow-xs);
}

.not-found-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--wl-danger-soft);
  color: var(--wl-danger);
  display: grid;
  place-items: center;
  margin: 0 auto 1rem;
}

.not-found-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0 0 0.4rem;
}

.not-found-desc {
  font-size: 13.5px;
  color: var(--wl-muted);
  margin: 0;
}

/* Results Stack */
.tracking-results-stack {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.result-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.card-head-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.ref-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.06em;
}

.order-heading {
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0.15rem 0;
}

.order-date-text {
  font-size: 11.5px;
  color: var(--wl-muted-soft);
}

.stepper-zone {
  padding: 0.5rem 0;
}

.card-foot-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--wl-border);
}

.foot-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-muted);
  text-transform: uppercase;
}

.foot-total {
  font-size: 1.4rem;
  color: var(--wl-ink-strong);
  font-weight: 800;
}

/* Line Items */
.items-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--wl-border);
  padding-bottom: 0.75rem;
}

.items-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
}

.items-count {
  font-size: 11px;
  color: var(--wl-muted);
}

.line-items-stack {
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

.line-item-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--wl-ink-strong);
}

.line-item-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 12px;
  color: var(--wl-muted);
}

.view-link-btn {
  background: transparent;
  border: none;
  color: var(--wl-primary);
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  font-size: 11.5px;
}

.view-link-btn:hover {
  text-decoration: underline;
}

.action-footer-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-action-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 44px;
  padding: 0 1.25rem;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--wl-ink-soft);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-action-ghost:hover {
  border-color: var(--wl-primary);
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
}

@media (max-width: 640px) {
  .track-search-card {
    padding: 1rem;
  }
  .track-form {
    flex-direction: column;
    align-items: stretch;
  }
  .input-icon-wrap {
    min-width: 0;
    flex: 1 1 100%;
  }
  .btn-track-submit {
    width: 100%;
    justify-content: center;
  }
  .result-card {
    padding: 1.1rem 1rem;
    min-width: 0;
  }
  .card-head-row {
    flex-wrap: wrap;
  }
  .order-heading {
    font-size: 1.15rem;
    overflow-wrap: anywhere;
  }
  .stepper-zone {
    overflow-x: auto;
    margin: 0 -0.25rem;
    padding: 0.5rem 0.25rem;
  }
  .stepper-zone .chain-steps {
    min-width: 430px;
  }
  .line-item-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.4rem;
  }
  .line-item-meta {
    justify-content: space-between;
    gap: 0.75rem;
  }
  .action-footer-row {
    flex-direction: column;
    align-items: stretch;
  }
  .action-footer-row .btn-action-ghost {
    justify-content: center;
  }
  .foot-total {
    font-size: 1.15rem;
  }
}
</style>





