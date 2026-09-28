<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authService, services, contentRepository, companyRepository } from '../di/container'
import { t, locale } from '../i18n'
import type { CategoryDto, ProductDto } from '../domain/models/marketplace'
import type { CertificationDto } from '../domain/models/certification'
import type { LandingPageDto } from '../domain/models/content'
import type { CompanyDto } from '../domain/models/company'
import { toastService } from '../infrastructure/feedback/toast.service'
import DataState from '../components/ui/DataState.vue'
import SkeletonLoader from '../components/ui/SkeletonLoader.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import AppImage from '../components/ui/AppImage.vue'
import { formatPrice } from '../utils/format'
import { findLandingPageBySlug } from '../utils/landing-page'
import { useCart } from '../composables/useCart'
import { useSiteLogo } from '../composables/useSiteLogo'

const router = useRouter()
const { add: addToCart } = useCart()
const { logoUrl: siteLogoUrl, altText: siteLogoAlt } = useSiteLogo()
const heroSearch = ref('')
const goSearch = () => {
  void router.push({ name: 'marketplace', query: heroSearch.value ? { search: heroSearch.value } : {} })
}

const cats = ref<CategoryDto[]>([])
const certifications = ref<CertificationDto[]>([])
const landingPages = ref<LandingPageDto[]>([])
const aboutPage = ref<LandingPageDto | null>(null)
/** Homepage hero, admin-editable via the `home-hero` landing record. */
const heroPage = ref<LandingPageDto | null>(null)
const HERO_SLUG = 'home-hero'

/**
 * The hero and the about copy are both `LandingPage` records, and this view
 * already loads the landing-page collection. Resolving the hero out of that
 * list (instead of issuing GET /landing-pages/slug/home-hero) means a database
 * with no `home-hero` row yet simply renders the built-in i18n hero, with no
 * 404 in the console and no wasted request.
 *
 * Only active records may override the built-in copy. The backend already
 * filters `IsActive` on the by-slug route, so this keeps both routes agreeing.
 */
const findLandingPage = (pages: LandingPageDto[], slug: string): LandingPageDto | null =>
  findLandingPageBySlug(pages, slug)

const providers = ref<CompanyDto[]>([])
const mostSellingProducts = ref<ProductDto[]>([])
const mostSellingLoading = ref(true)
const loading = ref(true)

const handleAddToQuote = (id: string) => {
  const p = mostSellingProducts.value.find((x) => x.id === id)
  if (!p) return
  addToCart(p, 1)
  toastService.success(
    t('catalog.quoteSuccess', { product: localized(p.nameEn, p.nameAr) }),
  )
}

/* ── Category → providers → products, served by backend endpoints ── */
const expandedProviderId = ref<string | null>(null)
const tileProductPage = ref(1)
const tileProducts = ref<ProductDto[]>([])
const tileTotal = ref(0)
const tileLoading = ref(false)
const TILE_PAGE_SIZE = 4
const tileTotalPages = computed(() => Math.max(1, Math.ceil(tileTotal.value / TILE_PAGE_SIZE)))

const fetchTilePage = async () => {
  const id = expandedProviderId.value
  if (!id) return
  tileLoading.value = true
  try {
    const res = await companyRepository.getCompanyProducts(id, { page: tileProductPage.value, pageSize: TILE_PAGE_SIZE })
    tileProducts.value = Array.isArray(res?.data) ? res.data : []
    tileTotal.value = res?.totalCount ?? tileProducts.value.length
  } catch {
    tileProducts.value = []
    tileTotal.value = 0
  } finally {
    tileLoading.value = false
  }
}
const toggleProvider = (id: string) => {
  if (expandedProviderId.value === id) {
    expandedProviderId.value = null
    return
  }
  expandedProviderId.value = id
  tileProductPage.value = 1
  void fetchTilePage()
}
watch(tileProductPage, () => { void fetchTilePage() })

const explorerCatId = ref<string | null>(null)
const explorerProviderPage = ref(1)
const EXPLORER_PROVIDER_PAGE_SIZE = 5

const explorerProviders = ref<CompanyDto[]>([])
const explorerProviderTotal = ref(0)
const explorerProvidersLoading = ref(false)
const explorerProviderTotalPages = computed(() =>
  Math.max(1, Math.ceil(explorerProviderTotal.value / EXPLORER_PROVIDER_PAGE_SIZE)),
)

// The explorer's default selection comes from the ALL-categories list, not from
// the paginated grid page. Paging "Browse by Category" must not move the
// "Browse by Clinical Specialty" selection — that is the whole point of keeping
// the two sources separate. An explicit user pick still wins.
// (Declared after `allCats` below.)

/* ══ Section 1 — Browse by Category: server-paginated (GET /categories) ══
 * Source: `getCategoriesPaginated`. Bounded to one page at a time.
 */
const CAT_PAGE_SIZE = 8
const catsLoading = ref(false)
const catsTotal = ref(0)
const catPage = ref(1)
const catTotalPages = computed(() => Math.max(1, Math.ceil(catsTotal.value / CAT_PAGE_SIZE)))

const loadCats = async (page = 1) => {
  catsLoading.value = true
  try {
    const res = await services.marketplaceRepository.getCategoriesPaginated({
      pageNumber: page,
      pageSize: CAT_PAGE_SIZE,
    })
    cats.value = Array.isArray(res?.data) ? res.data : []
    catsTotal.value = res?.totalCount ?? cats.value.length
  } catch {
    cats.value = []
    catsTotal.value = 0
  } finally {
    catsLoading.value = false
  }
}
watch(catPage, (p) => { void loadCats(p) })

/* ══ Section 2 — Browse by Clinical Specialty: every category (GET /categories/all)
 * Source: `getCategories`. Deliberately a DIFFERENT request from section 1, so
 * paging the grid can never truncate the filter's options.
 */
const SPECIALTY_PREVIEW_COUNT = 8
const allCats = ref<CategoryDto[]>([])
const specialtyQuery = ref('')
const showAllSpecialties = ref(false)

const specialtySearchActive = computed(() => specialtyQuery.value.trim().length > 0)

const loadAllCats = async () => {
  try {
    allCats.value = await services.marketplaceRepository.getCategories()
  } catch {
    allCats.value = []
  }
}

/** Filtered client-side: the full set is already loaded for this filter. */
const matchingSpecialties = computed(() => {
  const q = specialtyQuery.value.trim().toLowerCase()
  if (!q) return allCats.value
  return allCats.value.filter((c) =>
    [c.nameEn, c.nameAr, c.slug].some((v) => (v ? String(v).toLowerCase().includes(q) : false)),
  )
})

/** Show a preview of 8; searching reveals every match without expanding. */
const visibleSpecialties = computed(() =>
  specialtySearchActive.value || showAllSpecialties.value
    ? matchingSpecialties.value
    : matchingSpecialties.value.slice(0, SPECIALTY_PREVIEW_COUNT),
)

const canExpandSpecialties = computed(
  () => !showAllSpecialties.value && matchingSpecialties.value.length > SPECIALTY_PREVIEW_COUNT,
)

const toggleShowAllSpecialties = () => {
  showAllSpecialties.value = !showAllSpecialties.value
}

const clearSpecialtySearch = () => {
  specialtyQuery.value = ''
}

watch(allCats, (list) => {
  const first = list[0]
  if (!explorerCatId.value && first) void selectExplorerCat(first.id)
})

const fetchExplorerProviders = async () => {
  if (!explorerCatId.value) return
  explorerProvidersLoading.value = true
  try {
    const res = await services.marketplaceRepository.getCategoryProviders(explorerCatId.value, {
      page: explorerProviderPage.value,
      pageSize: EXPLORER_PROVIDER_PAGE_SIZE,
    })
    explorerProviders.value = Array.isArray(res?.data) ? res.data : []
    explorerProviderTotal.value = res?.totalCount ?? explorerProviders.value.length
  } catch {
    explorerProviders.value = []
    explorerProviderTotal.value = 0
  } finally {
    explorerProvidersLoading.value = false
  }
}

const openCategoryProviders = (catId: string) => {
  void router.push({ name: 'category-providers', params: { id: catId } })
}
const selectExplorerCat = (id: string) => {
  explorerCatId.value = id
  explorerProviderPage.value = 1
  void fetchExplorerProviders()
}
const openProviderStorefront = (id: string) => {
  void router.push({
    name: 'provider-storefront',
    params: { id },
    query: explorerCatId.value ? { category: explorerCatId.value } : undefined,
  })
}
watch(explorerProviderPage, () => { void fetchExplorerProviders() })

const FOUNDING_YEAR = 1994

onMounted(async () => {
  loading.value = true
  try {
    await Promise.allSettled([
      // Two independent category sources for the two independent sections.
      loadCats(1),
      loadAllCats(),
      services.certificationService.load(8, true),
      services.contentService.loadSupport(),
      contentRepository.getLandingPages({ pageNumber: 1, pageSize: 50 }).then((p) => {
        landingPages.value = p.data
        // Both records are resolved from this single collection fetch.
        aboutPage.value = findLandingPage(p.data, 'about-us')
        heroPage.value = findLandingPage(p.data, HERO_SLUG)
      }).catch(() => {
        landingPages.value = []
        aboutPage.value = null
        heroPage.value = null
      }),
      companyRepository
        .getProvidersDirectory({ pageNumber: 1, pageSize: 8 })
        .then((p) => {
          // getProvidersDirectory is guest-safe (public endpoint + fallback),
          // so any returned rows can be shown directly.
          providers.value = Array.isArray(p?.data)
            ? p.data.filter((c) => c && c.isActive !== false).slice(0, 8)
            : []
        })
        .catch(() => {
          providers.value = []
        }),
      services.marketplaceRepository
        .getMostSellingProducts(8)
        .then((items) => {
          mostSellingProducts.value = items || []
        })
        .catch(() => {
          mostSellingProducts.value = []
        })
        .finally(() => {
          mostSellingLoading.value = false
        }),
    ])
    certifications.value = services.certificationService.certifications.value
  } finally {
    loading.value = false
  }
})

const localized = (en?: string | null, ar?: string | null) => locale.value === 'ar' ? (ar || en || '') : (en || ar || '')

/* ── Admin-managed hero copy: when the CMS `home-hero` record exists it
 *  REPLACES the hero verbatim (blanks stay blank); the built-in copy only
 *  shows when no record exists yet. ── */
const heroTitleText = computed(() => (heroPage.value ? (heroPage.value.heroTitle ?? '') : t('home.heroTitle')))
const heroAccentText = computed(() => (heroPage.value ? (heroPage.value.contentBlock ?? '') : t('home.heroTitleAccent')))
const heroSubtitleText = computed(() => (heroPage.value ? (heroPage.value.heroBody ?? '') : t('home.heroSubtitle')))

const priceModalOpen = ref(false)
const priceSubmitting = ref(false)
const priceSubmitted = ref(false)
const priceRefId = ref('')
const priceForm = ref({
  fullName: '',
  email: '',
  phone: '',
  organization: '',
  specialty: 'General Surgery',
  details: '',
  timeline: 'standard',
})

const openPriceModal = () => {
  const u = authService.user.value
  if (u) {
    if (!priceForm.value.fullName) priceForm.value.fullName = u.fullName || ''
    if (!priceForm.value.email) priceForm.value.email = u.email || ''
    if (!priceForm.value.phone) priceForm.value.phone = u.phoneNumber || ''
  }
  priceSubmitted.value = false
  priceModalOpen.value = true
}

const handlePriceSubmit = async () => {
  if (!priceForm.value.fullName.trim() || !priceForm.value.email.trim() || !priceForm.value.details.trim()) {
    toastService.error(t('auth.errGeneric'))
    return
  }
  priceSubmitting.value = true
  try {
    const refNum = `RFQ-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
    priceRefId.value = refNum

    const companyId = authService.user.value?.companyId
    if (authService.isAuthenticated && services.salesRepository && companyId) {
      try {
        await services.salesRepository.createRfq({
          companyId,
          note: `[Fast Price Quote (${refNum})] Specialty: ${priceForm.value.specialty} | Org: ${priceForm.value.organization} | Timeline: ${priceForm.value.timeline}\n\nInstruments & Requirements:\n${priceForm.value.details}`,
          items: [],
        })
      } catch {}
    }

    priceSubmitted.value = true
    toastService.success(t('home.quoteSubmittedDesc'))
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    priceSubmitting.value = false
  }
}

const navigateToOemFromModal = () => {
  priceModalOpen.value = false
  void router.push({ name: 'oem' })
}
</script>

<template>
  <div class="home">
    <header class="hero">
      <div class="hero__inner">
        <div class="hero__copy anim-fade-in-up">
          <h1>{{ heroTitleText }}<em v-if="heroAccentText"> {{ heroAccentText }}</em></h1>
          <p v-if="heroSubtitleText">{{ heroSubtitleText }}</p>
          <div class="hero__search">
            <form class="hero__search-bar" @submit.prevent="goSearch">
              <input v-model="heroSearch" :placeholder="t('marketplace.searchPlaceholder')" />
              <button class="hero__search-btn" type="submit">{{ t('common.searchPlaceholder') }}</button>
            </form>
          </div>
          <div class="hero__ctas">
            <button class="btn btn-primary btn-lg btn-press" type="button" @click="router.push({ name: 'marketplace' })">
              <span>{{ t('nav.marketplace') }}</span>
            </button>
            <button class="btn btn-secondary btn-lg" type="button" @click="openPriceModal">
              <span class="material-symbols-outlined text-[20px]">request_quote</span>
              <span>{{ t('home.requestQuote') }}</span>
            </button>
          </div>
        </div>
        <div class="hero__logo-box anim-scale-in">
          <img v-if="siteLogoUrl" :src="siteLogoUrl" :alt="siteLogoAlt" width="420" height="220" loading="eager" />
          <div v-else class="no-logo-placeholder">
            <span class="material-symbols-outlined no-logo-icon">image_not_supported</span>
            <span class="no-logo-text mono">{{ locale === 'ar' ? 'لم يتم تعيين صورة بعد' : 'No image set yet' }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Most Products Selling Section (First section after hero) -->
    <section v-reveal class="section section--most-selling" aria-labelledby="most-selling-heading">
      <div class="section__inner">
        <div class="section-head">
          <div>
            <div class="mono section__eyebrow">{{ t('home.mostSellingEyebrow') }}</div>
            <h2 id="most-selling-heading" class="section-title">{{ t('home.mostSellingTitle') }}</h2>
          </div>
          <router-link to="/most-selling" class="btn btn-ghost btn-sm view-all-btn">
            <span>{{ t('common.viewAll') }}</span>
            <span class="icon--directional">→</span>
          </router-link>
        </div>
        <p class="section-desc">{{ t('home.mostSellingSubtitle') }}</p>

        <DataState
          :loading="mostSellingLoading && !mostSellingProducts.length"
          :empty="!mostSellingProducts.length && !mostSellingLoading"
          skeleton-type="product-card"
          :skeleton-count="4"
          min-height="250px"
        >
          <div class="product-grid">
            <article
              v-for="(p, i) in mostSellingProducts"
              :key="p.id"
              v-reveal="i"
              class="product-card anim-card-hover"
              @click="router.push({ name: 'marketplace-product', params: { id: p.id } })"
            >
              <div class="product-card__media">
                <AppImage
                  :src="p.imageName"
                  placeholder-type="product"
                  :alt="localized(p.nameEn, p.nameAr)"
                  fit="cover"
                  class="product-card__img"
                />
                <span v-if="p.isNew" class="mono product-card__badge">{{ t('home.newBadge') }}</span>
                <span v-if="p.stock > 0" class="mono product-card__stock product-card__stock--in">{{ t('catalog.inStock') }}</span>
                <span v-else class="mono product-card__stock product-card__stock--out">{{ t('catalog.madeToOrder') }}</span>
              </div>
              <div class="product-card__body">
                <div class="mono product-card__category" dir="auto">{{ localized(p.categoryNameEn, p.categoryNameAr) }}</div>
                <h3 class="product-card__title" dir="auto">{{ localized(p.nameEn, p.nameAr) }}</h3>
                <div class="mono product-card__meta-alt" dir="auto">{{ locale === 'en' ? p.nameAr : p.nameEn }}</div>
                <div class="mono product-card__meta">{{ p.companyName || p.manufacturerEn || 'SNUL Surgical' }} · CE Certified</div>
                <div class="product-card__foot">
                  <strong class="mono-num">{{ formatPrice(p.price, locale) }} {{ p.currencySymbol || '$' }}</strong>
                  <button class="btn btn-primary btn-sm btn-quote-white" type="button" @click.stop="handleAddToQuote(p.id)">
                    <span class="material-symbols-outlined text-[15px]">add_shopping_cart</span>
                    <span>{{ t('marketplace.addToQuote') }}</span>
                  </button>
                </div>
              </div>
            </article>
          </div>
        </DataState>
      </div>
    </section>

    <!-- Our Providers Section -->
<section v-reveal class="section section--providers" aria-labelledby="providers-heading">
  <div class="section__inner">
    <div class="section-head">
      <div>
        <div class="mono section__eyebrow">{{ t('home.ourProvidersEyebrow') }}</div>
        <h2 id="providers-heading" class="section-title">{{ t('home.ourProviders') }}</h2>
      </div>
      <router-link to="/providers" class="btn btn-ghost btn-sm view-all-btn">
        <span>{{ t('common.viewAll') }}</span>
        <span class="icon--directional">→</span>
      </router-link>
    </div>
    <p class="section-desc">{{ t('home.ourProvidersSubtitle') }}</p>

    <DataState :loading="loading && !providers.length" :empty="!providers.length && !loading" skeleton-type="provider-grid" :skeleton-count="4" min-height="250px">
      <div class="providers-strip-grid">
        <article
          v-for="(p, i) in providers"
          :key="p.id"
          v-reveal="i"
          class="provider-tile anim-card-hover"
          :class="{ 'is-expanded': expandedProviderId === p.id }"
        >
          <button
            type="button"
            class="provider-tile__main"
            :aria-expanded="expandedProviderId === p.id"
            @click="toggleProvider(p.id)"
          >
            <div class="provider-tile__logo">
              <AppImage
                :src="p.imageName"
                placeholder-type="company"
                :alt="p.name"
                fit="contain"
                height="70px"
              />
            </div>
            <div class="provider-tile__info">
              <div class="provider-tile__top">
                <span class="provider-tile__badge mono">
                  {{ t('home.verifiedSupplier') }}
                </span>
              </div>
              <h3 class="provider-tile__name" dir="auto">{{ p.name }}</h3>
              <div v-if="p.countryNameEn || p.countryNameAr" class="provider-tile__country mono">
                <span class="material-symbols-outlined text-[13px] text-teal-600">public</span>
                <span>{{ localized(p.countryNameEn, p.countryNameAr) }}</span>
              </div>
            </div>
          </button>
          <div class="provider-tile__foot">
            <span class="mono provider-tile__count">{{ t('provider.providerProducts') }}</span>
            <span class="material-symbols-outlined provider-tile__chev" :class="{ 'is-open': expandedProviderId === p.id }" aria-hidden="true">expand_more</span>
          </div>
          <div v-if="expandedProviderId === p.id" class="provider-tile__products">
            <div v-if="tileLoading" role="status"><SkeletonLoader type="provider-cards" :count="2" /></div>
            <div v-else-if="!tileProducts.length" class="mono provider-tile__empty">{{ t('provider.noProviderProducts') }}</div>
            <div v-else class="provider-mini-grid">
              <button
                v-for="prod in tileProducts"
                :key="prod.id"
                type="button"
                class="provider-mini"
                @click="router.push({ name: 'marketplace-product', params: { id: prod.id } })"
              >
                <AppImage
                  :src="prod.imageName"
  placeholder-type="product"
  :alt="localized(prod.nameEn, prod.nameAr)"
                  fit="contain"
                  class="provider-mini__img"
                />
                <span class="provider-mini__name" dir="auto">{{ localized(prod.nameEn, prod.nameAr) }}</span>
                <span class="provider-mini__price mono-num">{{ formatPrice(prod.price, locale) }} {{ prod.currencySymbol || '$' }}</span>
              </button>
            </div>
            <div v-if="tileTotalPages > 1" class="provider-pager">
              <button type="button" class="page-btn" :disabled="tileProductPage <= 1" @click="tileProductPage--">‹</button>
              <span class="mono provider-pager__num">{{ tileProductPage }} / {{ tileTotalPages }}</span>
              <button type="button" class="page-btn" :disabled="tileProductPage >= tileTotalPages" @click="tileProductPage++">›</button>
            </div>
            <router-link :to="{ name: 'provider-storefront', params: { id: p.id } }" class="provider-viewall mono">
              <span>{{ t('provider.viewCatalog') }}</span>
              <span class="icon--directional">→</span>
            </router-link>
          </div>
        </article>
      </div>
    </DataState>
  </div>
</section>

    <section v-reveal class="section section--category" aria-labelledby="cat-heading">
      <div class="section__inner">
        <div class="section-head">
          <div>
            <div class="mono section__eyebrow">{{ t('home.browseByCategory') }}</div>
            <h2 id="cat-heading" class="section-title">{{ t('marketplace.categoriesTitle') }}</h2>
          </div>
          <router-link to="/categories" class="btn btn-ghost btn-sm view-all-btn">
            <span>{{ t('common.viewAll') }}</span>
            <span class="icon--directional">→</span>
          </router-link>
        </div>
        <DataState :loading="catsLoading && !cats.length" :empty="!cats.length && !catsLoading" skeleton-type="category-grid" :skeleton-count="8" min-height="160px">
          <div class="cat-grid">
            <router-link v-for="(c, i) in cats" :key="c.id" v-reveal="i" :to="{ name: 'category-providers', params: { id: c.id } }" class="cat-card anim-card-hover">
              <div class="cat-media">
                <AppImage
                  :src="c.imageName"
                  placeholder-type="category"
                  :placeholder-text="''"
                  :alt="localized(c.nameEn, c.nameAr)"
                  class="cat-media__img"
                />
              </div>
              <div class="cat-body">
                <div class="cat-name" dir="auto">{{ localized(c.nameEn, c.nameAr) }}</div>
                <div class="cat-name-alt mono" dir="auto">{{ locale === 'en' ? c.nameAr : c.nameEn }}</div>
                <span class="mono cat-count">{{ t('landing.instrumentsCount', { count: c.productCount ?? 0 }) }}</span>
              </div>
            </router-link>
          </div>
        </DataState>

        <div v-if="catTotalPages > 1" class="cat-pager">
          <button
            type="button"
            class="page-btn"
            :disabled="catPage <= 1 || catsLoading"
            :aria-label="t('common.prev')"
            @click="catPage--"
          >‹</button>
          <span class="mono cat-pager__num">{{ catPage }} / {{ catTotalPages }}</span>
          <button
            type="button"
            class="page-btn"
            :disabled="catPage >= catTotalPages || catsLoading"
            :aria-label="t('common.next')"
            @click="catPage++"
          >›</button>
        </div>
      </div>
    </section>

    <section v-reveal class="section section--clinical" aria-labelledby="specialty-heading">
      <div class="section__inner">
        <div class="section-head">
          <div>
            <div class="mono section__eyebrow">{{ t('home.browseClinicalSpecialty') }}</div>
            <h2 id="specialty-heading" class="section-title">{{ t('marketplace.filterBySpecialty') }}</h2>
          </div>
        </div>

        <div class="cat-explorer card">
          <div class="cat-filter">
            <div class="cat-filter__field">
              <span class="material-symbols-outlined cat-filter__icon" aria-hidden="true">search</span>
              <label class="sr-only" for="specialty-filter-input">{{ t('home.searchSpecialties') }}</label>
              <input
                id="specialty-filter-input"
                v-model="specialtyQuery"
                type="search"
                class="cat-filter__input mono"
                :placeholder="t('home.searchSpecialties')"
                autocomplete="off"
                aria-describedby="specialty-filter-count"
              />
              <button
                v-if="specialtySearchActive"
                type="button"
                class="cat-filter__clear"
                :aria-label="t('home.clearSpecialtySearch')"
                @click="clearSpecialtySearch"
              >
                <span class="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
            <p id="specialty-filter-count" class="cat-filter__count mono" role="status" aria-live="polite">
              {{ t('home.specialtiesFound', { shown: visibleSpecialties.length, total: matchingSpecialties.length }) }}
            </p>
          </div>

          <div v-if="specialtySearchActive && !matchingSpecialties.length" class="cat-no-results">
            <span class="material-symbols-outlined cat-no-results__icon" aria-hidden="true">search_off</span>
            <p class="cat-no-results__text">
              {{ t('home.noSpecialtiesMatch', { q: specialtyQuery.trim() }) }}
            </p>
            <button type="button" class="btn btn-ghost btn-sm" @click="clearSpecialtySearch">
              {{ t('home.clearSpecialtySearch') }}
            </button>
          </div>

          <div v-else class="cat-explorer__intro">
            <div>
              <h3 class="cat-explorer__heading">{{ t('provider.providersInCategory') }}</h3>
            </div>
          </div>
          <div v-if="visibleSpecialties.length" class="cat-explorer__pills" role="tablist" :aria-label="t('marketplace.filterBySpecialty')">
              <button
                v-for="(c, index) in visibleSpecialties"
                :key="c.id"
                type="button"
                role="tab"
                class="pill cat-explorer__pill interactive-lift"
                :aria-label="`${localized(c.nameEn, c.nameAr)} · ${index + 1}`"
              :class="{ 'pill--active': explorerCatId === c.id }"
              :aria-selected="explorerCatId === c.id"
              @click="selectExplorerCat(c.id)"
            >
              {{ localized(c.nameEn, c.nameAr) }}
            </button>
          </div>

          <div v-if="canExpandSpecialties || showAllSpecialties" class="cat-expand">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :aria-expanded="showAllSpecialties"
              @click="toggleShowAllSpecialties"
            >
              <span>{{ showAllSpecialties ? t('home.showFewerSpecialties') : t('home.showAllSpecialties', { count: matchingSpecialties.length }) }}</span>
              <span class="material-symbols-outlined icon--directional" aria-hidden="true">
                {{ showAllSpecialties ? 'expand_less' : 'expand_more' }}
              </span>
            </button>
          </div>

          <div v-if="explorerCatId" class="cat-explorer__body">
            <div class="cat-explorer__head">
              <h3 class="cat-explorer__title">{{ t('provider.providersInCategory') }}</h3>
              <router-link :to="{ name: 'category-providers', params: { id: explorerCatId } }" class="provider-viewall mono">
                <span>{{ t('common.viewAll') }}</span>
                <span class="icon--directional">→</span>
              </router-link>
            </div>
            <Transition name="explorer-fade" mode="out-in">
              <div v-if="explorerProvidersLoading" key="loading" role="status" aria-label="Loading providers" class="cat-explorer__loading-wrap">
                <SkeletonLoader type="provider-cards" :count="5" />
              </div>
              <div v-else-if="!explorerProviders.length" key="empty" class="mono cat-explorer__empty">
                {{ t('provider.noProvidersHere') }}
              </div>
              <div v-else key="content">
                <div class="cat-explorer__providers">
                  <button
                    v-for="prov in explorerProviders"
                    :key="prov.id"
                    type="button"
                    class="cat-provider anim-card-hover"
                    :aria-label="`${prov.name} · ${t('provider.viewCatalog')}`"
                    @click="openProviderStorefront(prov.id)"
                  >
                    <AppImage
                      :src="prov.imageName"
                      placeholder-type="company"
                      :placeholder-text="''"
                      :alt="prov.name"
                      fit="contain"
                      class="cat-provider__img"
                    />
                    <span class="cat-provider__name" dir="auto">{{ prov.name }}</span>
                    <span v-if="prov.countryNameEn || prov.countryNameAr" class="cat-provider__country mono">
                      {{ localized(prov.countryNameEn, prov.countryNameAr) }}
                    </span>
                    <span class="cat-provider__cta mono">{{ t('provider.viewCatalog') }} <span class="icon--directional">→</span></span>
                  </button>
                </div>
                <div v-if="explorerProviderTotalPages > 1" class="provider-pager">
                  <button type="button" class="page-btn" :disabled="explorerProviderPage <= 1" @click="explorerProviderPage--">‹</button>
                  <span class="mono provider-pager__num">{{ explorerProviderPage }} / {{ explorerProviderTotalPages }}</span>
                  <button type="button" class="page-btn" :disabled="explorerProviderPage >= explorerProviderTotalPages" @click="explorerProviderPage++">›</button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </section>
    <!-- Audited Quality Standards Section -->
    <section v-reveal class="section section--certs" aria-labelledby="home-certs-heading">
      <div class="section__inner">
        <div class="section-head">
          <div>
            <div class="mono section__eyebrow">{{ t('certifications.eyebrow') }}</div>
            <h2 id="home-certs-heading" class="section-title">{{ t('certifications.certsTitle') }}</h2>
          </div>
          <router-link to="/certifications" class="btn btn-ghost btn-sm view-all-btn">
            <span>{{ t('common.viewAll') }}</span>
            <span class="icon--directional">→</span>
          </router-link>
        </div>
        <DataState :loading="loading && !certifications.length" :empty="!certifications.length && !loading" skeleton-type="cert-grid" :skeleton-count="4" min-height="300px">
          <div class="home-certs-grid">
            <article
              v-for="(c, i) in certifications.filter(c => c.isActive).slice(0, 4)"
              :key="c.id"
              v-reveal="i"
              class="home-cert-card anim-card-hover"
              @click="router.push('/certifications')"
            >
              <div class="home-cert-card__media">
                <AppImage
                  :src="c.certificationImageName"
                  placeholder-type="document"
                  :placeholder-text="c.certificateNumber || c.title"
                  :alt="c.title"
                  aspect-ratio="16/10"
                  fit="contain"
                />
              </div>
              <div class="home-cert-card__body">
                <div class="home-cert-card__badge mono">{{ c.certificateNumber || 'ISO / CE' }}</div>
                <h3 class="home-cert-card__title">{{ c.title }}</h3>
                <div class="home-cert-card__meta mono">{{ c.issuer }}</div>
              </div>
            </article>
          </div>
        </DataState>
      </div>
    </section>
    <section v-reveal class="section section--about" aria-labelledby="about-heading">
      <div class="section__inner about-grid">
        <div class="about-content">
          <div class="mono section__eyebrow">{{ t('home.aboutEyebrow') }}</div>
          <h2 id="about-heading" class="section-title">{{ aboutPage?.heroTitle || t('home.aboutTitle') }}</h2>
          <p class="about-body">{{ aboutPage?.heroBody || t('home.aboutBody') }}</p>
          <p v-if="aboutPage?.contentBlock" class="about-body">{{ aboutPage.contentBlock }}</p>
          <div class="about-ctas">
            <router-link to="/marketplace" class="btn btn-primary btn-press">
              <span>{{ t('home.browseComplete') }}</span>
              <span class="icon--directional">→</span>
            </router-link>
            <router-link to="/about" class="btn btn-secondary">
              <span>{{ t('home.learnMoreAbout') }}</span>
            </router-link>
            <router-link to="/oem" class="btn btn-secondary">
              <span>{{ t('nav.oem') }}</span>
            </router-link>
          </div>
        </div>
        <div class="about-media">
          <img v-if="siteLogoUrl" :src="siteLogoUrl" :alt="siteLogoAlt" class="about-media__img" loading="lazy" />
          <div v-else class="no-logo-placeholder no-logo-placeholder--about">
            <span class="material-symbols-outlined no-logo-icon">image_not_supported</span>
            <span class="no-logo-text mono">{{ locale === 'ar' ? 'لم يتم تعيين صورة بعد' : 'No image set yet' }}</span>
          </div>
        </div>
      </div>
    </section>

<!-- Request Institutional Price Quote Modal -->
    <BaseModal v-model="priceModalOpen" :title="t('home.quoteModalTitle')" max-width="580px">
      <div v-if="priceSubmitted" class="quote-modal-success">
        <h3 class="success-head">{{ t('home.quoteSubmittedTitle') }}</h3>
        <p class="success-body">{{ t('home.quoteSubmittedDesc') }}</p>

        <div class="ref-ticket-box mono">
          <span class="ref-label">{{ t('home.quoteReference') }}:</span>
          <span class="ref-code">{{ priceRefId }}</span>
        </div>

        <div class="modal-success-actions">
          <BaseButton variant="primary" block @click="priceModalOpen = false">
            {{ t('common.close') }}
          </BaseButton>
          <button type="button" class="btn-link-oem mono" @click="navigateToOemFromModal">
            <span>{{ t('home.quoteOemLink') }}</span>
            <span class="icon--directional">→</span>
          </button>
        </div>
      </div>

      <form v-else class="quote-modal-form" @submit.prevent="handlePriceSubmit">
        <p class="quote-modal-desc">{{ t('home.quoteModalSubtitle') }}</p>

        <div class="modal-2col">
          <div class="modal-field">
            <label class="modal-lbl mono">{{ t('auth.fullName') }} *</label>
            <input v-model="priceForm.fullName" class="modal-inp" required :placeholder="t('auth.fullName')" />
          </div>
          <div class="modal-field">
            <label class="modal-lbl mono">{{ t('auth.email') }} *</label>
            <input v-model="priceForm.email" type="email" class="modal-inp" required :placeholder="t('auth.email')" />
          </div>
        </div>

        <div class="modal-2col">
          <div class="modal-field">
            <label class="modal-lbl mono">{{ t('home.quoteOrganization') }}</label>
            <input v-model="priceForm.organization" class="modal-inp" :placeholder="t('home.quoteOrganization')" />
          </div>
          <div class="modal-field">
            <label class="modal-lbl mono">{{ t('auth.phoneNumber') }}</label>
            <input v-model="priceForm.phone" class="modal-inp" :placeholder="t('auth.phoneNumber')" />
          </div>
        </div>

        <div class="modal-2col">
          <div class="modal-field">
            <label class="modal-lbl mono">{{ t('home.quoteSpecialty') }}</label>
            <select v-model="priceForm.specialty" class="modal-sel">
              <option value="General Surgery">General Surgery</option>
              <option value="Cardiovascular & Thoracic">Cardiovascular &amp; Thoracic</option>
              <option value="Orthopedics & Trauma">Orthopedics &amp; Trauma</option>
              <option value="Neurosurgery & Spine">Neurosurgery &amp; Spine</option>
              <option value="Ophthalmology">Ophthalmology</option>
              <option value="Dental & Maxillofacial">Dental &amp; Maxillofacial</option>
              <option value="Custom Sterile Sets">Custom Sterile Sets</option>
              <option value="Other Surgical Line">Other Surgical Line</option>
            </select>
          </div>
          <div class="modal-field">
            <label class="modal-lbl mono">{{ t('home.quoteTimeline') }}</label>
            <select v-model="priceForm.timeline" class="modal-sel">
              <option value="immediate">{{ t('home.quoteTimelineImmediate') }}</option>
              <option value="standard">{{ t('home.quoteTimelineStandard') }}</option>
              <option value="annual">{{ t('home.quoteTimelineAnnual') }}</option>
            </select>
          </div>
        </div>

        <div class="modal-field">
          <label class="modal-lbl mono">{{ t('home.quoteDetails') }} *</label>
          <textarea
            v-model="priceForm.details"
            rows="3"
            class="modal-txt"
            required
            :placeholder="t('home.quoteDetailsPlaceholder')"
          ></textarea>
        </div>

        <div class="modal-oem-callout mono">
          <span>{{ t('home.quoteOemPrompt') }}</span>
          <a href="/oem" class="oem-callout-link" @click.prevent="navigateToOemFromModal">
            {{ t('home.quoteOemLink') }} <span class="icon--directional">→</span>
          </a>
        </div>

        <div class="modal-actions-row">
          <BaseButton type="submit" variant="primary" :loading="priceSubmitting" block>
            {{ t('home.quoteSubmit') }}
          </BaseButton>
          <BaseButton type="button" variant="secondary" @click="priceModalOpen = false">
            {{ t('common.cancel') }}
          </BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>

<style scoped>
.home {
  background: var(--wl-paper);
}

/* Hero Section */
.hero {
  background: var(--wl-surface);
  border-bottom: 1px solid var(--wl-border);
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(700px 350px at 70% 20%, rgba(105, 169, 255, 0.06), transparent 60%),
              linear-gradient(rgba(0, 10, 25, 0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 10, 25, 0.02) 1px, transparent 1px);
  background-size: auto, 24px 24px, 24px 24px;
  pointer-events: none;
}

.hero::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
  opacity: 0.35;
}
.hero__contour {
  margin-top: 1.1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 10px;
  letter-spacing: 0.07em;
  color: var(--wl-muted);
  border-top: 1px dashed var(--wl-line);
  padding-top: 0.65rem;
}
.hero__contour strong { color: var(--wl-ink-strong); font-weight: 700; }
.hero__contour .contour-sep { color: var(--wl-line-strong); }

.hero__inner {
  max-width: var(--wl-max-width);
  margin: 0 auto;
  padding: 3.5rem var(--wl-gutter) 3rem;
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 2.75rem;
  align-items: center;
  position: relative;
}

.hero__eyebrow {
  font-size: 10.5px;
  color: var(--wl-primary);
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  letter-spacing: 0.08em;
}

.hero__logo-box {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-8);
  box-shadow: var(--wl-shadow-card);
  position: relative;
  overflow: hidden;
}
.hero__logo-box::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
  opacity: 0.6;
}
.hero__logo-box img {
  width: 100%;
  height: auto;
  max-height: 220px;
  object-fit: contain;
  border-radius: var(--radius-md);
}

.no-logo-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem 1.5rem;
  text-align: center;
  color: var(--wl-muted, #94a3b8);
  width: 100%;
  height: 100%;
  min-height: 200px;
}
.no-logo-icon {
  font-size: 3rem !important;
  opacity: 0.75;
}
.no-logo-text {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  opacity: 0.9;
}
.hero__logo-box .no-logo-placeholder {
  color: rgba(255, 255, 255, 0.85);
}
.hero__logo-box .no-logo-placeholder .no-logo-icon {
  color: rgba(255, 255, 255, 0.7);
}
.no-logo-placeholder--about {
  min-height: 220px;
  background: var(--bg-surface-2, #f8fafc);
  border-radius: var(--radius-md);
  color: var(--slate-500, #64748b);
}

.hero__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--fg-success);
  box-shadow: 0 0 0 3px rgba(25, 135, 84, 0.2);
}

.hero h1 {
  font-family: var(--wl-font-display);
  font-size: clamp(2.3rem, 4.4vw, 3.3rem);
  line-height: 1.05;
  font-weight: 800;
  letter-spacing: -0.028em;
  margin: 0.65rem 0 0.8rem;
  /* Hero always sits on the dark gradient surface — headline is white by
     default (see the enforced override just below). */
  color: var(--fg-on-brand);
}
/* ── Dark-hero headline color: single source of truth ─────────────────
   ROOT CAUSE: assets/main.css forces `color: var(--fg-heading)` (near-black)
   onto every h1–h6 with !important. On this dark surface that paints the
   "Every edge, measured." sentence black and unreadable. The fix must use
   equal importance (!important) plus higher specificity (.home .hero h1).
   Keep ALL hero headline colors in this one block — do not scatter more
   overrides through this file or the fix will silently regress again. */
.home .hero h1 {
  color: var(--fg-on-brand) !important;
}
.home .hero h1 em {
  font-style: normal;
  background: none !important;
  -webkit-background-clip: unset !important;
  background-clip: unset !important;
  color: var(--brand-soft-hover) !important;
  filter: none !important;
  text-shadow: 0 0 36px rgba(86, 208, 251, 0.5);
}

.hero p {
  color: var(--wl-ink-soft);
  font-size: var(--step-0);
  line-height: 1.6;
  max-width: 540px;
}
.home .hero p {
  color: var(--fg-on-brand) !important;
}

/* 48px VIP Search Bar */
.hero__search {
  max-width: 520px;
  margin-top: 1.35rem;
}

.hero__search-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
  box-shadow: var(--shadow-card);
  transition: border-color 0.22s var(--wl-ease-spring), box-shadow 0.22s var(--wl-ease-spring), transform 0.16s ease;
  height: 48px;
}

.hero__search-bar:focus-within {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
  transform: translateY(-0.5px);
}

.search-icon {
  font-size: 19px;
  color: var(--wl-muted);
}

.hero__search-bar input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: var(--step-0);
  font-family: var(--wl-font-body);
  color: var(--wl-ink-strong);
}

.hero__search-bar input::placeholder {
  color: var(--wl-muted);
}

.hero__kbd {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-bottom-width: 2px;
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-sm);
  font-size: 10px;
  color: var(--wl-muted);
}

.hero__search-btn {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  padding: 0 var(--space-5);
  height: 38px;
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  box-shadow: var(--shadow-hover);
  transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.hero__search-btn:hover {
  background: var(--wl-primary-hover);
  transform: translateY(-0.5px);
}

.hero__search-btn:active:not(:disabled) {
  transform: scale(0.985);
}

.hero__search-btn:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.hero__search-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.hero__search-btn[aria-busy="true"] {
  pointer-events: none;
}

.hero__ctas {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-6);
  flex-wrap: wrap;
}

.hero__trust {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-6);
  font-size: var(--step-0);
  color: var(--wl-muted);
  flex-wrap: wrap;
}

.hero__trust .sep {
  color: var(--wl-border);
}

.hero__trust strong {
  color: var(--wl-ink-strong);
}

/* Specification HUD Graphic */
.hero__spec-hud {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  box-shadow: var(--wl-shadow-card);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.hero__spec-hud::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
}

.hud-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
}

.hud-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 700;
  color: var(--wl-primary);
}

.hud-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-success);
}

.hud-live {
  font-weight: 700;
  color: var(--wl-primary);
}

.hud-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0;
  border-top: 1px dashed var(--wl-border);
  border-bottom: 1px dashed var(--wl-border);
}

.hud-brand-logo {
  height: 48px;
  width: auto;
  border-radius: var(--radius-sm);
  margin-bottom: 0.5rem;
}

.hud-title {
  font-size: 10.5px;
  color: var(--wl-muted);
  letter-spacing: 0.06em;
}

.hud-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.hud-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  background: var(--wl-surface-soft);
  padding: var(--space-2) var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--wl-border);
}

.hud-k {
  font-size: 8.5px;
  color: var(--wl-muted);
  letter-spacing: 0.04em;
}

.hud-v {
  font-size: 11px;
  color: var(--wl-ink-strong);
  font-weight: 700;
}

.hud-foot {
  display: flex;
  justify-content: space-between;
  font-size: 9.5px;
  color: var(--wl-muted);
}

/* Sections */
.section {
  padding: var(--space-10) 0;
}

.section--soft {
  background: var(--wl-surface);
  border-top: 1px solid var(--wl-border);
  border-bottom: 1px solid var(--wl-border);
}

/* Browse by Category + Browse by Clinical Specialty — explicit pure white canvas.
   These are two independent sections with two independent endpoints. */
.section--category,
.section--clinical {
  background: var(--bg-surface);
  border-top: 1px solid var(--wl-border);
  border-bottom: 1px solid var(--wl-border);
}

.section__inner {
  max-width: var(--wl-max-width);
  margin: 0 auto;
  padding: 0 var(--wl-gutter);
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--space-6);
  gap: 1rem;
  flex-wrap: wrap;
}

.view-all-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.45rem 0.95rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  color: var(--wl-primary);
  font-size: var(--step--1);
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s ease;
}

.view-all-btn:hover {
  background: var(--wl-surface-soft);
  border-color: var(--wl-primary);
  transform: translateX(2px);
}

[dir="rtl"] .view-all-btn:hover {
  transform: translateX(-2px);
}

.view-all-btn:active:not(:disabled) {
  transform: translateX(0);
}

.view-all-btn:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.view-all-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.view-all-btn[aria-busy="true"] {
  pointer-events: none;
}

/* Our Providers Section */
.section--providers {
  background: var(--wl-surface-soft);
  border-bottom: 1px solid var(--wl-border);
  padding: var(--space-8) 0;
}

.section-desc {
  font-size: var(--step-0);
  color: var(--fg-muted);
  margin: calc(var(--space-2) * -1) 0 var(--space-6);
  max-width: 680px;
}

/* Home Cards Grid - Fixed 4-column grid on desktop/laptop, centered in container */
.home-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  max-width: var(--wl-max-width);
  margin-inline: auto;
}

/* Our Providers Section */
.section--providers {
  background: var(--wl-surface-soft);
  border-bottom: 1px solid var(--wl-border);
  padding: var(--space-8) 0;
}

.providers-strip-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  max-width: var(--wl-max-width);
  margin-inline: auto;
}

@media (max-width: 1024px) {
  .providers-strip-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .providers-strip-grid {
    grid-template-columns: 1fr;
  }
}

.provider-tile {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.provider-tile:hover {
  transform: translateY(-3px);
  border-color: var(--brand);
  box-shadow: var(--shadow-hover);
}

.provider-tile:active:not(:disabled) {
  transform: translateY(-1px);
}

.provider-tile:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.provider-tile:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.provider-tile[aria-busy="true"] {
  pointer-events: none;
}

.provider-tile__logo {
  height: 110px;
  background: linear-gradient(180deg, var(--wl-surface-soft) 0%, var(--wl-surface) 100%);
  border-bottom: 1px solid var(--wl-border);
  padding: var(--space-3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.provider-tile__info {
  padding: var(--space-3) var(--space-3);
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--space-1);
}

.provider-tile__top {
  display: flex;
  align-items: center;
}

.provider-tile__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-success);
  background: var(--wl-success-soft);
  border: 1px solid var(--color-success-100);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  letter-spacing: 0.02em;
}

.provider-tile__name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.provider-tile__country {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--step--1);
  color: var(--fg-muted);
  margin-top: auto;
  padding-top: 0.25rem;
}

/* Provider tile expansion (products per provider, paginated) */
.provider-tile__main {
  display: block;
  width: 100%;
  background: none;
  border: 0;
  padding: 0;
  margin: 0;
  text-align: start;
  cursor: pointer;
  color: inherit;
  font: inherit;
}
.provider-tile__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--border);
  background: var(--bg-subtle);
}
.provider-tile__count {
  font-size: var(--text-xs);
  color: var(--fg-muted);
}
.provider-tile__chev {
  font-size: 20px;
  color: var(--fg-subtle);
  transition: transform var(--duration-fast) var(--ease-out);
}
.provider-tile__chev.is-open { transform: rotate(180deg); color: var(--brand); }
.provider-tile__products {
  padding: var(--space-3);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.provider-tile__empty {
  font-size: var(--text-xs);
  color: var(--fg-subtle);
  text-align: center;
  padding: var(--space-3) 0;
}
.provider-mini-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}
.provider-mini {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: start;
  min-width: 0;
  transition: border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
}
.provider-mini:hover { border-color: var(--border-focus); box-shadow: var(--ring-focus); }
.provider-mini__img { width: 100%; height: 64px; border-radius: var(--radius-sm); }
.provider-mini__name {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--fg-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.provider-mini__price { font-size: var(--text-sm); color: var(--fg-body); }
.provider-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}
.provider-pager__num { font-size: var(--text-xs); color: var(--fg-muted); }
.provider-viewall {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--brand);
  text-decoration: none;
  padding: var(--space-1) 0;
}
.provider-viewall:hover { text-decoration: underline; }

/* Category → providers explorer — pure white card with subtle borders & soft hover */
/* ── Browse-by-category pager (server-paginated section) ──
   .page-btn itself comes from assets/base.css, so only the wrapper is new. */
.cat-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1.25rem;
}
.cat-pager__num {
  font-size: 0.8rem;
  color: var(--fg-muted);
  min-width: 3.5rem;
  text-align: center;
}

/* ── Browse-by-clinical-specialty filter (all-categories section) ── */
.cat-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.cat-filter__field {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 260px;
  min-width: 0;
  max-width: 420px;
  background: var(--bg-app);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.cat-filter__field:focus-within {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 18%, transparent);
}
.cat-filter__icon {
  font-size: 18px;
  color: var(--fg-muted);
  margin-inline-start: 0.75rem;
  pointer-events: none;
}
.cat-filter__input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0.55rem 0.6rem;
  font-size: 0.9rem;
  color: inherit;
}
.cat-filter__input:focus {
  outline: none;
  box-shadow: none;
}
.cat-filter__clear {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-inline-end: 0.25rem;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.cat-filter__clear:hover {
  background: var(--bg-subtle);
  color: inherit;
}
.cat-filter__clear .material-symbols-outlined {
  font-size: 18px;
}
.cat-filter__count {
  font-size: 0.75rem;
  color: var(--fg-muted);
  white-space: nowrap;
}

.cat-no-results {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  padding: 2rem 1rem;
  text-align: center;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--bg-subtle);
}
.cat-no-results__icon {
  font-size: 30px;
  color: var(--fg-subtle);
}
.cat-no-results__text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--fg-muted);
}

.cat-expand {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.cat-explorer {
  margin-top: clamp(2rem, 4vw, 3.25rem);
  padding: clamp(1.25rem, 3vw, 2.25rem);
  display: flex;
  flex-direction: column;
  gap: clamp(1.25rem, 2.5vw, 1.75rem);
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--bg-surface);
  box-shadow: 0 4px 20px -2px rgba(15, 61, 86, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02);
  color: var(--fg-heading);
  transform: none;
}
.cat-explorer__intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}
.cat-explorer__eyebrow {
  display: block;
  color: var(--brand);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}
.cat-explorer__heading {
  margin: 0;
  color: var(--fg-heading);
  font-size: clamp(1.25rem, 2.2vw, 1.6rem);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.25;
}
.cat-explorer__pills {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.25rem 0.15rem 0.85rem;
  scrollbar-width: none;
  border-bottom: 1px solid var(--bg-subtle);
}
.cat-explorer__pills::-webkit-scrollbar {
  display: none;
}
.cat-explorer__pills .pill {
  flex-shrink: 0;
}
.cat-explorer__pill {
  flex-shrink: 0;
  padding: 0.5rem 1.15rem;
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: var(--bg-app);
  color: var(--fg-body);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.cat-explorer__pill:hover:not(.pill--active) {
  border-color: rgba(11, 127, 134, 0.35);
  background: var(--bg-subtle);
  color: var(--fg-heading);
  transform: translateY(-1px);
}
.cat-explorer__pill.pill--active {
  background: var(--brand);
  border-color: var(--brand);
  color: var(--fg-on-brand);
  box-shadow: 0 4px 14px rgba(11, 127, 134, 0.28);
  transform: translateY(-1px);
}
.cat-explorer__body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.cat-explorer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.25rem;
}
.cat-explorer__title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--fg-heading);
  margin: 0;
}
.cat-explorer__head .provider-viewall {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--brand);
  text-decoration: none;
  transition: color 0.15s ease, transform 0.15s ease;
}
.cat-explorer__head .provider-viewall:hover {
  text-decoration: underline;
  color: var(--brand-hover);
}
.cat-explorer__empty {
  font-size: var(--text-sm);
  color: var(--fg-muted);
  padding: 2.5rem 0;
  text-align: center;
}
.cat-explorer__providers {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 1rem;
}
.cat-provider {
  min-height: 195px;
  padding: 1.1rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.45rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(15, 61, 86, 0.04);
  cursor: pointer;
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.2s ease,
              box-shadow 0.22s ease;
  min-width: 0;
}
.cat-provider:hover {
  border-color: rgba(11, 127, 134, 0.4);
  background: linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-surface) 100%);
  box-shadow: 0 10px 24px -4px rgba(15, 61, 86, 0.09);
  transform: translateY(-3px);
}
.cat-provider:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
.cat-provider__img {
  width: 100%;
  height: 72px;
  min-height: 72px;
  border-radius: 10px;
  border: 1px solid var(--bg-subtle);
  background: var(--bg-app);
  padding: 0;
  overflow: hidden;
  object-fit: contain;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cat-provider__img:not(.is-placeholder) :deep(img) {
  padding: 0.5rem;
}
.cat-provider__img :deep(.app-image-placeholder) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.cat-provider__img :deep(.placeholder-icon-badge) {
  margin: auto;
}
.cat-provider:hover .cat-provider__img {
  transform: scale(1.04);
}
.cat-provider__name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--fg-heading);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  margin-top: 0.25rem;
}
.cat-provider__country {
  font-size: 0.775rem;
  font-weight: 500;
  color: var(--fg-muted);
}
.cat-provider__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.775rem;
  font-weight: 700;
  color: var(--brand);
  margin-top: auto;
  padding-top: 0.4rem;
  transition: gap 0.2s ease;
}
.cat-provider:hover .cat-provider__cta {
  gap: 0.5rem;
}

/* ── Explorer content transition ── */
.cat-explorer__loading-wrap { min-height: 180px; }

.explorer-fade-enter-active,
.explorer-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.explorer-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.explorer-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .explorer-fade-enter-active,
  .explorer-fade-leave-active {
    transition: none;
  }
}

@media (max-width: 640px) {
  .cat-explorer { padding: 1.15rem; border-radius: 16px; }
  .cat-explorer__intro { align-items: start; flex-direction: column; }
  .cat-explorer__providers { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
  .cat-provider { min-height: 175px; padding: 0.85rem 0.65rem; }
  .cat-provider__img { height: 60px; min-height: 60px; }
  .provider-mini-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* Home Certs Grid - Fixed 4-column grid on desktop, centered */
.home-certs-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  max-width: var(--wl-max-width);
  margin-inline: auto;
}

@media (max-width: 1024px) {
  .home-certs-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .home-certs-grid {
    grid-template-columns: 1fr;
  }
}

.home-cert-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.home-cert-card:hover {
  transform: translateY(-3px);
  border-color: var(--wl-primary);
  box-shadow: var(--shadow-hover);
}

.home-cert-card:active:not(:disabled) {
  transform: translateY(-1px);
}

.home-cert-card:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.home-cert-card:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.home-cert-card[aria-busy="true"] {
  pointer-events: none;
}

.home-cert-card__media {
  height: 160px;
  background: var(--wl-surface-soft);
  overflow: hidden;
}

.home-cert-card__body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
}

.home-cert-card__badge {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--wl-primary);
  letter-spacing: 0.05em;
}

.home-cert-card__title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--fg-heading);
  margin: 0;
  line-height: 1.4;
}

.home-cert-card__issuer {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin-top: auto;
}

.section__eyebrow {
  font-size: var(--step--1);
  color: var(--brand);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: var(--space-1);
  text-shadow: none;
}

.section-title {
  font-family: var(--wl-font-display);
  font-size: var(--step-2);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fg-heading);
  margin: 0;
}

/* Categories Grid */
.cat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: clamp(1rem, 2vw, 1.35rem);
  max-width: var(--wl-max-width);
  margin-inline: auto;
}

@media (max-width: 1100px) {
  .cat-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .cat-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.875rem;
  }
}

@media (max-width: 440px) {
  .cat-grid {
    grid-template-columns: 1fr;
  }
}

/* ── Cat card — pure white, clean borders & border-radius only ── */
.cat-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 0.875rem;
  text-decoration: none;
  box-shadow: 0 1px 3px rgba(15, 61, 86, 0.04), 0 3px 8px rgba(15, 61, 86, 0.02);
  transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.2s ease,
              box-shadow 0.24s ease;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  position: relative;
  overflow: hidden;
}

.cat-card:hover {
  transform: translateY(-4px);
  border-color: rgba(11, 127, 134, 0.42);
  box-shadow: 0 12px 28px -4px rgba(15, 61, 86, 0.1), 0 4px 10px -2px rgba(15, 61, 86, 0.04);
}

.cat-card:active {
  transform: translateY(-1px);
  transition-duration: 0.08s;
}

.cat-card:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
  box-shadow: none;
}

/* ── Cat card image area ── */
.cat-media {
  width: 100%;
  height: 114px;
  border-radius: 12px;
  background: linear-gradient(180deg, var(--bg-app) 0%, var(--bg-subtle) 100%);
  border: 1px solid var(--bg-subtle);
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: 0.65rem;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.cat-card:hover .cat-media {
  background: linear-gradient(180deg, var(--bg-subtle) 0%, var(--bg-subtle) 100%);
  border-color: rgba(11, 127, 134, 0.22);
}

.cat-media__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.cat-card:hover .cat-media__img {
  transform: scale(1.06);
}

.cat-media__icon {
  font-size: 32px;
  color: var(--wl-muted);
}

/* ── Cat card body ── */
.cat-body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.15rem 0.2rem 0.25rem;
}

.cat-name {
  font-size: 0.975rem;
  font-weight: 700;
  color: var(--fg-heading);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-name-alt {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--fg-muted);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-count {
  font-size: 0.75rem;
  color: var(--brand);
  font-weight: 600;
  margin-top: 0.35rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.cat-count::before {
  content: '';
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.75;
  flex-shrink: 0;
}

/* ── Staggered entrance animation for cat cards on load ── */
@media (prefers-reduced-motion: no-preference) {
  .cat-grid .cat-card {
    animation: catCardIn 0.38s var(--wl-ease-spring, cubic-bezier(0.2, 0, 0, 1)) both;
  }
  .cat-grid .cat-card:nth-child(1) { animation-delay: 0ms; }
  .cat-grid .cat-card:nth-child(2) { animation-delay: 40ms; }
  .cat-grid .cat-card:nth-child(3) { animation-delay: 80ms; }
  .cat-grid .cat-card:nth-child(4) { animation-delay: 120ms; }
  .cat-grid .cat-card:nth-child(5) { animation-delay: 160ms; }
  .cat-grid .cat-card:nth-child(6) { animation-delay: 200ms; }
  .cat-grid .cat-card:nth-child(7) { animation-delay: 240ms; }
  .cat-grid .cat-card:nth-child(8) { animation-delay: 280ms; }
}

@keyframes catCardIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Products Grid */
.product-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  max-width: var(--wl-max-width);
  margin-inline: auto;
}

@media (max-width: 1024px) {
  .product-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .product-grid {
    grid-template-columns: 1fr;
  }
}

.product-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--wl-shadow-card);
  cursor: pointer;
  transition: transform 0.2s var(--wl-ease-spring), border-color 0.2s ease, box-shadow 0.2s ease;
}

.product-card:hover {
  transform: translateY(-2px);
  border-color: var(--wl-primary-soft);
  box-shadow: var(--shadow-hover);
}

.product-card:active:not(:disabled) {
  transform: translateY(-1px);
}

.product-card:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.product-card:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.product-card[aria-busy="true"] {
  pointer-events: none;
}

.product-card__media {
  height: 200px;
  width: 100%;
  position: relative;
  overflow: hidden;
  display: block;
  background: var(--bg-subtle);
}

.product-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  padding: 0;
  transition: transform 0.3s ease;
}

.product-card:hover .product-card__img {
  transform: scale(1.05);
}

.product-card__sku {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.product-card__badge {
  position: absolute;
  top: 10px;
  inset-inline-end: 10px;
  font-size: 9.5px;
  font-weight: 800;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
}

.product-card__stock {
  position: absolute;
  top: 10px;
  inset-inline-start: 10px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--wl-on-primary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: var(--shadow-card);
}

.product-card__stock--in {
  background: var(--fg-success);
}

.product-card__stock--out {
  background: var(--fg-danger);
}

.product-card__body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.product-card__category {
  font-size: var(--step--1);
  color: var(--wl-muted);
  font-weight: 600;
}

.product-card__title {
  font-size: var(--step-1);
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.3;
}

.product-card__meta-alt {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.product-card__meta {
  font-size: var(--step--1);
  color: var(--wl-success);
  font-weight: 600;
  margin: var(--space-1) 0 var(--space-3);
}

.product-card__foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--wl-surface-soft);
  padding-top: var(--space-3);
}

@media (max-width: 640px) {
  .product-card__foot {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }
}

.section--most-selling {
  border-bottom: 1px solid var(--border);
  background-color: var(--bg-surface);
}

.btn-quote-white {
  background: var(--wl-primary) !important;
  border-color: var(--wl-primary) !important;
  color: var(--fg-on-brand) !important;
  gap: 0.35rem;
}

.btn-quote-white,
.btn-quote-white * {
  color: var(--fg-on-brand) !important;
}

.btn-quote-white:hover {
  background: var(--wl-primary-hover) !important;
  border-color: var(--wl-primary-hover) !important;
  color: var(--fg-on-brand) !important;
}

@media (max-width: 1024px) {
  .hero__inner {
    padding: var(--space-8) var(--wl-gutter) var(--space-6);
    gap: var(--space-8);
  }
  .section {
    padding: var(--space-8) 0;
  }
}

@media (max-width: 900px) {
  .hero__inner {
    grid-template-columns: 1fr;
    gap: var(--space-8);
    padding: var(--space-7) var(--wl-gutter) var(--space-6);
  }
  .hero__logo-box {
    max-width: 380px;
    margin: 0 auto;
    width: 100%;
  }
}

@media (max-width: 640px) {
  .section {
    padding: var(--space-6) 0;
  }
  .section-head {
    margin-bottom: var(--space-4);
  }
  .section-title {
    font-size: clamp(1.25rem, 4.5vw, 1.5rem);
  }
  .hero__inner {
    padding: var(--space-6) var(--wl-gutter) var(--space-5);
    gap: var(--space-6);
  }
  .hero h1 {
    font-size: clamp(1.7rem, 6.5vw, 2.3rem);
    margin: 0.4rem 0 0.6rem;
  }
  .hero p {
    font-size: 14px;
    line-height: 1.55;
  }
  .hero__search {
    margin-top: 1rem;
    max-width: 100%;
  }
  .hero__ctas {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 0.6rem;
    margin-top: var(--space-4);
  }
  .hero__ctas > * {
    width: 100%;
    justify-content: center;
  }
  .hero__logo-box {
    padding: 1rem;
    max-height: 180px;
  }
  .hero__logo-box img {
    max-height: 150px;
  }
}

@media (max-width: 440px) {
  .hero__search-bar {
    height: 44px;
    padding-inline-start: 0.65rem;
  }
  .hero__search-btn {
    height: 34px;
    padding: 0 0.85rem;
    font-size: 12px;
  }
}


/* Institutional Quote Modal Styles */
.quote-modal-desc {
  font-size: var(--step-0);
  color: var(--wl-muted);
  line-height: 1.5;
  margin: 0 0 var(--space-4);
}

.modal-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: var(--space-3);
}

.modal-lbl {
  font-size: var(--step--1);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--wl-ink-soft);
  text-align: start;
}

.modal-inp,
.modal-sel,
.modal-txt {
  width: 100%;
  background: var(--wl-surface-soft);
  border: 1.5px solid var(--wl-border);
  border-radius: var(--radius-md);
  color: var(--fg-heading);
  font-size: var(--step-0);
  padding: 0.65rem 0.85rem;
  outline: none;
  transition: all 0.18s ease;
  text-align: start;
}

.modal-inp:focus,
.modal-sel:focus,
.modal-txt:focus {
  background: var(--wl-surface);
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.modal-txt {
  resize: vertical;
  min-height: 80px;
}

.modal-oem-callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--wl-primary-soft);
  border: 1px dashed rgba(105, 169, 255, 0.3);
  border-radius: var(--radius-md);
  padding: 0.6rem 0.85rem;
  font-size: var(--step--1);
  margin-bottom: var(--space-4);
  gap: 0.5rem;
  flex-wrap: wrap;
}

.oem-callout-link {
  color: var(--wl-primary);
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.modal-actions-row {
  display: flex;
  gap: var(--space-3);
  margin-top: 0.5rem;
}

.quote-modal-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-6) var(--space-2);
}

.success-head {
  font-size: var(--step-2);
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0 0 var(--space-2);
}

.success-body {
  font-size: var(--step-0);
  color: var(--wl-ink-soft);
  line-height: 1.55;
  max-width: 440px;
  margin: 0 auto var(--space-4);
}

.ref-ticket-box {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: 0.5rem 1rem;
  margin-bottom: var(--space-6);
}

.ref-label {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.ref-code {
  font-size: var(--step-0);
  font-weight: 800;
  color: var(--wl-primary);
  letter-spacing: 0.05em;
}

.modal-success-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  max-width: 320px;
}

.btn-link-oem {
  background: transparent;
  border: none;
  color: var(--wl-primary);
  font-size: var(--step--1);
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.4rem;
}

.btn-link-oem:hover {
  text-decoration: underline;
}

.btn-link-oem:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-link-oem:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.btn-link-oem:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.btn-link-oem[aria-busy="true"] {
  pointer-events: none;
}

@media (max-width: 580px) {
  .modal-2col {
    grid-template-columns: 1fr;
    gap: 0;
  }
}

.about-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: var(--space-8);
  align-items: center;
}

.about-content {
  display: flex;
  flex-direction: column;
}

.about-body {
  color: var(--fg-body);
  line-height: 1.75;
  font-size: var(--step-0);
  margin: var(--space-3) 0 0;
  white-space: pre-wrap;
}

.about-ctas {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: var(--space-6);
}

.about-media {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--wl-border);
  background: var(--bg-surface);
}

.about-media__img {
  width: 85%;
  max-width: 600px;
  height: auto;
  min-height: 180px;
  object-fit: contain;
  display: block;
  margin: 0 auto;
}

@media (max-width: 960px) {
  .about-grid {
    grid-template-columns: 1fr;
    gap: var(--space-6);
    justify-items: center;
  }

  .about-content {
    align-items: center;
    text-align: center;
  }

  .about-content .section__eyebrow {
    text-align: center;
    margin-inline: auto;
  }

  .about-content .section-title {
    text-align: center;
  }

  .about-body {
    text-align: center;
    max-width: 640px;
    margin-inline: auto;
  }

  .about-ctas {
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  .about-media {
    max-width: 480px;
    width: 100%;
    margin-inline: auto;
  }
}

@media (max-width: 480px) {
  .about-ctas .btn {
    width: 100%;
    justify-content: center;
  }
}

/* 2026 platform landing treatment */
.home {
  background: var(--platform-mist);
  color: var(--platform-ink);
}
.home .hero {
  min-height: min(700px, 76vh);
  background: linear-gradient(118deg, var(--fg-heading) 0%, var(--fg-body) 52%, var(--brand-hover) 100%) !important;
  border: 0;
  border-radius: 0 0 2rem 2rem;
  color: white;
}
.home .hero::before {
  background: radial-gradient(circle at 78% 24%, rgba(56, 189, 248, .22), transparent 20rem), linear-gradient(135deg, transparent 0 55%, rgba(255,255,255,.06) 55% 56%, transparent 56%);
  opacity: 1;
}
.home .hero::after { height: 4px; background: linear-gradient(90deg, var(--brand), var(--accent)); opacity: 1; }
.home .hero__inner { max-width: 1320px; min-height: min(700px, 76vh); grid-template-columns: minmax(0, 1.05fr) minmax(360px, .8fr); gap: clamp(2rem, 6vw, 7rem); padding-block: clamp(3.5rem, 8vw, 7rem); }
.home .hero__copy { position: relative; z-index: 1; }
.home .hero h1 { max-width: 760px; margin-top: .45rem; font-size: clamp(2.65rem, 5.8vw, 5.7rem); line-height: .98; letter-spacing: -.065em; text-shadow: 0 2px 28px rgba(7,21,38,.60); }
/* Headline colors (white base + cyan accent) live in the single source-of-truth block above. */
.home .hero p { max-width: 620px; font-size: clamp(1rem, 1.4vw, 1.2rem); line-height: 1.75; letter-spacing: .006em; }
.home .hero__search { max-width: 610px; }
.home .hero__search-bar { height: 58px; padding-inline-start: 1rem; border: 1px solid rgba(200,220,240,.32); background: rgba(255,255,255,.10); backdrop-filter: blur(8px); box-shadow: 0 8px 32px rgba(7,21,38,.28); transition: background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease; }
.home .hero__search-bar input { color: var(--bg-hover); caret-color: var(--accent); font-size: 1rem; transition: color 180ms ease; }
.home .hero__search-bar input::placeholder { color: rgba(200,220,240,.62); opacity: 1; transition: color 180ms ease, opacity 180ms ease, transform 180ms ease; }
.home .hero__search-bar:focus-within { background: rgba(255,255,255,.97); border-color: var(--accent); box-shadow: 0 0 0 4px rgba(2,132,199,.22), 0 12px 36px rgba(7,21,38,.30); }
.home .hero__search-bar input:focus,
.home .hero__search-bar input:focus-visible { color: var(--fg-heading); caret-color: var(--brand); background: transparent; border-color: transparent; box-shadow: none; outline: 0; }
.home .hero__search-bar input:focus::placeholder { color: var(--fg-subtle); opacity: .72; transform: translateX(6px); animation: hero-placeholder-pulse 1.35s ease-in-out infinite alternate; }
@keyframes hero-placeholder-pulse { from { opacity: .42; letter-spacing: 0; } to { opacity: .86; letter-spacing: .018em; } }
.home .hero__search-btn { height: 46px; border-radius: 999px; background: linear-gradient(135deg, var(--brand), var(--accent)); color: var(--fg-on-brand); font-weight: 700; letter-spacing: .02em; box-shadow: 0 4px 14px rgba(2,132,199,.40); transition: box-shadow .15s ease, transform .12s ease; }
.home .hero__search-btn:hover { box-shadow: 0 6px 22px rgba(2,132,199,.58); transform: translateY(-1px); }
.home .hero__ctas .btn-primary { background: rgba(255,255,255,.95); color: var(--fg-heading); border-color: transparent; border-radius: 999px; padding-inline: 1.4rem; font-weight: 700; box-shadow: 0 4px 14px rgba(7,21,38,.22); transition: background .15s ease, box-shadow .15s ease, transform .12s ease; }
.home .hero__ctas .btn-primary:hover { background: var(--bg-surface); box-shadow: 0 6px 22px rgba(7,21,38,.32); transform: translateY(-1px); }
.home .hero__ctas .btn-secondary { background: rgba(255,255,255,.10); color: var(--bg-hover); border-color: rgba(200,220,240,.40); border-radius: 999px; padding-inline: 1.4rem; backdrop-filter: blur(6px); font-weight: 600; transition: background .15s ease, border-color .15s ease; }
.home .hero__ctas .btn-secondary:hover { background: rgba(255,255,255,.18); border-color: rgba(200,220,240,.65); }
.home .hero__logo-box { min-height: 360px; border: 1px solid rgba(200,220,240,.18); border-radius: 1.5rem; background: rgba(255,255,255,.08); backdrop-filter: blur(14px); box-shadow: 0 24px 70px rgba(7,21,38,.38), inset 0 1px 0 rgba(255,255,255,.12); transform: rotate(2deg); }
.home .hero__logo-box::before { background: linear-gradient(90deg, var(--brand), var(--accent)); height: 4px; }
.home .hero__logo-box img { border-radius: 1rem; mix-blend-mode: screen; opacity: .94; }
.home .section { padding-block: clamp(4rem, 8vw, 8rem); }

/* Alternating Section Background Mechanism:
   1. Hero: Hero background (dark teal gradient)
   2. Most Selling: Pure White (var(--bg-surface))
   3. Providers: Hero background (dark teal gradient)
   4. Clinical Specialty: Pure White (var(--bg-surface))
   5. Certifications: Hero background (dark teal gradient)
   6. About: Pure White (var(--bg-surface))
*/
.home .section--most-selling {
  background: var(--bg-surface) !important;
  border-bottom: 1px solid var(--bg-subtle);
}
.home .section--most-selling .section-title {
  color: var(--platform-ink);
}
.home .section--most-selling .section-desc {
  color: var(--platform-ink-soft);
}
.home .section--most-selling .section__eyebrow {
  color: var(--platform-teal) !important;
}

.home .section--providers {
  background: linear-gradient(118deg, var(--fg-heading) 0%, var(--fg-body) 52%, var(--brand-hover) 100%) !important;
  border: 0;
  color: white;
}
.home .section--providers .section-title {
  color: var(--bg-surface) !important;
}
.home .section--providers .section-desc {
  color: rgba(247, 255, 254, 0.85) !important;
}
.home .section--providers .section__eyebrow {
  color: var(--platform-lime) !important;
}
.home .section--providers .view-all-btn {
  color: var(--bg-surface) !important;
  border-color: rgba(255, 255, 255, 0.28) !important;
  background: rgba(255, 255, 255, 0.1) !important;
}
.home .section--providers .view-all-btn:hover {
  background: rgba(255, 255, 255, 0.2) !important;
}

.home .section--certs {
  background: linear-gradient(118deg, var(--fg-heading) 0%, var(--fg-body) 52%, var(--brand-hover) 100%) !important;
  border: 0;
  color: white;
}
.home .section--certs .section-title {
  color: var(--bg-surface) !important;
}
.home .section--certs .section-desc {
  color: rgba(247, 255, 254, 0.85) !important;
}
.home .section--certs .section__eyebrow {
  color: var(--platform-lime) !important;
}
.home .section--certs .view-all-btn {
  color: var(--bg-surface) !important;
  border-color: rgba(255, 255, 255, 0.28) !important;
  background: rgba(255, 255, 255, 0.1) !important;
}
.home .section--certs .view-all-btn:hover {
  background: rgba(255, 255, 255, 0.2) !important;
}

.home .section--about {
  background: var(--bg-surface) !important;
  border-top: 1px solid var(--bg-subtle);
}
.home .section-head { align-items: end; margin-bottom: 1rem; }
.home .section__eyebrow { color: var(--platform-teal) !important; font-weight: 800; letter-spacing: .14em; }
.home .section-title { max-width: 700px; color: var(--platform-ink); font-size: clamp(2rem, 4vw, 3.6rem); letter-spacing: -.055em; line-height: 1.04; }
.home .section-desc { max-width: 680px; color: var(--platform-ink-soft); font-size: 1.05rem; }
.home .provider-tile, .home .home-cert-card { border: 1px solid var(--platform-border); border-radius: 1.1rem; box-shadow: 0 8px 26px rgba(9,47,67,.06); background: var(--bg-surface); }
.home .provider-tile:hover, .home .home-cert-card:hover { border-color: rgba(12,99,184,.45); box-shadow: var(--platform-shadow); transform: translateY(-4px); }
.home .about-grid { border-radius: 1.5rem; padding: clamp(2rem, 5vw, 5rem); background: var(--platform-aqua); }
.home .about-content .section-title { max-width: 620px; }
.home .about-media { border-radius: 1rem; overflow: hidden; box-shadow: var(--platform-shadow); background: white; }
.home .about-media__img { mix-blend-mode: multiply; }

.home .provider-tile__logo {
  height: 142px;
  min-height: 142px;
  width: 100%;
  min-width: 0;
  padding: 1rem;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, var(--platform-aqua), var(--bg-surface));
}
.home .provider-tile__logo :deep(.app-image-placeholder) {
  inset: 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.home .provider-tile__logo :deep(.placeholder-icon-badge) {
  width: 52px;
  height: 52px;
  flex: 0 0 52px;
}
.home .provider-tile__logo :deep(.placeholder-icon) { font-size: 26px; }
.home .provider-tile__logo :deep(.placeholder-text) { display: none; }

@media (prefers-reduced-motion: reduce) {
  .home .hero__search-bar input:focus::placeholder { animation: none; }
}

/* Browse by category + browse by clinical specialty: white background, contained, balanced margins/paddings */
.home .section--category,
.home .section--clinical,
.home section[aria-labelledby="cat-heading"] {
  background: var(--bg-surface);
  border-top: 1px solid var(--bg-subtle);
  border-bottom: 1px solid var(--bg-subtle);
  padding-block: clamp(3.5rem, 6vw, 5.5rem);
}
.home .section--category .section__inner,
.home .section--clinical .section__inner,
.home section[aria-labelledby="cat-heading"] .section__inner {
  max-width: 1320px;
  margin-inline: auto;
  padding-inline: clamp(1rem, 4vw, 2.75rem);
}
.home .section--category .section-head,
.home .section--clinical .section-head,
.home section[aria-labelledby="cat-heading"] .section-head {
  margin-bottom: clamp(1.5rem, 3.5vw, 2.25rem);
}
.home .section--category .section__eyebrow,
.home .section--clinical .section__eyebrow,
.home section[aria-labelledby="cat-heading"] .section__eyebrow {
  color: var(--platform-teal) !important;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.home .section--category .section-title,
.home .section--clinical .section-title,
.home section[aria-labelledby="cat-heading"] .section-title {
  color: var(--platform-ink);
  font-size: clamp(1.85rem, 3.8vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1.15;
}
.home .section--category .cat-grid,
.home .section--clinical .cat-grid,
.home section[aria-labelledby="cat-heading"] .cat-grid {
  margin-inline: 0;
  gap: clamp(0.85rem, 2vw, 1.25rem);
}

@media (max-width: 760px) {
  .home .hero, .home .hero__inner { min-height: auto; }
  .home .hero__inner { grid-template-columns: 1fr; gap: 2.5rem; }
  .home .hero__logo-box { min-height: 230px; max-width: 520px; transform: rotate(0); }
  .home .hero h1 { font-size: clamp(2.7rem, 13vw, 4.4rem); }
}
</style>




