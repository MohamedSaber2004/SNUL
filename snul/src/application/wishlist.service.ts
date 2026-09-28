import { ref, computed } from 'vue'
import type { ProductDto } from '../domain/models/marketplace'
import type { WishlistRepository } from '../domain/ports/wishlist-repository'
import type { AuthService } from './auth.service'
import { toastService } from '../infrastructure/feedback/toast.service'
import { t } from '../i18n'

export class WishlistService {
  readonly ids = ref<string[]>([])
  readonly items = ref<ProductDto[]>([])
  readonly loading = ref(false)
  readonly count = computed(() => this.ids.value.length)

  private readonly repo: WishlistRepository
  private readonly authService: AuthService
  private loaded = false

  constructor(repo: WishlistRepository, authService: AuthService) {
    this.repo = repo
    this.authService = authService
    // Only hydrate if the current session is an organization user; otherwise keep empty
    if (this.canEditWishlist()) this.hydrateFromStorage()
  }

  private storageKey = 'snul-wishlist'
  private legacyStorageKey = 'welco-wishlist'
  private compareKey = 'snul-compare'
  private legacyCompareKey = 'welco-compare'

  /** Only authenticated OrganizationUser may manage wishlist */
  private canEditWishlist(): boolean {
    return this.authService.isAuthenticated && this.authService.isOrganizationUser.value
  }

  private assertCanEdit(): boolean {
    if (!this.authService.isAuthenticated) {
      toastService.error(t('marketplace.wishlistLoginRequired'))
      return false
    }
    if (!this.authService.isOrganizationUser.value) {
      toastService.error(t('marketplace.wishlistOrgOnly'))
      return false
    }
    return true
  }

  private hydrateFromStorage() {
    try {
      const raw = localStorage.getItem(this.storageKey) || localStorage.getItem(this.legacyStorageKey)
      if (raw) {
        const arr = JSON.parse(raw) as string[]
        if (Array.isArray(arr)) this.ids.value = arr
      }
    } catch {}
  }

  private persistToStorage() {
    try {
      const val = JSON.stringify(this.ids.value)
      localStorage.setItem(this.storageKey, val)
      localStorage.setItem(this.legacyStorageKey, val)
    } catch {}
  }

  private clearStorage() {
    try {
      localStorage.removeItem(this.storageKey)
      localStorage.removeItem(this.legacyStorageKey)
    } catch {}
    this.ids.value = []
    this.items.value = []
  }

  async load(): Promise<void> {
    if (!this.canEditWishlist()) {
      this.clearStorage()
      this.loading.value = false
      return
    }
    if (this.loaded) return
    this.loading.value = true
    try {
      const list = await this.repo.getWishlist()
      this.items.value = list
      this.ids.value = list.map(p => p.id)
      this.persistToStorage()
      this.loaded = true
    } catch {
      // keep existing ids/items if fetch fails; do not fall back to guest storage
      this.loading.value = false
    } finally {
      this.loading.value = false
    }
  }

  async refresh(): Promise<void> {
    this.loaded = false
    await this.load()
  }

  isSaved(id: string): boolean {
    if (!this.canEditWishlist()) return false
    return this.ids.value.includes(id)
  }

  /** Exposed read-only gate for UI: true only for authenticated OrganizationUser */
  readonly canEdit = computed(() => this.canEditWishlist())

  async toggleSave(id: string): Promise<{ ok: boolean; reason?: 'auth' | 'role' }> {
    if (!this.assertCanEdit()) {
      const reason = !this.authService.isAuthenticated ? 'auth' as const : 'role' as const
      return { ok: false, reason }
    }
    const wasSaved = this.isSaved(id)
    if (wasSaved) {
      // optimistic remove
      this.ids.value = this.ids.value.filter(x => x !== id)
      this.items.value = this.items.value.filter(p => p.id !== id)
      this.persistToStorage()
      try {
        await this.repo.removeFromWishlist(id)
        toastService.success(t('common.savedSuccessfully'))
        return { ok: true }
      } catch {
        // revert on failure
        this.ids.value = [...this.ids.value, id]
        this.persistToStorage()
        toastService.error(t('common.error'))
        return { ok: false, reason: 'role' }
      }
    } else {
      this.ids.value = [...this.ids.value, id]
      this.persistToStorage()
      try {
        await this.repo.addToWishlist(id)
        toastService.success(t('common.savedSuccessfully'))
        await this.refresh()
        return { ok: true }
      } catch {
        this.ids.value = this.ids.value.filter(x => x !== id)
        this.persistToStorage()
        toastService.error(t('common.error'))
        return { ok: false, reason: 'role' }
      }
    }
  }

  // Compare handling (local only, no backend yet)
  readonly compareIds = ref<string[]>( (() => {
    try {
      const raw = typeof window !== 'undefined'
        ? (localStorage.getItem(this.compareKey) || localStorage.getItem(this.legacyCompareKey))
        : null
      return raw ? JSON.parse(raw) as string[] : []
    } catch { return [] }
  })() )

  isCompared(id: string): boolean {
    return this.compareIds.value.includes(id)
  }
  toggleCompare(id: string): void {
    if (this.isCompared(id)) this.compareIds.value = this.compareIds.value.filter(x => x !== id)
    else {
      if (this.compareIds.value.length >= 4) this.compareIds.value = this.compareIds.value.slice(1)
      this.compareIds.value = [...this.compareIds.value, id]
    }
    try {
      const val = JSON.stringify(this.compareIds.value)
      localStorage.setItem(this.compareKey, val)
      localStorage.setItem(this.legacyCompareKey, val)
    } catch {}
  }

  clear(): void {
    this.ids.value = []
    this.items.value = []
    this.persistToStorage()
    this.loaded = false
  }
}
