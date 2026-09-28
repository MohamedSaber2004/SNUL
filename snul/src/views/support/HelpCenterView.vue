<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { authService } from '../../di/container'
import { contentService } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import DataState from '../../components/ui/DataState.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import { resolveFileUrl, isStoredFileName } from '../../utils/file-url'
import {
  normalizeSearchText,
  tokenizeSearchQuery,
  rankHelpArticles,
  rankHelpFaqs,
  highlightSearchMatches,
  escapeHtml,
} from '../../utils/help-search'
import { localizedText, splitArticleParagraphs } from '../../utils/help-localize'
import { toHeroTelemetry } from '../../utils/help-stats'
import BackButton from '../../components/ui/BackButton.vue'
import type { FaqItemDto, HelpArticleDto, HelpCategoryDto } from '../../domain/models/content'

const router = useRouter()
const search = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const activeCategory = ref('all')

const categories = contentService.helpCategories
const articles = contentService.helpArticles
const faqs = contentService.faqs
const myTickets = contentService.myTickets
const siteStats = contentService.helpSiteStats
const loading = ref(true)
const openFaq = ref<string | null>(null)
const heroImgFailed = ref(false)
const isAuthed = computed(() => authService.isAuthenticated)
const isBuyer = computed(() => authService.isOrganizationUser.value)
const isSeller = computed(() => authService.isAdmin.value || authService.isSales.value)

const selectedArticle = ref<HelpArticleDto | null>(null)
const articleModalOpen = ref(false)

function openArticle(a: HelpArticleDto) {
  selectedArticle.value = a
  articleModalOpen.value = true
}

function setTicketSubject(subj: string) {
  ticketSubject.value = subj
}

const ticketSubject = ref('')
const ticketMessage = ref('')
const submittingTicket = ref(false)
const ticketSuccess = ref(false)
const ticketError = ref('')

const ICONS: Record<string, string> = {
  cart: 'shopping_bag',
  ship: 'local_shipping',
  return: 'assignment_return',
  autoclave: 'sanitizer',
  faq: 'help',
  shield: 'verified_user',
}

/* Bilingual rendering.
 *
 * The help API exposes nullable `*Ar` columns that are absent until the backend
 * ships them, so every localised read goes through `localizedText`, which falls
 * back to the English field. Articles and FAQs are projected once here rather
 * than localised at each render site, so search ranking, match highlighting and
 * the reading modal all operate on the same text the reader sees. */

function categoryText(cat?: HelpCategoryDto | null): string {
  if (!cat) return ''
  return localizedText(locale.value, cat.name, cat.nameAr)
}

const localizedArticles = computed<HelpArticleDto[]>(() =>
  (Array.isArray(articles.value) ? articles.value : []).map((a) =>
    a
      ? {
          ...a,
          title: localizedText(locale.value, a.title, a.titleAr),
          body: localizedText(locale.value, a.body, a.bodyAr),
        }
      : a,
  ),
)

const localizedFaqs = computed<FaqItemDto[]>(() =>
  (Array.isArray(faqs.value) ? faqs.value : []).map((f) =>
    f
      ? {
          ...f,
          question: localizedText(locale.value, f.question, f.questionAr),
          answer: localizedText(locale.value, f.answer, f.answerAr),
        }
      : f,
  ),
)

/* Hero telemetry.
 *
 * The SLA badge and the three figures are rows in the `help/site-stats` API, not
 * copy in this file. The table ships unseeded, so on a fresh database the list
 * is empty and the hero shows no claim at all - that is the intended state, not
 * something to substitute a default for. Both the badge and the metric row are
 * behind their own `v-if`, so the figure, its dashed top border and the chip over
 * the image all disappear together and the hero keeps the photo's height. */
const heroTelemetry = computed(() => toHeroTelemetry(siteStats.value, locale.value))

const quickTags = computed(() => {
  const allCats = Array.isArray(categories.value) ? categories.value : []
  return allCats
    .map((c) => categoryText(c))
    .filter((n): n is string => Boolean(n))
    .slice(0, 6)
})

/** Subject shortcuts for the ticket form: the active help categories, capped. */
const quickSubjects = computed(() =>
  (Array.isArray(categories.value) ? categories.value : [])
    .filter((c) => c && c.isActive !== false)
    .map((c) => ({ id: c.id, name: categoryText(c) }))
    .filter((c) => Boolean(c.name))
    .slice(0, 5),
)

function applyQuickFilter(term: string) {
  search.value = term
  activeCategory.value = 'all'
  setTimeout(() => {
    document.querySelector('.article-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 100)
}

function clearSearch() {
  search.value = ''
  searchInput.value?.focus()
}

function clearAllFilters() {
  search.value = ''
  activeCategory.value = 'all'
  showAllExpanded.value = true
  showAllCategories.value = true
}

const hasActiveFilters = computed(() => Boolean(search.value.trim()) || activeCategory.value !== 'all')
/** Normalized tokens of the current query (shared by articles + FAQs). */
const searchTerms = computed(() => tokenizeSearchQuery(search.value))
const isSearching = computed(() => searchTerms.value.length > 0)

function categoryLabel(id?: string | null): string {
  if (!id) return ''
  return categoryText(categories.value.find((c) => c.id === id))
}

/** Relevance-ranked articles (see utils/help-search for the algorithm). */
const filteredArticles = computed(() =>
  rankHelpArticles(localizedArticles.value, search.value, {
    activeCategory: activeCategory.value,
    categoryNameOf: (id) => categoryLabel(id),
  }),
)

/** Categories that actually have loaded articles */
const activeArticleCategories = computed(() => {
  const allCats = Array.isArray(categories.value) ? categories.value : []
  const allArticles = Array.isArray(articles.value) ? articles.value : []
  return allCats.filter((c) => {
    if (!c || c.isActive === false) return false
    const hasLoadedArticle = allArticles.some((a) => a && a.isActive !== false && a.categoryId === c.id)
    return hasLoadedArticle || (typeof c.articleCount === 'number' && c.articleCount > 0)
  })
})

const CATEGORY_FILTER_LIMIT = 3
const showAllCategories = ref(false)

const visibleCategories = computed(() => {
  const all = activeArticleCategories.value
  if (showAllCategories.value || all.length <= CATEGORY_FILTER_LIMIT) {
    return all
  }
  const top = all.slice(0, CATEGORY_FILTER_LIMIT)
  if (activeCategory.value !== 'all' && !top.some((c) => c?.id === activeCategory.value)) {
    const active = all.find((c) => c?.id === activeCategory.value)
    if (active) {
      return [...top, active]
    }
  }
  return top
})

const remainingCategoriesCount = computed(() => {
  return Math.max(0, activeArticleCategories.value.length - CATEGORY_FILTER_LIMIT)
})

const ARTICLE_PREVIEW_LIMIT = 6
const showAllExpanded = ref(false)

const displayedArticles = computed(() => {
  if (isSearching.value || showAllExpanded.value || filteredArticles.value.length <= ARTICLE_PREVIEW_LIMIT) {
    return filteredArticles.value
  }
  return filteredArticles.value.slice(0, ARTICLE_PREVIEW_LIMIT)
})

function selectCategory(catId: string) {
  activeCategory.value = catId
  showAllExpanded.value = true
}

function showAllArticles() {
  activeCategory.value = 'all'
  search.value = ''
  showAllExpanded.value = true
  showAllCategories.value = true
  setTimeout(() => {
    document.querySelector('.article-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 100)
}

/* Guide-card accents, rotated per card. These are design-token *references*, not
 * colours: the palette lives in `src/assets/design-tokens.css` and
 * `design-lint.mjs` fails any raw hex outside that file. */
const CARD_ACCENTS = [
  'var(--brand)',
  'var(--accent)',
  'var(--fg-info)',
  'var(--fg-success)',
  'var(--fg-warning)',
  'var(--brand-hover)',
]

const visibleFaqs = computed(() => rankHelpFaqs(localizedFaqs.value, search.value))

/** Article modal paragraphs with current query matches highlighted. */
const modalParagraphs = computed(() => {
  const terms = searchTerms.value
  return splitArticleParagraphs(selectedArticle.value?.body).map((para) =>
    terms.length ? highlightSearchMatches(para, terms) : escapeHtml(para),
  )
})

/** Article modal title with current query matches highlighted. */
const modalTitleHtml = computed(() => {
  const title = selectedArticle.value?.title ?? ''
  const terms = searchTerms.value
  return terms.length ? highlightSearchMatches(title, terms) : escapeHtml(title)
})

const guideCards = computed(() => {
  const allCats = Array.isArray(categories.value) ? categories.value.filter((c) => c && c.isActive !== false) : []
  const allArts = (localizedArticles.value ?? []).filter((a) => a && a.isActive !== false)

  return allCats.map((cat, idx) => {
    const arts = allArts.filter((a) => a && a.categoryId === cat.id)
    const count = cat.articleCount ?? arts.length
    const firstArticle = arts[0]
    const body = firstArticle?.body ?? ''
    const desc = body ? body.slice(0, 115) + (body.length > 115 ? '…' : '') : ''
    const color = CARD_ACCENTS[idx % CARD_ACCENTS.length]
    return {
      def: {
        key: cat.id,
        title: categoryText(cat),
        icon: cat.icon || 'menu_book',
        tag: t('help.knowledgeTopic'),
        color,
        tint: `color-mix(in srgb, ${color} 8%, transparent)`,
      },
      cat,
      count,
      desc,
      firstArticle,
      isLinked: true,
    }
  })
})

function onGuideClick(card: (typeof guideCards.value)[number]) {
  if (card.cat) {
    activeCategory.value = card.cat.id
    search.value = ''
  } else if (card.firstArticle) {
    activeCategory.value = card.firstArticle.categoryId
    search.value = ''
  } else {
    activeCategory.value = 'all'
  }
  showAllExpanded.value = true
  setTimeout(() => {
    document.querySelector('.article-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 120)
}

async function submitTicket() {
  if (!ticketSubject.value.trim() || !ticketMessage.value.trim()) return
  if (!isAuthed.value) {
    router.push({ path: '/auth/login', query: { redirect: '/help' } })
    return
  }

  submittingTicket.value = true
  ticketError.value = ''
  ticketSuccess.value = false
  try {
    await contentService.createTicket(ticketSubject.value.trim(), ticketMessage.value.trim())
    ticketSuccess.value = true
    ticketSubject.value = ''
    ticketMessage.value = ''
    toastService.success(t('help.ticketCreated'))
  } catch (err) {
    const msg = err instanceof Error ? err.message : t('auth.errGeneric')
    ticketError.value = msg
    toastService.error(msg)
  } finally {
    submittingTicket.value = false
  }
}

function resetTicketForm() {
  ticketSuccess.value = false
  ticketError.value = ''
  ticketSubject.value = ''
  ticketMessage.value = ''
}

function scrollToEscalation() {
  document.getElementById('direct-escalation')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function scrollToArticles() {
  document.querySelector('.article-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === '/' && !articleModalOpen.value) {
    const target = e.target as HTMLElement | null
    const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    if (!typing) {
      e.preventDefault()
      searchInput.value?.focus()
      return
    }
  }
  if (e.key !== 'Escape') return
  if (articleModalOpen.value) return // BaseModal handles its own Escape
  if (!search.value) return
  e.preventDefault()
  clearSearch()
}

onMounted(async () => {
  document.addEventListener('keydown', onSearchKeydown)
  const promises: Promise<unknown>[] = [
    contentService.loadSupport(),
    contentService.loadSupportContact(),
    contentService.loadHelpSiteStats(),
  ]
  if (isAuthed.value) {
    promises.push(contentService.loadMyTickets())
  }
  await Promise.allSettled(promises)
  loading.value = false
})

onUnmounted(() => {
  document.removeEventListener('keydown', onSearchKeydown)
})

function categoryName(id: string): string {
  const found = categories.value.find((c) => c.id === id)
  return found ? categoryText(found) : id
}

/**
 * The breadcrumb's third segment, driven entirely by the API category list.
 * Resolves the active category id to its localized name, or null when no
 * category is selected ('all') or the id matches no loaded category. Null
 * means the trail stays at Home / Help Center — the segment is never rendered
 * from a hardcoded string or a raw id fallback.
 */
const activeCategoryCrumb = computed<string | null>(() => {
  const id = activeCategory.value
  if (!id || id === 'all') return null
  const found = (Array.isArray(categories.value) ? categories.value : []).find((c) => c?.id === id)
  if (!found) return null
  const name = categoryText(found)
  return name.trim() ? name : null
})

const brokenThumbs = ref(new Set<string>())
function markThumbBroken(key: string): void {
  brokenThumbs.value.add(key)
}

function categoryIconName(icon?: string | null, fallback = 'article'): string {
  const raw = (icon ?? '').trim()
  if (!raw) return fallback
  if (isStoredFileName(raw)) return fallback
  return ICONS[raw] ?? (/^[a-z_]+$/.test(raw) ? raw : fallback)
}

interface CategoryVisual {
  kind: 'img' | 'icon'
  src: string
  name: string
}

function categoryVisual(categoryId?: string | null, fallback = 'article'): CategoryVisual {
  const cat = categories.value.find((c) => c.id === categoryId)
  const icon = (cat?.icon ?? '').trim()
  if (cat && icon && isStoredFileName(icon) && !brokenThumbs.value.has(`cat:${cat.id}`)) {
    const src = resolveFileUrl(icon, '')
    if (src) return { kind: 'img', src, name: categoryIconName(icon, fallback) }
  }
  return { kind: 'icon', src: '', name: categoryIconName(icon, fallback) }
}
</script>

<template>
  <div class="page-shell">
    <div class="help-nav-bar">
      <BackButton fallback="/" variant="ghost" />
      <nav class="help-crumb mono" :aria-label="t('common.breadcrumb')">
        <router-link to="/">{{ t('nav.home') }}</router-link>
        <span class="crumb-sep icon--directional" aria-hidden="true">/</span>
        <router-link v-if="activeCategoryCrumb" to="/help" @click="selectCategory('all')">{{ t('nav.help') }}</router-link>
        <span v-else class="crumb-current">{{ t('nav.help') }}</span>
        <template v-if="activeCategoryCrumb">
          <span class="crumb-sep icon--directional" aria-hidden="true">/</span>
          <span class="crumb-current">{{ activeCategoryCrumb }}</span>
        </template>
      </nav>
    </div>

    <section class="help-hero">
      <div class="help-hero__grid">
        <div class="help-hero__copy anim-fade-in-up">
          <div class="help-eyebrow mono">
            <span class="live-dot" aria-hidden="true"></span>
            <span>{{ t('help.heroEyebrow') }}</span>
          </div>
          <h1 class="help-title">{{ t('help.title') }}</h1>
          <p class="help-desc">{{ t('help.subtitle') }}</p>

          <div class="help-search-box">
            <div class="help-search-input-wrap" :class="{ 'has-query': isSearching }">
              <span class="material-symbols-outlined search-icon" aria-hidden="true">search</span>
              <input
                ref="searchInput"
                v-model="search"
                class="help-search-field"
                type="search"
                enterkeyhint="search"
                autocomplete="off"
                aria-keyshortcuts="/"
                :placeholder="t('help.searchPlaceholder')"
                :aria-label="t('help.searchPlaceholder')"
                @keydown.enter.prevent="scrollToArticles"
              />
              <button
                v-if="search"
                type="button"
                class="search-clear-btn"
                :aria-label="t('common.clearInput')"
                @click="clearSearch"
              >
                <span class="material-symbols-outlined text-[16px]">close</span>
              </button>
              <span v-else class="search-kbd-group" aria-hidden="true">
                <kbd class="search-kbd mono" :title="t('help.searchShortcutHint')">/</kbd>
                <kbd class="search-kbd mono">ESC</kbd>
              </span>
            </div>

            <div v-if="quickTags.length" class="quick-tags-wrap">
              <span class="quick-tags-label mono">{{ t('help.popularTopics') }}</span>
              <button
                v-for="tag in quickTags"
                :key="tag"
                type="button"
                class="quick-tag-btn mono interactive-lift"
                :class="{ 'is-active': hasActiveFilters && normalizeSearchText(search) === normalizeSearchText(tag) && activeCategory === 'all' }"
                :aria-pressed="normalizeSearchText(search) === normalizeSearchText(tag) && activeCategory === 'all'"
                @click="applyQuickFilter(tag)"
              >
                {{ tag }}
              </button>
            </div>
          </div>
        </div>

        <!-- Photo: support specialists at work (public/images/help-support.jpg,
             free Unsplash photo by Charanjeet Dhiman). Falls back to a branded
             gradient panel if the file ever fails to load. -->
        <div class="help-hero__graphic">
          <figure class="hero-media">
            <img
              v-if="!heroImgFailed"
              src="/images/help-support.jpg"
              :alt="t('help.heroImageAlt')"
              class="hero-media__img"
              loading="eager"
              @error="heroImgFailed = true"
            />
            <div v-else class="hero-media__fallback" aria-hidden="true">
              <span class="material-symbols-outlined">support_agent</span>
            </div>
            <span v-if="heroTelemetry.badge" class="hero-media__sla mono">{{ heroTelemetry.badge }}</span>
          </figure>

          <!-- v-for over the API's SortOrder; no fixed count, no hardcoded order.
               The separator is emitted before every metric except the first, so a
               single metric has no divider dangling at either end, and the whole
               row - border included - is skipped when nothing is published. -->
          <div v-if="heroTelemetry.metrics.length" class="telemetry-metrics">
            <template v-for="(metric, index) in heroTelemetry.metrics" :key="`${metric.key}-${index}`">
              <div v-if="index > 0" class="telemetry-metric-sep" aria-hidden="true"></div>
              <div class="telemetry-metric">
                <strong class="metric-val mono">{{ metric.value }}</strong>
                <span v-if="metric.label" class="metric-lbl mono">{{ metric.label }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>

    <SkeletonLoader v-if="loading" type="help-grid" :count="6" />

    <template v-else>
      <section v-reveal v-if="guideCards.length" class="guides-section">
        <div class="section-head">
          <div>
            <div class="section-eyebrow mono">
              <span class="material-symbols-outlined text-[14px]">explore</span>
              <span>{{ t('help.guidesEyebrow') }}</span>
            </div>
            <h2 class="section-title">{{ t('help.guidesTitle') }}</h2>
          </div>
          <button
            type="button"
            class="btn-show-all-articles mono interactive-lift"
            @click="showAllArticles"
          >
            <span class="material-symbols-outlined text-[14px]">apps</span>
            <span>{{ t('help.showAllArticles') }}</span>
            <span class="icon--directional">→</span>
          </button>
        </div>

        <div class="help-grid">
          <article
            v-for="(card, i) in guideCards"
            :key="card.def.key"
            v-reveal="i"
            class="help-card anim-card-hover"
            :class="{ 'help-card--empty': !card.isLinked && !card.count, 'help-card--linked': card.isLinked }"
            @click="onGuideClick(card)"
          >
            <div class="help-card__accent" :style="{ background: card.def.color }"></div>

            <div class="help-card__top">
              <div class="hc-icon-wrapper" :style="{ color: card.def.color, background: card.def.tint }">
                <img
                  v-if="categoryVisual(card.cat?.id, 'menu_book').kind === 'img'"
                  :src="categoryVisual(card.cat?.id, 'menu_book').src"
                  alt=""
                  loading="lazy"
                  class="hc-thumb-img"
                  @error="markThumbBroken(`cat:${card.cat?.id}`)"
                />
                <span v-else class="material-symbols-outlined hc-icon">{{ categoryVisual(card.cat?.id, 'menu_book').name }}</span>
              </div>
              <span class="help-card__tag mono">{{ card.def.tag }}</span>
            </div>

            <h3 class="help-card__title">{{ card.def.title }}</h3>
            <p v-if="card.desc" class="help-card__desc">{{ card.desc }}</p>

            <div class="help-card__footer">
              <span class="help-card__count mono">
                {{ card.count ? t('help.protocolsDocumented', { count: card.count }) : t('help.technicalGuide') }}
              </span>
              <span class="material-symbols-outlined card-arrow icon--directional" aria-hidden="true">arrow_forward</span>
            </div>
          </article>
        </div>
      </section>

      <section v-reveal class="article-section">
        <div class="section-head">
          <div>
            <div class="section-eyebrow mono">
              <span class="material-symbols-outlined text-[14px]">menu_book</span>
              <span>{{ t('help.articlesEyebrow') }}</span>
            </div>
            <h2 class="section-title">{{ t('help.articles') }}</h2>
          </div>
          <div class="section-head__meta">
            <span
              v-if="search.trim()"
              class="search-context mono"
              role="status"
            >
              {{ t('help.resultsFor', { count: filteredArticles.length, term: search.trim() }) }}
            </span>
            <span class="article-counter mono">{{ t('help.articlesLoaded', { count: filteredArticles.length }) }}</span>
            <button
              type="button"
              class="btn-show-all-articles mono interactive-lift"
              :class="{ 'btn-show-all-articles--active': activeCategory === 'all' && !search.trim() }"
              :title="t('help.showAllArticlesToFilter')"
              @click="showAllArticles"
            >
              <span class="material-symbols-outlined text-[14px]">apps</span>
              <span>{{ t('help.showAllArticles') }}</span>
            </button>
            <button
              v-if="hasActiveFilters"
              type="button"
              class="clear-filters-btn mono"
              @click="clearAllFilters"
            >
              <span class="material-symbols-outlined text-[14px]">filter_alt_off</span>
              <span>{{ t('common.clearFilters') }}</span>
            </button>
          </div>
        </div>

        <div class="cat-pills" role="tablist" :aria-label="t('help.categories')">
          <button
            class="pill interactive-lift"
            role="tab"
            :class="{ 'pill--active': activeCategory === 'all' }"
            :aria-selected="activeCategory === 'all'"
            @click="selectCategory('all')"
          >
            <span class="material-symbols-outlined text-[16px]">grid_view</span>
            <span>{{ t('common.all') }}</span>
          </button>
          <button
            v-for="c in visibleCategories"
            :key="c.id"
            class="pill interactive-lift"
            role="tab"
            :class="{ 'pill--active': activeCategory === c.id }"
            :aria-selected="activeCategory === c.id"
            @click="selectCategory(c.id)"
          >
            <img
              v-if="c.icon && isStoredFileName(c.icon)"
              :src="resolveFileUrl(c.icon, '')"
              :alt="categoryText(c)"
              class="pill-img"
              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
            />
            <span
              v-else-if="c.icon && ICONS[c.icon]"
              class="material-symbols-outlined text-[16px]"
            >
              {{ ICONS[c.icon] }}
            </span>
            <span v-else-if="c.icon">{{ c.icon }}</span>
            <span>{{ categoryText(c) }}</span>
            <span class="pill__count mono">{{ c.articleCount ?? 0 }}</span>
          </button>
          <button
            v-if="activeArticleCategories.length > CATEGORY_FILTER_LIMIT"
            type="button"
            class="pill pill--toggle interactive-lift"
            :class="{ 'pill--toggle-active': showAllCategories }"
            :aria-expanded="showAllCategories"
            @click="showAllCategories = !showAllCategories"
          >
            <span class="material-symbols-outlined text-[16px]">
              {{ showAllCategories ? 'expand_less' : 'more_horiz' }}
            </span>
            <span>
              {{
                showAllCategories
                  ? t('help.showFewerCategories')
                  : t('help.showAllCategoriesCount', { count: remainingCategoriesCount })
              }}
            </span>
          </button>
        </div>

        <DataState
          :empty="!filteredArticles.length"
          :empty-title="t('help.noResults')"
          :empty-description="t('help.noResultsDesc')"
          :action-text="hasActiveFilters ? t('help.clearSearch') : undefined"
          min-height="200px"
          @action="clearAllFilters"
        >
          <div class="article-grid">
            <article
              v-for="(m, idx) in displayedArticles"
              :key="m.article.id"
              v-reveal="idx"
              class="article-card article-card--interactive anim-card-hover"
              role="button"
              tabindex="0"
              @click="openArticle(m.article)"
              @keydown.enter="openArticle(m.article)"
            >
              <div class="article-card__head">
                <span class="article-thumb" aria-hidden="true">
                  <img
                    v-if="categoryVisual(m.article.categoryId).kind === 'img'"
                    :src="categoryVisual(m.article.categoryId).src"
                    alt=""
                    loading="lazy"
                    class="article-thumb__img"
                    @error="markThumbBroken(`cat:${m.article.categoryId}`)"
                  />
                  <span v-else class="material-symbols-outlined">{{ categoryVisual(m.article.categoryId).name }}</span>
                </span>
                <div class="article-card__meta">
                  <div class="article-card__tags">
                    <span class="article-cat mono">{{ categoryName(m.article.categoryId) }}</span>
                    <span v-if="isSearching && idx === 0" class="top-match-chip mono">{{ t('help.topMatch') }}</span>
                  </div>
                  <span class="article-read-time mono">{{ t('help.readTime', { minutes: 3 }) }}</span>
                </div>
              </div>
              <h3 class="article-card__title" v-html="m.titleHtml || escapeHtml(m.article.title)"></h3>
              <p class="article-card__body" v-html="m.bodyHtml || escapeHtml(m.article.body)"></p>
              <div class="article-card__footer">
                <span class="article-read-cta mono">{{ t('help.readArticle') }}</span>
                <span class="material-symbols-outlined text-[15px] icon--directional">arrow_forward</span>
              </div>
            </article>
          </div>

          <div v-if="filteredArticles.length > ARTICLE_PREVIEW_LIMIT" class="article-expand-wrap">
            <button
              type="button"
              class="btn-expand-articles mono interactive-lift"
              :aria-expanded="showAllExpanded"
              @click="showAllExpanded = !showAllExpanded"
            >
              <span>
                {{
                  showAllExpanded
                    ? t('help.showFewerArticles')
                    : t('help.showAllArticlesCount', { count: filteredArticles.length })
                }}
              </span>
              <span class="material-symbols-outlined icon--directional text-[18px]" aria-hidden="true">
                {{ showAllExpanded ? 'expand_less' : 'expand_more' }}
              </span>
            </button>
          </div>
        </DataState>
      </section>

      <section v-reveal class="faq-section">
        <div class="section-head">
          <div>
            <div class="section-eyebrow mono">
              <span class="material-symbols-outlined text-[14px]">help_center</span>
              <span>{{ t('help.faqEyebrow') }}</span>
            </div>
            <h2 class="section-title">{{ t('help.faq') }}</h2>
          </div>
          <span class="article-counter mono" role="status">{{ t('help.faqMatches', { count: visibleFaqs.length }) }}</span>
        </div>

        <div v-if="visibleFaqs.length" class="faq-accordion-box">
          <div
            v-for="(item, idx) in visibleFaqs"
            :key="item.faq.id"
            v-reveal="idx"
            class="faq-item"
            :class="{ open: openFaq === item.faq.id }"
          >
            <button
              type="button"
              class="faq-item__header"
              :aria-expanded="openFaq === item.faq.id"
              @click="openFaq = openFaq === item.faq.id ? null : item.faq.id"
            >
              <div class="faq-item__left">
                <span class="faq-index mono">{{ String(idx + 1).padStart(2, '0') }}</span>
                <span class="faq-item__q" v-html="item.questionHtml || escapeHtml(item.faq.question)"></span>
              </div>
              <span class="material-symbols-outlined faq-item__chev" aria-hidden="true">
                expand_more
              </span>
            </button>
            <Transition name="expand">
              <div v-if="openFaq === item.faq.id" class="faq-item__body">
                <p class="faq-item__a" v-html="item.answerHtml || escapeHtml(item.faq.answer)"></p>
              </div>
            </Transition>
          </div>
        </div>

        <div v-else class="faq-empty" role="status">
          <span class="material-symbols-outlined" aria-hidden="true">search_off</span>
          <p class="faq-empty__title">{{ t('help.noFaqResults') }}</p>
          <p class="faq-empty__desc">{{ t('help.noFaqResultsDesc') }}</p>
          <button
            v-if="hasActiveFilters"
            type="button"
            class="btn btn-ghost btn-sm"
            @click="clearAllFilters"
          >
            {{ t('help.clearSearch') }}
          </button>
        </div>
      </section>

      <section v-reveal v-if="isBuyer && isAuthed" class="help-role-card">
        <div class="role-card__left">
          <div class="role-card__icon-wrap">
            <span class="material-symbols-outlined">support_agent</span>
          </div>
          <div>
            <h3 class="role-card__title">{{ t('help.myTickets') }}</h3>
            <p class="role-card__desc">{{ t('help.myTicketsDesc') }}</p>
          </div>
        </div>
        <div class="role-card__actions">
          <button class="btn btn-primary btn-press" @click="router.push('/help/my-tickets')">{{ t('help.myTickets') }}</button>
          <button class="btn btn-ghost" @click="scrollToEscalation">{{ t('help.createTicket') }}</button>
        </div>
      </section>

      <section v-reveal v-else-if="isSeller && isAuthed" class="help-role-card">
        <div class="role-card__left">
          <div class="role-card__icon-wrap">
            <span class="material-symbols-outlined">admin_panel_settings</span>
          </div>
          <div>
            <h3 class="role-card__title">{{ t('help.manageHelp') }}</h3>
            <p class="role-card__desc">{{ t('help.staffDesc') }}</p>
          </div>
        </div>
        <div class="role-card__actions">
          <button class="btn btn-primary btn-press" @click="router.push('/admin/tickets')">{{ t('help.staffQueue') }}</button>
          <button class="btn btn-ghost" @click="router.push('/admin/help')">{{ t('help.manageHelp') }}</button>
        </div>
      </section>

      <section v-reveal id="direct-escalation" class="help-contact-banner">
        <div class="contact-header">
          <div class="contact-copy">
            <div class="contact-eyebrow mono">
              <span class="live-dot" aria-hidden="true"></span>
              <span>{{ t('help.ticketsEyebrow') }}</span>
            </div>
            <h2 class="contact-title">{{ t('help.getInTouch') }}</h2>
            <p class="contact-desc">{{ t('help.escalationDesc') }}</p>
          </div>
          <router-link
            v-if="isAuthed"
            to="/help/my-tickets"
            class="my-tickets-badge-link mono"
          >
            <span class="material-symbols-outlined text-[18px]">confirmation_number</span>
            <span>{{ t('help.myTickets') }}</span>
            <span v-if="myTickets.length > 0" class="tickets-count-pill">{{ myTickets.length }}</span>
            <span class="material-symbols-outlined text-[16px] icon--directional">arrow_forward</span>
          </router-link>
        </div>

        <div class="escalation-grid">
          <div class="escalation-channels">
            <div class="channel-group-header">
              <div class="channel-group-title mono">
                <span class="material-symbols-outlined text-[18px]">contact_phone</span>
                <span>{{ t('help.channelsTitle') }}</span>
              </div>
              <p class="channel-group-desc">{{ t('help.channelsDesc') }}</p>
            </div>

            <div class="channel-cards-list">
              <!-- Official Support Email -->
              <a
                v-if="contentService.supportContact.value.supportEmail"
                class="channel-card"
                :href="'mailto:' + contentService.supportContact.value.supportEmail"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div class="channel-icon channel-icon--email">
                  <span class="material-symbols-outlined">mail</span>
                </div>
                <div class="channel-info">
                  <span class="channel-type mono">{{ t('help.channelEmailTitle') }}</span>
                  <span class="channel-value">{{ contentService.supportContact.value.supportEmail }}</span>
                  <span class="channel-note">{{ t('help.channelEmailNote') }}</span>
                </div>
                <span class="material-symbols-outlined channel-arrow icon--directional">open_in_new</span>
              </a>

              <a
                v-if="contentService.supportContact.value.whatsAppNumber"
                class="channel-card"
                :href="'https://wa.me/' + contentService.supportContact.value.whatsAppNumber.replace(/\D/g, '')"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div class="channel-icon channel-icon--whatsapp">
                  <span class="material-symbols-outlined">chat</span>
                </div>
                <div class="channel-info">
                  <span class="channel-type mono">{{ t('help.channelWaTitle') }}</span>
                  <span class="channel-value">{{ contentService.supportContact.value.whatsAppNumber }}</span>
                  <span class="channel-note">{{ t('help.channelWaNote') }}</span>
                </div>
                <span class="material-symbols-outlined channel-arrow icon--directional">open_in_new</span>
              </a>

              <a
                v-if="contentService.supportContact.value.phoneNumber"
                class="channel-card"
                :href="'tel:' + contentService.supportContact.value.phoneNumber.replace(/\s+/g, '')"
              >
                <div class="channel-icon channel-icon--phone">
                  <span class="material-symbols-outlined">call</span>
                </div>
                <div class="channel-info">
                  <span class="channel-type mono">{{ t('help.channelPhoneTitle') }}</span>
                  <span class="channel-value">{{ contentService.supportContact.value.phoneNumber }}</span>
                  <span class="channel-note">{{ t('help.channelPhoneNote') }}</span>
                </div>
                <span class="material-symbols-outlined channel-arrow icon--directional">call_made</span>
              </a>
            </div>

            <div class="escalation-sla-badge mono">
              <span class="material-symbols-outlined text-[16px]">verified</span>
              <span>{{ t('help.slaBadge') }}</span>
            </div>
          </div>

          <div class="escalation-form-panel">
            <div class="form-panel-header">
              <div class="panel-badge mono">
                <span class="material-symbols-outlined text-[18px]">edit_note</span>
                <span>{{ t('help.createTicket') }}</span>
              </div>
              <p class="panel-subtitle">{{ t('help.ticketPanelSubtitle') }}</p>
            </div>

            <div v-if="isAuthed" class="ticket-card-content">
              <!-- Success State -->
              <div v-if="ticketSuccess" class="ticket-success-state">
                <div class="success-icon-wrap">
                  <span class="material-symbols-outlined text-[36px]">check_circle</span>
                </div>
                <h3 class="success-title">{{ t('common.success') }}</h3>
                <p class="success-desc">{{ t('help.ticketCreated') }}</p>
                <div class="success-actions">
                  <button type="button" class="btn btn-primary btn-press" @click="router.push('/help/my-tickets')">
                    <span class="material-symbols-outlined text-[18px]">visibility</span>
                    <span>{{ t('help.myTickets') }}</span>
                  </button>
                  <button type="button" class="btn btn-ghost" @click="resetTicketForm">
                    <span class="material-symbols-outlined text-[18px]">add</span>
                    <span>{{ t('help.createTicket') }}</span>
                  </button>
                </div>
              </div>

              <form v-else class="ticket-form" @submit.prevent="submitTicket">
                <div v-if="quickSubjects.length" class="quick-subject-chips">
                  <span class="quick-chips-label mono">{{ t('help.quickTopics') }}</span>
                  <div class="quick-chips-list">
                    <button
                      v-for="subj in quickSubjects"
                      :key="subj.id"
                      type="button"
                      class="quick-subject-btn mono interactive-lift"
                      :class="{ 'is-selected': ticketSubject === subj.name }"
                      @click="setTicketSubject(subj.name)"
                    >
                      {{ subj.name }}
                    </button>
                  </div>
                </div>

                <div class="form-field">
                  <label class="form-label mono" for="ticket-subject">
                    <span>{{ t('help.subject') }}</span>
                    <span class="required-star">*</span>
                  </label>
                  <input
                    id="ticket-subject"
                    v-model="ticketSubject"
                    class="form-input"
                    :placeholder="t('help.subjectPlaceholder')"
                    required
                    :disabled="submittingTicket"
                  />
                </div>

                <div class="form-field">
                  <label class="form-label mono" for="ticket-message">
                    <span>{{ t('help.message') }}</span>
                    <span class="required-star">*</span>
                  </label>
                  <textarea
                    id="ticket-message"
                    v-model="ticketMessage"
                    class="form-textarea"
                    rows="4"
                    :placeholder="t('help.messagePlaceholder')"
                    required
                    :disabled="submittingTicket"
                  ></textarea>
                </div>

                <div v-if="ticketError" class="ticket-error-alert" role="alert">
                  <span class="material-symbols-outlined text-[18px]">error</span>
                  <span>{{ ticketError }}</span>
                </div>

                <button
                  type="submit"
                  class="btn btn-primary btn-press btn-submit-ticket mono"
                  :disabled="submittingTicket || !ticketSubject.trim() || !ticketMessage.trim()"
                >
                  <span v-if="submittingTicket" class="submit-spinner" aria-hidden="true"></span>
                  <span v-else class="material-symbols-outlined text-[18px]">send</span>
                  <span>{{ submittingTicket ? t('common.loading') : t('help.createTicket') }}</span>
                </button>
              </form>
            </div>

            <div v-else class="ticket-guest-card">
              <div class="guest-card-icon">
                <span class="material-symbols-outlined">lock_open</span>
              </div>
              <h3 class="guest-card-title">{{ t('help.guestTitle') }}</h3>
              <p class="guest-card-desc">{{ t('help.guestDesc') }}</p>
              <div class="guest-card-actions">
                <router-link
                  :to="{ path: '/auth/login', query: { redirect: '/help' } }"
                  class="btn btn-primary"
                >
                  <span class="material-symbols-outlined text-[18px]">login</span>
                  <span>{{ t('nav.login') }}</span>
                </router-link>
                <router-link
                  to="/auth/register"
                  class="btn btn-ghost"
                >
                  <span>{{ t('nav.register') }}</span>
                </router-link>
              </div>
              <p class="guest-card-subnote">{{ t('help.guestSubnote') }}</p>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- Article Reading Modal -->
    <BaseModal
      v-model="articleModalOpen"
      :title="selectedArticle?.title || 'Help Article'"
      max-width="680px"
    >
      <div v-if="selectedArticle" class="article-modal">
        <div class="article-modal__meta mono">
          <span class="article-modal__cat">{{ categoryName(selectedArticle.categoryId) }}</span>
          <span class="dot-sep">·</span>
          <span>{{ t('help.readTime', { minutes: 3 }) }}</span>
        </div>

        <h2 class="article-modal__title" v-html="modalTitleHtml"></h2>

        <div class="article-modal__body">
          <p
            v-for="(para, idx) in modalParagraphs"
            :key="idx"
            class="article-modal__para"
            v-html="para"
          ></p>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.help-nav-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.help-crumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11px;
  color: var(--wl-muted);
}

.help-crumb a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.help-crumb a:hover {
  color: var(--wl-primary);
}

.crumb-sep {
  color: var(--wl-border);
}

.crumb-current {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

/* Enhanced Hero Section with Diagnostics Graphics */
.help-hero {
  padding: 2.5rem 2rem;
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  border-radius: 16px;
  box-shadow: var(--wl-shadow-card);
  position: relative;
  overflow: hidden;
  margin-bottom: 2rem;
}

.help-hero::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
  opacity: 0.95;
}

.help-hero__grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 2.5rem;
  align-items: center;
}

.help-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10.5px;
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.5rem;
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--wl-success);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

.help-title {
  font-family: var(--wl-font-display);
  font-size: clamp(1.85rem, 3.2vw, 2.5rem);
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  line-height: 1.12;
  margin: 0 0 0.65rem;
}

.help-desc {
  font-size: 0.95rem;
  color: var(--wl-ink-soft);
  line-height: 1.55;
  margin: 0 0 1.5rem;
  max-width: 580px;
}

.help-search-box {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.help-search-input-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  height: 48px;
  padding: 0 1rem;
  box-shadow: var(--shadow-xs);
  transition: border-color 0.22s var(--wl-ease-spring), box-shadow 0.22s var(--wl-ease-spring), transform 0.16s ease;
  max-width: 540px;
}

.help-search-input-wrap:focus-within {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
  transform: translateY(-0.5px);
}

.search-icon {
  font-size: 20px;
  color: var(--wl-muted);
}

.help-search-field {
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.95rem;
  font-family: var(--wl-font-body);
  color: var(--wl-ink-strong);
  width: 100%;
}

.help-search-field::placeholder {
  color: var(--wl-muted);
  opacity: 0.85;
}

.search-clear-btn {
  background: none;
  border: none;
  color: var(--wl-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 0.2rem;
  border-radius: 50%;
  transition: color 0.15s ease;
}

.search-clear-btn:hover {
  color: var(--wl-ink-strong);
}

.search-kbd {
  font-size: 9.5px;
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.15rem 0.4rem;
  border-radius: 5px;
  letter-spacing: 0.04em;
  font-family: inherit;
}

.search-kbd-group {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
}

/* Active-query state: persistent accent ring while results are filtered */
.help-search-input-wrap.has-query {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

/* Query match highlight (rendered via v-html from utils/help-search) */
.search-mark {
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  border-radius: 4px;
  padding: 0 0.15em;
}

.article-card__tags {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.top-match-chip {
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.05em;
  white-space: nowrap;
  color: var(--wl-success);
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 0.12rem 0.5rem;
  border-radius: 9999px;
}

.faq-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.4rem;
  padding: 2rem 1rem;
  background: var(--wl-surface);
  border: 1px dashed var(--wl-border);
  border-radius: 14px;
  color: var(--wl-muted);
}

.faq-empty .material-symbols-outlined {
  font-size: 32px;
}

.faq-empty__title {
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
}

.faq-empty__desc {
  font-size: 0.88rem;
  margin: 0 0 0.5rem;
  max-width: 420px;
}

.quick-tags-wrap {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.quick-tags-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.06em;
}

.quick-tag-btn {
  font-size: 11px;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.quick-tag-btn:hover {
  background: var(--wl-primary-soft);
  border-color: var(--wl-primary-soft);
  color: var(--wl-primary);
  transform: translateY(-0.5px);
}

/* Right Side: hero photo with floating SLA chip + proof metrics */
.help-hero__graphic {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  min-width: 0;
}

.hero-media {
  position: relative;
  margin: 0;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--wl-border);
  box-shadow: var(--shadow-sm);
  aspect-ratio: 4 / 3;
  background: linear-gradient(135deg, var(--brand) 0%, var(--accent) 60%, var(--brand-hover) 100%);
}

.hero-media__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.hero-media::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(7, 21, 38, 0) 55%, rgba(7, 21, 38, 0.28) 100%);
}

.hero-media__fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.85);
}

.hero-media__fallback .material-symbols-outlined {
  font-size: 64px;
}

.hero-media__sla {
  position: absolute;
  top: 0.8rem;
  inset-inline-end: 0.8rem;
  z-index: 1;
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  background: rgba(7, 21, 38, 0.55);
  backdrop-filter: blur(6px);
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.35);
}

.telemetry-metrics {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px dashed var(--wl-border);
  padding-top: 0.75rem;
}

.telemetry-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  flex: 1;
}

.metric-val {
  font-size: 12.5px;
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.metric-lbl {
  font-size: 8.5px;
  color: var(--wl-muted);
  font-weight: 600;
  letter-spacing: 0.04em;
}

.telemetry-metric-sep {
  width: 1px;
  height: 20px;
  background: var(--wl-border);
}

/* Guides Grid & Cards (No 'view all' link) */
.guides-section {
  margin-bottom: 2.5rem;
}

.help-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.help-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  padding: 1.35rem 1.4rem;
  box-shadow: var(--wl-shadow-card);
  cursor: pointer;
  transition: transform 0.2s var(--wl-ease-spring), border-color 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.help-card__accent {
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2.5px;
  opacity: 0.85;
}

.help-card:hover {
  transform: translateY(-3px);
  border-color: var(--wl-primary-soft);
  box-shadow: var(--shadow-md);
}

.help-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.95rem;
}

.hc-icon-wrapper {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.hc-icon {
  font-size: 20px;
}

.hc-thumb-img {
  width: 22px;
  height: 22px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
}

.help-card__tag {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.06em;
}

.help-card__title {
  font-family: var(--wl-font-display);
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--wl-ink-strong);
  margin: 0 0 0.45rem;
  line-height: 1.25;
}

.help-card__desc {
  font-size: 0.88rem;
  color: var(--wl-ink-soft);
  line-height: 1.55;
  margin: 0 0 1.25rem;
  flex: 1;
}

/* Card footer without 'view all' text link */
.help-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--wl-surface-soft);
  padding-top: 0.75rem;
  margin-top: auto;
}

.help-card__count {
  font-size: 11px;
  font-weight: 600;
  color: var(--wl-muted);
}

.card-arrow {
  font-size: 16px;
  color: var(--wl-muted);
  transition: transform 0.15s ease, color 0.15s ease;
}

.help-card:hover .card-arrow {
  color: var(--wl-primary);
  transform: translateX(3px);
}

/* Section Common Headers */
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.section-head__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.search-context {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid var(--wl-border);
  padding: 0.3rem 0.7rem;
  border-radius: 9999px;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clear-filters-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--wl-ink-soft);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  padding: 0.3rem 0.7rem;
  border-radius: 9999px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.clear-filters-btn:hover {
  color: var(--wl-primary);
  border-color: var(--wl-primary);
  background: var(--wl-primary-soft);
}

.btn-show-all-articles {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid var(--wl-border);
  padding: 0.3rem 0.75rem;
  border-radius: 9999px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.btn-show-all-articles:hover {
  background: var(--brand);
  color: var(--bg-surface);
  border-color: var(--brand);
  transform: translateY(-1px);
}

.btn-show-all-articles--active {
  background: var(--brand);
  color: var(--bg-surface);
  border-color: var(--brand);
}

.article-expand-wrap {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
  padding-top: 0.5rem;
}

.btn-expand-articles {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--wl-primary);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  padding: 0.6rem 1.4rem;
  border-radius: 9999px;
  box-shadow: var(--shadow-xs);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-expand-articles:hover {
  background: var(--wl-primary-soft);
  border-color: var(--wl-primary);
  color: var(--wl-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.quick-tag-btn.is-active {
  background: var(--wl-primary);
  border-color: var(--wl-primary);
  color: var(--wl-on-primary, #ffffff);
}

.section-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10.5px;
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.25rem;
}

.section-title {
  font-family: var(--wl-font-display);
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--wl-ink-strong);
  margin: 0;
}

.article-counter {
  font-size: 11.5px;
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.3rem 0.75rem;
  border-radius: 9999px;
  font-weight: 600;
}

/* Topic Tabs */
.cat-pills {
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.95rem;
  border-radius: 9999px;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--wl-ink-soft);
  cursor: pointer;
  transition: all 0.15s ease;
}

.pill:hover {
  background: var(--wl-surface-soft);
  color: var(--wl-ink-strong);
}

.pill--active {
  background: var(--wl-primary) !important;
  border-color: var(--wl-primary) !important;
  color: var(--wl-ink-strong) !important;
  box-shadow: 0 2px 8px -2px rgba(105, 169, 255, 0.4);
}

.pill-img {
  width: 16px;
  height: 16px;
  object-fit: cover;
  border-radius: 3px;
}

.pill__count {
  font-size: 10px;
  padding: 0.1rem 0.4rem;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.08);
}

.pill--active .pill__count {
  background: rgba(255, 255, 255, 0.25);
  color: var(--wl-on-primary);
}

.pill--toggle {
  background: var(--wl-primary-soft);
  border: 1px dashed var(--wl-border-focus);
  color: var(--wl-primary);
  font-weight: 700;
}

.pill--toggle:hover {
  background: var(--brand);
  border-color: var(--brand);
  color: var(--bg-surface);
}

.pill--toggle-active {
  background: var(--wl-surface-soft);
  border-style: solid;
  border-color: var(--wl-border);
  color: var(--wl-ink-soft);
}

/* Article Grid */
.article-section {
  margin-bottom: 2.5rem;
}

.article-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.article-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  padding: 1.25rem 1.4rem;
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.article-card:hover {
  border-color: var(--wl-border-strong);
  transform: translateY(-1px);
}

.article-card__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  min-width: 0;
  gap: 0.5rem;
}

.article-card__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.article-thumb {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  color: var(--wl-primary);
  overflow: hidden;
  font-size: 20px;
}

.article-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.article-cat {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--wl-primary);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.article-read-time {
  font-size: 10px;
  color: var(--wl-muted);
}

.article-card__title {
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.35;
}

.article-card__body {
  font-size: 0.88rem;
  color: var(--wl-ink-soft);
  line-height: 1.55;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-card--interactive {
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.article-card--interactive:hover {
  border-color: var(--brand);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.article-card--interactive:hover .article-read-cta {
  color: var(--brand);
}

.article-card__footer {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid var(--wl-border, #edf2f7);
  color: var(--wl-muted, #64748b);
  font-size: 0.78rem;
  font-weight: 700;
}

.article-card__footer .icon--directional {
  transition: transform 0.2s ease;
}

.article-card--interactive:hover .article-card__footer .icon--directional {
  transform: translateX(4px);
}

[dir="rtl"] .article-card--interactive:hover .article-card__footer .icon--directional {
  transform: translateX(-4px);
}

/* Quick Topic Chips */
.quick-subject-chips {
  margin-bottom: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.quick-chips-label {
  font-size: 0.75rem;
  color: var(--wl-muted, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.quick-chips-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.quick-subject-btn {
  font-size: 0.75rem;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  border: 1px solid var(--wl-border, #D8E4F0);
  background: var(--wl-surface-soft, #F4F8FC);
  color: var(--wl-ink, #162736);
  cursor: pointer;
  transition: all 0.15s ease;
}

.quick-subject-btn:hover {
  border-color: var(--wl-primary, #0C63B8);
  background: #ffffff;
  color: var(--wl-primary, #0C63B8);
}

.quick-subject-btn.is-selected {
  border-color: var(--wl-primary, #0C63B8);
  background: var(--wl-primary, #0C63B8);
  color: #ffffff;
  font-weight: 700;
}

/* Article Modal */
.article-modal {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem 0.25rem;
}

.article-modal__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--wl-muted, #64748b);
}

.article-modal__cat {
  color: var(--wl-primary, #0C63B8);
  font-weight: 700;
}

.article-modal__title {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--wl-ink-strong, #0B1726);
  line-height: 1.3;
  margin: 0;
}

.article-modal__body {
  font-size: 0.95rem;
  color: var(--wl-ink-soft, #334155);
  line-height: 1.7;
  max-height: 55vh;
  overflow-y: auto;
  padding-inline-end: 0.5rem;
}

.article-modal__para {
  margin: 0 0 1rem;
}

/* FAQ Accordion */
.faq-section {
  margin-bottom: 2.5rem;
}

.faq-accordion-box {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  box-shadow: var(--wl-shadow-card);
  overflow: hidden;
}

.faq-item {
  border-bottom: 1px solid var(--wl-border);
}

.faq-item:last-child {
  border-bottom: none;
}

.faq-item__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 1.15rem 1.4rem;
  background: none;
  border: none;
  cursor: pointer;
  text-align: start;
  gap: 1rem;
  transition: background-color 0.12s ease;
}

.faq-item__header:hover {
  background: var(--wl-surface-soft);
}

.faq-item__left {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex: 1;
}

.faq-index {
  font-size: 11.5px;
  font-weight: 800;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid var(--wl-border);
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.faq-item__q {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  line-height: 1.35;
}

.faq-item__chev {
  font-size: 22px;
  color: var(--wl-muted);
  transition: transform 0.2s var(--wl-ease-spring);
  flex-shrink: 0;
}

.faq-item.open .faq-item__chev {
  transform: rotate(180deg);
  color: var(--wl-primary);
}

.faq-item__body {
  padding: 0 1.4rem 1.15rem 3.65rem;
}

.faq-item__a {
  font-size: 0.9rem;
  color: var(--wl-ink-soft);
  line-height: 1.6;
  margin: 0;
}

/* Help Role Card */
.help-role-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  padding: 1.5rem 1.75rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  box-shadow: var(--shadow-xs);
  margin-bottom: 2rem;
}

.role-card__left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.role-card__icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  display: grid;
  place-items: center;
  font-size: 24px;
  flex-shrink: 0;
}

.role-card__title {
  font-family: var(--wl-font-display);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0 0 0.25rem;
}

.role-card__desc {
  font-size: 0.88rem;
  color: var(--wl-ink-soft);
  margin: 0;
}

.role-card__actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* Contact Escalation Banner & Ticket Desk */
.help-contact-banner {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  margin-top: 3.5rem;
  margin-bottom: 3rem;
  padding: 2.75rem 2.25rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 20px;
  box-shadow: 0 4px 24px -6px rgba(0, 0, 0, 0.06);
  position: relative;
  overflow: hidden;
}

.help-contact-banner::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
}

.contact-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.contact-copy {
  flex: 1;
  min-width: 280px;
}

.contact-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11px;
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.4rem;
}

.contact-title {
  font-family: var(--wl-font-display);
  font-size: 1.65rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--wl-ink-strong);
  margin: 0 0 0.5rem;
}

.contact-desc {
  font-size: 0.94rem;
  color: var(--wl-ink-soft);
  margin: 0;
  max-width: 680px;
  line-height: 1.6;
}

.my-tickets-badge-link {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 1.15rem;
  border-radius: 9999px;
  background: var(--wl-primary-soft);
  border: 1px solid rgba(105, 169, 255, 0.22);
  color: var(--wl-primary);
  font-size: 0.84rem;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s ease;
}

.my-tickets-badge-link:hover {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  transform: translateY(-1px);
}

.tickets-count-pill {
  padding: 0.15rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.72rem;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  font-weight: 800;
  transition: all 0.2s ease;
}

.my-tickets-badge-link:hover .tickets-count-pill {
  background: var(--wl-surface);
  color: var(--wl-primary);
}


/* 2-Column Escalation Grid */
.escalation-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  gap: 2.25rem;
  align-items: stretch;
}

.escalation-channels {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.channel-group-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.channel-group-title {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  color: var(--wl-primary);
}

.channel-group-desc {
  font-size: 0.86rem;
  color: var(--wl-ink-soft);
  margin: 0;
  line-height: 1.5;
}

.channel-cards-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.channel-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem 1.2rem;
  border-radius: 12px;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  text-decoration: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.channel-card:hover {
  border-color: var(--wl-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
}

.channel-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 22px;
}

.channel-icon--email {
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
}

.channel-icon--whatsapp {
  background: var(--color-success-50, #E8F5E9);
  color: var(--color-success-500, #198754);
}

.channel-icon--phone {
  background: rgba(105, 169, 255, 0.12);
  color: var(--wl-accent);
}

.channel-info {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  flex: 1;
  min-width: 0;
}

.channel-type {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--wl-muted);
}

.channel-value {
  font-size: 0.94rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  word-break: break-all;
}

.channel-note {
  font-size: 0.78rem;
  color: var(--wl-ink-soft);
}

.channel-arrow {
  font-size: 18px;
  color: var(--wl-muted);
  flex-shrink: 0;
  transition: transform 0.2s ease, color 0.2s ease;
}

.channel-card:hover .channel-arrow {
  color: var(--wl-primary);
  transform: translateX(2px);
}

[dir="rtl"] .channel-card:hover .channel-arrow {
  transform: translateX(-2px);
}

.escalation-sla-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.95rem;
  border-radius: 10px;
  background: var(--wl-primary-soft);
  border: 1px solid var(--wl-border);
  font-size: 0.76rem;
  color: var(--wl-ink-soft);
  margin-top: auto;
  font-weight: 600;
}

/* Escalation Ticket Form Panel */
.escalation-form-panel {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-panel-header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.panel-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--wl-primary);
  letter-spacing: 0.05em;
}

.panel-subtitle {
  font-size: 0.86rem;
  color: var(--wl-ink-soft);
  margin: 0;
  line-height: 1.5;
}

.ticket-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-label {
  display: flex;
  align-items: center;
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--wl-ink-soft);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.required-star {
  color: var(--wl-danger);
  margin-inline-start: 0.25rem;
}

.form-input,
.form-textarea {
  width: 100%;
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  padding: 0.75rem 0.95rem;
  font-size: 0.92rem;
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-family: var(--wl-font-body);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-height: 48px;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.form-textarea {
  resize: vertical;
  min-height: 110px;
  line-height: 1.5;
}

.ticket-error-alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.9rem;
  border-radius: 8px;
  background: var(--wl-danger-soft);
  border: 1px solid var(--wl-border);
  color: var(--wl-danger);
  font-size: 0.85rem;
}

.btn-submit-ticket {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.85rem 1.5rem;
  font-size: 0.88rem;
  font-weight: 700;
  border-radius: 10px;
  cursor: pointer;
  min-height: 48px;
  transition: all 0.2s ease;
  width: 100%;
}

.btn-submit-ticket:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: var(--wl-on-primary);
  border-radius: 50%;
  animation: ticket-spin 0.8s linear infinite;
}

@keyframes ticket-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Ticket Success State */
.ticket-success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5rem 1rem;
  gap: 0.75rem;
}

.success-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--wl-success-soft);
  color: var(--wl-success);
  display: grid;
  place-items: center;
}

.success-title {
  font-family: var(--wl-font-display);
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
}

.success-desc {
  font-size: 0.9rem;
  color: var(--wl-ink-soft);
  margin: 0;
  max-width: 380px;
  line-height: 1.55;
}

.ticket-id-tag {
  font-size: 0.76rem;
  font-weight: 800;
  background: var(--wl-primary-soft);
  border: 1px solid var(--wl-border);
  color: var(--wl-primary);
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  letter-spacing: 0.06em;
}

.success-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
}

/* Unauthenticated Guest Card */
.ticket-guest-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5rem 1rem;
  gap: 0.75rem;
}

.guest-card-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: rgba(105, 169, 255, 0.08);
  color: var(--wl-primary);
  display: grid;
  place-items: center;
  font-size: 26px;
}

.guest-card-title {
  font-family: var(--wl-font-display);
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
}

.guest-card-desc {
  font-size: 0.88rem;
  color: var(--wl-ink-soft);
  margin: 0;
  max-width: 400px;
  line-height: 1.55;
}

.guest-card-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
}

.guest-card-subnote {
  font-size: 0.78rem;
  color: var(--wl-muted);
  margin: 0.5rem 0 0;
  max-width: 360px;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .help-hero__grid {
    grid-template-columns: 1fr;
  }
  .help-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .article-grid {
    grid-template-columns: 1fr;
  }
  .escalation-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

@media (max-width: 600px) {
  .help-grid {
    grid-template-columns: 1fr;
  }
  .help-contact-banner {
    padding: 1.5rem 1.15rem;
    margin-top: 2.25rem;
    margin-bottom: 2rem;
    gap: 1.5rem;
    padding-inline-start: max(1.15rem, env(safe-area-inset-left));
    padding-inline-end: max(1.15rem, env(safe-area-inset-right));
  }
  .contact-title {
    font-size: 1.35rem;
  }
  .contact-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  .my-tickets-badge-link {
    justify-content: center;
    width: 100%;
  }
  .channel-card {
    padding: 0.95rem 1rem;
  }
  .escalation-form-panel {
    padding: 1.25rem 1rem;
  }
  .success-actions .btn,
  .guest-card-actions .btn {
    width: 100%;
  }
  .faq-item__body {
    padding-inline-start: 1.4rem;
  }
}
</style>

