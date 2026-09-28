<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import FileUpload from '../../components/ui/FileUpload.vue'
import { services } from '../../di/container'
import { ATTACHMENT_PLACE, MEDIA_TYPE } from '../../config/api.config'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t } from '../../i18n'
import { resolveFileUrl } from '../../utils/file-url'
import type { CertificationDto } from '../../domain/models/certification'

const router = useRouter()

/* Certifications State */
const certifications = ref<CertificationDto[]>([])
const loadingCerts = ref(true)
const certsError = ref('')
const certSearch = ref('')
const certPage = ref(1)
const certPageSize = 10
const certTotalCount = ref(0)

const filteredCerts = computed(() => {
  const list = Array.isArray(certifications.value) ? certifications.value : []
  if (!certSearch.value.trim()) return list
  const q = certSearch.value.trim().toLowerCase()
  return list.filter((c) => {
    if (!c) return false
    const matchTitle = c.title ? String(c.title).toLowerCase().includes(q) : false
    const matchNum = c.certificateNumber ? String(c.certificateNumber).toLowerCase().includes(q) : false
    const matchIssuer = c.issuer ? String(c.issuer).toLowerCase().includes(q) : false
    const matchTo = c.issuedTo ? String(c.issuedTo).toLowerCase().includes(q) : false
    const matchId = c.id ? String(c.id).toLowerCase().includes(q) : false
    return matchTitle || matchNum || matchIssuer || matchTo || matchId
  })
})

const loadCertifications = async () => {
  loadingCerts.value = true
  certsError.value = ''
  try {
    const res = await services.certificationRepository.getCertifications({
      pageNumber: 1,
      pageSize: 50,
    })
    certifications.value = res.data
    certTotalCount.value = res.totalCount
  } catch (e) {
    certsError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loadingCerts.value = false
  }
}

const totalCertPages = computed(() => Math.max(1, Math.ceil(filteredCerts.value.length / certPageSize)))

const paginatedCerts = computed(() => {
  const start = (certPage.value - 1) * certPageSize
  return filteredCerts.value.slice(start, start + certPageSize)
})

const goToCertPage = (p: number) => {
  if (p < 1 || p > totalCertPages.value) return
  certPage.value = p
}

watch(certSearch, () => {
  certPage.value = 1
})

const formatValidity = (issueDate: string, expiryDate?: string | null): string => {
  const start = issueDate ? issueDate.substring(0, 10) : '—'
  const end = expiryDate ? expiryDate.substring(0, 10) : t('admin.certPermanent')
  return `${start} → ${end}`
}

const isCertActive = (c: CertificationDto): boolean => {
  if (!c.isActive) return false
  if (!c.expiryDate) return true
  return new Date(c.expiryDate) > new Date()
}

// --- Add / Edit / Delete / Details ---
const showFormModal = ref(false)
const editingCert = ref<CertificationDto | null>(null)
const formLoading = ref(false)
const formError = ref('')
const actionPendingId = ref<string | null>(null)

const toDateInput = (iso?: string | null): string => (iso ? iso.substring(0, 10) : '')

const form = ref({
  certificateNumber: '',
  title: '',
  issuedTo: '',
  issuer: '',
  issueDate: '',
  expiryDate: '',
  description: '',
  certificationImageName: '',
  isActive: true,
})

const openCreate = () => {
  editingCert.value = null
  form.value = {
    certificateNumber: '',
    title: '',
    issuedTo: '',
    issuer: '',
    issueDate: '',
    expiryDate: '',
    description: '',
    certificationImageName: '',
    isActive: true,
  }
  formError.value = ''
  showFormModal.value = true
}

const openEdit = (c: CertificationDto) => {
  editingCert.value = c
  form.value = {
    certificateNumber: c.certificateNumber ?? '',
    title: c.title ?? '',
    issuedTo: c.issuedTo ?? '',
    issuer: c.issuer ?? '',
    issueDate: toDateInput(c.issueDate),
    expiryDate: toDateInput(c.expiryDate),
    description: c.description ?? '',
    certificationImageName: c.certificationImageName ?? '',
    isActive: c.isActive ?? true,
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
  if (!f.certificateNumber.trim() || !f.title.trim() || !f.issuedTo.trim() || !f.issuer.trim()) {
    formError.value = t('admin.errCertFields')
    return
  }
  if (!f.issueDate) {
    formError.value = t('admin.certIssueDate')
    return
  }
  formLoading.value = true
  formError.value = ''
  try {
    if (editingCert.value) {
      await services.certificationRepository.updateCertification(editingCert.value.id, {
        certificateNumber: f.certificateNumber.trim(),
        title: f.title.trim(),
        issuedTo: f.issuedTo.trim(),
        issuer: f.issuer.trim(),
        issueDate: f.issueDate,
        expiryDate: f.expiryDate || null,
        description: f.description.trim() || null,
        certificationImageName: f.certificationImageName.trim() || null,
        isActive: f.isActive,
      })
      toastService.success(t('admin.certUpdated'))
    } else {
      await services.certificationRepository.createCertification({
        certificateNumber: f.certificateNumber.trim(),
        title: f.title.trim(),
        issuedTo: f.issuedTo.trim(),
        issuer: f.issuer.trim(),
        issueDate: f.issueDate,
        expiryDate: f.expiryDate || null,
        description: f.description.trim() || null,
        certificationImageName: f.certificationImageName.trim() || null,
      })
      toastService.success(t('admin.certCreated'))
    }
    closeForm()
    await loadCertifications()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    formLoading.value = false
  }
}

const toggleActive = async (c: CertificationDto) => {
  const next = !(c.isActive ?? true)
  const ok = await confirmService.confirmAction(
    next ? t('admin.confirmActivate') : t('admin.confirmDeactivate'),
    {
      title: next ? t('admin.activate') : t('admin.deactivate'),
      variant: next ? 'primary' : 'warning',
      icon: next ? 'check_circle' : 'block',
      confirmText: next ? t('admin.activate') : t('admin.deactivate'),
      cancelText: t('common.cancel'),
    },
  )
  if (!ok) return
  actionPendingId.value = c.id
  try {
    await services.certificationRepository.updateCertification(c.id, {
      certificateNumber: c.certificateNumber,
      title: c.title,
      issuedTo: c.issuedTo,
      issuer: c.issuer,
      issueDate: toDateInput(c.issueDate),
      expiryDate: toDateInput(c.expiryDate) || null,
      description: c.description ?? null,
      certificationImageName: c.certificationImageName ?? null,
      isActive: next,
    })
    toastService.success(next ? t('admin.activated') : t('admin.deactivated'))
    await loadCertifications()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    actionPendingId.value = null
  }
}

const confirmDelete = async (c: CertificationDto) => {
  const ok = await confirmService.confirmDelete(
    `${t('admin.deleteCertConfirm')}\n${c.title} (${c.certificateNumber})`,
    t('common.delete'),
  )
  if (!ok) return
  actionPendingId.value = c.id
  try {
    await services.certificationRepository.deleteCertification(c.id)
    toastService.success(t('admin.certDeleted'))
    await loadCertifications()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    actionPendingId.value = null
  }
}

const showDetailsModal = ref(false)
const selectedCert = ref<CertificationDto | null>(null)

const openDetails = (c: CertificationDto) => {
  selectedCert.value = c
  showDetailsModal.value = true
}

const closeDetails = () => {
  showDetailsModal.value = false
  selectedCert.value = null
}

onMounted(async () => {
  if (!services.authService.isAdmin.value) {
    void router.replace('/admin')
    return
  }
  await loadCertifications()
})
</script>

<template>
  <AdminLayout>
    <div class="compliance-admin-view">
      <!-- Executive Header -->
      <header class="admin-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.complianceEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('certifications.title') }} {{ t('admin.regulatoryLedger') }}</h1>
          <p class="head-subtitle">{{ t('admin.complianceSubtitle') }}</p>
        </div>
        <BaseButton variant="primary" @click="openCreate">
          <span class="material-symbols-outlined text-[18px]">add</span>
          <span>{{ t('admin.newCertification') }}</span>
        </BaseButton>
      </header>

      <!-- TAB: CERTIFICATIONS -->
      <div class="tab-pane">
        <div class="toolbar-wrap">
          <div class="search-input-wrap">
            <span class="material-symbols-outlined search-icon">search</span>
            <input
              v-model="certSearch"
              type="text"
              class="toolbar-search-input"
              :placeholder="t('common.searchPlaceholder')"
            />
          </div>
        </div>

        <DataState
          :loading="loadingCerts"
          :error="certsError"
          skeleton-type="table"
          :skeleton-count="5"
          :empty="!filteredCerts.length && !loadingCerts"
          :empty-title="t('admin.noCertificationsFound')"
          :empty-description="t('admin.noCertificationsFoundDesc')"
          @retry="loadCertifications"
        >
          <div class="table-card">
            <div class="table-wrap">
              <table class="exec-table">
                <thead>
                  <tr>
                    <th>{{ t('admin.certStandardTitle') }}</th>
                    <th>{{ t('admin.certCertificateNumber') }}</th>
                    <th>{{ t('admin.certIssuingAuthority') }}</th>
                    <th>{{ t('admin.certValidity') }}</th>
                    <th>{{ t('commerce.status') }}</th>
                    <th>{{ t('admin.certAttachment') }}</th>
                    <th class="text-end">{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in paginatedCerts" :key="c.id" class="exec-row">
                    <td>
                      <div class="cert-cell">
                        <div class="cert-icon-circle">
                          <span class="material-symbols-outlined text-[18px]">verified</span>
                        </div>
                        <div>
                          <strong class="cert-title">{{ c.title }}</strong>
                          <div v-if="c.issuedTo" class="cert-issued-to">{{ c.issuedTo }}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="mono cert-badge">{{ c.certificateNumber }}</span>
                    </td>
                    <td class="issuer-text">{{ c.issuer }}</td>
                    <td class="mono validity-text">{{ formatValidity(c.issueDate, c.expiryDate) }}</td>
                    <td>
                      <span
                        class="status-pill mono"
                        :class="isCertActive(c) ? 'status-pill--active' : 'status-pill--expired'"
                      >
                        <span class="dot"></span>
                        <span>{{ isCertActive(c) ? t('admin.certActive') : t('admin.certExpired') }}</span>
                      </span>
                    </td>
                    <td>
                      <a
                        v-if="c.certificationImageName"
                        :href="resolveFileUrl(c.certificationImageName, '#')"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="btn-view-doc mono"
                      >
                        <span class="material-symbols-outlined text-[14px]">file_open</span>
                        <span>{{ t('admin.certView') }}</span>
                      </a>
                      <span v-else class="mono text-xs text-slate-400">—</span>
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
              :page="certPage"
              :total-pages="totalCertPages"
              :total-items="filteredCerts.length"
              :page-size="certPageSize"
              variant="table"
              @change="goToCertPage"
            />
          </div>
        </DataState>
      </div>

      <!-- Add / Edit Modal -->
      <BaseModal
        v-model="showFormModal"
        :title="editingCert ? t('admin.editCertification') : t('admin.newCertification')"
        max-width="640px"
        @close="closeForm"
      >
        <form class="admin-modal-form" @submit.prevent="submitForm">
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="cert-number">{{ t('admin.certCertificateNumber') }} *</label>
              <input id="cert-number" v-model="form.certificateNumber" type="text" class="field-input mono" required />
            </div>
            <div class="form-field">
              <label class="field-label" for="cert-title">{{ t('admin.certStandardTitle') }} *</label>
              <input id="cert-title" v-model="form.title" type="text" class="field-input" required />
            </div>
          </div>
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="cert-issued-to">{{ t('admin.certIssuedTo') }} *</label>
              <input id="cert-issued-to" v-model="form.issuedTo" type="text" class="field-input" required />
            </div>
            <div class="form-field">
              <label class="field-label" for="cert-issuer">{{ t('admin.certIssuingAuthority') }} *</label>
              <input id="cert-issuer" v-model="form.issuer" type="text" class="field-input" required />
            </div>
          </div>
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="cert-issue-date">{{ t('admin.certIssueDate') }} *</label>
              <input id="cert-issue-date" v-model="form.issueDate" type="date" class="field-input mono" required />
            </div>
            <div class="form-field">
              <label class="field-label" for="cert-expiry-date">{{ t('admin.certExpiryDate') }}</label>
              <input id="cert-expiry-date" v-model="form.expiryDate" type="date" class="field-input mono" />
            </div>
          </div>
          <div class="form-field">
            <label class="field-label" for="cert-description">{{ t('admin.certDescription') }}</label>
            <textarea id="cert-description" v-model="form.description" class="field-textarea" rows="2"></textarea>
          </div>
          <div class="form-field">
            <FileUpload
              :model-value="form.certificationImageName || null"
              :place="ATTACHMENT_PLACE.PROVIDERS"
              :file-type="MEDIA_TYPE.IMAGE"
              accept="image/*"
              :label="t('admin.certImage')"
              @update:modelValue="form.certificationImageName = $event ?? ''"
            />
          </div>
          <div v-if="editingCert" class="form-field">
            <label class="toggle-label">
              <input v-model="form.isActive" type="checkbox" />
              <span>{{ t('admin.certActive') }}</span>
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
        :title="t('admin.certDetails')"
        max-width="600px"
        @close="closeDetails"
      >
        <div v-if="selectedCert" class="admin-details">
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.certStandardTitle') }}</span>
              <strong class="detail-v">{{ selectedCert.title }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.certCertificateNumber') }}</span>
              <strong class="detail-v mono">{{ selectedCert.certificateNumber }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.certIssuedTo') }}</span>
              <strong class="detail-v">{{ selectedCert.issuedTo }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.certIssuingAuthority') }}</span>
              <strong class="detail-v">{{ selectedCert.issuer }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.certValidity') }}</span>
              <strong class="detail-v mono">{{ formatValidity(selectedCert.issueDate, selectedCert.expiryDate) }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('commerce.status') }}</span>
              <strong class="detail-v">{{ isCertActive(selectedCert) ? t('admin.certActive') : t('admin.certExpired') }}</strong>
            </div>
          </div>
          <div v-if="selectedCert.description" class="detail-item">
            <span class="detail-k mono">{{ t('admin.certDescription') }}</span>
            <strong class="detail-v">{{ selectedCert.description }}</strong>
          </div>
          <div class="modal-foot">
            <BaseButton variant="secondary" @click="selectedCert && openEdit(selectedCert)">
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
.compliance-admin-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.admin-head {
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
.toolbar-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
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

.cert-cell {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.cert-icon-circle {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.cert-title {
  font-size: 13.5px;
  color: var(--wl-ink-strong);
}

.cert-issued-to {
  font-size: 11.5px;
  color: var(--wl-muted);
}

.cert-badge {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  background: var(--wl-surface-soft);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--wl-border);
}

.issuer-text {
  font-size: 13px;
  color: var(--wl-ink-soft);
}

.validity-text {
  font-size: 11.5px;
  color: var(--wl-muted);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11px;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
}

.status-pill .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-pill--active {
  background: var(--wl-success-faint);
  color: var(--wl-success);
}
.status-pill--active .dot { background: var(--wl-success); }

.status-pill--expired {
  background: var(--wl-warning-faint);
  color: var(--wl-warning);
}
.status-pill--expired .dot { background: var(--wl-warning); }

.btn-view-doc {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  padding: 0.25rem 0.65rem;
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-view-doc:hover {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
}
</style>
