import { onMounted, computed, getCurrentInstance } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { wishlistService } from '../di/container'
import { authService } from '../di/container'

export function useWishlist() {
  const wishlistIds = wishlistService.ids
  const compareIds = wishlistService.compareIds
  const canEditWishlist = computed(() => wishlistService.canEdit.value)
  const isOrganizationUser = computed(() => authService.isOrganizationUser.value)
  const isAuthenticated = computed(() => authService.isAuthenticated)

  // capture router/route during setup for later redirect (avoid calling composable outside setup)
  let _router: ReturnType<typeof useRouter> | null = null
  let _route: ReturnType<typeof useRoute> | null = null
  try { _router = useRouter(); _route = useRoute() } catch {}

  if (getCurrentInstance()) {
    onMounted(() => { void wishlistService.load() })
  } else {
    void wishlistService.load()
  }

  function isSaved(id: string) { return wishlistService.isSaved(id) }
  async function toggleSave(id: string) {
    const res = await wishlistService.toggleSave(id)
    if (!res.ok && res.reason === 'auth' && _router && _route) {
      const redirect = _route.fullPath || '/wishlist'
      void _router.push({ name: 'login', query: { redirect } })
    }
    return res
  }
  function isCompared(id: string) { return wishlistService.isCompared(id) }
  function toggleCompare(id: string) { wishlistService.toggleCompare(id) }
  return { wishlistIds, compareIds, canEditWishlist, isOrganizationUser, isAuthenticated, isSaved, toggleSave, isCompared, toggleCompare, wishlistService }
}
