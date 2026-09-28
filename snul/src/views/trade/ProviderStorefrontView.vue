<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BackButton from '../../components/ui/BackButton.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { companyRepository } from '../../di/container'
import { t, locale } from '../../i18n'
import { formatPrice } from '../../utils/format'
import type { CompanyDto } from '../../domain/models/company'
import type { CategoryDto, ProductDto } from '../../domain/models/marketplace'

const route = useRoute()
const companyId = computed(() => String(route.params.id || ''))
const initialCategory = computed(() =>
  route.query.category ? String(route.query.category) : 'all',
)

const localized = (en?: string | null, ar?: string | null) =>
  locale.value === 'ar' ? ar || en || '' : en || ar || ''

const company = ref<CompanyDto | null>(null)
const companyLoading = ref(true)
const companyError = ref('')
const companyFailed = ref(false)

const products = ref<ProductDto[]>([])
const totalCount = ref(0)
const loading = ref(true)
const fetchError = ref('')
const search = ref('')
const categoryFilter = ref<string>('all')
const page = ref(1)
const pageSize = 10
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))

/* Distinct categories across everything fetched so far (chip rail). */
const knownCategories = ref<CategoryDto[]>([])
const categoryName = (id: string): string => {
  const c = knownCategories.value.find((x) => x.id === id)
  return c ? localized(c.nameEn, c.nameAr) : id.slice(0, 8)
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
const onSearchInput = () => {
  page.value = 1
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void loadProducts() }, 400)
}

const loadCompany = async () => {
  companyLoading.value = true
  companyError.value = ''
  companyFailed.value = false
  try {
    company.value = await companyRepository.getCompanyById(companyId.value)
  } catch (e) {
    companyError.value = e instanceof Error ? e.message : t('common.error')
    company.value = null
    companyFailed.value = true
  } finally {
    companyLoading.value = false
  }
}

const loadProducts = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    const res = await companyRepository.getCompanyProducts(companyId.value, {
      categoryId: categoryFilter.value === 'all' ? undefined : categoryFilter.value,
      search: search.value.trim() || undefined,
      page: page.value,
      pageSize,
    })
    products.value = Array.isArray(res?.data) ? res.data : []
    totalCount.value = res?.totalCount ?? products.value.length
    for (const p of products.value) {
      if (p?.categoryId && !knownCategories.value.some((c) => c.id === p.categoryId)) {
        knownCategories.value.push({
          id: p.categoryId,
          nameEn: p.categoryNameEn || p.categoryId,
          nameAr: p.categoryNameAr || p.categoryId,
        } as CategoryDto)
      }
    }
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
    products.value = []
    totalCount.value = 0
  } finally {
    loading.value = false
  }
}

const onPageChange = (p: number) => {
  page.value = p
  void loadProducts()
}

const reloadAll = () => {
  categoryFilter.value = initialCategory.value
  page.value = 1
  void loadCompany()
  void loadProducts()
}

onMounted(reloadAll)
watch(
  () => [route.params.id, route.query.category],
  () => { reloadAll() },
)

const memberYear = computed(() => {
  const raw = company.value?.createdAt
  if (!raw) return ''
  const y = new Date(raw).getFullYear()
  return Number.isFinite(y) ? String(y) : ''
})
</script>

<template>
  <div class="page-shell storefront">
    <BackButton fallback="/providers" variant="minimal" class="mb-3" />

    <DataState
      :loading="companyLoading"
      :error="companyError"
      skeleton-type="store-hero"
      :empty="!company && !companyLoading"
      :empty-title="t('provider.noCompanyTitle')"
      @retry="() => { loadCompany(); loadProducts() }"
    >
      <div v-if="company" class="store-hero card anim-scale-in">
        <div class="store-hero__id">
          <AppImage
            :src="company.imageName"
            placeholder-type="company"
            :placeholder-text="company.name"
            :alt="company.name"
            fit="contain"
            class="store-hero__logo"
          />
          <span class="badge badge--green badge--pill">
            <span class="material-symbols-outlined text-[14px]">verified</span>
            <span>{{ t('home.verifiedSupplier') }}</span>
          </span>
        </div>
        <div class="store-hero__info">
          <h1 class="store-hero__name" dir="auto">{{ company.name }}</h1>
          <div class="store-hero__meta">
            <span v-if="company.countryNameEn || company.countryNameAr" class="store-hero__place mono">
              <span class="material-symbols-outlined text-[15px]">public</span>
              <span>{{ localized(company.countryNameEn, company.countryNameAr) }}</span>
            </span>
            <span v-if="memberYear" class="store-hero__place mono">
              <span class="material-symbols-outlined text-[15px]">event</span>
              <span>{{ t('provider.memberSince') }} {{ memberYear }}</span>
            </span>
            <a v-if="company.email" class="store-hero__place mono store-hero__mail" :href="`mailto:${company.email}`">
              <span class="material-symbols-outlined text-[15px]">mail</span>
              <span>{{ company.email }}</span>
            </a>
          </div>
          <div class="store-hero__stats">
            <div class="store-stat">
              <strong class="store-stat__value mono-num">{{ totalCount }}</strong>
              <span class="store-stat__label">{{ t('provider.providerProducts') }}</span>
            </div>
            <div class="store-stat">
              <strong class="store-stat__value mono-num">{{ knownCategories.length }}</strong>
              <span class="store-stat__label">{{ t('provider.categories') }}</span>
            </div>
          </div>
        </div>
      </div>
    </DataState>

    <div v-if="company || companyFailed" class="store-toolbar">
      <div class="search-wrap">
        <span class="material-symbols-outlined search-icon">search</span>
        <input
          v-model="search"
          type="search"
          class="search-input"
          :placeholder="t('common.searchPlaceholder')"
          @input="onSearchInput"
        />
      </div>
      <div class="store-chips" role="tablist" :aria-label="t('provider.categories')">
        <button
          type="button"
          role="tab"
          class="pill interactive-lift"
          :class="{ 'pill--active': categoryFilter === 'all' }"
          :aria-selected="categoryFilter === 'all'"
          @click="categoryFilter = 'all'; page = 1; loadProducts()"
        >
          {{ t('marketplace.allCategories') }}
        </button>
        <button
          v-for="c in knownCategories"
          :key="c.id"
          type="button"
          role="tab"
          class="pill interactive-lift"
          :class="{ 'pill--active': categoryFilter === c.id }"
          :aria-selected="categoryFilter === c.id"
          @click="categoryFilter = c.id; page = 1; loadProducts()"
        >
          {{ categoryName(c.id) }}
        </button>
      </div>
    </div>

    <DataState
      v-if="company || companyFailed"
      :loading="loading"
      :error="fetchError"
      skeleton-type="store-rows"
      :skeleton-count="5"
      :empty="!products.length && !loading"
      :empty-title="t('provider.noProducts')"
      :empty-description="t('provider.noProductsDesc')"
      @retry="loadProducts"
    >
      <div v-reveal class="store-list card">
        <button
          v-for="(p, i) in products"
          :key="p.id"
          v-reveal="i"
          type="button"
          class="store-row"
          @click="$router.push({ name: 'marketplace-product', params: { id: p.id } })"
        >
          <AppImage
            :src="p.imageName"
  placeholder-type="product"
  :alt="localized(p.nameEn, p.nameAr)"
            fit="contain"
            class="store-row__img"
          />
          <span class="store-row__main">
            <strong class="store-row__name" dir="auto">{{ localized(p.nameEn, p.nameAr) }}</strong>
            <span class="store-row__sub mono">{{ p.sku }}<span v-if="p.categoryId"> · {{ categoryName(p.categoryId) }}</span></span>
          </span>
          <span class="store-row__side">
            <span
              class="status-dot-badge"
              :class="p.stock > 0 ? 'status-dot-badge--active' : 'status-dot-badge--inactive'"
            >
              <span class="dot"></span>
              <span>{{ p.stock > 0 ? t('marketplace.inStock') : t('marketplace.outOfStock') }}</span>
            </span>
            <strong class="store-row__price mono-num">{{ formatPrice(p.price, locale) }} {{ p.currencySymbol || p.currencyCode || '$' }}</strong>
          </span>
          <span class="material-symbols-outlined store-row__go icon--directional" aria-hidden="true">arrow_forward</span>
        </button>
      </div>
      <AppPagination
        v-if="totalPages > 1"
        :page="page"
        :total-pages="totalPages"
        :total-items="totalCount"
        :page-size="pageSize"
        @change="onPageChange"
      />
    </DataState>
  </div>
</template>

<style scoped>
.storefront { display: flex; flex-direction: column; gap: var(--space-5); }
.store-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-6);
  align-items: center;
  padding: var(--space-7);
}
.store-hero__id {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}
.store-hero__logo {
  width: 120px;
  height: 120px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: var(--bg-subtle);
}
.store-hero__info { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
.store-hero__name {
  margin: 0;
  font-size: var(--text-3xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  color: var(--fg-heading);
  line-height: var(--leading-tight);
}
.store-hero__meta { display: flex; flex-wrap: wrap; gap: var(--space-4); }
.store-hero__place {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  color: var(--fg-muted);
}
.store-hero__mail { color: var(--fg-link); text-decoration: none; }
.store-hero__mail:hover { text-decoration: underline; }
.store-hero__stats { display: flex; gap: var(--space-6); margin-top: var(--space-1); }
.store-stat { display: flex; flex-direction: column; gap: var(--space-1); }
.store-stat__value { font-size: var(--text-2xl); font-weight: var(--weight-bold); color: var(--fg-heading); }
.store-stat__label { font-size: var(--text-sm); color: var(--fg-muted); }

.store-toolbar { display: flex; flex-direction: column; gap: var(--space-3); }
.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  inset-inline-start: var(--space-3);
  font-size: 18px;
  color: var(--fg-placeholder);
  pointer-events: none;
}
.search-input { padding-inline-start: var(--space-10); }
.store-chips {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: var(--space-1);
  scrollbar-width: none;
}
.store-chips::-webkit-scrollbar { display: none; }
.store-chips .pill { flex-shrink: 0; }

.store-list { padding: var(--space-2); display: flex; flex-direction: column; }
.store-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto 24px;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: none;
  border: 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  text-align: start;
  transition: background var(--duration-fast) var(--ease-out);
}
.store-row:last-child { border-bottom: 0; }
.store-row:hover { background: var(--bg-hover); }
.store-row__img { width: 64px; height: 64px; min-width: 64px; min-height: 64px; aspect-ratio: 1; flex: 0 0 64px; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-subtle); }
.store-row__img :deep(.app-image-placeholder) { position: absolute; inset: 0; min-width: 0; min-height: 0; }
.store-row__img :deep(.placeholder-icon-badge) { width: 30px; height: 30px; flex: 0 0 30px; }
.store-row__img :deep(.placeholder-icon) { font-size: 17px; }

.store-row__img :deep(.placeholder-text) { max-width: 92%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 8px; padding: 1px 4px; }
.store-row__img :deep(.placeholder-grid), .store-row__img :deep(.placeholder-crosshairs) { pointer-events: none; }
.store-row__main { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
.store-row__name {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--fg-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.store-row__sub { font-size: var(--text-xs); color: var(--fg-subtle); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.store-row__side { display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-1); }
.store-row__price { font-size: var(--text-base); color: var(--fg-heading); }
.store-row__go { color: var(--fg-subtle); font-size: 20px; }

@media (max-width: 640px) {
  .store-hero { grid-template-columns: minmax(0, 1fr); padding: var(--space-5); gap: var(--space-4); }
  .store-hero__id { flex-direction: row; }
  .store-hero__logo { width: 72px; height: 72px; }
  .store-hero__name { font-size: var(--text-2xl); }
  .store-row { grid-template-columns: 52px minmax(0, 1fr) 20px; }
  .store-row__img { width: 52px; height: 52px; min-width: 52px; min-height: 52px; flex-basis: 52px; }
  .store-row__side { grid-column: 2; flex-direction: row; align-items: center; justify-content: space-between; }
  .store-row__go { display: none; }
}
</style>
