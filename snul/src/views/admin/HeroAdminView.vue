<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import DataState from '../../components/ui/DataState.vue'
import { services } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t, locale } from '../../i18n'
import type { LandingPageDto } from '../../domain/models/content'

const HERO_SLUG = 'home-hero'

const loading = ref(true)
const fetchError = ref('')

onMounted(() => {
  void loadHeroData()
})

const heroSaving = ref(false)
const existingHeroPage = ref<LandingPageDto | null>(null)
const heroForm = ref({
  title: '',
  accent: '',
  subtitle: '',
  isActive: true,
})

const loadHeroData = async () => {
  loading.value = true
  fetchError.value = ''
  const fill = (page: LandingPageDto) => {
    existingHeroPage.value = page
    heroForm.value = {
      title: page.heroTitle || '',
      accent: page.contentBlock || '',
      subtitle: page.heroBody || '',
      isActive: page.isActive !== false,
    }
  }
  try {
    // Slug lookup only returns ACTIVE records — fall back to the full list so
    // a deactivated hero still loads for editing (avoids a 409 duplicate).
    const page = await services.contentRepository.getLandingPageBySlug(HERO_SLUG)
    if (page && page.id) {
      fill(page)
      return
    }
    const allPages = await services.contentRepository.getLandingPages({ pageSize: 50 }).catch(() => null)
    const found = allPages?.data?.find((p) => p.slug?.toLowerCase() === HERO_SLUG)
    if (found) fill(found)
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

/* Preview mirrors landing semantics exactly: an existing record replaces
 * verbatim (blanks stay blank); defaults only show before the first save. */
const pvTitle = computed(() => heroForm.value.title.trim() || (!existingHeroPage.value ? t('home.heroTitle') : ''))
const pvAccent = computed(() => heroForm.value.accent.trim() || (!existingHeroPage.value ? t('home.heroTitleAccent') : ''))
const pvSubtitle = computed(() => heroForm.value.subtitle.trim() || (!existingHeroPage.value ? t('home.heroSubtitle') : ''))

const handleHeroSave = async () => {
  if (!heroForm.value.title.trim()) {
    toastService.error(locale.value === 'ar' ? 'يرجى إدخال العنوان الرئيسي للواجهة.' : 'Please provide the hero title.')
    return
  }
  heroSaving.value = true
  try {
    if (existingHeroPage.value && existingHeroPage.value.id) {
      const res = await services.contentRepository.updateLandingPage(existingHeroPage.value.id, {
        type: 'Brand',
        slug: HERO_SLUG,
        heroTitle: heroForm.value.title.trim(),
        heroBody: heroForm.value.subtitle.trim(),
        contentBlock: heroForm.value.accent.trim(),
        isActive: heroForm.value.isActive,
      })
      existingHeroPage.value = res
    } else {
      const res = await services.contentRepository.createLandingPage({
        type: 'Brand',
        slug: HERO_SLUG,
        heroTitle: heroForm.value.title.trim(),
        heroBody: heroForm.value.subtitle.trim(),
        contentBlock: heroForm.value.accent.trim(),
      })
      existingHeroPage.value = res
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('snul:content-changed'))
      window.dispatchEvent(new CustomEvent('welco:content-changed'))
    }
    toastService.success(locale.value === 'ar' ? 'تم حفظ ومزامنة الواجهة الرئيسية بنجاح' : 'Homepage hero saved and synchronized successfully!')
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    heroSaving.value = false
  }
}
</script>

<template>
  <AdminLayout>
    <div class="about-admin-view">
      <!-- Executive Header -->
      <header class="about-admin-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>CONTENT SYNCHRONIZATION</span>
          </div>
          <h1 class="head-title">{{ locale === 'ar' ? 'واجهة الصفحة الرئيسية والمزامنة' : 'Homepage Hero Management' }}</h1>
          <p class="head-subtitle">
            {{ locale === 'ar'
              ? 'التحكم في العنوان والوصف أعلى الصفحة الرئيسية ومزامنتهما فورياً مع صفحة الهبوط.'
              : 'Directly manage the landing top hero headline and subtitle, synchronized instantly with the homepage.'
            }}
          </p>
        </div>

        <div class="head-actions">
          <BaseButton variant="primary" :loading="heroSaving" icon="save" @click="handleHeroSave">
            {{ t('common.save') }}
          </BaseButton>
        </div>
      </header>

      <DataState
        :loading="loading"
        :error="fetchError && !existingHeroPage ? fetchError : null"
        min-height="400px"
        @retry="loadHeroData"
      >
        <div class="editor-grid">
          <div class="card editor-card">
            <div class="card-head">
              <div class="card-head__title">
                <span class="material-symbols-outlined card-icon">ads_click</span>
                <h2 class="card-title">{{ locale === 'ar' ? 'محتوى الواجهة الرئيسية' : 'Homepage Hero Content' }}</h2>
              </div>
              <div class="status-toggle-wrap">
                <label class="switch-label mono text-xs">
                  <input v-model="heroForm.isActive" type="checkbox" class="toggle-checkbox" />
                  <span class="toggle-track"></span>
                  <span class="toggle-text">{{ heroForm.isActive ? t('admin.active') : t('admin.inactive') }}</span>
                </label>
              </div>
            </div>

            <form class="editor-form" @submit.prevent="handleHeroSave">
              <div class="form-group">
                <label class="field-label" for="hero-title">
                  {{ locale === 'ar' ? 'العنوان الرئيسي (Hero Title)' : 'Hero Title' }} *
                </label>
                <input
                  id="hero-title"
                  v-model="heroForm.title"
                  type="text"
                  class="field-input"
                  required
                  :placeholder="t('home.heroTitle')"
                />
                <span class="field-hint mono text-xs">
                  {{ locale === 'ar' ? 'السطر الأول البارز في واجهة الصفحة الرئيسية.' : 'Main headline shown at the top of the landing page.' }}
                </span>
              </div>

              <div class="form-group">
                <label class="field-label" for="hero-accent">
                  {{ locale === 'ar' ? 'سطر التمييز (Accent Line)' : 'Hero Accent Line' }}
                </label>
                <input
                  id="hero-accent"
                  v-model="heroForm.accent"
                  type="text"
                  class="field-input"
                  :placeholder="t('home.heroTitleAccent')"
                />
                <span class="field-hint mono text-xs">
                  {{ locale === 'ar' ? 'السطر الثاني المميز بلون مختلف. اتركه فارغاً لإخفائه.' : 'Highlighted second line. Leave empty to hide it.' }}
                </span>
              </div>

              <div class="form-group">
                <label class="field-label" for="hero-subtitle">
                  {{ locale === 'ar' ? 'الوصف الفرعي (Subtitle)' : 'Hero Subtitle' }}
                </label>
                <textarea
                  id="hero-subtitle"
                  v-model="heroForm.subtitle"
                  rows="3"
                  class="field-textarea"
                  :placeholder="t('home.heroSubtitle')"
                ></textarea>
                <span class="field-hint mono text-xs">
                  {{ locale === 'ar' ? 'النص التعريفي تحت العنوان. اتركه فارغاً لإخفائه.' : 'Supporting text under the headline. Leave empty to hide it.' }}
                </span>
              </div>

              <div class="editor-actions">
                <BaseButton variant="primary" type="submit" :loading="heroSaving" icon="check">
                  {{ locale === 'ar' ? 'حفظ ومزامنة الواجهة' : 'Save & Sync Hero' }}
                </BaseButton>
              </div>
            </form>
          </div>

          <div class="card preview-card">
            <div class="card-head">
              <div class="card-head__title">
                <span class="material-symbols-outlined card-icon">visibility</span>
                <h2 class="card-title">{{ locale === 'ar' ? 'معاينة الواجهة' : 'Hero Preview' }}</h2>
              </div>
              <span class="preview-tag mono">SYNCED</span>
            </div>
            <div class="preview-body">
              <div class="hero-mock">
                <h3 class="mock-title">
                  {{ pvTitle }}<span v-if="pvAccent" class="mock-hero-accent"> {{ pvAccent }}</span>
                </h3>
                <p v-if="pvSubtitle" class="mock-body">{{ pvSubtitle }}</p>
              </div>
            </div>
          </div>
        </div>
      </DataState>
    </div>
  </AdminLayout>
</template>

<style scoped>
.about-admin-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 1300px;
  margin: 0 auto;
}

.about-admin-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
  padding: 1.5rem 1.75rem;
  background: white;
  border: 1px solid var(--admin-border-subtle, #e2e8f0);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.65rem;
  background: var(--accent);
  color: #ffffff;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background: var(--primary-800, #0f3d56);
  border-radius: 50%;
  animation: pulse-dot 1.8s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.head-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--slate-900, #0f172a);
  margin: 0 0 0.25rem;
  letter-spacing: -0.02em;
}

.head-subtitle {
  font-size: 0.875rem;
  color: var(--slate-500, #64748b);
  margin: 0;
  max-width: 680px;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.preview-ext-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.85rem;
  border-radius: var(--radius-md, 8px);
  background: var(--slate-100, #f1f5f9);
  color: var(--slate-700, #334155);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid var(--slate-200, #e2e8f0);
  transition: all 0.15s ease;
}

.preview-ext-btn:hover {
  background: var(--slate-200, #e2e8f0);
  color: var(--slate-900, #0f172a);
}

/* Grid Layout */
.editor-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
}

.hero-mock {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.mock-hero-accent {
  color: var(--wl-primary);
}

@media (max-width: 1024px) {
  .editor-grid {
    grid-template-columns: 1fr;
  }
}

.card {
  background: white;
  border: 1px solid var(--admin-border-subtle, #e2e8f0);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--slate-100, #f1f5f9);
  background: var(--slate-50, #f8fafc);
}

.card-head__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.card-icon {
  font-size: 20px;
  color: var(--primary-700, #147d92);
}

.card-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--slate-800, #1e293b);
  margin: 0;
}

/* Toggle Switch */
.switch-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.toggle-checkbox {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle-track {
  width: 36px;
  height: 20px;
  background: var(--slate-300, #cbd5e1);
  border-radius: 9999px;
  position: relative;
  transition: background 0.2s ease;
}

.toggle-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.toggle-checkbox:checked + .toggle-track {
  background: var(--emerald-500, #10b981);
}

.toggle-checkbox:checked + .toggle-track::after {
  transform: translateX(16px);
}

.toggle-text {
  font-weight: 600;
  color: var(--slate-700, #334155);
}

/* Form Styles */
.editor-form {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--slate-700, #334155);
}

.field-input,
.field-textarea {
  width: 100%;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--slate-200, #cbd5e1);
  border-radius: var(--radius-md, 8px);
  background: white;
  color: var(--slate-900, #0f172a);
  font-size: 0.875rem;
  font-family: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field-input:focus,
.field-textarea:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(12, 99, 184, 0.15);
}

.field-hint {
  color: var(--slate-500, #64748b);
  line-height: 1.4;
}

.editor-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--slate-100, #f1f5f9);
}

/* Preview Styles */
.preview-tabs {
  display: flex;
  gap: 0.25rem;
  background: var(--slate-200, #e2e8f0);
  padding: 3px;
  border-radius: var(--radius-md, 8px);
}

.preview-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border: none;
  background: transparent;
  color: var(--slate-600, #475569);
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preview-tab.is-active {
  background: white;
  color: var(--slate-900, #0f172a);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.preview-body {
  padding: 1.5rem;
}

.preview-frame-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  color: var(--slate-500, #64748b);
  font-weight: 600;
}

.preview-tag {
  background: rgba(16, 185, 129, 0.12);
  color: var(--emerald-600, #059669);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 800;
}

/* Homepage Simulation */
.landing-mock-section {
  background: var(--platform-aqua, #e0f2fe);
  border: 1px solid #bae6fd;
  border-radius: var(--radius-lg, 12px);
  padding: 1.5rem;
}

.mock-grid {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.mock-eyebrow {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  color: var(--primary-800, #075985);
  letter-spacing: 0.08em;
  margin-bottom: 0.35rem;
}

.mock-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--slate-900, #0f172a);
  margin: 0 0 0.5rem;
  line-height: 1.3;
}

.mock-body {
  font-size: 0.875rem;
  color: var(--slate-700, #334155);
  margin: 0 0 0.75rem;
  line-height: 1.5;
}

.mock-sub-body {
  font-size: 0.8125rem;
  color: var(--slate-600, #475569);
  margin: 0 0 1rem;
  line-height: 1.5;
}

.mock-actions {
  display: flex;
  gap: 0.5rem;
}

.mock-btn {
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
}

.mock-btn--primary {
  background: var(--primary-700, #0284c7);
  color: white;
}

.mock-btn--outline {
  border: 1px solid var(--slate-300, #cbd5e1);
  background: white;
  color: var(--slate-800, #1e293b);
}

.mock-media-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: white;
  padding: 0.5rem 0.85rem;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--slate-800, #1e293b);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* About View Simulation */
.about-mock-hero {
  border-bottom: 1px solid var(--slate-100, #f1f5f9);
  padding-bottom: 1.25rem;
  margin-bottom: 1.25rem;
}

.mock-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.mock-chip {
  background: var(--slate-100, #f1f5f9);
  border: 1px solid var(--slate-200, #e2e8f0);
  color: var(--slate-700, #334155);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
}

.story-divider {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 10px;
  font-weight: 700;
  color: var(--slate-400, #94a3b8);
  margin-bottom: 0.75rem;
}

.story-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--slate-200, #e2e8f0);
}

.mock-paragraphs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.mock-p {
  font-size: 0.8125rem;
  color: var(--slate-700, #334155);
  margin: 0;
  line-height: 1.6;
}
</style>
