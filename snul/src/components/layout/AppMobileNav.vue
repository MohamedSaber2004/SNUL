<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authService, wishlistService } from '../../di/container'
import { useCart } from '../../composables/useCart'
import { t, locale, setLocale } from '../../i18n'
import { AppLanguage } from '../../domain/models/user'
import { resolveFileUrl, isKnownBrokenUrl, markBrokenUrl } from '../../utils/file-url'

const route = useRoute()
const router = useRouter()

/** Auth pages are full-screen flows — the bottom tab bar would compete with
 *  the form and let a signed-out visitor navigate away mid-registration. */
const isAuthPage = computed(() => {
  const p = (route.path || '').toLowerCase()
  return p.startsWith('/auth') || p.startsWith('/login') || p.startsWith('/register')
})

const toggleLang = async () => {
  const next = locale.value === 'ar' ? 'en' : 'ar'
  setLocale(next)
  if (authService.user.value && authService.user.value.fullName) {
    try {
      await authService.updateProfile({
        fullName: authService.user.value.fullName,
        phoneNumber: authService.user.value.phoneNumber || undefined,
        language: next === 'ar' ? AppLanguage.Ar : AppLanguage.En,
      })
    } catch {}
  }
}

const isAuthed = computed(() => authService.isAuthenticated)
const isAdmin = computed(() => authService.isAdmin.value)
const isSales = computed(() => authService.isSales.value && !isAdmin.value)
const isStaff = computed(() => authService.isAdmin.value || authService.isSales.value)
const isProvider = computed(() => authService.isProvider.value)
const isBuyer = computed(() => authService.isClient.value)
const isSeller = computed(() => isStaff.value)
const user = computed(() => authService.user.value)

const { count: cartCount } = useCart()
const wishlistCount = computed(() => wishlistService.count.value)

const moreOpen = ref(false)

// Close sheet on route navigation
watch(
  () => route.fullPath,
  () => {
    moreOpen.value = false
  },
)

const toggleMore = () => {
  moreOpen.value = !moreOpen.value
}

const closeMore = () => {
  moreOpen.value = false
}

const navigateTo = (path: string) => {
  closeMore()
  void router.push(path)
}

const handleLogout = async () => {
  closeMore()
  await authService.logout()
}

const userRoleLabel = computed(() => {
  if (!user.value) return ''
  if (isAdmin.value) return t('admin.roleAdmin')
  if (isSales.value) return t('admin.roleSales')
  return t(`admin.${authService.resolveBusinessRoleKey()}`)
})

const avatarFailed = ref(false)
const avatarSrc = computed(() => {
  if (avatarFailed.value) return ''
  const name = user.value?.profilePictureName
  if (!name) return ''
  const url = resolveFileUrl(name, '')
  if (!url || isKnownBrokenUrl(url)) return ''
  return url
})

const avatarInitials = computed(() => {
  const n = user.value?.fullName?.trim() ?? user.value?.email ?? '?'
  return n.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?'
})
watch(avatarSrc, () => { avatarFailed.value = false })

// Check if a route is active
const isPathActive = (path: string, exact = false) => {
  if (exact) return route.path === path
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<template>
  <div class="mobile-nav-root">
    <!-- Persistent Bottom Bar -->
    <nav v-if="!isAuthPage" class="mobile-bar" :aria-label="t('nav.navigation')">
      <!-- Admin Mode Tabs -->
      <template v-if="isAdmin">
        <router-link to="/admin" class="bar-tab" :class="{ 'is-active': isPathActive('/admin', true) }">
          <span class="material-symbols-outlined tab-icon">dashboard</span>
          <span class="tab-label">{{ t('admin.dashboard') }}</span>
        </router-link>

        <router-link to="/admin/orders" class="bar-tab" :class="{ 'is-active': isPathActive('/admin/orders') }">
          <span class="material-symbols-outlined tab-icon">local_shipping</span>
          <span class="tab-label">{{ t('admin.orders') }}</span>
        </router-link>

        <router-link to="/admin/users" class="bar-tab" :class="{ 'is-active': isPathActive('/admin/users') }">
          <span class="material-symbols-outlined tab-icon">group</span>
          <span class="tab-label">{{ t('admin.users') }}</span>
        </router-link>

        <router-link to="/marketplace" class="bar-tab" :class="{ 'is-active': isPathActive('/marketplace') }">
          <span class="material-symbols-outlined tab-icon">inventory_2</span>
          <span class="tab-label">{{ t('nav.catalog') }}</span>
        </router-link>
      </template>

      <!-- Sales Mode Tabs -->
      <template v-else-if="isSales">
        <router-link to="/admin" class="bar-tab" :class="{ 'is-active': isPathActive('/admin', true) }">
          <span class="material-symbols-outlined tab-icon">dashboard</span>
          <span class="tab-label">{{ t('admin.dashboard') }}</span>
        </router-link>

        <router-link to="/admin/sales" class="bar-tab" :class="{ 'is-active': isPathActive('/admin/sales') }">
          <span class="material-symbols-outlined tab-icon">request_quote</span>
          <span class="tab-label">{{ t('admin.sales') }}</span>
        </router-link>

        <router-link to="/admin/orders" class="bar-tab" :class="{ 'is-active': isPathActive('/admin/orders') }">
          <span class="material-symbols-outlined tab-icon">local_shipping</span>
          <span class="tab-label">{{ t('admin.orders') }}</span>
        </router-link>

        <router-link to="/admin/tickets" class="bar-tab" :class="{ 'is-active': isPathActive('/admin/tickets') }">
          <span class="material-symbols-outlined tab-icon">support_agent</span>
          <span class="tab-label">{{ t('help.tickets') }}</span>
        </router-link>
      </template>

      <!-- Provider Mode Tabs -->
      <template v-else-if="isProvider && isAuthed">
        <router-link to="/provider/quotes" class="bar-tab" :class="{ 'is-active': isPathActive('/provider/quotes') }">
          <span class="material-symbols-outlined tab-icon">request_quote</span>
          <span class="tab-label">{{ t('provider.quotes') }}</span>
        </router-link>

        <router-link to="/provider/orders" class="bar-tab" :class="{ 'is-active': isPathActive('/provider/orders') }">
          <span class="material-symbols-outlined tab-icon">local_shipping</span>
          <span class="tab-label">{{ t('provider.orders') }}</span>
        </router-link>

        <router-link to="/provider/catalog" class="bar-tab" :class="{ 'is-active': isPathActive('/provider/catalog') }">
          <span class="material-symbols-outlined tab-icon">inventory_2</span>
          <span class="tab-label">{{ t('provider.myCatalog') }}</span>
        </router-link>

        <router-link to="/provider/support" class="bar-tab" :class="{ 'is-active': isPathActive('/provider/support') }">
          <span class="material-symbols-outlined tab-icon">contact_support</span>
          <span class="tab-label">{{ t('provider.support') }}</span>
        </router-link>
      </template>

      <!-- Buyer Mode Tabs -->
      <template v-else-if="isBuyer && isAuthed">
        <router-link to="/" class="bar-tab" :class="{ 'is-active': isPathActive('/', true) }">
          <span class="material-symbols-outlined tab-icon">home</span>
          <span class="tab-label">{{ t('nav.home') }}</span>
        </router-link>

        <router-link to="/marketplace" class="bar-tab" :class="{ 'is-active': isPathActive('/marketplace') }">
          <span class="material-symbols-outlined tab-icon">storefront</span>
          <span class="tab-label">{{ t('nav.marketplace') }}</span>
        </router-link>

        <router-link to="/account" class="bar-tab" :class="{ 'is-active': isPathActive('/account') }">
          <span class="material-symbols-outlined tab-icon">dashboard</span>
          <span class="tab-label">{{ t('nav.account') }}</span>
        </router-link>

        <router-link to="/cart" class="bar-tab" :class="{ 'is-active': isPathActive('/cart') }">
          <div class="tab-icon-wrap">
            <span class="material-symbols-outlined tab-icon">shopping_bag</span>
            <span v-if="cartCount > 0" class="tab-badge">{{ cartCount > 9 ? '9+' : cartCount }}</span>
          </div>
          <span class="tab-label">{{ t('nav.cart') }}</span>
        </router-link>
      </template>

      <!-- Guest Tabs -->
      <template v-else>
        <router-link to="/" class="bar-tab" :class="{ 'is-active': isPathActive('/', true) }">
          <span class="material-symbols-outlined tab-icon">home</span>
          <span class="tab-label">{{ t('nav.home') }}</span>
        </router-link>

        <router-link to="/marketplace" class="bar-tab" :class="{ 'is-active': isPathActive('/marketplace') }">
          <span class="material-symbols-outlined tab-icon">storefront</span>
          <span class="tab-label">{{ t('nav.marketplace') }}</span>
        </router-link>

        <router-link to="/certifications" class="bar-tab" :class="{ 'is-active': isPathActive('/certifications') }">
          <span class="material-symbols-outlined tab-icon">verified</span>
          <span class="tab-label">{{ t('nav.certifications') }}</span>
        </router-link>

        <router-link to="/help" class="bar-tab" :class="{ 'is-active': isPathActive('/help') }">
          <span class="material-symbols-outlined tab-icon">help</span>
          <span class="tab-label">{{ t('nav.help') }}</span>
        </router-link>
      </template>

      <!-- The 5th Action: "All Pages / Menu" Trigger -->
      <button
        type="button"
        class="bar-tab bar-tab--more"
        :class="{ 'is-active': moreOpen }"
        :aria-expanded="moreOpen"
        aria-label="All allowed pages"
        @click="toggleMore"
      >
        <div class="tab-icon-wrap">
          <span class="material-symbols-outlined tab-icon">{{ moreOpen ? 'close' : 'apps' }}</span>
        </div>
        <span class="tab-label">{{ moreOpen ? t('common.cancel') : t('nav.more') }}</span>
      </button>
    </nav>

    <!-- Accessible "All Allowed Pages" Bottom Sheet -->
    <Transition name="sheet-backdrop">
      <div v-if="moreOpen" class="sheet-backdrop" aria-hidden="true" @click="closeMore"></div>
    </Transition>

    <Transition name="sheet-slide">
      <section
        v-if="moreOpen"
        class="sheet-modal"
        role="dialog"
        aria-modal="true"
        aria-label="All Pages"
      >
        <!-- Drag pill indicator -->
        <div class="sheet-drag" aria-hidden="true" @click="closeMore"></div>

        <!-- Sheet Header: User Identity & Profile Quick-Access -->
        <header class="sheet-head">
          <div class="sheet-user">
            <div class="sheet-avatar" :style="{ background: user?.tint || '#0F3D56' }">
              <img v-if="avatarSrc" :src="avatarSrc" :alt="user?.fullName ?? 'User'" class="sheet-avatar-img" @error="avatarFailed = true; markBrokenUrl(avatarSrc)" />
              <span v-else class="sheet-avatar-text">{{ avatarInitials }}</span>
            </div>
            <div class="sheet-user__meta">
              <strong class="sheet-user__name">{{ isAuthed ? user?.fullName : (locale === 'ar' ? 'ممارس زائر' : 'Guest Practitioner') }}</strong>
              <span class="sheet-user__role mono">{{ isAuthed ? userRoleLabel : (locale === 'ar' ? 'مرحباً بك في SNUL' : 'Welcome to SNUL') }}</span>
            </div>
          </div>
          <button type="button" class="sheet-close" aria-label="Close" @click="closeMore">
            <span class="material-symbols-outlined">close</span>
          </button>
        </header>

        <!-- Categorized Nav Grid of All Allowed Pages -->
        <div class="sheet-body">
          <!-- Section: Provider Console (for authenticated providers) -->
          <div v-if="isAuthed && isProvider" class="sheet-section">
            <div class="sheet-section-title mono">{{ t('provider.dashboard').toUpperCase() }}</div>
            <div class="sheet-grid">
              <button type="button" class="sheet-item" @click="navigateTo('/provider/quotes')">
                <span class="sheet-icon-box sheet-icon--amber">
                  <span class="material-symbols-outlined">request_quote</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('provider.quotes') }}</strong>
                  <small>{{ locale === 'ar' ? 'عروض الأسعار والطلبات' : 'Quotes & RFQs' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/provider/orders')">
                <span class="sheet-icon-box sheet-icon--indigo">
                  <span class="material-symbols-outlined">local_shipping</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('provider.orders') }}</strong>
                  <small>{{ locale === 'ar' ? 'تنفيذ وشحن الطلبات' : 'Orders & shipping' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/provider/catalog')">
                <span class="sheet-icon-box sheet-icon--primary">
                  <span class="material-symbols-outlined">inventory_2</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('provider.myCatalog') }}</strong>
                  <small>{{ locale === 'ar' ? 'كتالوج المنتجات والأسعار' : 'Products & inventory' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/provider/categories')">
                <span class="sheet-icon-box sheet-icon--teal">
                  <span class="material-symbols-outlined">category</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('provider.categories') }}</strong>
                  <small>{{ locale === 'ar' ? 'فئات وتصنيفات المنتجات' : 'Product categories' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/provider/support')">
                <span class="sheet-icon-box sheet-icon--slate">
                  <span class="material-symbols-outlined">contact_support</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('provider.support') }}</strong>
                  <small>{{ locale === 'ar' ? 'الدعم والمساعدة' : 'Provider support' }}</small>
                </span>
              </button>
            </div>
          </div>

          <!-- Section: Admin & Staff Management (strictly for authenticated sellers) -->
          <div v-if="isAuthed && isSeller" class="sheet-section">
            <div class="sheet-section-title mono">{{ locale === 'ar' ? 'لوحة التحكم والعمليات' : 'CONSOLE & OPERATIONS' }}</div>
            <div class="sheet-grid">
              <button type="button" class="sheet-item" @click="navigateTo('/admin')">
                <span class="sheet-icon-box sheet-icon--primary">
                  <span class="material-symbols-outlined">dashboard</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('admin.dashboard') }}</strong>
                  <small>{{ locale === 'ar' ? 'نظرة عامة والقياسات' : 'Overview & telemetry' }}</small>
                </span>
              </button>

              <button v-if="isSales" type="button" class="sheet-item" @click="navigateTo('/admin/sales')">
                <span class="sheet-icon-box sheet-icon--amber">
                  <span class="material-symbols-outlined">request_quote</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('admin.sales') }}</strong>
                  <small>{{ locale === 'ar' ? 'مسار عروض الأسعار والطلبات' : 'RFQ & Quote pipeline' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/admin/orders')">
                <span class="sheet-icon-box sheet-icon--indigo">
                  <span class="material-symbols-outlined">local_shipping</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('admin.orders') }}</strong>
                  <small>{{ locale === 'ar' ? 'تنفيذ وشحن الطلبات' : 'Order dispatch' }}</small>
                </span>
              </button>

              <button v-if="isAdmin" type="button" class="sheet-item" @click="navigateTo('/admin/categories')">
                <span class="sheet-icon-box sheet-icon--teal">
                  <span class="material-symbols-outlined">category</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('admin.categoriesTitle') }}</strong>
                  <small>{{ locale === 'ar' ? 'إدارة التصنيفات' : 'Manage categories' }}</small>
                </span>
              </button>

              <button v-if="isAdmin" type="button" class="sheet-item" @click="navigateTo('/admin/companies')">
                <span class="sheet-icon-box sheet-icon--slate">
                  <span class="material-symbols-outlined">apartment</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('admin.companies') }}</strong>
                  <small>{{ locale === 'ar' ? 'دليل الشركات والموزعين' : 'Distributors directory' }}</small>
                </span>
              </button>

              <button v-if="isAdmin" type="button" class="sheet-item" @click="navigateTo('/admin/users')">
                <span class="sheet-icon-box sheet-icon--purple">
                  <span class="material-symbols-outlined">group</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('admin.users') }}</strong>
                  <small>{{ locale === 'ar' ? 'الممارسون وإدارة الوصول' : 'Practitioners & access' }}</small>
                </span>
              </button>

              <button v-if="isAdmin" type="button" class="sheet-item" @click="navigateTo('/admin/countries')">
                <span class="sheet-icon-box sheet-icon--emerald">
                  <span class="material-symbols-outlined">public</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('admin.territory') }}</strong>
                  <small>{{ locale === 'ar' ? 'الدول، المدن، المناطق' : 'Countries, cities, zones' }}</small>
                </span>
              </button>

              <button v-if="isAdmin" type="button" class="sheet-item" @click="navigateTo('/admin/audit-logs')">
                <span class="sheet-icon-box sheet-icon--slate">
                  <span class="material-symbols-outlined">history</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('admin.auditLogs') }}</strong>
                  <small>{{ locale === 'ar' ? 'سجل الأمان والتدقيق' : 'Security ledger' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/admin/tickets')">
                <span class="sheet-icon-box sheet-icon--amber">
                  <span class="material-symbols-outlined">support_agent</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('help.tickets') }}</strong>
                  <small>{{ locale === 'ar' ? 'قائمة الاستفسارات' : 'Inquiries queue' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/admin/help')">
                <span class="sheet-icon-box sheet-icon--teal">
                  <span class="material-symbols-outlined">help</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.help') }}</strong>
                  <small>{{ locale === 'ar' ? 'المقالات والأدلة' : 'Articles & guides' }}</small>
                </span>
              </button>
            </div>
          </div>

          <!-- Section: Institutional Desk (Buyer) -->
          <div v-if="isBuyer && isAuthed" class="sheet-section">
            <div class="sheet-section-title mono">{{ locale === 'ar' ? 'مكتب المؤسسة' : 'ORGANIZATION DESK' }}</div>
            <div class="sheet-grid">
              <button type="button" class="sheet-item" @click="navigateTo('/account')">
                <span class="sheet-icon-box sheet-icon--primary">
                  <span class="material-symbols-outlined">dashboard</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('account.dashboard') }}</strong>
                  <small>{{ locale === 'ar' ? 'نظرة عامة على المشتريات' : 'Procurement overview' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/account/rfqs')">
                <span class="sheet-icon-box sheet-icon--amber">
                  <span class="material-symbols-outlined">request_quote</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('sales.rfqTitle') }}</strong>
                  <small>{{ locale === 'ar' ? 'طلبات الأسعار المرسلة' : 'Active RFQ submissions' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/account/quotes')">
                <span class="sheet-icon-box sheet-icon--teal">
                  <span class="material-symbols-outlined">description</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('sales.quoteTitle') }}</strong>
                  <small>{{ locale === 'ar' ? 'عروض الأسعار المعتمدة' : 'Issued proposals' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/account/orders')">
                <span class="sheet-icon-box sheet-icon--indigo">
                  <span class="material-symbols-outlined">local_shipping</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('commerce.ordersTitle') }}</strong>
                  <small>{{ locale === 'ar' ? 'سجل وحالة الشحنات' : 'Order history & dispatch' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/addresses')">
                <span class="sheet-icon-box sheet-icon--emerald">
                  <span class="material-symbols-outlined">location_on</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.addresses') }}</strong>
                  <small>{{ locale === 'ar' ? 'عناوين التوصيل' : 'Delivery locations' }}</small>
                </span>
              </button>
            </div>
          </div>

          <!-- Section: Commercial & Catalog -->
          <div class="sheet-section">
            <div class="sheet-section-title mono">{{ locale === 'ar' ? 'السوق والكتالوج' : 'MARKETPLACE & CATALOG' }}</div>
            <div class="sheet-grid">
              <button type="button" class="sheet-item" @click="navigateTo('/')">
                <span class="sheet-icon-box sheet-icon--primary">
                  <span class="material-symbols-outlined">home</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.home') }}</strong>
                  <small>{{ locale === 'ar' ? 'الواجهة الرئيسية' : 'Main storefront' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/marketplace')">
                <span class="sheet-icon-box sheet-icon--teal">
                  <span class="material-symbols-outlined">storefront</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.marketplace') }}</strong>
                  <small>{{ locale === 'ar' ? 'كتالوج الأدوات الكامل' : 'Full instrument catalog' }}</small>
                </span>
              </button>

              <button v-if="!isStaff && !isProvider" type="button" class="sheet-item" @click="navigateTo('/cart')">
                <span class="sheet-icon-box sheet-icon--amber">
                  <span class="material-symbols-outlined">shopping_bag</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.cart') }}</strong>
                  <small v-if="cartCount > 0">{{ locale === 'ar' ? `${cartCount} أداة في السلة` : `${cartCount} item(s) in quote` }}</small>
                  <small v-else>{{ locale === 'ar' ? 'سلة عروض الأسعار' : 'Active quote basket' }}</small>
                </span>
              </button>

              <button v-if="!isStaff && !isProvider && isAuthed" type="button" class="sheet-item" @click="navigateTo('/wishlist')">
                <span class="sheet-icon-box sheet-icon--rose">
                  <span class="material-symbols-outlined">favorite</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.wishlist') }}</strong>
                  <small>{{ locale === 'ar' ? `${wishlistCount} أداة محفوظة` : `${wishlistCount} saved instruments` }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/most-selling')">
                <span class="sheet-icon-box sheet-icon--rose">
                  <span class="material-symbols-outlined">trending_up</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('mostSellingPage.title') }}</strong>
                  <small>{{ locale === 'ar' ? 'الأكثر طلباً ومبيعاً' : 'Highest demand instruments' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/categories')">
                <span class="sheet-icon-box sheet-icon--teal">
                  <span class="material-symbols-outlined">category</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.categories') }}</strong>
                  <small>{{ locale === 'ar' ? 'تصفح التخصصات الجراحية' : 'Surgical specialties' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/certifications')">
                <span class="sheet-icon-box sheet-icon--emerald">
                  <span class="material-symbols-outlined">verified</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.certifications') }}</strong>
                  <small>{{ locale === 'ar' ? 'مطابقة ISO و CE' : 'ISO & CE compliance' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/about')">
                <span class="sheet-icon-box sheet-icon--primary">
                  <span class="material-symbols-outlined">info</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.about') }}</strong>
                  <small>{{ locale === 'ar' ? 'تراثنا وقصة التصنيع الجراحي' : 'Heritage & manufacturing story' }}</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/track-order')">
                <span class="sheet-icon-box sheet-icon--slate">
                  <span class="material-symbols-outlined">local_shipping</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.trackOrder') }}</strong>
                  <small>{{ locale === 'ar' ? 'تتبع الشحنات المباشر' : 'Live consignment status' }}</small>
                </span>
              </button>
            </div>
          </div>

          <!-- Section: Support & Help -->
          <div class="sheet-section">
            <div class="sheet-section-title mono">{{ locale === 'ar' ? 'الدعم والمساعدة الطبية' : 'SUPPORT & CLINICAL HELP' }}</div>
            <div class="sheet-grid">
              <button type="button" class="sheet-item" @click="navigateTo('/help')">
                <span class="sheet-icon-box sheet-icon--teal">
                  <span class="material-symbols-outlined">help</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.help') }}</strong>
                  <small>{{ locale === 'ar' ? 'الأدلة والتوثيق' : 'Guides & documentation' }}</small>
                </span>
              </button>

              <button v-if="isAuthed && !isSeller" type="button" class="sheet-item" @click="navigateTo('/help/my-tickets')">
                <span class="sheet-icon-box sheet-icon--amber">
                  <span class="material-symbols-outlined">confirmation_number</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('help.myTickets') }}</strong>
                  <small>{{ locale === 'ar' ? 'متابعة استفسارات الدعم' : 'Track support inquiries' }}</small>
                </span>
              </button>

              <button v-if="isAdmin && isAuthed" type="button" class="sheet-item" @click="navigateTo('/locations')">
                <span class="sheet-icon-box sheet-icon--slate">
                  <span class="material-symbols-outlined">public</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ locale === 'ar' ? 'التغطية الجغرافية' : 'Territory Coverage' }}</strong>
                  <small>{{ locale === 'ar' ? 'اللوجستيات الطبية الإقليمية' : 'Global clinical logistics' }}</small>
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Sheet Footer: Profile, Settings, Logout -->
        <footer class="sheet-foot">
          <template v-if="isAuthed">
            <button type="button" class="sheet-foot-btn" @click="navigateTo('/profile')">
              <span class="material-symbols-outlined text-[18px]">manage_accounts</span>
              <span>{{ t('nav.profile') }}</span>
            </button>
            <button type="button" class="sheet-foot-btn" :aria-label="locale === 'ar' ? 'English' : 'العربية'" :title="locale === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'" @click="toggleLang">
              <span class="material-symbols-outlined text-[18px]">language</span>
            </button>
            <button type="button" class="sheet-foot-btn sheet-foot-btn--danger" @click="handleLogout">
              <span class="material-symbols-outlined text-[18px]">logout</span>
              <span>{{ t('nav.logout') }}</span>
            </button>
          </template>
          <template v-else>
            <button type="button" class="sheet-foot-btn sheet-foot-btn--primary" @click="navigateTo('/auth/login')">
              <span class="material-symbols-outlined text-[18px]">login</span>
              <span>{{ t('nav.login') }}</span>
            </button>
            <button type="button" class="sheet-foot-btn" @click="navigateTo('/auth/register')">
              <span class="material-symbols-outlined text-[18px]">person_add</span>
              <span>{{ t('nav.register') }}</span>
            </button>
            <button type="button" class="sheet-foot-btn" :aria-label="locale === 'ar' ? 'English' : 'العربية'" :title="locale === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'" @click="toggleLang">
              <span class="material-symbols-outlined text-[18px]">language</span>
            </button>
          </template>
        </footer>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.mobile-nav-root {
  display: contents;
}

/* Hidden on desktop and tablet (> 768px) */
.mobile-bar {
  display: none;
}

@media (max-width: 768px) {
  .mobile-bar {
    display: flex;
    align-items: center;
    justify-content: space-around;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: var(--wl-surface);
    backdrop-filter: blur(18px) saturate(1.2);
    -webkit-backdrop-filter: blur(18px) saturate(1.2);
    border-top: 1px solid var(--wl-border);
    box-shadow: 0 -4px 16px rgba(0, 10, 25, 0.05);
    z-index: 100;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    box-sizing: content-box;
  }

  .mobile-bar::before {
    content: '';
    position: absolute;
    top: 0;
    inset-inline: 0;
    height: 1px;
    background: var(--border);
    pointer-events: none;
  }

  .bar-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    flex: 1;
    height: 100%;
    min-width: 0;
    padding: 0.35rem 0.2rem;
    color: var(--wl-ink-soft);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--wl-font-body);
    transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    -webkit-tap-highlight-color: transparent;
  }

  .bar-tab:active {
    transform: scale(0.92);
  }

  .bar-tab.is-active {
    color: var(--wl-primary);
  }

  .bar-tab.is-active .tab-icon {
    transform: translateY(-1px);
  }

  .tab-icon-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .tab-icon {
    font-size: 22px;
    line-height: 1;
    transition: transform 0.15s ease;
  }

  .tab-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 78px;
    line-height: 1.15;
    padding: 0 2px;
  }

  .tab-badge {
    position: absolute;
    top: -5px;
    inset-inline-end: -8px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
  background: var(--wl-danger);
  color: var(--wl-on-primary);
    font-size: 9px;
    font-weight: 700;
    border-radius: 999px;
    display: grid;
    place-items: center;
    border: 2px solid var(--wl-surface);
  }

  .bar-tab--more {
    color: var(--wl-ink-strong);
  }

  .bar-tab--more.is-active {
    color: var(--wl-primary);
  }
}

/* Bottom Sheet Modal */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 10, 25, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 150;
}

.sheet-modal {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 85dvh;
  background: var(--wl-surface);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  box-shadow: 0 -10px 40px rgba(0, 10, 25, 0.25);
  border-top: 1px solid var(--wl-border);
  z-index: 160;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
}

.sheet-drag {
  width: 36px;
  height: 4px;
  background: var(--wl-border);
  border-radius: 999px;
  margin: 10px auto 4px;
  cursor: pointer;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--wl-border);
  background: var(--wl-surface-soft);
}

.sheet-user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.sheet-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--wl-ink-strong);
  font-weight: 700;
  font-size: 12px;
  overflow: hidden;
  flex-shrink: 0;
}

.sheet-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sheet-user__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.2;
}

.sheet-user__name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-user__role {
  font-size: 10px;
  color: var(--wl-muted);
}

.sheet-close {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  color: var(--wl-ink-soft);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.sheet-close:active {
  transform: scale(0.92);
}

.sheet-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sheet-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sheet-section-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--wl-muted);
  padding: 0 0.25rem;
}

.sheet-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.55rem;
}

@media (max-width: 440px) {
  .sheet-grid {
    grid-template-columns: 1fr;
    gap: 0.45rem;
  }
}

.sheet-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.8rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  text-align: start;
  cursor: pointer;
  color: inherit;
  font-family: var(--wl-font-body);
  transition: all 0.12s ease;
  min-height: 52px;
}

.sheet-item:hover,
.sheet-item:active {
  background: var(--wl-surface);
  border-color: var(--wl-primary);
  transform: translateY(-1px);
}

.sheet-icon-box {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-size: 17px;
  flex-shrink: 0;
}

.sheet-icon-box .material-symbols-outlined {
  font-size: 18px;
}

.sheet-icon--primary { background: var(--wl-primary-soft); color: var(--wl-primary); }
.sheet-icon--amber   { background: var(--wl-warning-soft); color: var(--wl-warning); }
.sheet-icon--indigo  { background: var(--wl-primary-soft); color: var(--wl-primary); }
.sheet-icon--teal    { background: var(--wl-accent-soft); color: var(--wl-accent); }
.sheet-icon--emerald { background: var(--wl-success-soft); color: var(--wl-success); }
.sheet-icon--purple  { background: var(--wl-primary-soft); color: var(--wl-primary); }
.sheet-icon--rose    { background: var(--wl-danger-soft); color: var(--wl-danger); }
.sheet-icon--slate   { background: var(--wl-surface-soft); color: var(--wl-muted); }

.sheet-item__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}

.sheet-item__text strong {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-item__text small {
  font-size: 10.5px;
  color: var(--wl-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding: 0.85rem 1.15rem;
  border-top: 1px solid var(--wl-border);
  background: var(--wl-surface-soft);
}

.sheet-foot-btn {
  flex: 1;
  min-width: calc(50% - 0.3rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  color: var(--wl-ink-strong);
  transition: all 0.12s ease;
  min-height: 42px;
}

.sheet-foot-btn:active {
  transform: scale(0.96);
}

.sheet-foot-btn--primary {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border-color: var(--wl-primary);
}

.sheet-foot-btn--danger {
  color: var(--wl-danger);
}

/* Transitions */
.sheet-backdrop-enter-active,
.sheet-backdrop-leave-active {
  transition: opacity 0.2s ease;
}

.sheet-backdrop-enter-from,
.sheet-backdrop-leave-to {
  opacity: 0;
}

.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
}
</style>
