<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { services } from '../../di/container'
import type { CategoryDto } from '../../domain/models/marketplace'
import BackButton from '../../components/ui/BackButton.vue'
import DataState from '../../components/ui/DataState.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import AppImage from '../../components/ui/AppImage.vue'

const router = useRouter()
const marketplaceService = services.marketplaceService

const categories = ref<CategoryDto[]>([])
const loading = ref(true)
const search = ref('')
const sortBy = ref<'nameAsc' | 'nameDesc' | 'countDesc' | 'countAsc'>('countDesc')
const onlyWithProducts = ref(false)

const page = ref(1)
const pageSize = ref(12)

onMounted(async () => {
  loading.value = true
  try {
    await marketplaceService.loadCategories()
    categories.value = marketplaceService.categories.value
  } finally {
    loading.value = false
  }
})

const localized = (en?: string | null, ar?: string | null) => {
  if (locale.value === 'ar') return ar || en || ''
  return en || ar || ''
}

const localizedAlt = (en?: string | null, ar?: string | null) => {
  if (locale.value === 'ar') return en || ''
  return ar || ''
}

const filteredCategories = computed(() => {
  let list = [...categories.value]

  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter((c) => {
      const en = (c.nameEn || '').toLowerCase()
      const ar = (c.nameAr || '').toLowerCase()
      const slug = (c.slug || '').toLowerCase()
      return en.includes(q) || ar.includes(q) || slug.includes(q)
    })
  }

  if (onlyWithProducts.value) {
    list = list.filter((c) => (c.productCount ?? 0) > 0)
  }

  list.sort((a, b) => {
    if (sortBy.value === 'nameAsc') {
      return localized(a.nameEn, a.nameAr).localeCompare(localized(b.nameEn, b.nameAr))
    }
    if (sortBy.value === 'nameDesc') {
      return localized(b.nameEn, b.nameAr).localeCompare(localized(a.nameEn, a.nameAr))
    }
    if (sortBy.value === 'countAsc') {
      return (a.productCount ?? 0) - (b.productCount ?? 0)
    }
    return (b.productCount ?? 0) - (a.productCount ?? 0)
  })

  return list
})

const totalCount = computed(() => filteredCategories.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))

const paginatedCategories = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredCategories.value.slice(start, start + pageSize.value)
})

watch([search, sortBy, onlyWithProducts], () => {
  page.value = 1
})

const goPage = (p: number) => {
  page.value = p
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const navigateToCategory = (catId: string) => {
  void router.push({ name: 'marketplace', query: { categoryId: catId } })
}
</script>

<template>
  <div class="page-shell categories-view">
    <BackButton fallback="/" variant="minimal" class="mb-3" />

    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('marketplace.categoriesTitle') }}</span>
    </nav>

    <header class="cat-hero">
      <div class="hero-text-zone anim-fade-in-up">
        <div class="head-chip mono">
          <span class="pulse-dot"></span>
          <span>{{ t('home.browseClinicalSpecialty') }}</span>
        </div>
        <h1 class="hero-title">{{ t('marketplace.categoriesTitle') }}</h1>
        <p class="hero-desc">{{ t('marketplace.categoriesSubtitle') }}</p>
      </div>

      <div class="hero-stats mono">
        <div class="hero-stat-cell">
          <span class="stat-num mono-num">{{ totalCount }}</span>
          <span class="stat-lbl">{{ t('marketplace.categoriesTitle') }}</span>
        </div>
      </div>
    </header>

    <section v-reveal class="cat-toolbar">
      <div class="search-box">
        <span class="material-symbols-outlined search-icon">search</span>
        <input
          v-model="search"
          type="search"
          :placeholder="t('marketplace.searchCategories')"
          class="search-input"
        />
        <button
          v-if="search"
          type="button"
          class="clear-search-btn"
          @click="search = ''"
        >
          <span class="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>

      <div class="toolbar-actions">
        <button
          type="button"
          class="filter-pill interactive-lift"
          :class="{ 'is-active': onlyWithProducts }"
          @click="onlyWithProducts = !onlyWithProducts"
        >
          <span class="material-symbols-outlined text-[16px]">inventory_2</span>
          <span>{{ t('marketplace.inStockOnly') }}</span>
        </button>

        <div class="sort-wrapper">
          <span class="material-symbols-outlined sort-icon">sort</span>
          <select v-model="sortBy" class="sort-select mono" :aria-label="t('common.sortBy')">
            <option value="countDesc">{{ t('marketplace.sortCountDesc') }}</option>
            <option value="countAsc">{{ t('marketplace.sortCountAsc') }}</option>
            <option value="nameAsc">{{ t('marketplace.sortNameAsc') }}</option>
            <option value="nameDesc">{{ t('marketplace.sortNameDesc') }}</option>
          </select>
        </div>
      </div>
    </section>

    <SkeletonLoader v-if="loading" type="category-grid" :count="8" />

    <DataState
      v-else
      :empty="!filteredCategories.length"
      :empty-title="t('marketplace.categoriesTitle')"
      :empty-description="t('marketplace.noProductsDesc')"
      min-height="240px"
    >
      <div class="categories-grid">
        <article
          v-for="(c, i) in paginatedCategories"
          :key="c.id"
          v-reveal="i"
          class="cat-card anim-card-hover"
          tabindex="0"
          role="button"
          @click="navigateToCategory(c.id)"
          @keydown.enter="navigateToCategory(c.id)"
        >
          <div class="cat-card__media">
            <AppImage
              :src="c.imageName"
              placeholder-type="category"
              :placeholder-text="localized(c.nameEn, c.nameAr)"
              :alt="localized(c.nameEn, c.nameAr)"
              fit="cover"
              aspect-ratio="16/10"
              class="cat-card__img-wrap"
            />
            <span v-if="c.productCount" class="cat-badge mono">
              {{ t('landing.instrumentsCount', { count: c.productCount }) }}
            </span>
          </div>

          <div class="cat-card__body">
            <div class="cat-card__title-row">
              <h2 class="cat-title" dir="auto">{{ localized(c.nameEn, c.nameAr) }}</h2>
              <span v-if="c.slug" class="cat-code mono">{{ c.slug }}</span>
            </div>

            <div v-if="localizedAlt(c.nameEn, c.nameAr)" class="cat-alt mono" dir="auto">
              {{ localizedAlt(c.nameEn, c.nameAr) }}
            </div>

            <div class="cat-card__foot">
              <button
                type="button"
                class="btn-explore mono"
                @click.stop="navigateToCategory(c.id)"
              >
                <span>{{ t('marketplace.exploreCategory') }}</span>
                <span class="icon--directional">→</span>
              </button>
              <button
                type="button"
                class="btn-explore mono btn-explore--providers"
                @click.stop="router.push({ name: 'category-providers', params: { id: c.id } })"
              >
                <span>{{ t('provider.providersInCategory') }}</span>
                <span class="icon--directional">→</span>
              </button>
            </div>
          </div>
        </article>
      </div>

      <!-- Pagination -->
      <AppPagination
        v-if="totalPages > 1"
        :page="page"
        :total-pages="totalPages"
        :total-items="totalCount"
        :page-size="pageSize"
        class="cat-pagination"
        @change="goPage"
      />
    </DataState>
  </div>
</template>

<style scoped>
.categories-view {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 3rem;
}

.crumb-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--wl-muted);
}

.crumb-bar a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.crumb-bar a:hover {
  color: var(--wl-primary);
}

.crumb-sep {
  opacity: 0.5;
}

.crumb-active {
  color: var(--wl-text);
  font-weight: 600;
}

/* Hero Header */
.cat-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 2rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--wl-radius-xl, 16px);
  position: relative;
  overflow: hidden;
}

.hero-text-zone {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 650px;
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--wl-gold);
  text-shadow: var(--wl-gold-text-shadow);
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: var(--wl-gold);
  box-shadow: var(--wl-gold-glow-soft);
}

.hero-title {
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0;
  background: var(--wl-gradient-gold);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: var(--wl-gold-text-filter);
}

.hero-desc {
  font-size: 0.925rem;
  color: var(--wl-muted);
  line-height: 1.5;
  margin: 0;
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.hero-stat-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 0.75rem 1.25rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--wl-radius-lg, 12px);
}

.stat-num {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--wl-primary);
}

.stat-lbl {
  font-size: 10px;
  font-weight: 600;
  color: var(--wl-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Toolbar */
.cat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 260px;
  max-width: 480px;
}

.search-icon {
  position: absolute;
  inset-inline-start: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--wl-muted);
  font-size: 20px;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 44px;
  padding: 0 2.25rem;
  border-radius: var(--wl-radius-sm);
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  color: var(--wl-text);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.search-input:focus {
  border-color: var(--wl-primary);
  box-shadow: 0 0 0 3px var(--wl-primary-ring);
}

.clear-search-btn {
  position: absolute;
  inset-inline-end: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--wl-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0.5rem 0.875rem;
  border-radius: var(--wl-radius-full, 9999px);
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  color: var(--wl-muted);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-pill:hover {
  border-color: var(--wl-primary);
  color: var(--wl-text);
}

.filter-pill.is-active {
  background: var(--wl-primary);
  color: var(--wl-ink-strong);
  border-color: var(--wl-primary);
}

.sort-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.sort-icon {
  position: absolute;
  inset-inline-start: 10px;
  color: var(--wl-muted);
  font-size: 18px;
  pointer-events: none;
}

.sort-select {
  height: 44px;
  padding: 0 1rem;
  padding-inline-start: 2rem;
  border-radius: var(--wl-radius-sm);
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  color: var(--wl-text);
  font-size: 0.8125rem;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.sort-select:focus {
  border-color: var(--wl-primary);
}

/* Categories Grid */
.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}

.cat-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--wl-radius-xl, 14px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  position: relative;
  outline: none;
}

.cat-card:hover,
.cat-card:focus-visible {
  transform: translateY(-3px);
  border-color: var(--wl-primary);
  box-shadow: var(--wl-shadow-card-hover);
}

.cat-card__media {
  position: relative;
  width: 100%;
  background: var(--wl-surface-soft);
  overflow: hidden;
}

.cat-badge {
  position: absolute;
  top: 10px;
  inset-inline-end: 10px;
  padding: 3px 8px;
  background: var(--wl-overlay-tint, rgba(0, 10, 25, 0.75));
  backdrop-filter: blur(4px);
  color: var(--wl-ink-strong);
  font-size: 10.5px;
  font-weight: 700;
  border-radius: 4px;
  letter-spacing: 0.03em;
  z-index: 2;
}

.cat-card__body {
  padding: 1.125rem;
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0.5rem;
}

.cat-card__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.cat-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--wl-text);
  line-height: 1.35;
  margin: 0;
}

.cat-code {
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--wl-border);
}

.cat-alt {
  font-size: 0.8125rem;
  color: var(--wl-muted);
  line-height: 1.3;
}

.cat-card__foot {
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid var(--wl-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.btn-explore--providers { color: var(--fg-warning); }

.btn-explore {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--wl-primary);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  transition: gap 0.2s ease;
}

.cat-card:hover .btn-explore {
  gap: 10px;
}

.cat-pagination {
  margin-top: 1.5rem;
}

@media (max-width: 640px) {
  .cat-hero {
    flex-direction: column;
    align-items: flex-start;
    padding: 1.25rem;
  }
  .hero-stats {
    width: 100%;
  }
  .hero-stat-cell {
    width: 100%;
    align-items: flex-start;
  }
  .cat-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .search-box {
    max-width: 100%;
  }
  .toolbar-actions {
    justify-content: space-between;
  }
}
</style>

