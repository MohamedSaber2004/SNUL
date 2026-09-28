import { computed, onMounted } from 'vue'
import { contentService } from '../di/container'

let initialized = false

if (typeof window !== 'undefined') {
  window.addEventListener('snul:content-changed', () => {
    void contentService.loadSiteLogo().catch(() => {})
  })
}

/**
 * Provides the reactive site logo, loading it once globally.
 * Returns empty string if no dynamic logo is configured (no static fallback).
 */
export function useSiteLogo() {
  const logoUrl = computed(() => {
    const url = contentService.siteLogo.value.logoUrl
    return url && url.trim() ? url.trim() : ''
  })

  const hasLogo = computed(() => Boolean(logoUrl.value))
  const altText = computed(() => contentService.siteLogo.value.altText || 'SNUL')
  const logoData = computed(() => contentService.siteLogo.value)

  onMounted(() => {
    if (!initialized) {
      initialized = true
      void contentService.loadSiteLogo().catch(() => {})
    }
  })

  const refreshLogo = () => contentService.loadSiteLogo()

  return { logoUrl, hasLogo, altText, logoData, refreshLogo }
}
