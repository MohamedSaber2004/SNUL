<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { commerceService } from '../../di/container'
import AccountNav from '../../components/account/AccountNav.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import ChainSteps from '../../components/ui/ChainSteps.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import DataState from '../../components/ui/DataState.vue'
import BackButton from '../../components/ui/BackButton.vue'
import type { OrderDto } from '../../domain/models/commerce'
import { formatPrice } from '../../utils/format'

const route = useRoute()
const router = useRouter()
const order = ref<OrderDto | null>(null)
const loading = ref(true)

const localized = (en: string, ar: string) => (locale.value === 'ar' ? ar : en)

onMounted(async () => {
  try {
    const id = String(route.params.id)
    const found = await commerceService.getOrder(id)
    order.value = found
  } finally {
    loading.value = false
  }
})

function statusIndex(o: OrderDto): number {
  return ['Pending', 'Confirmed', 'Shipped', 'Delivered'].indexOf(o.status)
}
</script>

<template>
  <div class="page-shell order-detail-view">
    <BackButton fallback="/account/orders" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/account">{{ t('account.dashboard') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <router-link to="/account/orders">{{ t('commerce.ordersTitle') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ order?.orderNumber ?? '…' }}</span>
    </nav>

    <SkeletonLoader v-if="loading" type="order-detail" />
    <DataState
      v-else-if="!order"
      :empty="true"
      :empty-title="t('commerce.notFound')"
      :empty-description="t('commerce.notFoundDesc')"
      :action-text="t('account.orders')"
      min-height="320px"
      @action="router.push({ name: 'account-orders' })"
    />

    <template v-else-if="order">
      <header class="detail-header">
        <div class="header-main">
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('account.orderManifest', { count: order.items.length }) }}</span>
          </div>
          <h1 class="mono order-heading">{{ order.orderNumber }}</h1>
          <p class="mono order-sub">
            <span>{{ t('commerce.placed') }}: {{ new Date(order.createdAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</span>
            <span>•</span>
            <span>{{ t('account.lotVerified') }}</span>
          </p>
        </div>

        <StatusPill :status="order.status" />
      </header>

      <!-- Account Navigation Tab Bar -->
      <AccountNav />

      <!-- Logistics Stepper Card -->
      <div class="stepper-card">
        <ChainSteps
          :steps="[t('account.stepPending'), t('account.stepConfirmed'), t('account.stepShipped'), t('account.stepDelivered')]"
          :current="Math.max(0, statusIndex(order))"
        />
      </div>

      <!-- Detail Grid: Manifest Items & Side Actions -->
      <div class="detail-grid">
        <!-- Main: Ordered Items List -->
        <main class="manifest-card">
          <div class="manifest-head">
            <div class="manifest-title-group">
              <span class="material-symbols-outlined text-[18px] text-indigo-600">inventory_2</span>
              <h2 class="manifest-title">{{ t('commerce.orderSummary') }}</h2>
            </div>
            <span class="mono item-chip">{{ t('account.itemsCount', { count: order.items.length }) }}</span>
          </div>

          <div class="items-stack">
            <article v-for="it in order.items" :key="it.id" class="line-item-row">
              <div class="item-primary">
                <h3 class="item-title">{{ localized(it.productNameEn, it.productNameEn) }}</h3>
                <div class="item-math mono">
                  <span>{{ t('account.qtyUnits', { count: it.quantity }) }}</span>
                  <span>•</span>
                  <span>{{ formatPrice(it.unitPrice, locale) }} {{ order.currencyCode }} {{ t('account.perUnitShort') }}</span>
                </div>
              </div>

              <div class="item-subtotal mono">
                {{ formatPrice(it.quantity * it.unitPrice, locale) }} {{ order.currencyCode }}
              </div>
            </article>
          </div>

          <div class="manifest-foot">
            <span class="mono foot-label">{{ t('commerce.total') }}</span>
            <strong class="mono foot-total">
              {{ formatPrice(order.totalAmount, locale) }} {{ order.currencyCode }}
            </strong>
          </div>
        </main>

        <!-- Sidebar: Navigation -->
        <aside class="side-panel">
          <!-- Action Stack -->
          <div class="side-actions-stack">
            <button
              type="button"
              class="btn-back-orders mono"
              @click="router.push({ name: 'account-orders' })"
            >
              <span class="material-symbols-outlined text-[16px] icon--directional">arrow_back</span>
              <span>{{ t('account.backToOrders') }}</span>
            </button>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.order-detail-view {
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
  color: var(--wl-line-strong);
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
  gap: var(--wl-page-gap);
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
  border: 1px solid rgba(105, 169, 255, 0.2);
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
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

.order-heading {
  font-family: var(--wl-font-display);
  font-size: 1.68rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.1;
}

.order-sub {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11.5px;
  color: var(--wl-muted);
  margin-top: 0.15rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.btn-act {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 40px;
  padding: 0 1rem;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

.btn-act--primary {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
}

.btn-act--primary:hover {
  background: var(--wl-primary-hover);
}

/* Stepper Card */
.stepper-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--wl-card-padding);
  box-shadow: var(--wl-shadow-card);
}

/* Detail Grid */
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: var(--wl-page-gap);
  align-items: start;
}

.manifest-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--wl-card-padding);
  box-shadow: var(--wl-shadow-card);
  display: flex;
  flex-direction: column;
  gap: var(--wl-form-gap);
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
  color: var(--wl-ink-strong);
  margin: 0;
}

.item-chip {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-xs);
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
  border-bottom: 1px solid var(--wl-surface-soft);
}

.item-primary {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.item-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--wl-ink-strong);
  margin: 0;
}

.item-math {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 11.5px;
  color: var(--wl-muted);
}

.item-subtotal {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
}

.manifest-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1.5px dashed var(--wl-border);
}

.foot-label {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-muted);
  text-transform: uppercase;
}

.foot-total {
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
}

/* Sidebar */
.side-panel {
  display: flex;
  flex-direction: column;
  gap: var(--wl-form-gap);
}

.card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--wl-card-padding);
  box-shadow: var(--wl-shadow-card);
}

.side-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--wl-primary);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin: 0 0 0.75rem;
}

.side-actions-stack {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.btn-back-orders {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 44px;
  background: var(--wl-surface);
  color: var(--wl-ink-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-back-orders:hover {
  border-color: var(--wl-primary);
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
}

@media (max-width: 900px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>





