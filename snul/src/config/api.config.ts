const RAW_API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').trim()


export const API_BASE_URL = RAW_API_BASE ? RAW_API_BASE.replace(/\/+$/, '') : ''

const SNUL_GW = 'https://snul-gateway.runasp.net'
const WELCO_GW = 'https://welco-gateway.runasp.net'
export function resolveGateway(target: string | undefined): string {
  if (target === 'welco' || target === 'WELCO') return WELCO_GW
  if (target === 'snul' || target === 'SNUL' || !target) return SNUL_GW
  return ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').trim() || SNUL_GW
}

export const isAbsoluteUrl = (path: string): boolean =>
  /^https?:\/\//i.test(path)

export const APP_ENV = (import.meta.env.VITE_APP_ENV as string) ?? import.meta.env.MODE ?? 'development'
export const IS_DEV = APP_ENV === 'development'
export const IS_TEST = APP_ENV === 'test'
export const IS_PROD = APP_ENV === 'production'

export const API_LANG = {
  ARABIC: 2,
  ENGLISH: 1,
} as const

export const AUTH_ROUTES = {
  base: '/api/v1/auth',
  register: '/api/v1/auth/register',
  login: '/api/v1/auth/login',
  logout: '/api/v1/auth/logout',
  verifyEmailOtp: '/api/v1/auth/verify-register-otp',
  resendRegisterOtp: '/api/v1/auth/resend-register-otp',
  forgotPassword: '/api/v1/auth/forgot-password',
  verifyPasswordOtp: '/api/v1/auth/verify-password-otp',
  resetPassword: '/api/v1/auth/reset-password',
  refreshToken: '/api/v1/auth/refresh-token',
  profile: '/api/v1/auth/profile',
} as const

export const USER_MANAGEMENT_ROUTES = {
  base: '/api/v1/user-management',
  users: '/api/v1/user-management/users',
  userById: (id: string) => `/api/v1/user-management/users/${id}`,
  changePassword: (id: string) => `/api/v1/user-management/users/${id}/change-password`,
  addresses: '/api/v1/user-management/addresses',
  addressesByUser: (userId: string) => `/api/v1/user-management/addresses/user/${userId}`,
  addressById: (id: string) => `/api/v1/user-management/addresses/${id}`,
  countries: '/api/v1/user-management/countries',
  countryById: (id: string) => `/api/v1/user-management/countries/${id}`,
  cities: '/api/v1/user-management/cities',
  citiesByCountry: (countryId: string) => `/api/v1/user-management/cities/country/${countryId}`,
  cityById: (id: string) => `/api/v1/user-management/cities/${id}`,
  zones: '/api/v1/user-management/zones',
  zonesByCity: (cityId: string) => `/api/v1/user-management/zones/city/${cityId}`,
  zoneById: (id: string) => `/api/v1/user-management/zones/${id}`,
} as const

export const MARKETPLACE_ROUTES = {
  base: '/api/v1',
  products: '/api/v1/products',
  myProducts: '/api/v1/products/mine',
  productById: (id: string) => `/api/v1/products/${id}`,
  featured: '/api/v1/products',
  mostSelling: '/api/v1/products/most-selling',
  topSelling: '/api/v1/products/top-selling',
  categories: '/api/v1/categories',
  categoriesAll: '/api/v1/categories/all',
  categoryById: (id: string) => `/api/v1/categories/${id}`,
  categoryProducts: (id: string) => `/api/v1/categories/${id}/products`,
  categoryProviders: (id: string) => `/api/v1/categories/${id}/providers`,
  skuProviders: (sku: string) => `/api/v1/products/by-sku/${encodeURIComponent(sku)}/providers`,
  currencies: '/api/v1/currencies',
  currenciesAll: '/api/v1/currencies/all',
  currencyById: (id: string) => `/api/v1/currencies/${id}`,
} as const

export const EXCHANGE_RATE_ROUTES = {
  base: '/api/v1/exchange-rates',
  latest: '/api/v1/exchange-rates/latest',
  latestByBase: (base: string) => `/api/v1/exchange-rates/latest/${encodeURIComponent(base)}`,
  pair: (from: string, to: string) => `/api/v1/exchange-rates/${encodeURIComponent(from)}/${encodeURIComponent(to)}`,
  convert: '/api/v1/exchange-rates/convert',
  cartTotal: '/api/v1/exchange-rates/cart-total',
} as const

export const WISHLIST_ROUTES = {
  base: '/api/v1/wishlist',
  list: '/api/v1/wishlist',
  add: (productId: string) => `/api/v1/wishlist/${productId}`,
  remove: (productId: string) => `/api/v1/wishlist/${productId}`,
  check: (productId: string) => `/api/v1/wishlist/${productId}/check`,
} as const

export const COMMERCE_ROUTES = {
  base: '/api/v1/commerce',
  carts: '/api/v1/carts',
  cartById: (id: string) => `/api/v1/carts/${id}`,
  cartByUser: (userId: string) => `/api/v1/carts/user/${userId}`,
  cartBySession: (sessionId: string) => `/api/v1/carts/session/${sessionId}`,
  cartItems: (id: string) => `/api/v1/carts/${id}/items`,
  cartItem: (id: string, itemId: string) => `/api/v1/carts/${id}/items/${itemId}`,
  cartClear: (id: string) => `/api/v1/carts/${id}/clear`,
  orders: '/api/v1/orders',
  orderById: (id: string) => `/api/v1/orders/${id}`,
  orderTrack: (orderNumber: string) => `/api/v1/orders/track/${encodeURIComponent(orderNumber)}`,
  orderStatus: (id: string) => `/api/v1/orders/${id}/status`,
} as const

export const SALES_ROUTES = {
  base: '/api/v1/sales',
  rfqs: '/api/v1/rfqs',
  rfqById: (id: string) => `/api/v1/rfqs/${id}`,
  rfqStatus: (id: string) => `/api/v1/rfqs/${id}/status`,
  quotes: '/api/v1/quotes',
  quoteById: (id: string) => `/api/v1/quotes/${id}`,
  quoteApprove: (id: string) => `/api/v1/quotes/${id}/approve`,
  quoteDecline: (id: string) => `/api/v1/quotes/${id}/decline`,
  productInquiries: '/api/v1/product-inquiries',
  productInquiryById: (id: string) => `/api/v1/product-inquiries/${id}`,
} as const

export const CERTIFICATION_ROUTES = {
  base: '/api/v1/certifications',
  certifications: '/api/v1/certifications',
  certificationById: (id: string) => `/api/v1/certifications/${id}`,
} as const

export const CONTENT_ROUTES = {
  base: '/api/v1/content',
  documents: '/api/v1/documents',
  documentById: (id: string) => `/api/v1/documents/${id}`,
  landingPages: '/api/v1/landing-pages',
  landingPageBySlug: (slug: string) => `/api/v1/landing-pages/slug/${slug}`,
  landingPageById: (id: string) => `/api/v1/landing-pages/${id}`,
  helpCategories: '/api/v1/help/categories',
  helpCategoryById: (id: string) => `/api/v1/help/categories/${id}`,
  helpArticles: '/api/v1/help/articles',
  helpArticleById: (id: string) => `/api/v1/help/articles/${id}`,
  helpArticleBySlug: (slug: string) => `/api/v1/help/articles/slug/${slug}`,
  faqs: '/api/v1/help/faqs',
  faqById: (id: string) => `/api/v1/help/faqs/${id}`,
  // Hero telemetry claims. The list endpoint is visible-only on purpose, and the
  // table ships unseeded, so an empty response is a real state and not a fault.
  helpSiteStats: '/api/v1/help/site-stats',
  helpSiteStatById: (id: string) => `/api/v1/help/site-stats/${id}`,
  siteLogo: '/api/v1/content/logo',
} as const

export const SUPPORT_ROUTES = {
  base: '/api/v1/support',
  tickets: '/api/v1/support/tickets',
  myTickets: '/api/v1/support/tickets/my',
  ticketById: (id: string) => `/api/v1/support/tickets/${id}`,
  ticketReply: (id: string) => `/api/v1/support/tickets/${id}/reply`,
  ticketClose: (id: string) => `/api/v1/support/tickets/${id}/close`,
  contact: '/api/v1/support/contact',
} as const

export const COMPANY_ROUTES = {
  base: '/api/v1/user-management',
  companies: '/api/v1/user-management/companies',
  // Public provider directory. The backend forces isActive/isProvider/Approved
  // server-side, so this is safe to call unauthenticated.
  companyDirectory: '/api/v1/user-management/companies/directory',
  companyById: (id: string) => `/api/v1/user-management/companies/${id}`,
  updateMyCompany: '/api/v1/user-management/companies/my',
  companyProducts: (id: string) => `/api/v1/user-management/companies/${id}/products`,
  companyAddresses: (companyId: string) => `/api/v1/user-management/companies/${companyId}/addresses`,
  companyAddressById: (companyId: string, addressId: string) => `/api/v1/user-management/companies/${companyId}/addresses/${addressId}`,
  companyAddressDirect: (addressId: string) => `/api/v1/user-management/company-addresses/${addressId}`,
  distributorApplications: '/api/v1/user-management/distributor-applications',
  distributorApplicationById: (id: string) => `/api/v1/user-management/distributor-applications/${id}`,
  approveDistributorApplication: (id: string) => `/api/v1/user-management/distributor-applications/${id}/approve`,
  rejectDistributorApplication: (id: string) => `/api/v1/user-management/distributor-applications/${id}/reject`,
  oemInquiries: '/api/v1/oem-inquiries',
  oemInquiryById: (id: string) => `/api/v1/oem-inquiries/${id}`,
  auditLogs: '/api/v1/user-management/audit-logs',
  auditLogById: (id: string) => `/api/v1/user-management/audit-logs/${id}`,
} as const

export const ADMIN_ROUTES = {
  base: '/api/v1/user-management',
  auditLogs: '/api/v1/user-management/audit-logs',
  auditLogById: (id: string) => `/api/v1/user-management/audit-logs/${id}`,
} as const

export const ATTACHMENT_ROUTES = {
  base: '/api/v1/attachments',
  upload: '/api/v1/attachments/upload',
  uploadMultiple: '/api/v1/attachments/upload-multiple',
  replace: (name: string) => `/api/v1/attachments/${encodeURIComponent(name)}`,
  delete: (name: string) => `/api/v1/attachments/${encodeURIComponent(name)}`,
  download: '/api/v1/attachments/download',
  files: (name: string) => `/files/${name}`,
} as const

export const ATTACHMENT_PLACE = {
  DEFAULT: 0,
  PROVIDERS: 1,
  USERS: 2,
} as const

export const MEDIA_TYPE = {
  IMAGE: 0,
  VIDEO: 1,
  AUDIO: 2,
  FILE: 3,
} as const

export const toApiLanguage = (locale: string): number =>
  locale === 'ar' ? API_LANG.ARABIC : API_LANG.ENGLISH
