<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { companyRepository, locationService } from '../../di/container'
import type { CompanyDto } from '../../domain/models/company'
import { CompanyType, CompanyStatus, COMPANY_TYPE_LABEL } from '../../domain/models/company'
import type { CountryDto } from '../../domain/models/location'
import BackButton from '../../components/ui/BackButton.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import AppImage from '../../components/ui/AppImage.vue'

const router = useRouter()

const companies = ref<CompanyDto[]>([])
const countries = ref<CountryDto[]>([])
const loading = ref(true)
const searchTerm = ref('')
const selectedType = ref<string>('all')
const selectedCountry = ref<string>('all')
const sortBy = ref<'nameAsc' | 'nameDesc'>('nameAsc')

const page = ref(1)
const pageSize = ref(12)

const searchInput = ref<HTMLInputElement | null>(null)
const searchFocused = ref(false)
const showSuggestions = ref(false)
const debouncedSearchTerm = ref('')
const recentSearches = ref<string[]>([])
const RECENT_KEY = 'snul-providers-recent'
const LEGACY_RECENT_KEY = 'welco-providers-recent'

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(searchTerm, (v) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { debouncedSearchTerm.value = v.trim() }, 180)
})
onUnmounted(() => { if (debounceTimer) clearTimeout(debounceTimer) })

const isFiltering = computed(() => searchTerm.value.trim() !== debouncedSearchTerm.value)
const activeQuery = computed(() => debouncedSearchTerm.value.toLowerCase())

try {
  const raw = typeof window !== 'undefined' ? (localStorage.getItem(RECENT_KEY) || localStorage.getItem(LEGACY_RECENT_KEY)) : null
  if (raw) {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) recentSearches.value = parsed.filter((x) => typeof x === 'string').slice(0, 5)
  }
} catch { }

const persistRecent = () => {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentSearches.value.slice(0, 5))) } catch { /* ignore */ }
}
const pushRecent = (term: string) => {
  const clean = term.trim()
  if (!clean) return
  recentSearches.value = [clean, ...recentSearches.value.filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, 5)
  persistRecent()
}

/* Load the full company pool (bounded page loop) so client filters +
   pagination always operate on the complete list. */
const loadAllCompanies = async () => {
  const all: CompanyDto[] = []
  for (let p = 1; p <= 5; p++) {
    const res = await companyRepository.getProvidersDirectory({ pageNumber: p, pageSize: 50 })
    const batch = Array.isArray(res?.data) ? res.data : []
    all.push(...batch)
    if (!res || batch.length < 50 || p >= (res.totalPages || 1)) break
  }
  return all
}

onMounted(async () => {
  loading.value = true
  try {
    const [compRes] = await Promise.allSettled([
      loadAllCompanies(),
      locationService.loadCountries().then(() => {
        countries.value = [...locationService.countries.value]
      }).catch(() => []),
    ])

    if (compRes.status === 'fulfilled' && compRes.value.length) {
      companies.value = compRes.value
    } else {
      companies.value = []
    }
  } catch {
    companies.value = []
  } finally {
    loading.value = false
  }
})

const localized = (en?: string | null, ar?: string | null) => {
  if (locale.value === 'ar') return ar || en || ''
  return en || ar || ''
}

const getTypeLabel = (type: CompanyType): string => {
  switch (type) {
    case CompanyType.Hospital:
      return t('providers.hospital')
    case CompanyType.Distributor:
      return t('providers.distributor')
    case CompanyType.Clinic:
      return t('providers.clinic')
    case CompanyType.Supplier:
      return t('providers.supplier')
    default:
      return COMPANY_TYPE_LABEL[type] || 'Provider'
  }
}

const filteredProviders = computed(() => {
  let list = [...companies.value]

  // Public listing: approved + active provider companies only.
  // Pending / rejected applications must never appear here.
  list = list.filter(
    (c) =>
      c.isActive !== false &&
      (c.isProvider !== false || c.isProvider === undefined) &&
      (c.status === undefined || c.status === CompanyStatus.Approved),
  )

  // Search filter (debounced for smooth typing)
  const q = activeQuery.value
  if (q) {
    list = list.filter((c) => {
      const name = (c.name || '').toLowerCase()
      const email = (c.email || '').toLowerCase()
      const countryEn = (c.countryNameEn || '').toLowerCase()
      const countryAr = (c.countryNameAr || '').toLowerCase()
      const typeLabel = getTypeLabel(c.type).toLowerCase()
      return name.includes(q) || email.includes(q) || countryEn.includes(q) || countryAr.includes(q) || typeLabel.includes(q)
    })
  }

  // Type filter
  if (selectedType.value !== 'all') {
    const typeNum = Number(selectedType.value)
    list = list.filter((c) => c.type === typeNum)
  }

  // Country filter
  if (selectedCountry.value !== 'all') {
    list = list.filter((c) => c.countryId === selectedCountry.value || c.countryNameEn === selectedCountry.value)
  }

  // Sort
  list.sort((a, b) => {
    if (sortBy.value === 'nameDesc') {
      return b.name.localeCompare(a.name)
    }
    return a.name.localeCompare(b.name)
  })

  return list
})

const totalCount = computed(() => filteredProviders.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))

const paginatedProviders = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredProviders.value.slice(start, start + pageSize.value)
})

watch([debouncedSearchTerm, selectedType, selectedCountry, sortBy], () => {
  page.value = 1
})

const goPage = (p: number) => {
  page.value = p
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const hasActiveFilters = computed(() => !!searchTerm.value.trim() || selectedType.value !== 'all' || selectedCountry.value !== 'all')

const resetFilters = () => {
  searchTerm.value = ''
  debouncedSearchTerm.value = ''
  selectedType.value = 'all'
  selectedCountry.value = 'all'
  sortBy.value = 'nameAsc'
  page.value = 1
  showSuggestions.value = false
}

const clearSearch = () => {
  searchTerm.value = ''
  debouncedSearchTerm.value = ''
  page.value = 1
  searchInput.value?.focus()
}

// ── Suggestions (recent + live matches) ──
const liveMatches = computed(() => {
  const q = searchTerm.value.trim().toLowerCase()
  const pool = companies.value.filter((c) => c.isActive !== false)
  if (!q) return []
  return pool
    .filter((c) => (c.name || '').toLowerCase().includes(q) || (c.countryNameEn || '').toLowerCase().includes(q) || (c.countryNameAr || '').toLowerCase().includes(q))
    .slice(0, 5)
})

const suggestionList = computed(() => {
  if (searchTerm.value.trim()) return liveMatches.value.map((c) => ({ kind: 'match' as const, label: c.name, sub: localized(c.countryNameEn, c.countryNameAr), company: c }))
  return recentSearches.value.map((r) => ({ kind: 'recent' as const, label: r, sub: '', company: null as CompanyDto | null }))
})

const selectSuggestion = (label: string) => {
  searchTerm.value = label
  debouncedSearchTerm.value = label.trim()
  pushRecent(label)
  showSuggestions.value = false
  searchInput.value?.focus()
}

const onSearchEnter = () => {
  pushRecent(searchTerm.value)
  showSuggestions.value = false
  searchInput.value?.blur()
  page.value = 1
}

const onSearchBlur = () => {
  searchFocused.value = false
  window.setTimeout(() => {
    showSuggestions.value = false
  }, 140)
}

const focusSearch = () => searchInput.value?.focus()

const onGlobalKeydown = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null
  const inField = !!target?.closest('input, textarea, select, [contenteditable="true"]')
  if (e.key === '/' && !inField) {
    e.preventDefault()
    focusSearch()
  }
  if (e.key === 'Escape' && document.activeElement === searchInput.value && searchTerm.value) {
    clearSearch()
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown))

// ── Filter chips ──
const countryChipLabel = computed(() => {
  if (selectedCountry.value === 'all') return ''
  const found = countries.value.find((c) => c.id === selectedCountry.value)
  if (found) return localized(found.nameEn, found.nameAr)
  return selectedCountry.value
})
const typeChipLabel = computed(() => {
  if (selectedType.value === 'all') return ''
  return getTypeLabel(Number(selectedType.value) as CompanyType)
})
const removeChip = (key: 'q' | 'type' | 'country') => {
  if (key === 'q') clearSearch()
  if (key === 'type') selectedType.value = 'all'
  if (key === 'country') selectedCountry.value = 'all'
}

// ── Highlight matching text in card titles ──
const highlightParts = (name: string): Array<{ text: string; hit: boolean }> => {
  const q = activeQuery.value
  if (!q || !name) return [{ text: name, hit: false }]
  const lower = name.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx === -1) return [{ text: name, hit: false }]
  return [
    ...(idx > 0 ? [{ text: name.slice(0, idx), hit: false }] : []),
    { text: name.slice(idx, idx + q.length), hit: true },
    ...(idx + q.length < name.length ? [{ text: name.slice(idx + q.length), hit: false }] : []),
  ]
}

const resultMeta = computed(() => {
  const total = companies.value.filter((c) => c.isActive !== false).length
  return { shown: paginatedProviders.value.length, total: totalCount.value, pool: total }
})

const browseProviderProducts = (providerId: string) => {
  void router.push({ name: 'provider-storefront', params: { id: providerId } })
}
</script>

<template>
  <div class="providers-view">
    <!-- View Header -->
    <header class="view-header">
      <div class="view-header__inner">
        <BackButton />
        <div class="view-header__copy">
          <div class="mono view-header__eyebrow">{{ t('providers.eyebrow') }}</div>
          <h1 class="view-header__title">{{ t('providers.title') }}</h1>
          <p class="view-header__subtitle">{{ t('providers.subtitle') }}</p>
        </div>
      </div>
    </header>

    <!-- Main Content Container -->
    <main class="providers-content">
      <div class="providers-content__inner">
        <!-- Search + Filters Panel -->
        <section class="search-panel" role="search" :aria-label="t('providers.title')">
          <div class="search-panel__main">
            <div
              class="search-field"
              :class="{ 'is-focused': searchFocused, 'is-filtering': isFiltering, 'has-value': !!searchTerm }"
            >
              <span class="material-symbols-outlined search-field__icon" aria-hidden="true">search</span>
              <input
                ref="searchInput"
                v-model="searchTerm"
                type="search"
                role="searchbox"
                autocomplete="off"
                enterkeyhint="search"
                class="search-field__input"
                :placeholder="t('providers.searchPlaceholder')"
                :aria-label="t('providers.searchPlaceholder')"
                @focus="searchFocused = true; showSuggestions = true"
                @blur="onSearchBlur"
                @keydown.enter.prevent="onSearchEnter"
                @keydown.escape="showSuggestions = false"
              />
              <span v-if="isFiltering" class="search-field__spinner" aria-hidden="true"></span>
              <button
                v-if="searchTerm"
                type="button"
                class="search-field__clear"
                @mousedown.prevent="clearSearch"
                :aria-label="t('common.clearFilters')"
              >
                <span class="material-symbols-outlined text-[16px]">close</span>
              </button>
              <kbd v-else-if="!searchFocused" class="search-field__kbd" title="Press / to search" @click="focusSearch">/</kbd>

              <!-- Suggestions -->
              <div v-if="showSuggestions && suggestionList.length" class="suggestions" role="listbox">
                <p class="suggestions__label">
                  {{ searchTerm.trim() ? t('providers.sortBy') + ' · ' + suggestionList.length : 'Recent' }}
                </p>
                <button
                  v-for="(s, i) in suggestionList"
                  :key="s.kind + '-' + i + '-' + s.label"
                  type="button"
                  role="option"
                  aria-selected="false"
                  class="suggestion-item"
                  @mousedown.prevent="selectSuggestion(s.label)"
                >
                  <span class="material-symbols-outlined suggestion-item__icon">{{ s.kind === 'recent' ? 'history' : 'search' }}</span>
                  <span class="suggestion-item__text">
                    <span class="suggestion-item__label" dir="auto">{{ s.label }}</span>
                    <span v-if="s.sub" class="suggestion-item__sub" dir="auto">{{ s.sub }}</span>
                  </span>
                  <span class="material-symbols-outlined suggestion-item__go icon--directional">arrow_forward</span>
                </button>
              </div>
            </div>

            <div class="search-panel__selects">
              <label class="select-wrap">
                <span class="material-symbols-outlined select-wrap__icon" aria-hidden="true">apartment</span>
                <select v-model="selectedType" class="toolbar__select" :aria-label="t('providers.allTypes')">
                  <option value="all">{{ t('providers.allTypes') }}</option>
<option :value="CompanyType.Hospital">{{ t('providers.hospital') }}</option>
<option :value="CompanyType.Distributor">{{ t('providers.distributor') }}</option>
<option :value="CompanyType.Clinic">{{ t('providers.clinic') }}</option>
<option :value="CompanyType.Supplier">{{ t('providers.supplier') }}</option>
                </select>
                <span class="material-symbols-outlined select-wrap__chev" aria-hidden="true">expand_more</span>
              </label>

              <label v-if="countries.length" class="select-wrap">
                <span class="material-symbols-outlined select-wrap__icon" aria-hidden="true">public</span>
                <select v-model="selectedCountry" class="toolbar__select" :aria-label="t('providers.allCountries')">
                  <option value="all">{{ t('providers.allCountries') }}</option>
                  <option v-for="c in countries" :key="c.id" :value="c.id">
                    {{ localized(c.nameEn, c.nameAr) }}
                  </option>
                </select>
                <span class="material-symbols-outlined select-wrap__chev" aria-hidden="true">expand_more</span>
              </label>

              <label class="select-wrap select-wrap--sort">
                <span class="material-symbols-outlined select-wrap__icon" aria-hidden="true">sort</span>
                <select v-model="sortBy" class="toolbar__select" :aria-label="t('providers.sortBy')">
                  <option value="nameAsc">{{ t('providers.sortBy') }}: A → Z</option>
                  <option value="nameDesc">{{ t('providers.sortBy') }}: Z → A</option>
                </select>
                <span class="material-symbols-outlined select-wrap__chev" aria-hidden="true">expand_more</span>
              </label>
            </div>
          </div>

          <!-- Active filter chips + live count -->
          <div class="search-panel__meta">
            <div class="meta-left">
              <span class="mono results-count" role="status" aria-live="polite">
                {{ t('providers.providerCount', { count: totalCount }) }}
                <span v-if="searchTerm.trim()" class="results-count__query" dir="auto">· “{{ debouncedSearchTerm || searchTerm }}”</span>
              </span>
              <span v-if="!loading" class="mono results-shown">{{ resultMeta.shown }}/{{ resultMeta.total }}</span>
            </div>
            <div v-if="hasActiveFilters" class="active-chips">
              <button v-if="searchTerm.trim()" type="button" class="chip chip--search" @click="removeChip('q')">
                <span class="material-symbols-outlined text-[14px]">search</span>
                <span dir="auto">{{ searchTerm.trim() }}</span>
                <span class="material-symbols-outlined text-[14px]">close</span>
              </button>
              <button v-if="typeChipLabel" type="button" class="chip" @click="removeChip('type')">
                <span>{{ typeChipLabel }}</span>
                <span class="material-symbols-outlined text-[14px]">close</span>
              </button>
              <button v-if="countryChipLabel" type="button" class="chip" @click="removeChip('country')">
                <span dir="auto">{{ countryChipLabel }}</span>
                <span class="material-symbols-outlined text-[14px]">close</span>
              </button>
              <button type="button" class="btn-reset-filters" @click="resetFilters">
                <span class="material-symbols-outlined text-[14px]">filter_alt_off</span>
                <span>{{ t('common.clearFilters') }}</span>
              </button>
            </div>
            <p v-else class="search-hint">{{ t('providers.subtitle') }}</p>
          </div>
        </section>

        <!-- Providers Grid -->
        <DataState
          :loading="loading && !paginatedProviders.length"
          :empty="!paginatedProviders.length && !loading"
          skeleton-type="provider-grid"
          :skeleton-count="8"
          min-height="300px"
          :empty-title="t('providers.noProvidersFound')"
          :empty-description="hasActiveFilters ? t('providers.searchPlaceholder') : undefined"
          empty-icon="search_off"
          empty-variant="search"
          :action-text="hasActiveFilters ? t('common.clearFilters') : undefined"
          @action="resetFilters"
        >
          <div class="providers-grid">
            <article
              v-for="provider in paginatedProviders"
              :key="provider.id"
              class="provider-card"
            >
              <!-- Circular avatar, left-anchored — the row's visual anchor -->
              <div class="provider-card__logo-wrap">
                <div class="provider-card__avatar">
                  <AppImage
                    :src="provider.imageName"
                    placeholder-type="company"
                    :placeholder-text="provider.name"
                    :alt="provider.name"
                    fit="contain"
                    height="90px"
                    class="provider-card__img"
                  />
                  <span class="badge-verified" :title="t('providers.verifiedBadge')">
                    <span class="material-symbols-outlined" aria-hidden="true">verified</span>
                    <span class="sr-only">{{ t('providers.verifiedBadge') }}</span>
                  </span>
                </div>
              </div>

              <!-- Card Body -->
              <div class="provider-card__body">
                <div class="provider-card__meta-badges">
                  <span class="badge-type">
                    {{ getTypeLabel(provider.type) }}
                  </span>
                </div>

                <h2 class="provider-card__name" dir="auto"><template v-for="(part, pi) in highlightParts(provider.name)" :key="pi"><mark v-if="part.hit" class="hl">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></h2>

                <div v-if="provider.countryNameEn || provider.countryNameAr" class="provider-card__country">
                  <span class="material-symbols-outlined" aria-hidden="true">public</span>
                  <span>{{ localized(provider.countryNameEn, provider.countryNameAr) }}</span>
                </div>
              </div>

              <!-- Trailing action -->
              <div class="provider-card__foot">
                <button
                  type="button"
                  class="btn-view-products"
                  @click="browseProviderProducts(provider.id)"
                >
                  <span>{{ t('providers.viewProducts') }}</span>
                  <span class="icon--directional">→</span>
                </button>
              </div>
            </article>
          </div>
        </DataState>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="pagination-wrap">
          <AppPagination
            :current-page="page"
            :total-pages="totalPages"
            :total-count="totalCount"
            :page-size="pageSize"
            @page-change="goPage"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.providers-view {
  min-height: 100vh;
  background: var(--wl-paper);
  padding-bottom: 4rem;
}

/* Header */
.view-header {
  background: var(--wl-surface);
  border-bottom: 1px solid var(--wl-border);
  padding: 2.5rem 1.5rem 2rem;
}

.view-header__inner {
  max-width: var(--wl-max-width, 1280px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.view-header__copy {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.view-header__eyebrow {
  font-family: var(--wl-font-body);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--wl-gold);
  text-shadow: var(--wl-gold-text-shadow);
}

.view-header__title {
  font-family: var(--wl-font-display);
  font-size: clamp(1.6rem, 3vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0;
  background: var(--wl-gradient-gold);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: var(--wl-gold-text-filter);
}

.view-header__subtitle {
  font-size: 1rem;
  color: var(--wl-muted);
  max-width: 720px;
  margin: 0;
  line-height: var(--wl-leading-body, 1.62);
}

/* Content */
.providers-content {
  padding: 2rem 1.5rem;
}

.providers-content__inner {
  max-width: var(--wl-max-width, 1280px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Search panel (scrolls with the page — never stuck) ── */
.search-panel {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg, 16px);
  box-shadow: var(--wl-shadow-card);
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  position: static;
}

.search-panel__main {
  display: flex;
  gap: 0.8rem;
  align-items: stretch;
  flex-wrap: wrap;
}

.search-field {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: 1 1 300px;
  min-width: min(100%, 280px);
  min-height: var(--wl-control-md, 44px);
  background: var(--wl-surface-soft);
  border: 1.5px solid var(--wl-border);
  border-radius: var(--radius-sm, 10px);
  padding: 0 0.7rem 0 0.85rem;
  padding-inline: 0.85rem 0.7rem;
  transition: border-color var(--wl-transition, 0.18s cubic-bezier(0.16, 1, 0.3, 1)), box-shadow var(--wl-transition, 0.18s cubic-bezier(0.16, 1, 0.3, 1)), background var(--wl-transition, 0.18s cubic-bezier(0.16, 1, 0.3, 1));
}
[dir="rtl"] .search-field { padding: 0 0.85rem 0 0.7rem; }

.search-field:hover { border-color: var(--wl-border-strong); }
.search-field.is-focused,
.search-field:focus-within {
  background: var(--wl-surface);
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.search-field__icon {
  font-size: 20px;
  color: var(--wl-muted);
  flex-shrink: 0;
}
.search-field.is-focused .search-field__icon { color: var(--wl-primary); }

.search-field__input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 0.92rem;
  color: var(--wl-ink-strong);
  outline: none;
  height: 42px;
  font-family: var(--wl-font-body);
}
.search-field__input::placeholder { color: var(--wl-muted-soft, var(--wl-muted)); }
.search-field__input::-webkit-search-cancel-button { display: none; }

.search-field__spinner {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid var(--wl-primary-soft);
  border-top-color: var(--wl-primary);
  animation: search-spin 0.7s linear infinite;
}
@keyframes search-spin { to { transform: rotate(360deg); } }

.search-field__clear {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  border-radius: 8px;
  background: var(--wl-surface-hover, var(--wl-surface-soft));
  color: var(--wl-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}
.search-field__clear:hover { color: var(--wl-ink-strong); background: var(--wl-border); }
.search-field__clear:focus-visible { outline: none; box-shadow: var(--wl-focus-ring); }

.search-field__kbd {
  flex-shrink: 0;
  min-width: 26px;
  height: 26px;
  display: inline-grid;
  place-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--wl-muted);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-bottom-width: 2px;
  border-radius: 6px;
  padding: 0 6px;
  cursor: pointer;
}

/* Suggestions dropdown */
.suggestions {
  position: absolute;
  top: calc(100% + 8px);
  inset-inline: 0;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md, 12px);
  box-shadow: var(--shadow-lg, 0 12px 20px -4px rgba(0, 10, 25, 0.07));
  padding: 0.4rem;
  z-index: 30;
  max-height: 300px;
  overflow-y: auto;
}
.suggestions__label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--wl-muted);
  padding: 0.4rem 0.6rem 0.25rem;
  margin: 0;
}
.suggestion-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  text-align: start;
  background: none;
  border: none;
  border-radius: 8px;
  padding: 0.55rem 0.6rem;
  cursor: pointer;
  transition: background 0.12s ease;
}
.suggestion-item:hover { background: var(--wl-primary-faint); }
.suggestion-item__icon { font-size: 18px; color: var(--wl-muted); }
.suggestion-item:hover .suggestion-item__icon { color: var(--wl-primary); }
.suggestion-item__text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.suggestion-item__label { font-size: 0.87rem; font-weight: 600; color: var(--wl-ink-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.suggestion-item__sub { font-size: 0.72rem; color: var(--wl-muted); }
.suggestion-item__go { font-size: 16px; color: var(--wl-muted); opacity: 0; transition: opacity 0.12s; }
.suggestion-item:hover .suggestion-item__go { opacity: 1; color: var(--wl-primary); }

/* Selects */
.search-panel__selects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: stretch;
}
.select-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.select-wrap__icon {
  position: absolute;
  inset-inline-start: 0.65rem;
  font-size: 17px;
  color: var(--wl-muted);
  pointer-events: none;
}
.select-wrap__chev {
  position: absolute;
  inset-inline-end: 0.55rem;
  font-size: 18px;
  color: var(--wl-muted);
  pointer-events: none;
}
.toolbar__select {
  appearance: none;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: var(--radius-sm, 10px);
  padding: 0 2rem 0 2.2rem;
  padding-inline: 2.2rem 2rem;
  min-height: var(--wl-control-md, 44px);
  font-size: 0.84rem;
  font-weight: 500;
  font-family: var(--wl-font-body);
  color: var(--wl-ink-strong);
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  max-width: 220px;
}
[dir="rtl"] .toolbar__select { padding: 0 2.2rem 0 2rem; }
.toolbar__select:hover { border-color: var(--wl-border-strong); }
.toolbar__select:focus { border-color: var(--wl-primary); box-shadow: var(--wl-focus-ring); }

/* Meta row: count + chips */
.search-panel__meta {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  border-top: 1px dashed var(--wl-border);
  padding-top: 0.75rem;
}
.meta-left {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.results-count {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.results-count__query {
  color: var(--wl-primary);
  text-transform: none;
  letter-spacing: 0;
}
.results-shown {
  font-size: 0.72rem;
  color: var(--wl-muted-soft, var(--wl-muted));
  font-variant-numeric: tabular-nums;
}
.search-hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--wl-muted-soft, var(--wl-muted));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.active-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 240px;
  background: var(--wl-primary-soft);
  color: var(--wl-primary-active, var(--wl-primary));
  border: 1px solid var(--wl-primary-soft);
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 600;
  padding: 0.3rem 0.35rem 0.3rem 0.7rem;
  padding-inline: 0.7rem 0.35rem;
  cursor: pointer;
  transition: all 0.14s ease;
}
.chip span:not(.material-symbols-outlined) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chip:hover { background: var(--wl-primary-faint); border-color: var(--wl-primary); }
.chip .material-symbols-outlined { font-size: 14px; }
.chip--search { background: var(--wl-ink-strong); border-color: var(--wl-ink-strong); color: var(--wl-ink-strong); }
.chip--search:hover { background: var(--wl-ink); }

.btn-reset-filters {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: none;
  color: var(--wl-primary);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0.3rem 0.55rem;
  border-radius: 8px;
  transition: background 0.15s;
}
.btn-reset-filters:hover { background: var(--wl-primary-faint); }
.btn-reset-filters:focus-visible { outline: none; box-shadow: var(--wl-focus-ring); }

/* Providers Grid */
.providers-grid {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

/* Provider Card — horizontal row: circular avatar left, content right */
.provider-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg, 16px);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1.25rem;
  padding: 1.1rem 1.35rem;
  cursor: pointer;
  transition: transform var(--wl-transition, 0.18s cubic-bezier(0.16, 1, 0.3, 1)), box-shadow 0.18s ease, border-color 0.18s ease;
  position: relative;
}

.provider-card:hover {
  transform: translateX(3px);
  box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0, 10, 25, 0.05));
  border-color: var(--wl-primary-soft);
}
.provider-card:focus-within { border-color: var(--wl-primary); box-shadow: var(--wl-focus-ring); }

/* Row slides toward the reading edge, mirrored for RTL */
[dir='rtl'] .provider-card:hover { transform: translateX(-3px); }

/* Avatar column */
.provider-card__logo-wrap {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.provider-card__avatar {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  overflow: visible;
  background: var(--wl-surface-soft);
  border: 2px solid var(--wl-border);
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s ease;
}

.provider-card:hover .provider-card__avatar {
  border-color: var(--wl-primary-soft);
}

.provider-card__img {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 50%;
}
  .provider-card__img :deep(.app-image-placeholder) { inset: 0; min-width: 0; min-height: 0; overflow: hidden; }
  .provider-card__img :deep(.placeholder-text) { max-width: min(86%, 240px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .provider-card__img :deep(.placeholder-icon-badge) { width: 48px; height: 48px; flex: 0 0 48px; }
  .provider-card__img :deep(.placeholder-icon) { font-size: 24px; }

/* Verified tick sits on the avatar's lower edge */
.badge-verified {
  position: absolute;
  inset-block-end: -4px;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--wl-success);
  color: #fff;
  border: 2px solid var(--wl-surface);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
}
.badge-verified .material-symbols-outlined { font-size: 13px; line-height: 1; }

.provider-card__body {
  padding: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 0.4rem;
}

.provider-card__meta-badges {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.badge-type {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: var(--wl-surface-soft);
  color: var(--wl-ink-soft);
  border: 1px solid var(--wl-border);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}

.provider-card__name {
  font-family: var(--wl-font-display);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.provider-card__country {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--wl-muted);
  margin-top: auto;
}

.provider-card__foot {
  flex: 0 0 auto;
  align-self: center;
  margin-inline-start: auto;
}

.provider-card__name .hl {
  background: var(--wl-primary-soft);
  color: var(--wl-primary-active, var(--wl-primary));
  border-radius: 3px;
  padding: 0 1px;
}

.btn-view-products {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-sm, 10px);
  padding: 0.45rem 0.9rem;
  min-height: 40px;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: var(--wl-font-body);
  color: var(--wl-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-view-products:hover { border-color: var(--wl-primary); background: var(--wl-primary-soft); }
.btn-view-products:focus-visible { outline: none; box-shadow: var(--wl-focus-ring); }

.provider-card:hover .btn-view-products {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border-color: var(--wl-primary);
}

.icon--directional {
  transition: transform 0.2s ease;
}

/* NOTE: never use :global([dir="rtl"]) here — the SFC compiler emits it as
   a bare global rule that matches <html> and rotates the entire page.
   RTL icon mirroring is already handled globally in base.css. */

.pagination-wrap {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
}

/* Responsive */
@media (max-width: 900px) {
  .search-panel { position: static; padding: 0.85rem; }
  .search-panel__main { flex-direction: column; }
  .search-field { flex-basis: 100%; }
  .search-panel__selects { display: grid; grid-template-columns: 1fr 1fr; }
  .select-wrap--sort { grid-column: 1 / -1; }
  .toolbar__select { width: 100%; max-width: none; }
  .search-hint { white-space: normal; }
}
@media (max-width: 560px) {
  .providers-content { padding: 1.25rem 1rem; }
  .view-header { padding: 1.75rem 1rem 1.5rem; }
  .search-panel__selects { grid-template-columns: 1fr; }
  .provider-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.9rem;
  }
  .provider-card__body { width: 100%; }
  .provider-card__foot { margin-inline-start: 0; align-self: stretch; }
  .provider-card__foot .btn-view-products { width: 100%; }
  .suggestions { position: absolute; }
}
@media (prefers-reduced-motion: reduce) {
  .provider-card, .search-field, .chip, .btn-view-products { transition: none; }
  .search-field__spinner { animation-duration: 1.2s; }
}
</style>

