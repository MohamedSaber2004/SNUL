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
import type { ZoneDto, CityDto } from '../../domain/models/location'

const zones = ref<ZoneDto[]>([])
const cities = ref<CityDto[]>([])
const loading = ref(true)
const search = ref('')
const filterCity = ref('')
const fetchError = ref('')

const filtered = computed(() => {
  let l = Array.isArray(zones.value) ? zones.value : []
  if (filterCity.value) l = l.filter((z) => z && z.cityId === filterCity.value)
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    l = l.filter((z) => {
      if (!z) return false
      const matchEn = z.nameEn ? String(z.nameEn).toLowerCase().includes(q) : false
      const matchAr = z.nameAr ? String(z.nameAr).toLowerCase().includes(q) : false
      const matchId = z.id ? String(z.id).toLowerCase().includes(q) : false
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
    const [zList, cList] = await Promise.all([
      locationRepository.getZones(),
      locationRepository.getCities(),
    ])
    zones.value = zList
    cities.value = cList
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

onMounted(load)

const getCityName = (cityId: string) => {
  const ci = cities.value.find((c) => c.id === cityId)
  if (!ci) return '—'
  return localized(ci.nameEn, ci.nameAr)
}

// --- Add / Edit / Delete / Details ---
const showFormModal = ref(false)
const editingZone = ref<ZoneDto | null>(null)
const formLoading = ref(false)
const formError = ref('')
const actionPendingId = ref<string | null>(null)

const form = ref({ nameEn: '', nameAr: '', cityId: '' })

const openCreate = () => {
  editingZone.value = null
  form.value = { nameEn: '', nameAr: '', cityId: filterCity.value || '' }
  formError.value = ''
  showFormModal.value = true
}

const openEdit = (z: ZoneDto) => {
  editingZone.value = z
  form.value = { nameEn: z.nameEn ?? '', nameAr: z.nameAr ?? '', cityId: z.cityId ?? '' }
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
  if (!f.cityId) {
    formError.value = t('admin.errCity')
    return
  }
  formLoading.value = true
  formError.value = ''
  try {
    if (editingZone.value) {
      await locationRepository.updateZone(editingZone.value.id, {
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim(),
        cityId: f.cityId,
      })
      toastService.success(t('admin.zoneUpdated'))
    } else {
      await locationRepository.createZone({
        nameEn: f.nameEn.trim(),
        nameAr: f.nameAr.trim(),
        cityId: f.cityId,
      })
      toastService.success(t('admin.zoneCreated'))
    }
    closeForm()
    await load()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    formLoading.value = false
  }
}

const toggleActive = async (z: ZoneDto) => {
  const nextActive = !(z.isActive ?? true)
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
  actionPendingId.value = z.id
  try {
    await locationRepository.updateZone(z.id, { isActive: nextActive })
    toastService.success(nextActive ? t('admin.activated') : t('admin.deactivated'))
    await load()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    actionPendingId.value = null
  }
}

const confirmDelete = async (z: ZoneDto) => {
  const ok = await confirmService.confirmDelete(
    `${t('admin.deleteZoneConfirm')}\n${z.nameEn}`,
    t('common.delete'),
  )
  if (!ok) return
  actionPendingId.value = z.id
  try {
    await locationRepository.deleteZone(z.id)
    toastService.success(t('admin.zoneDeleted'))
    await load()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    actionPendingId.value = null
  }
}

const showDetailsModal = ref(false)
const selectedZone = ref<ZoneDto | null>(null)

const openDetails = (z: ZoneDto) => {
  selectedZone.value = z
  showDetailsModal.value = true
}

const closeDetails = () => {
  showDetailsModal.value = false
  selectedZone.value = null
}
</script>

<template>
  <AdminLayout>
    <div class="zones-view">
      <!-- Executive Header -->
      <header class="zones-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.zonesEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('admin.zones') }}</h1>
          <p class="head-subtitle">{{ t('admin.zonesDesc') }}</p>
        </div>
        <BaseButton variant="primary" @click="openCreate">
          <span class="material-symbols-outlined text-[18px]">add</span>
          <span>{{ t('admin.newZone') }}</span>
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
            <select v-model="filterCity" class="toolbar-select">
              <option value="">{{ t('common.all') }} {{ t('admin.cities') }}</option>
              <option v-for="c in cities" :key="c.id" :value="c.id">
                {{ localized(c.nameEn, c.nameAr) }}
              </option>
            </select>
          </div>
        </div>

        <span class="mono counter-text">{{ filtered.length }} {{ t('common.of') }} {{ zones.length }} {{ t('admin.zones') }}</span>
      </div>

      <!-- Executive Data Table -->
      <DataState
        :loading="loading && !zones.length"
        :error="fetchError && !zones.length ? fetchError : null"
        :empty="!filtered.length && !loading && !fetchError"
        :empty-title="t('locations.noZones')"
        :empty-description="t('admin.emptyZonesDesc')"
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
                  <th>{{ t('admin.city') }}</th>
                  <th>{{ t('commerce.status') }}</th>
                  <th class="text-end">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="z in paginated" :key="z.id" class="exec-row">
                  <td>
                    <div class="zone-cell">
                      <span class="material-symbols-outlined zone-icon">map</span>
                      <strong class="zone-name">{{ z.nameEn }}</strong>
                    </div>
                  </td>
                  <td class="arabic-name">{{ z.nameAr }}</td>
                  <td>
                    <span class="city-pill mono">{{ getCityName(z.cityId) }}</span>
                  </td>
                  <td>
                    <span
                      class="status-dot-badge mono"
                      :class="(z.isActive ?? true) ? 'status-dot-badge--active' : 'status-dot-badge--inactive'"
                    >
                      <span class="dot"></span>
                      <span>{{ (z.isActive ?? true) ? t('admin.active') : t('admin.inactive') }}</span>
                    </span>
                  </td>
                  <td>
                    <div class="row-actions">
                      <button
                        type="button"
                        class="row-action-btn"
                        :title="t('admin.viewDetails')"
                        :aria-label="t('admin.viewDetails')"
                        @click="openDetails(z)"
                      >
                        <span class="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn"
                        :title="t('common.edit')"
                        :aria-label="t('common.edit')"
                        @click="openEdit(z)"
                      >
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn"
                        :class="(z.isActive ?? true) ? 'row-action-btn--deactivate' : 'row-action-btn--activate'"
                        :title="(z.isActive ?? true) ? t('admin.deactivate') : t('admin.activate')"
                        :aria-label="(z.isActive ?? true) ? t('admin.deactivate') : t('admin.activate')"
                        :disabled="actionPendingId === z.id"
                        @click="toggleActive(z)"
                      >
                        <span class="material-symbols-outlined text-[18px]">{{
                          (z.isActive ?? true) ? 'block' : 'check_circle'
                        }}</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn row-action-btn--danger"
                        :title="t('common.delete')"
                        :aria-label="t('common.delete')"
                        :disabled="actionPendingId === z.id"
                        @click="confirmDelete(z)"
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
        :title="editingZone ? t('admin.editZone') : t('admin.newZone')"
        max-width="560px"
        @close="closeForm"
      >
        <form class="admin-modal-form" @submit.prevent="submitForm">
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="zone-name-en">{{ t('admin.nameEn') }} *</label>
              <input id="zone-name-en" v-model="form.nameEn" type="text" class="field-input" required />
            </div>
            <div class="form-field">
              <label class="field-label" for="zone-name-ar">{{ t('admin.nameAr') }} *</label>
              <input id="zone-name-ar" v-model="form.nameAr" type="text" class="field-input" required />
            </div>
          </div>
          <div class="form-field">
            <label class="field-label" for="zone-city">{{ t('admin.city') }} *</label>
            <select id="zone-city" v-model="form.cityId" class="field-select" required>
              <option value="" disabled>{{ t('admin.city') }}</option>
              <option v-for="c in cities" :key="c.id" :value="c.id">
                {{ localized(c.nameEn, c.nameAr) }}
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
        :title="t('admin.zoneDetails')"
        max-width="520px"
        @close="closeDetails"
      >
        <div v-if="selectedZone" class="admin-details">
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k mono">EN</span>
              <strong class="detail-v">{{ selectedZone.nameEn }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">AR</span>
              <strong class="detail-v">{{ selectedZone.nameAr }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.city') }}</span>
              <strong class="detail-v">{{ getCityName(selectedZone.cityId) }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('commerce.status') }}</span>
              <strong class="detail-v">{{ (selectedZone.isActive ?? true) ? t('admin.active') : t('admin.inactive') }}</strong>
            </div>
          </div>
          <div class="modal-foot">
            <BaseButton variant="secondary" @click="selectedZone && openEdit(selectedZone)">
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
.zones-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.zones-head {
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
  font-size: var(--step-2, 1.68rem);
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

.zone-cell {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.zone-icon {
  font-size: 20px;
  color: var(--wl-primary);
}

.zone-name {
  font-size: 13.5px;
  color: var(--wl-ink-strong);
}

.arabic-name {
  font-size: 14px;
  color: var(--wl-ink-strong);
}

.city-pill {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}
</style>
