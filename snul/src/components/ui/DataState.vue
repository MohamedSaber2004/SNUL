<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { t } from '../../i18n'
import BaseButton from './BaseButton.vue'
import { defaultSkeletonCount, type SkeletonType } from './skeleton'

/* ── Props ───────────────────────────────────────────────
 * New unified API  → state / loadingDelay / emptyVariant / errorRecoverable / onRetry / icon
 * Legacy API       → loading / error / empty / data / minHeight / emptyTitle / ...
 * The new `state` prop wins when provided; otherwise the legacy
 * boolean flags are evaluated for backward compatibility.
 */
const props = withDefaults(
  defineProps<{
    /* new unified API */
    state?: 'loading' | 'empty' | 'error' | 'success'
    loadingDelay?: number
    emptyVariant?: 'first-use' | 'no-results' | 'cleared' | 'default' | 'search' | 'catalog' | 'neutral'
    errorRecoverable?: boolean
    onRetry?: () => void
    icon?: string

    /* empty state extras */
    title?: string
    description?: string
    actionText?: string
    emptyCode?: string
    emptyStatus?: string
    fill?: boolean
    compact?: boolean

    /* error state extras */
    errorTitle?: string
    errorMessage?: string
    retryText?: string
    errorCode?: string

    /* skeleton / loading props */
    skeletonType?: SkeletonType
    skeletonLines?: number
    skeletonCount?: number
    skeletonWidth?: string
    skeletonHeight?: string
    skeletonGap?: string

    /* legacy API (backward-compat) */
    loading?: boolean
    error?: string | null
    empty?: boolean
    data?: unknown
    minHeight?: string
    emptyTitle?: string
    emptyDescription?: string
    emptyIcon?: string
    emptyVariantLegacy?: 'default' | 'search' | 'catalog' | 'neutral'
  }>(),
  {
    state: undefined,
    loadingDelay: 0,
    emptyVariant: 'first-use',
    errorRecoverable: true,
    icon: 'inventory_2',
    title: undefined,
    description: undefined,
    actionText: undefined,
    emptyCode: undefined,
    emptyStatus: undefined,
    fill: false,
    compact: false,
    errorTitle: 'Something went wrong',
    errorMessage: 'Unable to load data. Please check your connection and try again.',
    retryText: 'Retry',
    errorCode: undefined,
    skeletonType: 'text',
    skeletonLines: 1,
    skeletonCount: 6,
    skeletonWidth: undefined,
    skeletonHeight: undefined,
    skeletonGap: undefined,
    loading: false,
    error: null,
    empty: false,
    data: undefined,
    minHeight: undefined,
    emptyTitle: undefined,
    emptyDescription: undefined,
    emptyIcon: 'inventory_2',
    emptyVariantLegacy: 'default',
  },
)

defineEmits<{
  action: []
  retry: []
}>()

/* ── Derived state (backward-compat) ──────────────────── */
const isNullishEmpty = computed(() => {
  if (props.data === undefined) return false
  if (props.data === null) return true
  if (Array.isArray(props.data)) return props.data.length === 0
  if (typeof props.data === 'object' && props.data !== null) {
    return Object.keys(props.data as object).length === 0
  }
  return !props.data
})

const legacyEmpty = computed(() => props.empty || isNullishEmpty.value)

const resolvedState = computed<'loading' | 'empty' | 'error' | 'success'>(() => {
  if (props.state) return props.state
  if (props.loading) return 'loading'
  if (props.error) return 'error'
  if (legacyEmpty.value) return 'empty'
  return 'success'
})

const resolvedEmptyVariant = computed<'first-use' | 'no-results' | 'cleared'>(() => {
  const raw = props.emptyVariant
  if (raw === 'no-results' || raw === 'cleared') return raw
  if (raw === 'search') return 'no-results'
  return 'first-use' // covers 'first-use', 'default', 'catalog', 'neutral', and undefined
})

/* ── Loading state ───────────────────────────────────────
 * Show the skeleton immediately on route transitions and loading states
 * so content never flashes empty or uninitialized.
 */
const showLoading = ref(true)
const loadingTimer = ref<ReturnType<typeof setTimeout> | null>(null)

watch(
  () => resolvedState.value,
  (newState) => {
    if (loadingTimer.value) {
      clearTimeout(loadingTimer.value)
      loadingTimer.value = null
    }
    if (newState === 'loading') {
      if (props.loadingDelay > 0) {
        showLoading.value = false
        loadingTimer.value = setTimeout(() => {
          showLoading.value = true
        }, props.loadingDelay)
      } else {
        showLoading.value = true
      }
    } else {
      showLoading.value = true
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (loadingTimer.value) clearTimeout(loadingTimer.value)
})

/* ── Empty-state copy helpers ─────────────────────────── */
const emptyCopy = computed(() => {
  if (props.title) return { title: props.title, description: props.description }
  switch (resolvedEmptyVariant.value) {
    case 'no-results':
      return { title: 'No results', description: 'No items match your search.' }
    case 'cleared':
      return { title: 'All caught up', description: undefined }
    case 'first-use':
    default:
      return { title: 'No items yet', description: 'Add your first to start tracking.' }
  }
})

const emptyTitle = computed(() => emptyCopy.value.title)
const emptyDescription = computed(() => emptyCopy.value.description)

/* ── Error-state copy helpers ─────────────────────────── */
const errorTitle = computed(() => props.errorTitle || 'Something went wrong')
const errorMessage = computed(() => props.errorMessage || 'Unable to load data. Please check your connection and try again.')

/* ── Skeleton helpers ─────────────────────────────────── */
const gridCount = computed(() => {
  const t = props.skeletonType
  return props.skeletonCount ?? defaultSkeletonCount(t)
})

/* Negative phase offsets: every skeleton is already mid-sweep on first
   paint instead of sitting static through a positive stagger. */
const delay = (i: number) => ({ animationDelay: `${-((i % 16) * 90)}ms` })
</script>

<template>
  <div
    class="data-state"
    role="status"
    aria-live="polite"
    :aria-label="resolvedState === 'loading' ? t('common.loading') : undefined"
    :style="minHeight ? { minHeight } : undefined"
    :aria-busy="resolvedState === 'loading' ? 'true' : 'false'"
  >
    <!-- ══ Loading ══════════════════════════════════════════ -->
    <div v-if="resolvedState === 'loading' && showLoading" class="data-state__loading" role="status" aria-live="polite">
      <slot name="loading">
        <template v-if="skeletonType === 'text'">
          <div class="skeleton-wrapper">
            <div v-for="i in skeletonLines" :key="i" class="sk sk--text"
              :style="{
                width: i === skeletonLines && skeletonLines > 1 ? '65%' : skeletonWidth || '100%',
                height: skeletonHeight || '14px',
                ...delay(i),
              }" />
          </div>
        </template>
        <template v-else-if="skeletonType === 'card'">
          <div class="sk sk--card" :style="{ width: skeletonWidth, height: skeletonHeight || '180px', ...delay(1) }" />
        </template>
        <template v-else-if="skeletonType === 'circle'">
          <div class="sk sk--circle" :style="{ width: skeletonWidth || '44px', height: skeletonHeight || skeletonWidth || '44px', ...delay(1) }" />
        </template>
        <template v-else-if="skeletonType === 'table-row'">
          <div class="skeleton-wrapper"><div v-for="i in skeletonLines" :key="i" class="sk sk--row" :style="delay(i)" /></div>
        </template>
        <template v-else-if="skeletonType === 'custom'">
          <div class="sk" :style="{ width: skeletonWidth, height: skeletonHeight, ...delay(1) }" />
        </template>
        <template v-else-if="skeletonType === 'product-card' || skeletonType === 'catalog-grid'">
          <div class="sk-grid sk-grid--catalog" :style="{ gap: skeletonGap }">
            <div v-for="i in gridCount" :key="i" class="sk-card" :style="delay(i)">
              <div class="sk-card__media sk" :style="delay(i)">
                <div class="sk-card__media-badges">
                  <div class="sk" style="width:68px;height:18px;border-radius:var(--radius-pill)" :style="delay(i+1)"></div>
                  <div class="sk" style="width:60px;height:18px;border-radius:var(--radius-pill)" :style="delay(i+1)"></div>
                </div>
                <div class="sk" style="width:28px;height:28px;border-radius:50%;position:absolute;top:10px;inset-inline-end:10px" :style="delay(i+2)"></div>
              </div>
              <div class="sk-card__body">
                <div class="sk" style="width:42%;height:10px;border-radius:var(--radius-sm)" :style="delay(i+2)"></div>
                <div class="sk" style="width:92%;height:15px;border-radius:var(--radius-sm);margin-top:2px" :style="delay(i+3)"></div>
                <div class="sk" style="width:68%;height:12px;border-radius:var(--radius-sm)" :style="delay(i+4)"></div>
                <div class="sk" style="width:78%;height:10px;border-radius:var(--radius-sm)" :style="delay(i+5)"></div>
                <div class="sk-card__foot">
                  <div style="display:flex;align-items:baseline;gap:6px">
                    <div class="sk" style="width:72px;height:18px;border-radius:var(--radius-sm)" :style="delay(i+6)"></div>
                    <div class="sk" style="width:36px;height:10px;border-radius:var(--radius-sm)" :style="delay(i+6)"></div>
                  </div>
                  <div class="sk" style="width:42px;height:16px;border-radius:var(--radius-pill)" :style="delay(i+7)"></div>
                </div>
                <div class="sk-card__actions">
                  <div class="sk" style="height:34px;flex:1;border-radius:var(--radius-md)" :style="delay(i+8)"></div>
                  <div class="sk sk--btn-primary" style="height:34px;flex:1;border-radius:var(--radius-md)" :style="delay(i+9)"></div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'category-grid'">
          <div class="sk-grid sk-grid--category" :style="{ gap: skeletonGap }">
            <div v-for="i in gridCount" :key="i" class="sk-cat" :style="delay(i)">
              <!-- Image area — mirrors cat-media at 110px -->
              <div class="sk-cat__media sk" :style="delay(i)"></div>
              <!-- Body — mirrors cat-body: name + alt + count -->
              <div class="sk-cat__body">
                <div class="sk" style="width:70%;height:15px;border-radius:var(--radius-sm)" :style="delay(i+1)"></div>
                <div class="sk" style="width:45%;height:12px;border-radius:var(--radius-sm);margin-top:5px" :style="delay(i+2)"></div>
                <div class="sk" style="width:52px;height:11px;border-radius:var(--radius-pill);margin-top:8px" :style="delay(i+3)"></div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'provider-grid'">
          <div class="sk-grid sk-grid--provider" :style="{ gap: skeletonGap }">
            <div v-for="i in gridCount" :key="i" class="sk-provider" :style="delay(i)">
              <div class="sk-provider__logo sk" :style="delay(i)">
                <div class="sk" style="position:absolute;top:10px;inset-inline-end:10px;width:96px;height:20px;border-radius:var(--radius-pill)" :style="delay(i+1)"></div>
              </div>
              <div class="sk-provider__body">
                <div class="sk" style="width:84px;height:14px;border-radius:var(--radius-pill)" :style="delay(i+2)"></div>
                <div class="sk" style="width:86%;height:18px;border-radius:var(--radius-sm);margin-top:8px" :style="delay(i+3)"></div>
                <div class="sk" style="width:52%;height:12px;border-radius:var(--radius-sm);margin-top:6px" :style="delay(i+4)"></div>
                <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border)">
                  <div class="sk" style="width:100%;height:36px;border-radius:var(--radius-md)" :style="delay(i+5)"></div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'provider-cards'">
          <div class="sk-grid sk-grid--prov-cards" :style="{ gap: skeletonGap }">
            <div v-for="i in gridCount" :key="i" class="sk-prov-card" :style="delay(i)">
              <div class="sk-prov-card__top">
                <div class="sk" style="width:64px;height:64px;border-radius:var(--radius-md)" :style="delay(i)"></div>
                <div class="sk" style="width:96px;height:22px;border-radius:var(--radius-pill)" :style="delay(i+1)"></div>
              </div>
              <div class="sk" style="width:76%;height:18px;border-radius:var(--radius-sm);margin-top:8px" :style="delay(i+2)"></div>
              <div class="sk" style="width:46%;height:12px;border-radius:var(--radius-sm);margin-top:6px" :style="delay(i+3)"></div>
              <div class="sk" style="width:100%;height:36px;border-radius:var(--radius-md);margin-top:auto" :style="delay(i+4)"></div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'cert-grid'">
          <div class="sk-grid sk-grid--cert" :style="{ gap: skeletonGap }">
            <div v-for="i in gridCount" :key="i" class="sk-cert" :style="delay(i)">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div class="sk" style="width:48px;height:48px;border-radius:12px" :style="delay(i)"></div>
                <div class="sk" style="width:74px;height:22px;border-radius:var(--radius-pill)" :style="delay(i+1)"></div>
              </div>
              <div class="sk" style="width:82%;height:18px;border-radius:var(--radius-sm);margin-top:12px" :style="delay(i+2)"></div>
              <div class="sk" style="width:58%;height:12px;border-radius:var(--radius-sm);margin-top:6px" :style="delay(i+3)"></div>
              <div class="sk" style="width:68%;height:11px;border-radius:var(--radius-sm);margin-top:10px" :style="delay(i+4)"></div>
              <div style="margin-top:auto;padding-top:12px;border-top:1px solid var(--border)">
                <div class="sk" style="width:100%;height:34px;border-radius:var(--radius-md)" :style="delay(i+5)"></div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'stats-grid'">
          <div class="sk-grid sk-grid--stats" :style="{ gap: skeletonGap || '1rem' }">
            <div v-for="i in gridCount" :key="i" class="sk-stat" :style="delay(i)">
              <!-- header: label (left) + trend pill + icon circle (right) -->
              <div class="sk-stat__head">
                <div class="sk sk-stat__label" :style="delay(i+1)" />
                <div class="sk-stat__head-right">
                  <div class="sk sk-stat__trend" :style="delay(i+2)" />
                  <div class="sk sk-stat__icon" :style="delay(i+3)" />
                </div>
              </div>
              <!-- main: big value (left) + sparkline area (right) -->
              <div class="sk-stat__foot">
                <div class="sk sk-stat__value" :style="delay(i+4)" />
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'location-grid'">
          <div class="sk-grid sk-grid--location" :style="{ gap: skeletonGap || '1rem' }">
            <div v-for="i in 3" :key="i" class="sk-loc" :style="delay(i)">
              <div class="sk-loc__head">
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="sk" style="width:20px;height:20px;border-radius:50%"></div>
                  <div class="sk" style="width:90px;height:16px;border-radius:var(--radius-sm)"></div>
                </div>
                <div class="sk" style="width:36px;height:18px;border-radius:var(--radius-pill)"></div>
              </div>
              <div class="sk-loc__list">
                <div v-for="r in 5" :key="r" class="sk sk--loc-row" :style="delay(i+r)">
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:0 12px;height:100%">
                    <div class="sk" style="width:50%;height:12px;border-radius:var(--radius-sm);background:rgba(255,255,255,0.7)"></div>
                    <div class="sk" style="width:45px;height:16px;border-radius:var(--radius-pill);background:rgba(255,255,255,0.7)"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'pdp'">
          <div class="sk-pdp">
            <div class="sk-pdp__visual-stage">
              <div class="sk-pdp__top-badges">
                <div class="sk" style="width:72px;height:22px;border-radius:var(--radius-pill)" :style="delay(1)"></div>
                <div style="display:flex;gap:6px">
                  <div class="sk" style="width:52px;height:22px;border-radius:var(--radius-pill)" :style="delay(2)"></div>
                  <div class="sk" style="width:78px;height:22px;border-radius:var(--radius-pill)" :style="delay(3)"></div>
                </div>
                <div class="sk" style="width:34px;height:34px;border-radius:50%;margin-inline-start:auto" :style="delay(4)"></div>
              </div>
              <div class="sk-pdp__viewport sk" :style="delay(2)">
                <div class="sk" style="width:140px;height:140px;border-radius:var(--radius-md);opacity:.7" :style="delay(3)"></div>
              </div>
              <div class="sk-pdp__foot">
                <div class="sk" style="width:40%;height:11px;border-radius:var(--radius-sm)" :style="delay(4)"></div>
                <div class="sk" style="width:30%;height:11px;border-radius:var(--radius-sm)" :style="delay(5)"></div>
              </div>
            </div>
            <div class="sk-pdp__order-col">
              <div class="sk" style="width:120px;height:11px;border-radius:var(--radius-sm)" :style="delay(1)"></div>
              <div class="sk" style="width:90%;height:28px;border-radius:var(--radius-md);margin-top:6px" :style="delay(2)"></div>
              <div class="sk" style="width:65%;height:14px;border-radius:var(--radius-sm);margin-top:4px" :style="delay(3)"></div>
              <div class="sk-pdp__price-card card">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div style="display:flex;flex-direction:column;gap:6px">
                    <div class="sk" style="width:110px;height:26px;border-radius:var(--radius-sm)" :style="delay(4)"></div>
                    <div class="sk" style="width:130px;height:10px;border-radius:var(--radius-sm)" :style="delay(5)"></div>
                  </div>
                  <div class="sk" style="width:84px;height:22px;border-radius:var(--radius-pill)" :style="delay(5)"></div>
                </div>
                <div style="display:flex;gap:12px;margin-top:16px">
                  <div class="sk" style="width:110px;height:42px;border-radius:var(--radius-md)" :style="delay(6)"></div>
                  <div class="sk" style="height:42px;flex:1;border-radius:var(--radius-md)" :style="delay(7)"></div>
                </div>
                <div style="display:flex;gap:10px;margin-top:12px">
                  <div class="sk" style="height:38px;flex:1;border-radius:var(--radius-pill)" :style="delay(8)"></div>
                  <div class="sk" style="height:38px;width:130px;border-radius:var(--radius-pill)" :style="delay(9)"></div>
                </div>
              </div>
              <div class="card" style="padding:var(--space-4);margin-top:14px;display:flex;flex-direction:column;gap:10px">
                <div class="sk" style="width:40%;height:14px;border-radius:var(--radius-sm)" :style="delay(4)"></div>
                <div v-for="r in 3" :key="r" style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--border)">
                  <div class="sk" style="width:30%;height:12px;border-radius:var(--radius-sm)" :style="delay(r+4)"></div>
                  <div class="sk" style="width:45%;height:12px;border-radius:var(--radius-sm)" :style="delay(r+5)"></div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'table'">
          <div class="table-card sk-table-card" :style="delay(1)">
            <div class="table-wrap">
              <table class="exec-table sk-exec-table">
                <thead>
                  <tr>
                    <th style="width:18%"><div class="sk" style="height:12px;width:65%;border-radius:var(--radius-sm)" :style="delay(1)"></div></th>
                    <th style="width:24%"><div class="sk" style="height:12px;width:75%;border-radius:var(--radius-sm)" :style="delay(2)"></div></th>
                    <th style="width:18%"><div class="sk" style="height:12px;width:55%;border-radius:var(--radius-sm)" :style="delay(3)"></div></th>
                    <th style="width:14%"><div class="sk" style="height:12px;width:60%;border-radius:var(--radius-sm)" :style="delay(4)"></div></th>
                    <th style="width:14%"><div class="sk" style="height:12px;width:50%;border-radius:var(--radius-pill)" :style="delay(5)"></div></th>
                    <th style="width:12%;text-align:end"><div class="sk" style="height:12px;width:45px;border-radius:var(--radius-sm);margin-inline-start:auto" :style="delay(6)"></div></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in (skeletonCount ?? 6)" :key="r" class="exec-row">
                    <td>
                      <div class="sk" style="height:14px;width:75%;border-radius:var(--radius-sm)" :style="delay(r)"></div>
                    </td>
                    <td>
                      <div style="display:flex;flex-direction:column;gap:4px">
                        <div class="sk" style="height:14px;width:85%;border-radius:var(--radius-sm)" :style="delay(r+1)"></div>
                        <div class="sk" style="height:10px;width:50%;border-radius:var(--radius-sm)" :style="delay(r+2)"></div>
                      </div>
                    </td>
                    <td>
                      <div class="sk" style="height:12px;width:60%;border-radius:var(--radius-sm)" :style="delay(r+1)"></div>
                    </td>
                    <td>
                      <div class="sk" style="height:14px;width:65%;border-radius:var(--radius-sm)" :style="delay(r+2)"></div>
                    </td>
                    <td>
                      <div class="sk" style="height:22px;width:72px;border-radius:var(--radius-pill)" :style="delay(r+2)"></div>
                    </td>
                    <td style="text-align:end">
                      <div class="sk" style="height:28px;width:64px;border-radius:var(--radius-md);margin-inline-start:auto" :style="delay(r+3)"></div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'order-detail'">
          <div class="sk-order-detail">
            <div class="sk-order-detail__header card" :style="delay(1)">
              <div class="sk" style="width:130px;height:20px;border-radius:var(--radius-pill)"></div>
              <div class="sk" style="width:240px;height:32px;border-radius:var(--radius-md);margin-top:8px"></div>
              <div class="sk" style="width:320px;height:12px;border-radius:var(--radius-sm);margin-top:6px"></div>
            </div>
            <div class="sk-order-detail__stepper card" :style="delay(2)">
              <div v-for="s in 5" :key="s" style="display:flex;flex-direction:column;align-items:center;gap:8px;flex:1">
                <div class="sk" style="width:32px;height:32px;border-radius:50%" :style="delay(s)"></div>
                <div class="sk" style="width:64px;height:10px;border-radius:var(--radius-sm)" :style="delay(s+1)"></div>
              </div>
            </div>
            <div class="sk-order-detail__grid">
              <div class="table-card" :style="delay(3)">
                <div class="table-wrap">
                  <table class="exec-table">
                    <thead>
                      <tr>
                        <th style="width:40%"><div class="sk" style="height:12px;width:70%;border-radius:var(--radius-sm)"></div></th>
                        <th style="width:20%"><div class="sk" style="height:12px;width:60%;border-radius:var(--radius-sm)"></div></th>
                        <th style="width:20%"><div class="sk" style="height:12px;width:60%;border-radius:var(--radius-sm)"></div></th>
                        <th style="width:20%;text-align:end"><div class="sk" style="height:12px;width:50px;border-radius:var(--radius-sm);margin-inline-start:auto"></div></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="r in 3" :key="r" class="exec-row">
                        <td><div class="sk" style="height:14px;width:80%;border-radius:var(--radius-sm)" :style="delay(r)"></div></td>
                        <td><div class="sk" style="height:12px;width:50%;border-radius:var(--radius-sm)" :style="delay(r+1)"></div></td>
                        <td><div class="sk" style="height:14px;width:60%;border-radius:var(--radius-sm)" :style="delay(r+2)"></div></td>
                        <td style="text-align:end"><div class="sk" style="height:14px;width:65px;border-radius:var(--radius-sm);margin-inline-start:auto" :style="delay(r+3)"></div></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="card" style="padding:var(--space-5);display:flex;flex-direction:column;gap:12px" :style="delay(4)">
                <div class="sk" style="width:50%;height:16px;border-radius:var(--radius-sm)"></div>
                <div v-for="r in 4" :key="r" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                  <div class="sk" style="width:35%;height:12px;border-radius:var(--radius-sm)" :style="delay(r)"></div>
                  <div class="sk" style="width:25%;height:12px;border-radius:var(--radius-sm)" :style="delay(r+1)"></div>
                </div>
                <div style="display:flex;justify-content:space-between;padding-top:8px">
                  <div class="sk" style="width:40%;height:18px;border-radius:var(--radius-sm)"></div>
                  <div class="sk" style="width:30%;height:18px;border-radius:var(--radius-sm)"></div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'order-confirm'">
          <div class="sk-order-confirm">
            <div class="sk-order-confirm__hero card" :style="delay(1)">
              <div class="sk" style="width:56px;height:56px;border-radius:50%;margin:0 auto"></div>
              <div class="sk" style="width:140px;height:18px;border-radius:var(--radius-pill);margin:12px auto 0"></div>
              <div class="sk" style="width:60%;height:28px;border-radius:var(--radius-md);margin:10px auto 0"></div>
              <div class="sk" style="width:45%;height:13px;border-radius:var(--radius-sm);margin:8px auto 0"></div>
              <div class="sk" style="width:200px;height:32px;border-radius:var(--radius-pill);margin:14px auto 0"></div>
              <div style="display:flex;justify-content:center;gap:12px;margin-top:18px">
                <div class="sk" style="width:150px;height:38px;border-radius:var(--radius-md)"></div>
                <div class="sk" style="width:130px;height:38px;border-radius:var(--radius-md)"></div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'help-grid'">
          <div class="sk-grid sk-grid--help" :style="{ gap: skeletonGap || '1.25rem' }">
            <div v-for="i in gridCount" :key="i" class="sk-help-card" :style="delay(i)">
              <div class="sk-help-card__top">
                <div class="sk" style="width:38px;height:38px;border-radius:10px" :style="delay(i)"></div>
                <div class="sk" style="width:54px;height:20px;border-radius:var(--radius-pill)" :style="delay(i+1)"></div>
              </div>
              <div class="sk" style="width:70%;height:16px;border-radius:var(--radius-sm);margin-top:12px" :style="delay(i+2)"></div>
              <div class="sk" style="width:90%;height:11px;border-radius:var(--radius-sm);margin-top:8px" :style="delay(i+3)"></div>
              <div class="sk" style="width:65%;height:11px;border-radius:var(--radius-sm);margin-top:4px" :style="delay(i+4)"></div>
              <div style="margin-top:auto;padding-top:14px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
                <div class="sk" style="width:80px;height:12px;border-radius:var(--radius-sm)" :style="delay(i+5)"></div>
                <div class="sk" style="width:16px;height:16px;border-radius:50%" :style="delay(i+6)"></div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'address-grid'">
          <div class="sk-address-cluster">
            <div class="sk-address-cluster__head" :style="delay(1)">
              <div class="sk" style="width:24px;height:24px;border-radius:50%"></div>
              <div class="sk" style="width:140px;height:18px;border-radius:var(--radius-sm)"></div>
              <div class="sk" style="width:64px;height:18px;border-radius:var(--radius-pill)"></div>
              <div class="sk" style="width:80px;height:14px;border-radius:var(--radius-pill);margin-inline-start:auto"></div>
            </div>
            <div class="sk-grid sk-grid--address" :style="{ gap: skeletonGap || '1rem' }">
              <div v-for="i in gridCount" :key="i" class="sk-address-card" :style="delay(i)">
                <div style="display:flex;gap:1rem;align-items:flex-start">
                  <div class="sk" style="width:44px;height:44px;border-radius:12px;flex-shrink:0" :style="delay(i)"></div>
                  <div style="flex:1;display:flex;flex-direction:column;gap:6px">
                    <div class="sk" style="width:70%;height:16px;border-radius:var(--radius-sm)" :style="delay(i+1)"></div>
                    <div class="sk" style="width:45%;height:11px;border-radius:var(--radius-sm)" :style="delay(i+2)"></div>
                    <div style="display:flex;gap:6px;margin-top:6px">
                      <div class="sk" style="width:60px;height:18px;border-radius:var(--radius-pill)" :style="delay(i+3)"></div>
                      <div class="sk" style="width:55px;height:18px;border-radius:var(--radius-pill)" :style="delay(i+4)"></div>
                      <div class="sk" style="width:50px;height:18px;border-radius:var(--radius-pill)" :style="delay(i+5)"></div>
                    </div>
                  </div>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;padding-top:10px;border-top:1px solid var(--border)">
                  <div class="sk" style="width:64px;height:30px;border-radius:var(--radius-md)" :style="delay(i+6)"></div>
                  <div class="sk" style="width:64px;height:30px;border-radius:var(--radius-md)" :style="delay(i+7)"></div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'profile'">
          <div class="sk-profile-grid">
            <div class="sk-profile-sidebar card" :style="delay(1)">
              <div class="sk" style="width:72px;height:72px;border-radius:50%;margin:0 auto"></div>
              <div class="sk" style="width:65%;height:18px;border-radius:var(--radius-sm);margin:14px auto 0"></div>
              <div class="sk" style="width:45%;height:12px;border-radius:var(--radius-sm);margin:6px auto 0"></div>
              <div class="sk" style="width:80px;height:22px;border-radius:var(--radius-pill);margin:10px auto 0"></div>
              <div style="display:flex;flex-direction:column;gap:8px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
                <div v-for="r in 3" :key="r" class="sk" style="height:36px;border-radius:var(--radius-md)" :style="delay(r+2)"></div>
              </div>
            </div>
            <div class="sk-profile-main card" :style="delay(2)">
              <div class="sk" style="width:35%;height:18px;border-radius:var(--radius-sm)"></div>
              <div class="sk" style="width:55%;height:12px;border-radius:var(--radius-sm);margin-top:4px"></div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.5rem">
                <div v-for="r in 4" :key="r" style="display:flex;flex-direction:column;gap:6px">
                  <div class="sk" style="width:35%;height:11px;border-radius:var(--radius-sm)" :style="delay(r+2)"></div>
                  <div class="sk" style="height:40px;border-radius:var(--radius-md)" :style="delay(r+3)"></div>
                </div>
              </div>
              <div style="display:flex;justify-content:flex-end;margin-top:1.5rem">
                <div class="sk" style="width:120px;height:38px;border-radius:var(--radius-md)"></div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'about'">
          <div class="sk-about">
            <div class="sk-about__hero card" :style="delay(1)">
              <div class="sk-about__hero-copy">
                <div class="sk" style="width:120px;height:20px;border-radius:var(--radius-pill)"></div>
                <div class="sk" style="width:85%;height:32px;border-radius:var(--radius-md);margin-top:12px"></div>
                <div class="sk" style="width:95%;height:14px;border-radius:var(--radius-sm);margin-top:10px"></div>
                <div class="sk" style="width:90%;height:14px;border-radius:var(--radius-sm);margin-top:6px"></div>
                <div style="display:flex;gap:8px;margin-top:16px">
                  <div class="sk" style="width:110px;height:24px;border-radius:var(--radius-pill)"></div>
                  <div class="sk" style="width:110px;height:24px;border-radius:var(--radius-pill)"></div>
                </div>
              </div>
              <div class="sk-about__hero-hud sk" :style="delay(2)"></div>
            </div>
            <div class="sk-grid sk-grid--pillars" :style="{ gap: '1.25rem', marginTop: '2rem' }">
              <div v-for="p in 4" :key="p" class="card" style="padding:var(--space-5);display:flex;flex-direction:column;gap:10px" :style="delay(p+2)">
                <div class="sk" style="width:38px;height:38px;border-radius:10px"></div>
                <div class="sk" style="width:65%;height:16px;border-radius:var(--radius-sm);margin-top:6px"></div>
                <div class="sk" style="width:90%;height:12px;border-radius:var(--radius-sm)"></div>
                <div class="sk" style="width:75%;height:12px;border-radius:var(--radius-sm)"></div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'list'">
          <div class="skeleton-wrapper" :style="{ gap: skeletonGap || '10px' }"><div v-for="i in (skeletonCount ?? 4)" :key="i" class="sk-list" :style="delay(i)"><div class="sk sk-list__avatar" :style="delay(i)" /><div style="flex:1;display:flex;flex-direction:column;gap:7px"><div class="sk" style="width:46%;height:13px;border-radius:var(--radius-sm)" :style="delay(i+1)" /><div class="sk" style="width:72%;height:11px;border-radius:var(--radius-sm)" :style="delay(i+2)" /></div><div class="sk" style="width:64px;height:22px;border-radius:var(--radius-pill)" :style="delay(i+2)" /></div></div>
        </template>
        <template v-else-if="skeletonType === 'ticket'">
          <div class="sk-tickets" :style="{ gap: skeletonGap || '10px' }">
            <div v-for="i in (skeletonCount ?? 4)" :key="i" class="sk-ticket" :style="delay(i)">
              <div class="sk-ticket__head">
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
                  <div class="sk" style="width:55%;height:16px;border-radius:var(--radius-sm)" :style="delay(i+1)"></div>
                  <div class="sk" style="width:28%;height:11px;border-radius:var(--radius-sm)" :style="delay(i+2)"></div>
                </div>
                <div class="sk" style="width:76px;height:22px;border-radius:var(--radius-pill);flex-shrink:0" :style="delay(i+1)"></div>
              </div>
              <div class="sk" style="width:94%;height:12px;border-radius:var(--radius-sm)" :style="delay(i+2)"></div>
              <div class="sk" style="width:75%;height:12px;border-radius:var(--radius-sm)" :style="delay(i+3)"></div>
              <div class="sk-ticket__foot">
                <div class="sk" style="width:96px;height:11px;border-radius:var(--radius-sm)" :style="delay(i+3)"></div>
                <div class="sk" style="width:96px;height:30px;border-radius:var(--radius-md)" :style="delay(i+4)"></div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'track'">
          <div class="sk-track" :style="delay(1)">
            <div class="sk-track__card">
              <div class="sk" style="width:34%;height:10px;border-radius:var(--radius-sm)" :style="delay(1)"></div>
              <div class="sk" style="width:52%;height:24px;border-radius:var(--radius-md)" :style="delay(2)"></div>
              <div class="sk" style="width:28%;height:10px;border-radius:var(--radius-sm)" :style="delay(3)"></div>
              <div class="sk-track__steps">
                <div v-for="s in 4" :key="s" class="sk" style="width:22px;height:22px;border-radius:50%" :style="delay(s + 2)"></div>
              </div>
              <div class="sk-track__total">
                <div class="sk" style="width:88px;height:10px;border-radius:var(--radius-sm)" :style="delay(4)"></div>
                <div class="sk" style="width:120px;height:18px;border-radius:var(--radius-sm)" :style="delay(5)"></div>
              </div>
            </div>
            <div class="sk-track__card">
              <div class="sk" style="width:40%;height:14px;border-radius:var(--radius-sm)" :style="delay(3)"></div>
              <div v-for="r in 3" :key="r" class="sk-track__line">
                <div class="sk" style="flex:1;height:12px;border-radius:var(--radius-sm)" :style="delay(r + 3)"></div>
                <div class="sk" style="width:96px;height:12px;border-radius:var(--radius-sm)" :style="delay(r + 4)"></div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'form'">
          <div class="sk-form" :style="{ gap: skeletonGap || '14px' }"><div v-for="i in (skeletonCount ?? 4)" :key="i" style="display:flex;flex-direction:column;gap:7px" :style="delay(i)"><div class="sk" style="width:28%;height:10px;border-radius:var(--radius-sm)" :style="delay(i)" /><div class="sk" style="width:100%;height:42px;border-radius:var(--radius-md)" :style="delay(i+1)" /></div><div style="display:flex;gap:10px;margin-top:6px"><div class="sk" style="height:40px;flex:1;border-radius:var(--radius-pill)" :style="delay(6)" /><div class="sk" style="height:40px;flex:1;border-radius:var(--radius-pill)" :style="delay(7)" /></div></div>
        </template>
        <template v-else-if="skeletonType === 'pills'">
          <div class="sk-pills" :style="{ gap: skeletonGap || '0.5rem' }">
            <div v-for="i in gridCount" :key="i" class="sk sk--pill" :style="delay(i)" />
          </div>
        </template>
        <template v-else-if="skeletonType === 'hero'">
          <div class="sk-hero" :style="delay(1)"><div style="flex:1;display:flex;flex-direction:column;gap:14px"><div class="sk" style="width:32%;height:12px;border-radius:var(--radius-pill)" :style="delay(1)" /><div class="sk" style="width:84%;height:32px;border-radius:var(--radius-md)" :style="delay(2)" /><div class="sk" style="width:76%;height:32px;border-radius:var(--radius-md)" :style="delay(3)" /><div class="sk" style="width:92%;height:14px;border-radius:var(--radius-sm)" :style="delay(4)" /><div class="sk" style="width:88%;height:14px;border-radius:var(--radius-sm)" :style="delay(5)" /><div style="display:flex;gap:12px;margin-top:8px"><div class="sk" style="width:128px;height:42px;border-radius:var(--radius-pill)" :style="delay(6)" /><div class="sk" style="width:128px;height:42px;border-radius:var(--radius-pill)" :style="delay(7)" /></div></div><div class="sk sk-hero__art" :style="delay(4)" /></div>
        </template>
        <template v-else-if="skeletonType === 'store-hero'">
          <div class="sk-store-hero" :style="delay(1)">
            <div class="sk-store-hero__id">
              <div class="sk" style="width:120px;height:120px;border-radius:var(--radius-xl)" :style="delay(1)"></div>
              <div class="sk" style="width:96px;height:20px;border-radius:var(--radius-pill)" :style="delay(2)"></div>
            </div>
            <div class="sk-store-hero__info">
              <div class="sk" style="width:46%;height:28px;border-radius:var(--radius-md)" :style="delay(2)"></div>
              <div class="sk" style="width:62%;height:12px;border-radius:var(--radius-sm)" :style="delay(3)"></div>
              <div style="display:flex;gap:24px;margin-top:10px">
                <div style="display:flex;flex-direction:column;gap:6px"><div class="sk" style="width:56px;height:22px;border-radius:var(--radius-sm)" :style="delay(4)" /><div class="sk" style="width:84px;height:10px;border-radius:var(--radius-sm)" :style="delay(5)" /></div>
                <div style="display:flex;flex-direction:column;gap:6px"><div class="sk" style="width:40px;height:22px;border-radius:var(--radius-sm)" :style="delay(5)" /><div class="sk" style="width:72px;height:10px;border-radius:var(--radius-sm)" :style="delay(6)" /></div>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="skeletonType === 'store-rows'">
          <div class="sk-store-list">
            <div v-for="i in (skeletonCount ?? 5)" :key="i" class="sk-store-row" :style="delay(i)">
              <div class="sk" style="width:64px;height:64px;border-radius:var(--radius-md);flex-shrink:0" :style="delay(i)"></div>
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:7px">
                <div class="sk" style="width:64%;height:14px;border-radius:var(--radius-sm)" :style="delay(i+1)"></div>
                <div class="sk" style="width:38%;height:10px;border-radius:var(--radius-sm)" :style="delay(i+2)"></div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px">
                <div class="sk" style="width:72px;height:16px;border-radius:var(--radius-pill)" :style="delay(i+1)"></div>
                <div class="sk" style="width:88px;height:14px;border-radius:var(--radius-sm)" :style="delay(i+2)"></div>
              </div>
            </div>
          </div>
        </template>
      </slot>
    </div>

    <!-- ══ Empty ════════════════════════════════════════════ -->
    <div v-else-if="resolvedState === 'empty'" class="data-state__empty" :class="{ 'data-state__empty--fill': fill, 'data-state__empty--compact': compact }">
      <div class="data-state__empty__grid" aria-hidden="true"></div>
      <div class="data-state__empty__inner">
        <slot name="empty-icon">
          <div class="empty__halo" aria-hidden="true">
            <div class="empty__icon">
              <span class="material-symbols-outlined icon--directional">{{ icon }}</span>
            </div>
            <span class="empty__halo-ring empty__halo-ring--1"></span>
            <span class="empty__halo-ring empty__halo-ring--2"></span>
          </div>
        </slot>

        <div v-if="emptyCode" class="empty__code mono">
          <span class="empty__code-dot" aria-hidden="true"></span>
          <span>{{ emptyCode }}</span>
          <span class="empty__code-line" aria-hidden="true"></span>
        </div>

        <h3 v-if="emptyTitle" class="empty__title">{{ emptyTitle }}</h3>
        <p v-if="emptyDescription" class="empty__desc">{{ emptyDescription }}</p>

        <div v-if="$slots.default || actionText" class="empty__actions">
          <slot>
            <BaseButton v-if="actionText" variant="primary" size="md" @click="$emit('action')">
              {{ actionText }}
            </BaseButton>
          </slot>
        </div>

        <div v-if="emptyStatus" class="empty__foot mono">
          <span class="empty__foot-dot" aria-hidden="true"></span>
          <span>{{ emptyStatus }}</span>
        </div>
      </div>

      <div class="empty__ticks" aria-hidden="true">
        <span v-for="i in 18" :key="i" class="empty__tick" :class="{ 'empty__tick--major': i % 6 === 0 }"></span>
      </div>
    </div>

    <!-- ══ Error ═════════════════════════════════════════════ -->
    <div v-else-if="resolvedState === 'error'" class="data-state__error">
      <span class="tray__corner tray__corner--tl" aria-hidden="true" />
      <span class="tray__corner tray__corner--tr" aria-hidden="true" />
      <span class="tray__corner tray__corner--bl" aria-hidden="true" />
      <span class="tray__corner tray__corner--br" aria-hidden="true" />
      <span class="tray__tick" aria-hidden="true" />

      <div class="tray__inner">
        <div v-if="errorCode" class="tray__head mono">
          <span>{{ errorCode }}</span>
        </div>

        <div class="tray__mount">
          <slot name="error-icon">
            <div class="tray__icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 4 20 20H4L12 4Z" />
                <line x1="12" y1="10" x2="12" y2="14" />
                <circle cx="12" cy="16.6" r="0.2" fill="currentColor" />
              </svg>
            </div>
          </slot>
          <span class="tray__mount-tick" aria-hidden="true" />
        </div>

        <h3 class="tray__title">{{ errorTitle }}</h3>
        <p class="tray__desc">{{ errorMessage }}</p>

        <div v-if="errorRecoverable" class="tray__actions">
          <BaseButton variant="danger" @click="$emit('retry')">
            ↻ {{ retryText }}
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- ══ Success ═══════════════════════════════════════════ -->
    <div v-else-if="resolvedState === 'success'" class="data-state__content">
      <slot />
    </div>

    <!-- ══ Default / custom content ════════════════════════ -->
    <slot v-else />
  </div>
</template>

<style scoped>
/* ── Root wrapper — True neutral-gray skeleton tokens ── */
.data-state {
  width: 100%;
  text-align: start;
  /* Gray scale for skeletons: base F2F4F6 → highlight E2E6EA */
  --sk-bg:        #F2F4F6;  /* neutral gray base   */
  --sk-border:    #E2E6EA;  /* hairline separator   */
  --sk-shimmer:   rgba(255,255,255,0.75); /* shimmer peak  */
}

/* ── Loading skeleton ─────────────────────────────────── */
.data-state__loading {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
}
.data-state__loading .card,
.data-state__loading .table-card {
  animation: none !important;
}

.skeleton-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

/* ── Core skeleton atom ───────────────────────────────── */
.sk {
  border-radius: var(--radius-sm);
  background-color: var(--sk-bg, #F2F4F6);
  border: 1px solid var(--sk-border, #E2E6EA);
  position: relative;
  overflow: hidden;
  animation: sk-pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  will-change: opacity;
}

/* Traveling shimmer across each atom */
.sk::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--sk-shimmer, rgba(255,255,255,0.75)) 50%,
    transparent 100%
  );
  animation: sk-shimmer 1.8s ease-in-out infinite;
  pointer-events: none;
}

/* Stagger: each atom enters the shimmer at a different phase */
.sk--text   { height: 12px; margin-bottom: 0; }
.sk--card   { border-radius: var(--radius-md); min-height: 120px; }
.sk--circle { border-radius: 50%; flex-shrink: 0; }
.sk--row    { height: 44px; border-radius: var(--radius-md); }

@media (prefers-reduced-motion: reduce) {
  .sk           { animation: none !important; opacity: 0.7; }
  .sk::after    { display: none !important; }
}

@keyframes sk-shimmer {
  0%   { transform: translateX(-130%); }
  100% { transform: translateX(130%); }
}

@keyframes sk-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}

/* ── Legacy alias ─────────────────────────────────────── */
.skeleton-root {
  --sk-bg:     #F2F4F6;
  --sk-border: #E2E6EA;
}

/* card */
.sk-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  background: var(--sk-bg, #F2F4F6);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.sk-card__media {
  height: 160px;
  position: relative;
  display: grid;
  place-items: center;
  border-bottom: 1px solid var(--sk-border, #E2E6EA);
  border-radius: 0;
  background: var(--sk-bg, #F2F4F6);
}

.sk-card__media-badge {
  border-radius: var(--radius-sm, 4px);
}

.sk-card__body {
  padding: 1.05rem 1.05rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  flex: 1;
  background: #FAFBFC;   /* slightly lighter than base for contrast */
}

.sk--eyebrow    { width: 36%; height: 10px; border-radius: var(--radius-sm); }
.sk--title      { width: 94%; height: 13px; border-radius: var(--radius-sm); }
.sk--title-short{ width: 72%; height: 13px; border-radius: var(--radius-sm); }
.sk--caption    { width: 52%; height: 10px; border-radius: var(--radius-sm); opacity: .9; }
.sk--caption-sm { width: 96px; height: 9px;  border-radius: var(--radius-sm); }
.sk--price      { width: 78px; height: 16px; border-radius: var(--radius-sm); }
.sk--rating     { width: 42px; height: 16px; border-radius: var(--radius-sm); }

.sk-card__foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: auto;
  padding-top: 0.6rem;
  gap: 1rem;
}

.sk-card__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.6rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--sk-border, #E2E6EA);
}

.sk--btn         { flex: 1; height: 34px; border-radius: var(--radius-sm); }
.sk--btn-primary { background: #E8EBEE; border-color: #DDE1E6; }

.sk--badge       { width: 52px; height: 16px; border-radius: var(--radius-sm); position: absolute; top: 10px; }
.sk--badge-left  { inset-inline-start: 10px; }
.sk--badge-right { inset-inline-end: 10px; }

/* provider */
.sk-provider {
  background: #FAFBFC;
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.sk-provider__logo {
  height: 110px;
  background: var(--sk-bg, #F2F4F6);
  border-bottom: 1px solid var(--sk-border, #E2E6EA);
}

.sk-provider__body {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 0;
  background: #FAFBFC;
}
.sk-provider__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--sk-border, #E2E6EA);
  background: var(--sk-bg, #F2F4F6);
}

/* provider cards (category-providers page mirror) */
.sk-prov-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-5);
  background: #FAFBFC;
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  box-shadow: var(--shadow-sm);
}
.sk-prov-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

/* cert */
.sk-cert {
  background: #FAFBFC;
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.sk-cert__media {
  height: 160px;
  background: var(--sk-bg, #F2F4F6);
  border-bottom: 1px solid var(--sk-border, #E2E6EA);
}

.sk-cert__body {
  padding: 0.95rem 0.9rem 1.05rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  background: #FAFBFC;
}

/* grids — centered so partial last rows sit mid-container, not left */
.sk-grid {
  display: grid;
  width: 100%;
  justify-content: center;   /* ← partial rows centered */
  justify-items: stretch;
  gap: 1rem;
}
.sk-grid--catalog  { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.sk-grid--category { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
.sk-grid--provider { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.sk-grid--prov-cards { grid-template-columns: repeat(3, minmax(0, 1fr)); }

@media (max-width: 1024px) {
  .sk-grid--catalog,
  .sk-grid--provider {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .sk-grid--catalog,
  .sk-grid--provider {
    grid-template-columns: 1fr;
  }
}

/* ticket cards mirror */
.sk-tickets { display: flex; flex-direction: column; width: 100%; gap: 0.75rem; }
.sk-ticket {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  box-shadow: var(--shadow-sm);
}
.sk-ticket__head { display: flex; align-items: center; gap: var(--space-3); }
.sk-ticket__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--sk-border, #E2E6EA);
}

/* tracking result mirror */
.sk-track { display: flex; flex-direction: column; gap: var(--space-4); width: 100%; }
.sk-track__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  box-shadow: var(--shadow-sm);
}
.sk-track__steps { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); padding: var(--space-2) 0; }
.sk-track__total { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.sk-track__line  { display: flex; align-items: center; gap: var(--space-3); }
@media (max-width: 1024px) {
  .sk-grid--prov-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .sk-grid--prov-cards { grid-template-columns: minmax(0, 1fr); }
}

/* storefront rows + hero mirrors */
.sk-store-list {
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  box-shadow: var(--shadow-sm);
  padding: var(--space-2);
  gap: 0;
}
.sk-store-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--sk-border, #E2E6EA);
}
.sk-store-row:last-child { border-bottom: 0; }
.sk-store-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-6);
  align-items: center;
}
.sk-store-hero__id {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}
.sk-store-hero__info {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}
@media (max-width: 640px) {
  .sk-store-hero { grid-template-columns: minmax(0, 1fr); }
  .sk-store-hero__id { flex-direction: row; }
  .sk-store-row { grid-template-columns: 52px minmax(0, 1fr); }
}
.sk-grid--cert     { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
.sk-grid--stats    { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
.sk-grid--location { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); align-items: start; }

/* category */
.sk-cat {
  background: var(--bg-surface);
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.sk-cat__media {
  height: 110px;
  border-radius: 0;
  border: none;
  border-bottom: 1px solid var(--sk-border, #E2E6EA);
}
.sk-cat__body {
  padding: 0.75rem 0.75rem 0.9rem;
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
}

/* ── Stats skeleton — mirrors StatCard exactly ─────────── */
.sk-stat {
  display: flex;
  flex-direction: column;          /* ← matches StatCard: column */
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-4);
  background: var(--sk-bg, #F2F4F6);
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  box-shadow: none;
  min-height: 100px;
  overflow: hidden;
}

/* header row: label left, [trend pill + icon] right */
.sk-stat__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.sk-stat__head-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* label atom */
.sk-stat__label {
  width: 90px;
  height: 12px;
  border-radius: var(--radius-sm, 4px);
}

/* trend pill atom */
.sk-stat__trend {
  width: 52px;
  height: 18px;
  border-radius: 999px;
}

/* icon circle atom — matches .stat-card__icon-wrap 34×34 */
.sk-stat__icon {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* footer: big value number */
.sk-stat__foot {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}
.sk-stat__value {
  width: 68px;
  height: 28px;
  border-radius: var(--radius-sm, 4px);
}


/* location */
.sk-loc {
  background: #FAFBFC;
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: var(--shadow-sm);
  min-height: 440px;
}

.sk-loc__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--sk-border, #E2E6EA);
}

.sk-loc__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.sk--loc-row {
  height: 42px;
  border-radius: var(--radius-sm, 4px);
  border: 1px solid var(--sk-border, #E2E6EA);
}

/* pdp */
.sk-pdp {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.75rem;
  align-items: start;
  width: 100%;
}

.sk-pdp__gallery {
  min-height: 460px;
  border-radius: var(--radius-card, 8px);
  border: 1px solid var(--sk-border, #E2E6EA);
  background: var(--sk-bg, #F2F4F6);
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.sk-pdp__placeholder {
  width: 100%;
  height: 100%;
  min-height: 420px;
  display: grid;
  place-items: center;
}

.sk-pdp__foot {
  position: absolute;
  bottom: 0;
  inset-inline: 0;
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--sk-border, #E2E6EA);
  background: var(--sk-bg, #F2F4F6);
}

.sk-pdp__order {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sk-pdp__price-card {
  background: #FAFBFC;
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  padding: 1.35rem;
  box-shadow: var(--shadow-sm);
  height: auto;
}

.sk-pdp__tabs {
  background: #FAFBFC;
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  overflow: hidden;
  height: auto;
  min-height: 160px;
}

@media (max-width: 980px) {
  .sk-pdp { grid-template-columns: 1fr; gap: 1.75rem; }
  .sk-pdp__gallery { min-height: 340px; }
}

/* table */
.sk-table {
  background: #FAFBFC;
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.sk-table__head {
  display: grid;
  grid-template-columns: 1.2fr 2fr 120px 120px 160px;
  gap: 1rem;
  padding: 0.85rem 1rem;
  background: var(--sk-bg, #F2F4F6);
  border-bottom: 1px solid var(--sk-border, #E2E6EA);
  align-items: center;
}

.sk-table__head .sk { border: none; }

.sk-table__row {
  display: grid;
  grid-template-columns: 1.2fr 2fr 120px 120px 160px;
  gap: 1rem;
  padding: 0.95rem 1rem;
  border-bottom: 1px solid var(--sk-border, #E2E6EA);
  align-items: center;
}

.sk-table__row:last-child { border-bottom: none; }

.sk-table__cell--avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

@media (max-width: 760px) {
  .sk-table__head, .sk-table__row { grid-template-columns: 1fr; gap: 0.6rem; }
  .sk-table__head { display: none; }
  .sk-table__row  { display: flex; flex-wrap: wrap; }
}

/* list */
.sk-list {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--sk-border, #E2E6EA);
  background: #FAFBFC;
  border-radius: var(--radius-card, 8px);
  box-shadow: var(--shadow-sm);
}

.sk-list__avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* form */
.sk-form {
  display: flex;
  flex-direction: column;
  background: #FAFBFC;
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
}

/* hero */
.sk-hero {
  display: grid;
  grid-template-columns: 1.18fr 0.92fr;
  gap: 3rem;
  align-items: center;
  padding: 1rem 0;
}

.sk-hero__art {
  height: 320px;
  border-radius: var(--radius-card, 8px);
  border: 1px solid var(--sk-border, #E2E6EA);
  background: var(--sk-bg, #F2F4F6);
}

@media (max-width: 900px) {
  .sk-hero { grid-template-columns: 1fr; gap: 1.5rem; }
  .sk-hero__art { height: 220px; }
}

/* pills */
.sk-pills {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.25rem 0;
  width: 100%;
}

.sk--pill {
  height: 34px;
  width: 110px;
  border-radius: var(--radius-sm, 4px);
  flex-shrink: 0;
}

/* help-grid */
.sk-grid--help { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }

.sk-help-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-5);
  background: #FAFBFC;
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  box-shadow: var(--shadow-sm);
  min-height: 160px;
}

.sk-help-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

/* address-grid */
.sk-grid--address { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }

.sk-address-cluster {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.sk-address-cluster__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--sk-border, #E2E6EA);
}

.sk-address-card {
  background: #FAFBFC;
  border: 1px solid var(--sk-border, #E2E6EA);
  border-radius: var(--radius-card, 8px);
  padding: 1rem;
  box-shadow: var(--shadow-sm);
}

/* ── Empty state ──────────────────────────────────────── */
.data-state__empty {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-10) var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  isolation: isolate;
  min-height: 260px;
}

.data-state__empty__grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(203,213,216,0.32) 1px, transparent 1px),
    linear-gradient(90deg, rgba(203,213,216,0.32) 1px, transparent 1px);
  background-size: 22px 22px;
  opacity: 0.14;
  mask: radial-gradient(680px 320px at 50% 38%, black 38%, transparent 82%);
  pointer-events: none;
}

.data-state__empty--fill { flex: 1; min-height: 320px; }
.data-state__empty--compact { padding: 1.8rem 1.25rem 1.5rem; min-height: 180px; }
.data-state__empty--compact .empty__halo { width: 72px; height: 72px; margin-bottom: 1rem; }
.data-state__empty--compact .empty__icon { width: 46px; height: 46px; }
.data-state__empty--compact .empty__icon .material-symbols-outlined { font-size: 22px; }
.data-state__empty--compact .empty__title { font-size: 1rem; }
.data-state__empty--compact .empty__desc { font-size: 0.84rem; }

.data-state__empty__inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 440px;
  width: 100%;
}

.empty__code {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  margin-bottom: 1.1rem;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 0.28rem 0.7rem;
}

.empty__code-dot { width: 6px; height: 6px; border-radius: var(--radius-pill); background: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
.empty__code-line { width: 14px; height: 1px; background: var(--border-strong); margin-inline-start: 0.2rem; }

/* halo */
.empty__halo {
  position: relative;
  width: 84px;
  height: 84px;
  display: grid;
  place-items: center;
  margin-bottom: 1.25rem;
}

.empty__icon {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--brand);
  font-size: 1.5rem;
  box-shadow: var(--shadow-sm);
  position: relative;
  z-index: 2;
}

.empty__icon .material-symbols-outlined { font-size: 26px; font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 28; }

.empty__halo-ring {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-md);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.12);
  pointer-events: none;
}

.empty__halo-ring--1 { inset: 6px; border-color: rgba(var(--wl-primary-rgb), 0.08); }
.empty__halo-ring--2 { inset: -6px; border-radius: 20px; border-style: dashed; border-color: var(--border-strong); opacity: 0.7; }

.empty__title {
  font-family: var(--font-sans);
  font-size: 1.18rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fg-heading);
  margin: 0 0 0.5rem;
  line-height: 1.3;
}

.empty__desc {
  color: var(--fg-muted);
  font-size: 0.92rem;
  line-height: 1.6;
  margin: 0 0 1.35rem;
  max-width: 36ch;
  text-wrap: balance;
}

.empty__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.empty__foot {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 1.4rem;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 0.32rem 0.65rem;
}

.empty__foot-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.empty__ticks {
  position: absolute;
  bottom: 0;
  inset-inline: 0;
  display: flex;
  gap: 6px;
  align-items: flex-end;
  justify-content: center;
  padding: 0.65rem 1rem 0.75rem;
  border-top: 1px solid var(--border);
  background: linear-gradient(180deg, transparent, var(--bg-subtle));
  z-index: 1;
}

.empty__tick { width: 1px; height: 5px; background: var(--border-strong); opacity: 0.5; }
.empty__tick--major { height: 9px; background: var(--fg-heading); opacity: 0.16; }

/* ── Error state (tray) ───────────────────────────────── */
.data-state__error {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-10) var(--space-4);
  background: var(--color-danger-100);
  border: 1px solid var(--color-danger-100);
  border-inline-start: 3px solid var(--fg-danger);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  isolation: isolate;
}

.tray__corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 0 solid var(--fg-danger);
  z-index: 1;
}

.tray__corner--tl { top: 0; inset-inline-start: 0; border-top-width: 2px; border-inline-start-width: 2px; }
.tray__corner--tr { top: 0; inset-inline-end: 0; border-top-width: 2px; border-inline-end-width: 2px; }
.tray__corner--bl { bottom: 0; inset-inline-start: 0; border-bottom-width: 2px; border-inline-start-width: 2px; }
.tray__corner--br { bottom: 0; inset-inline-end: 0; border-bottom-width: 2px; border-inline-end-width: 2px; }

.tray__tick {
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 10px;
  background: var(--fg-danger);
  z-index: 1;
}

.tray__inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 420px;
}

.tray__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  margin-bottom: 1.4rem;
}

.tray__head::before,
.tray__head::after {
  content: '';
  width: 24px;
  height: 1px;
  background: var(--border);
}

.tray__mount { position: relative; margin-bottom: 1.4rem; }

.tray__icon {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  background: var(--bg-surface);
  border: 1px solid var(--fg-danger);
  border-radius: var(--radius-md);
  color: var(--fg-danger);
  box-shadow: inset 0 0 0 4px var(--bg-surface), var(--shadow-sm);
}

.tray__mount-tick {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 1px;
  height: 9px;
  background: var(--fg-danger);
  opacity: 0.8;
}

.tray__title {
  font-family: var(--font-sans);
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--fg-heading);
  margin-bottom: 0.5rem;
}

.tray__desc {
  color: var(--fg-muted);
  font-size: 0.9rem;
  line-height: 1.55;
  margin-bottom: 1.4rem;
}

.tray__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.tray__foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  margin-top: 1.6rem;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}

.tray__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--fg-danger);
  box-shadow: 0 0 0 3px var(--color-danger-100);
}

/* ── Success / Loaded content state ──────────────────── */
.data-state__content {
  width: 100%;
  text-align: start;
}

/* ── Specific Skeleton Structural Layouts ────────────── */
.sk-grid--help { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.sk-grid--address { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }

.sk-help-card {
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  min-height: 180px;
}
.sk-help-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sk-address-cluster {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
}
.sk-address-cluster__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}
.sk-address-card {
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.sk-order-detail {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
}
.sk-order-detail__header,
.sk-order-detail__stepper {
  padding: 1.5rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.sk-order-detail__stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.sk-order-detail__grid {
  display: grid;
  grid-template-columns: 1.8fr 1fr;
  gap: 1.5rem;
  align-items: start;
}
@media (max-width: 900px) {
  .sk-order-detail__grid {
    grid-template-columns: 1fr;
  }
}

.sk-order-confirm {
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
}
.sk-order-confirm__hero {
  padding: 2.5rem 2rem;
  text-align: center;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
}

.sk-profile-grid {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1.5rem;
  align-items: start;
  width: 100%;
}
.sk-profile-sidebar, .sk-profile-main {
  padding: 1.5rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
@media (max-width: 840px) {
  .sk-profile-grid {
    grid-template-columns: 1fr;
  }
}

.sk-about {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
}
.sk-about__hero {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 2rem;
  padding: 2.5rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  align-items: center;
}
.sk-about__hero-hud {
  height: 220px;
  border-radius: var(--radius-lg);
}
.sk-grid--pillars {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}
@media (max-width: 840px) {
  .sk-about__hero {
    grid-template-columns: 1fr;
    padding: 1.5rem;
  }
}

.sk-table-card {
  width: 100%;
}

/* ── Entrance animations ──────────────────────────────── */
@media (prefers-reduced-motion: no-preference) {
  .data-state__empty .empty__halo { animation: haloIn 520ms var(--ease-out) both; }
  .data-state__empty .data-state__empty__inner > *:not(.empty__halo) { animation: riseIn 420ms var(--ease-out) both; }
  .data-state__empty .data-state__empty__inner > *:nth-child(2) { animation-delay: 80ms; }
  .data-state__empty .data-state__empty__inner > *:nth-child(3) { animation-delay: 120ms; }
  .data-state__empty .data-state__empty__inner > *:nth-child(4) { animation-delay: 160ms; }

  .data-state__error .tray__corner,
  .data-state__error .tray__tick,
  .data-state__error .tray__mount-tick {
    animation: inkIn 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .data-state__error .tray__corner--tl { animation-delay: 60ms; }
  .data-state__error .tray__corner--tr { animation-delay: 100ms; }
  .data-state__error .tray__corner--bl { animation-delay: 140ms; }
  .data-state__error .tray__corner--br { animation-delay: 180ms; }
  .data-state__error .tray__inner { animation: riseIn 320ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both; }

  .data-state__content { animation: riseIn 420ms var(--ease-out) both; }
}

@keyframes haloIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
@keyframes riseIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes inkIn { from { opacity: 0; } to { opacity: 0.95; } }

@media (prefers-reduced-motion: reduce) {
  .data-state__empty .empty__halo,
  .data-state__empty .data-state__empty__inner > *:not(.empty__halo),
  .data-state__error .tray__corner,
  .data-state__error .tray__tick,
  .data-state__error .tray__mount-tick,
  .data-state__error .tray__inner,
  .data-state__content {
    animation: none !important;
  }
}
</style>
