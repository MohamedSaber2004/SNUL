import { ref } from 'vue'
import type {
  CompanyDto,
  DistributorApplicationDto,
  DistributorApplicationPayload,
  OemInquiryPayload,
  OemService,
} from '../domain/models/company'
import type {
  CompanyAddressDto,
  CreateCompanyAddressPayload,
  UpdateCompanyAddressPayload,
} from '../domain/models/address'
import type {
  CompanyRepository, DistributorApplicationQuery, OemInquiryDto } from '../domain/ports/company-repository'
import { toastService } from '../infrastructure/feedback/toast.service'
import { t } from '../i18n'

export type CompanyResult = { ok: true } | { ok: false; error: string }

export class CompanyService {
  readonly myCompany = ref<CompanyDto | null>(null)
  readonly oemServices = ref<OemService[]>([])
  readonly oemInquiries = ref<OemInquiryDto[]>([])
  readonly oemInquiriesLoading = ref(false)
  readonly distributorApplications = ref<DistributorApplicationDto[]>([])
  readonly applicationsTotal = ref(0)
  readonly pendingCount = ref(0)
  readonly loading = ref(false)

  // Company Addresses — many per company, each tied to a Country
  readonly companyAddresses = ref<CompanyAddressDto[]>([])
  readonly companyAddressesLoading = ref(false)

  private readonly repo: CompanyRepository
  private loadedCompany = false

  constructor(repo: CompanyRepository) {
    this.repo = repo
  }

  async loadMyCompany(force = false): Promise<void> {
    if (this.loadedCompany && !force) return
    this.loading.value = true
    try {
      this.myCompany.value = await this.repo.getMyCompany()
      // Only cache success — marking a failure as "loaded" would leave
      // `myCompany` permanently null for every non-forced caller (e.g. the
      // account dashboard) even once the request would have succeeded.
      this.loadedCompany = true
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[company] loadMyCompany failed', e)
      this.loadedCompany = false
    } finally {
      this.loading.value = false
    }
  }

  async loadOemServices(): Promise<void> {
    try {
      const res = await this.repo.getOemServices()
      this.oemServices.value = res && res.length ? res : []
    } catch {
      this.oemServices.value = []
    }
  }

  async submitDistributorApplication(payload: DistributorApplicationPayload): Promise<CompanyResult> {
    try {
      await this.repo.submitDistributorApplication(payload)
      toastService.success(t('distributor.applicationSubmitted'))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }

  async loadDistributorApplications(query: DistributorApplicationQuery = {}): Promise<CompanyResult> {
    this.loading.value = true
    try {
      const res = await this.repo.getDistributorApplications(query)
      this.distributorApplications.value = res.data ?? []
      this.applicationsTotal.value = res.totalCount ?? this.distributorApplications.value.length
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    } finally {
      this.loading.value = false
    }
  }

  async loadPendingApplicationsCount(): Promise<number> {
    try {
      const res = await this.repo.getDistributorApplications({ pageNumber: 1, pageSize: 1, status: 1 })
      this.pendingCount.value = res.totalCount ?? 0
      return this.pendingCount.value
    } catch {
      return 0
    }
  }

  async approveDistributorApplication(id: string, accountManagerId?: string | null): Promise<CompanyResult> {
    try {
      const updated = await this.repo.approveDistributorApplication(id, { accountManagerId })
      const idx = this.distributorApplications.value.findIndex((a) => a.id === id)
      if (idx !== -1) {
        this.distributorApplications.value[idx] = updated
      }
      this.pendingCount.value = Math.max(0, this.pendingCount.value - 1)
      toastService.success(t('admin.approveSuccess'))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }

  async rejectDistributorApplication(id: string, reason?: string): Promise<CompanyResult> {
    try {
      const updated = await this.repo.rejectDistributorApplication(id, { reason })
      const idx = this.distributorApplications.value.findIndex((a) => a.id === id)
      if (idx !== -1) {
        this.distributorApplications.value[idx] = updated
      }
      this.pendingCount.value = Math.max(0, this.pendingCount.value - 1)
      toastService.success(t('admin.rejectSuccess'))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }

  async submitOemInquiry(payload: OemInquiryPayload): Promise<CompanyResult> {
    try {
      await this.repo.submitOemInquiry(payload)
      toastService.success(t('oem.inquirySubmitted'))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }

  async loadOemInquiries(): Promise<void> {
    this.oemInquiriesLoading.value = true
    try {
      const res = await this.repo.getOemInquiries({ pageNumber: 1, pageSize: 50 })
      this.oemInquiries.value = res?.data ?? []
    } catch {
      this.oemInquiries.value = []
    } finally {
      this.oemInquiriesLoading.value = false
    }
  }

  async deleteOemInquiry(id: string): Promise<CompanyResult> {
    try {
      await this.repo.deleteOemInquiry(id)
      this.oemInquiries.value = this.oemInquiries.value.filter((q) => q.id !== id)
      toastService.success(t('admin.oemInquiryDeleted'))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }

  // ── Company Addresses (supports many addresses same country or across countries) ──

  async loadCompanyAddresses(companyId?: string): Promise<CompanyResult & { data?: CompanyAddressDto[] }> {
    const cid = companyId ?? this.myCompany.value?.id
    if (!cid) return { ok: false, error: t('common.error') }
    this.companyAddressesLoading.value = true
    try {
      const list = await this.repo.getCompanyAddresses(cid)
      this.companyAddresses.value = list
      return { ok: true, data: list }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    } finally {
      this.companyAddressesLoading.value = false
    }
  }

  async createCompanyAddress(payload: CreateCompanyAddressPayload): Promise<CompanyResult & { data?: CompanyAddressDto }> {
    try {
      const created = await this.repo.createCompanyAddress(payload)
      // keep local state in sync — if new is default, unset others
      if (created.isDefault) this.companyAddresses.value.forEach((a) => (a.isDefault = false))
      this.companyAddresses.value = [created, ...this.companyAddresses.value]
      toastService.success(t('profile.savedToast'))
      return { ok: true, data: created }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }

  async updateCompanyAddress(addressId: string, payload: UpdateCompanyAddressPayload & { companyId?: string }): Promise<CompanyResult & { data?: CompanyAddressDto }> {
    try {
      const updated = await this.repo.updateCompanyAddress(addressId, payload)
      if (updated.isDefault) this.companyAddresses.value.forEach((a) => (a.isDefault = false))
      const idx = this.companyAddresses.value.findIndex((a) => a.id === addressId)
      if (idx >= 0) this.companyAddresses.value[idx] = updated
      else this.companyAddresses.value = [updated, ...this.companyAddresses.value]
      toastService.success(t('profile.savedToast'))
      return { ok: true, data: updated }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }

  async deleteCompanyAddress(addressId: string): Promise<CompanyResult> {
    const companyId = this.myCompany.value?.id
    try {
      await this.repo.deleteCompanyAddress(addressId, companyId ?? undefined)
      this.companyAddresses.value = this.companyAddresses.value.filter((a) => a.id !== addressId)
      toastService.success(t('profile.savedToast'))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : t('common.error') }
    }
  }

  /** Group company addresses by country for UI */
  groupedCompanyAddresses(): Map<string, CompanyAddressDto[]> {
    const m = new Map<string, CompanyAddressDto[]>()
    for (const a of this.companyAddresses.value) {
      const arr = m.get(a.countryId) ?? []
      arr.push(a)
      m.set(a.countryId, arr)
    }
    return m
  }
}
