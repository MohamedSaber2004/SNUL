import type { PaginatedResult } from '../models/location'
import type {
  CompanyDto,
  CreateCompanyPayload,
  UpdateCompanyPayload,
  DistributorApplicationDto,
  DistributorApplicationPayload,
  OemInquiryPayload,
  OemService,
} from '../models/company'
import type {
  CompanyAddressDto,
  CreateCompanyAddressPayload,
  UpdateCompanyAddressPayload,
} from '../models/address'
import type { ProductDto } from '../models/marketplace'

export interface CompanyQuery {
  pageNumber?: number
  pageSize?: number
  searchTerm?: string
}

export interface DistributorApplicationQuery {
  pageNumber?: number
  pageSize?: number
  searchTerm?: string
  status?: number
}

export interface OemInquiryDto {
  id: string
  fullName: string
  email: string
  companyName: string
  serviceType: string
  message: string
  createdAt: string
}

export type OemInquiryQuery = CompanyQuery

export interface CompanyProductsQuery {
  categoryId?: string
  search?: string
  sku?: string
  page?: number
  pageSize?: number
}

export interface CompanyRepository {
  getCompanies(query?: CompanyQuery): Promise<PaginatedResult<CompanyDto>>
  getProvidersDirectory(query?: CompanyQuery): Promise<PaginatedResult<CompanyDto>>
  getCompanyById(id: string): Promise<CompanyDto>
  getMyCompany(): Promise<CompanyDto | null>
  getCompanyProducts(companyId: string, query?: CompanyProductsQuery): Promise<PaginatedResult<ProductDto>>
  createCompany(payload: CreateCompanyPayload): Promise<CompanyDto>
  updateCompany(id: string, payload: UpdateCompanyPayload): Promise<CompanyDto>
  deleteCompany(id: string): Promise<void>
  submitDistributorApplication(payload: DistributorApplicationPayload): Promise<DistributorApplicationDto>
  getDistributorApplications(query?: DistributorApplicationQuery): Promise<PaginatedResult<DistributorApplicationDto>>
  getDistributorApplicationById(id: string): Promise<DistributorApplicationDto>
  approveDistributorApplication(id: string, payload?: { accountManagerId?: string | null }): Promise<DistributorApplicationDto>
  rejectDistributorApplication(id: string, payload?: { reason?: string }): Promise<DistributorApplicationDto>
  getOemServices(): Promise<OemService[]>
  submitOemInquiry(payload: OemInquiryPayload): Promise<void>
  getOemInquiries(query?: OemInquiryQuery): Promise<PaginatedResult<OemInquiryDto>>
  getOemInquiryById(id: string): Promise<OemInquiryDto>
  deleteOemInquiry(id: string): Promise<void>

  getCompanyAddresses(companyId: string): Promise<CompanyAddressDto[]>
  createCompanyAddress(payload: CreateCompanyAddressPayload): Promise<CompanyAddressDto>
  updateCompanyAddress(addressId: string, payload: UpdateCompanyAddressPayload & { companyId?: string }): Promise<CompanyAddressDto>
  deleteCompanyAddress(addressId: string, companyId?: string): Promise<void>
}
