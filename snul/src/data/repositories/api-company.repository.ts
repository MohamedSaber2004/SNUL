import { COMPANY_ROUTES } from '../../config/api.config'
import type { PaginatedResult } from '../../domain/models/location'
import {
  type CompanyDto,
  type CreateCompanyPayload,
  type UpdateCompanyPayload,
  type DistributorApplicationDto,
  type DistributorApplicationPayload,
  type OemInquiryPayload,
  type OemService,
} from '../../domain/models/company'
import type { CompanyRepository, CompanyQuery, CompanyProductsQuery, DistributorApplicationQuery, OemInquiryDto, OemInquiryQuery } from '../../domain/ports/company-repository'
import type { ProductDto } from '../../domain/models/marketplace'
import type { HttpClient } from '../../infrastructure/http/http-client'
import type {
  CompanyAddressDto,
  CreateCompanyAddressPayload,
  UpdateCompanyAddressPayload,
} from '../../domain/models/address'

export class ApiCompanyRepository implements CompanyRepository {
  constructor(private readonly http: HttpClient) {}

  async getCompanies(query: CompanyQuery = {}): Promise<PaginatedResult<CompanyDto>> {
    return this.fetchCompanyPage(COMPANY_ROUTES.companies, query)
  }

  /** Provider directory — public, works in guest mode.
   *  The backend hard-forces isActive/isProvider/Approved on this route, so
   *  there is nothing to filter client-side and no auth is required. */
  async getProvidersDirectory(query: CompanyQuery = {}): Promise<PaginatedResult<CompanyDto>> {
    return this.fetchCompanyPage(COMPANY_ROUTES.companyDirectory, query)
  }

  private async fetchCompanyPage(base: string, query: CompanyQuery = {}): Promise<PaginatedResult<CompanyDto>> {
    const params = new URLSearchParams()
    if (query.pageNumber) params.set('pageNumber', String(query.pageNumber))
    if (query.pageSize) params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize))))
    if (query.searchTerm) params.set('searchTerm', query.searchTerm)
    const qs = params.toString()
    const raw = await this.http.get<unknown>(qs ? `${base}?${qs}` : base, { showFeedback: false })
    if (Array.isArray(raw)) return { isSuccess: true, data: raw as CompanyDto[], totalCount: raw.length, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200 }
    return raw as PaginatedResult<CompanyDto>
  }

  async getCompanyById(id: string): Promise<CompanyDto> {
    const raw = await this.http.get<unknown>(COMPANY_ROUTES.companyById(id), { showFeedback: false })
    const candidate = (raw && typeof raw === 'object' && 'data' in (raw as Record<string, unknown>)
      ? ((raw as Record<string, unknown>).data ?? (raw as Record<string, unknown>).Data ?? raw)
      : raw) as CompanyDto | null
    if (candidate && typeof candidate === 'object' && 'id' in candidate && (candidate as CompanyDto).id) {
      return candidate as CompanyDto
    }
    throw new Error('Company not found')
  }

  async getCompanyProducts(companyId: string, query: CompanyProductsQuery = {}): Promise<PaginatedResult<ProductDto>> {
    const page = query.page ?? 1
    const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 12))
    const params = new URLSearchParams()
    if (query.categoryId) params.set('categoryId', query.categoryId)
    if (query.search) params.set('SearchTerm', query.search)
    if (query.sku) params.set('Sku', query.sku)
    params.set('pageNumber', String(page))
    params.set('pageSize', String(pageSize))
    const qs = params.toString()
    const raw = await this.http.get<unknown>(`${COMPANY_ROUTES.companyProducts(companyId)}?${qs}`, { showFeedback: false })
    if (Array.isArray(raw)) {
      const items = raw as ProductDto[]
      const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
      return {
        isSuccess: true,
        data: items.slice((page - 1) * pageSize, page * pageSize),
        totalCount: items.length,
        pageNumber: page,
        pageSize,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
        message: 'OK',
        statusCode: 200,
      }
    }
    return raw as PaginatedResult<ProductDto>
  }

  async updateMyCompany(payload: { name: string; email?: string | null; countryId: string; imageName?: string | null }): Promise<CompanyDto> {
    // Always send the full logo state: the backend reads an empty string as
    // "remove the logo" and null as "leave as-is", so omitting the coercion
    // makes it impossible to clear a logo.
    return await this.http.put<CompanyDto>(
      COMPANY_ROUTES.updateMyCompany,
      { ...payload, imageName: payload.imageName ?? '' },
      { showFeedback: false },
    )
  }

  async createCompany(payload: CreateCompanyPayload): Promise<CompanyDto> {
    return await this.http.post<CompanyDto>(COMPANY_ROUTES.companies, payload)
  }

  async updateCompany(id: string, payload: UpdateCompanyPayload): Promise<CompanyDto> {
    return await this.http.put<CompanyDto>(COMPANY_ROUTES.companyById(id), { id, ...payload })
  }

  async deleteCompany(id: string): Promise<void> {
    await this.http.del<void>(COMPANY_ROUTES.companyById(id))
  }

  async getMyCompany(): Promise<CompanyDto | null> {
    const raw = await this.http.get<Record<string, unknown> | null>(`${COMPANY_ROUTES.base}/companies/my`, { showFeedback: false })
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const pick = (...keys: string[]): unknown => {
      for (const k of keys) if (k in raw && raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return raw[k]
      return undefined
    }
    const id = pick('id', 'Id', 'companyId', 'CompanyId') as string | undefined
    // A 401 GET resolves (rather than throws) to a list-shaped empty envelope
    // (`data: []`). Casting that blindly yields a non-null "company" with no
    // id and no status, which the profile renders as a blank organization card
    // labelled "pending". Require a real record.
    if (!id) return null
    return { ...raw, id } as unknown as CompanyDto
  }

  async submitDistributorApplication(payload: DistributorApplicationPayload): Promise<DistributorApplicationDto> {
    return await this.http.post<DistributorApplicationDto>(COMPANY_ROUTES.distributorApplications, payload)
  }

  async getDistributorApplications(query: DistributorApplicationQuery = {}): Promise<PaginatedResult<DistributorApplicationDto>> {
    const params = new URLSearchParams()
    if (query.pageNumber) params.set('pageNumber', String(query.pageNumber))
    if (query.pageSize) params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize))))
    if (query.searchTerm) params.set('searchTerm', query.searchTerm)
    if (typeof query.status === 'number') params.set('status', String(query.status))
    const qs = params.toString()
    const url = qs ? `${COMPANY_ROUTES.distributorApplications}?${qs}` : COMPANY_ROUTES.distributorApplications
    const raw = await this.http.get<unknown>(url, { showFeedback: false })
    if (Array.isArray(raw)) {
      return {
        isSuccess: true,
        data: raw as DistributorApplicationDto[],
        totalCount: raw.length,
        pageNumber: query.pageNumber ?? 1,
        pageSize: query.pageSize ?? 10,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
        message: 'OK',
        statusCode: 200,
      }
    }
    if (raw && typeof raw === 'object' && 'data' in raw) {
      return raw as PaginatedResult<DistributorApplicationDto>
    }
    return raw as PaginatedResult<DistributorApplicationDto>
  }

  async getDistributorApplicationById(id: string): Promise<DistributorApplicationDto> {
    return await this.http.get<DistributorApplicationDto>(COMPANY_ROUTES.distributorApplicationById(id), { showFeedback: false })
  }

  async approveDistributorApplication(id: string, payload: { accountManagerId?: string | null } = {}): Promise<DistributorApplicationDto> {
    return await this.http.put<DistributorApplicationDto>(COMPANY_ROUTES.approveDistributorApplication(id), payload, { showFeedback: false })
  }

  async rejectDistributorApplication(id: string, payload: { reason?: string } = {}): Promise<DistributorApplicationDto> {
    return await this.http.put<DistributorApplicationDto>(COMPANY_ROUTES.rejectDistributorApplication(id), payload, { showFeedback: false })
  }

  async getOemServices(): Promise<OemService[]> {
    return []
  }

  async submitOemInquiry(payload: OemInquiryPayload): Promise<void> {
    await this.http.post<void>(COMPANY_ROUTES.oemInquiries, payload)
  }

  async getOemInquiries(query: OemInquiryQuery = {}): Promise<PaginatedResult<OemInquiryDto>> {
    const params = new URLSearchParams()
    if (query.pageNumber) params.set('pageNumber', String(query.pageNumber))
    if (query.pageSize) params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize))))
    if (query.searchTerm) params.set('searchTerm', query.searchTerm)
    const qs = params.toString()
    const raw = await this.http.get<unknown>(qs ? `${COMPANY_ROUTES.oemInquiries}?${qs}` : COMPANY_ROUTES.oemInquiries, { showFeedback: false })
    if (Array.isArray(raw)) return { isSuccess: true, data: raw as OemInquiryDto[], totalCount: raw.length, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200 }
    return raw as PaginatedResult<OemInquiryDto>
  }

  async getOemInquiryById(id: string): Promise<OemInquiryDto> {
    return await this.http.get<OemInquiryDto>(COMPANY_ROUTES.oemInquiryById(id), { showFeedback: false })
  }

  async deleteOemInquiry(id: string): Promise<void> {
    await this.http.del<void>(COMPANY_ROUTES.oemInquiryById(id), { showFeedback: false })
  }


  private extractCompanyAddrArray(raw: unknown): CompanyAddressDto[] {
    if (Array.isArray(raw)) return raw as CompanyAddressDto[]
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      if (Array.isArray(obj.data)) return obj.data as CompanyAddressDto[]
      if (Array.isArray(obj.Data)) return obj.Data as CompanyAddressDto[]
    }
    return []
  }

  async getCompanyAddresses(companyId: string): Promise<CompanyAddressDto[]> {
    const raw = await this.http.get<unknown>(COMPANY_ROUTES.companyAddresses(companyId), { showFeedback: false })
    return this.extractCompanyAddrArray(raw as unknown)
  }

  async createCompanyAddress(payload: CreateCompanyAddressPayload): Promise<CompanyAddressDto> {
    return await this.http.post<CompanyAddressDto>(COMPANY_ROUTES.companyAddresses(payload.companyId), payload, { showFeedback: false })
  }

  async updateCompanyAddress(addressId: string, payload: UpdateCompanyAddressPayload & { companyId?: string }): Promise<CompanyAddressDto> {
    const companyId = payload.companyId
    const path = companyId
      ? COMPANY_ROUTES.companyAddressById(companyId, addressId)
      : COMPANY_ROUTES.companyAddressDirect(addressId)
    return await this.http.put<CompanyAddressDto>(path, { id: addressId, ...payload }, { showFeedback: false })
  }

  async deleteCompanyAddress(addressId: string, companyId?: string): Promise<void> {
    const path = companyId
      ? COMPANY_ROUTES.companyAddressById(companyId, addressId)
      : COMPANY_ROUTES.companyAddressDirect(addressId)
    return await this.http.del<void>(path, { showFeedback: false })
  }
}
