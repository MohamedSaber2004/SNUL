<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { companyRepository, companyService, locationService } from '../../di/container'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import FileUpload from '../../components/ui/FileUpload.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { ATTACHMENT_PLACE, MEDIA_TYPE } from '../../config/api.config'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t, locale } from '../../i18n'
import { COMPANY_TYPE_LABEL, CompanyStatus, CompanyType } from '../../domain/models/company'
import type { CompanyDto, CreateCompanyPayload, UpdateCompanyPayload, DistributorApplicationDto } from '../../domain/models/company'

const route = useRoute()
const router = useRouter()

const activeTab = ref<'companies' | 'applications'>(
  (route.query.tab as string) === 'applications' ? 'applications' : 'companies',
)

const companies = ref<CompanyDto[]>([])
const loadingCompanies = ref(true)
const fetchCompaniesError = ref('')
const companySearch = ref('')
const companyPage = ref(1)
const companyTotalCount = ref(0)

const filteredCompanies = computed(() => {
  const list = Array.isArray(companies.value) ? companies.value : []
  if (!companySearch.value.trim()) return list
  const q = companySearch.value.trim().toLowerCase()
  return list.filter((c) => {
    if (!c) return false
    const matchName = c.name ? String(c.name).toLowerCase().includes(q) : false
    const matchCountry = c.countryNameEn ? String(c.countryNameEn).toLowerCase().includes(q) : false
    const matchType = (COMPANY_TYPE_LABEL[c.type] || c.type) ? String(COMPANY_TYPE_LABEL[c.type] || c.type).toLowerCase().includes(q) : false
    return matchName || matchCountry || matchType
  })
})

const companyTotalPages = computed(() => Math.max(1, Math.ceil(filteredCompanies.value.length / 10)))

const paginatedCompanies = computed(() => {
  const start = (companyPage.value - 1) * 10
  return filteredCompanies.value.slice(start, start + 10)
})

const loadCompanies = async () => {
  loadingCompanies.value = true
  fetchCompaniesError.value = ''
  try {
    const res = await companyRepository.getCompanies({
      pageNumber: 1,
      pageSize: 50,
    })
    companies.value = Array.isArray(res?.data) ? res.data : []
    companyTotalCount.value = res?.totalCount ?? companies.value.length
  } catch (e) {
    fetchCompaniesError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loadingCompanies.value = false
  }
}

// --- Company Add / Edit / Delete / Details ---
const showCompanyModal = ref(false)
const editingCompany = ref<CompanyDto | null>(null)
const companyFormLoading = ref(false)
const companyFormError = ref('')
const companyActionPendingId = ref<string | null>(null)

const companyForm = ref({
  name: '',
  email: '',
  type: CompanyType.Distributor as CompanyType,
  countryId: '',
  status: CompanyStatus.Pending as CompanyStatus,
  isActive: true,
  imageName: '',
})

const openCreateCompany = () => {
  editingCompany.value = null
  companyForm.value = {
    name: '',
    email: '',
    type: CompanyType.Distributor,
    countryId: '',
    status: CompanyStatus.Pending,
    isActive: true,
    imageName: '',
  }
  companyFormError.value = ''
  showCompanyModal.value = true
}

const openEditCompany = (c: CompanyDto) => {
  editingCompany.value = c
  companyForm.value = {
    name: c.name ?? '',
    email: c.email ?? '',
    type: c.type,
    countryId: c.countryId ?? '',
    status: c.status,
    isActive: c.isActive ?? true,
    imageName: c.imageName ?? '',
  }
  companyFormError.value = ''
  showCompanyModal.value = true
}

const closeCompanyForm = () => {
  showCompanyModal.value = false
  companyFormError.value = ''
}

const submitCompanyForm = async () => {
  const f = companyForm.value
  if (!f.name.trim()) {
    companyFormError.value = t('admin.companyName')
    return
  }
  if (!f.countryId) {
    companyFormError.value = t('admin.errCountry')
    return
  }
  companyFormLoading.value = true
  companyFormError.value = ''
  try {
    if (editingCompany.value) {
      const payload: UpdateCompanyPayload = {
        name: f.name.trim(),
        email: f.email.trim() || null,
        type: f.type,
        countryId: f.countryId,
        status: f.status,
        accountManagerId: editingCompany.value.accountManagerId ?? null,
        isActive: f.isActive,
        imageName: f.imageName.trim() || null,
      }
      await companyRepository.updateCompany(editingCompany.value.id, payload)
      toastService.success(t('admin.companyUpdated'))
    } else {
      const payload: CreateCompanyPayload = {
        name: f.name.trim(),
        email: f.email.trim() || null,
        type: f.type,
        countryId: f.countryId,
        status: f.status,
      }
      await companyRepository.createCompany(payload)
      toastService.success(t('admin.companyCreated'))
    }
    closeCompanyForm()
    await loadCompanies()
  } catch (e) {
    companyFormError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    companyFormLoading.value = false
  }
}

const toggleCompanyActive = async (c: CompanyDto) => {
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
  companyActionPendingId.value = c.id
  try {
    const payload: UpdateCompanyPayload = {
      name: c.name,
      email: c.email ?? null,
      type: c.type,
      countryId: c.countryId ?? '',
      status: c.status,
      accountManagerId: c.accountManagerId ?? null,
      isActive: nextActive,
    }
    await companyRepository.updateCompany(c.id, payload)
    toastService.success(nextActive ? t('admin.activated') : t('admin.deactivated'))
    await loadCompanies()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    companyActionPendingId.value = null
  }
}

const confirmDeleteCompany = async (c: CompanyDto) => {
  const ok = await confirmService.confirmDelete(
    `${t('admin.deleteCompanyConfirm')}\n${c.name}`,
    t('common.delete'),
  )
  if (!ok) return
  companyActionPendingId.value = c.id
  try {
    await companyRepository.deleteCompany(c.id)
    toastService.success(t('admin.companyDeleted'))
    await loadCompanies()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    companyActionPendingId.value = null
  }
}

const showCompanyDetails = ref(false)
const selectedCompany = ref<CompanyDto | null>(null)

const openCompanyDetails = (c: CompanyDto) => {
  selectedCompany.value = c
  showCompanyDetails.value = true
}

const closeCompanyDetails = () => {
  showCompanyDetails.value = false
  selectedCompany.value = null
}

const companyCountryName = (c: CompanyDto): string => {
  const localizedName = locale.value === 'ar' ? (c.countryNameAr || c.countryNameEn) : (c.countryNameEn || c.countryNameAr)
  if (localizedName) return localizedName
  const found = locationService.countries.value.find((x) => x.id === c.countryId)
  if (!found) return '—'
  return locale.value === 'ar' ? (found.nameAr || found.nameEn) : (found.nameEn || found.nameAr)
}

const companyStatusLabel = (c: CompanyDto): string =>
  c.status === CompanyStatus.Approved
    ? t('common.verified')
    : c.status === CompanyStatus.Rejected
      ? t('sales.statusDeclined')
      : t('common.pending')

const applications = ref<DistributorApplicationDto[]>([])
const loadingApplications = ref(true)
const fetchApplicationsError = ref('')
const applicationSearch = ref('')
const statusFilter = ref<'all' | 'Pending' | 'Approved' | 'Rejected'>('all')
const applicationPage = ref(1)
const applicationTotalCount = ref(0)

const pendingCount = computed(() => {
  return applications.value.filter((a) => String(a.status).toLowerCase() === 'pending' || a.status === 1).length
})

const filteredApplications = computed(() => {
  const rawList = Array.isArray(applications.value) ? applications.value : []
  let list = rawList
  if (statusFilter.value !== 'all') {
    list = list.filter((a) => {
      if (!a) return false
      const s = String(a.status).toLowerCase()
      if (statusFilter.value === 'Pending') return s === 'pending' || a.status === 1
      if (statusFilter.value === 'Approved') return s === 'approved' || a.status === 2
      if (statusFilter.value === 'Rejected') return s === 'rejected' || a.status === 3
      return true
    })
  }
  if (applicationSearch.value.trim()) {
    const q = applicationSearch.value.trim().toLowerCase()
    list = list.filter((a) => {
      if (!a) return false
      const comp = a.companyName ? String(a.companyName).toLowerCase().includes(q) : false
      const contact = a.contactPerson ? String(a.contactPerson).toLowerCase().includes(q) : false
      const email = a.email ? String(a.email).toLowerCase().includes(q) : false
      const cEmail = a.contactEmail ? String(a.contactEmail).toLowerCase().includes(q) : false
      return comp || contact || email || cEmail
    })
  }
  return list
})

const applicationTotalPages = computed(() => Math.max(1, Math.ceil(filteredApplications.value.length / 10)))

const paginatedApplications = computed(() => {
  const start = (applicationPage.value - 1) * 10
  return filteredApplications.value.slice(start, start + 10)
})

const loadApplications = async () => {
  loadingApplications.value = true
  fetchApplicationsError.value = ''
  try {
    const res = await companyRepository.getDistributorApplications({
      pageNumber: 1,
      pageSize: 50,
    })
    applications.value = res.data ?? []
    applicationTotalCount.value = res.totalCount ?? applications.value.length
  } catch (e) {
    fetchApplicationsError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loadingApplications.value = false
  }
}

const confirmApprove = async (app: DistributorApplicationDto) => {
  const ok = await confirmService.confirm({
    title: t('admin.approveApplication'),
    message: `${t('admin.approveApplication')}: ${app.companyName}?`,
    variant: 'primary',
    confirmText: t('common.save'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return

  try {
    const res = await companyService.approveDistributorApplication(app.id)
    if (res.ok) {
      await Promise.all([loadApplications(), loadCompanies()])
    }
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  }
}

const confirmReject = async (app: DistributorApplicationDto) => {
  const ok = await confirmService.confirm({
    title: t('admin.rejectApplication'),
    message: `${t('admin.rejectApplication')}: ${app.companyName}?`,
    variant: 'danger',
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return

  try {
    const res = await companyService.rejectDistributorApplication(app.id)
    if (res.ok) {
      await loadApplications()
    }
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  }
}

const setTab = (tab: 'companies' | 'applications') => {
  activeTab.value = tab
  void router.replace({ query: { ...route.query, tab } })
}

onMounted(() => {
  void loadCompanies()
  void loadApplications()
  if (!locationService.countries.value.length) {
    void locationService.loadCountries().catch(() => {})
  }
})

const isPending = (status: string | number) => {
  const s = String(status).toLowerCase()
  return s === 'pending' || status === 1
}
const isApproved = (status: string | number) => {
  const s = String(status).toLowerCase()
  return s === 'approved' || status === 2
}
const isRejected = (status: string | number) => {
  const s = String(status).toLowerCase()
  return s === 'rejected' || status === 3
}

watch(companySearch, () => {
  companyPage.value = 1
})
watch([applicationSearch, statusFilter], () => {
  applicationPage.value = 1
})
</script>

<template>
  <AdminLayout>
    <div class="companies-view">
      <!-- Executive Header -->
      <header class="companies-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.companiesEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('admin.companies') }}</h1>
          <p class="head-subtitle">{{ t('admin.companiesDesc') }}</p>
        </div>
      </header>

      <!-- Segmented Navigation Tabs -->
      <div class="tab-ribbon">
        <button
          type="button"
          class="tab-btn mono"
          :class="{ 'is-active': activeTab === 'companies' }"
          @click="setTab('companies')"
        >
          <span>{{ t('admin.companies') }}</span>
          <span class="tab-chip">({{ companies.length }})</span>
        </button>
        <button
          type="button"
          class="tab-btn mono"
          :class="{ 'is-active': activeTab === 'applications' }"
          @click="setTab('applications')"
        >
          <span>{{ t('admin.distributorApps') }}</span>
          <span v-if="pendingCount > 0" class="tab-chip tab-chip--amber">{{ pendingCount }} {{ t('common.pending').toUpperCase() }}</span>
          <span v-else class="tab-chip">({{ applications.length }})</span>
        </button>
      </div>

      <!-- TAB 1: Companies -->
      <div v-if="activeTab === 'companies'" class="tab-content">
        <div class="toolbar-card">
          <div class="search-wrap">
            <span class="material-symbols-outlined search-icon">search</span>
            <input
              v-model="companySearch"
              :placeholder="t('admin.searchPlaceholder')"
              :aria-label="t('common.searchPlaceholder')"
              class="toolbar-input"
            />
          </div>
          <BaseButton variant="primary" @click="openCreateCompany">
            <span class="material-symbols-outlined text-[18px]">add</span>
            <span>{{ t('admin.newCompany') }}</span>
          </BaseButton>
          <span class="mono counter-text">{{ filteredCompanies.length }} {{ t('common.of') }} {{ companyTotalCount }} {{ t('admin.companies') }}</span>
        </div>

        <DataState
          :loading="loadingCompanies && !companies.length"
          :error="fetchCompaniesError && !companies.length ? fetchCompaniesError : null"
          :empty="!filteredCompanies.length && !loadingCompanies && !fetchCompaniesError"
          :empty-title="t('admin.noResults')"
          :empty-description="t('admin.emptyCountriesDesc')"
          skeleton-type="table"
          :skeleton-count="6"
          min-height="320px"
          @retry="loadCompanies"
        >
          <div class="table-card">
            <div class="table-wrap">
              <table class="exec-table">
                <thead>
                  <tr>
                    <th>{{ t('admin.companies') }}</th>
                    <th>{{ t('admin.companyType') }}</th>
                    <th>{{ t('distributor.country') }}</th>
                    <th class="text-end">{{ t('commerce.status') }}</th>
                    <th class="text-end">{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in paginatedCompanies" :key="c.id" class="exec-row">
                    <td>
                      <strong class="company-name">{{ c.name }}</strong>
                    </td>
                    <td>
                      <span class="type-pill mono">{{ COMPANY_TYPE_LABEL[c.type] ?? c.type }}</span>
                    </td>
                    <td class="mono text-xs text-slate-600">{{ (locale === 'ar' ? (c.countryNameAr || c.countryNameEn) : (c.countryNameEn || c.countryNameAr)) ?? '—' }}</td>
                    <td class="text-end">
                      <span
                        class="status-pill mono"
                        :class="{
                          'status-pill--verified': c.status === 2,
                          'status-pill--declined': c.status === 3,
                          'status-pill--pending': c.status !== 2 && c.status !== 3,
                        }"
                      >
                        <span class="pill-dot"></span>
                        <span>{{ c.status === 2 ? t('common.verified') : c.status === 3 ? t('sales.statusDeclined') : t('common.pending') }}</span>
                      </span>
                    </td>
                    <td>
                      <div class="row-actions">
                        <button
                          type="button"
                          class="row-action-btn"
                          :title="t('admin.viewDetails')"
                          :aria-label="t('admin.viewDetails')"
                          @click="openCompanyDetails(c)"
                        >
                          <span class="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          type="button"
                          class="row-action-btn"
                          :title="t('common.edit')"
                          :aria-label="t('common.edit')"
                          @click="openEditCompany(c)"
                        >
                          <span class="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          type="button"
                          class="row-action-btn"
                          :class="(c.isActive ?? true) ? 'row-action-btn--deactivate' : 'row-action-btn--activate'"
                          :title="(c.isActive ?? true) ? t('admin.deactivate') : t('admin.activate')"
                          :aria-label="(c.isActive ?? true) ? t('admin.deactivate') : t('admin.activate')"
                          :disabled="companyActionPendingId === c.id"
                          @click="toggleCompanyActive(c)"
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
                          :disabled="companyActionPendingId === c.id"
                          @click="confirmDeleteCompany(c)"
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
              v-model:page="companyPage"
              :total-pages="companyTotalPages"
              :total-items="filteredCompanies.length"
              :page-size="10"
              variant="table"
              @change="(p: number) => { companyPage = p }"
            />
          </div>
        </DataState>
      </div>


      <!-- TAB 2: Applications -->
      <div v-else-if="activeTab === 'applications'" class="tab-content">
        <div class="toolbar-card">
          <div class="search-wrap">
            <span class="material-symbols-outlined search-icon">search</span>
            <input
              v-model="applicationSearch"
              :placeholder="t('admin.searchPlaceholder')"
              :aria-label="t('common.searchPlaceholder')"
              class="toolbar-input"
            />
          </div>

          <div class="status-segment-group">
            <button
              type="button"
              class="seg-btn mono"
              :class="{ 'is-active': statusFilter === 'all' }"
              @click="statusFilter = 'all'"
            >
              {{ t('common.all') }}
            </button>
            <button
              type="button"
              class="seg-btn mono"
              :class="{ 'is-active': statusFilter === 'Pending' }"
              @click="statusFilter = 'Pending'"
            >
              {{ t('common.pending') }}
            </button>
            <button
              type="button"
              class="seg-btn mono"
              :class="{ 'is-active': statusFilter === 'Approved' }"
              @click="statusFilter = 'Approved'"
            >
              {{ t('common.verified') }}
            </button>
            <button
              type="button"
              class="seg-btn mono"
              :class="{ 'is-active': statusFilter === 'Rejected' }"
              @click="statusFilter = 'Rejected'"
            >
              {{ t('sales.statusDeclined') }}
            </button>
          </div>

          <span class="mono counter-text">{{ filteredApplications.length }} {{ t('common.of') }} {{ applicationTotalCount }} {{ t('admin.inquiriesCount') }}</span>
        </div>

        <DataState
          :loading="loadingApplications && !applications.length"
          :error="fetchApplicationsError && !applications.length ? fetchApplicationsError : null"
          :empty="!filteredApplications.length && !loadingApplications && !fetchApplicationsError"
          :empty-title="t('admin.noApplications')"
          :empty-description="t('admin.emptyApplicationsDesc')"
          skeleton-type="table"
          :skeleton-count="6"
          min-height="320px"
          @retry="loadApplications"
        >
          <div class="table-card">
            <div class="table-wrap">
              <table class="exec-table">
                <thead>
                  <tr>
                    <th>{{ t('distributor.companyName') }}</th>
                    <th>{{ t('admin.applicant') }}</th>
                    <th>{{ t('distributor.country') }}</th>
                    <th>{{ t('distributor.salesVolume') }}</th>
                    <th>{{ t('commerce.status') }}</th>
                    <th>{{ t('admin.submittedDate') }}</th>
                    <th class="text-end">{{ t('admin.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="app in paginatedApplications" :key="app.id" class="exec-row">
                    <td>
                      <div>
                        <strong class="company-name">{{ app.companyName }}</strong>
                        <div v-if="app.website" class="website-row mono">
                          <a
                            :href="app.website.startsWith('http') ? app.website : `https://${app.website}`"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {{ app.website }}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="applicant-cell">
                        <span class="applicant-name">{{ app.contactPerson }}</span>
                        <span class="mono applicant-email">{{ app.contactEmail || app.email }}</span>
                        <span v-if="app.phone" class="mono applicant-phone">{{ app.phone }}</span>
                      </div>
                    </td>
                    <td class="mono text-xs text-slate-600">{{ app.countryName || app.countryNameEn || '—' }}</td>
                    <td>
                      <span class="vol-pill mono">{{ app.salesVolumeBand }}</span>
                    </td>
                    <td>
                      <span
                        class="status-pill mono"
                        :class="{
                          'status-pill--verified': isApproved(app.status),
                          'status-pill--declined': isRejected(app.status),
                          'status-pill--pending': isPending(app.status),
                        }"
                      >
                        <span class="pill-dot"></span>
                        <span>{{ isApproved(app.status) ? t('common.verified') : isRejected(app.status) ? t('sales.statusDeclined') : t('common.pending') }}</span>
                      </span>
                    </td>
                    <td class="mono text-xs text-slate-500">{{ new Date(app.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</td>
                    <td class="text-end">
                      <div v-if="isPending(app.status)" class="app-actions">
                        <button type="button" class="btn-approve mono" @click="confirmApprove(app)">
                          <span class="material-symbols-outlined text-[15px]">check</span>
                          <span>{{ t('sales.approve') }}</span>
                        </button>
                        <button type="button" class="btn-reject mono" @click="confirmReject(app)">
                          <span class="material-symbols-outlined text-[15px]">close</span>
                          <span>{{ t('sales.decline') }}</span>
                        </button>
                      </div>
                      <span v-else class="mono text-xs text-slate-400">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <AppPagination
              v-model:page="applicationPage"
              :total-pages="applicationTotalPages"
              :total-items="filteredApplications.length"
              :page-size="10"
              variant="table"
              @change="(p: number) => { applicationPage = p }"
            />
          </div>
        </DataState>
      </div>

      <!-- Add / Edit Company Modal -->
      <BaseModal
        v-model="showCompanyModal"
        :title="editingCompany ? t('admin.editCompany') : t('admin.newCompany')"
        max-width="640px"
        @close="closeCompanyForm"
      >
        <form class="admin-modal-form" @submit.prevent="submitCompanyForm">
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="company-name">{{ t('admin.companyName') }} *</label>
              <input id="company-name" v-model="companyForm.name" type="text" class="field-input" required />
            </div>
            <div class="form-field">
              <label class="field-label" for="company-email">{{ t('admin.companyEmail') }}</label>
              <input id="company-email" v-model="companyForm.email" type="email" class="field-input mono" />
            </div>
          </div>
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="company-type">{{ t('admin.companyType') }} *</label>
              <select id="company-type" v-model="companyForm.type" class="field-select">
                <option :value="CompanyType.Hospital">{{ COMPANY_TYPE_LABEL[CompanyType.Hospital] }}</option>
                <option :value="CompanyType.Distributor">{{ COMPANY_TYPE_LABEL[CompanyType.Distributor] }}</option>
                <option :value="CompanyType.Clinic">{{ COMPANY_TYPE_LABEL[CompanyType.Clinic] }}</option>
                </select>
            </div>
            <div class="form-field">
              <label class="field-label" for="company-country">{{ t('distributor.country') }} *</label>
              <select id="company-country" v-model="companyForm.countryId" class="field-select" required>
                <option value="" disabled>{{ t('distributor.country') }}</option>
                <option v-for="co in locationService.countries.value" :key="co.id" :value="co.id">
                  {{ locale === 'ar' ? (co.nameAr || co.nameEn) : (co.nameEn || co.nameAr) }}
                </option>
              </select>
            </div>
          </div>
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="company-status">{{ t('commerce.status') }} *</label>
              <select id="company-status" v-model="companyForm.status" class="field-select">
                <option :value="CompanyStatus.Pending">{{ t('common.pending') }}</option>
                <option :value="CompanyStatus.Approved">{{ t('common.verified') }}</option>
                <option :value="CompanyStatus.Rejected">{{ t('sales.statusDeclined') }}</option>
              </select>
            </div>
          </div>
          <div class="form-field full-width">
            <FileUpload
              :model-value="companyForm.imageName || null"
              :place="ATTACHMENT_PLACE.PROVIDERS"
              :file-type="MEDIA_TYPE.IMAGE"
              accept="image/*"
              :label="t('admin.companyImage')"
              :hint="t('attachment.dropHint')"
              @update:modelValue="companyForm.imageName = $event ?? ''"
            />
          </div>
          <div v-if="editingCompany" class="form-field">
            <label class="toggle-label">
              <input v-model="companyForm.isActive" type="checkbox" />
              <span>{{ t('admin.active') }}</span>
            </label>
          </div>

          <p v-if="companyFormError" class="form-error" role="alert">{{ companyFormError }}</p>

          <div class="modal-foot">
            <BaseButton variant="secondary" type="button" @click="closeCompanyForm">
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton variant="primary" type="submit" :loading="companyFormLoading">
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </form>
      </BaseModal>

      <!-- Company Details Modal -->
      <BaseModal
        v-model="showCompanyDetails"
        :title="t('admin.companyDetails')"
        max-width="560px"
        @close="closeCompanyDetails"
      >
        <div v-if="selectedCompany" class="admin-details">
          <div v-if="selectedCompany.imageName" class="details-logo">
            <AppImage
              :src="selectedCompany.imageName"
              placeholder-type="company"
              :placeholder-text="selectedCompany.name"
              :alt="selectedCompany.name"
              fit="contain"
              height="96px"
            />
          </div>
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.companyName') }}</span>
              <strong class="detail-v">{{ selectedCompany.name }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.companyEmail') }}</span>
              <strong class="detail-v mono">{{ selectedCompany.email || '—' }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.companyType') }}</span>
              <strong class="detail-v">{{ COMPANY_TYPE_LABEL[selectedCompany.type] ?? selectedCompany.type }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('distributor.country') }}</span>
              <strong class="detail-v">{{ companyCountryName(selectedCompany) }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('commerce.status') }}</span>
              <strong class="detail-v">{{ companyStatusLabel(selectedCompany) }}</strong>
            </div>
          </div>
          <div class="modal-foot">
            <BaseButton variant="secondary" @click="selectedCompany && openEditCompany(selectedCompany)">
              {{ t('common.edit') }}
            </BaseButton>
            <BaseButton variant="secondary" @click="closeCompanyDetails">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>
    </div>
  </AdminLayout>
</template>

<style scoped>
.companies-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.details-logo {
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  margin-bottom: 1rem;
  min-height: 96px;
}

.companies-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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

/* Tab Ribbon */
.tab-ribbon {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border, #D9E2EC);
  padding-bottom: 0;
}

.tab-btn {
  padding: 0.75rem 1.25rem;
  border: none;
  background: transparent;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--fg-muted, #627D98);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  transition: all 0.18s ease;
}

.tab-btn:hover {
  color: var(--fg-heading, #102A43);
}

.tab-btn.is-active {
  color: var(--primary, #0F3D56);
  border-bottom-color: var(--primary, #0F3D56);
}

.tab-chip {
  font-size: 10px;
  font-weight: 700;
  background: var(--surface-subtle, #F7F9FB);
  color: var(--fg-muted, #627D98);
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-xs, 3px);
}

.tab-chip--amber {
  background: var(--color-warning-50, #FFF8E1);
  color: var(--fg-warning, #E67E22);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Toolbar */
.toolbar-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  padding: 0.85rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  box-shadow: var(--shadow-xs);
  flex-wrap: wrap;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 320px;
  max-width: 100%;
}

.search-icon {
  position: absolute;
  inset-inline-start: 12px;
  font-size: 18px;
  color: var(--wl-muted-soft);
  pointer-events: none;
}

.toolbar-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  padding-inline-start: 38px;
  background: var(--wl-surface-soft);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 13.5px;
  color: var(--wl-ink-strong);
  outline: none;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.toolbar-input:focus {
  background: var(--wl-surface);
  border-color: var(--wl-primary);
  box-shadow: 0 0 0 3px rgba(105, 169, 255, 0.12);
}

.status-segment-group {
  display: inline-flex;
  background: var(--wl-surface-soft);
  padding: 3px;
  border-radius: 8px;
  gap: 2px;
}

.seg-btn {
  border: none;
  background: transparent;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--wl-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.seg-btn.is-active {
  background: var(--wl-surface);
  color: var(--wl-primary);
  font-weight: 700;
  box-shadow: var(--shadow-xs);
}

.counter-text {
  font-size: 11.5px;
  color: var(--wl-muted);
  font-weight: 700;
}

/* Executive Table */
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
  height: 52px;
  border-bottom: 1px solid var(--border, #D9E2EC);
  transition: background 0.15s ease;
}

.exec-row:hover {
  background: var(--surface-subtle, #F7F9FB);
}

.exec-row td {
  padding: 0.65rem 1.25rem;
  vertical-align: middle;
}

.company-name {
  font-size: 13.5px;
  color: var(--fg-heading, #102A43);
}

.website-row {
  font-size: 11px;
  color: var(--secondary, #147D92);
  margin-top: 2px;
}

.website-row a {
  color: inherit;
  text-decoration: underline;
}

.type-pill {
  font-size: 10.5px;
  color: var(--fg-muted, #627D98);
  background: var(--surface-subtle, #F7F9FB);
  border: 1px solid var(--border, #D9E2EC);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-xs, 3px);
}

.applicant-cell {
  display: flex;
  flex-direction: column;
}

.applicant-name {
  font-size: 13px;
  color: var(--fg-heading, #102A43);
}

.applicant-email,
.applicant-phone {
  font-size: 11px;
  color: var(--fg-muted, #627D98);
}

.vol-pill {
  font-size: 10px;
  font-weight: 700;
  color: var(--secondary, #147D92);
  background: var(--brand-soft, #EDF4FF);
  border: 1px solid var(--border, #D9E2EC);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-xs, 3px);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 10.5px;
  font-weight: 700;
  padding: 0.18rem 0.55rem;
  border-radius: var(--radius-xs, 3px);
}

.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-pill--verified {
  background: var(--color-success-50, #E8F5E9);
  color: var(--fg-success, #198754);
}
.status-pill--verified .pill-dot { background: var(--color-success-500, #198754); }

.status-pill--pending {
  background: var(--color-warning-50, #FFF8E1);
  color: var(--fg-warning, #E67E22);
}
.status-pill--pending .pill-dot { background: var(--color-warning-500, #E67E22); }

.status-pill--declined {
  background: var(--color-danger-50, #FFF8F7);
  color: var(--fg-danger, #DC3545);
}
.status-pill--declined .pill-dot { background: var(--color-danger-500, #DC3545); }

.app-actions {
  display: flex;
  gap: 0.4rem;
  justify-content: flex-end;
}

.btn-approve {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  border-radius: 6px;
  padding: 0.35rem 0.75rem;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-approve:hover {
  background: var(--wl-primary-hover);
}

.btn-reject {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--wl-surface);
  border: 1px solid rgba(237, 66, 69, 0.35);
  color: var(--wl-danger);
  border-radius: 6px;
  padding: 0.35rem 0.75rem;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-reject:hover {
  background: var(--wl-danger-soft);
}

.text-end {
  text-align: end;
}
</style>

