<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { services } from '../../di/container'
import type { ProductDto, CategoryDto } from '../../domain/models/marketplace'
import { useCart } from '../../composables/useCart'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { formatPrice } from '../../utils/format'
import DataState from '../../components/ui/DataState.vue'
import AppImage from '../../components/ui/AppImage.vue'
import AppPagination from '../../components/ui/AppPagination.vue'

const router = useRouter()
const { add: addToCart } = useCart()
const marketplaceService = services.marketplaceService

const rawProducts = ref<ProductDto[]>([])
const categories = ref<CategoryDto[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// Filters
const search = ref('')
const selectedCategory = ref<string>('all')
const selectedMaterial = ref<string>('all')
const inStockOnly = ref(false)
const sortBy = ref<'rank' | 'priceAsc' | 'priceDesc' | 'nameAsc'>('rank')
const viewMode = ref<'grid' | 'list'>('grid')

// Pagination
const page = ref(1)
const pageSize = ref(12)

const localized = (en?: string | null, ar?: string | null) => {
  if (locale.value === 'ar') return ar || en || ''
  return en || ar || ''
}

const loadData = async () => {
  loading.value = true
  error.value = null
  // Never render a previous visit's cache while (or if) this load fails.
  rawProducts.value = []
  marketplaceService.mostSelling.value = []
  try {
    const [productsRes, cats] = await Promise.allSettled([
      marketplaceService.loadMostSelling(48),
      marketplaceService.getCategories(),
    ])
    if (productsRes.status === 'rejected') throw productsRes.reason
    rawProducts.value = marketplaceService.mostSelling.value || []
    if (cats.status === 'fulfilled') {
      categories.value = cats.value || []
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadData()
})

const materials = computed(() => {
  const set = new Set<string>()
  for (const p of rawProducts.value) {
    if (p.material?.trim()) {
      set.add(p.material.trim())
    }
  }
  return Array.from(set).sort()
})

// Original rank map according to sales quantity returned from API
const rankMap = computed(() => {
  const map = new Map<string, number>()
  rawProducts.value.forEach((p, idx) => {
    map.set(p.id, idx + 1)
  })
  return map
})

const filteredProducts = computed(() => {
  let list = [...rawProducts.value]

  // Search filter
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter((p) => {
      const nameEn = (p.nameEn || '').toLowerCase()
      const nameAr = (p.nameAr || '').toLowerCase()
      const sku = (p.sku || '').toLowerCase()
      const mat = (p.material || '').toLowerCase()
      const cat = (p.categoryNameEn || '').toLowerCase()
      return (
        nameEn.includes(q) ||
        nameAr.includes(q) ||
        sku.includes(q) ||
        mat.includes(q) ||
        cat.includes(q)
      )
    })
  }

  // Category filter
  if (selectedCategory.value !== 'all') {
    list = list.filter(
      (p) =>
        p.categoryId === selectedCategory.value ||
        p.categoryNameEn === selectedCategory.value ||
        p.categoryNameAr === selectedCategory.value,
    )
  }

  // Material filter
  if (selectedMaterial.value !== 'all') {
    list = list.filter((p) => p.material === selectedMaterial.value)
  }

  // In Stock filter
  if (inStockOnly.value) {
    list = list.filter((p) => p.stock > 0)
  }

  // Sorting
  list.sort((a, b) => {
    if (sortBy.value === 'rank') {
      const rankA = rankMap.value.get(a.id) ?? 9999
      const rankB = rankMap.value.get(b.id) ?? 9999
      return rankA - rankB
    }
    if (sortBy.value === 'priceAsc') {
      return a.price - b.price
    }
    if (sortBy.value === 'priceDesc') {
      return b.price - a.price
    }
    if (sortBy.value === 'nameAsc') {
      return localized(a.nameEn, a.nameAr).localeCompare(localized(b.nameEn, b.nameAr))
    }
    return 0
  })

  return list
})

const totalCount = computed(() => filteredProducts.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))

const paginatedProducts = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredProducts.value.slice(start, start + pageSize.value)
})

watch([search, selectedCategory, selectedMaterial, inStockOnly, sortBy], () => {
  page.value = 1
})

const clearAllFilters = () => {
  search.value = ''
  selectedCategory.value = 'all'
  selectedMaterial.value = 'all'
  inStockOnly.value = false
  sortBy.value = 'rank'
  page.value = 1
}

const handleAddToQuote = (p: ProductDto) => {
  addToCart(p, 1)
  toastService.success(
    t('catalog.quoteSuccess', { product: localized(p.nameEn, p.nameAr) }),
  )
}

const goToProduct = (id: string) => {
  void router.push({ name: 'marketplace-product', params: { id } })
}
</script>

<template>
  <div class="most-selling-page">
    <!-- Breadcrumb & Page Header -->
    <header class="page-header">
      <div class="container-app">
        <nav class="breadcrumb-nav mono" :aria-label="t('common.breadcrumb')">
          <router-link to="/" class="breadcrumb-link">{{ t('nav.home') }}</router-link>
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-current">{{ t('mostSellingPage.breadcrumb') }}</span>
        </nav>

        <div class="header-hero">
          <div class="header-content anim-fade-in-up">
            <span class="badge-eyebrow mono">{{ t('mostSellingPage.eyebrow') }}</span>
            <h1 class="page-title">{{ t('mostSellingPage.title') }}</h1>
            <p class="page-subtitle">{{ t('mostSellingPage.subtitle') }}</p>
          </div>

          <!-- Trust Badges Bar -->
          <div class="header-highlights">
            <div class="highlight-item">
              <span class="material-symbols-outlined highlight-icon">verified</span>
              <div>
                <strong class="highlight-title">{{ t('mostSellingPage.featureSteel') }}</strong>
                <p class="highlight-desc">{{ t('mostSellingPage.featureSteelDesc') }}</p>
              </div>
            </div>
            <div class="highlight-item">
              <span class="material-symbols-outlined highlight-icon">request_quote</span>
              <div>
                <strong class="highlight-title">{{ t('mostSellingPage.featureDiscount') }}</strong>
                <p class="highlight-desc">{{ t('mostSellingPage.featureDiscountDesc') }}</p>
              </div>
            </div>
            <div class="highlight-item">
              <span class="material-symbols-outlined highlight-icon">sanitizer</span>
              <div>
                <strong class="highlight-title">{{ t('mostSellingPage.featureCompliance') }}</strong>
                <p class="highlight-desc">{{ t('mostSellingPage.featureComplianceDesc') }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <section class="page-body" :aria-label="t('mostSellingPage.title')">
      <div class="container-app">
        <!-- Filter Controls Toolbar -->
        <section v-reveal class="toolbar-card" :aria-label="t('catalog.filters')">
          <div class="toolbar-main">
            <!-- Search bar -->
            <div class="search-wrap">
              <span class="material-symbols-outlined search-icon">search</span>
              <input
                v-model="search"
                type="text"
                class="search-input"
                :placeholder="t('mostSellingPage.searchPlaceholder')"
              />
              <button
                v-if="search"
                type="button"
                class="clear-search-btn"
                :aria-label="t('common.clearInput')"
                @click="search = ''"
              >
                <span class="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <!-- Category selector -->
            <div class="select-wrap">
              <select v-model="selectedCategory" class="toolbar-select" :aria-label="t('catalog.categories')">
                <option value="all">{{ t('mostSellingPage.allCategories') }}</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ localized(cat.nameEn, cat.nameAr) }}
                </option>
              </select>
            </div>

            <!-- Material selector -->
            <div v-if="materials.length" class="select-wrap">
              <select v-model="selectedMaterial" class="toolbar-select" :aria-label="t('catalog.material')">
                <option value="all">{{ t('mostSellingPage.allMaterials') }}</option>
                <option v-for="mat in materials" :key="mat" :value="mat">
                  {{ mat }}
                </option>
              </select>
            </div>

            <!-- In-stock toggle -->
            <label class="toggle-pill">
              <input v-model="inStockOnly" type="checkbox" class="toggle-checkbox" />
              <span class="toggle-label">{{ t('mostSellingPage.inStockOnly') }}</span>
            </label>

            <!-- Sort By dropdown -->
            <div class="select-wrap sort-select-wrap">
              <label class="sort-label mono" for="most-selling-sort">{{ t('mostSellingPage.sortBy') }}:</label>
              <select id="most-selling-sort" v-model="sortBy" class="toolbar-select">
                <option value="rank">{{ t('mostSellingPage.sortRank') }}</option>
                <option value="priceAsc">{{ t('mostSellingPage.sortPriceAsc') }}</option>
                <option value="priceDesc">{{ t('mostSellingPage.sortPriceDesc') }}</option>
                <option value="nameAsc">{{ t('mostSellingPage.sortNameAsc') }}</option>
              </select>
            </div>

            <!-- View Mode Switcher -->
            <div class="view-mode-toggle" role="group" aria-label="{{ t('common.viewMode') }}">
              <button
                type="button"
                class="view-toggle-btn"
                :class="{ 'is-active': viewMode === 'grid' }"
                title="{{ t('common.viewGrid') }}"
                aria-label="{{ t('common.viewGrid') }}"
                @click="viewMode = 'grid'"
              >
                <span class="material-symbols-outlined text-[18px]">grid_view</span>
              </button>
              <button
                type="button"
                class="view-toggle-btn"
                :class="{ 'is-active': viewMode === 'list' }"
                title="{{ t('common.viewList') }}"
                aria-label="{{ t('common.viewList') }}"
                @click="viewMode = 'list'"
              >
                <span class="material-symbols-outlined text-[18px]">view_list</span>
              </button>
            </div>
          </div>

          <!-- Active Filter Chips -->
          <div
            v-if="search || selectedCategory !== 'all' || selectedMaterial !== 'all' || inStockOnly"
            class="active-chips"
          >
            <span class="mono text-xs text-muted">{{ t('catalog.filters') }}:</span>

            <button v-if="search" type="button" class="filter-chip mono interactive-lift" @click="search = ''">
              <span>"{{ search }}"</span>
              <span class="material-symbols-outlined text-[13px]">close</span>
            </button>

            <button
              v-if="selectedCategory !== 'all'"
              type="button"
              class="filter-chip mono interactive-lift"
              @click="selectedCategory = 'all'"
            >
              <span>{{ localized(categories.find((c) => c.id === selectedCategory)?.nameEn, categories.find((c) => c.id === selectedCategory)?.nameAr) }}</span>
              <span class="material-symbols-outlined text-[13px]">close</span>
            </button>

            <button
              v-if="selectedMaterial !== 'all'"
              type="button"
              class="filter-chip mono interactive-lift"
              @click="selectedMaterial = 'all'"
            >
              <span>{{ selectedMaterial }}</span>
              <span class="material-symbols-outlined text-[13px]">close</span>
            </button>

            <button
              v-if="inStockOnly"
              type="button"
              class="filter-chip mono interactive-lift"
              @click="inStockOnly = false"
            >
              <span>{{ t('catalog.inStock') }}</span>
              <span class="material-symbols-outlined text-[13px]">close</span>
            </button>

            <button type="button" class="clear-all-link mono" @click="clearAllFilters">
              {{ t('mostSellingPage.clearFilters') }}
            </button>
          </div>
        </section>

        <!-- Product Count Indicator -->
        <div class="results-header">
          <span class="mono results-count">
            {{ t('mostSellingPage.totalCount', { count: totalCount }) }}
          </span>
        </div>

        <!-- Products Grid / DataState -->
        <DataState
          :loading="loading && !rawProducts.length"
          :empty="!paginatedProducts.length && !loading"
          :error="error"
          :error-title="t('common.loadFailed')"
          :error-message="error ?? t('common.loadFailed')"
          :retry-text="t('common.retry')"
          skeleton-type="product-card"
          :skeleton-count="8"
          min-height="350px"
          :title="t('mostSellingPage.noProducts')"
          :description="t('mostSellingPage.noProductsDesc')"
          :action-text="t('mostSellingPage.clearFilters')"
          icon="sentiment_dissatisfied"
          @action="clearAllFilters"
          @retry="loadData"
        >
          <!-- Grid Display -->
          <div v-if="viewMode === 'grid'" class="product-grid">
            <article
              v-for="(p, i) in paginatedProducts"
              :key="p.id"
              v-reveal="i"
              class="product-card anim-card-hover"
              @click="goToProduct(p.id)"
            >
              <!-- Media Wrap -->
              <div class="product-card__media">
                <AppImage
                  :src="p.imageName"
                  placeholder-type="product"
                  :alt="localized(p.nameEn, p.nameAr)"
                  fit="cover"
                  class="product-card__img"
                />

                <!-- Rank Badge -->
                <div
                  class="rank-badge"
                  :class="{
                    'rank-badge--1': (rankMap.get(p.id) || 99) === 1,
                    'rank-badge--2': (rankMap.get(p.id) || 99) === 2,
                    'rank-badge--3': (rankMap.get(p.id) || 99) === 3,
                  }"
                >
                  <span class="material-symbols-outlined text-[13px]">award_star</span>
                  <span>{{ t('mostSellingPage.badgeRank', { rank: rankMap.get(p.id) || '-' }) }}</span>
                </div>

                <!-- Stock Pill -->
                <span
                  v-if="p.stock > 0"
                  class="mono stock-pill stock-pill--in"
                >
                  {{ t('catalog.inStock') }}
                </span>
                <span
                  v-else
                  class="mono stock-pill stock-pill--out"
                >
                  {{ t('catalog.madeToOrder') }}
                </span>
              </div>

              <!-- Card Body -->
              <div class="product-card__body">
                <div class="card-meta-top">
                  <span class="mono card-category" dir="auto">
                    {{ localized(p.categoryNameEn, p.categoryNameAr) }}
                  </span>
                  <span v-if="p.sku" class="mono card-sku">
                    {{ p.sku }}
                  </span>
                </div>

                <h2 class="card-title" dir="auto">
                  <router-link class="card-title-link" :to="{ name: 'marketplace-product', params: { id: p.id } }" @click.stop>
                    {{ localized(p.nameEn, p.nameAr) }}
                  </router-link>
                </h2>

                <div class="mono card-alt-name" dir="auto">
                  {{ locale === 'en' ? p.nameAr : p.nameEn }}
                </div>

                <!-- Spec Tags -->
                <div class="card-specs mono">
                  <span v-if="p.material" class="spec-tag">{{ p.material }}</span>
                  <span v-if="p.lengthCm" class="spec-tag">{{ p.lengthCm }} cm</span>
                  <span v-if="p.isActive" class="spec-tag">{{ t('catalog.ceMarked') }}</span>
                </div>

                <div class="card-provider mono">
                  {{ p.companyName || p.manufacturerEn || 'SNUL' }}
                </div>

                <!-- Footer with Price & White Add to Quote Button -->
                <div class="product-card__foot">
                  <div class="price-wrap">
                    <span class="price-amount mono-num">{{ formatPrice(p.price, locale) }}</span>
                    <span class="price-currency mono">{{ p.currencySymbol || '$' }}</span>
                  </div>

                  <button
                    class="btn-quote-white"
                    type="button"
                    :title="t('marketplace.addToQuote')"
                    @click.stop="handleAddToQuote(p)"
                  >
                    <span class="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                    <span class="quote-btn-text">{{ t('marketplace.addToQuote') }}</span>
                  </button>
                </div>
              </div>
            </article>
          </div>

          <!-- List / Table Display -->
          <div v-else class="table-card catalog-list-card">
            <div class="table-wrap">
              <table class="exec-table">
                <thead>
                  <tr>
                    <th class="w-16 text-center">#</th>
                    <th>{{ t('admin.products') }}</th>
                    <th>{{ t('nav.categories') }}</th>
                    <th>{{ t('catalog.availability') }}</th>
                    <th>{{ t('admin.price') }}</th>
                    <th class="text-end">{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="p in paginatedProducts"
                    :key="p.id"
                    class="exec-row cursor-pointer"
                    @click="goToProduct(p.id)"
                  >
                    <td class="text-center">
                      <span
                        class="rank-badge rank-badge--inline"
                        :class="{
                          'rank-badge--1': (rankMap.get(p.id) || 99) === 1,
                          'rank-badge--2': (rankMap.get(p.id) || 99) === 2,
                          'rank-badge--3': (rankMap.get(p.id) || 99) === 3,
                        }"
                      >
                        #{{ rankMap.get(p.id) || '-' }}
                      </span>
                    </td>
                    <td>
                      <div class="exec-row__media">
                        <div class="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex-shrink-0">
                          <AppImage
                            :src="p.imageName"
                            placeholder-type="product"
                            :alt="localized(p.nameEn, p.nameAr)"
                            fit="cover"
                            class="w-full h-full object-cover"
                          />
                        </div>
                        <div class="exec-row__meta">
                          <router-link class="exec-row__name" :to="{ name: 'marketplace-product', params: { id: p.id } }" @click.stop>
                            {{ localized(p.nameEn, p.nameAr) }}
                          </router-link>
                          <div class="text-xs text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                            <span v-if="p.sku">{{ t('marketplace.sku') }}: {{ p.sku }}</span>
                            <span v-if="p.material">· {{ p.material }}</span>
                            <span v-if="p.lengthCm">· {{ p.lengthCm }} cm</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="text-xs font-mono text-slate-600 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {{ localized(p.categoryNameEn || '', p.categoryNameAr || '') }}
                      </span>
                    </td>
                    <td>
                      <div class="stock-cell">
                        <span v-if="p.stock > 0" class="stock-pill stock-pill--in mono">{{ t('catalog.inStock') }}</span>
                        <span v-else class="stock-pill stock-pill--out mono">{{ t('catalog.madeToOrder') }}</span>
                      </div>
                    </td>
                    <td>
                      <strong class="mono text-sm font-bold text-slate-900">
                        {{ formatPrice(p.price, locale) }} {{ p.currencySymbol || '$' }}
                      </strong>
                    </td>
                    <td class="text-end">
                      <div class="flex items-center justify-end gap-2" @click.stop>
                        <button
                          class="btn-quote-white"
                          type="button"
                          :title="t('marketplace.addToQuote')"
                          @click="handleAddToQuote(p)"
                        >
                          <span class="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                          <span class="quote-btn-text">{{ t('marketplace.addToQuote') }}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="pagination-wrap">
            <AppPagination
              :page="page"
              :total-pages="totalPages"
              :total-items="totalCount"
              :page-size="pageSize"
              @change="page = $event"
            />
          </div>
        </DataState>
      </div>
    </section>
  </div>
</template>

<style scoped>
.most-selling-page {
  background: var(--bg-app);
  min-height: 100vh;
  padding-bottom: 4rem;
}

.container-app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.25rem;
}

/* Page Header */
.page-header {
  background: linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-app) 100%);
  border-bottom: 1px solid var(--border);
  padding: 1.5rem 0 2.5rem;
}

.breadcrumb-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--fg-muted);
  margin-bottom: 1.25rem;
}

.breadcrumb-link {
  color: var(--fg-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.breadcrumb-link:hover {
  color: var(--brand);
}

.breadcrumb-sep {
  color: var(--border-strong);
}

.breadcrumb-current {
  color: var(--fg-heading);
  font-weight: 600;
}

.header-hero {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 992px) {
  .header-hero {
    grid-template-columns: 1.2fr 1fr;
    align-items: center;
  }
}

.badge-eyebrow {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--brand);
  background: var(--color-primary-100);
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  margin-bottom: 0.75rem;
}

.page-title {
  font-size: 2.25rem;
  font-weight: 800;
  line-height: 1.2;
  color: var(--fg-heading);
  letter-spacing: -0.025em;
  margin-bottom: 0.75rem;
}

.page-subtitle {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--fg-body);
  max-width: 640px;
}

/* Highlights */
.header-highlights {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.highlight-item {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
}

.highlight-icon {
  font-size: 1.35rem;
  color: var(--brand);
  background: var(--color-primary-100);
  padding: 0.35rem;
  border-radius: 8px;
  flex-shrink: 0;
}

.highlight-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--fg-heading);
  display: block;
}

.highlight-desc {
  font-size: 0.8125rem;
  color: var(--fg-muted);
  line-height: 1.4;
  margin: 0;
}

/* Toolbar & Filters */
.toolbar-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin: 2rem 0 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.toolbar-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.875rem;
}

.search-wrap {
  position: relative;
  flex: 1 1 240px;
  min-width: 200px;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--fg-subtle);
  font-size: 1.15rem;
  pointer-events: none;
}

[dir="rtl"] .search-icon {
  left: auto;
  right: 0.75rem;
}

.search-input {
  width: 100%;
  padding: 0.55rem 2rem 0.55rem 2.25rem;
  font-size: 0.875rem;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--bg-surface);
  color: var(--fg-heading);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

[dir="rtl"] .search-input {
  padding: 0.55rem 2.25rem 0.55rem 2rem;
}

.search-input:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(12, 99, 184, 0.12);
}

.clear-search-btn {
  position: absolute;
  right: 0.65rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--fg-muted);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
}

[dir="rtl"] .clear-search-btn {
  right: auto;
  left: 0.65rem;
}

.select-wrap {
  flex: 0 1 auto;
  min-width: 160px;
}

.toolbar-select {
  width: 100%;
  min-height: 36px;
  padding: 0.55rem 0.875rem;
  font-size: 0.875rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-surface);
  color: var(--fg-heading);
  cursor: pointer;
}

.toolbar-select:focus {
  outline: none;
  border-color: var(--brand);
}

.sort-select-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

[dir="rtl"] .sort-select-wrap {
  margin-left: 0;
  margin-right: auto;
}

.sort-label {
  font-size: 0.8125rem;
  color: var(--fg-muted);
  white-space: nowrap;
}

.toggle-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 36px;
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  background: var(--bg-surface);
}

.toggle-checkbox {
  cursor: pointer;
  accent-color: var(--brand);
}

.toggle-label {
  font-size: 0.875rem;
  color: var(--fg-body);
}

/* Active Chips */
.active-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--bg-subtle);
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.55rem;
  font-size: 0.75rem;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--fg-body);
  cursor: pointer;
}

.filter-chip:hover {
  background: var(--border);
}

.clear-all-link {
  font-size: 0.75rem;
  color: var(--brand);
  background: none;
  border: none;
  text-decoration: underline;
  cursor: pointer;
  padding: 0.25rem;
}

/* Results Header */
.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.results-count {
  font-size: 0.8125rem;
  color: var(--fg-muted);
}

/* Products Grid */
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
  gap: 1.25rem;
}

.product-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.product-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
  border-color: var(--border-strong);
}

.product-card__media {
  position: relative;
  height: 220px;
  width: 100%;
  background: var(--bg-app);
  overflow: hidden;
  display: block;
  padding: 0;
  border-bottom: 1px solid var(--bg-subtle);
}

.product-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}

.product-card:hover .product-card__img {
  transform: scale(1.05);
}

/* Rank Badges */
.rank-badge {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  background: var(--fg-heading);
  color: var(--fg-on-brand);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  z-index: 2;
}

[dir="rtl"] .rank-badge {
  left: auto;
  right: 0.75rem;
}

.rank-badge--1 {
  background: linear-gradient(135deg, var(--fg-warning) 0%, var(--fg-warning) 50%, var(--fg-warning) 100%);
  color: var(--fg-on-brand);
  box-shadow: 0 2px 8px rgba(217, 119, 6, 0.35);
}

.rank-badge--2 {
  background: linear-gradient(135deg, var(--fg-body) 0%, var(--fg-muted) 50%, var(--fg-subtle) 100%);
  color: var(--fg-on-brand);
}

.rank-badge--3 {
  background: linear-gradient(135deg, var(--fg-danger) 0%, var(--fg-danger) 50%, var(--fg-danger) 100%);
  color: var(--fg-on-brand);
}

.stock-pill {
  position: absolute;
  bottom: 0.65rem;
  right: 0.65rem;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

[dir="rtl"] .stock-pill {
  right: auto;
  left: 0.65rem;
}

.stock-pill--in {
  background: var(--accent-soft);
  color: var(--fg-success);
}

.stock-pill--out {
  background: var(--bg-subtle);
  color: var(--fg-body);
}

/* Card Body */
.product-card__body {
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.card-meta-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.card-category {
  font-size: 0.75rem;
  color: var(--brand);
  font-weight: 600;
  text-transform: uppercase;
}

.card-sku {
  font-size: 0.6875rem;
  color: var(--fg-subtle);
}

.card-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--fg-heading);
  line-height: 1.35;
  margin-bottom: 0.25rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-title-link {
  color: inherit;
  text-decoration: none;
  border-radius: var(--radius-xs);
}

.card-title-link:hover {
  color: var(--brand);
}

.card-title-link:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 3px;
}

.card-alt-name {
  font-size: 0.75rem;
  color: var(--fg-muted);
  margin-bottom: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-specs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}

.spec-tag {
  font-size: 0.6875rem;
  background: var(--bg-app);
  border: 1px solid var(--border);
  color: var(--fg-body);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.card-provider {
  font-size: 0.75rem;
  color: var(--fg-subtle);
  margin-bottom: 1rem;
  margin-top: auto;
}

/* Card Foot */
.product-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--bg-subtle);
}

.price-wrap {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.price-amount {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--fg-heading);
}

.price-currency {
  font-size: 0.75rem;
  color: var(--fg-muted);
}

/* White Add to Quote Button */
.btn-quote-white {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  background: var(--brand);
  border: 1px solid var(--brand);
  color: var(--fg-on-brand) !important;
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.5rem 0.85rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-quote-white * {
  color: var(--fg-on-brand) !important;
  fill: var(--fg-on-brand) !important;
}

.btn-quote-white:hover {
  background: var(--brand-hover);
  border-color: var(--brand-hover);
  color: var(--fg-on-brand) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(12, 99, 184, 0.25);
}

.btn-quote-white:active {
  transform: translateY(0);
}

/* Pagination */
.pagination-wrap {
  margin-top: 2.5rem;
  display: flex;
  justify-content: center;
}

@media (max-width: 768px) {
  .page-title {
    font-size: 1.75rem;
  }
  .toolbar-main {
    flex-direction: column;
    align-items: stretch;
  }
  .sort-select-wrap {
    margin-left: 0;
    width: 100%;
  }
}

.view-mode-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: var(--color-neutral-100);
  padding: 3px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.view-toggle-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.view-toggle-btn:hover {
  color: var(--fg-heading);
}

.view-toggle-btn.is-active {
  background: var(--bg-surface);
  color: var(--color-primary-600);
  box-shadow: var(--shadow-xs);
}

.catalog-list-card {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

/* List View — mirrors the grid cards: hairline separators, mono headers and
   a scroller so the table never overflows the page on narrow screens. */
.catalog-list-card .table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.exec-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: 0.875rem;
  color: var(--fg-body);
}

.exec-table thead th {
  padding: 0.75rem 1rem;
  text-align: start;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-muted);
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.exec-table tbody td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.exec-row {
  background: var(--bg-surface);
  cursor: pointer;
  transition: background 0.15s ease;
}

.exec-row:hover {
  background: var(--bg-subtle);
}

.exec-row:last-child td {
  border-bottom: none;
}

.exec-row__media {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 220px;
}

.exec-row__meta {
  min-width: 0;
}

.exec-row__name {
  display: block;
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--fg-heading);
  text-decoration: none;
  border-radius: var(--radius-xs);
}

.exec-row__name:hover {
  color: var(--brand);
}

.exec-row__name:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}

/* The stock pill is absolutely positioned, so its cell needs an anchor. */
.stock-cell {
  position: relative;
  min-width: 96px;
  min-height: 24px;
}

.rank-badge--inline {
  position: static !important;
  display: inline-flex !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  padding: 2px 6px !important;
  border-radius: var(--radius-xs) !important;
  font-family: var(--font-mono) !important;
}

/* Touch devices: every control reaches the 44px minimum without bloating
   the desktop density. */
@media (pointer: coarse) {
  .toolbar-select,
  .toggle-pill,
  .search-input,
  .btn-quote-white,
  .filter-chip,
  .clear-all-link {
    min-height: var(--wl-touch-min);
  }

  .view-toggle-btn,
  .clear-search-btn {
    width: var(--wl-touch-min);
    min-width: var(--wl-touch-min);
    height: var(--wl-touch-min);
    min-height: var(--wl-touch-min);
  }
}
</style>
