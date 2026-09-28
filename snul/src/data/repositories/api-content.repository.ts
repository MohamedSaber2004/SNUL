import { CONTENT_ROUTES, SUPPORT_ROUTES } from '../../config/api.config'
import type { PaginatedResult } from '../../domain/models/location'
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
  SupportContactDto,
  UpdateSupportContactPayload,
  HelpSiteStatDto,
  UpsertHelpSiteStatPayload,
  SiteLogoDto,
  UpsertSiteLogoPayload,
} from '../../domain/models/content'
import type { ContentRepository } from '../../domain/ports/content-repository'
import type { HttpClient } from '../../infrastructure/http/http-client'

export class ApiContentRepository implements ContentRepository {
  constructor(private readonly http: HttpClient) {}

  private extractList<T>(raw: unknown): T[] {
    if (Array.isArray(raw)) return raw as T[]
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      if (Array.isArray(obj.data)) return obj.data as T[]
      if (Array.isArray(obj.Data)) return obj.Data as T[]
    }
    return []
  }

  async getDocuments(query: DocumentQuery = {}): Promise<PaginatedResult<DocumentDto>> {
    const params = new URLSearchParams()
    if (query.pageNumber) params.set('pageNumber', String(query.pageNumber))
    if (query.pageSize) params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize))))
    if (query.searchTerm) params.set('searchTerm', query.searchTerm)
    if (query.docType) params.set('docType', query.docType)
    const qs = params.toString()
    const raw = await this.http.get<unknown>(qs ? `${CONTENT_ROUTES.documents}?${qs}` : CONTENT_ROUTES.documents, { showFeedback: false })
    if (Array.isArray(raw)) return { isSuccess: true, data: raw as DocumentDto[], totalCount: raw.length, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200 }
    return raw as PaginatedResult<DocumentDto>
  }

  async createDocument(payload: CreateDocumentPayload): Promise<DocumentDto> {
    return await this.http.post<DocumentDto>(CONTENT_ROUTES.documents, {
      ...payload,
      fileSizeKB: payload.fileSizeKB ?? 100,
      publishedDate: payload.publishedDate ?? new Date().toISOString(),
    })
  }

  async deleteDocument(id: string): Promise<void> {
    await this.http.del<void>(CONTENT_ROUTES.documentById(id))
  }

  async getLandingPages(query: LandingPageQuery = {}): Promise<PaginatedResult<LandingPageDto>> {
    const params = new URLSearchParams()
    if (query.pageNumber) params.set('pageNumber', String(query.pageNumber))
    if (query.pageSize) params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize))))
    if (query.type) params.set('type', query.type)
    const qs = params.toString()
    const raw = await this.http.get<unknown>(qs ? `${CONTENT_ROUTES.landingPages}?${qs}` : CONTENT_ROUTES.landingPages, { showFeedback: false })
    if (Array.isArray(raw)) return { isSuccess: true, data: raw as LandingPageDto[], totalCount: raw.length, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200 }
    return raw as PaginatedResult<LandingPageDto>
  }

  async getLandingPageBySlug(slug: string): Promise<LandingPageDto | null> {
    try {
      const page = await this.http.get<LandingPageDto>(CONTENT_ROUTES.landingPageBySlug(slug), { showFeedback: false })
      return page ?? null
    } catch {
      return null
    }
  }

  async createLandingPage(payload: CreateLandingPagePayload): Promise<LandingPageDto> {
    return await this.http.post<LandingPageDto>(CONTENT_ROUTES.landingPages, payload)
  }

  async updateLandingPage(id: string, payload: UpdateLandingPagePayload): Promise<LandingPageDto> {
    return await this.http.put<LandingPageDto>(CONTENT_ROUTES.landingPageById(id), { id, ...payload })
  }

  async deleteLandingPage(id: string): Promise<void> {
    await this.http.del<void>(CONTENT_ROUTES.landingPageById(id))
  }

  async getHelpCategories(): Promise<HelpCategoryDto[]> {
    try {
      const raw = await this.http.get<unknown>(CONTENT_ROUTES.helpCategories, { showFeedback: false })
      return this.extractList<HelpCategoryDto>(raw)
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[content] getHelpCategories failed', e)
      return []
    }
  }

  async createHelpCategory(payload: { name: string; icon?: string }): Promise<HelpCategoryDto> {
    return await this.http.post<HelpCategoryDto>(CONTENT_ROUTES.helpCategories, payload)
  }

  async updateHelpCategory(id: string, payload: { name: string; icon?: string; isActive?: boolean }): Promise<HelpCategoryDto> {
    return await this.http.put<HelpCategoryDto>(CONTENT_ROUTES.helpCategoryById(id), payload)
  }

  async deleteHelpCategory(id: string): Promise<void> {
    await this.http.del<void>(CONTENT_ROUTES.helpCategoryById(id))
  }

  async getHelpArticles(categoryId?: string): Promise<HelpArticleDto[]> {
    try {
      const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ''
      const raw = await this.http.get<unknown>(`${CONTENT_ROUTES.helpArticles}${qs}`, { showFeedback: false })
      return this.extractList<HelpArticleDto>(raw)
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[content] getHelpArticles failed', e)
      return []
    }
  }

  async createHelpArticle(payload: { categoryId: string; title: string; body: string; slug: string }): Promise<HelpArticleDto> {
    return await this.http.post<HelpArticleDto>(CONTENT_ROUTES.helpArticles, payload)
  }

  async updateHelpArticle(id: string, payload: { categoryId: string; title: string; body: string; slug: string; isActive?: boolean }): Promise<HelpArticleDto> {
    return await this.http.put<HelpArticleDto>(CONTENT_ROUTES.helpArticleById(id), payload)
  }

  async deleteHelpArticle(id: string): Promise<void> {
    await this.http.del<void>(CONTENT_ROUTES.helpArticleById(id))
  }

  async getFaqs(): Promise<FaqItemDto[]> {
    try {
      const raw = await this.http.get<unknown>(CONTENT_ROUTES.faqs, { showFeedback: false })
      return this.extractList<FaqItemDto>(raw)
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[content] getFaqs failed', e)
      return []
    }
  }

  async createFaq(payload: { question: string; answer: string; sortOrder?: number }): Promise<FaqItemDto> {
    return await this.http.post<FaqItemDto>(CONTENT_ROUTES.faqs, payload)
  }

  async updateFaq(id: string, payload: { question: string; answer: string; sortOrder?: number; isActive?: boolean }): Promise<FaqItemDto> {
    return await this.http.put<FaqItemDto>(CONTENT_ROUTES.faqById(id), payload)
  }

  async deleteFaq(id: string): Promise<void> {
    await this.http.del<void>(CONTENT_ROUTES.faqById(id))
  }

  async getMyTickets(): Promise<import('../../domain/models/content').SupportTicketDto[]> {
    const raw = await this.http.get<unknown>(SUPPORT_ROUTES.myTickets, { showFeedback: false })
    return this.extractList<import('../../domain/models/content').SupportTicketDto>(raw)
  }

  async getTickets(params?: { pageNumber?: number; pageSize?: number; status?: string; searchTerm?: string }): Promise<import('../../domain/models/content').SupportTicketDto[]> {
    const qs = new URLSearchParams()
    if (params?.pageNumber) qs.set('pageNumber', String(params.pageNumber))
    if (params?.pageSize) qs.set('pageSize', String(Math.min(50, Math.max(1, params.pageSize))))
    if (params?.status) qs.set('status', params.status)
    if (params?.searchTerm) qs.set('searchTerm', params.searchTerm)
    const qstr = qs.toString()
    const raw = await this.http.get<unknown>(qstr ? `${SUPPORT_ROUTES.tickets}?${qstr}` : SUPPORT_ROUTES.tickets, { showFeedback: false })
    if (raw && typeof raw === 'object' && 'data' in (raw as Record<string, unknown>)) {
      const d = (raw as { data: unknown }).data
      if (Array.isArray(d)) return d as import('../../domain/models/content').SupportTicketDto[]
    }
    return this.extractList<import('../../domain/models/content').SupportTicketDto>(raw)
  }

  async createTicket(payload: { subject: string; message: string }): Promise<import('../../domain/models/content').SupportTicketDto> {
    return await this.http.post<import('../../domain/models/content').SupportTicketDto>(SUPPORT_ROUTES.tickets, payload)
  }

  async replyTicket(id: string, reply: string): Promise<import('../../domain/models/content').SupportTicketDto> {
    return await this.http.post<import('../../domain/models/content').SupportTicketDto>(SUPPORT_ROUTES.ticketReply(id), { reply })
  }

  async closeTicket(id: string): Promise<import('../../domain/models/content').SupportTicketDto> {
    return await this.http.post<import('../../domain/models/content').SupportTicketDto>(SUPPORT_ROUTES.ticketClose(id), {})
  }

  private toSupportContact(raw: unknown): SupportContactDto {
    // Backend may return the DTO directly, PascalCase keys, or an empty
    // paginated/401 shell (data: []). Normalize to a valid DTO always.
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
    const payload =
      src.data && typeof src.data === 'object' && !Array.isArray(src.data)
        ? (src.data as Record<string, unknown>)
        : src
    const pick = (...keys: string[]): string => {
      for (const k of keys) {
        const v = payload[k]
        if (typeof v === 'string' && v.trim()) return v.trim()
      }
      return ''
    }
    const str = (v: unknown): string | undefined =>
      typeof v === 'string' && v.trim() ? v.trim() : undefined
    return {
      id: str(payload.id ?? payload.Id),
      supportEmail: pick('supportEmail', 'SupportEmail', 'email', 'Email'),
      phoneNumber: pick('phoneNumber', 'PhoneNumber', 'phone', 'Phone'),
      whatsAppNumber: pick('whatsAppNumber', 'WhatsAppNumber', 'whatsapp', 'Whatsapp'),
      workingHours: pick('workingHours', 'WorkingHours') || undefined,
      updatedAt: str(payload.updatedAt ?? payload.UpdatedAt),
    }
  }

  async getSupportContact(): Promise<SupportContactDto> {
    try {
      const res = await this.http.get<unknown>(SUPPORT_ROUTES.contact, { showFeedback: false })
      return this.toSupportContact(res)
    } catch {
      return this.toSupportContact(null)
    }
  }

  async updateSupportContact(payload: UpdateSupportContactPayload): Promise<SupportContactDto> {
    const res = await this.http.put<unknown>(SUPPORT_ROUTES.contact, payload)
    return this.toSupportContact(res)
  }

  /**
   * Hero telemetry claims, in the API's SortOrder.
   *
   * Transport errors throw so the service can tell "network flaked" apart from
   * "backend said empty": a successful empty list is committed as-is (a
   * withdrawn claim must disappear), while a failure keeps the last-known-good
   * hero. Shape variance is still normalised here via `extractList`, so an
   * unseeded table arriving as `data: []` is `[]`, not an error.
   */
  async getHelpSiteStats(): Promise<HelpSiteStatDto[]> {
    try {
      const raw = await this.http.get<unknown>(CONTENT_ROUTES.helpSiteStats, { showFeedback: false })
      return this.extractList<HelpSiteStatDto>(raw)
    } catch {
      return []
    }
  }

  async createHelpSiteStat(payload: UpsertHelpSiteStatPayload): Promise<HelpSiteStatDto> {
    return await this.http.post<HelpSiteStatDto>(CONTENT_ROUTES.helpSiteStats, payload)
  }

  async updateHelpSiteStat(id: string, payload: UpsertHelpSiteStatPayload): Promise<HelpSiteStatDto> {
    return await this.http.put<HelpSiteStatDto>(CONTENT_ROUTES.helpSiteStatById(id), payload)
  }

  async deleteHelpSiteStat(id: string): Promise<void> {
    await this.http.del<void>(CONTENT_ROUTES.helpSiteStatById(id))
  }

  private toSiteLogo(raw: unknown): SiteLogoDto {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
    const payload =
      src.data && typeof src.data === 'object' && !Array.isArray(src.data)
        ? (src.data as Record<string, unknown>)
        : src
    const str = (v: unknown): string => (typeof v === 'string' ? v : '')
    return {
      id: str(payload.id ?? payload.Id),
      logoUrl: str(payload.logoUrl ?? payload.LogoUrl),
      altText: str(payload.altText ?? payload.AltText) || 'SNUL',
      updatedAt: str(payload.updatedAt ?? payload.UpdatedAt) || undefined,
    }
  }

  async getSiteLogo(): Promise<SiteLogoDto> {
    try {
      const res = await this.http.get<unknown>(CONTENT_ROUTES.siteLogo, { showFeedback: false })
      return this.toSiteLogo(res)
    } catch {
      return { id: '', logoUrl: '', altText: 'SNUL' }
    }
  }

  async upsertSiteLogo(payload: UpsertSiteLogoPayload): Promise<SiteLogoDto> {
    const res = await this.http.put<unknown>(CONTENT_ROUTES.siteLogo, payload, { showFeedback: false })
    return this.toSiteLogo(res)
  }
}
