<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { t, locale } from '../../i18n'
import { certificationService } from '../../di/container'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import DataState from '../../components/ui/DataState.vue'
import BackButton from '../../components/ui/BackButton.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import AppImage from '../../components/ui/AppImage.vue'

const certs = certificationService.certifications
const loading = ref(true)
const searchQuery = ref('')
const page = ref(1)
const pageSize = ref(6)

onMounted(async () => {
  await certificationService.load()
  loading.value = false
})

function isPdfDoc(name: string | null | undefined): boolean {
  if (!name) return false
  const str = name.toLowerCase()
  const qIdx = str.indexOf('?')
  const noQuery = qIdx >= 0 ? str.slice(0, qIdx) : str
  const hIdx = noQuery.indexOf('#')
  const clean = hIdx >= 0 ? noQuery.slice(0, hIdx) : noQuery
  return clean.endsWith('.pdf')
}

const filteredCerts = computed(() => {
  let list = [...certs.value]
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter((c) =>
      (c.title || '').toLowerCase().includes(q) ||
      (c.certificateNumber || '').toLowerCase().includes(q) ||
      (c.issuer || '').toLowerCase().includes(q) ||
      (c.issuedTo || '').toLowerCase().includes(q)
    )
  }
  return list
})

const totalCount = computed(() => filteredCerts.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))
const paginatedCerts = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredCerts.value.slice(start, start + pageSize.value)
})

watch(searchQuery, () => {
  page.value = 1
})

const goPage = (p: number) => {
  page.value = p
}

const NOW = new Date()

const activeCount = computed(() => certs.value.filter((c) => c.isActive).length)
const expiredCount = computed(
  () => certs.value.filter((c) => c.expiryDate && new Date(c.expiryDate) < NOW).length,
)
const issuerCount = computed(
  () => new Set(certs.value.map((c) => c.issuer).filter(Boolean)).size,
)
const nearestExpiry = computed(() => {
  const future = certs.value
    .filter((c) => c.expiryDate && new Date(c.expiryDate) >= NOW)
    .map((c) => new Date(c.expiryDate as string))
    .sort((a, b) => a.getTime() - b.getTime())
  return future[0] ?? null
})

const formatDate = (d: Date) =>
  d.toLocaleDateString(locale.value === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
  })

const certStats = computed(() => [
  { icon: 'workspace_premium', label: t('certifications.statTotal'), value: t('certifications.certCount', { count: certs.value.length }) },
  { icon: 'verified', label: t('certifications.statActive'), value: t('certifications.certCount', { count: activeCount.value }) },
  { icon: 'account_balance', label: t('certifications.statIssuers'), value: t('certifications.certCount', { count: issuerCount.value }) },
  {
    icon: expiredCount.value ? 'gpp_bad' : 'event_available',
    label: t('certifications.statNextExpiry'),
    value: nearestExpiry.value
      ? formatDate(nearestExpiry.value)
      : expiredCount.value
        ? t('certifications.statExpired', { count: expiredCount.value })
        : '—',
  },
])
</script>

<template>
  <div class="page-shell cert-view">
    <BackButton fallback="/" variant="minimal" class="mb-3" />

    <nav class="crumb-bar" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('certifications.title') }}</span>
    </nav>

    <header class="cert-hero">
      <div class="hero-top-row">
        <div class="hero-text-zone">
          <div class="head-chip">
            <span class="pulse-dot" aria-hidden="true"></span>
            <span>{{ t('certifications.eyebrow') }}</span>
          </div>
          <h1 class="hero-title">{{ t('certifications.qualityTitle') }}</h1>
          <p class="hero-desc">{{ t('certifications.qualitySubtitle') }}</p>

          <div v-if="certs.length" class="standards-pills-wrap">
            <span v-for="c in certs" :key="c.id" class="standard-pill">{{ c.certificateNumber || c.title }}</span>
          </div>
        </div>

        <dl class="cert-stats">
          <div v-for="stat in certStats" :key="stat.label" class="cert-stat">
            <dt class="cert-stat__label">
              <span class="material-symbols-outlined cert-stat__icon" aria-hidden="true">{{ stat.icon }}</span>
              {{ stat.label }}
            </dt>
            <dd class="cert-stat__value">{{ stat.value }}</dd>
          </div>
        </dl>
      </div>
    </header>

    <section class="cert-section">
      <div class="section-head">
        <div>
          <div class="head-chip">
            <span class="pulse-dot" aria-hidden="true"></span>
            <span>{{ t('certifications.jurisdictions', { count: certs.length }) }}</span>
          </div>
          <h2 class="section-title">{{ t('certifications.certsTitle') }}</h2>
        </div>
        <span class="count-badge">{{ t('certifications.certsValid', { count: certs.length }) }}</span>
      </div>

      <div class="cert-toolbar">
        <div class="search-box">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="t('common.searchPlaceholder')"
            class="search-input"
          />
          <button v-if="searchQuery" class="clear-search-btn" type="button" @click="searchQuery = ''">
            <span class="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

      </div>

      <SkeletonLoader v-if="loading" type="cert-grid" :count="4" />
      <DataState
        v-else
        :empty="!filteredCerts.length"
        :empty-title="t('certifications.certsTitle')"
        :empty-description="t('certifications.certsSubtitle')"
        skeleton-type="card"
        min-height="240px"
      >
        <div class="cert-grid">
          <article v-for="c in paginatedCerts" :key="c.id" class="cert-card">
            <!-- Full-width certificate banner image -->
            <div class="cert-card__media" :class="{ 'cert-card__media--pdf': isPdfDoc(c.certificationImageName) }">
              <div v-if="isPdfDoc(c.certificationImageName)" class="cert-pdf-placeholder">
                <span class="material-symbols-outlined cert-pdf-icon">picture_as_pdf</span>
                <span class="text-xs">{{ c.certificateNumber || 'PDF Document' }}</span>
              </div>
              <AppImage
                v-else
                :src="c.certificationImageName"
                placeholder-type="document"
                :alt="c.title"
                fit="cover"
                class="cert-card__img"
              />
            </div>

            <div class="cert-card__body">

            <h3 class="cert-title-text">{{ c.title }}</h3>
            <div class="ref-badge">
              <span class="ref-label">{{ t('certifications.docRef') }}</span>
              <strong class="ref-num">{{ c.certificateNumber }}</strong>
            </div>

            <dl class="cert-meta-list">
              <div class="meta-item">
                <dt>{{ t('certifications.issuedTo') }}:</dt>
                <dd>{{ c.issuedTo }}</dd>
              </div>
              <div class="meta-item">
                <dt>{{ t('certifications.issuer') }}:</dt>
                <dd>{{ c.issuer }}</dd>
              </div>
              <div class="meta-item">
                <dt>{{ t('certifications.issueDate') }}:</dt>
                <dd>{{ formatDate(new Date(c.issueDate)) }}</dd>
              </div>
              <div v-if="c.expiryDate" class="meta-item">
                <dt>{{ t('certifications.expiryDate') }}:</dt>
                <dd>{{ formatDate(new Date(c.expiryDate)) }}</dd>
              </div>
            </dl>
            </div>
          </article>
        </div>

        <AppPagination
          v-if="totalPages > 1"
          :page="page"
          :total-pages="totalPages"
          :total-items="totalCount"
          :page-size="pageSize"
          class="mt-6"
          @change="goPage"
        />
      </DataState>
    </section>
  </div>
</template>

<style scoped>
.cert-view {
  width: 100%;
  gap: 2.5rem;
}

.cert-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 240px;
  max-width: 420px;
}

.search-icon {
  position: absolute;
  inset-inline-start: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--wl-muted);
  font-size: 18px;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.5rem 2rem;
  border-radius: var(--wl-radius-sm);
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  color: var(--wl-text);
  font-size: 0.8125rem;
  outline: none;
}

.search-input:focus {
  border-color: var(--wl-primary);
}

.clear-search-btn {
  position: absolute;
  inset-inline-end: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--wl-muted);
  cursor: pointer;
  padding: 2px;
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
  color: var(--wl-border);
}

.crumb-active {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-gold);
  background: var(--wl-gold-soft);
  border: 1px solid rgba(255, 209, 102, 0.35);
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  letter-spacing: 0.06em;
  width: fit-content;
  margin-bottom: 0.5rem;
  text-shadow: var(--wl-gold-text-shadow);
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-gold);
  box-shadow: var(--wl-gold-glow-soft);
}

.cert-hero {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 20px;
  padding: 2.5rem;
  box-shadow: var(--wl-shadow-card);
}

.hero-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.hero-text-zone {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-width: 680px;
}

.hero-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: clamp(1.85rem, 3.5vw, 2.5rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  margin: 0;
  background: var(--wl-gradient-gold);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: var(--wl-gold-text-filter);
  line-height: 1.1;
}

.hero-desc {
  font-size: 15px;
  color: var(--wl-muted);
  line-height: 1.6;
  margin: 0.35rem 0 0;
}

.standards-pills-wrap {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.standard-pill {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-faint);
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  letter-spacing: 0.04em;
}

/* Real certification stats — computed from the loaded dossier */
.cert-stats {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: 0.5rem 1.25rem;
  box-shadow: var(--wl-shadow-card);
  min-width: 260px;
}

.cert-stat {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 0;
  border-bottom: 1px solid var(--wl-border);
}

.cert-stat:last-child {
  border-bottom: none;
}

.cert-stat__label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-neutral-600);
  margin: 0;
}

.cert-stat__icon {
  font-size: 15px;
  color: var(--wl-primary);
}

.cert-stat__value {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  text-align: end;
  margin: 0;
}

.cert-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.section-title {
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  margin: 0.2rem 0 0;
  color: var(--wl-gold-text);
  text-shadow: var(--wl-gold-text-shadow);
}

.count-badge {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
}

.cert-grid {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

/* Certificate cards — horizontal row: thumbnail left, dossier details right */
.cert-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: 1rem 1.25rem;
  box-shadow: var(--wl-shadow-card);
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 1.25rem;
  transition: all 0.2s ease;
}

.cert-card:hover {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-shadow-card-hover);
  transform: translateX(3px);
}

[dir='rtl'] .cert-card:hover { transform: translateX(-3px); }

.cert-card__media {
  position: relative;
  flex: 0 0 148px;
  width: 148px;
  align-self: stretch;
  min-height: 116px;
  background: var(--wl-surface-soft, #f1f5f9);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  border: 1px solid var(--wl-border);
}

.cert-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.35s ease;
}

.cert-card:hover .cert-card__img {
  transform: scale(1.04);
}

.cert-pdf-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--wl-danger);
}

.cert-pdf-icon {
  font-size: 2.5rem;
}

.cert-card__body {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  flex: 1;
  min-width: 0;
}

.cert-card-actions {
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid var(--wl-border);
}

.cert-title-text {
  font-size: 15px;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
}

.ref-badge {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-size: 12px;
}

.ref-label {
  font-size: 10px;
  color: var(--wl-muted);
  font-weight: 700;
}

.ref-num {
  color: var(--wl-primary);
}

.cert-meta-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem 2rem;
  margin: 0;
  padding-top: 0.65rem;
  border-top: 1px solid var(--wl-border);
  font-size: 12px;
}

@media (max-width: 900px) {
  .cert-meta-list { grid-template-columns: 1fr; }
}

.meta-item {
  display: flex;
  justify-content: space-between;
}

.meta-item dt {
  color: var(--wl-muted);
  font-weight: 600;
}

.meta-item dd {
  color: var(--wl-ink-strong);
  margin: 0;
  font-weight: 500;
  text-align: end;
}

@media (max-width: 640px) {
  .cert-hero {
    padding: 1.25rem;
    border-radius: 16px;
  }
  .hero-top-row {
    gap: 1.25rem;
  }
  .cert-stats {
    min-width: 0;
    width: 100%;
    padding: 0.5rem 1rem;
  }
  .cert-card {
    flex-direction: column;
    gap: 0.9rem;
    padding: 0.9rem 1rem;
  }
  .cert-card__media {
    flex: 0 0 auto;
    width: 100%;
    height: 150px;
    min-height: 0;
  }
  .section-head {
    gap: 0.75rem;
  }
}

</style>
