<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { contentRepository, marketplaceRepository } from '../../di/container'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import DataState from '../../components/ui/DataState.vue'
import ErrorState from '../../components/ui/ErrorState.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BackButton from '../../components/ui/BackButton.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { useCart } from '../../composables/useCart'
import { toastService } from '../../infrastructure/feedback/toast.service'
import type { LandingPageDto } from '../../domain/models/content'
import type { ProductDto, CategoryDto } from '../../domain/models/marketplace'
import { productMediaUrl } from '../../utils/file-url'
import { formatPrice } from '../../utils/format'

const route = useRoute()
const router = useRouter()
const { add } = useCart()

const page = ref<LandingPageDto | null>(null)
const loading = ref(true)
const error = ref('')
const products = ref<ProductDto[]>([])
const categories = ref<CategoryDto[]>([])
const relatedPages = ref<LandingPageDto[]>([])

const localized = (en: string, ar: string) => (locale.value === 'ar' ? ar : en)
const slug = computed(() => String(route.params.slug || ''))

async function load(s: string) {
  loading.value = true
  error.value = ''
  page.value = null
  products.value = []
  categories.value = []
  try {
    const found = await contentRepository.getLandingPageBySlug(s).catch(() => null)
    if (found) {
      page.value = found
      const [list, prodRes] = await Promise.allSettled([
        contentRepository.getLandingPages({ pageNumber: 1, pageSize: 50 }),
        found.categoryId ? marketplaceRepository.getProducts({ categoryId: found.categoryId, page: 1, pageSize: 8 }).catch(() => ({ data: [] as ProductDto[] })) : Promise.resolve({ data: [] as ProductDto[] }),
      ])
      if (list.status === 'fulfilled' && list.value?.data) {
        relatedPages.value = (list.value.data as LandingPageDto[]).filter((p: LandingPageDto) => p.slug !== s && p.type === 'Specialty').slice(0, 4)
      }
      if (prodRes.status === 'fulfilled' && (prodRes.value as { data?: ProductDto[] })?.data) {
        products.value = (prodRes.value as { data: ProductDto[] }).data
      }
    } else {
      const [prodRes, catRes, listRes] = await Promise.allSettled([
        marketplaceRepository.getProducts({ page: 1, pageSize: 12 }).catch(() => ({ data: [] as ProductDto[] })),
        marketplaceRepository.getCategories().catch(() => [] as CategoryDto[]),
        contentRepository.getLandingPages({ pageNumber: 1, pageSize: 8 }).catch(() => ({ data: [] as LandingPageDto[] })),
      ])
      if (catRes.status === 'fulfilled' && Array.isArray(catRes.value)) {
        categories.value = (catRes.value as CategoryDto[]).slice(0, 8) as CategoryDto[]
        const matched = (catRes.value as CategoryDto[]).find((c) => c.slug === s || c.nameEn?.toLowerCase().replace(/\s+/g, '-') === s.toLowerCase())
        if (matched) {
          const byCat = await marketplaceRepository.getProducts({ categoryId: matched.id, page: 1, pageSize: 12 }).catch(() => ({ data: [] as ProductDto[] }))
          if ((byCat as { data?: ProductDto[] })?.data) products.value = (byCat as { data: ProductDto[] }).data
        } else if (prodRes.status === 'fulfilled') {
          products.value = ((prodRes.value as { data?: ProductDto[] })?.data as ProductDto[]) || []
        }
      }
      if (listRes.status === 'fulfilled' && (listRes.value as { data?: LandingPageDto[] })?.data) {
        relatedPages.value = ((listRes.value as { data: LandingPageDto[] }).data as LandingPageDto[]).filter((p) => p.type === 'Specialty').slice(0, 4)
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => load(slug.value))
watch(() => route.params.slug, (s) => load(String(s)))

const handleAddToQuote = (e: Event, p: ProductDto) => {
  e.stopPropagation()
  add(p, 1)
  toastService.success(t('catalog.quoteSuccess', { product: localized(p.nameEn, p.nameAr) }))
}

const heroTitle = computed(() => page.value ? localized(page.value.heroTitle || page.value.slug, page.value.heroTitle || page.value.slug) : localized(slug.value.replace(/-/g, ' '), slug.value.replace(/-/g, ' ')))
const heroBody = computed(() => page.value?.heroBody || t('home.heroSubtitle'))
</script>

<template>
  <div class="page-shell landing-shell">
    <div class="landing-topbar">
      <nav class="landing-crumb mono" :aria-label="t('common.breadcrumb')">
        <router-link to="/">{{ t('nav.home') }}</router-link>
        <span class="crumb-sep">/</span>
        <router-link to="/marketplace">{{ t('nav.marketplace') }}</router-link>
        <span class="crumb-sep">/</span>
        <span class="crumb-current">{{ page ? localized(page.slug, page.slug) : slug }}</span>
      </nav>
      <BackButton />
    </div>

    <SkeletonLoader v-if="loading" type="catalog-grid" :count="8" />

    <ErrorState v-else-if="error" :message="error" @retry="load(slug)" />

    <template v-else>
      <section class="lp-hero">
        <div class="lp-hero__glow" aria-hidden="true"></div>
        <div class="lp-hero__inner">
          <div>
            <div class="lp-eyebrow mono">
              <span class="lp-dot" aria-hidden="true"></span>
              <span class="lp-tag mono">{{ page ? page.type : t('nav.catalog') }}</span>
              <span class="lp-url mono">/catalog/{{ page ? page.slug : slug }}</span>
            </div>
            <h1 class="lp-title">{{ heroTitle }}</h1>
            <p class="lp-body">{{ heroBody }}</p>
            <div class="lp-actions">
              <BaseButton variant="primary" @click="router.push({ name: 'marketplace' })">{{ t('landing.browseInstruments') }}</BaseButton>
              <BaseButton variant="outline" @click="router.push({ name: 'marketplace' })">{{ t('landing.requestQuote') }}</BaseButton>
            </div>
            <div class="lp-credentials mono">
              <span>{{ t('landing.manufactured') }}</span>
            </div>
          </div>
          <div class="lp-spec-card mono" aria-hidden="true">
            <div class="spec-card__header">
              <span class="spec-card__tag">SPEC · {{ page ? page.type?.toUpperCase() : 'CATALOG' }}</span>
              <span class="spec-card__live"><span class="spec-dot"></span> LIVE</span>
            </div>
            <div class="spec-card__body">
              <div class="spec-item"><span class="spec-item__label">ORIGIN</span><strong class="spec-item__val">Sialkot · Tuttlingen</strong></div>
              <div class="spec-item"><span class="spec-item__label">STEEL</span><strong class="spec-item__val">AISI 420 · 1.4021</strong></div>
              <div class="spec-item"><span class="spec-item__label">TOLERANCE</span><strong class="spec-item__val">±0.02 mm</strong></div>
            </div>
            <div class="spec-card__footer mono">
              <span class="spec-brand">SNUL</span><span>{{ products.length }} instruments indexed</span>
            </div>
          </div>
        </div>
      </section>

      <DataState :loading="loading" skeleton-type="catalog-grid" :skeleton-count="4" :empty="!products.length && !loading" :empty-title="t('marketplace.noProducts')" :empty-description="t('marketplace.noProductsDesc')" :empty-icon="'inventory_2'" @action="router.push({ name: 'marketplace' })" min-height="180px">
        <section class="lp-products-section" aria-labelledby="products-heading">
          <div class="section-head">
            <div>
              <div class="section-eyebrow mono"><span class="eyebrow-dot"></span>{{ t('landing.featuredProducts') }}</div>
              <h2 id="products-heading" class="section-title">{{ heroTitle }}</h2>
            </div>
            <button class="view-all-btn" type="button" @click="router.push({ name: 'marketplace' })">{{ t('common.next') }} <span class="icon--directional">→</span></button>
          </div>
          <div class="product-grid">
            <article v-for="p in products" :key="p.id" class="product-card" @click="router.push({ name: 'marketplace-product', params: { id: p.id } })">
              <div class="product-card__media" :style="{ background: productMediaUrl(p.imageName, p.imageGradient).background }">
                <AppImage
                  :src="p.imageName"
                  placeholder-type="product"
                  :alt="localized(p.nameEn, p.nameAr)"
                  fit="cover"
                  class="product-card__img"
                />
              </div>
              <div class="product-card__body">
                <div class="mono" style="font-size:10px;color:var(--wl-muted)">{{ localized(p.categoryNameEn || '', p.categoryNameAr || '') }}</div>
                <h3 class="product-card__name" dir="auto">{{ localized(p.nameEn, p.nameAr) }}</h3>
                <div class="product-card__meta mono">{{ p.material || '—' }} <span class="meta-dot">·</span> {{ p.lengthCm ? `${p.lengthCm} cm` : '—' }}</div>
                <div class="product-card__bottom">
                  <span class="price-val mono-num">{{ formatPrice(p.price, locale) }} {{ p.currencySymbol || p.currencyCode || '$' }}</span>
                  <button class="add-quote-btn" type="button" @click="handleAddToQuote($event, p)">{{ t('marketplace.addToQuote') }}</button>
                </div>
              </div>
            </article>
          </div>
        </section>
      </DataState>

      <section v-if="!page && categories.length" class="lp-related-section" style="margin-top:1.5rem">
        <h3 class="section-title" style="font-size:1.15rem;margin-bottom:1rem">{{ t('marketplace.categoriesTitle') }}</h3>
        <div class="related-grid">
          <router-link v-for="c in categories" :key="c.id" :to="{ name: 'marketplace', query: { categoryId: c.id } }" class="cat-card">
            <div class="cat-media">
              <AppImage
                :src="c.imageName"
                placeholder-type="category"
                :placeholder-text="localized(c.nameEn, c.nameAr)"
                :alt="localized(c.nameEn, c.nameAr)"
                class="cat-media__img"
              />
            </div>
            <div class="cat-body">
              <div class="cat-name" dir="auto">{{ localized(c.nameEn, c.nameAr) }}</div>
                <span class="mono cat-count">{{ t('landing.instrumentsCount', { count: c.productCount ?? 0 }) }}</span>
            </div>
          </router-link>
        </div>
      </section>

      <section v-if="relatedPages.length" class="lp-related-section">
        <h3 class="section-title" style="font-size:1.15rem;margin-bottom:1rem">{{ t('landing.relatedSpecialties') }}</h3>
        <div class="related-grid">
          <router-link v-for="rp in relatedPages" :key="rp.id" :to="{ name: 'landing-page', params: { slug: rp.slug } }" class="related-card">
            <div class="related-card__header">
              <span class="related-type mono">{{ rp.type }}</span>
              <span class="material-symbols-outlined related-arrow icon--directional">arrow_forward</span>
            </div>
            <h4 class="related-title" dir="auto">{{ localized(rp.heroTitle || rp.slug, rp.heroTitle || rp.slug) }}</h4>
              <span class="related-link mono">{{ t('landing.browseInstruments') }} <span class="icon--directional">→</span></span>
          </router-link>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.landing-shell {
  max-width: var(--wl-max-width);
  margin: 0 auto;
  padding: var(--wl-page-padding-top) var(--wl-gutter) var(--wl-page-padding-bottom);
  padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left));
  padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right));
  width: 100%;
  box-sizing: border-box;
}

.landing-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.landing-crumb {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
  color: var(--wl-muted);
  background: var(--wl-surface);
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  border: 1px solid var(--wl-border);
}

.landing-crumb a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s;
}

.landing-crumb a:hover {
  color: var(--wl-ink-strong);
}

.crumb-sep {
  opacity: 0.5;
  font-size: 11px;
}

.crumb-current {
  color: var(--wl-ink-strong);
  font-weight: 600;
}

.lp-hero {
  position: relative;
  border-radius: var(--wl-radius-xl);
  background: linear-gradient(135deg, var(--wl-surface) 0%, var(--wl-surface-soft) 100%);
  border: 1px solid var(--wl-border);
  padding: 2.75rem 2.5rem;
  box-shadow: 0 4px 20px -2px rgba(0, 10, 25, 0.05);
  overflow: hidden;
  margin-bottom: 2rem;
}

.lp-hero::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
}

.lp-hero__glow {
  position: absolute;
  top: -120px;
  inset-inline-end: -80px;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, var(--wl-primary-faint) 0%, transparent 70%);
  pointer-events: none;
}

.lp-hero__inner {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 2.5rem;
  align-items: center;
}

.lp-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 11px;
  margin-bottom: 1rem;
}

.lp-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-gold);
  box-shadow: 0 0 8px var(--wl-gold-glow-soft);
}

.lp-tag {
  background: var(--wl-gold-soft);
  color: var(--wl-gold);
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-sm);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border: 1px solid rgba(255, 209, 102, 0.35);
  text-shadow: var(--wl-gold-text-shadow);
}

.lp-url {
  color: var(--wl-muted);
  font-size: 11px;
}

.lp-title {
  font-size: clamp(2rem, 4vw, 3.1rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
  margin-bottom: 1rem;
  background: var(--wl-gradient-gold);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: var(--wl-gold-text-filter);
}

.lp-body {
  color: var(--wl-ink-soft);
  font-size: 15.5px;
  line-height: 1.65;
  max-width: 620px;
  margin-bottom: 1.8rem;
}

.lp-actions {
  display: flex;
  gap: 0.85rem;
  margin-bottom: 1.75rem;
  flex-wrap: wrap;
}

.lp-credentials {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11.5px;
  color: var(--wl-muted);
}

.lp-spec-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--wl-radius-lg);
  padding: 1.5rem;
  box-shadow: var(--wl-shadow-card);
}

.spec-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid var(--wl-border);
  margin-bottom: 1rem;
}

.spec-card__tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--wl-primary);
}

.spec-card__live {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 10px;
  color: var(--wl-gold);
  font-weight: 600;
}

.spec-dot {
  width: 5px;
  height: 5px;
  background: var(--wl-gold);
  border-radius: 50%;
}

.spec-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin-bottom: 1.15rem;
}

.spec-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.spec-item__label {
  font-size: 10px;
  color: var(--wl-muted);
  letter-spacing: 0.06em;
}

.spec-item__val {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--wl-ink-strong);
}

.spec-card__footer {
  padding-top: 0.9rem;
  border-top: 1px solid var(--wl-border);
  display: flex;
  justify-content: space-between;
  font-size: 9.5px;
  color: var(--wl-muted);
}

.spec-brand {
  font-weight: 700;
  color: var(--wl-ink-strong);
}

/* Products Section */
.lp-products-section {
  margin-bottom: 3rem;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.section-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 10.5px;
  color: var(--wl-gold);
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.35rem;
  text-shadow: var(--wl-gold-text-shadow);
}

.eyebrow-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--wl-gold);
  box-shadow: var(--wl-gold-glow-soft);
}

.section-title {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--wl-gold-text);
  text-shadow: var(--wl-gold-text-shadow);
  margin: 0;
}

.view-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  border: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--wl-primary);
  cursor: pointer;
  transition: color 0.15s;
}

.view-all-btn:hover {
  color: var(--wl-primary-hover);
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-6);
}


.product-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--wl-radius-lg);
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--wl-shadow-card);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
}

.product-card:hover {
  transform: translateY(-3px);
  border-color: var(--wl-primary);
  box-shadow: var(--wl-shadow-card-hover);
}

.product-card__media {
  height: 195px;
  width: 100%;
  position: relative;
  overflow: hidden;
  display: block;
  padding: 0;
  background: var(--wl-surface-soft);
}

.product-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.25s ease;
}

.product-card:hover .product-card__img {
  transform: scale(1.04);
}

.sku-chip {
  position: absolute;
  bottom: 8px;
  inset-inline-start: 8px;
  font-size: 10px;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-xs);
  color: var(--wl-ink-strong);
  font-weight: 600;
  backdrop-filter: blur(4px);
}

.product-card__body {
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.product-card__name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--wl-ink-strong);
  line-height: 1.4;
  margin-bottom: 0.35rem;
}

.product-card__meta {
  font-size: 11px;
  color: var(--wl-muted);
  margin-bottom: 0.9rem;
}

.meta-dot {
  margin: 0 0.25rem;
}

.product-card__bottom {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.75rem;
  border-top: 1px solid var(--wl-border);
}

.price-val {
  font-size: 14px;
  font-weight: 700;
  color: var(--wl-ink-strong);
}

.add-quote-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--wl-primary);
  border: 1px solid var(--wl-primary);
  color: #ffffff !important;
  font-size: 11.5px;
  font-weight: 600;
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.add-quote-btn,
.add-quote-btn * {
  color: #ffffff !important;
}

.add-quote-btn:hover {
  background: var(--wl-primary-hover);
  border-color: var(--wl-primary-hover);
  color: #ffffff !important;
}

/* Category fallback */
.cat-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--wl-radius-lg);
  padding: 1rem;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

.cat-card:hover { border-color: var(--wl-primary); transform: translateY(-1px); }
.cat-media { height: 100px; display: grid; place-items: center; background: var(--wl-surface-soft); border-radius: var(--radius-md); overflow: hidden; }
.cat-media__img { max-width: 100%; max-height: 100%; object-fit: contain; padding: 0.5rem; }
.cat-media__icon { font-size: 28px; color: var(--wl-muted); }
.cat-body { display: flex; flex-direction: column; }
.cat-name { font-size: 13px; font-weight: 600; color: var(--wl-ink-strong); }
.cat-count { font-size: 10.5px; color: var(--wl-muted); }

/* Related Specialties */
.lp-related-section {
  margin-bottom: 1.5rem;
}

.related-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-4);
}

.related-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--wl-radius-lg);
  padding: 1.25rem;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-shadow: var(--wl-shadow-card);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.related-card:hover {
  border-color: var(--wl-primary);
  transform: translateY(-2px);
  box-shadow: var(--wl-shadow-card-hover);
}

.related-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.related-type {
  font-size: 10px;
  color: var(--wl-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.related-arrow {
  font-size: 16px;
  color: var(--wl-primary);
  transition: transform 0.18s;
}

.related-card:hover .related-arrow {
  transform: translateX(3px);
}

.related-title {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0.2rem 0 auto;
}

.related-link {
  font-size: 11px;
  color: var(--wl-primary);
  font-weight: 600;
}

@media (max-width: 980px) {
  .lp-hero {
    padding: 2rem 1.75rem;
  }
  .lp-hero__inner {
    grid-template-columns: 1fr;
    gap: 1.75rem;
  }
  .lp-hero__spec {
    max-width: 420px;
    width: 100%;
  }
  .product-grid {
    gap: 1rem;
  }
  .related-grid {
    gap: 1rem;
  }
}

@media (max-width: 640px) {
  .landing-shell {
    padding-top: 1rem;
  }
  .lp-hero {
    padding: 1.5rem 1.15rem;
    margin-bottom: 1.5rem;
    border-radius: var(--radius-md);
  }
  .lp-title {
    font-size: clamp(1.6rem, 6vw, 2.2rem);
    margin-bottom: 0.75rem;
  }
  .lp-body {
    font-size: 14px;
    line-height: 1.55;
    margin-bottom: 1.25rem;
  }
  .lp-actions {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 0.5rem;
  }
  .lp-actions > * {
    width: 100%;
    justify-content: center;
  }
  .product-grid {
    gap: 0.85rem;
  }
  .related-grid {
    gap: 0.75rem;
  }
  .section-title {
    font-size: 1.25rem;
  }

  .section-head {
    margin-bottom: 1.15rem;
  }
}

@media (max-width: 440px) {
  .lp-hero {
    padding: 1.25rem 0.85rem;
  }
  .lp-eyebrow {
    flex-wrap: wrap;
    gap: 0.35rem;
  }
}
</style>





