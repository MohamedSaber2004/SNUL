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
import { t, locale } from '../../i18n'
import type { CityDto, CountryDto } from '../../domain/models/location'

const cities = ref<CityDto[]>([])
const countries = ref<CountryDto[]>([])
const loading = ref(true)
const search = ref('')
const filterCountry = ref('')
const fetchError = ref('')

const filtered = computed(() => {
  let l = Array.isArray(cities.value) ? cities.value : []
  if (filterCountry.value) l = l.filter((c) => c && c.countryId === filterCountry.value)
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    l = l.filter((c) => {
      if (!c) return false
      const matchEn = c.nameEn ? String(c.nameEn).toLowerCase().includes(q) : false
      const matchAr = c.nameAr ? String(c.nameAr).toLowerCase().includes(q) : false
      const matchId = c.id ? String(c.id).toLowerCase().includes(q) : false
      return matchEn || matchAr || matchId
    })
  }
  return l
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

const localized = (en: string, ar: string) => (locale.value === 'ar' ? ar : en)

const load = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    const [cList, coList] = await Promise.all([
      locationRepository.getCities(),
      locationRepository.getCountries(),
    ])
    cities.value = cList
    countries.value = coList
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

onMounted(load)

const getCountryName = (countryId: string) => {
  const co = countries.value.find((c) => c.id === countryId)
  if (!co) return '—'
  return localized(co.nameEn, co.nameAr)
}

// --- Add / Edit / Delete / Details ---
const showFormModal = ref(false)
const editingCity = ref<CityDto | null>(null)
const formLoading = ref(false)
const formError = ref('')
const actionPendingId = ref<string | null>(null)

const form = ref({ nameEn: '', nameAr: '', countryId: '' })

const openCreate = () => {
  editingCity.value = null
  form.value = { nameEn: '', nameAr: '', countryId: filterCountry.value || '' }
  formError.value = ''
  showFormModal.value = true
}

const openEdit = (c: CityDto) => {
  editingCity.value = c
  form.value = { nameEn: c.nameEn ?? '', nameAr: c.nameAr ?? '', countryId: c.countryId ?? '' }
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
  if (!f.countryId) {
    formError.value = t('admin.errCountry')
    return
  }
  formLoading.value = true
  formError.value = ''
  try {
    if (editingCity.value) {
      await locationRepository.updateCity(editingCity.value.id, {
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim(),
        countryId: f.countryId,
      })
      toastService.success(t('admin.cityUpdated'))
    } else {
      await locationRepository.createCity({
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim(),
        countryId: f.countryId,
      })
      toastService.success(t('admin.cityCreated'))
    }
    closeForm()
    await load()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    formLoading.value = false
  }
}

const toggleActive = async (c: CityDto) => {
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
    await locationRepository.updateCity(c.id, { isActive: nextActive })
    toastService.success(nextActive ? t('admin.activated') : t('admin.deactivated'))
    await load()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    actionPendingId.value = null
  }
}

const confirmDelete = async (c: CityDto) => {
  const ok = await confirmService.confirmDelete(
    `${t('admin.deleteCityConfirm')}\n${c.nameEn}`,
    t('common.delete'),
  )
  if (!ok) return
  actionPendingId.value = c.id
  try {
    await locationRepository.deleteCity(c.id)
    toastService.success(t('admin.cityDeleted'))
    await load()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    actionPendingId.value = null
  }
}

const showDetailsModal = ref(false)
const selectedCity = ref<CityDto | null>(null)

const openDetails = (c: CityDto) => {
  selectedCity.value = c
  showDetailsModal.value = true
}

const closeDetails = () => {
  showDetailsModal.value = false
  selectedCity.value = null
}
</script>

<template>
  <AdminLayout>
    <div class="cities-view">
      <!-- Executive Header -->
      <header class="cities-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.citiesEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('admin.cities') }}</h1>
          <p class="head-subtitle">{{ t('admin.citiesDesc') }}</p>
        </div>
        <BaseButton variant="primary" @click="openCreate">
          <span class="material-symbols-outlined text-[18px]">add</span>
          <span>{{ t('admin.newCity') }}</span>
        </BaseButton>
      </header>

      <!-- 44px Search & Filter Toolbar -->
      <div class="toolbar-card">
        <div class="search-and-filter">
          <div class="search-input-wrap">
            <span class="material-symbols-outlined search-icon">search</span>
            <input
              v-model="search"
              :placeholder="t('admin.searchPlaceholder')"
              :aria-label="t('common.searchPlaceholder')"
              class="toolbar-search-input"
            />
          </div>

          <div class="filter-wrap">
            <select v-model="filterCountry" class="toolbar-select">
              <option value="">{{ t('common.all') }} {{ t('admin.countries') }}</option>
              <option v-for="co in countries" :key="co.id" :value="co.id">
                {{ localized(co.nameEn, co.nameAr) }}
              </option>
            </select>
          </div>
        </div>

        <span class="mono counter-text">{{ filtered.length }} {{ t('common.of') }} {{ cities.length }} {{ t('admin.cities') }}</span>
      </div>

      <!-- Executive Data Table -->
      <DataState
        :loading="loading && !cities.length"
        :error="fetchError && !cities.length ? fetchError : null"
        :empty="!filtered.length && !loading && !fetchError"
        :empty-title="t('locations.noCities')"
        :empty-description="t('admin.emptyCitiesDesc')"
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
                  <th>{{ t('distributor.country') }}</th>
                  <th>{{ t('commerce.status') }}</th>
                  <th class="text-end">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in paginated" :key="c.id" class="exec-row">
                  <td>
                    <div class="city-cell">
                      <span class="material-symbols-outlined city-icon">apartment</span>
                      <strong class="city-name">{{ c.nameEn }}</strong>
                    </div>
                  </td>
                  <td class="arabic-name">{{ c.nameAr }}</td>
                  <td>
                    <span class="country-pill mono">{{ getCountryName(c.countryId) }}</span>
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

      <!-- Add / Edit Modal -->
      <BaseModal
        v-model="showFormModal"
        :title="editingCity ? t('admin.editCity') : t('admin.newCity')"
        max-width="560px"
        @close="closeForm"
      >
        <form class="admin-modal-form" @submit.prevent="submitForm">
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="city-name-en">{{ t('admin.nameEn') }} *</label>
              <input id="city-name-en" v-model="form.nameEn" type="text" class="field-input" required />
            </div>
            <div class="form-field">
              <label class="field-label" for="city-name-ar">{{ t('admin.nameAr') }} *</label>
              <input id="city-name-ar" v-model="form.nameAr" type="text" class="field-input" required />
            </div>
          </div>
          <div class="form-field">
            <label class="field-label" for="city-country">{{ t('distributor.country') }} *</label>
            <select id="city-country" v-model="form.countryId" class="field-select" required>
              <option value="" disabled>{{ t('distributor.country') }}</option>
              <option v-for="co in countries" :key="co.id" :value="co.id">
                {{ localized(co.nameEn, co.nameAr) }}
              </option>
            </select>
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
        :title="t('admin.cityDetails')"
        max-width="520px"
        @close="closeDetails"
      >
        <div v-if="selectedCity" class="admin-details">
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k mono">EN</span>
              <strong class="detail-v">{{ selectedCity.nameEn }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">AR</span>
              <strong class="detail-v">{{ selectedCity.nameAr }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('distributor.country') }}</span>
              <strong class="detail-v">{{ getCountryName(selectedCity.countryId) }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('commerce.status') }}</span>
              <strong class="detail-v">{{ (selectedCity.isActive ?? true) ? t('admin.active') : t('admin.inactive') }}</strong>
            </div>
          </div>
          <div class="modal-foot">
            <BaseButton variant="secondary" @click="selectedCity && openEdit(selectedCity)">
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
.cities-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.cities-head {
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

.search-and-filter {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  flex: 1;
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

.toolbar-select {
  height: 44px;
  padding: 0 14px;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--wl-radius-sm);
  font-size: 13px;
  font-weight: 600;
  color: var(--wl-ink-soft);
  outline: none;
  cursor: pointer;
  box-shadow: var(--wl-shadow-card);
}

.toolbar-select:focus {
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

.city-cell {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.city-icon {
  font-size: 20px;
  color: var(--wl-primary);
}

.city-name {
  font-size: 13.5px;
  color: var(--wl-ink-strong);
}

.arabic-name {
  font-size: 14px;
  color: var(--wl-ink-strong);
}

.country-pill {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}
</style>
