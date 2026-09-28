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
</script>

<template>
  <div class="page-shell cert-view">
    <BackButton fallback="/" variant="minimal" class="mb-3" />

    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('certifications.title') }}</span>
    </nav>

    <header class="cert-hero">
      <div class="hero-top-row">
        <div class="hero-text-zone">
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('certifications.eyebrow') }}</span>
          </div>
          <h1 class="hero-title">{{ t('certifications.qualityTitle') }}</h1>
          <p class="hero-desc">{{ t('certifications.qualitySubtitle') }}</p>

          <div v-if="certs.length" class="standards-pills-wrap">
            <span v-for="c in certs" :key="c.id" class="standard-pill mono">{{ c.certificateNumber || c.title }}</span>
          </div>
        </div>

        <div class="telemetry-box" :aria-label="t('certifications.title')">
          <div class="telemetry-cell">
            <span class="telemetry-val mono">{{ certs.length ? '100%' : '—' }}</span>
            <span class="telemetry-lbl mono">{{ certs.length ? 'VALIDITY RATE' : 'AWAITING DOSSIER' }}</span>
          </div>
          <div class="telemetry-div"></div>
          <div class="telemetry-cell">
            <span class="telemetry-val mono">AUDITED</span>
            <span class="telemetry-lbl mono">NOTIFIED BODY</span>
          </div>
          <div class="telemetry-div"></div>
          <div class="telemetry-cell">
            <span class="telemetry-val mono">AISI 420</span>
            <span class="telemetry-lbl mono">STEEL ALLOY SPEC</span>
          </div>
        </div>
      </div>
    </header>

    <section class="cert-section">
      <div class="section-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('certifications.jurisdictions', { count: certs.length }) }}</span>
          </div>
          <h2 class="section-title">{{ t('certifications.certsTitle') }}</h2>
        </div>
        <span class="mono count-badge">{{ t('certifications.certsValid', { count: certs.length }) }}</span>
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
                <span class="mono text-xs">{{ c.certificateNumber || 'PDF Document' }}</span>
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
            <div class="ref-badge mono">
              <span class="ref-label">{{ t('certifications.docRef') }}</span>
              <strong class="ref-num">{{ c.certificateNumber }}</strong>
            </div>

            <dl class="cert-meta-list">
              <div class="meta-item">
                <dt class="mono">{{ t('certifications.issuedTo') }}:</dt>
                <dd>{{ c.issuedTo }}</dd>
              </div>
              <div class="meta-item">
                <dt class="mono">{{ t('certifications.issuer') }}:</dt>
                <dd>{{ c.issuer }}</dd>
              </div>
              <div class="meta-item">
                <dt class="mono">{{ t('certifications.issueDate') }}:</dt>
                <dd class="mono">{{ new Date(c.issueDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</dd>
              </div>
              <div v-if="c.expiryDate" class="meta-item">
                <dt class="mono">{{ t('certifications.expiryDate') }}:</dt>
                <dd class="mono">{{ new Date(c.expiryDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</dd>
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

.telemetry-box {
  display: flex;
  align-items: center;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  padding: 1.25rem 1.75rem;
  gap: 1.5rem;
}

.telemetry-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.telemetry-val {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.telemetry-lbl {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.06em;
}

.telemetry-div {
  width: 1px;
  height: 36px;
  background: var(--wl-border);
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
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
}

.cert-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  padding: 0;
  box-shadow: var(--wl-shadow-card);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.2s ease;
}

.cert-card:hover {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-shadow-card-hover);
  transform: translateY(-2px);
}

.cert-card__media {
  position: relative;
  width: 100%;
  height: 180px;
  background: var(--wl-surface-soft, #f1f5f9);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--wl-border);
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
  font-size: 3rem;
}

.cert-card__body {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  flex: 1;
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
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding-top: 0.65rem;
  border-top: 1px solid var(--wl-border);
  font-size: 12px;
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
}

@media (max-width: 640px) {
  .cert-hero {
    padding: 1.25rem;
    border-radius: 16px;
  }
  .hero-top-row {
    gap: 1.25rem;
  }
  .telemetry-box {
    flex: 1 1 100%;
    min-width: 0;
    flex-wrap: wrap;
    justify-content: space-around;
    gap: 0.85rem;
    padding: 1rem;
  }
  .telemetry-val {
    font-size: 1.15rem;
  }
  .cert-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .section-head {
    gap: 0.75rem;
  }
}

</style>
