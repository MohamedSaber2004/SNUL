export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGOUT' | 'ASSIGN' | 'STATUS_CHANGE' | 'UPLOAD' | 'DOWNLOAD'

export interface AuditLogDto {
  id: string
  entityName: string
  entityId: string
  action: AuditAction
  performedBy: string
  performedById?: string
  ipAddress?: string
  userAgent?: string
  details?: string
  createdAt: string
}

export interface AuditLogQuery {
  pageNumber?: number
  pageSize?: number
  entityName?: string
  action?: string
  performedBy?: string
  startDate?: string
  endDate?: string
  searchTerm?: string
}
