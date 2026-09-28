<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { t } from '../../i18n'
import { resolveFileUrl, isNullOrPlaceholder, markBrokenUrl, isKnownBrokenUrl } from '../../utils/file-url'

export interface AppImageProps {
  src?: string | null
  alt?: string
  fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  aspectRatio?: string
  loading?: 'lazy' | 'eager'
  placeholderType?: 'product' | 'category' | 'avatar' | 'document' | 'general' | 'company'
  placeholderIcon?: string
  placeholderText?: string
  containerClass?: string
  imageClass?: string
  width?: string | number
  height?: string | number
}

const props = withDefaults(defineProps<AppImageProps>(), {
  src: null,
  alt: '',
  fit: 'cover',
  aspectRatio: '',
  loading: 'lazy',
  placeholderType: 'product',
  placeholderIcon: '',
  placeholderText: '',
  containerClass: '',
  imageClass: '',
  width: undefined,
  height: undefined,
})

const emit = defineEmits<{
  (e: 'load', event: Event): void
  (e: 'error', event: Event): void
}>()

const hasError = ref(false)
const isLoaded = ref(false)

// Reset state if src changes
watch(
  () => props.src,
  () => {
    hasError.value = false
    isLoaded.value = false
  },
)

const resolvedUrl = computed(() => {
  if (isNullOrPlaceholder(props.src)) return ''
  return resolveFileUrl(props.src, '')
})

const showPlaceholder = computed(() => {
  return hasError.value || !resolvedUrl.value || isKnownBrokenUrl(resolvedUrl.value)
})

const defaultIcon = computed(() => {
  if (props.placeholderIcon) return props.placeholderIcon
  switch (props.placeholderType) {
    case 'category':
      return 'category'
    case 'company':
      return 'apartment'
    case 'avatar':
      return 'person'
    case 'document':
      return 'description'
    case 'product':
    case 'general':
    default:
      return 'image_not_supported'
  }
})

const handleLoad = (e: Event) => {
  isLoaded.value = true
  hasError.value = false
  emit('load', e)
}

const handleError = (e: Event) => {
  hasError.value = true
  isLoaded.value = false
  // Remember missing backend files so remounts don't re-request them.
  markBrokenUrl(resolvedUrl.value)
  emit('error', e)
}
</script>

<template>
  <div
    class="app-image-wrap"
    :class="[
      containerClass,
      `app-image-wrap--${placeholderType}`,
      { 'is-placeholder': showPlaceholder, 'is-loaded': isLoaded && !showPlaceholder },
    ]"
    :style="{
      aspectRatio: aspectRatio || undefined,
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
    }"
  >
    <!-- Actual Image -->
    <img
      v-if="!showPlaceholder && resolvedUrl"
      :src="resolvedUrl"
      :alt="alt"
      :loading="loading"
      :class="['app-image__element', imageClass, { 'app-image__element--loaded': isLoaded }]"
      :style="{ objectFit: fit }"
      @load="handleLoad"
      @error="handleError"
    />

    <!-- Polished Placeholder Container -->
    <div
      v-else
      class="app-image-placeholder"
      :class="`app-image-placeholder--${placeholderType}`"
      role="img"
      :aria-label="alt || placeholderText || 'Instrument image placeholder'"
    >
      <!-- Precision Blueprint Grid Background -->
      <div class="placeholder-grid" aria-hidden="true"></div>

      <!-- Corner Caliper Crosshairs -->
      <div class="placeholder-crosshairs" aria-hidden="true">
        <span class="crosshair crosshair--tl"></span>
        <span class="crosshair crosshair--tr"></span>
        <span class="crosshair crosshair--bl"></span>
        <span class="crosshair crosshair--br"></span>
      </div>

      <!-- Icon Container -->
      <div class="placeholder-icon-badge">
        <span class="material-symbols-outlined placeholder-icon">
          {{ defaultIcon }}
        </span>
      </div>

  <!-- Optional SKU or Category Label -->
      <div v-if="placeholderText" class="placeholder-text mono" dir="auto">
        {{ placeholderText }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-image-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-color: var(--wl-surface-soft);
  transition: background-color 0.2s ease;
}

.app-image__element {
  width: 100%;
  height: 100%;
  display: block;
  opacity: 0;
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s ease;
}

.app-image__element--loaded {
  opacity: 1;
}

/* ==========================================================================
   Placeholder Container
   ========================================================================== */
.app-image-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  background: linear-gradient(145deg, color-mix(in srgb, var(--bg-subtle) 88%, var(--brand-soft) 12%) 0%, var(--bg-surface) 100%);
  border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
  user-select: none;
  overflow: hidden;
}

/* Technical Precision Grid */
.placeholder-grid {
  position: absolute;
  inset: 0;
  opacity: 0.45;
  background-image: radial-gradient(var(--wl-border, #D9E2EC) 1px, transparent 1px);
  background-size: 16px 16px;
  background-position: center center;
  pointer-events: none;
}

/* Corner Crosshair Calipers */
.placeholder-crosshairs {
  position: absolute;
  inset: 6px;
  pointer-events: none;
}

.crosshair {
  position: absolute;
  width: 8px;
  height: 8px;
  border-color: var(--wl-border, #D9E2EC);
  opacity: 0.75;
}

.crosshair--tl {
  top: 0;
  left: 0;
  border-top: 1.5px solid;
  border-left: 1.5px solid;
}

.crosshair--tr {
  top: 0;
  right: 0;
  border-top: 1.5px solid;
  border-right: 1.5px solid;
}

.crosshair--bl {
  bottom: 0;
  left: 0;
  border-bottom: 1.5px solid;
  border-left: 1.5px solid;
}

.crosshair--br {
  bottom: 0;
  right: 0;
  border-bottom: 1.5px solid;
  border-right: 1.5px solid;
}

/* Icon Housing */
.placeholder-icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--wl-radius-md, 10px);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  box-shadow: 0 2px 4px rgba(0, 10, 25, 0.04);
  position: relative;
  z-index: 1;
  transition: transform 0.25s ease, border-color 0.25s ease;
}

.placeholder-icon {
  font-size: 24px;
  color: var(--wl-muted, #627D98);
  transition: color 0.25s ease;
}

/* Text / SKU */
.placeholder-text {
  position: relative;
  z-index: 1;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--wl-ink-strong, #102A43);
  background: var(--wl-surface, #FFFFFF);
  padding: 2px 8px;
  border-radius: var(--radius-xs, 3px);
  border: 1px solid var(--wl-border, #D9E2EC);
  max-width: 90%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  font-variant-numeric: tabular-nums;
}


/* Specific Sizes/Variants */
.app-image-wrap--avatar .placeholder-icon-badge {
  border-radius: 9999px;
}

.app-image-wrap--category .placeholder-icon-badge {
  background: var(--wl-primary-soft);
  border-color: rgba(var(--wl-primary-rgb), 0.2);
}

.app-image-wrap--category .placeholder-icon {
  color: var(--wl-primary);
}

/* Hover effects when embedded in cards */
:hover > .app-image-placeholder .placeholder-icon-badge,
.card:hover .placeholder-icon-badge,
.product-card:hover .placeholder-icon-badge,
.cat-card:hover .placeholder-icon-badge {
  transform: scale(1.05);
  border-color: var(--wl-primary);
}

:hover > .app-image-placeholder .placeholder-icon,
.card:hover .placeholder-icon,
.product-card:hover .placeholder-icon,
.cat-card:hover .placeholder-icon {
  color: var(--wl-primary);
}

/* Compact Container Tweaks */
@container (max-width: 120px) {
  .placeholder-icon-badge {
    width: 32px;
    height: 32px;
  }
  .placeholder-icon {
    font-size: 18px;
  }
  .placeholder-brand {
    display: none;
  }
}
</style>
