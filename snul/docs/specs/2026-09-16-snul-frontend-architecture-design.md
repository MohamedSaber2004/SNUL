# SNUL Frontend Architecture Design

## Overview

This document specifies the SNUL frontend architecture that mirrors the Welco platform's clean architecture while adapting for SNUL's Egyptian B2B medical device distribution platform. SNUL serves as the regional distribution hub for Egyptian hospitals, clinics, and healthcare buyers, with strictly isolated client databases and M2M integration to Welco (Pakistani master data source).

## Architecture

The SNUL frontend follows Welco's Clean/Onion Architecture with distinct layers:

| Layer | Responsibility | Key Files/Modules |
|-------|---------------|-------------------|
| **Presentation** | Vue 3 components, router, i18n, UI library | App.vue, router/index.ts, views/, components/ |
| **Application** | Services, composables, state management | services/, application/, composables/ |
| **Domain** | Models, DTOs, ports/interfaces | domain/models/, domain/ports/ |
| **Infrastructure** | HTTP client, token store, auth bridge, API repositories | infrastructure/http/, infrastructure/feedback/, data/repositories/ |
| **Config** | API endpoints, feature flags, environment settings | config/, data/ |
| **Utils** | Helper functions, formatters | utils/ |

## Key Design Decisions

### 1. Mirroring Welco's Infrastructure Pattern

- **HttpClient**: Same pattern with token store, auth bridge, feedback (modal/toast/confirm), rate limiting, dedup, slot management
- **TokenStore**: JWT access/refresh tokens stored in localStorage/cookies, expiry tracking, refresh before expiry (5-min buffer)
- **AuthBridge**: Interface-based auth session handling for router guards
- **ModalService/ToastService/ConfirmService**: Consistent feedback across all views
- **i18n**: Arabic/English support with locale-aware date/currency formatting
- **Router**: 50+ routes with meta guards (requiresAuth, guestOnly, requiresAdmin, titleKey, isLandingPage, hideFooter)

### 2. SNUL-Specific Adaptations

| Feature | Welco | SNUL Adaptation |
|---------|-------|-----------------|
| **Gateway URL** | `https://welco-gateway.runasp.net` | `https://snul-gateway.runasp.net` / `http://localhost:7266` |
| **M2M Integration** | Internal (same platform) | **External**: POST `/api/integration/*` to Welco gateway |
| **Auth Roles** | `Admin`, `WelcoStaff`, `OrganizationUser`, `Client` | `Admin`, `SnulStaff`, `OrganizationUser` (=Distributor), `Client` |
| **Product Source** | Local Welco DB | **Welco via M2M**: `/api/integration/products`, `/api/integration/categories` |
| **Inventory Check** | Local DB | **M2M to Welco**: `/api/v1/integration/inventory/check` + `/api/v1/integration/inventory/reserve` |
| **Orders** | Local Welco DB | **Local SNUL DB**: Egyptian orders stored in SNUL database only |
| **Certifications** | Local DB | **M2M from Welco**: `/api/integration/certifications` |
| **Support Articles** | Local | **M2M from Welco**: `/api/integration/help/articles` + `/api/integration/help/faqs` |
| **Distributor Apps** | Local Welco DB | **Local + Upstream**: SNUL-local app + sync to Welco master DB |
| **Providers** | Local Welco DB | **Welco Integration**: `/api/integration/providers` |
| **Phone/Currency** | Pakistan-focused | **Egypt-focused**: EGP currency, Egypt phone format, Egypt zones/countries |

### 3. Data Flow Pattern

```
Frontend View → Composables (API calls) → DI Container (Repositories) → HttpClient → SNUL Gateway (/api/*) → SNUL Microservices → SNUL DB
                                                          ↑
                                                          │ M2M Integration
                                                          │ POST /api/integration/*
                                                          ↓
                                                    Welco Gateway → Welco DB → Master Data
```

### 4. View Categories & Route Structure

Following Welco's router pattern with SNUL-specific additions:

```
Auth Routes (guestOnly):
  /auth/login, /auth/register, /auth/verify-email, /auth/forgot-password, /auth/verify-password-otp, /auth/reset-password

Public Routes (isLandingPage):
  /, /marketplace, /categories, /oem, /providers, /certifications, /about, /help

Authenticated Routes (requiresAuth):
  /profile, /addresses, /cart, /checkout, /account, /account/orders, /account/quotes, /account/rfqs

Admin Routes (requiresAuth + requiresAdmin):
  /admin, /admin/dashboard, /admin/orders, /admin/companies, /admin/countries,
  /admin/cities, /admin/zones, /admin/users, /admin/catalog, /admin/products,
  /admin/certifications, /admin/pages, /admin/help, /admin/tickets, /admin/audit-logs,
  /admin/distributor-applications (SNUL-specific)

SNUL-Specific Routes:
  /distributor-application (new application), /distributor-application/{id}/status,
  /inventory/check, /inventory/reserve, /orders/local, /quotes/my,
  /support/tickets, /support/tickets/{id}/reply
```

### 5. UI Component Library

Welco's 27+ UI components adapted for SNUL:

**Core Components** (from Welco):
- AppButton, AppImage, BaseButton, BaseCard, BaseInput, BaseModal, BasePagination
- ChainSteps, ConfirmDialog, CurrencySelect, DataState, EmptyState, ErrorState
- FileUpload, LoadingBar, PhoneInput, QuantityStepper, ResultModal, SkeletonLoader
- StatCard, StatusPill, ToastContainer, WhatsAppFab

**SNUL-Additions/Adaptations**:
- Arabic numeral formatting support (right-to-left layout)
- Egypt-specific phone input validation
- EGP currency formatting
- Distributor application form components
- Inventory reservation status display
- Arabic/English locale-aware date pickers

### 6. Service Layer (Application Layer)

Following Welco's DI container pattern with SNUL-specific services:

**Core Services (from Welco pattern)**:
- AuthService, LocationService, AddressService, MarketplaceService, WishlistService
- CommerceService, SalesService, ContentService, CertificationService, CompanyService
- AuditLogService, ExchangeRateService, AttachmentService

**SNUL-Specific Services**:
- **DistributorApplicationService**: Manages local distributor onboarding + M2M sync
- **InventoryIntegrationService**: M2M inventory checks/reservations with Welco
- **SupportIntegrationService**: M2M sync of help articles and ticket integration
- **CertificationIntegrationService**: M2M certification data from Welco
- **ProviderIntegrationService**: Provider/supplier data from Welco integration

### 7. API Repository Pattern

Welco's API repositories adapted for SNUL endpoints:

| Repository | Welco Endpoint | SNUL Endpoint |
|-----------|---------------|---------------|
| ApiAuthRepository | `/api/v1/auth/*` | `/api/v1/auth/*` (SNUL gateway) |
| ApiMarketplaceRepository | Local Welco DB | **M2M**: `/api/integration/products`, `/api/integration/categories` |
| ApiCommerceRepository | Local Welco DB | **Local SNUL**: `/api/v1/carts`, `/api/v1/orders` |
| ApiSalesRepository | Local Welco DB | **Local SNUL RFQs/Quotes**: `/api/v1/rfqs`, `/api/v1/quotes` |
| ApiContentRepository | Local Welco DB | **M2M**: `/api/integration/help/articles`, `/api/integration/help/faqs` |
| ApiCertificationRepository | Local Welco DB | **M2M**: `/api/integration/certifications` |
| ApiCompanyRepository | Local Welco DB | **Local SNUL**: `/api/v1/companies`, distributor apps |
| ApiLocationRepository | Local Welco DB | **Local SNUL**: `/api/v1/addresses`, countries/cities/zones |
| ApiAddressRepository | Local Welco DB | **Local SNUL**: `/api/v1/addresses` |

### 8. Composables Pattern

Welco's composables adapted with SNUL-specific additions:

| Composable | Function | SNUL Adaptation |
|-----------|--------|-----------------|
| useAuth | Auth state | Same + SnulStaff role tracking |
| useCart | Cart management | Same + M2M inventory check before add |
| useWishlist | Wishlist | Same |
| useMarketplace | Products/categories | **M2M to Welco** + local caching |
| useAddresses | User addresses | Same + Egypt zones/cities |
| useBusinessRole | Role detection | Same + OrganizationUser/Distributor |
| useDistributorApp | Distributor application | **NEW**: Create, status, sync with Welco |
| useInventory | Inventory check | **NEW**: M2M check/reserve with Welco |
| useCompany | Company profile | Same + Egypt tax/commercial reg |
| useSupport | Support tickets | Same + M2M sync integration |

### 9. State Management

- **Vue 3 Composition API** with `<script setup>`
- **Reactive state** using `ref()` and `computed()`
- **Service container** (DI) for all services
- **LocalStorage** for token persistence (same as Welco)
- **Session cookies** for cross-tab token synchronization
- **Request tracker** for concurrency management (max 4 simultaneous requests)

### 10. Error Handling & Feedback

- **Unified ApiError** pattern (status, message, errors, silent)
- **HTTP-specific handling**: 401 (refresh/logout), 429 (rate limit retry), 404 (not found)
- **Feedback system**: Loading bars, success/toast/error modals, confirmation dialogs
- **Network error**: Graceful fallback with user-friendly messages
- **Locale-aware messages**: Arabic/English error messages based on Accept-Language header

### 11. Security Model

- **JWT Bearer tokens** in Authorization header
- **Token refresh** before expiry (5-minute proactive buffer)
- **Role-based access control**: requiresAuth, requiresAdmin, guestOnly meta guards
- **Session expiry**: Automatic logout on token expiration
- **CORS**: SNUL gateway configured with allowed origins
- **Rate limiting**: Per-IP fixed window limiter (configurable limits)

### 12. Testing Strategy

- **Unit tests** for composables and utilities
- **Integration tests** for API repository layer (mocked HttpClient)
- **E2E tests** for critical flows: login → catalog → cart → checkout
- **Snapshot tests** for UI components
- **i18n tests**: Arabic/English message catalogs

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- Infrastructure setup: HttpClient, TokenStore, AuthBridge, i18n, Router
- App.vue shell with header, footer, router-view, WhatsApp FAB
- Base CSS variables and Tailwind config
- Core services registration in DI container
- Auth views: Login, Register, ForgotPassword, ResetPassword

### Phase 2: Core Buyer Workflows (Weeks 3-5)
- Marketplace: Catalog view with M2M product fetch, Categories, ProductDetail
- Cart & Checkout with M2M inventory check/reservation
- Account: Dashboard, Orders, Quotes, RFQs
- Address management with Egypt zones/countries

### Phase 3: Admin & SNUL-Specific Features (Weeks 6-8)
- Admin dashboard with SNUL-specific metrics
- Distributor application flow (create + status + M2M sync)
- Companies, Countries, Cities, Zones management
- Support tickets & help articles (M2M from Welco)

### Phase 4: Quality & Trade (Weeks 9-10)
- Certifications view (M2M from Welco)
- OEM/Providers views (adapted from Welco)
- Invoice/order history with reservation tracking

### Phase 5: Polish & Launch (Weeks 11-12)
- Full i18n Arabic/English support
- Accessibility audit (WCAG 2.1 AA)
- Performance optimization
- End-to-end testing
- Production deployment config

---

## Technical Stack

| Category | Technology |
|----------|-----------|
| **Frontend Framework** | Vue 3 + Composition API |
| **Build Tool** | Vite 8.x |
| **Routing** | Vue Router 4 |
| **State Management** | Composition API + DI container (custom) |
| **Styling** | Tailwind CSS + CSS Modules (scoped) |
| **HTTP Client** | Native fetch via custom HttpClient |
| **Authentication** | JWT Bearer tokens |
| **Internationalization** | Custom i18n with ar.ts/en.ts |
| **UI Library** | Custom component library (27+ components) |
| **Icons** | Material Symbols Outlined |
| **Fonts** | Inter/Geist display font (via CSS vars) |
| **Charts/Metrics** | CSS-based metric cards (no external deps) |

---

## API Integration Summary

| Domain | Source | Endpoint Pattern |
|--------|--------|-----------------|
| **Auth** | SNUL Gateway | `/api/v1/auth/*` |
| **M2M Token** | Welco Integration | `POST /api/integration/token` |
| **Products/Categories** | Welco via M2M | `GET /api/integration/products`, `GET /api/integration/categories` |
| **Inventory** | Welco via M2M | `POST /api/v1/integration/inventory/check`, `POST /api/v1/integration/inventory/reserve` |
| **Certifications** | Welco via M2M | `GET /api/integration/certifications` |
| **Providers** | Welco via M2M | `GET /api/integration/providers` |
| **Support/Knowledge** | Welco + Local | `GET /api/integration/help/articles`, `GET /api/integration/help/faqs` |
| **Distributor Apps** | Local + M2M Sync | `POST /api/v1/distributor-applications`, `PUT /api/v1/distributor-applications/{id}/status` |
| **Orders** | Local SNUL DB | `POST /api/v1/orders`, `GET /api/v1/carts` |
| **RFQs/Quotes** | Local SNUL DB | `POST /api/v1/rfqs`, `GET /api/v1/quotes`, `POST /api/v1/quotes/{id}/approve` |
| **Companies/Addresses** | Local SNUL DB | `GET/POST /api/v1/companies`, `GET/POST /api/v1/addresses` |
| **Support Tickets** | Local SNUL DB | `GET/POST /api/v1/support-tickets` |

---

## Design Rationale

1. **Mirror Welco's proven architecture** - Reduces learning curve, ensures consistency for developers familiar with Welco
2. **M2M Integration-first** - SNUL's core differentiator: dynamic sourcing from Welco master data
3. **Strict Data Isolation** - SNUL's Egyptian database never duplicates Welco's master data; all catalog/inventory flows through M2M APIs
4. **Egyptian Business Context** - Localized currency (EGP), phone formats, zones/countries, Arabic/English support
5. **Distributor Workflow** - SNUL-specific distributor onboarding and approval pipeline
6. **Scalable Layered Architecture** - Each layer can be modified independently; clear boundaries enable unit testing

This design document serves as the blueprint for implementing the complete SNUL frontend that mirrors Welco's architecture while adapting to SNUL's specific Egyptian B2B medical device distribution platform requirements.