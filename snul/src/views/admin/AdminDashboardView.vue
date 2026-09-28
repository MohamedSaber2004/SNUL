<script setup lang="ts">
import { onMounted, onActivated, onUnmounted, ref, computed } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import StatCard from '../../components/ui/StatCard.vue'
import FileUpload from '../../components/ui/FileUpload.vue'
import { ATTACHMENT_PLACE, MEDIA_TYPE } from '../../config/api.config'
import { authService as authSvc, services, locationRepository, userRepository, locationService, companyRepository, marketplaceRepository } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import StatusPill from '../../components/ui/StatusPill.vue'
import { useUserLookup } from '../../composables/useUserLookup'
import type { AuditLogDto } from '../../domain/models/audit-log'
import type { CategoryDto, CreateCategoryPayload } from '../../domain/models/marketplace'
import { t, locale } from '../../i18n'
import { formatPrice } from '../../utils/format'

const isSalesOnly = computed(() => authSvc.isSales.value && !authSvc.isAdmin.value)

const { getUserInfo, resolveLogsUsers, getRoleBadgeClass } = useUserLookup()

const stats = ref({ countries: 0, cities: 0, zones: 0, users: 0, pendingApps: 0, products: 0, categories: 0 })
const loading = ref(true)
const activeChartPoint = ref<{ month: string; value: number; x: number; y: number } | null>(null)
const recentAuditLogs = ref<AuditLogDto[]>([])

const liveCounts = computed(() => ({
  countries: locationService.countries.value.length || stats.value.countries,
  cities: locationService.cities.value.length || stats.value.cities,
  zones: locationService.zones.value.length || stats.value.zones,
}))

const staffMetrics = computed(() => {
  const rfqs = services.salesService.rfqs.value
  const orders = services.commerceService.orders.value
  const tickets = services.contentService.tickets.value

  const pendingRfqs = rfqs.filter((r) => r.status === 'Pending')
  const pendingOrders = orders.filter((o) => o.status === 'Pending' || o.status === 'Confirmed')
  const openTickets = tickets.filter((t) => t.status !== 'Closed')

  return {
    rfqTotal: services.salesService.rfqTotalCount.value || rfqs.length,
    pendingRfqsCount: pendingRfqs.length,
    urgentRfqs: pendingRfqs.slice(0, 5),
    orderTotal: services.commerceService.totalCount.value || orders.length,
    pendingOrdersCount: pendingOrders.length,
    activeOrders: pendingOrders.slice(0, 5),
    openTicketsCount: openTickets.length,
    urgentTickets: openTickets.slice(0, 5),
  }
})

const dynamicThroughput = computed(() => {
  const months: { month: string; ym: string; value: number }[] = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = d.toLocaleString(locale.value === 'ar' ? 'ar-EG' : 'en-US', { month: 'short' })
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ month, ym, value: 0 })
  }

  const allDates = [
    ...services.commerceService.orders.value.map((o) => o.createdAt),
    ...services.salesService.rfqs.value.map((r) => r.createdAt),
    ...(!isSalesOnly.value ? recentAuditLogs.value.map((l) => l.createdAt) : []),
  ]

  for (const iso of allDates) {
    if (!iso) continue
    const ym = iso.slice(0, 7)
    const match = months.find((m) => m.ym === ym)
    if (match) match.value++
  }

  return months.map((m) => ({ month: m.month, value: m.value }))
})

const smoothChart = computed(() => {
  const data = dynamicThroughput.value
  const width = 540
  const height = 180
  const paddingX = 24
  const paddingY = 20
  const chartW = width - paddingX * 2
  const chartH = height - paddingY * 2

  const maxVal = Math.max(...data.map((d) => d.value), 1)
  const minVal = 0

  const points = data.map((d, i) => {
    const x = paddingX + (i / Math.max(data.length - 1, 1)) * chartW
    const y = height - paddingY - ((d.value - minVal) / (maxVal - minVal)) * chartH
    return { ...d, x, y }
  })

  const pStart = points[0]!
  const pEnd = points[points.length - 1]!

  let line = `M ${pStart.x.toFixed(1)} ${pStart.y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = (i === 0 ? points[0] : points[i - 1])!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = (i + 2 >= points.length ? points[points.length - 1] : points[i + 2])!

    const tension = 0.4
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2.5
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2.5
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2.5
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2.5

    line += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }

  const area = `${line} L ${pEnd.x.toFixed(1)} ${height - paddingY} L ${pStart.x.toFixed(1)} ${height - paddingY} Z`
  return { line, area, points }
})

const peakThroughputMonth = computed(() => {
  const data = dynamicThroughput.value
  if (!data.length) return { month: '—', value: 0 }
  return data.reduce((max, d) => (d.value > max.value ? d : max), data[0] || { month: '—', value: 0 })
})

const currentMonthOps = computed(() => {
  const data = dynamicThroughput.value
  return data[data.length - 1]?.value ?? 0
})

const totalSevenMonthOps = computed(() => {
  return dynamicThroughput.value.reduce((sum, d) => sum + d.value, 0)
})

const territoryData = computed(() => {
  const max = Math.max(liveCounts.value.countries, liveCounts.value.cities, liveCounts.value.zones, 1)
  return [
    { label: t('admin.countries'), value: liveCounts.value.countries, pct: Math.round((liveCounts.value.countries / max) * 100), color: 'var(--wl-primary-light)', icon: 'public', desc: t('admin.sovereignRoot') },
    { label: t('admin.cities'), value: liveCounts.value.cities, pct: Math.round((liveCounts.value.cities / max) * 100), color: 'var(--wl-primary-active)', icon: 'location_city', desc: t('admin.regionalHubs') },
    { label: t('admin.zones'), value: liveCounts.value.zones, pct: Math.round((liveCounts.value.zones / max) * 100), color: 'var(--wl-success)', icon: 'my_location', desc: t('admin.deliveryAnchors') },
  ]
})

const territoryRatios = computed(() => {
  const c = liveCounts.value.countries || 1
  const ci = liveCounts.value.cities || 0
  const z = liveCounts.value.zones || 0
  return {
    citiesPerCountry: (ci / c).toFixed(1),
    zonesPerCity: ci > 0 ? (z / ci).toFixed(1) : '0',
  }
})

const activeDonutSegment = ref<{ label: string; value: number; pct: number; color: string; to: string } | null>(null)

const platformData = computed(() => {
  const items = [
    { label: t('admin.products'), value: stats.value.products, color: 'var(--wl-primary-light)', to: '/marketplace' },
    { label: t('admin.categoriesTitle'), value: stats.value.categories, color: 'var(--wl-primary-active)', to: '/marketplace' },
    { label: t('admin.users'), value: stats.value.users, color: 'var(--wl-success)', to: '/admin/users' },
    { label: t('admin.distributorApps'), value: stats.value.pendingApps, color: 'var(--wl-warning)', to: '/admin/companies' },
  ]
  const total = items.reduce((s, i) => s + i.value, 0) || 1
  let acc = 0
  return items.map((it) => {
    const pct = (it.value / total) * 100
    const res = { ...it, pct, start: acc }
    acc += pct
    return res
  })
})

const platformTotal = computed(() => stats.value.products + stats.value.categories + stats.value.users + stats.value.pendingApps)

const DONUT_CIRCUMFERENCE = 314.159
const donutSegments = computed(() => {
  const total = platformTotal.value || 1
  let accumulated = 0
  const activeCount = platformData.value.filter(x => x.value > 0).length

  return platformData.value.map((item) => {
    const frac = item.value / total
    const rawLen = frac * DONUT_CIRCUMFERENCE
    const strokeLen = activeCount > 1 && rawLen > 4 ? rawLen - 3 : rawLen
    const strokeOffset = -accumulated * DONUT_CIRCUMFERENCE
    accumulated += frac
    return {
      ...item,
      dashArray: `${strokeLen.toFixed(2)} ${DONUT_CIRCUMFERENCE.toFixed(2)}`,
      dashOffset: strokeOffset.toFixed(2),
    }
  })
})

function formatAuditTime(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(locale.value === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function actionBadgeClass(action: string): string {
  const map: Record<string, string> = {
    CREATE: 'badge--teal',
    UPDATE: 'badge--slate',
    DELETE: 'badge--red',
    APPROVE: 'badge--teal',
    REJECT: 'badge--red',
    LOGIN: 'badge--amber',
    LOGOUT: 'badge--muted',
    STATUS_CHANGE: 'badge--slate',
    UPLOAD: 'badge--teal',
    DOWNLOAD: 'badge--slate',
    ASSIGN: 'badge--amber',
  }
  return map[action] ?? 'badge--slate'
}

const load = async () => {
  if (!services.authService.isAuthenticated) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const isStaff = isSalesOnly.value
    const [countries, cities, zones, usersPage, appsPage, productsPage, categoriesList] = await Promise.all([
      !isStaff ? locationRepository.getCountries().catch(() => []) : Promise.resolve([]),
      !isStaff ? locationRepository.getCities().catch(() => []) : Promise.resolve([]),
      !isStaff ? locationRepository.getZones().catch(() => []) : Promise.resolve([]),
      !isStaff ? userRepository.getUsers({ pageNumber: 1, pageSize: 1 }).catch(() => null) : Promise.resolve(null),
      !isStaff ? companyRepository.getDistributorApplications({ pageNumber: 1, pageSize: 1, status: 1 }).catch(() => null) : Promise.resolve(null),
      marketplaceRepository.getProducts({ page: 1, pageSize: 1 }).catch(() => null),
      marketplaceRepository.getCategories().catch(() => []),
      services.salesService.loadRfqs({ pageNumber: 1, pageSize: 10 }).catch(() => null),
      services.commerceService.loadOrders({ page: 1, pageSize: 10 }).catch(() => null),
      services.contentService.loadTickets().catch(() => []),
      !isStaff ? services.contentService.loadDocuments().catch(() => []) : Promise.resolve([]),
      !isStaff ? services.contentService.loadSupportContact().catch(() => null) : Promise.resolve(null),
      !isStaff ? services.auditLogService.loadLogs({ pageSize: 6 }).catch(() => null) : Promise.resolve(null),
    ])

    if (!isStaff) {
      recentAuditLogs.value = services.auditLogService.logs.value.slice(0, 6)
      if (recentAuditLogs.value.length > 0) {
        void resolveLogsUsers(recentAuditLogs.value)
      }
    } else {
      recentAuditLogs.value = []
    }

    const extractCount = (res: unknown): number => {
      if (!res) return 0
      const obj = res as Record<string, unknown>
      if (typeof obj.totalCount === 'number') return obj.totalCount
      if (typeof obj.TotalCount === 'number') return obj.TotalCount
      if (typeof obj.count === 'number') return obj.count
      if (Array.isArray(obj.data)) {
        return typeof obj.totalCount === 'number' ? obj.totalCount : (obj.data as unknown[]).length
      }
      if (Array.isArray(res)) return res.length
      return 0
    }

    stats.value = {
      countries: Array.isArray(countries) ? countries.length : 0,
      cities: Array.isArray(cities) ? cities.length : 0,
      zones: Array.isArray(zones) ? zones.length : 0,
      users: extractCount(usersPage),
      pendingApps: extractCount(appsPage),
      products: extractCount(productsPage),
      categories: Array.isArray(categoriesList) ? categoriesList.length : 0,
    }
    if (!isStaff) {
      if (Array.isArray(countries)) locationService.countries.value = countries as never
      if (Array.isArray(cities)) locationService.cities.value = cities as never
      if (Array.isArray(zones)) locationService.zones.value = zones as never
    }
  } finally {
    loading.value = false
  }
}

const showCategoryModal = ref(false)
const categoryFormLoading = ref(false)
const categoryFormError = ref('')
const parentCategories = ref<CategoryDto[]>([])
const categoryForm = ref({
  nameEn: '',
  nameAr: '',
  description: '',
  imageName: '',
  parentCategoryId: '',
})

function openCategoryModal() {
  categoryForm.value = { nameEn: '', nameAr: '', description: '', imageName: '', parentCategoryId: '' }
  categoryFormError.value = ''
  showCategoryModal.value = true
  void marketplaceRepository.getCategories()
    .then((list) => { parentCategories.value = Array.isArray(list) ? list : [] })
    .catch(() => { parentCategories.value = [] })
}

function closeCategoryModal() {
  showCategoryModal.value = false
  categoryFormError.value = ''
}

async function submitCategoryModal() {
  const f = categoryForm.value
  if (!f.nameEn.trim() || !f.nameAr.trim()) {
    categoryFormError.value = t('admin.errBothNames')
    return
  }
  categoryFormLoading.value = true
  categoryFormError.value = ''
  try {
    const payload: CreateCategoryPayload = {
      nameEn: f.nameEn.trim(),
      nameAr: f.nameAr.trim(),
      description: f.description.trim() || undefined,
      imageName: f.imageName.trim() || null,
      parentCategoryId: f.parentCategoryId || null,
    }
    await marketplaceRepository.createCategory(payload)
    toastService.success(t('admin.categoryCreated'))
    closeCategoryModal()
  } catch (e) {
    categoryFormError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    categoryFormLoading.value = false
  }
}

const showContactModal = ref(false)
const contactLoading = ref(false)
const contactError = ref<string | null>(null)
const contactForm = ref({
  supportEmail: '',
  phoneNumber: '',
  whatsAppNumber: '',
  workingHours: '',
})

function openContactModal() {
  const current = services.contentService.supportContact.value
  contactForm.value = {
    supportEmail: current.supportEmail || '',
    phoneNumber: current.phoneNumber || '',
    whatsAppNumber: current.whatsAppNumber || '',
    workingHours: current.workingHours || '',
  }
  contactError.value = null
  showContactModal.value = true
}

async function handleSaveContact() {
  if (!contactForm.value.supportEmail || !contactForm.value.phoneNumber || !contactForm.value.whatsAppNumber) {
    contactError.value = t('common.error')
    return
  }
  contactLoading.value = true
  contactError.value = null
  try {
    await services.contentService.updateSupportContact(contactForm.value)
    toastService.success(t('admin.supportChannelsSaveSuccess'))
    showContactModal.value = false
  } catch (err: unknown) {
    contactError.value = err instanceof Error ? err.message : t('common.error')
    toastService.error(contactError.value)
  } finally {
    contactLoading.value = false
  }
}

onMounted(load)
onActivated(load)
const _removeListeners = (() => {
  if (typeof window === 'undefined') return () => {}
  const h = () => void load()
  window.addEventListener('focus', h)
  window.addEventListener('snul:users-changed', h as EventListener)
  window.addEventListener('snul:location-changed', h as EventListener)
  window.addEventListener('welco:users-changed', h as EventListener)
  window.addEventListener('welco:location-changed', h as EventListener)
  return () => {
    window.removeEventListener('focus', h)
    window.removeEventListener('snul:users-changed', h as EventListener)
    window.removeEventListener('snul:location-changed', h as EventListener)
    window.removeEventListener('welco:users-changed', h as EventListener)
    window.removeEventListener('welco:location-changed', h as EventListener)
  }
})()
onUnmounted(_removeListeners)
</script>

<template>
  <AdminLayout>
    <header class="dash-head">
      <div>
        <div class="dash-eyebrow mono">
          <span class="live-dot" aria-hidden="true"></span>
          <span>{{ isSalesOnly ? t('admin.salesConsole') : t('admin.dashboard') }}</span>
        </div>
        <h1 class="dash-title">{{ isSalesOnly ? t('admin.fulfillmentHub') : t('admin.dashboard') }}</h1>
        <p class="dash-head__desc">
          {{ isSalesOnly ? t('admin.salesConsoleDesc') : t('admin.overviewDesc') }}
        </p>
      </div>

      <div class="dash-head__actions">
        <div v-if="!isSalesOnly" class="status-badge mono">
          <span class="live-dot" aria-hidden="true"></span>
          <span>{{ t('admin.gatewayActive') }}</span>
        </div>
        <template v-if="isSalesOnly">
          <BaseButton variant="primary" size="sm" @click="$router.push('/admin/sales')">
            <span class="material-symbols-outlined text-[16px]">receipt_long</span>
            <span>{{ t('admin.issueQuotation') }}</span>
          </BaseButton>
          <BaseButton variant="outline" size="sm" @click="$router.push('/admin/orders')">
            <span class="material-symbols-outlined text-[16px]">local_shipping</span>
            <span>{{ t('admin.processOrders') }}</span>
          </BaseButton>
        </template>
        <template v-else>
          <BaseButton variant="outline" size="sm" @click="openContactModal">
            <span class="material-symbols-outlined text-[16px]">contact_support</span>
            <span>{{ t('admin.supportChannels') }}</span>
          </BaseButton>
          <BaseButton variant="primary" size="sm" @click="$router.push('/admin/categories')">
            <span class="material-symbols-outlined text-[16px]">category</span>
            <span>{{ t('admin.categoriesTitle') }}</span>
          </BaseButton>
        </template>
      </div>
    </header>

    <SkeletonLoader v-if="loading" type="stats-grid" :count="4" gap="1rem" />

    <div v-else-if="isSalesOnly" class="stats-grid stats-grid--staff">
      <StatCard
        :label="t('admin.openRfqQueue')"
        :value="staffMetrics.rfqTotal"
        to="/admin/sales"
        tone="amber"
        icon-only
      >
        <template #icon><span class="material-symbols-outlined text-[18px]">request_quote</span></template>
      </StatCard>

      <StatCard
        :label="t('admin.fulfillmentOrders')"
        :value="staffMetrics.orderTotal"
        to="/admin/orders"
        tone="indigo"
        icon-only
      >
        <template #icon><span class="material-symbols-outlined text-[18px]">local_shipping</span></template>
      </StatCard>

      <StatCard
        :label="t('admin.supportInquiries')"
        :value="staffMetrics.openTicketsCount"
        to="/admin/tickets"
        tone="amber"
        icon-only
      >
        <template #icon><span class="material-symbols-outlined text-[18px]">support_agent</span></template>
      </StatCard>

      <StatCard
        :label="t('admin.productsTitle')"
        :value="stats.products"
        to="/marketplace"
        tone="emerald"
        icon-only
      >
        <template #icon><span class="material-symbols-outlined text-[18px]">inventory_2</span></template>
      </StatCard>
    </div>

    <!-- Admin Metrics Cards Grid (Real API counts without fake sparklines/trends) -->
    <div v-else class="stats-grid">
      <StatCard
        :label="t('admin.totalCountries')"
        :value="liveCounts.countries"
        to="/admin/countries"
        tone="indigo"
        icon-only
      >
        <template #icon><span class="material-symbols-outlined text-[18px]">public</span></template>
      </StatCard>

      <StatCard
        :label="t('admin.totalCities')"
        :value="liveCounts.cities"
        to="/admin/cities"
        tone="emerald"
        icon-only
      >
        <template #icon><span class="material-symbols-outlined text-[18px]">location_city</span></template>
      </StatCard>

      <StatCard
        :label="t('admin.totalZones')"
        :value="liveCounts.zones"
        to="/admin/zones"
        tone="slate"
        icon-only
      >
        <template #icon><span class="material-symbols-outlined text-[18px]">my_location</span></template>
      </StatCard>

      <StatCard
        :label="t('admin.totalUsers')"
        :value="stats.users"
        to="/admin/users"
        tone="indigo"
        icon-only
      >
        <template #icon><span class="material-symbols-outlined text-[18px]">group</span></template>
      </StatCard>

      <StatCard
        :label="t('admin.distributorApps')"
        :value="stats.pendingApps"
        to="/admin/companies"
        tone="amber"
        icon-only
      >
        <template #icon><span class="material-symbols-outlined text-[18px]">apartment</span></template>
      </StatCard>

    </div>

    <!-- Staff Operational Triage Queues (Exclusive to SNUL Staff) -->
    <section v-if="isSalesOnly" class="sales-operations-section">
      <div class="sales-queues-grid">
        <!-- Queue 1: Urgent RFQ Queue -->
        <div class="card sales-queue-card">
          <div class="queue-card__head">
            <div class="queue-card__title-group">
              <div class="queue-icon queue-icon--amber">
                <span class="material-symbols-outlined text-[18px]">receipt_long</span>
              </div>
              <div>
                <h3 class="queue-title">{{ t('admin.urgentRfqQueue') }}</h3>
                <span class="mono queue-sub">{{ staffMetrics.pendingRfqsCount }} {{ t('admin.awaitingQuotation') }}</span>
              </div>
            </div>
            <router-link to="/admin/sales" class="queue-link mono">
              <span>{{ t('common.viewAll') }}</span>
              <span class="material-symbols-outlined text-[14px] icon--directional">arrow_forward</span>
            </router-link>
          </div>

          <div v-if="!staffMetrics.urgentRfqs.length" class="empty-list-dash">
            <span class="material-symbols-outlined text-[20px] text-muted">task_alt</span>
            <span class="mono text-xs text-muted">{{ t('admin.allQuoted') }}</span>
          </div>

          <div v-else class="dash-mini-list">
            <div
              v-for="rfq in staffMetrics.urgentRfqs"
              :key="rfq.id"
              class="dash-mini-item"
              @click="$router.push('/admin/sales')"
            >
              <div class="dash-mini-main">
                <div class="flex items-center gap-2">
                  <strong class="dash-mini-id mono">{{ rfq.rfqNumber }}</strong>
                  <span class="priority-chip mono text-[10px]">RFQ</span>
                </div>
                <span class="dash-mini-sub mono">{{ rfq.companyName || t('admin.institutionalClientFallback') }} · {{ t('account.itemsCount', { count: rfq.items.length }) }}</span>
              </div>
              <div class="dash-mini-action">
                <StatusPill :status="rfq.status" />
                <span class="material-symbols-outlined text-[16px] text-muted icon--directional">chevron_right</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Queue 2: Active Orders Fulfillment Queue -->
        <div class="card sales-queue-card">
          <div class="queue-card__head">
            <div class="queue-card__title-group">
              <div class="queue-icon queue-icon--indigo">
                <span class="material-symbols-outlined text-[18px]">local_shipping</span>
              </div>
              <div>
                <h3 class="queue-title">{{ t('admin.activeOrdersQueue') }}</h3>
                <span class="mono queue-sub">{{ staffMetrics.pendingOrdersCount }} {{ t('admin.awaitingFulfillment') }}</span>
              </div>
            </div>
            <router-link to="/admin/orders" class="queue-link mono">
              <span>{{ t('common.viewAll') }}</span>
              <span class="material-symbols-outlined text-[14px] icon--directional">arrow_forward</span>
            </router-link>
          </div>

          <div v-if="!staffMetrics.activeOrders.length" class="empty-list-dash">
            <span class="material-symbols-outlined text-[20px] text-muted">task_alt</span>
            <span class="mono text-xs text-muted">{{ t('admin.allOrdersFulfilled') }}</span>
          </div>

          <div v-else class="dash-mini-list">
            <div
              v-for="order in staffMetrics.activeOrders"
              :key="order.id"
              class="dash-mini-item"
              @click="$router.push('/admin/orders')"
            >
              <div class="dash-mini-main">
                <div class="flex items-center gap-2">
                  <strong class="dash-mini-id mono">{{ order.orderNumber }}</strong>
                  <span class="priority-chip priority-chip--order mono text-[10px]">{{ order.currencySymbol || '$' }}{{ formatPrice(order.totalAmount ?? 0, locale) }}</span>
                </div>
                <span class="dash-mini-sub mono">{{ t('account.lineItemsCount', { count: order.items?.length || 0 }) }}</span>
              </div>
              <div class="dash-mini-action">
                <StatusPill :status="order.status" />
                <span class="material-symbols-outlined text-[16px] text-muted icon--directional">chevron_right</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Queue 3: Support Inquiries Queue -->
        <div class="card sales-queue-card">
          <div class="queue-card__head">
            <div class="queue-card__title-group">
              <div class="queue-icon queue-icon--emerald">
                <span class="material-symbols-outlined text-[18px]">support_agent</span>
              </div>
              <div>
                <h3 class="queue-title">{{ t('admin.supportQueue') }}</h3>
                <span class="mono queue-sub">{{ staffMetrics.openTicketsCount }} {{ t('admin.awaitingReply') }}</span>
              </div>
            </div>
            <router-link to="/admin/tickets" class="queue-link mono">
              <span>{{ t('common.viewAll') }}</span>
              <span class="material-symbols-outlined text-[14px] icon--directional">arrow_forward</span>
            </router-link>
          </div>

          <div v-if="!staffMetrics.urgentTickets.length" class="empty-list-dash">
            <span class="material-symbols-outlined text-[20px] text-muted">task_alt</span>
            <span class="mono text-xs text-muted">{{ t('admin.allTicketsResolved') }}</span>
          </div>

          <div v-else class="dash-mini-list">
            <div
              v-for="tk in staffMetrics.urgentTickets"
              :key="tk.id"
              class="dash-mini-item"
              @click="$router.push('/admin/tickets')"
            >
              <div class="dash-mini-main">
                <div class="flex items-center gap-2">
                  <strong class="dash-mini-id mono truncate max-w-[170px]">{{ tk.subject }}</strong>
                </div>
              </div>
              <div class="dash-mini-action">
                <StatusPill :status="tk.status" />
                <span class="material-symbols-outlined text-[16px] text-muted icon--directional">chevron_right</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Admin Charts & Visualizations Section (Admin Only) -->
    <section v-else class="chart-section">
      <div class="chart-grid">
        <!-- Smooth Curve Activity / Real Dynamic Throughput Chart -->
        <div class="card chart-card chart-card--wide">
          <div class="chart-card__head">
            <div>
              <div class="chart-eyebrow mono">
                <span class="live-dot" aria-hidden="true"></span>
                <span>{{ t('admin.telemetryTitle') }}</span>
              </div>
              <h3 class="chart-title">
                <span class="material-symbols-outlined header-icon">trending_up</span>
                {{ t('admin.throughputTitle') }}
              </h3>
            </div>

            <!-- Precision Real-time KPI Readouts -->
            <div class="chart-telemetry-bar">
              <div class="telemetry-item">
                <span class="telemetry-label mono">{{ t('admin.kpiOps') }}</span>
                <strong class="telemetry-value mono">{{ totalSevenMonthOps.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</strong>
              </div>
              <span class="telemetry-sep" aria-hidden="true"></span>
              <div class="telemetry-item">
                <span class="telemetry-label mono">{{ t('admin.kpiPeak') }}</span>
                <strong class="telemetry-value mono">{{ peakThroughputMonth.month }} · {{ peakThroughputMonth.value }}</strong>
              </div>
              <span class="telemetry-sep" aria-hidden="true"></span>
              <div class="telemetry-item">
                <span class="telemetry-label mono">{{ t('admin.kpiRunRate') }}</span>
                <strong class="telemetry-value mono">{{ currentMonthOps }} {{ t('admin.opsUnit') }}</strong>
              </div>
            </div>
          </div>

          <div class="curve-chart-container">
            <svg class="curve-chart-svg" viewBox="0 0 540 180" preserveAspectRatio="none">
              <defs>
<linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--wl-primary-light)" stop-opacity="0.32" />
                  <stop offset="60%" stop-color="var(--wl-primary-active)" stop-opacity="0.10" />
                  <stop offset="100%" stop-color="var(--wl-primary-active)" stop-opacity="0.0" />
                </linearGradient>
                <linearGradient id="laserStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="var(--wl-primary-light)" />
                  <stop offset="50%" stop-color="var(--wl-primary-active)" />
                  <stop offset="100%" stop-color="var(--wl-primary-active)" />
                </linearGradient>
              </defs>

              <!-- Gridlines -->
              <line x1="24" y1="20" x2="516" y2="20" class="chart-gridline" />
              <line x1="24" y1="65" x2="516" y2="65" class="chart-gridline" />
              <line x1="24" y1="110" x2="516" y2="110" class="chart-gridline" />
              <line x1="24" y1="160" x2="516" y2="160" class="chart-gridline chart-gridline--base" />

              <!-- Ambient Glow & Laser Curve -->
              <path :d="smoothChart.area" fill="url(#curveGrad)" />
              <path :d="smoothChart.line" fill="none" stroke="rgba(105, 169, 255, 0.25)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" class="chart-glow-path" />
              <path :d="smoothChart.line" fill="none" stroke="url(#laserStrokeGrad)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />

              <!-- Interactive Laser Caliper Vertical Guide -->
              <line
                v-if="activeChartPoint"
                :x1="activeChartPoint.x"
                y1="18"
                :x2="activeChartPoint.x"
                y2="160"
                class="chart-laser-guide"
              />

              <!-- Interactive Points with Custom Tooltips -->
              <g
                v-for="pt in smoothChart.points"
                :key="pt.month"
                class="chart-point-group"
                @mouseenter="activeChartPoint = pt"
                @mouseleave="activeChartPoint = null"
              >
                <!-- Concentric Ripple on Active Point -->
                <circle
                  v-if="activeChartPoint?.month === pt.month"
                  :cx="pt.x"
                  :cy="pt.y"
                  r="11"
                  class="chart-laser-ripple"
                />
                <circle :cx="pt.x" :cy="pt.y" r="4.5" class="chart-point" />
                <circle :cx="pt.x" :cy="pt.y" r="14" class="chart-point-hit" />
                <text :x="pt.x" y="174" text-anchor="middle" class="chart-axis-label mono">{{ pt.month }}</text>
              </g>
            </svg>

            <!-- Precision Telemetry HUD Tooltip -->
            <Transition name="fade">
              <div
                v-if="activeChartPoint"
                class="chart-tooltip"
                :style="{
                  left: `${(activeChartPoint.x / 540) * 100}%`,
                  top: `${(activeChartPoint.y / 180) * 100}%`,
                }"
              >
                <div class="tooltip-header mono">
                  <span>{{ activeChartPoint.month }} {{ t('admin.horizonLabel') }}</span>
                  <span class="tooltip-pct">{{ totalSevenMonthOps > 0 ? `${Math.round((activeChartPoint.value / totalSevenMonthOps) * 100)}%` : '0%' }}</span>
                </div>
                <div class="tooltip-val mono">{{ activeChartPoint.value }} {{ t('admin.opsLogged') }}</div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Territory Distribution Progress (Admin) -->
        <div class="card chart-card">
          <div class="chart-card__head">
            <div>
              <div class="chart-eyebrow mono">
                <span class="material-symbols-outlined text-[14px]">share_location</span>
                <span>{{ t('admin.geographicHierarchy') }}</span>
              </div>
              <h3 class="chart-title">
                <span class="material-symbols-outlined header-icon">public</span>
                {{ t('admin.territoryArchitecture') }}
              </h3>
              <span class="mono chart-card__sub">{{ territoryRatios.citiesPerCountry }} {{ t('admin.ratioCitiesPerCountry') }} · {{ territoryRatios.zonesPerCity }} {{ t('admin.ratioZonesPerCity') }}</span>
            </div>
          </div>

          <div class="lineage-pipeline">
            <div v-for="bar in territoryData" :key="bar.label" class="lineage-row">
              <div class="lineage-meta">
                <div class="lineage-meta__left">
                  <span class="material-symbols-outlined lineage-icon" :style="{ color: bar.color }">{{ bar.icon }}</span>
                  <span class="lineage-label mono">{{ bar.label }}</span>
                  <span class="lineage-desc">{{ bar.desc }}</span>
                </div>
                <div class="lineage-meta__right mono">
                  <strong class="lineage-val">{{ bar.value }}</strong>
                  <span class="lineage-pct">{{ bar.pct }}% {{ t('admin.depthLabel') }}</span>
                </div>
              </div>
              <div class="lineage-track">
                <div class="lineage-fill" :style="{ width: bar.pct + '%', background: bar.color }"></div>
              </div>
            </div>
          </div>

          <div class="chart-foot mono">
            <span class="material-symbols-outlined text-[14px] text-primary">verified_user</span>
            <span>{{ t('admin.zonesDeterministic') }}</span>
          </div>
        </div>

        <!-- Platform Overview Breakdown (Bespoke SVG Segmented Donut Ring - Admin) -->
        <div class="card chart-card">
          <div class="chart-card__head">
            <div>
              <div class="chart-eyebrow mono">
                <span class="material-symbols-outlined text-[14px]">pie_chart</span>
                <span>{{ t('admin.catalogComposition') }}</span>
              </div>
              <h3 class="chart-title">
                <span class="material-symbols-outlined header-icon">donut_small</span>
                {{ t('admin.platformBreakdown') }}
              </h3>
              <span class="mono chart-card__sub">{{ platformTotal.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ t('admin.verifiedRecords') }}</span>
            </div>
          </div>

          <div class="donut-wrap">
            <!-- Bespoke SVG Donut Ring -->
            <div class="donut-svg-box">
              <svg class="donut-svg" viewBox="0 0 130 130">
                <circle cx="65" cy="65" r="50" class="donut-track" />
                <circle
                  v-for="seg in donutSegments"
                  :key="seg.label"
                  cx="65"
                  cy="65"
                  r="50"
                  class="donut-segment"
                  :class="{ 'is-active': activeDonutSegment?.label === seg.label }"
                  :stroke="seg.color"
                  :stroke-dasharray="seg.dashArray"
                  :stroke-dashoffset="seg.dashOffset"
                  @mouseenter="activeDonutSegment = seg"
                  @mouseleave="activeDonutSegment = null"
                />
              </svg>
              <div class="donut-center-hud">
                <span class="donut-hud__label mono">{{ activeDonutSegment ? activeDonutSegment.label : t('admin.totalAssets') }}</span>
                <strong class="donut-hud__val mono">{{ activeDonutSegment ? activeDonutSegment.value.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') : platformTotal.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</strong>
                <span class="donut-hud__sub mono">{{ activeDonutSegment ? `${activeDonutSegment.pct.toFixed(1)}% ${t('admin.ofTotal')}` : t('admin.indexedEntities') }}</span>
              </div>
            </div>

            <!-- Interactive Legend -->
            <div class="donut-legend">
              <router-link
                v-for="seg in platformData"
                :key="seg.label"
                :to="seg.to"
                class="legend-row"
                :class="{ 'is-active': activeDonutSegment?.label === seg.label }"
                @mouseenter="activeDonutSegment = seg"
                @mouseleave="activeDonutSegment = null"
              >
                <span class="legend-dot" :style="{ background: seg.color }"></span>
                <span class="legend-label">{{ seg.label }}</span>
                <span class="legend-val mono">{{ seg.value.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</span>
                <span class="legend-pct mono">{{ seg.pct.toFixed(0) }}%</span>
                <span class="material-symbols-outlined legend-arrow icon--directional" aria-hidden="true">arrow_forward</span>
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Real-Time Audit Activity Trail in Overview (Admin Only - Live API Data) -->
    <section v-if="!isSalesOnly" class="card audit-overview-card">
      <div class="audit-overview-head">
        <div>
          <div class="dash-eyebrow mono">
            <span class="material-symbols-outlined text-[15px]">history</span>
            <span>{{ t('admin.auditTrail') }}</span>
          </div>
          <h2 class="card-title">{{ t('admin.auditLogs') }} · {{ t('admin.liveLedger') }}</h2>
        </div>
      </div>

      <div v-if="!recentAuditLogs.length" class="empty-list-dash">
        <span class="material-symbols-outlined text-[20px] text-muted">history_toggle_off</span>
        <span class="mono text-xs text-muted">{{ t('admin.noAuditActivity') }}</span>
      </div>

      <div v-else class="audit-overview-table-wrap">
        <table class="audit-overview-table">
          <thead>
            <tr>
              <th>{{ t('admin.auditTimestamp') }}</th>
              <th>{{ t('admin.auditAction') }}</th>
              <th>{{ t('admin.auditEntity') }}</th>
              <th>{{ t('admin.auditPerformedBy') }}</th>
              <th>{{ t('admin.userType') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in recentAuditLogs" :key="log.id">
              <td class="mono text-xs text-muted">{{ formatAuditTime(log.createdAt) }}</td>
              <td>
                <span class="badge mono text-xs" :class="actionBadgeClass(log.action)">{{ log.action }}</span>
              </td>
              <td>
                <span class="entity-chip mono text-xs">{{ log.entityName }}</span>
              </td>
              <td>
                <strong class="perf-by__name">{{ getUserInfo(log.performedById || log.performedBy).name }}</strong>
              </td>
              <td>
                <span
                  class="role-badge mono"
                  :class="getRoleBadgeClass(getUserInfo(log.performedById || log.performedBy).roleKey)"
                >
                  {{ getUserInfo(log.performedById || log.performedBy).role }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Bento Quick Actions -->
    <div class="card bento-card">
      <div class="bento-card__head">
        <div>
          <h3>{{ t('admin.quickActions') }}</h3>
          <span class="mono text-xs text-muted">{{ isSalesOnly ? t('admin.salesShortcuts') : t('admin.adminShortcuts') }}</span>
        </div>
      </div>

      <!-- Staff Quick Actions -->
      <div v-if="isSalesOnly" class="quick-actions-grid">
        <button type="button" class="quick-btn" @click="$router.push('/admin/sales')">
          <span class="material-symbols-outlined quick-btn__icon" style="color:var(--wl-warning)">receipt_long</span>
          <div class="quick-btn__text">
            <strong>{{ t('admin.issueQuotation') }}</strong>
            <span>{{ t('admin.salesRfqQueue') }}</span>
          </div>
        </button>

        <button type="button" class="quick-btn" @click="$router.push('/admin/orders')">
          <span class="material-symbols-outlined quick-btn__icon" style="color:var(--wl-primary)">local_shipping</span>
          <div class="quick-btn__text">
            <strong>{{ t('admin.orderFulfillment') }}</strong>
            <span>{{ t('admin.orderFulfillmentSub') }}</span>
          </div>
        </button>

        <button type="button" class="quick-btn" @click="$router.push('/admin/tickets')">
          <span class="material-symbols-outlined quick-btn__icon" style="color:var(--wl-accent)">support_agent</span>
          <div class="quick-btn__text">
            <strong>{{ t('admin.supportTickets') }}</strong>
            <span>{{ t('admin.supportTicketsSub') }}</span>
          </div>
        </button>

        <button type="button" class="quick-btn" @click="$router.push('/marketplace')">
          <span class="material-symbols-outlined quick-btn__icon" style="color:var(--wl-muted)">storefront</span>
          <div class="quick-btn__text">
            <strong>{{ t('admin.storefront') }}</strong>
            <span>{{ t('admin.storefrontSub') }}</span>
          </div>
        </button>
      </div>

      <!-- Admin Quick Actions (product catalogs are provider-owned: no new-product action here; categories stay admin-managed) -->
      <div v-else class="quick-actions-grid">
          <button type="button" class="quick-btn" @click="openCategoryModal">
          <span class="material-symbols-outlined quick-btn__icon">category</span>
          <div class="quick-btn__text">
            <strong>{{ t('admin.newCategory') }}</strong>
            <span>{{ t('admin.quickNewCategorySub') }}</span>
          </div>
        </button>

        <button type="button" class="quick-btn" @click="$router.push('/admin/countries')">
          <span class="material-symbols-outlined quick-btn__icon">public</span>
          <div class="quick-btn__text">
            <strong>+ {{ t('admin.newCountry') }}</strong>
            <span>{{ t('admin.quickNewCountrySub') }}</span>
          </div>
        </button>

        <button type="button" class="quick-btn" @click="$router.push('/admin/cities')">
          <span class="material-symbols-outlined quick-btn__icon">location_city</span>
          <div class="quick-btn__text">
            <strong>+ {{ t('admin.newCity') }}</strong>
            <span>{{ t('admin.distributionHubs') }}</span>
          </div>
        </button>

        <button type="button" class="quick-btn" @click="$router.push('/admin/certifications')">
          <span class="material-symbols-outlined quick-btn__icon">verified</span>
          <div class="quick-btn__text">
            <strong>{{ t('certifications.title') }}</strong>
            <span>ISO / CE / FDA</span>
          </div>
        </button>

<button type="button" class="quick-btn" @click="openContactModal">
          <span class="material-symbols-outlined quick-btn__icon" style="color:var(--wl-teal)">contact_support</span>
          <div class="quick-btn__text">
            <strong>{{ t('admin.supportChannels') }}</strong>
            <span>{{ t('admin.supportChannelsSub') }}</span>
          </div>
        </button>

        <button type="button" class="quick-btn" @click="$router.push('/marketplace')">
          <span class="material-symbols-outlined quick-btn__icon">storefront</span>
          <div class="quick-btn__text">
            <strong>{{ t('admin.storefront') }}</strong>
            <span>{{ t('admin.storefrontSub') }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Support Contact Channels Modal (Admin Only) -->
    <BaseModal
      v-if="!isSalesOnly"
      v-model="showContactModal"
      :title="t('admin.supportChannelsModalTitle')"
      max-width="520px"
    >
      <form class="modal-form-stack" @submit.prevent="handleSaveContact">
        <BaseInput
          v-model="contactForm.supportEmail"
          :label="t('admin.supportEmailLabel')"
          type="email"
          placeholder="support@example.com"
          :required="true"
        />

        <div class="modal-grid-2">
          <BaseInput
            v-model="contactForm.phoneNumber"
            :label="t('admin.callUsPhoneLabel')"
            placeholder="+1 555 000 0000"
            :required="true"
          />
          <BaseInput
            v-model="contactForm.whatsAppNumber"
            :label="t('admin.whatsAppPhoneLabel')"
            placeholder="+15550000000"
            :required="true"
          />
        </div>

        <BaseInput
          v-model="contactForm.workingHours"
          :label="t('admin.workingHoursLabel')"
          :placeholder="t('admin.workingHoursPlaceholder')"
          :required="false"
        />

        <p v-if="contactError" class="modal-error-banner">{{ contactError }}</p>

        <div class="modal-btn-grid">
          <BaseButton type="submit" :loading="contactLoading" variant="primary" block>
            {{ t('common.save') }}
          </BaseButton>
          <BaseButton variant="secondary" block @click="showContactModal = false">
            {{ t('common.cancel') }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Admin quick-add Category (create-only) -->
    <BaseModal
      v-if="!isSalesOnly"
      v-model="showCategoryModal"
      :title="t('admin.newCategory')"
      max-width="640px"
      @close="closeCategoryModal"
    >
      <form class="admin-modal-form" @submit.prevent="submitCategoryModal">
        <div class="form-row two-cols">
          <div class="form-field">
            <label class="field-label" for="dash-category-name-en">{{ t('admin.categoryNameEn') }} *</label>
            <input
              id="dash-category-name-en"
              v-model="categoryForm.nameEn"
              type="text"
              class="field-input"
              required
            />
          </div>
          <div class="form-field">
            <label class="field-label" for="dash-category-name-ar">{{ t('admin.categoryNameAr') }} *</label>
            <input
              id="dash-category-name-ar"
              v-model="categoryForm.nameAr"
              type="text"
              class="field-input"
              required
            />
          </div>
        </div>

        <div class="form-field">
          <label class="field-label" for="dash-category-description">{{ t('admin.description') }}</label>
          <textarea
            id="dash-category-description"
            v-model="categoryForm.description"
            class="field-textarea"
            rows="3"
          ></textarea>
        </div>

        <div class="form-field">
          <FileUpload
            :model-value="categoryForm.imageName || null"
            :place="ATTACHMENT_PLACE.PROVIDERS"
            :file-type="MEDIA_TYPE.IMAGE"
            accept="image/*"
            :label="t('admin.categoryImage')"
            :hint="t('attachment.dropHint')"
            @update:modelValue="categoryForm.imageName = $event ?? ''"
          />
        </div>

        <div class="form-field">
          <label class="field-label" for="dash-category-parent">{{ t('admin.parentCategory') }}</label>
          <select id="dash-category-parent" v-model="categoryForm.parentCategoryId" class="field-select">
            <option value="">{{ t('admin.noParentCategory') }}</option>
            <option v-for="c in parentCategories" :key="c.id" :value="c.id">
              {{ c.nameEn }} · {{ c.nameAr }}
            </option>
          </select>
        </div>

        <p v-if="categoryFormError" class="form-error" role="alert">{{ categoryFormError }}</p>

        <div class="modal-foot">
          <BaseButton variant="secondary" type="button" @click="closeCategoryModal">
            {{ t('common.cancel') }}
          </BaseButton>
          <BaseButton variant="primary" type="submit" :loading="categoryFormLoading">
            {{ t('common.save') }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>
  </AdminLayout>
</template>

<style scoped>
.dash-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--space-5);
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
}

.dash-eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--brand);
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.25rem;
  text-shadow: none;
}

.dash-title {
  font-family: var(--wl-font-display);
  font-size: 1.85rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.05;
  margin: 0;
  background: var(--wl-gradient-gold);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: var(--wl-gold-text-filter);
}

.dash-head__desc {
  color: var(--wl-ink-soft);
  font-size: 0.92rem;
  max-width: 580px;
  line-height: 1.55;
  margin: 0.35rem 0 0;
}

.dash-head__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--fg-muted);
  box-shadow: var(--shadow-xs);
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--wl-success);
  box-shadow: 0 0 0 3px var(--wl-success-soft);
  flex-shrink: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.chart-section {
  margin-bottom: var(--space-6);
}

.chart-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.chart-card--wide {
  grid-column: 1 / -1;
}

.chart-card {
  padding: var(--space-6);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}

.chart-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.chart-eyebrow {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--wl-gold);
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.35rem;
  text-transform: uppercase;
  text-shadow: var(--wl-gold-text-shadow);
}

.chart-title {
  font-family: var(--wl-font-display);
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--wl-gold-text);
  text-shadow: var(--wl-gold-text-shadow);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}

.header-icon {
  font-size: 20px;
  color: var(--wl-primary);
}

.chart-card__sub {
  font-size: 11px;
  color: var(--wl-muted);
  font-weight: 500;
}

/* Precision Telemetry Header Bar */
.chart-telemetry-bar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
  flex-wrap: wrap;
}

.telemetry-item {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.telemetry-label {
  font-size: 9.5px;
  font-weight: 600;
  color: var(--wl-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.telemetry-value {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
}

.telemetry-sep {
  width: 1px;
  height: 24px;
  background: var(--wl-border);
}

.curve-chart-container {
  position: relative;
  width: 100%;
  height: 200px;
}

.curve-chart-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.chart-gridline {
  stroke: rgba(0, 10, 25, 0.06);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.chart-gridline--base {
  stroke-dasharray: none;
  stroke: var(--wl-border);
}

.chart-glow-path {
  filter: blur(4px);
  pointer-events: none;
}

.chart-laser-guide {
  stroke: var(--wl-primary);
  stroke-width: 1.5;
  stroke-dasharray: 3 3;
  opacity: 0.85;
  pointer-events: none;
  animation: laserPulse 1.5s ease-in-out infinite;
}

@keyframes laserPulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.chart-laser-ripple {
  fill: none;
  stroke: var(--wl-primary);
  stroke-width: 1.8;
  opacity: 0.5;
  animation: rippleGrow 1.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  pointer-events: none;
}

@keyframes rippleGrow {
  0% { r: 6; opacity: 0.8; }
  100% { r: 16; opacity: 0; }
}

.chart-axis-label {
  font-size: 10.5px;
  fill: var(--wl-muted);
  font-weight: 500;
}

.chart-point {
  fill: var(--wl-ink-strong);
  stroke: var(--wl-primary);
  stroke-width: 2.5;
  transition: all 0.2s var(--wl-ease-spring);
  filter: drop-shadow(0 0 4px rgba(var(--wl-primary-rgb), 0.4));
}

.chart-point-hit {
  fill: transparent;
  cursor: pointer;
}

.chart-point-group:hover .chart-point {
  r: 6.5;
  stroke: var(--wl-primary);
  stroke-width: 3.5;
}

/* Precision Telemetry HUD Tooltip */
.chart-tooltip {
  position: absolute;
  transform: translate(-50%, -125%);
  background: rgba(0, 10, 25, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--wl-ink-strong);
  padding: 0.55rem 0.85rem;
  border-radius: 10px;
  font-size: 12px;
  pointer-events: none;
  box-shadow: 0 10px 25px -5px rgba(0, 10, 25, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.16);
  white-space: nowrap;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  font-size: 9.5px;
  color: var(--wl-muted-soft);
  letter-spacing: 0.06em;
}

.tooltip-pct {
  color: var(--secondary, #147D92);
  font-weight: 700;
}

.tooltip-val {
  font-weight: 700;
  font-size: 12.5px;
  color: var(--wl-ink-strong);
}

/* Territory Lineage Architecture */
.lineage-pipeline {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.lineage-row {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.lineage-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lineage-meta__left {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.lineage-icon {
  font-size: 18px;
}

.lineage-label {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.lineage-desc {
  font-size: 11px;
  color: var(--wl-muted);
}

.lineage-meta__right {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.lineage-val {
  font-size: 14px;
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.lineage-pct {
  font-size: 11px;
  color: var(--wl-muted);
}

.lineage-track {
  height: 10px;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 9999px;
  overflow: hidden;
  position: relative;
}

.lineage-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 0 8px rgba(105, 169, 255, 0.25);
}

.chart-foot {
  margin-top: 1.25rem;
  font-size: 11.5px;
  color: var(--wl-muted);
  border-top: 1px dashed var(--wl-border);
  padding-top: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Bespoke SVG Donut Architecture */
.donut-wrap {
  display: flex;
  gap: 1.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.donut-svg-box {
  position: relative;
  width: 140px;
  height: 140px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
}

.donut-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
  overflow: visible;
}

.donut-track {
  fill: none;
  stroke: var(--wl-surface-soft);
  stroke-width: 14;
}

.donut-segment {
  fill: none;
  stroke-width: 14;
  cursor: pointer;
  transition: stroke-width 0.2s var(--wl-ease-spring), opacity 0.2s ease, filter 0.2s ease;
}

.donut-segment:hover,
.donut-segment.is-active {
  stroke-width: 18;
  filter: drop-shadow(0 0 6px rgba(105, 169, 255, 0.35));
}

.donut-center-hud {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  pointer-events: none;
  padding: 0.5rem;
}

.donut-hud__label {
  font-size: 9px;
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.donut-hud__val {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  line-height: 1.1;
  margin: 1px 0;
}

.donut-hud__sub {
  font-size: 8.5px;
  font-weight: 600;
  color: var(--wl-primary);
  letter-spacing: 0.06em;
}

.donut-legend {
  flex: 1;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.legend-row {
  display: grid;
  grid-template-columns: 10px 1fr auto 42px 14px;
  gap: 0.65rem;
  align-items: center;
  font-size: 13px;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  border: 1px solid transparent;
  transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.legend-row:hover,
.legend-row.is-active {
  background: var(--wl-surface-soft);
  border-color: var(--wl-border);
  transform: translateX(2px);
}

.legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.1);
}

.legend-label {
  font-weight: 600;
  color: var(--wl-ink-strong);
}

.legend-val {
  font-weight: 700;
  color: var(--wl-ink-strong);
  font-variant-numeric: tabular-nums;
}

.legend-pct {
  text-align: end;
  color: var(--wl-muted);
  font-size: 11.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.legend-arrow {
  font-size: 14px;
  color: var(--wl-muted);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.legend-row:hover .legend-arrow,
.legend-row.is-active .legend-arrow {
  opacity: 1;
  color: var(--wl-primary);
}

.bento-card {
  padding: var(--space-5) var(--space-5);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}
.bento-card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-md); }

.bento-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.bento-card__head h3 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.quick-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.9rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  cursor: pointer;
  text-align: start;
  transition: all 0.15s ease;
}

.quick-btn:hover {
  background: var(--wl-surface-soft);
  border-color: var(--wl-primary-soft);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.quick-btn__icon {
  font-size: 22px;
  color: var(--wl-primary);
  flex-shrink: 0;
}

.quick-btn__text {
  display: flex;
  flex-direction: column;
}

.quick-btn__text strong {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--wl-ink-strong);
}

.quick-btn__text span {
  font-size: 11px;
  color: var(--wl-muted);
}

/* Staff Operational Triage Section */
.sales-operations-section {
  margin-bottom: 1.5rem;
}

.sales-queues-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.sales-queue-card {
  padding: 1.25rem 1.4rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.sales-queue-card:hover {
  border-color: var(--wl-primary-soft);
  box-shadow: var(--shadow-md);
}

.queue-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--wl-border);
}

.queue-card__title-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.queue-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.queue-icon--amber {
  background: rgba(245, 158, 11, 0.12);
  color: var(--wl-warning);
}

.queue-icon--indigo {
  background: rgba(105, 169, 255, 0.12);
  color: var(--wl-primary);
}

.queue-icon--emerald {
  background: var(--wl-success-soft);
  color: var(--wl-success);
}

.queue-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.2;
}

.queue-sub {
  font-size: 11px;
  color: var(--wl-muted);
}

.queue-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 11px;
  font-weight: 600;
  color: var(--wl-primary);
  text-decoration: none;
  transition: opacity 0.15s ease;
  white-space: nowrap;
}

.queue-link:hover {
  opacity: 0.8;
  text-decoration: underline;
}

.priority-chip {
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-weight: 600;
  background: rgba(245, 158, 11, 0.12);
  color: var(--wl-warning);
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.priority-chip--order {
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  border-color: var(--wl-primary-soft);
}

.dash-link {
  font-size: 11px;
  font-weight: 600;
  color: var(--wl-primary);
  text-decoration: none;
}

.dash-link:hover {
  text-decoration: underline;
}

.empty-list-dash {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
}

.dash-mini-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.dash-mini-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--wl-border);
  border-radius: 8px;
  background: var(--wl-surface-soft);
  cursor: pointer;
  transition: all 0.15s ease;
  gap: 0.75rem;
}

.dash-mini-item:hover {
  background: var(--wl-surface);
  border-color: var(--wl-border-strong);
  transform: translateY(-1px);
}

.dash-mini-main {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.dash-mini-id {
  font-size: 12.5px;
  color: var(--wl-ink-strong);
}

.dash-mini-sub {
  font-size: 10.5px;
  color: var(--wl-muted);
}

.dash-mini-action {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

/* Real-Time Audit Overview Card */
.audit-overview-card {
  padding: var(--space-5) var(--space-6);
  margin-bottom: var(--space-6);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}

.audit-overview-card:hover { border-color: var(--border-strong); }

.audit-overview-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.15rem;
  gap: 1rem;
}

.audit-overview-head h2 {
  font-family: var(--wl-font-display);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0.15rem 0 0 0;
}

.audit-overview-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-radius: 8px;
  border: 1px solid var(--wl-line);
}

.audit-overview-table {
  width: 100%;
  min-width: 580px;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.audit-overview-table th {
  padding: 0.65rem 0.9rem;
  background: var(--wl-paper);
  color: var(--wl-muted);
  font-weight: 600;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--wl-line);
  text-align: start;
}

.audit-overview-table td {
  padding: 0.65rem 0.9rem;
  border-bottom: 1px solid var(--wl-line);
  color: var(--wl-ink-strong);
  vertical-align: middle;
}

.audit-overview-table tr:last-child td {
  border-bottom: none;
}

.entity-chip {
  background: var(--wl-paper);
  border: 1px solid var(--wl-line);
  padding: 0.15rem 0.45rem;
  border-radius: var(--wl-radius-technical);
  font-size: 0.72rem;
}

.perf-by__name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--wl-ink-strong);
}

.role-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 0.12rem 0.45rem;
  border-radius: 4px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  display: inline-block;
}

.role-badge--admin {
  background: rgba(105, 169, 255, 0.12);
  color: var(--wl-primary);
  border: 1px solid rgba(105, 169, 255, 0.25);
}

.role-badge--staff {
  background: var(--wl-success-soft);
  color: var(--wl-success);
  border: 1px solid var(--wl-success-soft);
}

.role-badge--org {
  background: rgba(245, 158, 11, 0.12);
  color: var(--wl-warning);
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.role-badge--system {
  background: rgba(100, 116, 139, 0.12);
  color: var(--wl-ink-soft);
  border: 1px solid rgba(100, 116, 139, 0.25);
}

.role-badge--default {
  background: var(--wl-surface-soft);
  color: var(--wl-ink-soft);
  border: 1px solid var(--wl-border);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.badge--teal {
  background: var(--brand-soft, #EDF4FF);
  color: var(--secondary, #147D92);
  border: 1px solid var(--border, #D9E2EC);
}

.badge--slate {
  background: rgba(100, 116, 139, 0.12);
  color: var(--wl-ink-soft);
  border: 1px solid rgba(100, 116, 139, 0.25);
}

.badge--red {
  background: rgba(239, 68, 68, 0.12);
  color: var(--wl-danger);
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.badge--amber {
  background: rgba(245, 158, 11, 0.12);
  color: var(--wl-warning);
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.badge--muted {
  background: var(--wl-surface-soft);
  color: var(--wl-muted);
  border: 1px solid var(--wl-border);
}

@media (max-width: 1100px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 980px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--space-4);
    margin-bottom: var(--space-5);
  }
  .sales-queues-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .quick-actions-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
}

@media (max-width: 768px) {
  .dash-head {
    gap: 0.85rem;
    margin-bottom: 1.25rem;
  }
  .dash-title {
    font-size: clamp(1.4rem, 4.5vw, 1.85rem);
  }
  .chart-telemetry-bar {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.65rem;
  }
  .telemetry-sep {
    display: none;
  }
  .telemetry-item {
    align-items: center;
    text-align: center;
  }
  .donut-wrap {
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1.25rem;
  }
  .donut-svg-box {
    margin: 0 auto;
  }
  .donut-legend {
    width: 100%;
    min-width: 0;
  }
  .chart-card,
  .audit-overview-card,
  .bento-card {
    padding: 1.15rem 1rem;
    margin-bottom: 1.25rem;
  }
}

@media (max-width: 640px) {
  .dash-head {
    flex-direction: column;
    align-items: stretch;
    gap: 0.85rem;
  }
  .dash-head__actions {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .dash-head__actions > * {
    flex: 1 1 100%;
    justify-content: center;
    min-width: 0;
  }
  .status-badge {
    flex: 1 1 100%;
    justify-content: center;
  }
  .curve-chart-container {
    height: 155px;
  }
  .quick-actions-grid {
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }
  .quick-btn {
    padding: 0.75rem 0.85rem;
  }
}

@media (max-width: 480px) {
  .stats-grid,
  .stats-grid--staff {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-3);
  }
  .chart-card,
  .audit-overview-card,
  .bento-card {
    padding: 0.95rem 0.8rem;
    border-radius: var(--radius-md);
  }
  .chart-telemetry-bar {
    grid-template-columns: 1fr;
    gap: 0.4rem;
  }
  .telemetry-item {
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
    padding: 0.25rem 0.4rem;
  }
  .curve-chart-container {
    height: 135px;
  }
  .legend-row {
    grid-template-columns: 8px 1fr auto 36px;
    padding: 0.45rem 0.55rem;
    font-size: 12px;
  }
  .legend-arrow {
    display: none;
  }
  .dash-mini-item {
    padding: 0.65rem 0.6rem;
  }
  .dash-mini-id {
    max-width: 120px;
    font-size: 12px;
  }
}

/* Support Channels Modal Styles */
.modal-form-stack {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.modal-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

@media (max-width: 520px) {
  .modal-grid-2 {
    grid-template-columns: 1fr;
  }
  .modal-btn-grid {
    grid-template-columns: 1fr;
  }
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
}
</style>




