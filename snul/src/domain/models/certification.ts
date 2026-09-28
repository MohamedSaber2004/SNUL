export interface CertificationDto {
  id: string
  certificateNumber: string
  title: string
  issuedTo: string
  issuer: string
  issueDate: string
  expiryDate?: string | null
  description?: string | null
  certificationImageName?: string | null
  isActive: boolean
  createdAt: string
}

export interface CertificationQuery {
  pageNumber?: number
  pageSize?: number
  searchTerm?: string
  isActive?: boolean
}

export interface CreateCertificationPayload {
  certificateNumber: string
  title: string
  issuedTo: string
  issuer: string
  issueDate: string
  expiryDate?: string | null
  description?: string | null
  certificationImageName?: string | null
}

export interface UpdateCertificationPayload {
  certificateNumber: string
  title: string
  issuedTo: string
  issuer: string
  issueDate: string
  expiryDate?: string | null
  description?: string | null
  certificationImageName?: string | null
  isActive?: boolean
}

