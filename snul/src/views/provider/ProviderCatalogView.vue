<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ProviderLayout from '../../components/layout/ProviderLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import FileUpload from '../../components/ui/FileUpload.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { ATTACHMENT_PLACE, MEDIA_TYPE } from '../../config/api.config'
import { services, companyService } from '../../di/container'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t, locale } from '../../i18n'
import type {
  ProductDto,
  CategoryDto,
  CurrencyDto,
  CreateProductPayload,
  UpdateProductPayload,
} from '../../domain/models/marketplace'

const localized = (en?: string, ar?: string) => (locale.value === 'ar' ? ar || en || '' : en || ar || '')
const myCompanyId = computed(() => companyService.myCompany.value?.id ?? null)

const products = ref<ProductDto[]>([])
const categories = ref<CategoryDto[]>([])
const currencies = ref<CurrencyDto[]>([])
const loading = ref(true)
const fetchError = ref('')
const search = ref('')
const categoryFilter = ref('all')
const page = ref(1)
const pageSize = 10

const filtered = computed(() => {
  const list = Array.isArray(products.value) ? products.value : []
  const q = search.value.trim().toLowerCase()
  return list.filter((p) => {
    if (!p) return false
    if (categoryFilter.value !== 'all' && p.categoryId !== categoryFilter.value) return false
    if (!q) return true
    return [p.nameEn, p.nameAr, p.sku, p.id]
      .some((v) => (v ? String(v).toLowerCase().includes(q) : false))
  })
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const paginated = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))

const loadAll = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    await companyService.loadMyCompany().catch(() => null)
    const cid = companyService.myCompany.value?.id ?? null
    const [mine, cats, currs] = await Promise.all([
      cid
        ? services.marketplaceRepository.getMyProducts(cid, { page: 1, pageSize: 50 })
        : Promise.resolve({ data: [] as ProductDto[] }),
      services.marketplaceRepository.getCategories().catch(() => [] as CategoryDto[]),
      services.marketplaceRepository.getCurrencies().catch(() => [] as CurrencyDto[]),
    ])
    products.value = Array.isArray(mine.data) ? mine.data : []
    categories.value = Array.isArray(cats) ? cats : []
    currencies.value = Array.isArray(currs) ? currs : []
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

/* ── Product form ── */
const showModal = ref(false)
const editing = ref<ProductDto | null>(null)
const formLoading = ref(false)
const formError = ref('')
const slugTouched = ref(false)

const emptyForm = () => ({
  nameEn: '',
  nameAr: '',
  sku: '',
  slug: '',
  description: '',
  price: 0,
  stock: 0,
  specifications: '',
  imageName: '',
  material: '',
  currencyId: '' as string,
  categoryId: '' as string,
  isActive: true,
})
const form = ref(emptyForm())

const slugify = (v: string): string =>
  v.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

const onNameEnInput = () => {
  if (!slugTouched.value) form.value.slug = slugify(form.value.nameEn)
}

const openCreate = () => {
  editing.value = null
  form.value = emptyForm()
  formError.value = ''
  slugTouched.value = false
  showModal.value = true
}
const openEdit = (p: ProductDto) => {
  editing.value = p
  form.value = {
    nameEn: p.nameEn ?? '',
    nameAr: p.nameAr ?? '',
    sku: p.sku ?? '',
    slug: p.slug ?? '',
    description: p.descriptionEn || p.description || '',
    price: p.price ?? 0,
    stock: p.stock ?? 0,
    specifications: p.specifications ?? '',
    imageName: p.imageName ?? '',
    material: p.material ?? '',
    currencyId: p.currencyId ?? '',
    categoryId: p.categoryId ?? '',
    isActive: p.isActive ?? true,
  }
  formError.value = ''
  slugTouched.value = true
  showModal.value = true
}
const closeModal = () => {
  showModal.value = false
  formError.value = ''
}

const submit = async () => {
  const f = form.value
  if (!f.nameEn.trim() || !f.nameAr.trim()) { formError.value = t('admin.errBothNames'); return }
  if (!f.sku.trim()) { formError.value = t('admin.errSku'); return }
  if (!f.slug.trim()) { formError.value = t('admin.slug'); return }
  if (!f.categoryId) { formError.value = t('admin.errCategory'); return }
  formLoading.value = true
  formError.value = ''
  try {
    if (editing.value) {
      const payload: UpdateProductPayload = {
        nameEn: f.nameEn.trim(), nameAr: f.nameAr.trim(),
        sku: f.sku.trim(), slug: f.slug.trim().toLowerCase(),
        description: f.description.trim() || undefined,
        price: Number(f.price), stock: Number(f.stock),
        specifications: f.specifications.trim() || undefined,
        imageName: f.imageName.trim() || null,
        material: f.material.trim() || undefined,
        currencyId: f.currencyId || null,
        categoryId: f.categoryId,
        isActive: f.isActive,
      }
      await services.marketplaceRepository.updateProduct(editing.value.id, payload)
      toastService.success(t('admin.productUpdated'))
    } else {
      const payload: CreateProductPayload = {
        nameEn: f.nameEn.trim(), nameAr: f.nameAr.trim(),
        sku: f.sku.trim(), slug: f.slug.trim().toLowerCase(),
        description: f.description.trim() || undefined,
        price: Number(f.price), stock: Number(f.stock),
        specifications: f.specifications.trim() || undefined,
        imageName: f.imageName.trim() || null,
        material: f.material.trim() || undefined,
        currencyId: f.currencyId || null,
        categoryId: f.categoryId,
      }
      await services.marketplaceRepository.createProduct(payload)
      toastService.success(t('admin.productCreated'))
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
const confirmDelete = async (p: ProductDto) => {
  const ok = await confirmService.confirmDelete(
    `${t('admin.deleteProductConfirm')}\n${localized(p.nameEn, p.nameAr)}`,
    t('common.delete'),
  )
  if (!ok) return
  actionPendingId.value = p.id
  try {
    await services.marketplaceRepository.deleteProduct(p.id)
    toastService.success(t('admin.productDeleted'))
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
  <ProviderLayout>
    <header class="view-header">
      <div>
        <span class="mono eyebrow">{{ t('provider.dashboard') }} · {{ t('provider.myCatalog') }}</span>
        <h1 class="view-title">{{ t('provider.myCatalog') }}</h1>
        <p class="view-desc">{{ t('provider.myCatalogDesc') }}</p>
      </div>
      <div class="header-actions">
        <BaseButton v-if="myCompanyId" variant="primary" @click="openCreate">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          <span>{{ t('provider.newProduct') }}</span>
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
          <input v-model="search" type="text" class="search-input" :placeholder="t('common.searchPlaceholder')" @input="page = 1" />
        </div>
        <select v-model="categoryFilter" class="filter-select" @change="page = 1">
          <option value="all">{{ t('marketplace.allCategories') }}</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ localized(c.nameEn, c.nameAr) }}</option>
        </select>
      </div>

      <DataState
        :loading="loading"
        :error="fetchError"
        skeleton-type="table"
        :skeleton-count="5"
        :empty="!filtered.length && !loading"
        :empty-title="t('provider.noProducts')"
        :empty-description="t('provider.noProductsDesc')"
        @retry="loadAll"
      >
        <div class="table-card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ t('admin.productsTitle') }}</th>
                  <th>{{ t('admin.sku') }}</th>
                  <th class="num">{{ t('admin.price') }}</th>
                  <th class="num">{{ t('admin.stock') }}</th>
                  <th>{{ t('admin.status') }}</th>
                  <th class="text-end">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in paginated" :key="p.id">
                  <td>
                    <div class="cell-media">
                      <AppImage :src="p.imageName" placeholder-type="product" :alt="p.nameEn" width="36" height="36" />
                      <strong class="table__name">{{ localized(p.nameEn, p.nameAr) }}</strong>
                    </div>
                  </td>
                  <td><span class="mono">{{ p.sku }}</span></td>
                  <td class="num mono-num">{{ p.price }}</td>
                  <td class="num mono-num">{{ p.stock }}</td>
                  <td>
                    <span class="status-dot-badge" :class="(p.isActive ?? true) ? 'status-dot-badge--active' : 'status-dot-badge--inactive'">
                      <span class="dot"></span>
                      <span>{{ (p.isActive ?? true) ? t('admin.active') : t('admin.inactive') }}</span>
                    </span>
                  </td>
                  <td>
                    <div class="row-actions">
                      <button type="button" class="row-action-btn" :title="t('common.edit')" :aria-label="t('common.edit')" @click="openEdit(p)">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        type="button" class="row-action-btn row-action-btn--danger"
                        :title="t('common.delete')" :aria-label="t('common.delete')"
                        :disabled="actionPendingId === p.id" @click="confirmDelete(p)"
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
    </template>

    <BaseModal
      v-model="showModal"
      :title="editing ? t('provider.editProduct') : t('provider.newProduct')"
      max-width="720px"
      @close="closeModal"
    >
      <form class="admin-modal-form" @submit.prevent="submit">
        <div class="form-row two-cols">
          <div class="form-field">
            <label class="field-label" for="pp-name-en">{{ t('admin.productNameEn') }} *</label>
            <input
              id="pp-name-en" v-model="form.nameEn" type="text" class="field-input" required
              @input="onNameEnInput"
            />
          </div>
          <div class="form-field">
            <label class="field-label" for="pp-name-ar">{{ t('admin.productNameAr') }} *</label>
            <input id="pp-name-ar" v-model="form.nameAr" type="text" class="field-input" required />
          </div>
        </div>
        <div class="form-row two-cols">
          <div class="form-field">
            <label class="field-label" for="pp-sku">{{ t('admin.sku') }} *</label>
            <input id="pp-sku" v-model="form.sku" type="text" class="field-input mono" required @input="slugTouched = true" />
          </div>
          <div class="form-field">
            <label class="field-label" for="pp-slug">{{ t('admin.slug') }} *</label>
            <input id="pp-slug" v-model="form.slug" type="text" class="field-input mono" required @input="slugTouched = true" />
          </div>
        </div>
        <div class="form-row two-cols">
          <div class="form-field">
            <label class="field-label" for="pp-price">{{ t('admin.price') }} *</label>
            <input id="pp-price" v-model.number="form.price" type="number" min="0" step="0.01" class="field-input mono-num" required />
          </div>
          <div class="form-field">
            <label class="field-label" for="pp-stock">{{ t('admin.stock') }} *</label>
            <input id="pp-stock" v-model.number="form.stock" type="number" min="0" step="1" class="field-input mono-num" required />
          </div>
        </div>
        <div class="form-row two-cols">
          <div class="form-field">
            <label class="field-label" for="pp-category">{{ t('admin.category') }} *</label>
            <select id="pp-category" v-model="form.categoryId" class="field-select" required>
              <option value="">{{ t('marketplace.choose') ?? '' }}</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ localized(c.nameEn, c.nameAr) }}</option>
            </select>
          </div>
          <div class="form-field">
            <label class="field-label" for="pp-currency">{{ t('admin.currency') }}</label>
            <select id="pp-currency" v-model="form.currencyId" class="field-select">
              <option value="">{{ t('marketplace.choose') ?? '' }}</option>
              <option v-for="c in currencies" :key="c.id" :value="c.id">{{ c.code }}</option>
            </select>
          </div>
        </div>
        <div class="form-field">
          <label class="field-label" for="pp-desc">{{ t('admin.description') }}</label>
          <textarea id="pp-desc" v-model="form.description" class="field-textarea" rows="3"></textarea>
        </div>
        <div class="form-field">
          <FileUpload
            :model-value="form.imageName || null"
            :place="ATTACHMENT_PLACE.PROVIDERS"
            :file-type="MEDIA_TYPE.IMAGE"
            accept="image/*"
            :label="t('admin.productImage')"
            :hint="t('attachment.dropHint')"
            @update:modelValue="form.imageName = $event ?? ''"
          />
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
