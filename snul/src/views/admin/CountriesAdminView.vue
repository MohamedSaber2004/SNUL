<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import { locationRepository } from '../../di/container'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t } from '../../i18n'
import type { CountryDto } from '../../domain/models/location'

const countries = ref<CountryDto[]>([])
const loading = ref(true)
const search = ref('')
const fetchError = ref('')

const filtered = computed(() => {
  const rawList = Array.isArray(countries.value) ? countries.value : []
  if (!search.value.trim()) return rawList
  const q = search.value.trim().toLowerCase()
  return rawList.filter((c) => {
    if (!c) return false
    const matchEn = c.nameEn ? String(c.nameEn).toLowerCase().includes(q) : false
    const matchAr = c.nameAr ? String(c.nameAr).toLowerCase().includes(q) : false
    const matchCode = c.code ? String(c.code).toLowerCase().includes(q) : false
    const matchPhone = c.phoneCode ? String(c.phoneCode).toLowerCase().includes(q) : false
    const matchId = c.id ? String(c.id).toLowerCase().includes(q) : false
    return matchEn || matchAr || matchCode || matchPhone || matchId
  })
})

const page = ref(1)
const pageSize = 10
const paginated = computed(() => {
  const start = (page.value - 1) * pageSize
  return filtered.value.slice(start, start + pageSize)
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
watch(filtered, () => {
  page.value = 1
})

const load = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    countries.value = await locationRepository.getCountries()
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

onMounted(load)

const showFormModal = ref(false)
const editingCountry = ref<CountryDto | null>(null)
const formLoading = ref(false)
const formError = ref('')
const actionPendingId = ref<string | null>(null)

const form = ref({ nameEn: '', nameAr: '', code: '', phoneCode: '' })

const openCreate = () => {
  editingCountry.value = null
  form.value = { nameEn: '', nameAr: '', code: '', phoneCode: '' }
  formError.value = ''
  showFormModal.value = true
}

const openEdit = (c: CountryDto) => {
  editingCountry.value = c
  form.value = {
    nameEn: c.nameEn ?? '',
    nameAr: c.nameAr ?? '',
    code: c.code ?? '',
    phoneCode: c.phoneCode ?? '',
  }
  formError.value = ''
  showFormModal.value = true
}

const closeForm = () => {
  showFormModal.value = false
  formError.value = ''
}

const submitForm = async () => {
  const f = form.value
  if (!f.nameEn.trim() || !f.nameAr.trim()) {
    formError.value = t('admin.errBothNames')
    return
  }
  formLoading.value = true
  formError.value = ''
  try {
    if (editingCountry.value) {
      await locationRepository.updateCountry(editingCountry.value.id, {
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim(),
        code: f.code.trim() || undefined,
        phoneCode: f.phoneCode.trim() || undefined,
      })
      toastService.success(t('admin.countryUpdated'))
    } else {
      await locationRepository.createCountry({
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim(),
        code: f.code.trim() || undefined,
        phoneCode: f.phoneCode.trim() || undefined,
      })
      toastService.success(t('admin.countryCreated'))
    }
    closeForm()
    await load()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    formLoading.value = false
  }
}

const toggleActive = async (c: CountryDto) => {
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
    await locationRepository.updateCountry(c.id, { isActive: nextActive })
    toastService.success(nextActive ? t('admin.activated') : t('admin.deactivated'))
    await load()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    actionPendingId.value = null
  }
}

const confirmDelete = async (c: CountryDto) => {
  const ok = await confirmService.confirmDelete(
    `${t('admin.deleteCountryConfirm')}\n${c.nameEn} (${c.code || '—'})`,
    t('common.delete'),
  )
  if (!ok) return
  actionPendingId.value = c.id
  try {
    await locationRepository.deleteCountry(c.id)
    toastService.success(t('admin.countryDeleted'))
    await load()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    actionPendingId.value = null
  }
}

const showDetailsModal = ref(false)
const selectedCountry = ref<CountryDto | null>(null)

const openDetails = (c: CountryDto) => {
  selectedCountry.value = c
  showDetailsModal.value = true
}

const closeDetails = () => {
  showDetailsModal.value = false
  selectedCountry.value = null
}
</script>

<template>
  <AdminLayout>
    <div class="countries-view">
      <header class="countries-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.countriesEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('admin.countries') }}</h1>
          <p class="head-subtitle">{{ t('admin.countriesDesc') }}</p>
        </div>
        <BaseButton variant="primary" @click="openCreate">
          <span class="material-symbols-outlined text-[18px]">add</span>
          <span>{{ t('admin.newCountry') }}</span>
        </BaseButton>
      </header>

      <div class="toolbar-card">
        <div class="search-input-wrap">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            v-model="search"
            :placeholder="t('admin.searchPlaceholder')"
            :aria-label="t('common.searchPlaceholder')"
            class="toolbar-search-input"
          />
        </div>
        <span class="mono counter-text">{{ filtered.length }} {{ t('common.of') }} {{ countries.length }} {{ t('admin.countries') }}</span>
      </div>

      <DataState
        :loading="loading && !countries.length"
        :error="fetchError && !countries.length ? fetchError : null"
        :empty="!filtered.length && !loading && !fetchError"
        :empty-title="t('locations.noCountries')"
        :empty-description="t('admin.emptyCountriesDesc')"
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
                  <th><span class="mono">EN</span> {{ t('admin.nameEn') }}</th>
                  <th><span class="mono">AR</span> {{ t('admin.nameAr') }}</th>
                  <th class="mono">{{ t('admin.code') }}</th>
                  <th class="mono">{{ t('locations.phoneCode') }}</th>
                  <th>{{ t('commerce.status') }}</th>
                  <th class="text-end">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in paginated" :key="c.id" class="exec-row">
                  <td>
                    <div class="country-cell">
                      <span class="material-symbols-outlined country-icon">public</span>
                      <strong class="country-name">{{ c.nameEn }}</strong>
                    </div>
                  </td>
                  <td class="arabic-name">{{ c.nameAr }}</td>
                  <td>
                    <span v-if="c.code" class="mono code-pill">{{ c.code }}</span>
                    <span v-else class="mono text-slate-400">—</span>
                  </td>
                  <td>
                    <span v-if="c.phoneCode" class="mono phone-pill">{{ c.phoneCode }}</span>
                    <span v-else class="mono text-slate-400">—</span>
                  </td>
                  <td>
                    <span
                      class="status-dot-badge mono"
                      :class="(c.isActive ?? true) ? 'status-dot-badge--active' : 'status-dot-badge--inactive'"
                    >
                      <span class="dot"></span>
                      <span>{{ (c.isActive ?? true) ? t('admin.active') : t('admin.inactive') }}</span>
                    </span>
                  </td>
                  <td>
                    <div class="row-actions">
                      <button
                        type="button"
                        class="row-action-btn"
                        :title="t('admin.viewDetails')"
                        :aria-label="t('admin.viewDetails')"
                        @click="openDetails(c)"
                      >
                        <span class="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn"
                        :title="t('common.edit')"
                        :aria-label="t('common.edit')"
                        @click="openEdit(c)"
                      >
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn"
                        :class="(c.isActive ?? true) ? 'row-action-btn--deactivate' : 'row-action-btn--activate'"
                        :title="(c.isActive ?? true) ? t('admin.deactivate') : t('admin.activate')"
                        :aria-label="(c.isActive ?? true) ? t('admin.deactivate') : t('admin.activate')"
                        :disabled="actionPendingId === c.id"
                        @click="toggleActive(c)"
                      >
                        <span class="material-symbols-outlined text-[18px]">{{
                          (c.isActive ?? true) ? 'block' : 'check_circle'
                        }}</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn row-action-btn--danger"
                        :title="t('common.delete')"
                        :aria-label="t('common.delete')"
                        :disabled="actionPendingId === c.id"
                        @click="confirmDelete(c)"
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

      <BaseModal
        v-model="showFormModal"
        :title="editingCountry ? t('admin.editCountry') : t('admin.newCountry')"
        max-width="560px"
        @close="closeForm"
      >
        <form class="admin-modal-form" @submit.prevent="submitForm">
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="country-name-en">{{ t('admin.nameEn') }} *</label>
              <input id="country-name-en" v-model="form.nameEn" type="text" class="field-input" required />
            </div>
            <div class="form-field">
              <label class="field-label" for="country-name-ar">{{ t('admin.nameAr') }} *</label>
              <input id="country-name-ar" v-model="form.nameAr" type="text" class="field-input" required />
            </div>
          </div>
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="country-code">{{ t('admin.code') }}</label>
              <input id="country-code" v-model="form.code" type="text" class="field-input mono" maxlength="10" />
            </div>
            <div class="form-field">
              <label class="field-label" for="country-phone">{{ t('locations.phoneCode') }}</label>
              <input id="country-phone" v-model="form.phoneCode" type="text" class="field-input mono" />
            </div>
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

      <BaseModal
        v-model="showDetailsModal"
        :title="t('admin.countryDetails')"
        max-width="520px"
        @close="closeDetails"
      >
        <div v-if="selectedCountry" class="admin-details">
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k mono">EN</span>
              <strong class="detail-v">{{ selectedCountry.nameEn }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">AR</span>
              <strong class="detail-v">{{ selectedCountry.nameAr }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.code') }}</span>
              <strong class="detail-v mono">{{ selectedCountry.code || '—' }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('locations.phoneCode') }}</span>
              <strong class="detail-v mono">{{ selectedCountry.phoneCode || '—' }}</strong>
            </div>
          </div>
          <div class="modal-foot">
            <BaseButton variant="secondary" @click="selectedCountry && openEdit(selectedCountry)">
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
.countries-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.countries-head {
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

/* Toolbar */
.toolbar-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
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
  color: var(--wl-muted);
  pointer-events: none;
}

.toolbar-search-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  padding-inline-start: 38px;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--wl-radius-sm);
  font-size: 13.5px;
  color: var(--wl-ink-strong);
  outline: none;
  box-shadow: var(--wl-shadow-card);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.toolbar-search-input:focus {
  border-color: var(--wl-primary);
  box-shadow: 0 0 0 3px var(--wl-primary-ring);
}

.counter-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--wl-muted);
}

/* Executive Table */
.table-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--wl-radius-card, 16px);
  overflow: hidden;
  box-shadow: var(--wl-shadow-card);
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
  background: var(--wl-surface-soft);
  border-bottom: 1px solid var(--wl-border);
  padding: 0.85rem 1.25rem;
  font-family: var(--wl-font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.exec-row {
  height: 52px;
  border-bottom: 1px solid var(--wl-border);
  transition: background 0.15s ease;
}

.exec-row:hover {
  background: var(--wl-surface-soft);
}

.exec-row td {
  padding: 0.65rem 1.25rem;
  vertical-align: middle;
}

.country-cell {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.country-icon {
  font-size: 20px;
  color: var(--wl-primary);
}

.country-name {
  font-size: 13.5px;
  color: var(--wl-ink-strong);
}

.arabic-name {
  font-size: 14px;
  color: var(--wl-ink-strong);
}

.code-pill {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}

.phone-pill {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  background: var(--wl-surface-soft);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--wl-border);
}
</style>
