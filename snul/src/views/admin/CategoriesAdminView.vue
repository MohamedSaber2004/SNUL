<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import FileUpload from '../../components/ui/FileUpload.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { ATTACHMENT_PLACE, MEDIA_TYPE } from '../../config/api.config'
import { services } from '../../di/container'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t, locale } from '../../i18n'
import type {
  CategoryDto,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from '../../domain/models/marketplace'

const localized = (en?: string, ar?: string) => (locale.value === 'ar' ? ar || en || '' : en || ar || '')

const categories = ref<CategoryDto[]>([])
const loading = ref(true)
const fetchError = ref('')
const search = ref('')
const page = ref(1)
const pageSize = 10

const filtered = computed(() => {
  const list = Array.isArray(categories.value) ? categories.value : []
  const q = search.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((c) => {
    if (!c) return false
    return [c.nameEn, c.nameAr, c.id].some((v) => (v ? String(v).toLowerCase().includes(q) : false))
  })
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const paginated = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))

const loadAll = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    categories.value = await services.marketplaceRepository.getCategories()
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

const showModal = ref(false)
const editing = ref<CategoryDto | null>(null)
const formLoading = ref(false)
const formError = ref('')

const emptyForm = () => ({
  nameEn: '',
  nameAr: '',
  description: '',
  imageName: '',
  parentCategoryId: '' as string,
  isActive: true,
})
const form = ref(emptyForm())

const parentOptions = computed(() => {
  const list = Array.isArray(categories.value) ? categories.value : []
  if (!editing.value) return list
  return list.filter((c) => c.id !== editing.value?.id)
})

const openCreate = () => {
  editing.value = null
  form.value = emptyForm()
  formError.value = ''
  showModal.value = true
}
const openEdit = (c: CategoryDto) => {
  editing.value = c
  form.value = {
    nameEn: c.nameEn ?? '',
    nameAr: c.nameAr ?? '',
    description: c.descriptionEn ?? '',
    imageName: c.imageName ?? '',
    parentCategoryId: c.parentCategoryId ?? '',
    isActive: c.isActive ?? true,
  }
  formError.value = ''
  showModal.value = true
}
const closeModal = () => {
  showModal.value = false
  formError.value = ''
}

const submit = async () => {
  const f = form.value
  if (!f.nameEn.trim() || !f.nameAr.trim()) {
    formError.value = t('admin.errBothNames')
    return
  }
  if (editing.value && f.parentCategoryId === editing.value.id) {
    formError.value = t('admin.parentCategory')
    return
  }
  formLoading.value = true
  formError.value = ''
  try {
    if (editing.value) {
      const payload: UpdateCategoryPayload = {
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim(),
        description: f.description.trim() || undefined,
        imageName: f.imageName.trim() || null,
        parentCategoryId: f.parentCategoryId || null,
        isActive: f.isActive,
      }
      await services.marketplaceRepository.updateCategory(editing.value.id, payload)
      toastService.success(t('admin.categoryUpdated'))
    } else {
      const payload: CreateCategoryPayload = {
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim(),
        description: f.description.trim() || undefined,
        imageName: f.imageName.trim() || null,
        parentCategoryId: f.parentCategoryId || null,
      }
      await services.marketplaceRepository.createCategory(payload)
      toastService.success(t('admin.categoryCreated'))
    }
    closeModal()
    await loadAll()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    formLoading.value = false
  }
}

const actionPendingId = ref<string | null>(null)

const toggleActive = async (c: CategoryDto) => {
  const nextActive = !(c.isActive ?? true)
  const ok = await confirmService.confirmAction(
    nextActive ? t('admin.confirmActivate') : t('admin.confirmDeactivate'),
    {
      title: nextActive ? t('admin.activate') : t('admin.deactivate'),
      variant: nextActive ? 'primary' : 'warning',
      icon: nextActive ? 'check_circle' : 'block',
      confirmText: nextActive ? t('admin.activate') : t('admin.deactivate'),
      cancelText: t('common.cancel'),
    },
  )
  if (!ok) return
  actionPendingId.value = c.id
  try {
    await services.marketplaceRepository.updateCategory(c.id, {
      nameEn: c.nameEn,
      nameAr: c.nameAr,
      description: c.descriptionEn || undefined,
      imageName: c.imageName ?? null,
      parentCategoryId: c.parentCategoryId ?? null,
      isActive: nextActive,
    })
    toastService.success(nextActive ? t('admin.activated') : t('admin.deactivated'))
    await loadAll()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    actionPendingId.value = null
  }
}

const confirmDelete = async (c: CategoryDto) => {
  const ok = await confirmService.confirmDelete(
    `${t('admin.deleteCategoryConfirm')}\n${localized(c.nameEn, c.nameAr)}`,
    t('common.delete'),
  )
  if (!ok) return
  actionPendingId.value = c.id
  try {
    await services.marketplaceRepository.deleteCategory(c.id)
    toastService.success(t('admin.categoryDeleted'))
    await loadAll()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    actionPendingId.value = null
  }
}

onMounted(() => { void loadAll() })
</script>

<template>
  <AdminLayout>
    <div class="admin-head">
      <div>
        <h1 class="head-title">{{ t('admin.categoriesTitle') }}</h1>
        <p class="head-subtitle">{{ t('provider.categoriesDesc') }}</p>
      </div>
      <div class="head-actions">
        <BaseButton variant="primary" @click="openCreate">
          <span class="material-symbols-outlined text-[18px]">add</span>
          <span>{{ t('admin.newCategory') }}</span>
        </BaseButton>
      </div>
    </div>

    <div class="search-filter-bar">
      <div class="search-wrap">
        <span class="material-symbols-outlined search-icon">search</span>
        <input
          v-model="search"
          type="text"
          class="search-input"
          :placeholder="t('common.searchPlaceholder')"
          @input="page = 1"
        />
      </div>
    </div>

    <DataState
      :loading="loading"
      :error="fetchError"
      skeleton-type="table"
      :skeleton-count="5"
      :empty="!filtered.length && !loading"
      :empty-title="t('admin.noCategoriesFound')"
      :empty-description="t('common.searchPlaceholder')"
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
                <th class="text-end">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in paginated" :key="c.id">
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
                  <span
                    class="status-dot-badge"
                    :class="(c.isActive ?? true) ? 'status-dot-badge--active' : 'status-dot-badge--inactive'"
                  >
                    <span class="dot"></span>
                    <span>{{ (c.isActive ?? true) ? t('admin.active') : t('admin.inactive') }}</span>
                  </span>
                </td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="row-action-btn" :title="t('common.edit')" :aria-label="t('common.edit')" @click="openEdit(c)">
                      <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      type="button" class="row-action-btn"
                      :class="(c.isActive ?? true) ? 'row-action-btn--deactivate' : 'row-action-btn--activate'"
                      :title="(c.isActive ?? true) ? t('admin.deactivate') : t('admin.activate')"
                      :disabled="actionPendingId === c.id"
                      @click="toggleActive(c)"
                    >
                      <span class="material-symbols-outlined text-[18px]">{{ (c.isActive ?? true) ? 'block' : 'check_circle' }}</span>
                    </button>
                    <button
                      type="button" class="row-action-btn row-action-btn--danger"
                      :title="t('common.delete')" :aria-label="t('common.delete')"
                      :disabled="actionPendingId === c.id" @click="confirmDelete(c)"
                    >
                      <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <AppPagination v-model:page="page" :total-pages="totalPages" :total-items="filtered.length" :page-size="pageSize" variant="table" />
      </div>
    </DataState>

    <BaseModal
      v-model="showModal"
      :title="editing ? t('admin.editCategory') : t('admin.newCategory')"
      max-width="640px"
      @close="closeModal"
    >
      <form class="admin-modal-form" @submit.prevent="submit">
        <div class="form-row two-cols">
          <div class="form-field">
            <label class="field-label" for="ac-name-en">{{ t('admin.categoryNameEn') }} *</label>
            <input id="ac-name-en" v-model="form.nameEn" type="text" class="field-input" required />
          </div>
          <div class="form-field">
            <label class="field-label" for="ac-name-ar">{{ t('admin.categoryNameAr') }} *</label>
            <input id="ac-name-ar" v-model="form.nameAr" type="text" class="field-input" required />
          </div>
        </div>
        <div class="form-field">
          <label class="field-label" for="ac-desc">{{ t('admin.description') }}</label>
          <textarea id="ac-desc" v-model="form.description" class="field-textarea" rows="3"></textarea>
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
          <label class="field-label" for="ac-parent">{{ t('admin.parentCategory') }}</label>
          <select id="ac-parent" v-model="form.parentCategoryId" class="field-select">
            <option value="">{{ t('admin.noParentCategory') }}</option>
            <option v-for="c in parentOptions" :key="c.id" :value="c.id">
              {{ localized(c.nameEn, c.nameAr) }}
            </option>
          </select>
        </div>
        <div v-if="editing" class="form-field">
          <label class="toggle-label">
            <input v-model="form.isActive" type="checkbox" />
            <span>{{ t('admin.categoryActive') }}</span>
          </label>
        </div>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-foot">
          <BaseButton variant="secondary" type="button" @click="closeModal">{{ t('common.cancel') }}</BaseButton>
          <BaseButton variant="primary" type="submit" :loading="formLoading">{{ t('common.save') }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </AdminLayout>
</template>

<style scoped>
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
</style>
