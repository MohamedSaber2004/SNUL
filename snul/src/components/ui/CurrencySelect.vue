<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { CurrencyDto } from '../../domain/models/marketplace'
import { locale, t } from '../../i18n'
import {
  resolveCurrencyCountry,
  currencyDisplaySymbol,
  type CountryRef,
} from '../../utils/country-currency-map'

const props = withDefaults(
  defineProps<{
    modelValue: string | null
    currencies: CurrencyDto[]
    countries?: CountryRef[]
    disabled?: boolean
    required?: boolean
    id?: string
  }>(),
  {
    modelValue: null,
    currencies: () => [],
    countries: () => [],
    disabled: false,
    required: false,
    id: undefined,
  }
)

const emit = defineEmits<{
  'update:modelValue': [id: string]
  change: [currency: CurrencyDto]
}>()

const isAr = computed(() => locale.value === 'ar')
const isOpen = ref(false)
const searchQuery = ref('')
const highlightedIndex = ref(0)

const containerEl = ref<HTMLElement | null>(null)
const searchInputEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)

interface EnrichedCurrency extends CurrencyDto {
  countryCode: string
  countryName: string
  countryNameEn: string
  countryNameAr: string
  currencyName: string
  flag: string
  displaySymbol: string
}

// Enrich each currency from API data: linked country (when the backend
// models one) plus the currency's own localized name and symbol.
const enrichedCurrencies = computed<EnrichedCurrency[]>(() => {
  return props.currencies.map((c) => {
    const country = resolveCurrencyCountry(c.code, props.currencies, props.countries, locale.value)
    const countryName = isAr.value ? country.countryNameAr : country.countryNameEn
    const currencyName = isAr.value ? c.nameAr || c.nameEn : c.nameEn || c.nameAr
    const displaySymbol = currencyDisplaySymbol(c, locale.value)
    return {
      ...c,
      countryCode: country.countryCode,
      countryName: countryName || currencyName,
      countryNameEn: country.countryNameEn,
      countryNameAr: country.countryNameAr,
      currencyName,
      flag: country.flag,
      displaySymbol,
    }
  })
})

// Current selected currency
const selectedCurrency = computed<EnrichedCurrency | null>(() => {
  if (!props.modelValue) {
    return enrichedCurrencies.value.find((c) => c.code === 'USD') || enrichedCurrencies.value[0] || null
  }
  return enrichedCurrencies.value.find((c) => c.id === props.modelValue) || null
})

// Clean symbol shown on trigger (symbol instead of code)
const currentSymbol = computed(() => {
  if (!selectedCurrency.value) return '$'
  return selectedCurrency.value.displaySymbol
})

// Tooltip on trigger
const triggerTooltip = computed(() => {
  if (!selectedCurrency.value) return 'Currency'
  const c = selectedCurrency.value
  const place = c.countryName && c.countryName !== c.currencyName ? `${c.countryName} · ` : ''
  return `${place}${c.currencyName} (${c.code})`
})

// Top priority regional and global codes
const POPULAR_CODES = ['USD', 'SAR', 'AED', 'EGP', 'EUR', 'GBP', 'KWD', 'QAR']

const popularCurrencies = computed<EnrichedCurrency[]>(() => {
  const map = new Map(enrichedCurrencies.value.map((c) => [c.code, c]))
  const result: EnrichedCurrency[] = []
  for (const code of POPULAR_CODES) {
    const item = map.get(code)
    if (item) result.push(item)
  }
  return result
})

// Filtered list based on search
const filteredCurrencies = computed<EnrichedCurrency[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const rawList = Array.isArray(enrichedCurrencies.value) ? enrichedCurrencies.value : []
  const list = [...rawList].sort((a, b) => String(a?.countryName || '').localeCompare(String(b?.countryName || '')))
  if (!q) return list

  return list.filter((c) => {
    if (!c) return false
    const matchCountry = c.countryName ? String(c.countryName).toLowerCase().includes(q) : false
    const matchCountryEn = c.countryNameEn ? String(c.countryNameEn).toLowerCase().includes(q) : false
    const matchCountryAr = c.countryNameAr ? String(c.countryNameAr).toLowerCase().includes(q) : false
    const matchCurrency = c.currencyName ? String(c.currencyName).toLowerCase().includes(q) : false
    const matchCode = c.code ? String(c.code).toLowerCase().includes(q) : false
    const matchSymbol = c.displaySymbol ? String(c.displaySymbol).toLowerCase().includes(q) : false
    return matchCountry || matchCountryEn || matchCountryAr || matchCurrency || matchCode || matchSymbol
  })
})

const toggleDropdown = () => {
  if (props.disabled) return
  if (isOpen.value) {
    closeDropdown()
  } else {
    openDropdown()
  }
}

const openDropdown = () => {
  isOpen.value = true
  searchQuery.value = ''
  highlightedIndex.value = 0
  void nextTick(() => {
    searchInputEl.value?.focus()
  })
}

const closeDropdown = () => {
  isOpen.value = false
  searchQuery.value = ''
}

const selectCurrency = (c: EnrichedCurrency) => {
  emit('update:modelValue', c.id)
  emit('change', c)
  closeDropdown()
}

const onNativeSelectChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  emit('update:modelValue', val)
  const found = enrichedCurrencies.value.find((c) => c.id === val)
  if (found) emit('change', found)
}

// Click outside handler
const handleClickOutside = (e: PointerEvent) => {
  if (!isOpen.value) return
  const target = e.target as Node | null
  if (containerEl.value && target && !containerEl.value.contains(target)) {
    closeDropdown()
  }
}

// Keyboard navigation
const navigateDown = () => {
  if (highlightedIndex.value < filteredCurrencies.value.length - 1) {
    highlightedIndex.value++
    scrollHighlightedIntoView()
  }
}

const navigateUp = () => {
  if (highlightedIndex.value > 0) {
    highlightedIndex.value--
    scrollHighlightedIntoView()
  }
}

const selectHighlighted = () => {
  const item = filteredCurrencies.value[highlightedIndex.value]
  if (item) selectCurrency(item)
}

const scrollHighlightedIntoView = () => {
  void nextTick(() => {
    const el = listEl.value?.querySelector('.is-highlighted') as HTMLElement | null
    if (el) el.scrollIntoView({ block: 'nearest' })
  })
}

onMounted(() => {
  window.addEventListener('pointerdown', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('pointerdown', handleClickOutside)
})

watch(isOpen, (val) => {
  if (val) {
    const currentId = props.modelValue
    const idx = filteredCurrencies.value.findIndex((c) => c.id === currentId)
    if (idx >= 0) highlightedIndex.value = idx
  }
})
</script>

<template>
  <div ref="containerEl" class="currency-select-container">
    <!-- Accessible hidden select for screen readers and native form serialization -->
    <select
      :id="id"
      :value="modelValue"
      class="sr-native-select"
      tabindex="-1"
      aria-hidden="true"
      :required="required"
      @change="onNativeSelectChange"
    >
      <option v-for="c in enrichedCurrencies" :key="c.id" :value="c.id">
        {{ c.countryName }} · {{ c.displaySymbol }} ({{ c.code }})
      </option>
    </select>

    <!-- Trigger Button: displays the SYMBOL instead of code -->
    <button
      type="button"
      class="currency-trigger mono"
      :class="{ 'is-open': isOpen, 'is-disabled': disabled }"
      :disabled="disabled"
      :title="triggerTooltip"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      @click="toggleDropdown"
      @keydown.down.prevent="openDropdown"
      @keydown.enter.prevent="toggleDropdown"
      @keydown.space.prevent="toggleDropdown"
    >
      <span class="currency-symbol-val">{{ currentSymbol }}</span>
      <span class="currency-arrow" :class="{ 'is-flipped': isOpen }" aria-hidden="true">▾</span>
    </button>

    <!-- Dropdown Menu: inside it show the country name -->
    <Transition name="currency-pop">
      <div v-if="isOpen" class="currency-dropdown" role="listbox" :aria-label="t('admin.currencies')">
        <!-- Search input -->
        <div class="dropdown-search-wrap">
          <span class="material-symbols-outlined search-icon" aria-hidden="true">search</span>
          <input
            ref="searchInputEl"
            v-model="searchQuery"
            type="text"
            class="dropdown-search-input"
            :placeholder="isAr ? 'ابحث عن الدولة أو العملة أو الرمز...' : 'Search country, currency, or code...'"
            autocomplete="off"
            @keydown.escape.prevent="closeDropdown"
            @keydown.down.prevent="navigateDown"
            @keydown.up.prevent="navigateUp"
            @keydown.enter.prevent="selectHighlighted"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="search-clear-btn"
            :aria-label="t('common.close')"
            @click="searchQuery = ''"
          >
            ✕
          </button>
        </div>

        <!-- Scrollable Options -->
        <div ref="listEl" class="dropdown-items-scroll">
          <!-- Popular Currencies (when not searching) -->
          <div v-if="!searchQuery && popularCurrencies.length" class="currency-group">
            <div class="group-header">
              <span class="group-title">{{ isAr ? 'العملات الشائعة' : 'Popular Currencies' }}</span>
            </div>
            <button
              v-for="c in popularCurrencies"
              :key="'pop-' + c.id"
              type="button"
              class="currency-option"
              :class="{ 'is-selected': c.id === modelValue }"
              role="option"
              :aria-selected="c.id === modelValue"
              @click="selectCurrency(c)"
            >
              <span class="option-flag" aria-hidden="true">{{ c.flag }}</span>
              <div class="option-details">
                <span class="option-country-name">{{ c.countryName }}</span>
                <span class="option-currency-sub">
                  {{ c.currencyName }} · <strong class="mono code-highlight">{{ c.code }}</strong>
                </span>
              </div>
              <span class="option-symbol-badge mono">{{ c.displaySymbol }}</span>
              <span v-if="c.id === modelValue" class="selected-indicator" aria-hidden="true">✓</span>
            </button>
          </div>

          <!-- All Currencies / Search Results -->
          <div class="currency-group">
            <div v-if="!searchQuery" class="group-header">
              <span class="group-title">{{ isAr ? 'جميع الدول والعملات' : 'All Countries & Currencies' }}</span>
              <span class="group-count">({{ filteredCurrencies.length }})</span>
            </div>
            <button
              v-for="(c, idx) in filteredCurrencies"
              :key="c.id"
              type="button"
              class="currency-option"
              :class="{
                'is-selected': c.id === modelValue,
                'is-highlighted': idx === highlightedIndex,
              }"
              role="option"
              :aria-selected="c.id === modelValue"
              @click="selectCurrency(c)"
            >
              <span class="option-flag" aria-hidden="true">{{ c.flag }}</span>
              <div class="option-details">
                <span class="option-country-name">{{ c.countryName }}</span>
                <span class="option-currency-sub">
                  {{ c.currencyName }} · <strong class="mono code-highlight">{{ c.code }}</strong>
                </span>
              </div>
              <span class="option-symbol-badge mono">{{ c.displaySymbol }}</span>
              <span v-if="c.id === modelValue" class="selected-indicator" aria-hidden="true">✓</span>
            </button>

            <!-- Empty Search State -->
            <div v-if="filteredCurrencies.length === 0" class="no-results">
              <span class="material-symbols-outlined no-results-icon">public_off</span>
              <p class="no-results-text">{{ isAr ? 'لا توجد دولة أو عملة مطابقة' : 'No matching country or currency' }}</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.currency-select-container {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

/* Hidden native select for accessibility & form validity */
.sr-native-select {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
  pointer-events: none;
  opacity: 0;
}

/* Trigger Button — shows the SYMBOL instead of code */
.currency-trigger {
  min-width: 68px;
  height: 100%;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-sm);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: 0.95rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
}

.currency-trigger:hover:not(:disabled) {
  border-color: var(--wl-primary);
  background: var(--wl-surface-soft);
}

.currency-trigger.is-open {
  border-color: var(--wl-primary);
  box-shadow: 0 0 0 3px var(--wl-primary-ring);
}

.currency-trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--wl-paper);
}

.currency-symbol-val {
  color: var(--wl-primary);
  letter-spacing: -0.01em;
  font-size: 1rem;
  line-height: 1;
}

.currency-arrow {
  font-size: 0.72rem;
  color: var(--wl-muted);
  transition: transform 0.2s ease;
  line-height: 1;
}

.currency-arrow.is-flipped {
  transform: rotate(180deg);
}

/* Dropdown Menu — inside it show the country name */
.currency-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  inset-inline-end: 0;
  width: 320px;
  max-width: 90vw;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line-strong, #C2C7CD);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--shadow-lg);
  z-index: 10000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Search bar */
.dropdown-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0.65rem 0.75rem;
  background: var(--wl-surface-soft);
  border-bottom: 1px solid var(--wl-line);
}

.search-icon {
  font-size: 1.1rem;
  color: var(--wl-muted);
  margin-inline-end: 0.4rem;
  flex-shrink: 0;
}

.dropdown-search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.84rem;
  color: var(--wl-ink-strong);
}

.dropdown-search-input::placeholder {
  color: var(--wl-muted);
  font-size: 0.8rem;
}

.search-clear-btn {
  background: none;
  border: none;
  color: var(--wl-muted);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.2rem;
  line-height: 1;
  border-radius: 999px;
}

.search-clear-btn:hover {
  color: var(--wl-ink-strong);
}

/* Scrollable Options */
.dropdown-items-scroll {
  max-height: 280px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.4rem 0;
}

.dropdown-items-scroll::-webkit-scrollbar {
  width: 6px;
}

.dropdown-items-scroll::-webkit-scrollbar-thumb {
  background: var(--wl-line);
  border-radius: 999px;
}

.dropdown-items-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--wl-muted);
}

/* Group Headers */
.group-header {
  padding: 0.45rem 0.85rem 0.25rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--wl-muted);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.group-count {
  font-weight: 500;
  opacity: 0.8;
}

/* Option Row */
.currency-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.85rem;
  background: transparent;
  border: none;
  text-align: start;
  cursor: pointer;
  transition: background 0.12s ease;
}

.currency-option:hover,
.currency-option.is-highlighted {
  background: var(--wl-surface-soft);
}

.currency-option.is-selected {
  background: var(--wl-primary-soft);
}

.option-flag {
  font-size: 1.25rem;
  line-height: 1;
  flex-shrink: 0;
}

.option-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

/* The Country Name displayed inside */
.option-country-name {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--wl-ink-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.option-currency-sub {
  font-size: 0.72rem;
  color: var(--wl-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.code-highlight {
  color: var(--wl-ink);
  font-weight: 600;
}

.option-symbol-badge {
  flex-shrink: 0;
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-xs);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  color: var(--wl-primary);
  font-size: 0.78rem;
  font-weight: 700;
  text-align: center;
  min-width: 34px;
}

.is-selected .option-symbol-badge {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border-color: var(--wl-primary);
}

.selected-indicator {
  font-size: 0.9rem;
  color: var(--wl-primary);
  font-weight: 700;
  margin-inline-start: 0.2rem;
}

/* No Results */
.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
  color: var(--wl-muted);
  text-align: center;
  gap: 0.35rem;
}

.no-results-icon {
  font-size: 1.6rem;
  opacity: 0.5;
}

.no-results-text {
  font-size: 0.8rem;
  margin: 0;
}

/* Transition Animations */
.currency-pop-enter-active,
.currency-pop-leave-active {
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.currency-pop-enter-from,
.currency-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
</style>
