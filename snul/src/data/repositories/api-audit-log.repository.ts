import { COMPANY_ROUTES } from '../../config/api.config'
import type { PaginatedResult } from '../../domain/models/location'
import type { AuditLogDto, AuditLogQuery } from '../../domain/models/audit-log'
import type { AuditLogRepository } from '../../domain/ports/audit-log-repository'
import type { HttpClient } from '../../infrastructure/http/http-client'

export class ApiAuditLogRepository implements AuditLogRepository {
  constructor(private readonly http: HttpClient) {}

  async getAuditLogs(query: AuditLogQuery = {}): Promise<PaginatedResult<AuditLogDto>> {
    const params = new URLSearchParams()
    if (query.pageNumber) params.set('pageNumber', String(query.pageNumber))
    if (query.pageSize) params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize))))
    if (query.entityName) params.set('entityName', query.entityName)
    if (query.action) params.set('action', query.action)
    if (query.performedBy) params.set('performedBy', query.performedBy)
    if (query.startDate) params.set('startDate', query.startDate)
    if (query.endDate) params.set('endDate', query.endDate)
    if (query.searchTerm) params.set('searchTerm', query.searchTerm)
    const qs = params.toString()
    const raw = await this.http.get<unknown>(qs ? `${COMPANY_ROUTES.auditLogs}?${qs}` : COMPANY_ROUTES.auditLogs, { showFeedback: false })
    if (Array.isArray(raw)) {
      return {
        isSuccess: true,
        data: raw as AuditLogDto[],
        totalCount: raw.length,
        pageNumber: query.pageNumber ?? 1,
        pageSize: query.pageSize ?? 20,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
        message: 'OK',
        statusCode: 200,
      }
    }
    return raw as PaginatedResult<AuditLogDto>
  }

  async getAuditLogById(id: string): Promise<AuditLogDto> {
    return await this.http.get<AuditLogDto>(COMPANY_ROUTES.auditLogById(id), { showFeedback: false })
  }
}
