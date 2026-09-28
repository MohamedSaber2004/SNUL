<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { commerceService } from '../../di/container'
import ChainSteps from '../../components/ui/ChainSteps.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import BackButton from '../../components/ui/BackButton.vue'
import type { OrderDto } from '../../domain/models/commerce'
import { formatPrice } from '../../utils/format'

const route = useRoute()
const router = useRouter()
const order = ref<OrderDto | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const number = String(route.params.orderNumber ?? '')
    const found = await commerceService.trackOrder(number)
    order.value = found
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page-shell order-confirm-view">
    <BackButton fallback="/marketplace" variant="minimal" class="mb-3" />

    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <router-link to="/marketplace">{{ t('marketplace.title') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('commerce.orderConfirmationTitle') }}</span>
    </nav>

    <SkeletonLoader v-if="loading" type="order-confirm" />

    <template v-else-if="order">
      <div class="confirm-hero-card">
        <div class="check-halo">
          <span class="material-symbols-outlined text-[32px]">check</span>
        </div>

        <div class="head-chip mono">
          <span class="pulse-dot"></span>
          <span>{{ t('commerce.confirmEyebrow') }}</span>
        </div>

        <h1 class="confirm-title">{{ t('commerce.orderConfirmationTitle') }}</h1>
        <p class="confirm-subtitle">{{ t('commerce.orderConfirmationSubtitle') }}</p>

        <div class="order-id-badge mono">
          <span class="id-label">{{ t('commerce.consignmentRef') }}</span>
          <span class="id-num">#{{ order.orderNumber }}</span>
        </div>

        <StatusPill :status="order.status" />
      </div>

      <div class="stepper-card">
        <ChainSteps
          :steps="[t('account.stepPending'), t('account.stepConfirmed'), t('account.stepShipped'), t('account.stepDelivered')]"
          :current="Math.max(0, ['Pending', 'Confirmed', 'Shipped', 'Delivered'].indexOf(order.status))"
        />
      </div>

      <div class="confirm-grid">
        <section class="order-summary-card">
          <div class="summary-head">
            <span class="material-symbols-outlined text-[18px] text-indigo-600">receipt_long</span>
            <h2 class="summary-title">{{ t('commerce.orderSummary') }}</h2>
          </div>

          <div class="items-list">
            <div v-for="it in order.items" :key="it.id" class="item-row">
              <div class="item-name">{{ it.productNameEn }}</div>
              <div class="item-calc mono">
                <span class="item-qty">{{ it.quantity }} × {{ formatPrice(it.unitPrice, locale) }}</span>
                <strong class="item-subtotal">
                  {{ formatPrice(it.quantity * it.unitPrice, locale) }} {{ order.currencyCode }}
                </strong>
              </div>
            </div>
          </div>

          <div class="total-row">
            <span class="total-label mono">{{ t('commerce.total') }}</span>
            <strong class="total-value mono">
              {{ formatPrice(order.totalAmount, locale) }} {{ order.currencyCode }}
            </strong>
          </div>
        </section>

        <section class="actions-card">
          <h3 class="actions-title mono">{{ t('commerce.nextSteps') }}</h3>
          <p class="actions-desc">
            Your clinical purchase order is queued for QA verification and export clearance. Trace the shipment in real time.
          </p>

          <div class="action-buttons-stack">
            <button
              type="button"
              class="btn-primary-action mono"
              @click="router.push({ name: 'order-tracking' })"
            >
              <span class="material-symbols-outlined text-[18px]">local_shipping</span>
              <span>{{ t('nav.trackOrder') }}</span>
            </button>

            <button
              type="button"
              class="btn-secondary-action mono"
              @click="router.push({ name: 'marketplace' })"
            >
              <span class="material-symbols-outlined text-[18px]">storefront</span>
              <span>{{ t('marketplace.continueShopping') }}</span>
            </button>

            <button
              v-if="route.query.from === 'account'"
              type="button"
              class="btn-secondary-action mono"
              @click="router.push({ name: 'account-orders' })"
            >
              <span class="material-symbols-outlined text-[18px]">receipt</span>
              <span>{{ t('account.orders') }}</span>
            </button>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.order-confirm-view {
  max-width: 920px;
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

.confirm-hero-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 20px;
  padding: 2.5rem 1.5rem;
  text-align: center;
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.check-halo {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--wl-success-soft);
  border: 2px solid rgba(87, 242, 135, 0.35);
  color: var(--wl-success);
  display: grid;
  place-items: center;
  margin-bottom: 0.5rem;
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
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-primary);
}

.confirm-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: 1.85rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0.2rem 0 0;
}

.confirm-subtitle {
  font-size: 14px;
  color: var(--wl-muted);
  margin: 0;
  max-width: 520px;
}

.order-id-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  margin: 0.5rem 0;
}

.id-label {
  font-size: 11px;
  color: var(--wl-muted);
  font-weight: 700;
}

.id-num {
  font-size: 14px;
  color: var(--wl-ink-strong);
  font-weight: 800;
}

.stepper-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  padding: 1.25rem 1.5rem;
  box-shadow: var(--shadow-xs);
}

.confirm-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 1.25rem;
  align-items: start;
}

.order-summary-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--wl-border);
  padding-bottom: 0.75rem;
}

.summary-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--wl-border);
}

.item-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--wl-ink-strong);
}

.item-calc {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  font-size: 12.5px;
}

.item-qty {
  color: var(--wl-muted);
}

.item-subtotal {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1.5px dashed var(--wl-border);
}

.total-label {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-muted);
  text-transform: uppercase;
}

.total-value {
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.actions-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.actions-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--wl-primary);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin: 0;
}

.actions-desc {
  font-size: 13px;
  color: var(--wl-muted);
  line-height: 1.55;
  margin: 0;
}

.action-buttons-stack {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.5rem;
}

.btn-primary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 48px;
  padding: 0 1.25rem;
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

.btn-primary-action:hover {
  background: var(--wl-primary-hover);
  transform: translateY(-1px);
}

.btn-secondary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 48px;
  padding: 0 1.25rem;
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-secondary-action:hover {
  border-color: var(--wl-primary);
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
}

@media (max-width: 768px) {
  .confirm-grid {
    grid-template-columns: 1fr;
  }
}
</style>





