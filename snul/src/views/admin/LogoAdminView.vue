<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import DataState from '../../components/ui/DataState.vue'
import FileUpload from '../../components/ui/FileUpload.vue'
import { services } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t, locale } from '../../i18n'
import { ATTACHMENT_PLACE, MEDIA_TYPE } from '../../config/api.config'
import { resolveFileUrl } from '../../utils/file-url'
import type { SiteLogoDto } from '../../domain/models/content'

const loading = ref(true)
const fetchError = ref('')
const saving = ref(false)

const currentLogo = ref<SiteLogoDto | null>(null)
const logoForm = ref({
  logoUrl: '',
  altText: 'SNUL',
})

onMounted(() => {
  void loadLogo()
})

const loadLogo = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    const data = await services.contentService.loadSiteLogo()
    currentLogo.value = data
    logoForm.value = {
      logoUrl: data.logoUrl || '',
      altText: data.altText || 'SNUL',
    }
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

const onLogoUploaded = (storedName: string | null) => {
  if (storedName) {
    const resolved = resolveFileUrl(storedName)
    logoForm.value.logoUrl = resolved || storedName
  } else {
    logoForm.value.logoUrl = ''
  }
}

const handleSave = async () => {
  saving.value = true
  try {
    const updated = await services.contentService.upsertSiteLogo({
      logoUrl: logoForm.value.logoUrl.trim(),
      altText: logoForm.value.altText.trim() || 'SNUL',
    })
    currentLogo.value = updated
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('snul:content-changed'))
    }
    toastService.success(t('admin.siteLogoSaveSuccess'))
  } catch (e) {
    const raw = e instanceof Error ? e.message : ''
    if (raw === 'SiteLogo.Updated' || raw === 'Updated') {
      toastService.success(t('admin.siteLogoSaveSuccess'))
    } else {
      toastService.error(raw || t('common.error'))
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AdminLayout>
    <div class="logo-admin-view">
      <!-- Executive Header -->
      <header class="logo-admin-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>LOGO MANAGEMENT</span>
          </div>
          <h1 class="head-title">{{ t('admin.siteLogoManagement') }}</h1>
          <p class="head-subtitle">{{ t('admin.siteLogoDesc') }}</p>
        </div>
        <div class="head-actions">
          <BaseButton variant="primary" :loading="saving" icon="save" @click="handleSave">
            {{ t('common.save') }}
          </BaseButton>
        </div>
      </header>

      <DataState
        :loading="loading"
        :error="fetchError && !currentLogo ? fetchError : null"
        min-height="400px"
        @retry="loadLogo"
      >
        <div class="editor-container">
          <div class="card editor-card">
            <div class="card-head">
              <div class="card-head__title">
                <span class="material-symbols-outlined card-icon">image</span>
                <h2 class="card-title">{{ t('admin.siteLogoUpload') }}</h2>
              </div>
              <span v-if="!logoForm.logoUrl" class="no-logo-chip mono">
                {{ locale === 'ar' ? 'لم يتم تعيين صورة بعد' : 'No image set yet' }}
              </span>
              <span v-else class="logo-active-chip mono">
                {{ locale === 'ar' ? 'تم تعيين الشعار' : 'Logo Active' }}
              </span>
            </div>

            <form class="editor-form" novalidate @submit.prevent="handleSave">
              <!-- Empty state indicator banner -->
              <div v-if="!logoForm.logoUrl" class="no-logo-banner">
                <span class="material-symbols-outlined banner-icon">info</span>
                <span class="banner-text mono text-xs">
                  {{ locale === 'ar' ? 'لم يتم تعيين صورة بعد. يمكنك رفع صورة الشعار أدناه.' : 'No image set yet. You can upload a site logo below.' }}
                </span>
              </div>

              <!-- File upload -->
              <div class="form-group">
                <FileUpload
                  :model-value="logoForm.logoUrl || null"
                  :place="ATTACHMENT_PLACE.DEFAULT"
                  :file-type="MEDIA_TYPE.IMAGE"
                  accept="image/*"
                  :label="t('admin.siteLogoImage')"
                  :hint="t('admin.siteLogoHint')"
                  @update:modelValue="onLogoUploaded"
                />
              </div>

              <!-- Alt text -->
              <div class="form-group">
                <label class="field-label" for="logo-alt">
                  {{ t('admin.siteLogoAlt') }}
                </label>
                <input
                  id="logo-alt"
                  v-model="logoForm.altText"
                  type="text"
                  class="field-input"
                  placeholder="SNUL"
                />
                <span class="field-hint mono text-xs">
                  {{ t('admin.siteLogoAltHint') }}
                </span>
              </div>

              <div class="editor-actions">
                <BaseButton variant="primary" type="submit" :loading="saving" icon="check">
                  {{ t('admin.siteLogoSave') }}
                </BaseButton>
              </div>
            </form>
          </div>
        </div>
      </DataState>
    </div>
  </AdminLayout>
</template>

<style scoped>
.logo-admin-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 1000px;
  margin: 0 auto;
}

.logo-admin-head {
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

.editor-container {
  width: 100%;
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

.no-logo-chip {
  padding: 0.2rem 0.6rem;
  background: var(--slate-100, #f1f5f9);
  color: var(--slate-600, #475569);
  border: 1px solid var(--slate-200, #e2e8f0);
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.logo-active-chip {
  padding: 0.2rem 0.6rem;
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.no-logo-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--slate-50, #f8fafc);
  border: 1px dashed var(--slate-300, #cbd5e1);
  border-radius: var(--radius-md, 8px);
  color: var(--slate-600, #475569);
}

.banner-icon {
  font-size: 1.25rem;
  color: var(--slate-400, #94a3b8);
}

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

.field-input {
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

.field-input:focus {
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
</style>
