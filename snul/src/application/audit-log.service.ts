import { ref } from 'vue'
import { t } from '../i18n'
import type { AuditLogDto, AuditLogQuery } from '../domain/models/audit-log'
import type { AuditLogRepository } from '../domain/ports/audit-log-repository'

export class AuditLogService {
  readonly logs = ref<AuditLogDto[]>([])
  readonly loading = ref(false)
  readonly error = ref<string | null>(null)
  readonly page = ref(1)
  readonly pageSize = ref(20)
  readonly totalCount = ref(0)
  readonly totalPages = ref(1)

  private readonly repo: AuditLogRepository

  constructor(repo: AuditLogRepository) {
    this.repo = repo
  }

  async loadLogs(query: AuditLogQuery = {}): Promise<void> {
    this.loading.value = true
    this.error.value = null
    try {
      const pageNumber = query.pageNumber ?? this.page.value
      const pageSize = query.pageSize ?? this.pageSize.value
      const res = await this.repo.getAuditLogs({ ...query, pageNumber, pageSize })
      this.logs.value = res.data ?? []
      this.totalCount.value = res.totalCount ?? this.logs.value.length
      this.totalPages.value = res.totalPages ?? 1
    } catch (e) {
      this.error.value = e instanceof Error ? e.message : t('common.loadFailed')
      this.logs.value = []
    } finally {
      this.loading.value = false
    }
  }

  async getLogById(id: string): Promise<AuditLogDto | null> {
    try {
      return await this.repo.getAuditLogById(id)
    } catch {
      return null
    }
  }

  setPage(p: number) {
    this.page.value = p
  }

  setPageSize(size: number) {
    this.pageSize.value = size
    this.page.value = 1
  }
}
