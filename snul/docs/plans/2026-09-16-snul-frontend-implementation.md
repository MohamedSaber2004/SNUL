# SNUL Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete SNUL frontend that mirrors Welco's Clean Architecture (Vue 3 + Composition API + DI Container + Vue Router + i18n) while adapting for SNUL's Egyptian B2B medical device distribution platform with M2M integration to Welco master data.

**Architecture:** Clean/Onion Architecture with 6 layers: Presentation (Vue components/views), Application (services/composables), Domain (models/ports), Infrastructure (HttpClient/TokenStore/Repositories), Config (API endpoints), Utils. M2M integration to Welco gateway for catalog/inventory/certifications. Local SNUL database for orders, accounts, distributor apps.

**Tech Stack:** Vue 3.5, Vite 8, Vue Router 4, Tailwind CSS, TypeScript 6, Native fetch via custom HttpClient, Material Symbols icons, custom DI container, custom i18n (ar/en), CSS variables for theming.

---

## File Structure Map

```
src/
├── config/
│   ├── api.config.ts          # API base URLs, routes, env config
│   └── app.config.ts          # Feature flags, constants
├── data/
│   └── repositories/
│       ├── api-auth.repository.ts
│       ├── api-marketplace.repository.ts
│       ├── api-commerce.repository.ts
│       ├── api-sales.repository.ts
│       ├── api-content.repository.ts
│       ├── api-certification.repository.ts
│       ├── api-company.repository.ts
│       ├── api-location.repository.ts
│       ├── api-address.repository.ts
│       ├── api-distributor.repository.ts
│       ├── api-integration.repository.ts   # M2M to Welco
│       └── index.ts             # Barrel exports
├── di/
│   └── container.ts             # Service container registration
├── domain/
│   ├── models/
│   │   ├── auth.ts
│   │   ├── marketplace.ts       # Product, Category (M2M from Welco)
│   │   ├── commerce.ts          # Cart, Order, CartItem
│   │   ├── sales.ts             # RFQ, Quote, QuoteItem
│   │   ├── content.ts           # HelpArticle, FAQ, SupportTicket
│   │   ├── certification.ts     # Certification (M2M from Welco)
│   │   ├── company.ts           # Company, DistributorApplication
│   │   ├── location.ts          # Country, City, Zone, Address
│   │   └── index.ts
│   └── ports/
│       ├── auth.port.ts
│       ├── marketplace.port.ts
│       ├── commerce.port.ts
│       ├── sales.port.ts
│       ├── content.port.ts
│       ├── certification.port.ts
│       ├── company.port.ts
│       ├── location.port.ts
│       └── integration.port.ts
├── application/
│   ├── auth.service.ts
│   ├── marketplace.service.ts
│   ├── commerce.service.ts
│   ├── sales.service.ts
│   ├── content.service.ts
│   ├── certification.service.ts
│   ├── company.service.ts
│   ├── address.service.ts
│   ├── location.service.ts
│   ├── distributor-application.service.ts
│   ├── inventory-integration.service.ts
│   ├── support-integration.service.ts
│   ├── exchange-rate.service.ts
│   ├── attachment.service.ts
│   ├── audit-log.service.ts
│   ├── theme.service.ts
│   └── request.tracker.ts
├── infrastructure/
│   ├── http/
│   │   ├── http-client.ts
│   │   ├── token-store.ts
│   │   ├── auth-bridge.ts
│   │   ├── api-error.ts
│   │   ├── cookie-utils.ts
│   │   └── index.ts
│   └── feedback/
│       ├── modal.service.ts
│       ├── toast.service.ts
│       ├── confirm.service.ts
│       └── index.ts
├── composables/
│   ├── useAuth.ts
│   ├── useCart.ts
│   ├── useWishlist.ts
│   ├── useMarketplace.ts
│   ├── useAddresses.ts
│   ├── useCompany.ts
│   ├── useDistributorApp.ts
│   ├── useInventory.ts
│   ├── useSupport.ts
│   └── useBusinessRole.ts
├── components/
│   ├── ui/                      # 27+ base components from Welco
│   │   ├── AppButton.vue
│   │   ├── AppImage.vue
│   │   ├── BaseButton.vue
│   │   ├── BaseCard.vue
│   │   ├── BaseInput.vue
│   │   ├── BaseModal.vue
│   │   ├── BasePagination.vue
│   │   ├── ChainSteps.vue
│   │   ├── ConfirmDialog.vue
│   │   ├── CurrencySelect.vue
│   │   ├── DataState.vue
│   │   ├── EmptyState.vue
│   │   ├── ErrorState.vue
│   │   ├── FileUpload.vue
│   │   ├── LoadingBar.vue
│   │   ├── PhoneInput.vue
│   │   ├── QuantityStepper.vue
│   │   ├── ResultModal.vue
│   │   ├── SkeletonLoader.vue
│   │   ├── StatCard.vue
│   │   ├── StatusPill.vue
│   │   ├── ToastContainer.vue
│   │   └── WhatsAppFab.vue
│   ├── auth/
│   │   └── AuthShell.vue
│   ├── account/
│   │   └── AccountNav.vue
│   ├── layout/
│   │   ├── AppHeader.vue
│   │   ├── AppFooter.vue
│   │   ├── AppMobileNav.vue
│   │   └── AdminLayout.vue
│   └── icons/
│       └── Icon.vue
├── views/
│   ├── HomeView.vue
│   ├── AboutView.vue
│   ├── LocationsView.vue
│   ├── AddressesView.vue
│   ├── ProfileView.vue
│   ├── auth/
│   │   ├── LoginView.vue
│   │   ├── RegisterView.vue
│   │   ├── ForgotPasswordView.vue
│   │   ├── ResetPasswordView.vue
│   │   ├── VerifyEmailView.vue
│   │   └── VerifyPasswordOtpView.vue
│   ├── marketplace/
│   │   ├── CatalogView.vue
│   │   ├── ProductDetailView.vue
│   │   ├── CartView.vue
│   │   ├── CheckoutView.vue
│   │   ├── OrderConfirmationView.vue
│   │   ├── OrderTrackingView.vue
│   │   └── WishlistView.vue
│   ├── account/
│   │   ├── AccountDashboardView.vue
│   │   ├── OrderHistoryView.vue
│   │   ├── OrderDetailView.vue
│   │   ├── QuoteListView.vue
│   │   ├── QuoteDetailView.vue
│   │   ├── RfqListView.vue
│   │   └── RfqDetailView.vue
│   ├── admin/
│   │   ├── AdminDashboardView.vue
│   │   ├── AdminDashboardView.vue
│   │   ├── SalesAdminView.vue
│   │   ├── OrdersAdminView.vue
│   │   ├── CompaniesAdminView.vue
│   │   ├── CountriesAdminView.vue
│   │   ├── CitiesAdminView.vue
│   │   ├── ZonesAdminView.vue
│   │   ├── UsersAdminView.vue
│   │   ├── CatalogAdminView.vue
│   │   ├── CertificationsAdminView.vue
│   │   ├── PagesAdminView.vue
│   │   ├── HelpAdminView.vue
│   │   ├── TicketsAdminView.vue
│   │   ├── AuditLogAdminView.vue
│   │   └── DistributorApplicationsAdminView.vue
│   ├── catalog/
│   │   ├── CategoriesView.vue
│   │   └── LandingPageView.vue
│   ├── quality/
│   │   └── CertificationsView.vue
│   ├── support/
│   │   ├── HelpCenterView.vue
│   │   └── MyTicketsView.vue
│   ├── trade/
│   │   ├── OemView.vue
│   │   └── ProvidersView.vue
│   └── distributor/
│       ├── DistributorApplicationView.vue
│       └── DistributorApplicationStatusView.vue
├── router/
│   └── index.ts
├── i18n/
│   ├── index.ts
│   ├── messages.ts
│   ├── en.ts
│   └── ar.ts
├── utils/
│   ├── format.ts
│   ├── file-url.ts
│   ├── phone.ts
│   ├── role.ts
│   ├── country-currency-map.ts
│   ├── pending-org-marker.ts
│   └── doc-title.ts
├── assets/
│   ├── main.css
│   └── base.css
├── App.vue
├── main.ts
└── shims-vue.d.ts
```

---

## Task Breakdown

### Phase 1: Foundation (Infrastructure & Core)

#### Task 1: Project Setup & Config
- [ ] Create `src/config/api.config.ts` with SNUL/Welco gateway URLs, auth routes, integration endpoints
- [ ] Create `src/config/app.config.ts` with feature flags, constants, role names
- [ ] Update `vite.config.ts` with proxy config for SNUL gateway
- [ ] Update `index.html` with proper title, meta tags, font preload
- [ ] Update `package.json` with required dependencies

#### Task 2: HTTP Infrastructure
- [ ] Create `src/infrastructure/http/api-error.ts` - ApiEnvelope, ApiError, GENERIC_OK_MESSAGES
- [ ] Create `src/infrastructure/http/cookie-utils.ts` - getCookie, setCookie, deleteCookie
- [ ] Create `src/infrastructure/http/token-store.ts` - TokenStore class with JWT expiry, refresh logic, localStorage/cookie sync
- [ ] Create `src/infrastructure/http/auth-bridge.ts` - AuthBridge interface for router guards
- [ ] Create `src/infrastructure/http/http-client.ts` - HttpClient with rate limiting, dedup, slot management, token refresh, error handling
- [ ] Create `src/infrastructure/http/index.ts` - barrel exports

#### Task 3: Feedback Services
- [ ] Create `src/infrastructure/feedback/modal.service.ts` - ModalService with show/hide/confirm
- [ ] Create `src/infrastructure/feedback/toast.service.ts` - ToastService with success/error/info/warning
- [ ] Create `src/infrastructure/feedback/confirm.service.ts` - ConfirmService with confirm dialog
- [ ] Create `src/infrastructure/feedback/index.ts` - barrel exports

#### Task 4: Internationalization
- [ ] Create `src/i18n/messages.ts` - MessageKey type, default messages
- [ ] Create `src/i18n/en.ts` - English translations (auth, nav, marketplace, account, admin, etc.)
- [ ] Create `src/i18n/ar.ts` - Arabic translations (RTL support)
- [ ] Create `src/i18n/index.ts` - i18n initialization, locale switching, t() function

#### Task 5: Router & Route Guards
- [ ] Create `src/router/index.ts` - 50+ routes with meta (requiresAuth, guestOnly, requiresAdmin, titleKey, isLandingPage, hideFooter)
- [ ] Implement router.beforeEach guards: auth validation, role redirects (admin vs buyer), pending org check
- [ ] Implement router.afterEach for document title updates and accessibility announcer

#### Task 6: DI Container
- [ ] Create `src/di/container.ts` - ServiceContainer class, register all services, repositories, infrastructure

#### Task 7: Domain Models
- [ ] Create `src/domain/models/auth.ts` - User, AuthResponse, LoginRequest, RegisterRequest, Profile
- [ ] Create `src/domain/models/marketplace.ts` - Product, Category, FeaturedProduct, ProductQuery (from Welco M2M)
- [ ] Create `src/domain/models/commerce.ts` - Cart, CartItem, Order, OrderItem, CheckoutRequest
- [ ] Create `src/domain/models/sales.ts` - Rfq, Quote, QuoteItem, RfqRequest, QuoteRequest
- [ ] Create `src/domain/models/content.ts` - HelpArticle, FAQ, SupportTicket, LandingPage
- [ ] Create `src/domain/models/certification.ts` - Certification (from Welco M2M)
- [ ] Create `src/domain/models/company.ts` - Company, DistributorApplication, DistributorStatus
- [ ] Create `src/domain/models/location.ts` - Country, City, Zone, Address
- [ ] Create `src/domain/ports/*.ts` - Repository interfaces for each domain

#### Task 8: API Repositories
- [ ] Create `src/data/repositories/api-auth.repository.ts`
- [ ] Create `src/data/repositories/api-marketplace.repository.ts` (M2M to Welco)
- [ ] Create `src/data/repositories/api-commerce.repository.ts` (Local SNUL)
- [ ] Create `src/data/repositories/api-sales.repository.ts` (Local SNUL)
- [ ] Create `src/data/repositories/api-content.repository.ts` (M2M from Welco + Local)
- [ ] Create `src/data/repositories/api-certification.repository.ts` (M2M from Welco)
- [ ] Create `src/data/repositories/api-company.repository.ts` (Local SNUL)
- [ ] Create `src/data/repositories/api-location.repository.ts` (Local SNUL)
- [ ] Create `src/data/repositories/api-address.repository.ts` (Local SNUL)
- [ ] Create `src/data/repositories/api-distributor.repository.ts` (Local SNUL + M2M sync)
- [ ] Create `src/data/repositories/api-integration.repository.ts` (M2M Welco endpoints)

#### Task 9: Application Services
- [ ] Create `src/application/auth.service.ts` - login, register, logout, profile, token refresh, role checks
- [ ] Create `src/application/marketplace.service.ts` - loadProducts, loadCategories, loadFeatured (M2M caching)
- [ ] Create `src/application/commerce.service.ts` - cart, checkout, orders (Local SNUL DB)
- [ ] Create `src/application/sales.service.ts` - RFQs, Quotes (Local SNUL DB)
- [ ] Create `src/application/content.service.ts` - help articles, FAQs (M2M from Welco)
- [ ] Create `src/application/certification.service.ts` - certifications (M2M from Welco)
- [ ] Create `src/application/company.service.ts` - companies, profiles
- [ ] Create `src/application/address.service.ts` - user addresses
- [ ] Create `src/application/location.service.ts` - countries, cities, zones (Egypt focus)
- [ ] Create `src/application/distributor-application.service.ts` - create, status, M2M sync
- [ ] Create `src/application/inventory-integration.service.ts` - M2M inventory check/reserve
- [ ] Create `src/application/support-integration.service.ts` - M2M help articles sync
- [ ] Create `src/application/exchange-rate.service.ts` - EGP/USD rates
- [ ] Create `src/application/attachment.service.ts` - file upload
- [ ] Create `src/application/audit-log.service.ts` - admin audit logs
- [ ] Create `src/application/theme.service.ts` - role-based theme
- [ ] Create `src/application/request.tracker.ts` - in-flight request tracking

#### Task 10: Composables
- [ ] Create `src/composables/useAuth.ts` - reactive auth state, login/logout/profile
- [ ] Create `src/composables/useCart.ts` - cart state, add/remove/update, M2M inventory check
- [ ] Create `src/composables/useWishlist.ts` - wishlist state
- [ ] Create `src/composables/useMarketplace.ts` - products, categories, featured
- [ ] Create `src/composables/useAddresses.ts` - address CRUD
- [ ] Create `src/composables/useCompany.ts` - company profile
- [ ] Create `src/composables/useDistributorApp.ts` - distributor application flow
- [ ] Create `src/composables/useInventory.ts` - M2M inventory check/reserve
- [ ] Create `src/composables/useSupport.ts` - support tickets
- [ ] Create `src/composables/useBusinessRole.ts` - role detection (Admin/SnulStaff/OrgUser/Client)

#### Task 11: Utility Functions
- [ ] Create `src/utils/format.ts` - formatPrice (EGP/USD), formatNumber, formatDate
- [ ] Create `src/utils/file-url.ts` - productMediaUrl, attachment URLs
- [ ] Create `src/utils/phone.ts` - Egypt phone format/validation
- [ ] Create `src/utils/role.ts` - role checking utilities
- [ ] Create `src/utils/country-currency-map.ts` - country to currency mapping
- [ ] Create `src/utils/pending-org-marker.ts` - pending distributor detection
- [ ] Create `src/utils/doc-title.ts` - document title helpers

#### Task 12: UI Components (Base Layer)
- [ ] Create all 27 base UI components from Welco pattern
- [ ] Create AuthShell, AccountNav, AppHeader, AppFooter, AppMobileNav, AdminLayout
- [ ] Create Icon component with Material Symbols

#### Task 13: App Shell & Styles
- [ ] Create `src/App.vue` - header, footer, router-view with transitions, WhatsApp FAB, loading bar
- [ ] Create `src/assets/main.css` - Tailwind imports, CSS variables, global styles
- [ ] Create `src/assets/base.css` - base reset, typography, utility classes
- [ ] Create `src/main.ts` - app initialization, i18n, router, DI, global components

### Phase 2: Auth & Public Views

#### Task 14: Auth Views
- [ ] Create `src/views/auth/LoginView.vue` - email/password, remember me, forgot password link
- [ ] Create `src/views/auth/RegisterView.vue` - Client vs OrganizationUser, company fields
- [ ] Create `src/views/auth/ForgotPasswordView.vue` - email entry, OTP send
- [ ] Create `src/views/auth/VerifyEmailView.vue` - OTP verification
- [ ] Create `src/views/auth/VerifyPasswordOtpView.vue` - password reset OTP
- [ ] Create `src/views/auth/ResetPasswordView.vue` - new password entry

#### Task 15: Public Landing Views
- [ ] Create `src/views/HomeView.vue` - hero, providers strip, metrics, categories, featured, certifications, about
- [ ] Create `src/views/AboutView.vue` - company info, history, mission
- [ ] Create `src/views/LocationsView.vue` - Egypt locations map/list
- [ ] Create `src/views/AddressesView.vue` - address management (authenticated)

#### Task 16: Marketplace Views (M2M from Welco)
- [ ] Create `src/views/marketplace/CatalogView.vue` - product grid, filters, search, pagination
- [ ] Create `src/views/marketplace/ProductDetailView.vue` - product details, specs, add to cart
- [ ] Create `src/views/marketplace/CartView.vue` - cart items, quantity, checkout button
- [ ] Create `src/views/marketplace/CheckoutView.vue` - shipping, billing, payment, M2M inventory reserve
- [ ] Create `src/views/marketplace/OrderConfirmationView.vue` - order success, tracking
- [ ] Create `src/views/marketplace/OrderTrackingView.vue` - order status timeline
- [ ] Create `src/views/marketplace/WishlistView.vue` - saved items, move to cart

#### Task 17: Catalog & Trade Views
- [ ] Create `src/views/catalog/CategoriesView.vue` - category tree from Welco M2M
- [ ] Create `src/views/catalog/LandingPageView.vue` - dynamic landing pages
- [ ] Create `src/views/trade/OemView.vue` - OEM inquiry form
- [ ] Create `src/views/trade/ProvidersView.vue` - providers from Welco M2M

### Phase 3: Account & Authenticated Views

#### Task 18: Account Views
- [ ] Create `src/views/ProfileView.vue` - profile edit, avatar, preferences
- [ ] Create `src/views/account/AccountDashboardView.vue` - overview, stats, quick actions
- [ ] Create `src/views/account/OrderHistoryView.vue` - paginated orders with status
- [ ] Create `src/views/account/OrderDetailView.vue` - order details, items, tracking
- [ ] Create `src/views/account/QuoteListView.vue` - quotes with status filters
- [ ] Create `src/views/account/QuoteDetailView.vue` - quote items, approve/decline
- [ ] Create `src/views/account/RfqListView.vue` - RFQs with status
- [ ] Create `src/views/account/RfqDetailView.vue` - RFQ details, responses

#### Task 19: Distributor Application Views
- [ ] Create `src/views/distributor/DistributorApplicationView.vue` - multi-step application form
- [ ] Create `src/views/distributor/DistributorApplicationStatusView.vue` - status tracking

### Phase 4: Admin Views

#### Task 20: Admin Dashboard & Core
- [ ] Create `src/views/admin/AdminDashboardView.vue` - metrics, charts, quick links
- [ ] Create `src/views/admin/SalesAdminView.vue` - RFQ/Quote management
- [ ] Create `src/views/admin/OrdersAdminView.vue` - order management
- [ ] Create `src/views/admin/CompaniesAdminView.vue` - company CRUD
- [ ] Create `src/views/admin/UsersAdminView.vue` - user management, roles
- [ ] Create `src/views/admin/CountriesAdminView.vue` - country management
- [ ] Create `src/views/admin/CitiesAdminView.vue` - city management
- [ ] Create `src/views/admin/ZonesAdminView.vue` - zone management

#### Task 21: Admin Catalog & Content
- [ ] Create `src/views/admin/CatalogAdminView.vue` - product/category moderation
- [ ] Create `src/views/admin/CertificationsAdminView.vue` - certification display (M2M)
- [ ] Create `src/views/admin/PagesAdminView.vue` - landing pages CRUD
- [ ] Create `src/views/admin/HelpAdminView.vue` - help articles management
- [ ] Create `src/views/admin/TicketsAdminView.vue` - support tickets

#### Task 22: Admin Distributor & Audit
- [ ] Create `src/views/admin/DistributorApplicationsAdminView.vue` - application review, approve/reject, M2M sync
- [ ] Create `src/views/admin/AuditLogAdminView.vue` - audit log viewer

### Phase 5: Support & Quality

#### Task 23: Support & Certification Views
- [ ] Create `src/views/support/HelpCenterView.vue` - help articles, FAQs (M2M from Welco)
- [ ] Create `src/views/support/MyTicketsView.vue` - user tickets, replies
- [ ] Create `src/views/quality/CertificationsView.vue` - certifications grid (M2M from Welco)

### Phase 6: Polish & Integration

#### Task 24: Integration & Testing
- [ ] Full E2E flow: Register → Login → Browse → Cart → Checkout (with M2M inventory)
- [ ] Distributor application: Apply → Status → Admin approve → M2M sync verify
- [ ] Admin workflows: Users, Companies, Countries, Catalog moderation
- [ ] RTL/Arabic i18n testing across all views
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Performance optimization (lazy loading, code splitting)

#### Task 25: Production Config
- [ ] Environment configs (.env.development, .env.production, .env.test)
- [ ] Build optimization (chunk splitting, compression)
- [ ] CI/CD pipeline configuration
- [ ] Documentation updates

---

## Success Criteria

1. All 40+ views implemented and functional
2. M2M integration to Welco working for: products, categories, inventory check/reserve, certifications, providers, help articles
3. Local SNUL database operations working for: auth, orders, carts, RFQs, quotes, companies, addresses, distributor apps
4. Role-based access control: Admin, SnulStaff, OrganizationUser, Client
5. Full Arabic/English i18n support with RTL layout
6. All Welco UI components adapted and working
7. Build passes with no TypeScript errors
8. Lint passes with no warnings