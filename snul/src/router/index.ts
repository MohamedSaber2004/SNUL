import { createRouter, createWebHistory } from 'vue-router'
import { t, type MessageKey } from '../i18n'
import { services } from '../di/container'
import { isPendingOrg } from '../utils/pending-org-marker'
import { toastService } from '../infrastructure/feedback/toast.service'
import { routeLoading } from '../application/route-loading'

declare module 'vue-router' {
  interface RouteMeta {
    titleKey?: MessageKey
    requiresAuth?: boolean
    guestOnly?: boolean
    requiresAdmin?: boolean
    requiresProvider?: boolean
    isLandingPage?: boolean
    hideFooter?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { titleKey: 'nav.home', isLandingPage: true },
    },
    {
      path: '/auth/login',
      name: 'login',
      component: () => import('../views/auth/LoginView.vue'),
      meta: { titleKey: 'auth.loginTitle', guestOnly: true },
    },
    {
      path: '/auth/register',
      name: 'register',
      component: () => import('../views/auth/RegisterView.vue'),
      meta: { titleKey: 'auth.registerTitle', guestOnly: true },
    },
    {
      path: '/auth/verify-email',
      name: 'verify-email',
      component: () => import('../views/auth/VerifyEmailView.vue'),
      meta: { titleKey: 'auth.verifyTitle', guestOnly: true },
    },
    {
      path: '/auth/forgot-password',
      name: 'forgot-password',
      component: () => import('../views/auth/ForgotPasswordView.vue'),
      meta: { titleKey: 'auth.forgotTitle', guestOnly: true },
    },
    {
      path: '/auth/verify-password-otp',
      name: 'verify-password-otp',
      component: () => import('../views/auth/VerifyPasswordOtpView.vue'),
      meta: { titleKey: 'auth.verifyTitle', guestOnly: true },
    },
    {
      path: '/auth/reset-password',
      name: 'reset-password',
      component: () => import('../views/auth/ResetPasswordView.vue'),
      meta: { titleKey: 'auth.resetTitle', guestOnly: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { titleKey: 'nav.profile', requiresAuth: true },
    },
    {
      path: '/addresses',
      name: 'addresses',
      component: () => import('../views/AddressesView.vue'),
      meta: { titleKey: 'nav.addresses', requiresAuth: true },
    },
    {
      path: '/locations',
      name: 'locations',
      component: () => import('../views/LocationsView.vue'),
      meta: { titleKey: 'nav.locations', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/catalog',
      redirect: '/marketplace',
    },
    {
      path: '/categories',
      name: 'categories',
      component: () => import('../views/catalog/CategoriesView.vue'),
      meta: { titleKey: 'marketplace.categoriesTitle' },
    },
    {
      path: '/categories/:id/providers',
      name: 'category-providers',
      component: () => import('../views/catalog/CategoryProvidersView.vue'),
      meta: { titleKey: 'provider.categoryProviders' },
    },
    {
      path: '/marketplace',
      name: 'marketplace',
      component: () => import('../views/marketplace/CatalogView.vue'),
      meta: { titleKey: 'marketplace.title' },
    },
    {
      path: '/most-selling',
      name: 'most-selling-products',
      component: () => import('../views/catalog/MostSellingProductsView.vue'),
      meta: { titleKey: 'mostSellingPage.title' },
    },
    {
      path: '/marketplace/product/:id',
      name: 'marketplace-product',
      component: () => import('../views/marketplace/ProductDetailView.vue'),
      meta: { titleKey: 'marketplace.title' },
    },
    {
      path: '/wishlist',
      name: 'wishlist',
      component: () => import('../views/marketplace/WishlistView.vue'),
      meta: { titleKey: 'marketplace.wishlistTitle', requiresAuth: true },
    },
    {
      path: '/cart',
      name: 'cart',
      component: () => import('../views/marketplace/CartView.vue'),
      meta: { titleKey: 'nav.cart' },
    },
    {
      path: '/checkout',
      name: 'checkout',
      component: () => import('../views/marketplace/CheckoutView.vue'),
      meta: { titleKey: 'nav.checkout', requiresAuth: true },
    },
    {
      path: '/checkout/confirmation/:orderNumber',
      name: 'order-confirmation',
      component: () => import('../views/marketplace/OrderConfirmationView.vue'),
      meta: { titleKey: 'commerce.orderConfirmationTitle', requiresAuth: true },
    },
    {
      path: '/track-order',
      name: 'order-tracking',
      component: () => import('../views/marketplace/OrderTrackingView.vue'),
      meta: { titleKey: 'commerce.trackingTitle', requiresAuth: true },
    },
    {
      path: '/account',
      name: 'account',
      component: () => import('../views/account/AccountDashboardView.vue'),
      meta: { titleKey: 'account.dashboard', requiresAuth: true },
    },
    {
      path: '/account/rfqs',
      name: 'account-rfqs',
      component: () => import('../views/account/RfqListView.vue'),
      meta: { titleKey: 'sales.rfqTitle', requiresAuth: true },
    },
    {
      path: '/account/rfqs/:id',
      name: 'account-rfq-detail',
      component: () => import('../views/account/RfqDetailView.vue'),
      meta: { titleKey: 'sales.rfqDetail', requiresAuth: true },
    },
    {
      path: '/account/quotes/:id',
      name: 'account-quote-detail',
      component: () => import('../views/account/QuoteDetailView.vue'),
      meta: { titleKey: 'sales.quoteDetail', requiresAuth: true },
    },
    {
      path: '/account/quotes',
      name: 'account-quotes',
      component: () => import('../views/account/QuoteListView.vue'),
      meta: { titleKey: 'sales.quoteTitle', requiresAuth: true },
    },
    {
      path: '/account/orders',
      name: 'account-orders',
      component: () => import('../views/account/OrderHistoryView.vue'),
      meta: { titleKey: 'commerce.ordersTitle', requiresAuth: true },
    },
    {
      path: '/account/orders/:id',
      name: 'account-order-detail',
      component: () => import('../views/account/OrderDetailView.vue'),
      meta: { titleKey: 'commerce.orderDetailTitle', requiresAuth: true },
    },
    {
      path: '/oem',
      name: 'oem',
      component: () => import('../views/trade/OemView.vue'),
      meta: { titleKey: 'nav.oem', isLandingPage: true },
    },
    {
      path: '/providers',
      name: 'providers',
      component: () => import('../views/trade/ProvidersView.vue'),
      meta: { titleKey: 'nav.providers', isLandingPage: true },
    },
    {
      path: '/providers/:id',
      name: 'provider-storefront',
      component: () => import('../views/trade/ProviderStorefrontView.vue'),
      meta: { titleKey: 'provider.storefront' },
    },
    {
      path: '/certifications',
      name: 'certifications',
      component: () => import('../views/quality/CertificationsView.vue'),
      meta: { titleKey: 'nav.certifications', isLandingPage: true },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
      meta: { titleKey: 'nav.about', isLandingPage: true },
    },
    {
      path: '/help',
      name: 'help',
      component: () => import('../views/support/HelpCenterView.vue'),
      meta: { titleKey: 'nav.help' },
    },
    {
      path: '/help/my-tickets',
      name: 'help-my-tickets',
      component: () => import('../views/support/MyTicketsView.vue'),
      meta: { titleKey: 'nav.help', requiresAuth: true, hideFooter: true },
    },
    {
      path: '/catalog/:slug',
      name: 'landing-page',
      component: () => import('../views/catalog/LandingPageView.vue'),
      meta: { titleKey: 'catalog.title', isLandingPage: true },
    },
    {
      path: '/admin',
      name: 'admin-dashboard',
      component: () => import('../views/admin/AdminDashboardView.vue'),
      meta: { titleKey: 'admin.dashboard', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/sales',
      name: 'admin-sales',
      component: () => import('../views/admin/SalesAdminView.vue'),
      meta: { titleKey: 'admin.sales', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/orders',
      name: 'admin-orders',
      component: () => import('../views/admin/OrdersAdminView.vue'),
      meta: { titleKey: 'admin.orders', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/companies',
      name: 'admin-companies',
      component: () => import('../views/admin/CompaniesAdminView.vue'),
      meta: { titleKey: 'admin.companies', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/countries',
      name: 'admin-countries',
      component: () => import('../views/admin/CountriesAdminView.vue'),
      meta: { titleKey: 'admin.countries', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/cities',
      name: 'admin-cities',
      component: () => import('../views/admin/CitiesAdminView.vue'),
      meta: { titleKey: 'admin.cities', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/zones',
      name: 'admin-zones',
      component: () => import('../views/admin/ZonesAdminView.vue'),
      meta: { titleKey: 'admin.zones', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('../views/admin/UsersAdminView.vue'),
      meta: { titleKey: 'admin.users', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/products',
      redirect: '/admin',
    },
    {
      path: '/admin/categories',
      name: 'admin-categories',
      component: () => import('../views/admin/CategoriesAdminView.vue'),
      meta: { titleKey: 'admin.categoriesTitle', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/catalog',
      redirect: '/admin',
    },
    {
      path: '/provider',
      redirect: '/provider/quotes',
    },
    {
      path: '/provider/dashboard',
      redirect: '/provider/quotes',
    },
    {
      path: '/provider/quotes',
      name: 'provider-quotes',
      component: () => import('../views/provider/ProviderQuotesView.vue'),
      meta: { titleKey: 'provider.quotes', requiresAuth: true, requiresProvider: true },
    },
    {
      path: '/provider/orders',
      name: 'provider-orders',
      component: () => import('../views/provider/ProviderOrdersView.vue'),
      meta: { titleKey: 'provider.orders', requiresAuth: true, requiresProvider: true },
    },
    {
      path: '/provider/catalog',
      name: 'provider-catalog',
      component: () => import('../views/provider/ProviderCatalogView.vue'),
      meta: { titleKey: 'provider.myCatalog', requiresAuth: true, requiresProvider: true },
    },
    {
      path: '/provider/categories',
      name: 'provider-categories',
      component: () => import('../views/provider/ProviderCategoriesView.vue'),
      meta: { titleKey: 'provider.categories', requiresAuth: true, requiresProvider: true },
    },
    {
      path: '/provider/support',
      name: 'provider-support',
      component: () => import('../views/provider/ProviderSupportView.vue'),
      meta: { titleKey: 'provider.support', requiresAuth: true, requiresProvider: true },
    },
    {
      path: '/admin/certifications',
      name: 'admin-certifications',
      component: () => import('../views/admin/CertificationsAdminView.vue'),
      meta: { titleKey: 'certifications.title', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/about',
      name: 'admin-about',
      component: () => import('../views/admin/AboutAdminView.vue'),
      meta: { titleKey: 'nav.about', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/hero',
      name: 'admin-hero',
      component: () => import('../views/admin/HeroAdminView.vue'),
      meta: { titleKey: 'admin.heroContent', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/logo',
      name: 'admin-logo',
      component: () => import('../views/admin/LogoAdminView.vue'),
      meta: { titleKey: 'admin.siteLogo', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/pages',
      redirect: '/admin/about',
    },
    {
      path: '/admin/help',
      name: 'admin-help',
      component: () => import('../views/admin/HelpAdminView.vue'),
      meta: { titleKey: 'nav.help', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/tickets',
      name: 'admin-tickets',
      component: () => import('../views/admin/TicketsAdminView.vue'),
      meta: { titleKey: 'nav.help', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/audit-logs',
      name: 'admin-audit-logs',
      component: () => import('../views/admin/AuditLogAdminView.vue'),
      meta: { titleKey: 'admin.auditLogs', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/documents',
      redirect: '/admin/certifications?tab=documents',
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to) => {
  routeLoading.value = true
  const auth = services.authService
  let isAuthenticated = auth.isAuthenticated

  if (to.meta.requiresAuth && isAuthenticated) {
    await auth.ensureValidSession()
    isAuthenticated = auth.isAuthenticated
  }

  const isStaff = auth.isAdmin.value || auth.isSales.value
  const isProvider = auth.isProvider.value
  const isClient = auth.isClient.value

  if (isAuthenticated && isStaff && (to.name === 'home' || to.path === '/')) {
    return { name: 'admin-dashboard' }
  }
  if (isAuthenticated && isProvider && (to.name === 'home' || to.path === '/')) {
    return { name: 'provider-quotes' }
  }
  if (isAuthenticated && isStaff && (to.path.startsWith('/account') || to.name === 'help-my-tickets')) {
    return { name: 'admin-dashboard' }
  }
  if (isAuthenticated && isProvider && to.path.startsWith('/account')) {
    return { name: 'provider-quotes' }
  }
  // Staff and Providers don't use buyer cart / checkout / wishlist
  const buyerCommercePaths = ['/cart', '/checkout', '/wishlist']
  if (isAuthenticated && (isStaff || isProvider) && buyerCommercePaths.some((p) => to.path === p || to.path.startsWith(p + '/'))) {
    return isStaff ? { name: 'admin-dashboard' } : { name: 'provider-quotes' }
  }
  // Sales don't see provider catalog
  if (isAuthenticated && auth.isSales.value && to.path.startsWith('/provider')) {
    return { name: 'admin-dashboard' }
  }
  if (isAuthenticated && !isStaff && to.path.startsWith('/admin')) {
    return { name: 'home' }
  }
  if (isAuthenticated && isClient && !isProvider && to.path.startsWith('/provider')) {
    return { name: 'account' }
  }
  if (isAuthenticated && auth.isOrganizationUser.value) {
    const user = auth.user.value
    const hasCompany = !!(user?.companyId || user?.company?.id)
    const buyerGuarded = to.path.startsWith('/account') || to.path === '/cart' || to.path === '/checkout' || to.path === '/wishlist'
    if (!hasCompany && buyerGuarded && isPendingOrg(user?.email)) {
      await auth.loadProfile().catch(() => null)
      if (auth.user.value?.companyId) return true
      toastService.info(t('distributor.pendingApproval'))
      return { name: 'home' }
    }
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.requiresProvider && !isProvider && !auth.isAdmin.value) {
    return { name: 'home' }
  }
  if (to.meta.guestOnly && isAuthenticated) {
    return { name: auth.getDashboardRouteName() }
  }
  if (to.meta.requiresAdmin) {
    if (!isStaff) return { name: 'home' }
    // Sales page is staff/sales exclusive — admin has no access
    if (to.path.startsWith('/admin/sales') && auth.isAdmin.value) {
      return { name: 'admin-dashboard' }
    }
    const adminOnly = [
      '/admin/users',
      '/admin/companies',
      '/admin/countries',
      '/admin/cities',
      '/admin/zones',
      '/admin/audit-logs',
      '/admin/certifications',
      '/admin/documents',
      '/admin/hero',
      '/admin/logo',
    ]
    const isAdminOnlyPath = adminOnly.some((p) => to.path.startsWith(p))
    if (isAdminOnlyPath && !auth.isAdmin.value) return { name: 'admin-dashboard' }
  }
})

router.afterEach((to) => {
  routeLoading.value = false
  const key = to.meta.titleKey
  if (key) {
    document.title = `${t(key)} · SNUL`
  } else {
    document.title = 'SNUL'
  }

  const text = key ? t(key) : document.title
  let announcer = document.querySelector('.visually-hidden[aria-live="polite"]') as HTMLElement | null
  if (!announcer) {
    announcer = document.createElement('div')
    announcer.className = 'visually-hidden'
    announcer.setAttribute('aria-live', 'polite')
    announcer.setAttribute('aria-atomic', 'true')
    document.body.appendChild(announcer)
  }
  announcer.textContent = ''
  setTimeout(() => {
    if (announcer) announcer.textContent = text
  }, 100)
})

router.onError(() => {
  routeLoading.value = false
})

export default router
