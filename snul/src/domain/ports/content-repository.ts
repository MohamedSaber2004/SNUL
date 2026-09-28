import type { PaginatedResult } from '../models/location'
import type {
  DocumentDto,
  DocumentQuery,
  FaqItemDto,
  HelpArticleDto,
  HelpCategoryDto,
  LandingPageDto,
  LandingPageQuery,
  CreateDocumentPayload,
  CreateLandingPagePayload,
  UpdateLandingPagePayload,
  SupportTicketDto,
  SupportContactDto,
  UpdateSupportContactPayload,
  HelpSiteStatDto,
  UpsertHelpSiteStatPayload,
  SiteLogoDto,
  UpsertSiteLogoPayload,
} from '../models/content'

export interface ContentRepository {
  getDocuments(query?: DocumentQuery): Promise<PaginatedResult<DocumentDto>>
  createDocument(payload: CreateDocumentPayload): Promise<DocumentDto>
  deleteDocument(id: string): Promise<void>
  getLandingPages(query?: LandingPageQuery): Promise<PaginatedResult<LandingPageDto>>
  getLandingPageBySlug(slug: string): Promise<LandingPageDto | null>
  createLandingPage(payload: CreateLandingPagePayload): Promise<LandingPageDto>
  updateLandingPage(id: string, payload: UpdateLandingPagePayload): Promise<LandingPageDto>
  deleteLandingPage(id: string): Promise<void>
  getHelpCategories(): Promise<HelpCategoryDto[]>
  createHelpCategory(payload: { name: string; icon?: string }): Promise<HelpCategoryDto>
  updateHelpCategory(id: string, payload: { name: string; icon?: string; isActive?: boolean }): Promise<HelpCategoryDto>
  deleteHelpCategory(id: string): Promise<void>
  getHelpArticles(categoryId?: string): Promise<HelpArticleDto[]>
  createHelpArticle(payload: { categoryId: string; title: string; body: string; slug: string }): Promise<HelpArticleDto>
  updateHelpArticle(id: string, payload: { categoryId: string; title: string; body: string; slug: string; isActive?: boolean }): Promise<HelpArticleDto>
  deleteHelpArticle(id: string): Promise<void>
  getFaqs(): Promise<FaqItemDto[]>
  createFaq(payload: { question: string; answer: string; sortOrder?: number }): Promise<FaqItemDto>
  updateFaq(id: string, payload: { question: string; answer: string; sortOrder?: number; isActive?: boolean }): Promise<FaqItemDto>
  deleteFaq(id: string): Promise<void>
  getMyTickets(): Promise<SupportTicketDto[]>
  getTickets(params?: { pageNumber?: number; pageSize?: number; status?: string; searchTerm?: string }): Promise<SupportTicketDto[]>
  createTicket(payload: { subject: string; message: string }): Promise<SupportTicketDto>
  replyTicket(id: string, reply: string): Promise<SupportTicketDto>
  closeTicket(id: string): Promise<SupportTicketDto>
  getSupportContact(): Promise<SupportContactDto>
  updateSupportContact(payload: UpdateSupportContactPayload): Promise<SupportContactDto>
  /** Visible-only, ordered by SortOrder. Resolves to `[]` when unavailable. */
  getHelpSiteStats(): Promise<HelpSiteStatDto[]>
  createHelpSiteStat(payload: UpsertHelpSiteStatPayload): Promise<HelpSiteStatDto>
  updateHelpSiteStat(id: string, payload: UpsertHelpSiteStatPayload): Promise<HelpSiteStatDto>
  deleteHelpSiteStat(id: string): Promise<void>
  getSiteLogo(): Promise<SiteLogoDto>
  upsertSiteLogo(payload: UpsertSiteLogoPayload): Promise<SiteLogoDto>
}
