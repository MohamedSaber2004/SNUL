<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import DataState from '../../components/ui/DataState.vue'
import { services } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t, locale } from '../../i18n'
import type { LandingPageDto } from '../../domain/models/content'

const ABOUT_US_SLUG = 'about-us'

const loading = ref(true)
const saving = ref(false)
const fetchError = ref('')
const existingPage = ref<LandingPageDto | null>(null)
const previewMode = ref<'landing' | 'about'>('landing')

const form = ref({
  heroTitle: '',
  heroBody: '',
  contentBlock: '',
  isActive: true,
})

const defaultFallbacks = {
  heroTitle: 'Engineering Excellence in Surgical & Hospital Instruments',
  heroBody: 'SNUL provides certified medical equipment and precision surgical tools to healthcare institutions and authorized distributors worldwide.',
  contentBlock: `Founded with a commitment to surgical excellence, SNUL operates as a specialized medical infrastructure platform connecting accredited manufacturers with hospital procurement networks.\n\nEvery instrument is forged from medical-grade AISI 410 / 420 stainless steel and validated under ISO 13485 and CE MDR quality management frameworks.\n\nFrom tier-1 surgical theaters to regional clinics across 40+ countries, our supply chain ensures predictable delivery, transparent pricing, and rigorous device traceability.`,
}

const loadAboutData = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    const page = await services.contentRepository.getLandingPageBySlug(ABOUT_US_SLUG)
    if (page && page.id) {
      existingPage.value = page
      form.value = {
        heroTitle: page.heroTitle || defaultFallbacks.heroTitle,
        heroBody: page.heroBody || defaultFallbacks.heroBody,
        contentBlock: page.contentBlock || defaultFallbacks.contentBlock,
        isActive: page.isActive !== false,
      }
    } else {
      const allPages = await services.contentRepository.getLandingPages({ pageSize: 50 }).catch(() => null)
      const found = allPages?.data?.find((p) => p.slug?.toLowerCase() === ABOUT_US_SLUG)
      if (found) {
        existingPage.value = found
        form.value = {
          heroTitle: found.heroTitle || defaultFallbacks.heroTitle,
          heroBody: found.heroBody || defaultFallbacks.heroBody,
          contentBlock: found.contentBlock || defaultFallbacks.contentBlock,
          isActive: found.isActive !== false,
        }
      } else {
        existingPage.value = null
        form.value = {
          heroTitle: defaultFallbacks.heroTitle,
          heroBody: defaultFallbacks.heroBody,
          contentBlock: defaultFallbacks.contentBlock,
          isActive: true,
        }
      }
    }
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
    form.value = {
      heroTitle: defaultFallbacks.heroTitle,
      heroBody: defaultFallbacks.heroBody,
      contentBlock: defaultFallbacks.contentBlock,
      isActive: true,
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadAboutData()
})

const handleSave = async () => {
  if (!form.value.heroTitle.trim()) {
    toastService.error(locale.value === 'ar' ? 'يرجى إدخال عنوان الصفحة' : 'Please provide a hero title.')
    return
  }

  saving.value = true
  try {
    if (existingPage.value && existingPage.value.id) {
      const res = await services.contentRepository.updateLandingPage(existingPage.value.id, {
        type: 'Brand',
        slug: ABOUT_US_SLUG,
        heroTitle: form.value.heroTitle.trim(),
        heroBody: form.value.heroBody.trim(),
        contentBlock: form.value.contentBlock.trim(),
        isActive: form.value.isActive,
      })
      existingPage.value = res
    } else {
      const res = await services.contentRepository.createLandingPage({
        type: 'Brand',
        slug: ABOUT_US_SLUG,
        heroTitle: form.value.heroTitle.trim(),
        heroBody: form.value.heroBody.trim(),
        contentBlock: form.value.contentBlock.trim(),
      })
      existingPage.value = res
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('snul:content-changed'))
      window.dispatchEvent(new CustomEvent('welco:content-changed'))
    }
    toastService.success(locale.value === 'ar' ? 'تم حفظ ومزامنة بيانات صفحة من نحن بنجاح' : 'About Us content saved and synchronized successfully!')
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    saving.value = false
  }
}

const previewParagraphs = computed(() => {
  if (!form.value.contentBlock.trim()) return []
  return form.value.contentBlock
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
})


</script>

<template>
  <AdminLayout>
    <div class="about-admin-view">
      <header class="about-admin-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>CONTENT SYNCHRONIZATION</span>
          </div>
          <h1 class="head-title">{{ locale === 'ar' ? 'إدارة صفحة من نحن والمزامنة' : 'About Us Management' }}</h1>
          <p class="head-subtitle">
            {{ locale === 'ar'
              ? 'التحكم في محتوى ورسالة الشركة لمزامنتها آلياً بين الصفحة الرئيسية وصفحة من نحن.'
              : 'Directly manage and synchronize company narrative, credentials, and story across the Landing Page and About Us page.'
            }}
          </p>
        </div>

        <div class="head-actions">
          <BaseButton variant="primary" :loading="saving" icon="save" @click="handleSave">
            {{ t('common.save') }}
          </BaseButton>
        </div>
      </header>

      <DataState
        :loading="loading"
        :error="fetchError && !existingPage ? fetchError : null"
        min-height="400px"
        @retry="loadAboutData"
      >
        <div class="editor-grid">
          <div class="card editor-card">
            <div class="card-head">
              <div class="card-head__title">
                <span class="material-symbols-outlined card-icon">tune</span>
                <h2 class="card-title">{{ locale === 'ar' ? 'إعدادات المحتوى والبيانات' : 'Content Controls' }}</h2>
              </div>
              <div class="status-toggle-wrap">
                <label class="switch-label mono text-xs">
                  <input v-model="form.isActive" type="checkbox" class="toggle-checkbox" />
                  <span class="toggle-track"></span>
                  <span class="toggle-text">{{ form.isActive ? t('admin.active') : t('admin.inactive') }}</span>
                </label>
              </div>
            </div>

            <form class="editor-form" @submit.prevent="handleSave">
              <div class="form-group">
                <label class="field-label" for="about-title">
                  {{ locale === 'ar' ? 'عنوان القسم الرئيسي (Hero Title)' : 'Hero Title' }} *
                </label>
                <input
                  id="about-title"
                  v-model="form.heroTitle"
                  type="text"
                  class="field-input"
                  required
                  :placeholder="defaultFallbacks.heroTitle"
                />
                <span class="field-hint mono text-xs">
                  {{ locale === 'ar' ? 'يظهر كعنوان بارز في كرت الصفحة الرئيسية وأعلى صفحة من نحن.' : 'Displays as main hero title on the homepage section and the /about page.' }}
                </span>
              </div>

              <div class="form-group">
                <label class="field-label" for="about-body">
                  {{ locale === 'ar' ? 'الملخص التعريفي / الشعار (Tagline / Hero Body)' : 'Hero Body & Subtitle' }}
                </label>
                <textarea
                  id="about-body"
                  v-model="form.heroBody"
                  rows="3"
                  class="field-textarea"
                  :placeholder="defaultFallbacks.heroBody"
                ></textarea>
                <span class="field-hint mono text-xs">
                  {{ locale === 'ar' ? 'وصف موجز للمهمة والتخصص الطبي.' : 'Succinct description of SNUL medical mission and platform expertise.' }}
                </span>
              </div>

              <div class="form-group">
                <div class="flex items-center justify-between">
                  <label class="field-label" for="about-story">
                    {{ locale === 'ar' ? 'القصة الكاملة والتفاصيل (Full Story / Narrative)' : 'Full Story Narrative' }}
                  </label>
                  <span class="mono text-xs text-muted">
                    {{ previewParagraphs.length }} {{ locale === 'ar' ? 'فقرات' : 'paragraphs' }}
                  </span>
                </div>
                <textarea
                  id="about-story"
                  v-model="form.contentBlock"
                  rows="9"
                  class="field-textarea mono text-sm"
                  :placeholder="defaultFallbacks.contentBlock"
                ></textarea>
                <span class="field-hint mono text-xs">
                  {{ locale === 'ar' ? 'افصل بين الفقرات بمسافة سطر فارغة لتنسيقها كفقرات مستقلة.' : 'Separate paragraphs with a blank line for clean structured typography.' }}
                </span>
              </div>

              <div class="editor-actions">
                <BaseButton variant="primary" type="submit" :loading="saving" icon="check">
                  {{ locale === 'ar' ? 'حفظ ومزامنة فورية' : 'Save & Synchronize' }}
                </BaseButton>
                <BaseButton
                  variant="ghost"
                  type="button"
                  @click="
                    form.heroTitle = defaultFallbacks.heroTitle;
                    form.heroBody = defaultFallbacks.heroBody;
                    form.contentBlock = defaultFallbacks.contentBlock;
                  "
                >
                  {{ locale === 'ar' ? 'استعادة الافتراضي' : 'Reset to Default' }}
                </BaseButton>
              </div>
            </form>
          </div>

          <div class="card preview-card">
            <div class="card-head">
              <div class="card-head__title">
                <span class="material-symbols-outlined card-icon">visibility</span>
                <h2 class="card-title">{{ locale === 'ar' ? 'المعاينة الحية للمزامنة' : 'Live Sync Preview' }}</h2>
              </div>
              <div class="preview-tabs mono">
                <button
                  type="button"
                  class="preview-tab"
                  :class="{ 'is-active': previewMode === 'landing' }"
                  @click="previewMode = 'landing'"
                >
                  <span class="material-symbols-outlined text-[15px]">home</span>
                  <span>{{ locale === 'ar' ? 'الصفحة الرئيسية' : 'Homepage' }}</span>
                </button>
                <button
                  type="button"
                  class="preview-tab"
                  :class="{ 'is-active': previewMode === 'about' }"
                  @click="previewMode = 'about'"
                >
                  <span class="material-symbols-outlined text-[15px]">info</span>
                  <span>{{ locale === 'ar' ? 'صفحة من نحن' : 'About Page' }}</span>
                </button>
              </div>
            </div>

            <div v-if="previewMode === 'landing'" class="preview-body preview-landing">
              <div class="preview-frame-label mono text-xs">
                <span>{{ locale === 'ar' ? 'معاينة قسم من نحن في الصفحة الرئيسية' : 'Homepage Section Simulation' }}</span>
                <span class="preview-tag">SYNCED</span>
              </div>

              <div class="landing-mock-section">
                <div class="mock-grid">
                  <div class="mock-copy">
                    <span class="mock-eyebrow mono">{{ t('home.aboutEyebrow') }}</span>
                    <h3 class="mock-title">{{ form.heroTitle || defaultFallbacks.heroTitle }}</h3>
                    <p class="mock-body">{{ form.heroBody || defaultFallbacks.heroBody }}</p>
                    <p v-if="form.contentBlock" class="mock-sub-body">
                      {{ previewParagraphs[0] || '' }}
                    </p>
                    <div class="mock-actions">
                      <span class="mock-btn mock-btn--primary mono">{{ t('nav.catalog') }}</span>
                      <span class="mock-btn mock-btn--outline mono">{{ t('nav.about') }}</span>
                    </div>
                  </div>

                  <div class="mock-media">
                    <div class="mock-media-badge mono">
                      <span class="material-symbols-outlined text-teal-600">verified</span>
                      <span>SNUL CERTIFIED</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="preview-body preview-about">
              <div class="preview-frame-label mono text-xs">
                <span>{{ locale === 'ar' ? 'معاينة الواجهة في صفحة /about' : '/about Page Simulation' }}</span>
                <span class="preview-tag">SYNCED</span>
              </div>

              <div class="about-mock-hero">
                <span class="mock-eyebrow mono">{{ t('home.aboutEyebrow') }}</span>
                <h3 class="mock-title">{{ form.heroTitle || defaultFallbacks.heroTitle }}</h3>
                <p class="mock-body">{{ form.heroBody || defaultFallbacks.heroBody }}</p>

                <div class="mock-badges mono">
                  <span class="mock-chip">ISO 13485</span>
                  <span class="mock-chip">CE MDR</span>
                  <span class="mock-chip">40+ COUNTRIES</span>
                </div>
              </div>

              <div class="about-mock-story">
                <div class="story-divider mono"><span>COMPANY NARRATIVE</span></div>
                <div v-if="previewParagraphs.length" class="mock-paragraphs">
                  <p v-for="(p, i) in previewParagraphs" :key="i" class="mock-p">{{ p }}</p>
                </div>
                <p v-else class="mock-p text-muted italic">
                  {{ locale === 'ar' ? 'أضف فقرات السرد في خانة القصة الكاملة ليتم عرضها هنا.' : 'Add paragraphs to the narrative box to preview story layout here.' }}
                </p>
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
