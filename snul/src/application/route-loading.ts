import { ref } from 'vue'

/**
 * Lightweight signal that is only ever set by the router's beforeEach / afterEach
 * guards. This is intentionally separate from requestTracker so the global
 * loading spinner fires *only* during page navigation — never during in-page
 * API calls (pagination, search, section data fetch, etc.).
 */
export const routeLoading = ref(false)
