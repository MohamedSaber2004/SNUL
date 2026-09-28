import { CERTIFICATION_ROUTES } from '../../config/api.config'
import type { PaginatedResult } from '../../domain/models/location'
import type {
  CertificationDto,
  CertificationQuery,
  CreateCertificationPayload,
  UpdateCertificationPayload,
} from '../../domain/models/certification'
import type { CertificationRepository } from '../../domain/ports/certification-repository'
import type { HttpClient } from '../../infrastructure/http/http-client'

export class ApiCertificationRepository implements CertificationRepository {
  constructor(private readonly http: HttpClient) {}

  async getCertifications(query: CertificationQuery = {}): Promise<PaginatedResult<CertificationDto>> {
    const params = new URLSearchParams()
    if (query.pageNumber) params.set('pageNumber', String(query.pageNumber))
    if (query.pageSize) params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize))))
    if (query.searchTerm) params.set('searchTerm', query.searchTerm)
    if (typeof query.isActive === 'boolean') params.set('isActive', String(query.isActive))
    const qs = params.toString()
    const raw = await this.http.get<unknown>(qs ? `${CERTIFICATION_ROUTES.certifications}?${qs}` : CERTIFICATION_ROUTES.certifications, { showFeedback: false })
    if (Array.isArray(raw)) return { isSuccess: true, data: raw as CertificationDto[], totalCount: raw.length, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200 }
    return raw as PaginatedResult<CertificationDto>
  }

  async createCertification(payload: CreateCertificationPayload): Promise<CertificationDto> {
    return await this.http.post<CertificationDto>(CERTIFICATION_ROUTES.certifications, payload)
  }

  async updateCertification(id: string, payload: UpdateCertificationPayload): Promise<CertificationDto> {
    return await this.http.put<CertificationDto>(CERTIFICATION_ROUTES.certificationById(id), { id, ...payload })
  }

  async deleteCertification(id: string): Promise<void> {
    await this.http.del<void>(CERTIFICATION_ROUTES.certificationById(id))
  }
}
