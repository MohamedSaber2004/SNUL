export interface ApiEnvelope<T> {
  success: boolean
  errors: Record<string, string[]> | null
  data: T | null
  message: string | null
  statusCode: number
}

export class ApiError extends Error {
  readonly status: number
  readonly errors: Record<string, string[]>
  readonly silent: boolean

  constructor(status: number, message: string, errors: Record<string, string[]> = {}, silent = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
    this.silent = silent
  }
}

export const GENERIC_OK_MESSAGES = new Set([
  'Operation completed successfully',
  'تمت العملية بنجاح',
  'DistributorApplication.Approved',
  'DistributorApplication.Rejected',
  'DistributorApplication.Created',
  'Distributor application approved successfully.',
  'تمت الموافقة على طلب التوزيع بنجاح.',
  'SiteLogo.Updated',
  'SiteLogo.Fetched',
  'Updated',
])
