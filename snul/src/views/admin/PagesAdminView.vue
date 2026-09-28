<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import { services } from '../../di/container'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t, locale } from '../../i18n'
import type {
  LandingPageDto,
  CreateLandingPagePayload,
  UpdateLandingPagePayload,
} from '../../domain/models/content'

const ABOUT_US_SLUG = 'about-us'

const pages = ref<LandingPageDto[]>([])
const loading = ref(true)
const fetchError = ref('')
const search = ref('')
const typeFilter = ref<string>('all')
const page = ref(1)
const pageSize = 10

const filtered = computed(() => {
  const list = Array.isArray(pages.value) ? pages.value : []
  let out = list
  if (typeFilter.value !== 'all') {
    out = out.filter((p) => p && String(p.type || '').toLowerCase() === typeFilter.value.toLowerCase())
  }
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    out = out.filter((p) => {
      if (!p) return false
      const matchTitle = p.heroTitle ? String(p.heroTitle).toLowerCase().includes(q) : false
      const matchSlug = p.slug ? String(p.slug).toLowerCase().includes(q) : false
      const matchBody = p.heroBody ? String(p.heroBody).toLowerCase().includes(q) : false
      return matchTitle || matchSlug || matchBody
    })
  }
  return out
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const paginated = computed(() => {
  const start = (page.value - 1) * pageSize
  return filtered.value.slice(start, start + pageSize)
})

const hasAboutUs = computed(() => pages.value.some((p) => p && p.slug?.toLowerCase() === ABOUT_US_SLUG))

const load = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    const res = await services.contentRepository.getLandingPages({ pageNumber: 1, pageSize: 50 })
    const all = Array.isArray(res?.data) ? [...res.data] : []
    const total = res?.totalPages ?? 1
    if (total > 1) {
      const rest = await Promise.all(
        Array.from({ length: total - 1 }, (_, i) =>
          services.contentRepository
            .getLandingPages({ pageNumber: i + 2, pageSize: 50 })
            .catch(() => null),
        ),
      )
      for (const r of rest) {
        if (r && Array.isArray(r.data)) all.push(...r.data)
      }
    }
    pages.value = all
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

watch([search, typeFilter], () => {
  page.value = 1
})

// --- Add / Edit ---
const showFormModal = ref(false)
const editingPage = ref<LandingPageDto | null>(null)
const formLoading = ref(false)
const formError = ref('')

const emptyForm = () => ({
  type: 'Brand',
  slug: '',
  heroTitle: '',
  heroBody: '',
  contentBlock: '',
  isActive: true,
})

const form = ref(emptyForm())

const slugify = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

const openCreate = (presetSlug = '') => {
  editingPage.value = null
  form.value = { ...emptyForm(), slug: presetSlug }
  formError.value = ''
  showFormModal.value = true
}

const openEdit = (p: LandingPageDto) => {
  editingPage.value = p
  form.value = {
    type: p.type || 'Brand',
    slug: p.slug || '',
    heroTitle: p.heroTitle || '',
    heroBody: p.heroBody || '',
    contentBlock: p.contentBlock || '',
    isActive: p.isActive ?? true,
  }
  formError.value = ''
  showFormModal.value = true
}

const closeForm = () => {
  showFormModal.value = false
  formError.value = ''
}

const submit = async () => {
  const f = form.value
  if (!f.slug.trim()) {
    formError.value = t('admin.errPageSlug')
    return
  }
  if (!f.heroTitle.trim()) {
    formError.value = t('admin.errPageTitle')
    return
  }
  formLoading.value = true
  formError.value = ''
  try {
    if (editingPage.value) {
      const payload: UpdateLandingPagePayload = {
        type: f.type,
        slug: slugify(f.slug),
        heroTitle: f.heroTitle.trim(),
        heroBody: f.heroBody.trim() || undefined,
        contentBlock: f.contentBlock.trim() || null,
        isActive: f.isActive,
      }
      await services.contentRepository.updateLandingPage(editingPage.value.id, payload)
      toastService.success(t('admin.pageUpdated'))
    } else {
      const payload: CreateLandingPagePayload = {
        type: f.type,
        slug: slugify(f.slug),
        heroTitle: f.heroTitle.trim(),
        heroBody: f.heroBody.trim() || undefined,
        contentBlock: f.contentBlock.trim() || null,
      }
      await services.contentRepository.createLandingPage(payload)
      toastService.success(t('admin.pageCreated'))
    }
    closeForm()
    await load()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    formLoading.value = false
  }
}

// --- Delete / Activate ---
const deletePendingId = ref<string | null>(null)

const toggleActive = async (p: LandingPageDto) => {
  const nextActive = !(p.isActive ?? true)
  const isAboutUs = p.slug === 'about-us'
  const message = nextActive
    ? t('admin.confirmActivate')
    : isAboutUs
      ? `${t('admin.confirmDeactivate')}\n\n⚠️ Note: "${p.slug}" powers the public About page (/about) and home section. Deactivating will cause them to show default fallback content.`
      : t('admin.confirmDeactivate')
  const ok = await confirmService.confirmAction(
    message,
    {
      title: nextActive ? t('admin.activate') : t('admin.deactivate'),
      variant: nextActive ? 'primary' : 'warning',
      icon: nextActive ? 'check_circle' : 'block',
      confirmText: nextActive ? t('admin.activate') : t('admin.deactivate'),
      cancelText: t('common.cancel'),
    },
  )
  if (!ok) return
  deletePendingId.value = p.id
  try {
    await services.contentRepository.updateLandingPage(p.id, {
      type: p.type,
      slug: p.slug,
      heroTitle: p.heroTitle,
      heroBody: p.heroBody || undefined,
      contentBlock: p.contentBlock ?? null,
      isActive: nextActive,
    })
    toastService.success(nextActive ? t('admin.activated') : t('admin.deactivated'))
    await load()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    deletePendingId.value = null
  }
}

const confirmDeletePage = async (p: LandingPageDto) => {
  const isAboutUs = p.slug === 'about-us'
  const warning = isAboutUs
    ? `\n\n⚠️ Note: Deleting "${p.slug}" removes dynamic content from the public About page (/about) and home section (will revert to default fallback content).`
    : ''
  const ok = await confirmService.confirmDelete(
    `${t('admin.deletePageConfirm')}\n${p.heroTitle} (/${p.slug})${warning}`,
    t('common.delete'),
  )
  if (!ok) return
  deletePendingId.value = p.id
  try {
    await services.contentRepository.deleteLandingPage(p.id)
    toastService.success(t('admin.pageDeleted'))
    await load()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    deletePendingId.value = null
  }
}

// --- Details ---
const showDetailsModal = ref(false)
const selectedPage = ref<LandingPageDto | null>(null)

const openDetails = (p: LandingPageDto) => {
  selectedPage.value = p
  showDetailsModal.value = true
}

const closeDetails = () => {
  showDetailsModal.value = false
  selectedPage.value = null
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <div class="pages-view">
      <header class="pages-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.contentEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('admin.pages') }}</h1>
          <p class="head-subtitle">{{ t('admin.pagesDesc') }}</p>
        </div>
        <BaseButton variant="primary" @click="openCreate()">
          <span class="material-symbols-outlined text-[18px]">add</span>
          <span>{{ t('admin.newPage') }}</span>
        </BaseButton>
      </header>

      <div v-if="!loading && !hasAboutUs" class="about-hint">
        <span class="material-symbols-outlined text-[20px]">info</span>
        <p>{{ t('admin.aboutUsMissing') }}</p>
        <BaseButton variant="secondary" size="sm" @click="openCreate(ABOUT_US_SLUG)">
          {{ t('admin.createAboutUs') }}
        </BaseButton>
      </div>

      <div class="toolbar-card">
        <div class="search-input-wrap">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            v-model="search"
            :placeholder="t('common.searchPlaceholder')"
            :aria-label="t('common.searchPlaceholder')"
            class="toolbar-search-input"
          />
        </div>
        <select v-model="typeFilter" class="toolbar-select mono" :aria-label="t('admin.pageType')">
          <option value="all">{{ t('common.all') }}</option>
          <option value="Brand">{{ locale === 'ar' ? 'علامة تجارية (Brand)' : 'Brand' }}</option>
          <option value="About">{{ locale === 'ar' ? 'من نحن (About)' : 'About' }}</option>
          <option value="Specialty">{{ locale === 'ar' ? 'تخصص سريري (Specialty)' : 'Specialty' }}</option>
          <option value="Procedure">{{ locale === 'ar' ? 'إجراء جراحي (Procedure)' : 'Procedure' }}</option>
        </select>
        <span class="mono counter-text">{{ filtered.length }} {{ t('common.of') }} {{ pages.length }}</span>
      </div>

      <DataState
        :loading="loading && !pages.length"
        :error="fetchError && !pages.length ? fetchError : null"
        :empty="!filtered.length && !loading && !fetchError"
        :empty-title="t('admin.noPagesFound')"
        :empty-description="t('admin.noPagesDesc')"
        skeleton-type="table"
        :skeleton-count="5"
        min-height="280px"
        @retry="load"
      >
        <div class="table-card">
          <div class="table-wrap">
            <table class="exec-table">
              <thead>
                <tr>
                  <th>{{ t('admin.pageTitle') }}</th>
                  <th class="mono">{{ t('admin.pageSlug') }}</th>
                  <th>{{ t('admin.pageType') }}</th>
                  <th>{{ t('commerce.status') }}</th>
                  <th class="text-end">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in paginated" :key="p.id" class="exec-row">
                  <td>
                    <div class="page-cell">
                      <div class="page-icon-box">
                        <span class="material-symbols-outlined text-[20px]">web</span>
                      </div>
                      <div>
                        <strong class="page-title">{{ p.heroTitle }}</strong>
                        <div v-if="p.heroBody" class="page-sub">{{ p.heroBody.slice(0, 80) }}{{ p.heroBody.length > 80 ? '…' : '' }}</div>
                      </div>
                    </div>
                  </td>
                  <td><span class="mono slug-tag">/{{ p.slug }}</span></td>
                  <td><span class="mono type-tag">{{ p.type }}</span></td>
                  <td>
                    <StatusPill :status="(p.isActive ?? true) ? 'Active' : 'Inactive'" :label="(p.isActive ?? true) ? t('admin.active') : t('admin.inactive')" />
                  </td>
                  <td class="text-end">
                    <div class="row-actions">
                      <button
                        type="button"
                        class="row-action-btn"
                        :title="t('admin.viewDetails')"
                        :aria-label="t('admin.viewDetails')"
                        @click="openDetails(p)"
                      >
                        <span class="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn"
                        :title="t('common.edit')"
                        :aria-label="t('common.edit')"
                        @click="openEdit(p)"
                      >
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn"
                        :class="(p.isActive ?? true) ? 'row-action-btn--deactivate' : 'row-action-btn--activate'"
                        :title="(p.isActive ?? true) ? t('admin.deactivate') : t('admin.activate')"
                        :aria-label="(p.isActive ?? true) ? t('admin.deactivate') : t('admin.activate')"
                        :disabled="deletePendingId === p.id"
                        @click="toggleActive(p)"
                      >
                        <span class="material-symbols-outlined text-[18px]">{{
                          (p.isActive ?? true) ? 'block' : 'check_circle'
                        }}</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn row-action-btn--danger"
                        :title="t('common.delete')"
                        :aria-label="t('common.delete')"
                        :disabled="deletePendingId === p.id"
                        @click="confirmDeletePage(p)"
                      >
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <AppPagination
            v-model:page="page"
            :total-pages="totalPages"
            :total-items="filtered.length"
            :page-size="pageSize"
            variant="table"
          />
        </div>
      </DataState>

      <!-- Add / Edit Modal -->
      <BaseModal
        v-model="showFormModal"
        :title="editingPage ? t('admin.editPage') : t('admin.newPage')"
        max-width="640px"
        @close="closeForm"
      >
        <form class="modal-form" @submit.prevent="submit">
          <div class="form-grid two-cols">
            <div class="form-field">
              <label class="field-label" for="page-type">{{ t('admin.pageType') }} *</label>
              <select id="page-type" v-model="form.type" class="field-input">
                <option value="Brand">Brand</option>
                <option value="About">About</option>
                <option value="Specialty">Specialty</option>
                <option value="Procedure">Procedure</option>
              </select>
            </div>
            <div class="form-field">
              <label class="field-label" for="page-slug">{{ t('admin.pageSlug') }} *</label>
              <input id="page-slug" v-model="form.slug" type="text" class="field-input mono" required placeholder="about-us" />
            </div>
          </div>

          <div class="form-field">
            <label class="field-label" for="page-title">{{ t('admin.pageTitle') }} *</label>
            <input id="page-title" v-model="form.heroTitle" type="text" class="field-input" required />
          </div>

          <div class="form-field">
            <label class="field-label" for="page-body">{{ t('admin.heroBody') }}</label>
            <textarea id="page-body" v-model="form.heroBody" class="field-textarea" rows="3"></textarea>
          </div>

          <div class="form-field">
            <label class="field-label" for="page-content">{{ t('admin.contentBlock') }}</label>
            <textarea id="page-content" v-model="form.contentBlock" class="field-textarea mono" rows="6"></textarea>
          </div>

          <div v-if="editingPage" class="form-field">
            <label class="toggle-label">
              <input v-model="form.isActive" type="checkbox" />
              <span>{{ t('admin.pageActive') }}</span>
            </label>
          </div>

          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

          <div class="modal-foot">
            <BaseButton variant="secondary" type="button" @click="closeForm">
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton variant="primary" type="submit" :loading="formLoading">
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </form>
      </BaseModal>

      <!-- Details Modal -->
      <BaseModal
        v-model="showDetailsModal"
        :title="t('admin.pageDetails')"
        max-width="600px"
        @close="closeDetails"
      >
        <div v-if="selectedPage" class="details-stack">
          <div class="details-hero">
            <strong class="details-title">{{ selectedPage.heroTitle }}</strong>
            <div class="details-badges">
              <span class="mono slug-tag">/{{ selectedPage.slug }}</span>
              <span class="mono type-tag">{{ selectedPage.type }}</span>
              <StatusPill :status="(selectedPage.isActive ?? true) ? 'Active' : 'Inactive'" :label="(selectedPage.isActive ?? true) ? t('admin.active') : t('admin.inactive')" />
            </div>
          </div>
          <div v-if="selectedPage.heroBody" class="details-block">
            <span class="detail-k mono">{{ t('admin.heroBody') }}</span>
            <p>{{ selectedPage.heroBody }}</p>
          </div>
          <div v-if="selectedPage.contentBlock" class="details-block">
            <span class="detail-k mono">{{ t('admin.contentBlock') }}</span>
            <p class="details-content">{{ selectedPage.contentBlock }}</p>
          </div>
          <div class="modal-foot">
            <BaseButton variant="secondary" @click="selectedPage && openEdit(selectedPage)">
              {{ t('common.edit') }}
            </BaseButton>
            <BaseButton variant="secondary" @click="closeDetails">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>
    </div>
  </AdminLayout>
</template>

<style scoped>
.pages-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.pages-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  letter-spacing: 0.06em;
  margin-bottom: 0.5rem;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-primary);
}

.head-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: 1.68rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.1;
}

.head-subtitle {
  font-size: 13.5px;
  color: var(--wl-muted);
  margin: 0.25rem 0 0;
}

.about-hint {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  background: var(--wl-warning-soft);
  border: 1px solid rgba(254, 231, 92, 0.35);
  color: var(--wl-warning);
  border-radius: 12px;
  padding: 0.85rem 1.1rem;
  font-size: 0.86rem;
}

.about-hint p {
  margin: 0;
  flex: 1;
  min-width: 200px;
}

.toolbar-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  padding: 0.85rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  box-shadow: var(--shadow-xs);
}

.search-input-wrap {
  position: relative;
  width: 320px;
  max-width: 100%;
}

.search-icon {
  position: absolute;
  inset-inline-start: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: var(--wl-muted-soft);
  pointer-events: none;
}

.toolbar-search-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  padding-inline-start: 38px;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 13.5px;
  color: var(--wl-ink-strong);
  outline: none;
}

.toolbar-search-input:focus {
  border-color: var(--wl-primary);
  box-shadow: 0 0 0 3px rgba(105, 169, 255, 0.12);
}

.toolbar-select {
  height: 44px;
  padding: 0 12px;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 12.5px;
  color: var(--wl-ink-strong);
  cursor: pointer;
}

.counter-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--wl-muted);
  margin-inline-start: auto;
}

.table-card {
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-card, 8px);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.table-wrap {
  overflow-x: auto;
}

.exec-table {
  width: 100%;
  border-collapse: collapse;
  text-align: start;
}

.exec-table thead th {
  background: var(--surface-subtle, #F7F9FB);
  border-bottom: 1px solid var(--border, #D9E2EC);
  padding: 0.85rem 1.25rem;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--fg-muted, #627D98);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.exec-row {
  border-bottom: 1px solid var(--border, #D9E2EC);
}

.exec-row:hover {
  background: var(--surface-subtle, #F7F9FB);
}

.exec-row td {
  padding: 0.65rem 1.25rem;
  vertical-align: middle;
}

.page-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-icon-box {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm, 4px);
  background: var(--brand-soft, #EDF4FF);
  color: var(--primary, #0F3D56);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.page-title {
  font-size: 13.5px;
  color: var(--fg-heading, #102A43);
}

.page-sub {
  font-size: 11.5px;
  color: var(--fg-muted, #627D98);
  max-width: 380px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slug-tag {
  font-size: 11.5px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--secondary, #147D92);
  background: var(--brand-soft, #EDF4FF);
  border: 1px solid var(--border, #D9E2EC);
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-xs, 3px);
  white-space: nowrap;
}

.type-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--fg-muted, #627D98);
  background: var(--surface-subtle, #F7F9FB);
  border: 1px solid var(--border, #D9E2EC);
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-xs, 3px);
}

.text-end {
  text-align: end;
}

.row-actions {
  display: flex;
  gap: 0.4rem;
  justify-content: flex-end;
}

.row-action-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  color: var(--wl-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.row-action-btn:hover {
  color: var(--wl-primary);
  border-color: var(--wl-primary);
}

.row-action-btn--danger:hover {
  color: var(--wl-danger);
  border-color: var(--wl-danger);
}

.row-action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-grid {
  display: grid;
  gap: 1rem;
}

.form-grid.two-cols {
  grid-template-columns: 1fr 1fr;
}

@media (max-width: 560px) {
  .form-grid.two-cols {
    grid-template-columns: 1fr;
  }
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--wl-ink-strong);
}

.field-input,
.field-textarea {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--wl-line);
  border-radius: 8px;
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: 0.88rem;
  font-family: var(--wl-font-body);
}

.field-input:focus,
.field-textarea:focus {
  outline: none;
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--wl-ink-strong);
  cursor: pointer;
}

.form-error {
  background: var(--wl-danger-soft);
  border: 1px solid var(--wl-border);
  color: var(--wl-danger);
  font-size: 0.82rem;
  padding: 0.6rem 0.85rem;
  border-radius: 8px;
  margin: 0;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--wl-line);
}

.details-stack {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.details-hero {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.details-title {
  font-size: 1.1rem;
  color: var(--wl-ink-strong);
}

.details-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.details-block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.detail-k {
  font-size: 10px;
  color: var(--wl-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.details-block p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--wl-ink-strong);
  line-height: 1.65;
  white-space: pre-wrap;
}

.details-content {
  font-size: 0.84rem !important;
}
</style>

