import { ref } from 'vue'
import type {
  CertificationDto,
  CreateCertificationPayload,
  UpdateCertificationPayload,
} from '../domain/models/certification'
import type { CertificationRepository } from '../domain/ports/certification-repository'

export class CertificationService {
  readonly certifications = ref<CertificationDto[]>([])
  readonly loading = ref(false)

  private readonly repo: CertificationRepository

  constructor(repo: CertificationRepository) {
    this.repo = repo
  }

  async load(pageSize = 10, onlyActive = false): Promise<void> {
    this.loading.value = true
    try {
      const res = await this.repo.getCertifications({
        pageNumber: 1,
        pageSize,
        ...(onlyActive ? { isActive: true } : {}),
      })
      this.certifications.value = res.data ?? []
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[certification] load failed', e)
    } finally {
      this.loading.value = false
    }
  }

  async createCertification(payload: CreateCertificationPayload): Promise<CertificationDto> {
    const created = await this.repo.createCertification(payload)
    this.certifications.value.unshift(created)
    return created
  }

  async updateCertification(id: string, payload: UpdateCertificationPayload): Promise<CertificationDto> {
    const updated = await this.repo.updateCertification(id, payload)
    const idx = this.certifications.value.findIndex((c) => c.id === id)
    if (idx !== -1) {
      this.certifications.value[idx] = updated
    }
    return updated
  }

  async deleteCertification(id: string): Promise<void> {
    await this.repo.deleteCertification(id)
    this.certifications.value = this.certifications.value.filter((c) => c.id !== id)
  }
}
