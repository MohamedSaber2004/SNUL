<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { useMarketplace } from '../../composables/useMarketplace'
import { useCart } from '../../composables/useCart'
import { useWishlist } from '../../composables/useWishlist'
import { toastService } from '../../infrastructure/feedback/toast.service'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import { productMediaUrl } from '../../utils/file-url'
import BackButton from '../../components/ui/BackButton.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { formatPrice } from '../../utils/format'

const route = useRoute()
const router = useRouter()
const {
  products,
  categories,
  loading,
  error,
  totalCount,
  totalPages,
  page,
  search,
  sku,
  categoryId,
  sortBy,
  inStockOnly,
  material,
  lengthMin,
  lengthMax,
  priceMin,
  priceMax,
  availability,
  localized,
  load,
  clearFilters,
  goPage,
} = useMarketplace({
  search: route.query.search ? String(route.query.search) : undefined,
  categoryId: route.query.categoryId ? String(route.query.categoryId) : undefined,
  sortBy: route.query.sortBy ? (String(route.query.sortBy) as 'price-asc' | 'price-desc' | 'newest') : undefined,
})
const { add } = useCart()
const { isSaved, toggleSave, canEditWishlist } = useWishlist()

const handleWishlist = async (id: string) => {
  await toggleSave(id)
}

const showMobileFilters = ref(false)

watch(
  () => route.query.search,
  (v) => {
    if (v !== undefined) search.value = v ? String(v) : ''
  },
)

const handleAdd = (id: string) => {
  const p = products.value.find((x) => x.id === id)
  if (!p) return
  add(p, 1)
  toastService.success(
    t('catalog.quoteSuccess', { product: localized(p.nameEn, p.nameAr) }),
  )
}

const localizedCat = (c: { nameEn: string; nameAr: string }) =>
  locale.value === 'ar' ? c.nameAr : c.nameEn

const hasFilters = computed(() =>
  Boolean(categoryId.value || search.value || sku.value || sortBy.value || inStockOnly.value || material.value || lengthMin.value != null || lengthMax.value != null || priceMin.value != null || priceMax.value != null || availability.value !== 'all'),
)

const activeCategoryName = computed(() => {
  if (!categoryId.value) return t('marketplace.allCategories')
  const found = categories.value.find((c) => c.id === categoryId.value)
  return found ? localizedCat(found) : t('marketplace.allCategories')
})

const availableMaterials = computed(() => {
  const set = new Set<string>()
  for (const p of products.value) if (p.material?.trim()) set.add(p.material.trim())
  if (material.value && !set.has(material.value)) set.add(material.value)
  return Array.from(set).sort()
})
const priceBounds = computed(() => {
  if (!products.value.length) return null
  const prices = products.value.map((p) => p.price).filter((v) => Number.isFinite(v))
  if (!prices.length) return null
  return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) }
})
const lengthBounds = computed(() => {
  const lens = products.value.map((p) => p.lengthCm).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (!lens.length) return null
  return { min: Math.min(...lens), max: Math.max(...lens) }
})
const hasInStock = computed(() => products.value.some((p) => p.stock > 0))

const catSearch = ref('')
const viewMode = ref<'grid' | 'list'>('grid')
const filteredSidebarCategories = computed(() => {
  if (!catSearch.value.trim()) return categories.value
  const q = catSearch.value.trim().toLowerCase()
  return categories.value.filter((c) => {
    const en = (c.nameEn || '').toLowerCase()
    const ar = (c.nameAr || '').toLowerCase()
    return en.includes(q) || ar.includes(q)
  })
})
</script>

<template>
  <div class="page-shell catalog-page">
    <BackButton />
    <div class="catalog-head">
      <div class="catalog-head__info">
        <div class="mono" style="font-size:11px;color:var(--wl-primary);font-weight:700;letter-spacing:0.06em">{{ t('catalog.badge') }}</div>
        <h1>{{ t('marketplace.title') }}</h1>
        <p class="catalog-head__desc">{{ t('marketplace.subtitle') }}</p>
      </div>
      <div v-if="totalCount" class="mono" style="font-size:11px;color:var(--wl-muted)">{{ t('catalog.showing', { count: String(products.length), total: String(totalCount), page: String(page), totalPages: String(totalPages) } as never) }}</div>
    </div>

    <div v-if="categories.length" class="category-pills-bar">
      <button class="cat-pill" :class="{ 'is-active': !categoryId }" @click="categoryId = null">
        {{ t('marketplace.allCategories') }}
      </button>
      <button v-for="c in categories" :key="c.id" class="cat-pill" :class="{ 'is-active': categoryId === c.id }" @click="categoryId = categoryId === c.id ? null : c.id">
        {{ localizedCat(c) }}<span class="pill-badge mono">{{ c.productCount ?? '' }}</span>
      </button>
    </div>
    <div v-else-if="loading" class="category-pills-bar">
      <SkeletonLoader type="pills" :count="7" />
    </div>

    <div class="catalog-toolbar">
      <div class="search-box">
        <span class="material-symbols-outlined search-icon">search</span>
        <input v-model="search" type="search" :placeholder="t('catalog.searchPlaceholder')" class="search-input" />
        <button v-if="search" class="clear-search-btn" type="button" @click="search = ''"><span class="material-symbols-outlined text-[16px]">close</span></button>
      </div>
      <div class="toolbar-controls">
        <div class="sort-select-wrapper">
          <span class="material-symbols-outlined sort-icon">sort</span>
          <select v-model="sortBy" class="sort-select mono">
            <option :value="undefined">{{ t('catalog.sortFeatured') }}</option>
            <option value="newest">{{ t('marketplace.sortNewest') }}</option>
            <option value="price-asc">{{ t('marketplace.sortPriceAsc') }}</option>
            <option value="price-desc">{{ t('marketplace.sortPriceDesc') }}</option>
          </select>
        </div>
        <button type="button" class="mobile-filter-toggle md:hidden" :class="{ 'has-active': hasFilters }" @click="showMobileFilters = !showMobileFilters">
          <span class="material-symbols-outlined text-[18px]">filter_list</span>
          <span>{{ t('catalog.filters') }}</span>
          <span v-if="hasFilters" class="filter-dot" aria-hidden="true"></span>
        </button>
      </div>
    </div>

    <!-- Active Filters Tray -->
    <div v-if="hasFilters" class="active-filters-tray" aria-live="polite">
      <span class="active-filters-label mono">{{ t('catalog.filters') }}:</span>
      
      <button v-if="categoryId" type="button" class="filter-chip mono" @click="categoryId = null">
        <span>{{ activeCategoryName }}</span>
        <span class="material-symbols-outlined text-[13px]">close</span>
      </button>

      <button v-if="search" type="button" class="filter-chip mono" @click="search = ''">
        <span>"{{ search }}"</span>
        <span class="material-symbols-outlined text-[13px]">close</span>
      </button>

      <button v-if="sku" type="button" class="filter-chip mono" @click="sku = ''">
        <span>SKU: {{ sku }}</span>
        <span class="material-symbols-outlined text-[13px]">close</span>
      </button>

      <button v-if="material" type="button" class="filter-chip mono" @click="material = null">
        <span>{{ material }}</span>
        <span class="material-symbols-outlined text-[13px]">close</span>
      </button>

      <button v-if="availability === 'in'" type="button" class="filter-chip mono" @click="availability = 'all'">
        <span>{{ t('catalog.inStock') }}</span>
        <span class="material-symbols-outlined text-[13px]">close</span>
      </button>

      <button v-if="priceMin != null || priceMax != null" type="button" class="filter-chip mono" @click="priceMin = null; priceMax = null">
        <span>${{ priceMin ?? 0 }} – ${{ priceMax ?? '∞' }}</span>
        <span class="material-symbols-outlined text-[13px]">close</span>
      </button>

      <button v-if="lengthMin != null || lengthMax != null" type="button" class="filter-chip mono" @click="lengthMin = null; lengthMax = null">
        <span>{{ lengthMin ?? 0 }} – {{ lengthMax ?? '∞' }} cm</span>
        <span class="material-symbols-outlined text-[13px]">close</span>
      </button>

      <button type="button" class="clear-all-chip mono" @click="clearFilters">
        {{ t('marketplace.clearFilters') }}
      </button>
    </div>

    <div class="catalog-grid-layout">
      <aside class="filter-sidebar" :class="{ 'is-mobile-open': showMobileFilters }">
        <div class="filter-sidebar__header md:hidden">
          <span class="mono font-bold">{{ t('catalog.filterInstruments') }}</span>
          <button type="button" class="close-filters-btn" @click="showMobileFilters = false"><span class="material-symbols-outlined">close</span></button>
        </div>

        <div class="filter-section">
          <div class="filter-heading mono">{{ t('nav.categories') }}</div>
          <div v-if="categories.length > 5" class="category-search-wrap">
            <input
              v-model="catSearch"
              type="text"
              class="search-input mono cat-search-input"
              :placeholder="t('common.searchPlaceholder') + '...'"
            />
          </div>
          <div class="filter-options-list" role="radiogroup" :aria-label="t('nav.categories')">
            <label class="filter-item">
              <input
                type="radio"
                name="cat-sidebar"
                :checked="!categoryId"
                class="filter-checkbox"
                @change="categoryId = null"
              />
              <span class="filter-label">{{ t('marketplace.allCategories') }}</span>
            </label>
            <label v-for="c in filteredSidebarCategories" :key="c.id" class="filter-item">
              <input
                type="radio"
                name="cat-sidebar"
                :checked="categoryId === c.id"
                class="filter-checkbox"
                @change="categoryId = c.id"
              />
              <span class="filter-label">{{ localizedCat(c) }}</span>
              <span v-if="c.productCount != null" class="filter-count mono">{{ c.productCount }}</span>
            </label>
          </div>
        </div>

        <div class="filter-section">
          <div class="filter-heading mono">SKU</div>
          <input v-model="sku" type="text" :placeholder="t('catalog.skuPlaceholder')" class="search-input mono" />
          <div class="mono" style="font-size:10px; color:var(--wl-muted); margin-top:6px">{{ t('catalog.skuHelp') }}</div>
        </div>

        <div class="filter-section">
          <div class="filter-heading mono">{{ t('catalog.material') }}</div>
          <label class="filter-item">
            <input type="radio" name="material" :checked="!material" class="filter-checkbox" @change="material = null" />
            <span class="filter-label">{{ t('catalog.allMaterials') }}</span>
          </label>
          <label v-for="m in availableMaterials" :key="m" class="filter-item">
            <input type="radio" name="material" :checked="material === m" class="filter-checkbox" @change="material = m" />
            <span class="filter-label">{{ m }}</span>
          </label>
        </div>

        <div class="filter-section">
          <div class="filter-heading mono">{{ t('catalog.length') }}</div>
          <div class="range-row">
            <input v-model.number="lengthMin" type="number" min="0" step="any" inputmode="decimal" :placeholder="t('catalog.lengthMin')" :aria-label="t('catalog.lengthMin')" class="search-input mono range-input" />
            <span class="range-sep" aria-hidden="true">–</span>
            <input v-model.number="lengthMax" type="number" min="0" step="any" inputmode="decimal" :placeholder="t('catalog.lengthMax')" :aria-label="t('catalog.lengthMax')" class="search-input mono range-input" />
          </div>
          <div v-if="lengthBounds && lengthBounds.min !== lengthBounds.max" class="mono" style="font-size:10px;color:var(--wl-muted);margin-top:4px">Range: {{ lengthBounds.min }}–{{ lengthBounds.max }} cm</div>
        </div>

        <div class="filter-section">
          <div class="filter-heading mono">{{ t('catalog.priceRange') }}</div>
          <div class="range-row">
            <input v-model.number="priceMin" type="number" min="0" step="any" inputmode="decimal" :placeholder="t('catalog.priceMin')" :aria-label="t('catalog.priceMin')" class="search-input mono range-input" />
            <span class="range-sep" aria-hidden="true">–</span>
            <input v-model.number="priceMax" type="number" min="0" step="any" inputmode="decimal" :placeholder="t('catalog.priceMax')" :aria-label="t('catalog.priceMax')" class="search-input mono range-input" />
          </div>
          <div v-if="priceBounds && priceBounds.min !== priceBounds.max" class="mono" style="font-size:10px;color:var(--wl-muted);margin-top:4px">Range: {{ priceBounds.min }}–{{ priceBounds.max }}</div>
        </div>

        <div class="filter-section">
          <div class="filter-heading mono">{{ t('catalog.availability') }}</div>
          <label class="filter-item">
            <input type="radio" name="avail" :checked="availability === 'all'" class="filter-checkbox" @change="availability = 'all'" />
            <span class="filter-label">{{ t('catalog.availAll') }}</span>
          </label>
          <label class="filter-item">
            <input type="radio" name="avail" :checked="availability === 'in'" class="filter-checkbox" @change="availability = 'in'" :disabled="!hasInStock" />
            <span class="filter-label">{{ t('catalog.inStock') }}</span>
          </label>

        </div>

        <button v-if="hasFilters" type="button" class="reset-filters-btn mono" @click="clearFilters">
          <span class="material-symbols-outlined text-[16px]">filter_alt_off</span> {{ t('marketplace.clearFilters') }}
        </button>
      </aside>

      <main class="catalog-results">
        <SkeletonLoader v-if="loading" type="catalog-grid" :count="6" />
        <div v-else-if="error" style="text-align:center;padding:2rem">
          <p style="color:var(--wl-danger)">{{ error }}</p>
          <button class="btn btn-ghost btn-sm" type="button" style="margin-top:0.75rem" @click="load()">{{ t('common.retry') }}</button>
        </div>
        <div v-else-if="!products.length" style="text-align:center;padding:3rem 1rem">
          <span class="material-symbols-outlined" style="font-size:40px;color:var(--wl-muted)">inventory_2</span>
          <p style="margin-top:0.75rem;color:var(--wl-muted)">{{ t('marketplace.noProducts') }}</p>
          <p style="font-size:13px;color:var(--wl-muted)">{{ t('marketplace.noProductsDesc') }}</p>
          <button v-if="hasFilters" type="button" class="btn btn-ghost btn-sm" style="margin-top:1rem" @click="clearFilters">{{ t('marketplace.clearFilters') }}</button>
        </div>
        <template v-else>
          <div class="results-meta-bar mono">
            <span>{{ activeCategoryName }} · {{ totalCount }} {{ t('catalog.showing', { count: String(products.length), total: String(totalCount), page: String(page), totalPages: String(totalPages) } as never).split('·')[0] }}</span>

            <div class="view-mode-toggle" role="group" aria-label="View Mode">
              <button
                type="button"
                class="view-toggle-btn"
                :class="{ 'is-active': viewMode === 'grid' }"
                title="Grid View"
                aria-label="Grid View"
                @click="viewMode = 'grid'"
              >
                <span class="material-symbols-outlined text-[18px]">grid_view</span>
              </button>
              <button
                type="button"
                class="view-toggle-btn"
                :class="{ 'is-active': viewMode === 'list' }"
                title="List View"
                aria-label="List View"
                @click="viewMode = 'list'"
              >
                <span class="material-symbols-outlined text-[18px]">view_list</span>
              </button>
            </div>
          </div>

          <!-- Grid Display -->
          <div v-if="viewMode === 'grid'" class="products-grid">
            <article v-for="p in products" :key="p.id" class="card catalog-card" @click="router.push({ name: 'marketplace-product', params: { id: p.id } })">
              <div class="catalog-card__media" :style="{ background: productMediaUrl(p.imageName, p.imageGradient).background }">
                <AppImage
                  :src="p.imageName"
                  placeholder-type="product"
                  :alt="localized(p.nameEn, p.nameAr)"
                  fit="cover"
                  class="catalog-card__img"
                />
                <div class="catalog-card__badges">
                  <span v-if="p.sku" class="sku-chip mono">{{ p.sku }}</span>
                  <span v-if="p.stock > 0" class="stock-pill stock-pill--in mono">{{ t('catalog.inStock') }}</span>
                  <span v-else class="stock-pill stock-pill--out mono">{{ t('catalog.madeToOrder') }}</span>
                </div>
                <button class="catalog-wishlist-btn" :class="{ 'is-saved': isSaved(p.id) }" type="button" :disabled="!canEditWishlist" :aria-label="isSaved(p.id) ? t('marketplace.removeFromWishlist') : t('marketplace.wishlistTitle')" @click.stop="handleWishlist(p.id)">
                  <span class="material-symbols-outlined">{{ isSaved(p.id) ? 'favorite' : 'favorite_border' }}</span>
                </button>
              </div>
              <div class="catalog-card__body">
                <div class="catalog-card__category mono" dir="auto">{{ localized(p.categoryNameEn || '', p.categoryNameAr || '') }}</div>
                <h3 class="catalog-card__title" dir="auto">{{ localized(p.nameEn, p.nameAr) }}</h3>
                <div class="catalog-card__title-alt mono" dir="auto">{{ locale === 'ar' ? p.nameEn : p.nameAr }}</div>
                <div class="catalog-card__origin mono">{{ p.manufacturerEn || t('catalog.fallbackMfr') }} · {{ p.isActive ? t('catalog.ceMarked') : '' }}<span v-if="p.lengthCm" class="length-chip mono"><span class="length-dot" aria-hidden="true"></span>{{ p.lengthCm }} cm</span></div>
                <div class="catalog-card__foot">
                  <div class="price-col">
                    <strong class="catalog-card__price mono">{{ formatPrice(p.price, locale) }} <span class="currency-tag">{{ p.currencySymbol || p.currencyCode || p.currency || '$' }}</span></strong>
                    <span v-if="p.unit" class="unit-tag mono">/ {{ p.unit }}</span>
                  </div>
                  <span v-if="p.rating" class="rating-tag mono">★ {{ p.rating.toFixed(1) }}</span>
                </div>
                <div class="catalog-card__actions">
                  <button class="card-action-btn card-action-btn--view" type="button" @click.stop="router.push({ name: 'marketplace-product', params: { id: p.id } })">{{ t('marketplace.viewDetails') }}</button>
                  <button class="card-action-btn card-action-btn--quote" type="button" @click.stop="handleAdd(p.id)">{{ t('marketplace.addToQuote') }}</button>
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
                    <th>{{ t('admin.products') }}</th>
                    <th>{{ t('nav.categories') }}</th>
                    <th>{{ t('catalog.availability') }}</th>
                    <th>{{ t('admin.price') }}</th>
                    <th class="text-end">{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="p in products"
                    :key="p.id"
                    class="exec-row cursor-pointer"
                    @click="router.push({ name: 'marketplace-product', params: { id: p.id } })"
                  >
                    <td>
                      <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex-shrink-0">
                          <AppImage
                            :src="p.imageName"
                            placeholder-type="product"
                            :alt="localized(p.nameEn, p.nameAr)"
                            fit="cover"
                            class="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div class="font-semibold text-slate-900 text-sm hover:text-teal-600 transition-colors">
                            {{ localized(p.nameEn, p.nameAr) }}
                          </div>
                          <div class="text-xs text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                            <span v-if="p.sku">SKU: {{ p.sku }}</span>
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
                      <span v-if="p.stock > 0" class="stock-pill stock-pill--in mono">{{ t('catalog.inStock') }}</span>
                      <span v-else class="stock-pill stock-pill--out mono">{{ t('catalog.madeToOrder') }}</span>
                    </td>
                    <td>
                      <strong class="mono text-sm font-bold text-slate-900">
                        {{ formatPrice(p.price, locale) }} {{ p.currencySymbol || p.currencyCode || '$' }}
                      </strong>
                    </td>
                    <td class="text-end">
                      <div class="flex items-center justify-end gap-2" @click.stop>
                        <button
                          class="catalog-wishlist-btn catalog-wishlist-btn--inline"
                          :class="{ 'is-saved': isSaved(p.id) }"
                          type="button"
                          :disabled="!canEditWishlist"
                          @click="handleWishlist(p.id)"
                        >
                          <span class="material-symbols-outlined text-[18px]">{{ isSaved(p.id) ? 'favorite' : 'favorite_border' }}</span>
                        </button>
                        <button
                          class="card-action-btn card-action-btn--quote"
                          type="button"
                          @click="handleAdd(p.id)"
                        >
                          {{ t('marketplace.addToQuote') }}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <AppPagination v-if="totalPages > 1" :page="page" :total-pages="totalPages" :total-items="totalCount" :page-size="12" class="catalog-pagination" @change="goPage" />
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.catalog-page {
  width: 100%;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
}

.breadcrumb a {
  color: var(--wl-primary);
  text-decoration: none;
  transition: color 0.15s ease;
}

.breadcrumb a:hover {
  text-decoration: underline;
  color: var(--wl-primary-hover);
}

.breadcrumb a:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.breadcrumb .sep {
  color: var(--wl-line-strong);
}

.active-crumb {
  color: var(--wl-ink-strong);
  font-weight: 600;
}

.catalog-head {
  margin-bottom: var(--space-6);
}

.catalog-head__info h1 {
  font-family: var(--wl-font-display);
  font-size: clamp(1.9rem, 3.5vw, 2.6rem);
  font-weight: 800;
  background: var(--wl-gradient-gold);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin: var(--space-2) 0 var(--space-1);
  line-height: 0.98;
  letter-spacing: -0.032em;
}
.catalog-head { position: relative; }
.catalog-head::after {
  content: '';
  position: absolute;
  bottom: -0.75rem;
  inset-inline: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--wl-line), transparent);
}

.catalog-head__desc {
  font-size: var(--step-0);
  color: var(--wl-ink-soft);
  max-width: 640px;
  line-height: 1.55;
  margin: 0;
}

.category-pills-bar {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding: var(--space-3) 0 var(--space-1);
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.cat-pill {
  white-space: nowrap;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-pill);
  border: 1px solid var(--wl-line);
  background: var(--wl-surface);
  color: var(--wl-ink);
  font-size: var(--step-0);
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.15s ease;
  box-shadow: var(--shadow-card);
  flex-shrink: 0;
}

.cat-pill:hover:not(:disabled) {
  border-color: var(--wl-primary);
  color: var(--wl-primary);
}

.cat-pill:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.cat-pill.is-active {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border-color: var(--wl-primary);
  box-shadow: var(--shadow-card);
}

.pill-badge {
  background: var(--wl-paper);
  border: 1px solid var(--wl-line);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.cat-pill.is-active .pill-badge {
  background: rgba(255, 255, 255, 0.2);
  color: var(--wl-ink-strong);
  border-color: transparent;
}

.catalog-toolbar {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 260px;
}

.search-icon {
  position: absolute;
  inset-inline-start: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--wl-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding-block: var(--space-3);
  padding-inline-start: 2.4rem;
  padding-inline-end: 2.2rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-md);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  text-align: start;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.clear-search-btn {
  position: absolute;
  inset-inline-end: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--wl-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: color 0.15s ease;
}

.clear-search-btn:hover {
  color: var(--wl-ink-strong);
}

.toolbar-controls {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.mobile-filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: var(--space-3) var(--space-4);
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-md);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  font-weight: 600;
  cursor: pointer;
  position: relative;
}

.mobile-filter-toggle:hover:not(:disabled) {
  border-color: var(--wl-primary);
  color: var(--wl-primary);
}

.mobile-filter-toggle:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.mobile-filter-toggle.has-active {
  border-color: var(--wl-primary);
  color: var(--wl-primary);
}

.filter-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--wl-primary);
}

.sort-icon {
  position: absolute;
  inset-inline-start: var(--space-3);
  color: var(--wl-muted);
  pointer-events: none;
  font-size: var(--step-1);
}

.sort-select {
  padding: var(--space-3) 1rem var(--space-3) 2.2rem;
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-md);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  font-weight: 600;
  cursor: pointer;
}

.sort-select:focus {
  outline: none;
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.active-filters-tray {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-5);
  padding: var(--space-2) var(--space-3);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
}

.active-filters-label {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--step--1);
  font-weight: 600;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb, 105, 169, 255), 0.25);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-chip:hover:not(:disabled) {
  background: var(--wl-surface-soft);
  border-color: var(--wl-primary);
}

.filter-chip:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.clear-all-chip {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-danger);
  background: var(--wl-danger-soft);
  border: 1px solid rgba(239, 68, 68, 0.25);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  margin-inline-start: auto;
}

.clear-all-chip:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: var(--wl-danger);
}

.clear-all-chip:focus-visible {
  outline: 2px solid var(--wl-danger);
  outline-offset: 2px;
}

.category-search-wrap {
  margin-bottom: var(--space-2);
}

.cat-search-input {
  height: 32px;
  font-size: var(--step--1);
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
}

.catalog-grid-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: var(--space-8);
  align-items: start;
}

.filter-sidebar {
  position: sticky;
  top: calc(var(--wl-header-height) + var(--space-4));
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  overflow: hidden;
}
.filter-sidebar::before {
  content: '';
  position: absolute;
  top: 0; inset-inline: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
  opacity: 0.85;
}

.filter-heading {
  font-family: var(--wl-font-mono);
  font-size: var(--step--1);
  letter-spacing: 0.08em;
  color: var(--wl-muted);
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: var(--space-3);
}

.filter-options-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 280px;
  overflow-y: auto;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-2);
  border-radius: var(--radius-md);
  font-size: var(--step-0);
  color: var(--wl-ink-soft);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.filter-item:hover {
  background: var(--wl-surface-soft);
  color: var(--wl-ink-strong);
}

.filter-checkbox {
  accent-color: var(--wl-primary);
  width: 17px;
  height: 17px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.filter-checkbox:hover {
  transform: scale(1.08);
}

.filter-checkbox:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.filter-label {
  flex: 1;
}

.range-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.range-row .range-input {
  flex: 1 1 0;
  min-width: 0;
  width: auto;
  height: 38px;
  min-height: 38px;
  padding: 0 var(--space-2);
  font-size: var(--step-0);
  text-align: center;
}

.range-sep {
  flex-shrink: 0;
  color: var(--wl-muted);
  font-size: var(--step-0);
}

.filter-count {
  font-size: var(--step--1);
  background: var(--wl-paper);
  border: 1px solid var(--wl-line);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  color: var(--wl-muted);
}

.reset-filters-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: var(--space-2);
  background: transparent;
  border: 1px dashed var(--wl-line);
  border-radius: var(--radius-sm);
  color: var(--wl-muted);
  font-size: var(--step-0);
  cursor: pointer;
  transition: all 0.15s ease;
}

.reset-filters-btn:hover:not(:disabled) {
  color: var(--wl-danger);
  border-color: var(--wl-danger);
}

.reset-filters-btn:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.catalog-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.results-meta-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-6);
}

.catalog-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.22s var(--wl-ease-spring);
  position: relative;
}
.catalog-card::before {
  content: '';
  position: absolute;
  top: 0; inset-inline: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
  opacity: 0;
  transition: opacity 0.22s var(--wl-ease-spring);
  pointer-events: none;
  z-index: 1;
}
.catalog-card:hover::before { opacity: 1; }

.catalog-card:hover:not(:disabled) {
  border-color: var(--wl-line-strong);
  transform: translateY(-3px);
  box-shadow: var(--shadow-hover);
}

.catalog-card:active:not(:disabled) {
  transform: translateY(0);
}

.catalog-card:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.catalog-card__media {
  height: 195px;
  width: 100%;
  position: relative;
  display: block;
  overflow: hidden;
  border-bottom: 1px solid var(--wl-line);
}

.catalog-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s var(--wl-ease-spring);
}

.catalog-card:hover .catalog-card__img {
  transform: scale(1.05);
}

.catalog-card__sku-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  color: var(--wl-muted);
  font-size: 0.8rem;
}

.catalog-card__badges {
  position: absolute;
  top: 0.6rem;
  inset-inline: 0.6rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  pointer-events: none;
}

.sku-chip {
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--step--1);
  font-weight: 600;
  color: var(--wl-ink-strong);
  box-shadow: var(--shadow-card);
}

.stock-pill {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-xs, 3px);
  font-size: var(--step--1);
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: var(--shadow-sm);
}

.stock-pill--in {
  background: var(--color-success-500, #198754);
}

.stock-pill--low {
  background: var(--color-warning-500, #E67E22);
}

.stock-pill--out {
  background: var(--color-danger-500, #DC3545);
}

.catalog-card__body {
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
}

.catalog-card__category {
  font-size: 0.68rem;
  color: var(--wl-primary);
  font-weight: 700;
  text-transform: uppercase;
}

.catalog-card__title {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--wl-ink-strong);
  min-height: 1.3em;
  margin: 0;
  text-align: start;
  overflow-wrap: anywhere;
}
.catalog-card__title-alt {
  font-size: var(--step--1);
  color: var(--wl-muted);
  font-weight: 500;
  line-height: 1.4;
  text-align: start;
  min-height: 1.2em;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.catalog-card__origin {
  font-size: var(--step--1);
  color: var(--wl-muted);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.length-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-ink-soft);
}
.length-dot {
  width: 6px;
  height: 2px;
  border-radius: var(--radius-pill);
  background: var(--wl-primary);
  display: inline-block;
}

.catalog-card__foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: auto;
  padding-top: var(--space-2);
}

@media (max-width: 640px) {
  .catalog-card__foot {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }
}

.price-col {
  display: flex;
  flex-direction: column;
}

.catalog-card__price {
  font-size: var(--step-1);
  color: var(--wl-ink-strong);
}

.currency-tag {
  font-size: var(--step-0);
  color: var(--wl-primary);
}

.unit-tag {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.rating-tag {
  font-size: var(--step--1);
  color: var(--wl-warning);
}

.catalog-card__actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--wl-line);
}

.card-action-btn {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--step-0);
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  transition: all 0.2s var(--wl-ease-spring);
}

.card-action-btn--view {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  color: var(--wl-ink-strong);
}

.card-action-btn--view:hover:not(:disabled) {
  background: var(--wl-surface-soft);
  border-color: var(--wl-border-strong);
  transform: translateY(-0.5px);
}

.card-action-btn--view:active:not(:disabled) {
  transform: translateY(0);
}

.card-action-btn--quote {
  background: var(--wl-primary);
  border: 1px solid var(--wl-primary);
  color: #ffffff !important;
  box-shadow: var(--shadow-card);
}

.card-action-btn--quote,
.card-action-btn--quote * {
  color: #ffffff !important;
}

.card-action-btn--quote:hover:not(:disabled) {
  background: var(--wl-primary-hover);
  border-color: var(--wl-primary-hover);
  color: #ffffff !important;
  transform: translateY(-0.5px);
  box-shadow: var(--shadow-hover);
}

.card-action-btn--quote:active:not(:disabled) {
  color: #ffffff !important;
  transform: translateY(0);
}

.card-action-btn--quote:focus-visible {
  color: #ffffff !important;
}

.card-action-btn--quote:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  color: #ffffff !important;
}

.catalog-wishlist-btn {
  position: absolute;
  bottom: var(--space-2);
  inset-inline-end: var(--space-2);
  width: 36px;
  height: 36px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--wl-line);
  background: var(--wl-surface);
  color: var(--wl-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition: all .18s var(--wl-ease-spring);
  z-index: 2;
}
.catalog-wishlist-btn .material-symbols-outlined { font-size: 18px; font-variation-settings: 'FILL' 0; }
.catalog-wishlist-btn:hover:not(:disabled) { border-color: var(--wl-primary); color: var(--wl-primary); transform: scale(1.05); }
.catalog-wishlist-btn:focus-visible { outline: 2px solid var(--wl-primary); outline-offset: 2px; }
.catalog-wishlist-btn.is-saved { background: var(--wl-danger-soft); border-color: var(--wl-danger); color: var(--wl-danger); }
.catalog-wishlist-btn.is-saved .material-symbols-outlined { font-variation-settings: 'FILL' 1; }

.catalog-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-4);
  margin-top: var(--space-8);
  padding: var(--space-4);
}

.catalog-page-btn {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--wl-line);
  background: var(--wl-surface);
  border-radius: var(--radius-sm);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.catalog-page-btn:hover:not(:disabled) {
  border-color: var(--wl-primary);
  color: var(--wl-primary);
}

.catalog-page-btn:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.catalog-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.catalog-page-info {
  font-size: var(--step-0);
  color: var(--wl-muted);
}

@media (max-width: 1120px) {
  .products-grid {
    gap: var(--space-4);
  }
}

@media (max-width: 860px) {
  .catalog-grid-layout {
    grid-template-columns: 1fr;
  }

  .filter-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    border-radius: 0;
    display: none;
    overflow-y: auto;
  }

  .filter-sidebar.is-mobile-open {
    display: flex;
  }

  .filter-sidebar__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--wl-line);
  }

  .close-filters-btn {
    background: none;
    border: none;
    color: var(--wl-ink-strong);
    cursor: pointer;
  }
}

@media (max-width: 600px) {
  .catalog-page {
    padding: var(--space-4) var(--space-3) var(--space-10);
  }
  .catalog-card__title {
    min-height: auto;
  }
  .search-box {
    flex: 1 1 100%;
    min-width: 0;
  }
  .toolbar-controls {
    flex: 1 1 100%;
    flex-wrap: wrap;
  }
  .sort-select-wrapper {
    flex: 1 1 100%;
  }
  .sort-select {
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
  width: 32px;
  height: 32px;
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

.catalog-wishlist-btn--inline {
  position: static !important;
  width: 36px !important;
  height: 36px !important;
  background: var(--bg-subtle) !important;
  color: var(--fg-muted) !important;
  border: 1px solid var(--border) !important;
}

.catalog-wishlist-btn--inline.is-saved {
  color: var(--color-accent-500) !important;
  background: var(--color-accent-50) !important;
  border-color: var(--color-accent-200) !important;
}
</style>





