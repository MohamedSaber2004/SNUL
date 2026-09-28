<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../../i18n'

interface Props {
  page?: number
  modelValue?: number
  totalPages: number
  totalItems?: number
  pageSize?: number
  siblingCount?: number
  showInfo?: boolean
  showPageNumbers?: boolean
  variant?: 'default' | 'table' | 'compact'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  page: 1,
  modelValue: undefined,
  totalPages: 1,
  totalItems: undefined,
  pageSize: 10,
  siblingCount: 1,
  showInfo: undefined,
  showPageNumbers: true,
  variant: 'default',
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:page', value: number): void
  (e: 'update:modelValue', value: number): void
  (e: 'change', value: number): void
}>()

const currentPage = computed(() => {
  if (typeof props.modelValue === 'number') return props.modelValue
  return props.page || 1
})

const hasInfo = computed(() => {
  if (typeof props.showInfo === 'boolean') return props.showInfo
  return typeof props.totalItems === 'number' || props.variant === 'table'
})

const itemRange = computed(() => {
  if (typeof props.totalItems !== 'number') return null
  const start = (currentPage.value - 1) * props.pageSize + 1
  const end = Math.min(currentPage.value * props.pageSize, props.totalItems)
  return { start: Math.max(1, start), end, total: props.totalItems }
})

const paginationRange = computed(() => {
  const total = Math.max(1, props.totalPages)
  const current = Math.min(Math.max(1, currentPage.value), total)
  const siblings = props.siblingCount

  const totalNumbers = siblings * 2 + 5

  if (total <= totalNumbers) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const leftSiblingIndex = Math.max(current - siblings, 1)
  const rightSiblingIndex = Math.min(current + siblings, total)

  const shouldShowLeftDots = leftSiblingIndex > 2
  const shouldShowRightDots = rightSiblingIndex < total - 2

  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = 3 + 2 * siblings
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1)
    return [...leftRange, '...', total]
  }

  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = 3 + 2 * siblings
    const rightRange = Array.from({ length: rightItemCount }, (_, i) => total - rightItemCount + i + 1)
    return [1, '...', ...rightRange]
  }

  if (shouldShowLeftDots && shouldShowRightDots) {
    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i
    )
    return [1, '...', ...middleRange, '...', total]
  }

  return Array.from({ length: total }, (_, i) => i + 1)
})

const goTo = (p: number | string) => {
  if (typeof p !== 'number') return
  if (p < 1 || p > props.totalPages || p === currentPage.value || props.disabled) return
  emit('update:page', p)
  emit('update:modelValue', p)
  emit('change', p)
}
</script>

<template>
  <nav
    v-if="totalPages > 1 || hasInfo"
    class="custom-pagination"
    :class="[
      `custom-pagination--${variant}`,
      { 'custom-pagination--disabled': disabled }
    ]"
    role="navigation"
    :aria-label="t('common.pagination')"
  >
    <div v-if="hasInfo" class="pagination__info mono">
      <template v-if="itemRange">
        <span>{{ t('common.showing') }}</span>
        <strong class="mono-num">{{ itemRange.start }}–{{ itemRange.end }}</strong>
        <span>{{ t('common.of') }}</span>
        <strong class="mono-num">{{ itemRange.total }}</strong>
      </template>
      <template v-else>
        <span>{{ t('common.page', { current: currentPage, total: totalPages }) }}</span>
      </template>
    </div>

    <div v-if="totalPages > 1" class="pagination__controls">
      <button
        type="button"
        class="page-nav-btn page-nav-btn--prev"
        :disabled="currentPage <= 1 || disabled"
        :aria-disabled="currentPage <= 1 || disabled"
        :aria-label="t('common.prev')"
        @click="goTo(currentPage - 1)"
      >
        <span class="material-symbols-outlined icon--directional nav-icon" aria-hidden="true">chevron_left</span>
        <span class="nav-text">{{ t('common.prev') }}</span>
      </button>

      <div v-if="showPageNumbers" class="pagination__pages">
        <template v-for="(item, idx) in paginationRange" :key="idx">
          <span v-if="item === '...'" class="page-ellipsis mono" aria-hidden="true">…</span>
          <button
            v-else
            type="button"
            class="page-num-btn mono-num"
            :class="{ 'is-active': item === currentPage }"
            :aria-current="item === currentPage ? 'page' : undefined"
            :aria-label="t('common.pageNumber', { number: item })"
            :disabled="disabled"
            @click="goTo(item)"
          >
            {{ item }}
          </button>
        </template>
      </div>

      <div v-else class="page-indicator mono">
        <strong class="mono-num">{{ currentPage }}</strong>
        <span class="page-indicator__sep">/</span>
        <span class="mono-num">{{ totalPages }}</span>
      </div>

      <button
        type="button"
        class="page-nav-btn page-nav-btn--next"
        :disabled="currentPage >= totalPages || disabled"
        :aria-disabled="currentPage >= totalPages || disabled"
        :aria-label="t('common.next')"
        @click="goTo(currentPage + 1)"
      >
        <span class="nav-text">{{ t('common.next') }}</span>
        <span class="material-symbols-outlined icon--directional nav-icon" aria-hidden="true">chevron_right</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.custom-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 0.25rem 0.25rem;
  border-top: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  user-select: none;
  flex-wrap: wrap;
}

.custom-pagination:not(:has(.pagination__info)) {
  justify-content: center;
}

.custom-pagination--table {
  padding: 0.75rem 1.15rem;
  background: var(--bg-subtle);
  border-top: 1px solid var(--border);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

.custom-pagination--compact {
  padding: 0.5rem 0;
  gap: 0.5rem;
}

.custom-pagination--disabled {
  opacity: 0.55;
  pointer-events: none;
}

.pagination__info {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--text-sm);
  color: var(--fg-muted);
}

.pagination__info strong {
  color: var(--fg-heading);
  font-weight: var(--weight-semibold);
}

.pagination__controls {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.pagination__pages {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.page-nav-btn,
.page-num-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 34px;
  padding: 0 var(--space-2);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--fg-muted);
  font-size: var(--text-sm);
  font-weight: var(--weight-regular);
  font-family: var(--font-sans);
  cursor: pointer;
  transition: transform 180ms var(--ease-out), border-color 180ms var(--ease-out), color 180ms var(--ease-out), background-color 180ms var(--ease-out), box-shadow 180ms var(--ease-out);
}

.page-nav-btn:not(:disabled):hover,
.page-num-btn:not(:disabled):hover {
  transform: translateY(-2px);
  border-color: var(--brand);
  color: var(--fg-heading);
  background: var(--brand-soft);
  box-shadow: 0 6px 14px color-mix(in srgb, var(--brand) 16%, transparent);
}
.page-num-btn.is-active {
  border-color: var(--brand);
  background: var(--brand);
  color: var(--on-brand, #fff);
  box-shadow: 0 7px 16px color-mix(in srgb, var(--brand) 28%, transparent);
}
.page-nav-btn:focus-visible, .page-num-btn:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--brand) 34%, transparent);
  outline-offset: 2px;
}
@media (hover: none) { .page-nav-btn:not(:disabled):hover, .page-num-btn:not(:disabled):hover { transform: none; } }
@media (max-width: 560px) {
  .custom-pagination { justify-content: center; gap: .75rem; }
  .pagination__info { width: 100%; justify-content: center; order: 2; font-size: var(--text-xs); }
  .pagination__controls { width: 100%; justify-content: center; }
  .page-nav-btn .nav-text { display: none; }
  .page-nav-btn { width: 38px; padding: 0; }
}

.page-nav-btn {
  padding: 0 0.75rem;
  gap: 0.25rem;
}

.page-num-btn {
  min-width: 34px;
  padding: 0 0.5rem;
}

.page-nav-btn:hover:not(:disabled),
.page-num-btn:hover:not(:disabled):not(.is-active) {
  border-color: var(--border-strong);
  color: var(--fg-heading);
}

.page-num-btn.is-active {
  background: var(--brand) !important;
  border-color: var(--brand) !important;
  color: #fff !important;
  font-weight: var(--weight-semibold);
}

.page-nav-btn:focus-visible,
.page-num-btn:focus-visible {
  outline: none;
  box-shadow: var(--ring-focus);
  z-index: 1;
}

.page-nav-btn:disabled,
.page-num-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
  pointer-events: none;
}

.page-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  color: var(--fg-subtle);
  font-size: var(--text-sm);
}

.page-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0 0.5rem;
  font-size: var(--text-sm);
  color: var(--fg-muted);
}

.page-indicator strong {
  color: var(--fg-heading);
}

.nav-icon {
  font-size: 17px;
}

.nav-text {
  font-size: 12.5px;
  font-weight: 500;
}

@media (max-width: 640px) {
  .custom-pagination {
    justify-content: center;
    gap: 0.75rem;
  }
  .pagination__info {
    width: 100%;
    justify-content: center;
  }
  .page-nav-btn .nav-text {
    display: none;
  }
  .page-nav-btn {
    padding: 0 0.45rem;
  }
  .pagination__pages {
    gap: 0.15rem;
  }
  .page-num-btn {
    min-width: 30px;
    height: 30px;
    font-size: 12px;
  }
  .page-nav-btn {
    height: 30px;
  }
}
</style>
