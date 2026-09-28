import { ref } from 'vue'

/* Light-only mode — dark theme removed per requirement.
 * The whole site is always white/light (F7F8FC app, FFFFFF surfaces).
 * This module keeps its public API (theme / applyTheme / initTheme /
 * applyAuthGatedTheme) so existing callers keep working, but every path
 * resolves to 'light' and purges any stale dark/system preference. */

export type Theme = 'light'

export const theme = ref<Theme>('light')

const META_LIGHT = '#F7F8FC'
const STORAGE_KEY = 'snul-theme'
const LEGACY_STORAGE_KEY = 'welco-theme'

const lockLightDom = () => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = 'light'
  root.classList.remove('dark')
  root.style.colorScheme = 'light'
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null
  if (meta) meta.content = META_LIGHT
}

export const applyTheme = (_value?: unknown) => {
  theme.value = 'light'
  try {
    localStorage.setItem(STORAGE_KEY, 'light')
    localStorage.setItem(LEGACY_STORAGE_KEY, 'light')
  } catch { /* ignore */ }
  lockLightDom()
}

export const initTheme = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && raw !== 'light') localStorage.setItem(STORAGE_KEY, 'light')
  } catch { /* ignore */ }
  theme.value = 'light'
  lockLightDom()
}

initTheme()

export const applyAuthGatedTheme = () => {
  initTheme()
}
