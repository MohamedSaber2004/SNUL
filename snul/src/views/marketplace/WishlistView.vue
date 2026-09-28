<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { wishlistService, authService } from '../../di/container'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { useWishlist } from '../../composables/useWishlist'
import { useCart } from '../../composables/useCart'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import BackButton from '../../components/ui/BackButton.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { formatPrice } from '../../utils/format'

const router = useRouter()
const { add } = useCart()
useWishlist()

const items = computed(() => wishlistService.items.value)
const ids = computed(() => wishlistService.ids.value)
const loading = computed(() => wishlistService.loading.value)
const count = computed(() => wishlistService.count.value)
const isAuthenticated = computed(() => authService.isAuthenticated)
const isOrgUser = computed(() => authService.isOrganizationUser.value)

const localized = (en?: string | null, ar?: string | null) =>
  locale.value === 'ar' ? ar || en || '' : en || ar || ''

onMounted(() => {
  void wishlistService.load()
})

const handleRemove = async (id: string) => {
  await wishlistService.toggleSave(id)
}
const handleAddToCart = (id: string) => {
  const p = items.value.find((x) => x.id === id)
  if (!p) return
  add(p, p.minOrderQty || 1)
}
const handleClearAll = async () => {
  if (!ids.value.length) return
  const ok = await confirmService.confirm({
    title: t('marketplace.wishlistTitle'),
    message: t('marketplace.clearWishlistConfirm'),
    variant: 'danger',
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return
  const toRemove = [...ids.value]
  for (const id of toRemove) await wishlistService.toggleSave(id)
}
const goDetail = (id: string) => {
  void router.push({ name: 'marketplace-product', params: { id } })
}
</script>

<template>
  <div class="page-shell wishlist-view">
    <BackButton fallback="/marketplace" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <router-link to="/marketplace">{{ t('nav.marketplace') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('marketplace.wishlistTitle') }}</span>
    </nav>

    <!-- Header -->
    <header class="wishlist-head">
      <div>
        <div class="head-chip mono">
          <span class="pulse-dot"></span>
          <span>{{ t('marketplace.wishlistCount', { count: count }) }}</span>
        </div>
        <h1 class="head-title">{{ t('marketplace.wishlistTitle') }}</h1>
        <p v-if="items.length" class="head-subtitle">{{ t('marketplace.wishlistEmptyDesc') }}</p>
      </div>

      <div v-if="items.length" class="head-actions">
        <button type="button" class="btn-browse-catalog" @click="router.push({ name: 'marketplace' })">
          <span class="material-symbols-outlined text-[18px]">storefront</span>
          <span>{{ t('marketplace.browseMarketplace') }}</span>
        </button>
        <button type="button" class="btn-clear-all" @click="handleClearAll">
          <span class="material-symbols-outlined text-[18px]">delete_sweep</span>
          <span>{{ t('marketplace.clearAll') }}</span>
        </button>
      </div>
    </header>

    <!-- Loading -->
    <SkeletonLoader v-if="loading" type="catalog-grid" :count="4" />

    <!-- Gated: guest -->
    <EmptyState
      v-else-if="!isAuthenticated"
      icon="favorite"
      :title="t('marketplace.wishlistLoginRequired')"
      :description="t('marketplace.wishlistLoginRequiredDesc')"
      :action-text="t('nav.login')"
      @action="router.push({ name: 'login', query: { redirect: '/wishlist' } })"
    />

    <!-- Gated: non-organization accounts -->
    <EmptyState
      v-else-if="!isOrgUser"
      icon="favorite"
      :title="t('marketplace.wishlistOrgOnly')"
      :description="t('marketplace.wishlistOrgOnlyDesc')"
      :action-text="t('marketplace.browseMarketplace')"
      @action="router.push({ name: 'marketplace' })"
    />

    <!-- Empty -->
    <EmptyState
      v-else-if="!items.length"
      icon="favorite"
      :title="t('marketplace.wishlistEmpty')"
      :description="t('marketplace.wishlistEmptyDesc')"
      :action-text="t('marketplace.browseMarketplace')"
      @action="router.push({ name: 'marketplace' })"
    />

    <!-- Saved instruments -->
    <div v-else class="product-grid">
      <article v-for="p in items" :key="p.id" class="product-card" @click="goDetail(p.id)">
        <div class="product-media" :style="{ background: p.imageGradient || 'var(--wl-surface-soft)' }">
          <AppImage
            :src="p.imageName"
            placeholder-type="product"
            :placeholder-text="p.sku"
            :alt="localized(p.nameEn, p.nameAr)"
            fit="contain"
            class="product-img"
          />
          <span v-if="p.sku" class="sku-tag mono">{{ p.sku }}</span>
          <button
            type="button"
            class="btn-remove-fav"
            :aria-label="t('marketplace.removeFromWishlist')"
            :title="t('marketplace.removeFromWishlist')"
            @click.stop="handleRemove(p.id)"
          >
            <span class="material-symbols-outlined text-[18px]">favorite</span>
          </button>
        </div>

        <div class="product-content">
          <span v-if="p.categoryNameEn || p.categoryNameAr" class="category-tag" dir="auto">
            {{ localized(p.categoryNameEn || '', p.categoryNameAr || '') }}
          </span>
          <h3 class="product-name" dir="auto">{{ localized(p.nameEn, p.nameAr) }}</h3>
          <span class="product-alt-name mono" dir="auto">{{ locale === 'ar' ? p.nameEn : p.nameAr }}</span>
          <div class="product-specs mono">
            <span>{{ p.stock > 0 ? t('marketplace.inStock') : t('marketplace.outOfStock') }}</span>
            <span aria-hidden="true">•</span>
            <span>{{ t('marketplace.minOrder', { qty: p.minOrderQty || 1 }) }}</span>
          </div>

          <div class="product-footer">
            <div class="price-stack">
              <strong class="price-val mono">
                {{ formatPrice(p.price, locale) }} {{ p.currencySymbol || p.currencyCode || '$' }}
              </strong>
              <span v-if="p.unit" class="unit-text mono">
                {{ t('marketplace.perUnit', { unit: locale === 'ar' ? (p.unitAr || p.unit) : p.unit }) }}
              </span>
            </div>
            <button type="button" class="btn-add-quote mono" @click.stop="handleAddToCart(p.id)">
              <span>{{ t('marketplace.addToQuote') }}</span>
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.wishlist-view {
  width: 100%;
}

.crumb-bar {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 11px;
  color: var(--wl-muted);
}

.crumb-bar a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.crumb-bar a:hover {
  color: var(--wl-primary);
}

.crumb-sep {
  color: var(--wl-muted-soft);
}

.crumb-active {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

.wishlist-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  letter-spacing: 0.06em;
  margin-bottom: 0.5rem;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-primary);
}

.head-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: 1.68rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.1;
}

.count-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--wl-muted);
  vertical-align: middle;
}

.head-subtitle {
  font-size: 13.5px;
  color: var(--wl-muted);
  margin: 0.25rem 0 0;
}

.head-actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
}

.btn-clear-all {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 44px;
  padding: 0 1rem;
  background: var(--wl-surface);
  border: 1.5px solid rgba(237, 66, 69, 0.35);
  color: var(--wl-danger);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-clear-all:hover {
  background: var(--wl-danger-soft);
}

.btn-browse-catalog {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  height: 44px;
  padding: 0 1.25rem;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px -2px rgba(105, 169, 255, 0.35);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-browse-catalog:hover {
  background: var(--wl-primary-hover);
  transform: translateY(-1px);
}

/* Product Grid */
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}

.product-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  box-shadow: var(--shadow-xs);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.product-card:hover {
  border-color: var(--wl-border-strong);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px -4px rgba(0, 10, 25, 0.08);
}

.product-media {
  height: 160px;
  position: relative;
  display: grid;
  place-items: center;
  background: var(--wl-surface-soft);
  border-bottom: 1px solid var(--wl-border);
  overflow: hidden;
}

.product-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.product-card:hover .product-img {
  transform: scale(1.04);
}

.sku-tag {
  position: absolute;
  bottom: 8px;
  inset-inline-start: 8px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--wl-border);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-ink-soft);
}

.btn-remove-fav {
  position: absolute;
  top: 8px;
  inset-inline-end: 8px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  color: var(--wl-danger);
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: var(--shadow-xs);
  transition: all 0.15s ease;
}

.btn-remove-fav:hover {
  background: var(--wl-danger-soft);
  border-color: rgba(237, 66, 69, 0.35);
}

.product-content {
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
}

.category-tag {
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-primary);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.product-name {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.35;
}

.product-alt-name {
  font-size: 11px;
  color: var(--wl-muted-soft);
}

.product-specs {
  font-size: 11px;
  color: var(--wl-muted);
  margin-top: 0.2rem;
}

.product-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.85rem;
  border-top: 1px dashed var(--wl-border);
}

.price-stack {
  display: flex;
  flex-direction: column;
}

.price-val {
  font-size: 15px;
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.unit-text {
  font-size: 10.5px;
  color: var(--wl-muted);
}

.btn-add-quote {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  height: 36px;
  padding: 0 0.85rem;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-add-quote:hover {
  background: var(--wl-primary-hover);
}

/* Responsive */
@media (max-width: 900px) {
  .product-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}

@media (max-width: 640px) {
  .wishlist-view {
    padding: 1rem 0.85rem 6rem;
  }
  .wishlist-head {
    gap: 1rem;
  }
  .head-title {
    font-size: 1.4rem;
  }
  .head-actions {
    width: 100%;
  }
  .head-actions .btn-browse-catalog,
  .head-actions .btn-clear-all {
    flex: 1;
    justify-content: center;
    height: 42px;
    font-size: 12.5px;
  }
  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.7rem;
  }
  .product-media {
    height: 118px;
  }
  .product-content {
    padding: 0.75rem 0.8rem;
  }
  .product-name {
    font-size: 13px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .product-specs {
    font-size: 10px;
  }
  .product-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 0.6rem;
  }
  .btn-add-quote {
    width: 100%;
    justify-content: center;
    height: 40px;
  }
}

@media (max-width: 380px) {
  .product-grid {
    grid-template-columns: 1fr;
  }
  .product-media {
    height: 150px;
  }
}
</style>




