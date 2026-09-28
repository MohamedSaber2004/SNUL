<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ProviderLayout from '../../components/layout/ProviderLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import FileUpload from '../../components/ui/FileUpload.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { ATTACHMENT_PLACE, MEDIA_TYPE } from '../../config/api.config'
import { services, companyService } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t, locale } from '../../i18n'
import type { CategoryDto, CreateCategoryPayload } from '../../domain/models/marketplace'

const localized = (en?: string, ar?: string) => (locale.value === 'ar' ? ar || en || '' : en || ar || '')
const myCompanyId = computed(() => companyService.myCompany.value?.id ?? null)

const categories = ref<CategoryDto[]>([])
const loading = ref(true)
const fetchError = ref('')
const search = ref('')

const filtered = computed(() => {
  const list = Array.isArray(categories.value) ? categories.value : []
  const q = search.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((c) => {
    if (!c) return false
    return [c.nameEn, c.nameAr, c.id].some((v) => (v ? String(v).toLowerCase().includes(q) : false))
  })
})

const loadAll = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    await companyService.loadMyCompany().catch(() => null)
    categories.value = await services.marketplaceRepository.getCategories()
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

/* ── Add-if-missing ── */
const showModal = ref(false)
const formLoading = ref(false)
const formError = ref('')
const existsHint = ref(false)

const emptyForm = () => ({
  nameEn: '',
  nameAr: '',
  description: '',
  imageName: '',
  parentCategoryId: '' as string,
})
const form = ref(emptyForm())

const openCreate = () => {
  form.value = emptyForm()
  formError.value = ''
  existsHint.value = false
  showModal.value = true
}
const closeModal = () => {
  showModal.value = false
  formError.value = ''
  existsHint.value = false
}

const duplicateOf = (nameEn: string, nameAr: string): CategoryDto | null => {
  const en = nameEn.trim().toLowerCase()
  const ar = nameAr.trim().toLowerCase()
  if (!en && !ar) return null
  return (
    categories.value.find((c) => {
      if (!c) return false
      const cen = (c.nameEn || '').trim().toLowerCase()
      const car = (c.nameAr || '').trim().toLowerCase()
      return (en && (cen === en || car === en)) || (ar && (cen === ar || car === ar))
    }) ?? null
  )
}

const submit = async () => {
  const f = form.value
  if (!f.nameEn.trim() || !f.nameAr.trim()) {
    formError.value = t('admin.errBothNames')
    return
  }
  if (duplicateOf(f.nameEn, f.nameAr)) {
    existsHint.value = true
    return
  }
  existsHint.value = false
  formLoading.value = true
  formError.value = ''
  try {
    const payload: CreateCategoryPayload = {
      nameEn: f.nameEn.trim(),
      nameAr: f.nameAr.trim(),
      description: f.description.trim() || undefined,
      imageName: f.imageName.trim() || null,
      parentCategoryId: f.parentCategoryId || null,
    }
    await services.marketplaceRepository.createCategory(payload)
    toastService.success(t('admin.categoryCreated'))
    closeModal()
    await loadAll()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    formLoading.value = false
  }
}

onMounted(() => { void loadAll() })
</script>

<template>
  <ProviderLayout>
    <header class="view-header">
      <div>
        <span class="mono eyebrow">{{ t('provider.dashboard') }} · {{ t('provider.categories') }}</span>
        <h1 class="view-title">{{ t('provider.categories') }}</h1>
        <p class="view-desc">{{ t('provider.categoriesDesc') }}</p>
      </div>
      <div class="header-actions">
        <BaseButton v-if="myCompanyId" variant="primary" @click="openCreate">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          <span>{{ t('provider.newCategory') }}</span>
        </BaseButton>
      </div>
    </header>


    <div v-if="!myCompanyId && !loading" class="card card--pad">
      <h3>{{ t('provider.noCompanyTitle') }}</h3>
      <p class="muted">{{ t('provider.noCompanyDesc') }}</p>
      <router-link to="/profile" class="btn btn--secondary btn--sm" style="margin-top: var(--space-3); align-self: flex-start;">
        {{ t('provider.linkCompany') }}
      </router-link>
    </div>

    <template v-else>
      <div class="search-filter-bar">
        <div class="search-wrap">
          <span class="material-symbols-outlined search-icon">search</span>
          <input v-model="search" type="text" class="search-input" :placeholder="t('common.searchPlaceholder')" />
        </div>
      </div>

      <DataState
        :loading="loading"
        :error="fetchError"
        skeleton-type="table"
        :skeleton-count="5"
        :empty="!filtered.length && !loading"
        :empty-title="t('provider.noCategories')"
        :empty-description="t('provider.noCategoriesDesc')"
        @retry="loadAll"
      >
        <div class="table-card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ t('admin.category') }}</th>
                  <th>{{ t('admin.categoryNameEn') }}</th>
                  <th>{{ t('admin.categoryNameAr') }}</th>
                  <th class="num">{{ t('admin.productsTitle') }}</th>
                  <th>{{ t('admin.status') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in filtered" :key="c.id">
                  <td>
                    <div class="cell-media">
                      <AppImage :src="c.imageName" placeholder-type="category" :alt="c.nameEn" width="36" height="36" />
                      <strong class="table__name">{{ localized(c.nameEn, c.nameAr) }}</strong>
                    </div>
                  </td>
                  <td><span class="mono">{{ c.nameEn }}</span></td>
                  <td><span>{{ c.nameAr }}</span></td>
                  <td class="num mono-num">{{ c.productCount ?? 0 }}</td>
                  <td>
                    <span class="status-dot-badge" :class="(c.isActive ?? true) ? 'status-dot-badge--active' : 'status-dot-badge--inactive'">
                      <span class="dot"></span>
                      <span>{{ (c.isActive ?? true) ? t('admin.active') : t('admin.inactive') }}</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </DataState>
    </template>

    <BaseModal
      v-model="showModal"
      :title="t('provider.newCategory')"
      max-width="640px"
      @close="closeModal"
    >
      <form class="admin-modal-form" @submit.prevent="submit">
        <div class="form-row two-cols">
          <div class="form-field">
            <label class="field-label" for="pc-name-en">{{ t('admin.categoryNameEn') }} *</label>
            <input id="pc-name-en" v-model="form.nameEn" type="text" class="field-input" required />
          </div>
          <div class="form-field">
            <label class="field-label" for="pc-name-ar">{{ t('admin.categoryNameAr') }} *</label>
            <input id="pc-name-ar" v-model="form.nameAr" type="text" class="field-input" required />
          </div>
        </div>
        <div class="form-field">
          <label class="field-label" for="pc-desc">{{ t('admin.description') }}</label>
          <textarea id="pc-desc" v-model="form.description" class="field-textarea" rows="3"></textarea>
        </div>
        <div class="form-field">
          <FileUpload
            :model-value="form.imageName || null"
            :place="ATTACHMENT_PLACE.PROVIDERS"
            :file-type="MEDIA_TYPE.IMAGE"
            accept="image/*"
            :label="t('admin.categoryImage')"
            :hint="t('attachment.dropHint')"
            @update:modelValue="form.imageName = $event ?? ''"
          />
        </div>
        <div class="form-field">
          <label class="field-label" for="pc-parent">{{ t('admin.parentCategory') }}</label>
          <select id="pc-parent" v-model="form.parentCategoryId" class="field-select">
            <option value="">{{ t('admin.noParentCategory') }}</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">
              {{ localized(c.nameEn, c.nameAr) }}
            </option>
          </select>
        </div>
        <p v-if="existsHint" class="form-error" role="alert">{{ t('provider.categoryExistsHint') }}</p>
        <p v-else-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-foot">
          <BaseButton variant="secondary" type="button" @click="closeModal">{{ t('common.cancel') }}</BaseButton>
          <BaseButton variant="primary" type="submit" :loading="formLoading">{{ t('common.save') }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </ProviderLayout>
</template>

<style scoped>
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.header-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.eyebrow {
  font-size: var(--step--1);
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.05em;
  display: block;
}

.view-title {
  font-family: var(--wl-font-display);
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--wl-ink-strong);
  margin: var(--space-1) 0;
}

.view-desc {
  font-size: var(--step-0);
  color: var(--wl-muted);
  max-width: 600px;
  margin: 0;
}

.search-filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}
.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 220px;
  min-width: min(100%, 200px);
}
.search-icon {
  position: absolute;
  inset-inline-start: var(--space-3);
  font-size: 18px;
  color: var(--fg-placeholder);
  pointer-events: none;
}
.search-input { padding-inline-start: var(--space-10); }
.muted { color: var(--fg-muted); }

.search-input:focus,
.filter-select:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
  outline: none;
}

@media (max-width: 768px) {
  .view-header {
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none;
  }
}
</style>
