import type { AuditLogDto, AuditLogQuery } from '../models/audit-log'
import type { PaginatedResult } from '../models/location'

export interface AuditLogRepository {
  getAuditLogs(query: AuditLogQuery): Promise<PaginatedResult<AuditLogDto>>
  getAuditLogById(id: string): Promise<AuditLogDto>
}
