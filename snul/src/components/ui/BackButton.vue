<script setup lang="ts">
import { useRouter, useRoute, type RouteLocationRaw } from 'vue-router'
import { computed } from 'vue'
import { t } from '../../i18n'

type Props = {
  /** Override label, defaults to t('common.back') */
  label?: string
  /** Explicit destination — if provided, navigates there instead of history.back() */
  to?: RouteLocationRaw
  /** Fallback when history is empty or `to` not provided. Defaults to '/' */
  fallback?: RouteLocationRaw
  /** Visual variant */
  variant?: 'ghost' | 'outline' | 'minimal'
  /** Hide icon? */
  hideIcon?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
  to: undefined,
  fallback: '/',
  variant: 'ghost',
  hideIcon: false,
})

const router = useRouter()
const route = useRoute()

const displayLabel = computed(() => props.label ?? t('common.back'))

const canGoBack = computed(() => {
  // History API: if we navigated within app, history length > 1 and we have a previous entry
  // Also check if route has `from` query or state — fallback to explicit check
  return window.history.length > 1
})

const handleBack = async () => {
  if (props.to) {
    await router.push(props.to)
    return
  }
  if (canGoBack.value) {
    // Use router.back() which respects SPA history
    router.back()
    // Fallback after 250ms if back didn't change route (e.g., direct entry with history length 1 but stale)
    setTimeout(() => {
      if (router.currentRoute.value.fullPath === route.fullPath) {
        void router.push(props.fallback)
      }
    }, 250)
  } else {
    await router.push(props.fallback)
  }
}
</script>

<template>
  <button
    type="button"
    class="back-button"
    :class="[`back-button--${variant}`]"
    :aria-label="displayLabel"
    @click="handleBack"
  >
    <span v-if="!hideIcon" class="material-symbols-outlined back-button__icon icon--directional" aria-hidden="true">arrow_back</span>
    <span class="back-button__label">{{ displayLabel }}</span>
  </button>
</template>

<style scoped>
.back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid transparent;
  background: transparent;
  color: var(--wl-primary);
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1;
  padding: 0.45rem 0.7rem;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.18s var(--wl-ease-spring);
  user-select: none;
}
.back-button:hover {
  transform: translateX(calc(-2px * var(--wl-dir-sign, 1)));
}
.back-button:active {
  transform: translateX(0);
}
.back-button:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}
.back-button__icon {
  font-size: 18px;
  line-height: 1;
}
.back-button--ghost {
  background: transparent;
  border-color: transparent;
}
.back-button--ghost:hover {
  background: var(--wl-primary-soft);
  border-color: var(--wl-border);
}
.back-button--outline {
  background: var(--wl-surface);
  border-color: var(--wl-border);
  box-shadow: var(--shadow-xs);
}
.back-button--outline:hover {
  background: var(--wl-surface-soft);
  border-color: var(--wl-primary);
  color: var(--wl-primary-hover);
}
.back-button--minimal {
  padding: 0;
  border: none;
  background: none;
  color: var(--wl-primary);
}
.back-button--minimal:hover {
  color: var(--wl-primary-hover);
  background: none;
  transform: translateX(calc(-3px * var(--wl-dir-sign, 1)));
}
</style>
