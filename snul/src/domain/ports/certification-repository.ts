import type { PaginatedResult } from '../models/location'
import type {
  CertificationDto,
  CertificationQuery,
  CreateCertificationPayload,
  UpdateCertificationPayload,
} from '../models/certification'

export interface CertificationRepository {
  getCertifications(query?: CertificationQuery): Promise<PaginatedResult<CertificationDto>>
  createCertification(payload: CreateCertificationPayload): Promise<CertificationDto>
  updateCertification(id: string, payload: UpdateCertificationPayload): Promise<CertificationDto>
  deleteCertification(id: string): Promise<void>
}
