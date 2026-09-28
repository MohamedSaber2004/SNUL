<script setup lang="ts">
import { computed, ref } from 'vue'
import { authService } from '../di/container'
import { t } from '../i18n'
import { useLocations } from '../composables/useLocations'
import SkeletonLoader from '../components/ui/SkeletonLoader.vue'
import ErrorState from '../components/ui/ErrorState.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BackButton from '../components/ui/BackButton.vue'

const {
  selectedCountry,
  selectedCity,
  searchQuery,
  error,
  loading,
  cities,
  zones,
  filteredCountries,
  localized,
  loadCountries,
} = useLocations()

const isOrganizationUser = computed(() => authService.isOrganizationUser.value)

const territoryColumns = ref<HTMLElement[]>([])
const activeColumnIndex = ref(0)

const handleTerritoryKeydown = (e: KeyboardEvent, columnIndex: number) => {
  const columns = territoryColumns.value
  if (!columns.length) return

  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault()
    const isRtl = document.documentElement.dir === 'rtl'
    const forwardKey = isRtl ? 'ArrowLeft' : 'ArrowRight'
    const dir = e.key === forwardKey ? 1 : -1
    const next = (columnIndex + dir + columns.length) % columns.length
    activeColumnIndex.value = next
    const nextCol = columns[next]
    if (!nextCol) return
    const items = nextCol.querySelectorAll<HTMLElement>('.territory-item')
    const first = items[0]
    if (first) {
      first.focus()
    } else {
      nextCol.focus()
    }
  }
}
</script>

<template>
  <div class="page-shell locations-view">
    <BackButton fallback="/" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('locations.title') }}</span>
    </nav>

    <!-- Executive Header -->
    <header class="locations-head">
      <div class="head-info">
        <div class="head-chip mono">
          <span class="pulse-dot"></span>
          <span>{{ t('locations.eyebrow') }}</span>
        </div>
        <h1 class="head-title">{{ t('locations.title') }}</h1>
        <p class="head-subtitle">
          {{ isOrganizationUser ? t('locations.doctorHint') : t('locations.adminHint') }}
        </p>

        <!-- Dynamic Cascade Lineage -->
        <div class="cascade-pills mono">
          <span class="pill-node" :class="{ 'is-active': !!selectedCountry }">
            <span class="dot"></span>
            <span>1. {{ t('locations.countries') }}</span>
          </span>
          <span class="crumb-sep icon--directional">→</span>
          <span class="pill-node" :class="{ 'is-active': !!selectedCity }">
            <span class="dot"></span>
            <span>2. {{ t('locations.cities') }}</span>
          </span>
          <span class="crumb-sep icon--directional">→</span>
          <span class="pill-node" :class="{ 'is-active': zones.length > 0 }">
            <span class="dot"></span>
            <span>3. {{ t('locations.zones') }}</span>
          </span>
        </div>
      </div>

      <div class="search-input-wrap">
        <span class="material-symbols-outlined search-icon">search</span>
        <input
          v-model="searchQuery"
          :placeholder="t('admin.searchPlaceholder')"
          :aria-label="t('common.searchPlaceholder')"
          class="toolbar-search-input"
        />
      </div>
    </header>

    <!-- 1. Loading State -->
    <div v-if="loading && !filteredCountries.length" class="skeleton-grid">
      <SkeletonLoader type="location-grid" :count="3" />
    </div>

    <!-- 2. Error State -->
    <ErrorState
      v-else-if="error && !filteredCountries.length"
      :message="error"
      @retry="loadCountries"
    />

    <!-- 3. Cascading 3-Column Territory Explorer -->
    <div v-else class="territory-grid" role="grid">
      <!-- Column 1: Countries -->
      <section
        class="territory-col"
        ref="(el) => { if (el) territoryColumns[0] = el as HTMLElement }"
        @keydown="handleTerritoryKeydown($event, 0)"
        role="gridcell"
        aria-label="Countries column"
        tabindex="0"
      >
        <div class="col-head">
          <div class="col-title-row">
            <div class="col-title-group">
              <span class="material-symbols-outlined text-[18px] text-[var(--wl-primary)]">public</span>
              <h2 class="col-title">{{ t('locations.countries') }}</h2>
            </div>
            <span class="mono count-pill">{{ filteredCountries.length }}</span>
          </div>
          <span class="mono col-eyebrow">{{ t('locations.rootTerritory') }}</span>
        </div>

        <EmptyState
          v-if="!filteredCountries.length"
          :title="t('locations.noCountries')"
          :description="t('locations.emptyDescription')"
          compact
        />

        <div v-else class="item-list-box" role="listbox" aria-label="Countries">
          <button
            v-for="c in filteredCountries"
            :key="c.id"
            type="button"
            class="territory-item"
            :class="{ 'is-selected': selectedCountry === c.id }"
            :aria-selected="selectedCountry === c.id"
            @click="selectedCountry = c.id"
          >
            <span class="mono code-tag">{{ c.code || '—' }}</span>
            <span class="item-name">{{ localized(c.nameEn, c.nameAr) }}</span>
            <span class="material-symbols-outlined nav-arrow icon--directional">chevron_right</span>
          </button>
        </div>
      </section>

      <!-- Column 2: Cities -->
      <section
        class="territory-col"
        ref="(el) => { if (el) territoryColumns[1] = el as HTMLElement }"
        @keydown="handleTerritoryKeydown($event, 1)"
        role="gridcell"
        aria-label="Cities column"
        tabindex="0"
      >
        <div class="col-head">
          <div class="col-title-row">
            <div class="col-title-group">
              <span class="material-symbols-outlined text-[18px] text-[var(--wl-primary)]">apartment</span>
              <h2 class="col-title">{{ t('locations.cities') }}</h2>
            </div>
            <span class="mono count-pill">{{ cities.length }}</span>
          </div>
          <span class="mono col-eyebrow">{{ t('locations.insideCountry') }}</span>
        </div>

        <EmptyState
          v-if="!selectedCountry"
          :title="t('locations.selectCountryHint')"
          :description="t('locations.selectCountryHint')"
          icon="arrow_forward"
          compact
        />

        <EmptyState
          v-else-if="!cities.length"
          :title="t('locations.noCities')"
          :description="t('locations.emptyDescription')"
          compact
        />

        <div v-else class="item-list-box" role="listbox" aria-label="Cities">
          <button
            v-for="c in cities"
            :key="c.id"
            type="button"
            class="territory-item"
            :class="{ 'is-selected': selectedCity === c.id }"
            :aria-selected="selectedCity === c.id"
            @click="selectedCity = c.id"
          >
            <span class="item-name">{{ localized(c.nameEn, c.nameAr) }}</span>
            <span class="material-symbols-outlined nav-arrow icon--directional">chevron_right</span>
          </button>
        </div>
      </section>

      <!-- Column 3: Zones -->
      <section
        class="territory-col"
        ref="(el) => { if (el) territoryColumns[2] = el as HTMLElement }"
        @keydown="handleTerritoryKeydown($event, 2)"
        role="gridcell"
        aria-label="Zones column"
        tabindex="0"
      >
        <div class="col-head">
          <div class="col-title-row">
            <div class="col-title-group">
              <span class="material-symbols-outlined text-[18px] text-[var(--wl-primary)]">near_me</span>
              <h2 class="col-title">{{ t('locations.zones') }}</h2>
            </div>
            <span class="mono count-pill">{{ zones.length }}</span>
          </div>
          <span class="mono col-eyebrow">{{ t('locations.deliveryAnchor') }}</span>
        </div>

        <EmptyState
          v-if="!selectedCity"
          :title="t('locations.selectCityHint')"
          :description="t('locations.selectCityHint')"
          icon="arrow_forward"
          compact
        />

        <EmptyState
          v-else-if="!zones.length"
          :title="t('locations.noZones')"
          :description="t('locations.emptyDescription')"
          compact
        />

        <div v-else class="item-list-box">
          <div v-for="z in zones" :key="z.id" class="zone-item-static">
            <span class="zone-dot"></span>
            <span class="item-name">{{ localized(z.nameEn, z.nameAr) }}</span>
            <span class="mono zone-badge">{{ t('locations.zoneBadge') }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.locations-view {
  width: 100%;
}

.crumb-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
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

.crumb-bar a:active:not(:disabled) {
  color: var(--wl-primary-hover);
}

.crumb-bar a:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.crumb-bar a:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.crumb-bar a[aria-busy="true"] {
  pointer-events: none;
}

.crumb-sep {
  color: var(--wl-border);
}

.crumb-active {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

.locations-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--space-6);
  flex-wrap: wrap;
}

.head-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-gold);
  background: var(--wl-gold-soft);
  border: 1px solid rgba(255, 209, 102, 0.35);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  letter-spacing: 0.06em;
  width: fit-content;
  margin-bottom: var(--space-1);
  text-shadow: var(--wl-gold-text-shadow);
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-gold);
  box-shadow: var(--wl-gold-glow-soft);
}

.head-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: var(--step-3);
  font-weight: 800;
  letter-spacing: -0.025em;
  margin: 0;
  line-height: 1.1;
  background: var(--wl-gradient-gold);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: var(--wl-gold-text-filter);
}

.head-subtitle {
  font-size: var(--step-0);
  color: var(--wl-muted);
  margin: var(--space-1) 0 0;
  max-width: 540px;
}

.cascade-pills {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.pill-node {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
}

.pill-node .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-border);
}

.pill-node.is-active {
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border-color: rgba(var(--wl-primary-rgb), 0.3);
}

.pill-node.is-active .dot {
  background: var(--wl-primary);
}

/* Search Bar */
.search-input-wrap {
  position: relative;
  width: 300px;
  max-width: 100%;
}

.search-icon {
  position: absolute;
  inset-inline-start: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: var(--wl-muted);
  pointer-events: none;
}

.toolbar-search-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  padding-inline-start: 38px;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-sm);
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
  outline: none;
  box-shadow: var(--wl-shadow-card);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.toolbar-search-input:focus {
  border-color: var(--wl-primary);
  box-shadow: 0 0 0 3px var(--wl-primary-ring);
}

/* 3-Column Territory Grid */
.skeleton-grid,
.territory-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

.territory-col {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  min-height: 480px;
  box-shadow: var(--wl-shadow-card);
}

.col-head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--wl-border);
  margin-bottom: var(--space-3);
}

.col-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.col-title-group {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.col-title {
  font-size: var(--step-0);
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
}

.count-pill {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
}

.col-eyebrow {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.item-list-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  overflow-y: auto;
  max-height: 460px;
  padding-inline-end: 2px;
}

.territory-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  border-radius: var(--radius-md);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  font-weight: 600;
  cursor: pointer;
  text-align: start;
  width: 100%;
  transition: all 0.15s ease;
}

.territory-item:hover {
  border-color: var(--wl-border-strong);
  background: var(--wl-surface-soft);
}

.territory-item:active:not(:disabled) {
  transform: scale(0.995);
}

.territory-item:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.territory-item:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.territory-item[aria-busy="true"] {
  pointer-events: none;
}

.territory-item.is-selected {
  background: var(--wl-primary);
  border-color: var(--wl-primary);
  color: var(--wl-on-primary);
  box-shadow: var(--shadow-hover);
}

.code-tag {
  font-size: var(--step--1);
  font-weight: 700;
  padding: var(--space-1) var(--space-2);
  background: var(--wl-surface-soft);
  color: var(--wl-ink-soft);
  border-radius: var(--radius-sm);
  letter-spacing: 0.04em;
}

.territory-item.is-selected .code-tag {
  background: rgba(255, 255, 255, 0.2);
  color: var(--wl-on-primary);
}

.item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-arrow {
  font-size: 18px;
  color: var(--wl-muted);
  transition: transform 0.15s;
}

.territory-item:hover .nav-arrow {
  transform: translateX(calc(2px * var(--wl-dir-sign, 1)));
  color: var(--wl-primary);
}

.territory-item.is-selected .nav-arrow {
  color: var(--wl-on-primary);
}

.zone-item-static {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--wl-border);
  background: var(--wl-surface-soft);
  border-radius: var(--radius-md);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  font-weight: 600;
}

.zone-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--wl-success);
}

.zone-badge {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-faint);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

@media (max-width: 1024px) {
  .skeleton-grid,
  .territory-grid {
    grid-template-columns: 1fr;
  }
}
</style>
