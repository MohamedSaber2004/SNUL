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
const showAllLandingPages = ref(false)

const displayedLandingPages = computed(() => {
  if (showAllLandingPages.value) return relatedPages.value
  return relatedPages.value.slice(0, 4)
})

function getSpecialtyIcon(type?: string, slug?: string): string {
  const s = (slug || '').toLowerCase()
  const t = (type || '').toLowerCase()
  if (s.includes('cardio') || s.includes('heart')) return 'cardiology'
  if (s.includes('ortho') || s.includes('bone') || s.includes('joint')) return 'orthopedics'
  if (s.includes('neuro') || s.includes('spine')) return 'neurology'
  if (s.includes('dent') || s.includes('oral')) return 'dentistry'
  if (s.includes('eye') || s.includes('ophthal')) return 'ophthalmology'
  if (s.includes('ent') || s.includes('ear') || s.includes('throat')) return 'hearing'
  if (s.includes('surg') || s.includes('general')) return 'surgical'
  if (s.includes('derma')) return 'dermatology'
  if (s.includes('pedia')) return 'child_care'
  if (s.includes('gyn') || s.includes('obs')) return 'pregnant_woman'
  if (s.includes('urol')) return 'water_drop'
  if (t === 'brand') return 'verified'
  if (t === 'procedure') return 'precision_manufacturing'
  return 'medical_services'
}

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
        relatedPages.value = (list.value.data as LandingPageDto[]).filter((p: LandingPageDto) => p.slug !== s)
      }
      if (prodRes.status === 'fulfilled' && (prodRes.value as { data?: ProductDto[] })?.data) {
        products.value = (prodRes.value as { data: ProductDto[] }).data
      }
    } else {
      const [prodRes, catRes, listRes] = await Promise.allSettled([
        marketplaceRepository.getProducts({ page: 1, pageSize: 12 }).catch(() => ({ data: [] as ProductDto[] })),
        marketplaceRepository.getCategories().catch(() => [] as CategoryDto[]),
        contentRepository.getLandingPages({ pageNumber: 1, pageSize: 50 }).catch(() => ({ data: [] as LandingPageDto[] })),
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
        relatedPages.value = ((listRes.value as { data: LandingPageDto[] }).data as LandingPageDto[]).filter((p) => p.slug !== s)
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

const contentParagraphs = computed(() => {
  if (!page.value?.contentBlock) return null
  const split = page.value.contentBlock
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  return split.length ? split : null
})

const browseLink = computed(() =>
  page.value?.categoryId
    ? { name: 'marketplace', query: { categoryId: page.value.categoryId } }
    : { name: 'marketplace' },
)

const pageFacts = computed(() => [
  { icon: 'category', label: t('landing.pageTypeLabel'), value: page.value?.type || t('nav.catalog') },
  { icon: 'medical_services', label: t('landing.categoryLabel'), value: page.value?.categoryName || t('landing.allCategories') },
  { icon: 'inventory_2', label: t('landing.instrumentsListed'), value: t('landing.instrumentsCount', { count: products.value.length }) },
  { icon: 'explore', label: t('landing.relatedPagesLabel'), value: t('landing.relatedPagesCount', { count: relatedPages.value.length }) },
])
</script>

<template>
  <div class="page-shell landing-shell">
    <div class="landing-topbar">
      <nav class="landing-crumb" :aria-label="t('common.breadcrumb')">
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
          <div class="lp-hero__copy">
            <div class="lp-eyebrow">
              <span class="lp-dot" aria-hidden="true"></span>
              <span class="lp-tag">{{ page ? page.type : t('nav.catalog') }}</span>
            </div>
            <h1 class="lp-title">{{ heroTitle }}</h1>
            <p class="lp-body">{{ heroBody }}</p>
            <div class="lp-actions">
              <BaseButton variant="primary" @click="router.push(browseLink)">{{ t('landing.browseInstruments') }}</BaseButton>
              <BaseButton variant="outline" @click="router.push({ name: 'help' })">{{ t('landing.requestQuote') }}</BaseButton>
            </div>
            <p class="lp-credentials">{{ t('landing.manufactured') }}</p>
          </div>
          <dl class="lp-facts">
            <div v-for="fact in pageFacts" :key="fact.label" class="lp-fact">
              <dt class="lp-fact__label">
                <span class="material-symbols-outlined lp-fact__icon" aria-hidden="true">{{ fact.icon }}</span>
                {{ fact.label }}
              </dt>
              <dd class="lp-fact__value">{{ fact.value }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section v-if="contentParagraphs" class="lp-content-section" aria-labelledby="overview-heading">
        <h2 id="overview-heading" class="section-title">{{ t('landing.overview') }}</h2>
        <div class="lp-content-body">
          <p v-for="(para, i) in contentParagraphs" :key="i" dir="auto">{{ para }}</p>
        </div>
      </section>

      <DataState :loading="loading" skeleton-type="catalog-grid" :skeleton-count="4" :empty="!products.length && !loading" :empty-title="t('marketplace.noProducts')" :empty-description="t('marketplace.noProductsDesc')" :empty-icon="'inventory_2'" @action="router.push({ name: 'marketplace' })" min-height="180px">
        <section class="lp-products-section" aria-labelledby="products-heading">
          <div class="section-head">
            <div>
              <div class="section-eyebrow"><span class="eyebrow-dot"></span>{{ t('landing.featuredProducts') }}</div>
              <h2 id="products-heading" class="section-title">{{ heroTitle }}</h2>
            </div>
            <router-link :to="browseLink" class="btn-view-all">
              <span>{{ t('common.viewAll') }}</span>
              <span class="material-symbols-outlined text-[15px] icon--directional">arrow_forward</span>
            </router-link>
          </div>
          <div class="product-grid">
            <article
              v-for="p in products"
              :key="p.id"
              class="product-card interactive-lift anim-card-hover"
              tabindex="0"
              role="button"
              @click="router.push({ name: 'marketplace-product', params: { id: p.id } })"
              @keydown.enter="router.push({ name: 'marketplace-product', params: { id: p.id } })"
            >
              <div class="product-card__media" :style="{ background: productMediaUrl(p.imageName, p.imageGradient).background }">
                <AppImage
                  :src="p.imageName"
                  placeholder-type="product"
                  :alt="localized(p.nameEn, p.nameAr)"
                  fit="cover"
                  class="product-card__img"
                />
                <span v-if="p.sku" class="sku-chip">{{ p.sku }}</span>
              </div>
              <div class="product-card__body">
                <div class="product-card__cat">
                  {{ localized(p.categoryNameEn || '', p.categoryNameAr || '') }}
                </div>
                <h3 class="product-card__name" dir="auto">{{ localized(p.nameEn, p.nameAr) }}</h3>
                <div class="product-card__meta">
                  <span v-if="p.material" class="spec-pill">{{ p.material }}</span>
                  <span v-if="p.lengthCm" class="spec-pill">{{ p.lengthCm }} cm</span>
                </div>
                <div class="product-card__bottom">
                  <div class="price-wrap">
                    <span class="price-val mono-num">{{ formatPrice(p.price, locale) }}</span>
                    <span class="currency-tag">{{ p.currencySymbol || p.currencyCode || '$' }}</span>
                  </div>
                  <button
                    class="add-quote-btn"
                    type="button"
                    :aria-label="t('marketplace.addToQuote')"
                    @click="handleAddToQuote($event, p)"
                  >
                    <span class="material-symbols-outlined text-[15px]">add_shopping_cart</span>
                    <span>{{ t('marketplace.addToQuote') }}</span>
                  </button>
                </div>
              </div>
            </article>
          </div>
        </section>
      </DataState>

      <section v-if="!page && categories.length" class="lp-related-section" style="margin-top:2rem">
        <div class="section-head">
          <div>
            <div class="section-eyebrow"><span class="eyebrow-dot"></span>{{ t('home.browseByCategory') }}</div>
            <h3 class="section-title" style="font-size:1.25rem">{{ t('marketplace.categoriesTitle') }}</h3>
          </div>
          <router-link to="/categories" class="btn-view-all">
            <span>{{ t('common.viewAll') }}</span>
            <span class="material-symbols-outlined text-[15px] icon--directional">arrow_forward</span>
          </router-link>
        </div>
        <div class="related-grid">
          <router-link
            v-for="c in categories"
            :key="c.id"
            :to="{ name: 'marketplace', query: { categoryId: c.id } }"
            class="cat-card interactive-lift anim-card-hover"
          >
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
              <span class="cat-count">{{ t('landing.instrumentsCount', { count: c.productCount ?? 0 }) }}</span>
            </div>
          </router-link>
        </div>
      </section>

      <section v-if="relatedPages.length" class="lp-related-section" style="margin-top:2rem">
        <div class="section-head">
          <div>
            <div class="section-eyebrow"><span class="eyebrow-dot"></span>{{ t('landing.relatedSpecialties') }}</div>
            <h3 class="section-title" style="font-size:1.25rem">{{ t('landing.relatedSpecialties') }}</h3>
          </div>
          <button
            v-if="relatedPages.length > 4"
            type="button"
            class="btn-view-all"
            :aria-expanded="showAllLandingPages"
            @click="showAllLandingPages = !showAllLandingPages"
          >
            <span>
              {{ showAllLandingPages ? t('common.showLess') : t('landing.viewAllCount', { count: relatedPages.length }) }}
            </span>
            <span class="material-symbols-outlined text-[15px]">
              {{ showAllLandingPages ? 'expand_less' : 'expand_more' }}
            </span>
          </button>
        </div>
        <div class="related-grid">
          <router-link
            v-for="rp in displayedLandingPages"
            :key="rp.id"
            :to="{ name: 'landing-page', params: { slug: rp.slug } }"
            class="related-card interactive-lift anim-card-hover"
          >
            <div class="related-card__header">
              <div class="related-card__badge-wrap">
                <span class="related-icon-box">
                  <span class="material-symbols-outlined text-[18px]">
                    {{ getSpecialtyIcon(rp.type, rp.slug) }}
                  </span>
                </span>
                <span class="related-type">{{ rp.type }}</span>
              </div>
              <span class="material-symbols-outlined related-arrow icon--directional">arrow_forward</span>
            </div>
            <h4 class="related-title" dir="auto">{{ localized(rp.heroTitle || rp.slug, rp.heroTitle || rp.slug) }}</h4>
            <p v-if="rp.heroBody" class="related-desc" dir="auto">
              {{ rp.heroBody.length > 90 ? rp.heroBody.slice(0, 90) + '…' : rp.heroBody }}
            </p>
            <div class="related-footer">
              <span class="related-link">
                <span>{{ t('landing.browseInstruments') }}</span>
                <span class="icon--directional">→</span>
              </span>
            </div>
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
  border-radius: var(--radius-xl);
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
  grid-template-columns: 1fr 320px;
  gap: 2.5rem;
  align-items: center;
}

.lp-hero__copy {
  min-width: 0;
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
  border: 1px solid rgba(255, 209, 102, 0.35);
  text-shadow: var(--wl-gold-text-shadow);
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

/* Facts panel — real CMS + catalogue data, no decorative filler */
.lp-facts {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: 0.5rem 1.25rem;
  box-shadow: var(--wl-shadow-card);
}

.lp-fact {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--wl-border);
}

.lp-fact:last-child {
  border-bottom: none;
}

.lp-fact__label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-neutral-600);
  margin: 0;
}

.lp-fact__icon {
  font-size: 15px;
  color: var(--brand);
}

.lp-fact__value {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  text-align: end;
  margin: 0;
  overflow-wrap: anywhere;
}

/* CMS long-form content */
.lp-content-section {
  margin-bottom: 3rem;
}

.lp-content-body {
  margin-top: 1rem;
  max-width: 78ch;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.lp-content-body p {
  color: var(--color-neutral-600);
  font-size: 15px;
  line-height: 1.7;
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

.btn-view-all {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 1rem;
  border-radius: 9999px;
  background: var(--brand-soft);
  border: 1px solid var(--border);
  color: var(--brand);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-view-all:hover {
  background: var(--brand);
  color: var(--fg-on-brand);
  border-color: var(--brand);
  transform: translateY(-1px);
}

.btn-view-all:hover * {
  color: var(--fg-on-brand);
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: var(--space-6);
}

.product-card {
  position: relative;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--wl-shadow-card);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
}

.product-card:hover {
  transform: translateY(-4px);
  border-color: var(--brand);
  box-shadow: var(--wl-shadow-card-hover);
}

.product-card__media {
  height: 200px;
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
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.product-card:hover .product-card__img {
  transform: scale(1.05);
}

.sku-chip {
  position: absolute;
  top: 10px;
  inset-inline-start: 10px;
  font-size: 10px;
  font-weight: 700;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-sm);
  color: var(--fg-heading);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.product-card__body {
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.product-card__cat {
  font-size: 10px;
  font-weight: 700;
  color: var(--brand);
  letter-spacing: 0.06em;
  margin-bottom: 0.35rem;
}

.product-card__name {
  font-size: 14px;
  font-weight: 700;
  color: var(--fg-heading);
  line-height: 1.4;
  margin-bottom: 0.45rem;
}

.product-card__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.spec-pill {
  display: inline-block;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  color: var(--fg-muted);
  font-size: 10.5px;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.product-card__bottom {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--border);
}

.price-wrap {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.price-val {
  font-size: 15px;
  font-weight: 800;
  color: var(--fg-heading);
}

.currency-tag {
  font-size: 11px;
  color: var(--fg-muted);
  font-weight: 600;
}

.add-quote-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--brand);
  border: 1px solid var(--brand);
  color: var(--fg-on-brand) !important;
  font-size: 12px;
  font-weight: 700;
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.add-quote-btn,
.add-quote-btn * {
  color: var(--fg-on-brand) !important;
}

.add-quote-btn:hover {
  background: var(--brand-hover);
  border-color: var(--brand-hover);
  transform: translateY(-1px);
}

/* Category fallback */
.cat-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: 1.15rem;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-shadow: var(--wl-shadow-card);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.cat-card:hover {
  border-color: var(--brand);
  transform: translateY(-3px);
  box-shadow: var(--wl-shadow-card-hover);
}

.cat-media {
  height: 120px;
  display: grid;
  place-items: center;
  background: var(--wl-surface-soft);
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border);
}

.cat-media__img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  padding: 0.5rem;
  transition: transform 0.25s ease;
}

.cat-card:hover .cat-media__img {
  transform: scale(1.06);
}

.cat-body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.cat-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--fg-heading);
}

.cat-count {
  font-size: 11px;
  color: var(--fg-muted);
}

/* Related Specialties / Landing Pages */
.lp-related-section {
  margin-bottom: 2.5rem;
}

.related-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-5);
}

.related-card {
  position: relative;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: 1.25rem 1.35rem;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-shadow: var(--wl-shadow-card);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.related-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--brand), var(--accent));
  opacity: 0;
  transition: opacity 0.25s ease;
}

.related-card:hover {
  border-color: var(--brand);
  transform: translateY(-4px);
  box-shadow: var(--wl-shadow-card-hover);
}

.related-card:hover::before {
  opacity: 1;
}

.related-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.related-card__badge-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.related-icon-box {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: var(--brand-soft);
  color: var(--brand);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.related-card:hover .related-icon-box {
  background: var(--brand);
  color: var(--fg-on-brand);
}

.related-type {
  font-size: 10px;
  font-weight: 700;
  color: var(--fg-muted);
  letter-spacing: 0.08em;
  background: var(--bg-subtle);
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  border: 1px solid var(--border);
}

.related-arrow {
  font-size: 18px;
  color: var(--fg-muted);
  transition: transform 0.2s ease, color 0.2s ease;
}

.related-card:hover .related-arrow {
  transform: translateX(4px);
  color: var(--brand);
}

[dir='rtl'] .related-card:hover .related-arrow {
  transform: translateX(-4px);
}

.related-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--fg-heading);
  line-height: 1.35;
  margin: 0;
}

.related-desc {
  font-size: 0.8125rem;
  color: var(--fg-muted);
  line-height: 1.5;
  margin: 0;
  flex: 1;
}

.related-footer {
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.related-link {
  font-size: 12px;
  color: var(--brand);
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  transition: color 0.15s ease;
}

.related-card:hover .related-link {
  color: var(--brand-hover);
}

@media (max-width: 980px) {
  .lp-hero {
    padding: 2rem 1.75rem;
  }
  .lp-hero__inner {
    grid-template-columns: 1fr;
    gap: 1.75rem;
  }
  .lp-facts {
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





