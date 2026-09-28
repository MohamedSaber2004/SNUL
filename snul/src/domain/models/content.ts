export type LandingPageType = 'Brand' | 'Specialty' | 'Procedure'

export interface DocumentDto {
  id: string
  title: string
  docType: string
  fileUrl: string
  fileSizeKB: number
  productId?: string | null
  publishedDate: string
}

export interface CreateDocumentPayload {
  title: string
  docType: string
  fileUrl: string
  fileSizeKB?: number
  productId?: string | null
  publishedDate?: string
}

export interface LandingPageDto {
  id: string
  type: LandingPageType
  slug: string
  heroTitle: string
  heroBody?: string
  contentBlock?: string | null
  isActive?: boolean
  categoryId?: string
  categoryName?: string
  procedure?: string
  relatedCategoryIds?: string[]
  relatedProductIds?: string[]
  featuredProductIds?: string[]
  createdAt: string
}

export interface CreateLandingPagePayload {
  type: string
  slug: string
  heroTitle: string
  heroBody?: string
  contentBlock?: string | null
}

export interface UpdateLandingPagePayload {
  type: string
  slug: string
  heroTitle: string
  heroBody?: string
  contentBlock?: string | null
  isActive?: boolean
}

export interface HelpCategoryDto {
  id: string
  name: string
  /** Arabic name. Nullable on the API; absent until the help model ships it. */
  nameAr?: string | null
  icon: string
  articleCount?: number
  isActive?: boolean
}

export interface HelpArticleDto {
  id: string
  categoryId: string
  title: string
  body: string
  /** Arabic title/body. Nullable on the API; see utils/help-localize. */
  titleAr?: string | null
  bodyAr?: string | null
  slug: string
  isActive?: boolean
}

export interface FaqItemDto {
  id: string
  question: string
  answer: string
  /** Arabic question/answer. Nullable on the API; see utils/help-localize. */
  questionAr?: string | null
  answerAr?: string | null
  sortOrder?: number
  isActive?: boolean
}

export interface SupportTicketDto {
  id: string
  userId: string
  subject: string
  message: string
  status: string
  reply?: string | null
  createdAt: string
  repliedAt?: string | null
}

export interface DocumentQuery {
  pageNumber?: number
  pageSize?: number
  searchTerm?: string
  docType?: string
}

export interface LandingPageQuery {
  pageNumber?: number
  pageSize?: number
  type?: string
}

export interface SupportContactDto {
  id?: string
  supportEmail: string
  phoneNumber: string
  whatsAppNumber: string
  workingHours?: string
  updatedAt?: string
}

export interface UpdateSupportContactPayload {
  supportEmail: string
  phoneNumber: string
  whatsAppNumber: string
  workingHours?: string
}

/**
 * A business claim shown in the Help Center hero (the SLA badge and the
 * telemetry figures).
 *
 * `statKey` is a stable contract owned by the backend, not by this file: the
 * hero treats the `slaBadge` key as the image badge and every other key as a
 * telemetry metric, so an unrecognised key renders as an extra metric rather
 * than disappearing. `label` is optional because the badge publishes a `value`
 * with no caption.
 */
export interface HelpSiteStatDto {
  id: string
  statKey: string
  value: string
  /** Caption under the figure. Unused by the badge. */
  label?: string | null
  /** Arabic caption. Nullable on the API; see utils/help-localize. */
  labelAr?: string | null
  sortOrder?: number
  isVisible?: boolean
}

export interface UpsertHelpSiteStatPayload {
  statKey: string
  value: string
  label?: string
  labelAr?: string
  sortOrder?: number
  isVisible?: boolean
}

export interface SiteLogoDto {
  id: string
  logoUrl: string
  altText: string
  updatedAt?: string
}

export interface UpsertSiteLogoPayload {
  logoUrl: string
  altText?: string
}
