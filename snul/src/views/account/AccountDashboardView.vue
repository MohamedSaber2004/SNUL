<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { authService, salesService, commerceService, companyService } from '../../di/container'
import AccountNav from '../../components/account/AccountNav.vue'
import StatCard from '../../components/ui/StatCard.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import ErrorState from '../../components/ui/ErrorState.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import { useWishlist } from '../../composables/useWishlist'
import { formatPrice } from '../../utils/format'

const { wishlistIds } = useWishlist()
const router = useRouter()
const loadError = ref<string | null>(null)

const loading = computed(() => salesService.loading.value || commerceService.loading.value || companyService.loading.value)

const user = computed(() => authService.user.value)
const myCompany = computed(() => companyService.myCompany.value)

const openRfqs = computed(() => salesService.rfqs.value.filter((r) => r.status === 'Pending').length)
const quotesAwaiting = computed(() => salesService.quotes.value.filter((q) => q.status === 'Sent' || q.status === 'Draft').length)
const activeOrders = computed(() => commerceService.orders.value.filter((o) => o.status !== 'Delivered' && o.status !== 'Cancelled').length)
const ytdValue = computed(() => {
  const year = new Date().getFullYear()
  return commerceService.orders.value
    .filter((o) => new Date(o.createdAt).getFullYear() === year)
    .reduce((s, o) => s + o.totalAmount, 0)
})

const awaitingQuotes = computed(() => salesService.quotes.value.filter((q) => q.status === 'Sent' || q.status === 'Draft'))
const recentRfqs = computed(() => salesService.rfqs.value.slice(0, 4))
const orderCurrency = computed(() => commerceService.orders.value[0]?.currencyCode || 'USD')
const wishlistCount = computed(() => wishlistIds.value.length)

const realOrderSpendSparkline = computed(() => {
  const orders = commerceService.orders.value
  if (!orders.length) return undefined
  const months: number[] = [0, 0, 0, 0, 0, 0]
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const ym = `${new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7)}`
    const sum = orders.filter((o) => o.createdAt?.startsWith(ym)).reduce((acc, o) => acc + o.totalAmount, 0)
    months[5 - i] = Math.round(sum)
  }
  return months.some((v) => v > 0) ? months : undefined
})

const realRfqSparkline = computed(() => {
  const rfqs = salesService.rfqs.value
  if (!rfqs.length) return undefined
  const months: number[] = [0, 0, 0, 0, 0, 0]
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const ym = `${new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7)}`
    const count = rfqs.filter((r) => r.createdAt?.startsWith(ym)).length
    months[5 - i] = count
  }
  return months.some((v) => v > 0) ? months : undefined
})

const procurementPipeline = computed(() => {
  const allOrders = commerceService.orders.value
  const allRfqs = salesService.rfqs.value
  const allQuotes = salesService.quotes.value

  const pendingRfqs = allRfqs.filter((r) => r.status === 'Pending').length
  const actionableQuotes = allQuotes.filter((q) => q.status === 'Sent' || q.status === 'Draft').length
  const processingOrders = allOrders.filter((o) => o.status === 'Pending' || o.status === 'Confirmed').length
  const deliveredOrders = allOrders.filter((o) => o.status === 'Delivered').length

  const total = pendingRfqs + actionableQuotes + processingOrders + deliveredOrders || 1

  return [
    { label: t('account.pipeRfq'), count: pendingRfqs, pct: Math.round((pendingRfqs / total) * 100), color: 'var(--wl-warning)', icon: 'request_quote', to: '/account/rfqs', status: t('account.pipeStatusPending') },
    { label: t('account.pipeQuotes'), count: actionableQuotes, pct: Math.round((actionableQuotes / total) * 100), color: 'var(--wl-success)', icon: 'description', to: '/account/quotes', status: t('account.pipeStatusAwaiting') },
    { label: t('account.pipeProduction'), count: processingOrders, pct: Math.round((processingOrders / total) * 100), color: 'var(--wl-primary)', icon: 'precision_manufacturing', to: '/account/orders', status: t('account.pipeStatusManufacturing') },
    { label: t('account.pipeDelivered'), count: deliveredOrders, pct: Math.round((deliveredOrders / total) * 100), color: 'var(--wl-muted)', icon: 'verified', to: '/account/orders', status: t('account.pipeStatusReceived') },
  ]
})

async function loadDashboard(): Promise<void> {
  loadError.value = null
  try {
    await Promise.allSettled([
      salesService.loadAll(),
      commerceService.loadOrders(),
      companyService.loadMyCompany(),
    ])
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div class="page-shell org-shell">
    <nav class="org-crumb mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="crumb-sep icon--directional" aria-hidden="true">/</span>
      <span class="crumb-current">{{ t('account.dashboard') }}</span>
    </nav>

    <header class="org-head">
      <div class="org-head__main">
        <div class="org-eyebrow mono">
          <span class="live-dot" aria-hidden="true"></span>
          <span>{{ t('account.deskEyebrow') }}</span>
        </div>
        <h1 class="org-title">
          {{ user?.fullName ? t('account.welcomeBack', { name: user.fullName }) : t('account.dashboard') }}
        </h1>
        <p class="org-desc">
          {{ t('account.dashboardSubtitle') }}
        </p>

        <div class="org-head__actions">
          <BaseButton
            variant="primary"
            size="sm"
            @click="router.push({ name: 'marketplace' })"
          >
            <span class="material-symbols-outlined text-[16px]">add</span>
            <span>{{ t('account.newRfq') }}</span>
          </BaseButton>

          <BaseButton
            variant="ghost"
            size="sm"
            @click="router.push({ name: 'certifications' })"
          >
            <span class="material-symbols-outlined text-[16px]">verified</span>
            <span>{{ t('account.isoDossier') }}</span>
          </BaseButton>
        </div>
      </div>

      <div v-if="myCompany" class="org-company-card">
        <div class="company-card__top">
          <div class="company-card__avatar">
            <span class="material-symbols-outlined">domain</span>
          </div>
          <div class="company-card__meta">
            <span class="mono company-card__role">{{ t('account.verifiedBuyer') }}</span>
            <strong class="company-card__name">{{ myCompany.name }}</strong>
          </div>
        </div>

        <div class="company-card__details">
          <span class="company-pill company-pill--verified mono">
            <span class="pill-dot"></span>
            {{ t('account.verifiedPartner') }}
          </span>
          <span v-if="myCompany.countryNameEn || myCompany.countryNameAr" class="company-country mono">
            {{ locale === 'ar' ? (myCompany.countryNameAr || myCompany.countryNameEn) : (myCompany.countryNameEn || myCompany.countryNameAr) }}
          </span>
        </div>
      </div>
    </header>

    <AccountNav />

    <ErrorState v-if="loadError" :message="loadError" @retry="loadDashboard" />
    <div v-else-if="loading" class="dashboard-skeleton-wrap">
      <SkeletonLoader type="stats-grid" :count="4" />
      <div style="margin-top: 1.5rem">
        <SkeletonLoader type="table" :count="4" />
      </div>
    </div>

    <template v-else>
      <div class="stats-grid">
        <StatCard
          :label="t('account.statOpenRfqs')"
          :value="openRfqs"
          to="/account/rfqs"
          tone="amber"
          :trend="openRfqs > 0 ? t('account.trendActive', { count: openRfqs }) : t('account.trendNone')"
          :sparkline="realRfqSparkline"
        >
          <template #icon><span class="material-symbols-outlined text-[18px]">request_quote</span></template>
        </StatCard>

        <StatCard
          :label="t('account.statQuotes')"
          :value="quotesAwaiting"
          to="/account/quotes"
          tone="emerald"
          :trend="quotesAwaiting > 0 ? t('account.trendAwaiting', { count: quotesAwaiting }) : t('account.trendUpToDate')"
        >
          <template #icon><span class="material-symbols-outlined text-[18px]">description</span></template>
        </StatCard>

        <StatCard
          :label="t('account.statActiveOrders')"
          :value="activeOrders"
          to="/account/orders"
          tone="indigo"
          :trend="activeOrders > 0 ? t('account.trendProcessing', { count: activeOrders }) : t('account.trendNone')"
          :sparkline="realOrderSpendSparkline"
        >
          <template #icon><span class="material-symbols-outlined text-[18px]">receipt_long</span></template>
        </StatCard>

        <StatCard
          :label="t('account.statYtd')"
          :value="`${formatPrice(ytdValue, locale)} ${orderCurrency}`"
          tone="slate"
          :trend="t('account.trendYtd')"
          :sparkline="realOrderSpendSparkline"
        >
          <template #icon><span class="material-symbols-outlined text-[18px]">payments</span></template>
        </StatCard>
      </div>

      <section class="card pipeline-card">
        <div class="pipeline-head">
          <div>
            <div class="pipeline-eyebrow mono">
              <span class="live-dot" aria-hidden="true"></span>
              <span>{{ t('account.pipelineEyebrow') }}</span>
            </div>
            <h2 class="pipeline-title">{{ t('account.pipelineTitle') }}</h2>
          </div>
          <span class="pipeline-counter mono">{{ t('account.activeLifecycle', { count: openRfqs + quotesAwaiting + activeOrders }) }}</span>
        </div>

        <div class="pipeline-stepper">
          <router-link
            v-for="step in procurementPipeline"
            :key="step.label"
            :to="step.to"
            class="pipeline-step"
            :class="{ 'is-active': step.count > 0 }"
          >
            <div class="step-meta">
              <span class="material-symbols-outlined step-icon" :style="{ color: step.color }">{{ step.icon }}</span>
              <span class="step-label mono">{{ step.label }}</span>
            </div>
            <div class="step-count-box">
              <strong class="step-count mono">{{ step.count }}</strong>
              <span class="step-status mono">{{ step.status }}</span>
            </div>
            <div class="step-bar">
              <div class="step-bar__fill" :style="{ width: `${Math.max(step.pct, step.count > 0 ? 15 : 6)}%`, background: step.color }"></div>
            </div>
          </router-link>
        </div>
      </section>

      <div class="dash-grid">
        <section class="workbench-card">
          <div class="card-head">
            <div>
              <div class="card-eyebrow mono">
                <span class="material-symbols-outlined text-[14px]">fact_check</span>
                <span>{{ t('account.actionRequired') }}</span>
              </div>
              <h2 class="card-title">{{ t('sales.quoteTitle') }} · {{ t('account.quotesAwaiting') }}</h2>
            </div>
          </div>

          <div v-if="!awaitingQuotes.length" class="empty-tray">
            <div class="empty-icon-box">
              <span class="material-symbols-outlined text-[24px]">task_alt</span>
            </div>
            <p class="empty-text mono">{{ t('account.nothingAwaiting') }}</p>
            <span class="empty-hint">{{ t('account.reviewQuotesHint') }}</span>
          </div>

          <div v-else class="quote-list">
            <div
              v-for="q in awaitingQuotes"
              :key="q.id"
              class="quote-item"
              @click="router.push({ name: 'account-quote-detail', params: { id: q.id } })"
            >
              <div class="quote-left">
                <div class="quote-header-line">
                  <span class="quote-num mono">{{ q.quoteNumber }}</span>
                  <span class="quote-validity mono">{{ t('account.validUntilDate', { date: new Date(q.validUntil).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }) }}</span>
                </div>
                <div class="quote-rfq mono">{{ t('account.rfqRef', { number: q.rfqNumber ?? '' }) }}</div>
              </div>

              <div class="quote-right">
                <span class="quote-amount mono-num">
                  {{ formatPrice(q.amount, locale) }} {{ q.currency || 'USD' }}
                </span>
                <StatusPill :status="q.status" />
              </div>
            </div>
          </div>
        </section>

        <section class="workbench-card">
          <div class="card-head">
            <div>
              <div class="card-eyebrow mono">
                <span class="material-symbols-outlined text-[14px]">list_alt</span>
                <span>{{ t('account.inquiryQueue') }}</span>
              </div>
              <h2 class="card-title">{{ t('sales.rfqTitle') }}</h2>
            </div>
          </div>

          <div v-if="!recentRfqs.length" class="empty-tray">
            <div class="empty-icon-box">
              <span class="material-symbols-outlined text-[24px]">post_add</span>
            </div>
            <p class="empty-text mono">{{ t('sales.noRfqs') }}</p>
            <span class="empty-hint">{{ t('sales.noRfqsDesc') }}</span>
            <BaseButton
              variant="outline"
              size="sm"
              style="margin-top: 0.75rem"
              @click="router.push({ name: 'marketplace' })"
            >
              {{ t('account.createFirstRfq') }}
            </BaseButton>
          </div>

          <div v-else class="quote-list">
            <div
              v-for="r in recentRfqs"
              :key="r.id"
              class="quote-item"
              @click="router.push({ name: 'account-rfq-detail', params: { id: r.id } })"
            >
              <div class="quote-left">
                <div class="quote-header-line">
                  <span class="quote-num mono">{{ r.rfqNumber }}</span>
                  <span class="quote-validity mono">{{ new Date(r.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</span>
                </div>
                <div class="quote-rfq mono">{{ t('account.productsSpecified', { count: r.items.length }) }}</div>
              </div>

              <div class="quote-right">
                <span class="quote-amount mono-num">
                  ${{ formatPrice(r.total ?? 0, locale) }}
                </span>
                <StatusPill :status="r.status" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <section class="bento-section">
        <div class="bento-head">
          <div class="bento-title-group">
            <span class="mono bento-tag">{{ t('account.bentoTag') }}</span>
            <h3 class="bento-title">{{ t('account.bentoTitle') }}</h3>
          </div>
          <span class="mono bento-note">{{ t('account.bentoNote') }}</span>
        </div>

        <div class="bento-grid">
          <router-link to="/account/orders" class="bento-card">
            <div class="bento-icon-box bento-icon--indigo">
              <span class="material-symbols-outlined">receipt_long</span>
            </div>
            <div class="bento-content">
              <span class="mono bento-item-tag">{{ t('account.bentoOrdersTag') }}</span>
              <strong class="bento-item-title">{{ t('account.bentoOrdersTitle') }}</strong>
              <p class="bento-item-desc">{{ t('account.bentoOrdersDesc') }}</p>
            </div>
            <span class="material-symbols-outlined icon--directional bento-arrow">arrow_forward</span>
          </router-link>

          <router-link to="/certifications" class="bento-card">
            <div class="bento-icon-box bento-icon--emerald">
              <span class="material-symbols-outlined">verified_user</span>
            </div>
            <div class="bento-content">
              <span class="mono bento-item-tag">{{ t('account.bentoCertsTag') }}</span>
              <strong class="bento-item-title">{{ t('account.bentoCertsTitle') }}</strong>
              <p class="bento-item-desc">{{ t('account.bentoCertsDesc') }}</p>
            </div>
            <span class="material-symbols-outlined icon--directional bento-arrow">arrow_forward</span>
          </router-link>

          <router-link to="/wishlist" class="bento-card">
            <div class="bento-icon-box bento-icon--amber">
              <span class="material-symbols-outlined">bookmark</span>
            </div>
            <div class="bento-content">
              <span class="mono bento-item-tag">{{ t('account.bentoFavTag') }}</span>
              <strong class="bento-item-title">{{ t('account.bentoFavTitle', { count: wishlistCount }) }}</strong>
              <p class="bento-item-desc">{{ t('account.bentoFavDesc') }}</p>
            </div>
            <span class="material-symbols-outlined icon--directional bento-arrow">arrow_forward</span>
          </router-link>

          <router-link to="/addresses" class="bento-card">
            <div class="bento-icon-box bento-icon--slate">
              <span class="material-symbols-outlined">local_hospital</span>
            </div>
            <div class="bento-content">
              <span class="mono bento-item-tag">{{ t('account.bentoAddrTag') }}</span>
              <strong class="bento-item-title">{{ t('account.bentoAddrTitle') }}</strong>
              <p class="bento-item-desc">{{ t('account.bentoAddrDesc') }}</p>
            </div>
            <span class="material-symbols-outlined icon--directional bento-arrow">arrow_forward</span>
          </router-link>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.org-shell {
  max-width: var(--wl-max-width);
  margin: 0 auto;
  padding: var(--wl-page-padding-top) var(--wl-gutter) var(--wl-page-padding-bottom);
  padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left));
  padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right));
  width: 100%;
  box-sizing: border-box;
}

.org-crumb {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
  color: var(--wl-muted);
  background: var(--wl-surface);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  border: 1px solid var(--wl-border);
  margin-bottom: var(--space-6);
}

.org-crumb a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s;
}

.org-crumb a:hover {
  color: var(--wl-ink-strong);
}

.crumb-sep {
  opacity: 0.45;
  font-size: var(--step--1);
}

.crumb-current {
  color: var(--wl-ink-strong);
  font-weight: 600;
}

.org-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-8);
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
}

.org-head__main {
  flex: 1;
  min-width: 0;
  width: 100%;
}

.org-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
  color: var(--wl-gold);
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: var(--space-2);
  text-shadow: var(--wl-gold-text-shadow);
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--fg-success, #198754);
  box-shadow: 0 0 8px rgba(25, 135, 84, 0.6);
}

.org-title {
  font-size: clamp(1.8rem, 3.2vw, 2.5rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin: 0 0 0.5rem;
  background: var(--wl-gradient-gold);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: var(--wl-gold-text-filter);
}

.org-desc {
  font-size: var(--step-0);
  color: var(--wl-ink-soft);
  max-width: 600px;
  line-height: 1.55;
  margin: 0 0 var(--space-5);
}

.org-head__actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.org-company-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-5) var(--space-6);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 280px;
  border-inline-start: 3px solid var(--secondary, #147D92);
}

.company-card__top {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.company-card__avatar {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: rgba(20, 125, 146, 0.1);
  color: var(--secondary, #147D92);
  display: grid;
  place-items: center;
  font-size: var(--step-1);
}

.company-card__meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.company-card__role {
  font-size: var(--step--1);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--secondary, #147D92);
}

.company-card__name {
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-strong);
  letter-spacing: -0.01em;
}

.company-card__details {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.company-pill {
  font-size: var(--step--1);
  font-weight: 600;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  color: var(--wl-ink-soft);
}

.company-pill--verified {
  background: rgba(25, 135, 84, 0.08);
  border-color: rgba(25, 135, 84, 0.25);
  color: var(--fg-success, #198754);
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.pill-dot {
  width: var(--space-1);
  height: var(--space-1);
  border-radius: var(--radius-pill);
  background: var(--fg-success, #198754);
}

.company-country {
  font-size: var(--step--1);
  color: var(--wl-muted);
}


    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }
    .pipeline-card {
      padding: var(--space-6) var(--space-6);
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      margin-bottom: var(--space-6);
      position: relative;
      overflow: hidden;
    }

      .pipeline-card::before { display: none; }

    .pipeline-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: var(--space-4);
      margin-bottom: var(--space-5);
      flex-wrap: wrap;
    }

    .pipeline-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--step--1);
      color: var(--wl-gold);
      font-weight: 700;
      letter-spacing: 0.08em;
      margin-bottom: var(--space-1);
      text-shadow: var(--wl-gold-text-shadow);
    }

    .pipeline-title {
      font-family: var(--wl-font-display);
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.015em;
      color: var(--wl-gold-text);
      text-shadow: var(--wl-gold-text-shadow);
      margin: 0;
    }

    .pipeline-counter {
      font-size: var(--step--1);
      font-weight: 600;
      color: var(--wl-muted);
      background: var(--wl-surface-soft);
      border: 1px solid var(--wl-border);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-pill);
    }

    .pipeline-stepper {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-3);
    }

    .pipeline-step {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-3);
      background: var(--wl-surface-soft);
      border: 1px solid var(--wl-border);
      border-radius: var(--radius-md);
      text-decoration: none;
      color: inherit;
      transition: transform 0.16s var(--wl-ease-spring), border-color 0.16s ease, box-shadow 0.16s ease;
    }

      .pipeline-step:hover {
        border-color: rgba(79, 70, 229, 0.35);
        box-shadow: var(--shadow-card);
        transform: translateY(-1.5px);
      }

      .pipeline-step.is-active {
        background: var(--wl-surface);
        border-color: var(--wl-border);
      }

    .step-meta {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .step-icon {
      font-size: var(--step-1);
    }

    .step-label {
      font-size: var(--step--1);
      font-weight: 700;
      color: var(--wl-ink-strong);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .step-count-box {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .step-count {
      font-size: 1.35rem;
      font-weight: 800;
      line-height: 1;
      color: var(--wl-ink-strong);
    }

    .step-status {
      font-size: var(--step--1);
      color: var(--wl-muted);
      font-weight: 600;
      text-align: end;
      white-space: nowrap;
    }

    .step-bar {
      height: 5px;
      background: rgba(0, 0, 0, 0.06);
      border-radius: var(--radius-pill);
      overflow: hidden;
      margin-top: var(--space-1);
    }

    .step-bar__fill {
      height: 100%;
      border-radius: var(--radius-pill);
      transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @media (max-width: 900px) {
      .pipeline-stepper {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 540px) {
      .pipeline-stepper {
        grid-template-columns: 1fr;
      }
    }
    .dash-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }

    .workbench-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: var(--space-6);
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
    }

    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--space-4);
      gap: var(--space-3);
    }

    .card-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--step--1);
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--wl-gold);
      margin-bottom: var(--space-1);
      text-shadow: var(--wl-gold-text-shadow);
    }

    .card-title {
      font-size: var(--step-0);
      font-weight: 700;
      color: var(--wl-gold-text);
      text-shadow: var(--wl-gold-text-shadow);
      margin: 0;
    }

    .view-all-link {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--step--1);
      font-weight: 600;
      color: var(--wl-primary);
      text-decoration: none;
      transition: color 0.15s;
    }

      .view-all-link:hover {
        color: var(--wl-primary-hover);
      }

    .empty-tray {
      padding: var(--space-9) var(--space-4);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .empty-icon-box {
      width: 46px;
      height: 46px;
      border-radius: var(--radius-pill);
      background: var(--wl-surface-soft);
      color: var(--wl-muted);
      display: grid;
      place-items: center;
      margin-bottom: var(--space-3);
    }

    .empty-text {
      font-size: var(--step--1);
      font-weight: 600;
      color: var(--wl-ink-strong);
      margin-bottom: var(--space-1);
    }

    .empty-hint {
      font-size: var(--step--1);
      color: var(--wl-muted);
    }

    .quote-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .quote-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--wl-border);
      border-radius: var(--radius-md);
      background: var(--wl-surface-soft);
      cursor: pointer;
      transition: all 0.15s ease;
      gap: var(--space-4);
    }

      .quote-item:hover {
        background: var(--wl-surface);
        border-color: rgba(99, 102, 241, 0.4);
        box-shadow: var(--shadow-card);
        transform: translateY(-1px);
      }

      .quote-item:active {
        transform: translateY(0);
      }

      .quote-item:focus-visible {
        outline: 2px solid var(--wl-primary);
        outline-offset: 2px;
      }

    .quote-left {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .quote-header-line {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .quote-num {
      font-size: var(--step--1);
      font-weight: 700;
      color: var(--wl-ink-strong);
    }

    .quote-validity {
      font-size: var(--step--1);
      color: var(--wl-muted);
    }

    .quote-rfq {
      font-size: var(--step--1);
      color: var(--wl-ink-soft);
    }

    .quote-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--space-1);
    }

    .quote-amount {
      font-size: var(--step-0);
      font-weight: 700;
      color: var(--wl-ink-strong);
    }
    .bento-section {
      background: var(--wl-surface);
      border: 1px solid var(--wl-border);
      border-radius: var(--radius-md);
      padding: var(--space-6) var(--space-7);
      box-shadow: var(--shadow-card);
    }

    .bento-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: var(--space-5);
      gap: var(--space-4);
      flex-wrap: wrap;
    }

    .bento-tag {
      font-size: var(--step--1);
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--secondary, #147D92);
      display: block;
      margin-bottom: var(--space-1);
    }

    .bento-title {
      font-size: var(--step-0);
      font-weight: 700;
      color: var(--wl-ink-strong);
      margin: 0;
    }

    .bento-note {
      font-size: var(--step--1);
      color: var(--wl-muted);
      letter-spacing: 0.06em;
    }

    .bento-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-4);
    }

    .bento-card {
      border: 1px solid var(--wl-border);
      background: var(--wl-surface-soft);
      border-radius: var(--radius-md);
      padding: var(--space-5);
      text-decoration: none;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }

      .bento-card:hover {
        background: var(--wl-surface);
        border-color: var(--wl-primary);
        transform: translateY(-2px);
        box-shadow: var(--shadow-hover);
      }

      .bento-card:active {
        transform: translateY(0);
      }

      .bento-card:focus-visible {
        outline: 2px solid var(--wl-primary);
        outline-offset: 2px;
      }

    .bento-icon-box {
      width: 38px;
      height: 38px;
      border-radius: var(--radius-md);
      display: grid;
      place-items: center;
      font-size: var(--step-1);
    }

    .bento-icon--indigo {
      background: rgba(20, 125, 146, 0.1);
      color: var(--secondary, #147D92);
    }

    .bento-icon--emerald {
      background: rgba(25, 135, 84, 0.1);
      color: var(--fg-success, #198754);
    }

    .bento-icon--amber {
      background: rgba(230, 126, 34, 0.1);
      color: var(--fg-warning, #E67E22);
    }

    .bento-icon--slate {
      background: var(--bg-subtle);
      color: var(--fg-muted, #627D98);
    }

    .bento-content {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      flex: 1;
    }

    .bento-item-tag {
      font-size: var(--step--1);
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--wl-muted);
    }

    .bento-item-title {
      font-size: var(--step-0);
      font-weight: 700;
      color: var(--wl-ink-strong);
    }

    .bento-item-desc {
      font-size: var(--step--1);
      color: var(--wl-ink-soft);
      line-height: 1.45;
      margin: 0;
    }

    .bento-arrow {
      position: absolute;
      top: var(--space-5);
      inset-inline-end: var(--space-5);
      font-size: var(--step-0);
      color: var(--wl-muted);
      transition: all 0.18s;
    }

    .bento-card:hover .bento-arrow {
      color: var(--wl-primary);
      transform: translateX(3px);
    }

    @media (max-width: 1080px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: var(--space-4);
      }

      .pipeline-stepper {
        grid-template-columns: repeat(3, 1fr);
        gap: var(--space-3);
      }

      .bento-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: var(--space-3);
      }
    }

    @media (max-width: 820px) {
      .org-shell {
        padding: var(--space-5) var(--space-5) var(--space-10);
        padding-inline-start: max(var(--space-5), env(safe-area-inset-left));
        padding-inline-end: max(var(--space-5), env(safe-area-inset-right));
      }

      .org-head {
        gap: var(--space-5);
        margin-bottom: var(--space-5);
        flex-direction: column;
      }

      .org-company-card {
        width: 100%;
        min-width: 0;
      }

      .dash-grid {
        grid-template-columns: 1fr;
        gap: var(--space-4);
        margin-bottom: var(--space-6);
      }

      .pipeline-stepper {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 640px) {
      .org-shell {
        padding: var(--space-4) var(--space-4) var(--space-8);
        padding-inline-start: max(var(--space-4), env(safe-area-inset-left));
        padding-inline-end: max(var(--space-4), env(safe-area-inset-right));
      }

      .org-title {
        font-size: clamp(1.4rem, 5.5vw, 1.95rem);
      }

      .org-head__actions {
        display: flex;
        flex-direction: column;
        width: 100%;
        gap: var(--space-2);
      }

        .org-head__actions > * {
          width: 100%;
          justify-content: center;
        }

      .stats-grid {
        grid-template-columns: 1fr;
        gap: var(--space-3);
        margin-bottom: var(--space-5);
      }

      .pipeline-card {
        padding: var(--space-5) var(--space-4);
        margin-bottom: var(--space-5);
      }

      .workbench-card {
        padding: var(--space-5) var(--space-4);
      }

      .quote-item {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
      }

      .quote-right {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px dashed var(--wl-border);
        padding-top: 0.5rem;
      }

      .bento-grid {
        grid-template-columns: 1fr;
        gap: var(--space-3);
      }

      .bento-card {
        padding: var(--space-4) var(--space-5);
      }
    }

    @media (max-width: 480px) {
      .org-shell {
        padding: var(--space-3) var(--space-3) var(--space-7);
        padding-inline-start: max(var(--space-3), env(safe-area-inset-left));
        padding-inline-end: max(var(--space-3), env(safe-area-inset-right));
      }

      .pipeline-stepper {
        grid-template-columns: 1fr;
        gap: var(--space-2);
      }

      .pipeline-head {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-2);
      }

      .pipeline-counter {
        font-size: var(--step--1);
        padding: var(--space-1) var(--space-2);
      }

      .company-card__top {
        gap: var(--space-2);
      }

      .company-card__details {
        gap: var(--space-1);
      }

      .quote-header-line {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-1);
      }
    }
</style>




