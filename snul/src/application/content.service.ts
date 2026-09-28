import { ref } from 'vue'
import type {
  DocumentDto,
  FaqItemDto,
  HelpArticleDto,
  HelpCategoryDto,
  LandingPageDto,
  CreateDocumentPayload,
  SupportContactDto,
  UpdateSupportContactPayload,
  HelpSiteStatDto,
  UpsertHelpSiteStatPayload,
  SiteLogoDto,
  UpsertSiteLogoPayload,
} from '../domain/models/content'
import type { ContentRepository } from '../domain/ports/content-repository'

export class ContentService {
  readonly documents = ref<DocumentDto[]>([])
  readonly helpCategories = ref<HelpCategoryDto[]>([])
  readonly helpArticles = ref<HelpArticleDto[]>([])
  readonly faqs = ref<FaqItemDto[]>([])
  readonly tickets = ref<import('../domain/models/content').SupportTicketDto[]>([])
  readonly myTickets = ref<import('../domain/models/content').SupportTicketDto[]>([])
  readonly supportContact = ref<SupportContactDto>({
    supportEmail: '',
    phoneNumber: '',
    whatsAppNumber: '',
    workingHours: '',
  })
  /** Hero telemetry claims. Empty means "publish no claim", not "not loaded". */
  readonly helpSiteStats = ref<HelpSiteStatDto[]>([])
  readonly siteLogo = ref<SiteLogoDto>({
    id: '',
    logoUrl: '',
    altText: 'SNUL',
  })
  private siteLogoLoaded = false
  readonly loading = ref(false)

  private readonly repo: ContentRepository

  constructor(repo: ContentRepository) {
    this.repo = repo
  }

  async loadDocuments(): Promise<void> {
    this.loading.value = true
    try {
      const res = await this.repo.getDocuments({ pageNumber: 1, pageSize: 10 })
      this.documents.value = res.data ?? []
    } catch {
      // gateway may be cold on first hit; page shows empty state gracefully
    } finally {
      this.loading.value = false
    }
  }

  async createDocument(payload: CreateDocumentPayload): Promise<DocumentDto> {
    const created = await this.repo.createDocument(payload)
    this.documents.value.unshift(created)
    return created
  }

  async deleteDocument(id: string): Promise<void> {
    await this.repo.deleteDocument(id)
    this.documents.value = this.documents.value.filter((d) => d.id !== id)
  }

  async loadSupport(): Promise<void> {
    this.loading.value = true
    try {
      // Use allSettled so a single help failure doesn't block other help data
      const results = await Promise.allSettled([
        this.repo.getHelpCategories(),
        this.repo.getHelpArticles(),
        this.repo.getFaqs(),
        this.loadSupportContact(),
      ])
      const categories = results[0].status === 'fulfilled' ? results[0].value : []
      const articles = results[1].status === 'fulfilled' ? results[1].value : []
      const faqs = results[2].status === 'fulfilled' ? results[2].value : []
      if (import.meta.env.DEV && results.some((r) => r.status === 'rejected')) {
        console.warn('[content] loadSupport partial failure', results)
      }
      this.helpCategories.value = categories
      this.helpArticles.value = articles
      this.faqs.value = faqs
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[content] loadSupport failed', e)
    } finally {
      this.loading.value = false
    }
  }

  async createHelpCategory(name: string, icon?: string) {
    const created = await this.repo.createHelpCategory({ name, icon })
    this.helpCategories.value.push(created)
    return created
  }
  async updateHelpCategory(id: string, name: string, icon?: string, isActive?: boolean) {
    const updated = await this.repo.updateHelpCategory(id, { name, icon, isActive })
    this.helpCategories.value = this.helpCategories.value.map((c) => (c.id === id ? updated : c))
    return updated
  }
  async deleteHelpCategory(id: string) {
    await this.repo.deleteHelpCategory(id)
    this.helpCategories.value = this.helpCategories.value.filter((c) => c.id !== id)
  }

  async createHelpArticle(payload: { categoryId: string; title: string; body: string; slug: string }) {
    const created = await this.repo.createHelpArticle(payload)
    this.helpArticles.value.unshift(created)
    return created
  }
  async updateHelpArticle(id: string, payload: { categoryId: string; title: string; body: string; slug: string; isActive?: boolean }) {
    const updated = await this.repo.updateHelpArticle(id, payload)
    this.helpArticles.value = this.helpArticles.value.map((a) => (a.id === id ? updated : a))
    return updated
  }
  async deleteHelpArticle(id: string) {
    await this.repo.deleteHelpArticle(id)
    this.helpArticles.value = this.helpArticles.value.filter((a) => a.id !== id)
  }

  async createFaq(question: string, answer: string, sortOrder = 0) {
    const created = await this.repo.createFaq({ question, answer, sortOrder })
    this.faqs.value.push(created)
    return created
  }
  async updateFaq(id: string, question: string, answer: string, sortOrder = 0, isActive?: boolean) {
    const updated = await this.repo.updateFaq(id, { question, answer, sortOrder, isActive })
    this.faqs.value = this.faqs.value.map((f) => (f.id === id ? updated : f))
    return updated
  }
  async deleteFaq(id: string) {
    await this.repo.deleteFaq(id)
    this.faqs.value = this.faqs.value.filter((f) => f.id !== id)
  }

  async loadMyTickets(): Promise<void> {
    try {
      this.myTickets.value = await this.repo.getMyTickets()
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[content] loadMyTickets failed', e)
    }
  }
  async loadTickets(params?: { pageNumber?: number; pageSize?: number; status?: string; searchTerm?: string }): Promise<void> {
    try {
      this.tickets.value = await this.repo.getTickets(params)
    } catch {
      // gateway may be cold on first hit; page shows empty state gracefully
    }
  }
  async createTicket(subject: string, message: string) {
    const created = await this.repo.createTicket({ subject, message })
    this.myTickets.value.unshift(created)
    return created
  }
  async replyTicket(id: string, reply: string) {
    const updated = await this.repo.replyTicket(id, reply)
    this.tickets.value = this.tickets.value.map((t) => (t.id === id ? updated : t))
    this.myTickets.value = this.myTickets.value.map((t) => (t.id === id ? updated : t))
    return updated
  }
  async closeTicket(id: string) {
    const updated = await this.repo.closeTicket(id)
    this.tickets.value = this.tickets.value.map((t) => (t.id === id ? updated : t))
    this.myTickets.value = this.myTickets.value.map((t) => (t.id === id ? updated : t))
    return updated
  }

  async getLandingPage(slug: string): Promise<LandingPageDto | null> {
    try {
      return await this.repo.getLandingPageBySlug(slug)
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[content] getLandingPage failed', e)
      return null
    }
  }

  async loadSupportContact(): Promise<SupportContactDto> {
    try {
      const data = await this.repo.getSupportContact()
      // Keep last-known-good: an empty/failed fetch must not blank the footer.
      if (data && (data.supportEmail || data.phoneNumber || data.whatsAppNumber)) {
        this.supportContact.value = data
      }
      return this.supportContact.value
    } catch {
      return this.supportContact.value
    }
  }

  async updateSupportContact(payload: UpdateSupportContactPayload): Promise<SupportContactDto> {
    const updated = await this.repo.updateSupportContact(payload)
    if (updated) {
      this.supportContact.value = updated
    }
    return this.supportContact.value
  }

  /**
   * Load the hero telemetry claims.
   *
   * A successful empty list is committed as-is: keeping the previous list when
   * the response is empty would leave a withdrawn claim on the page forever,
   * which is the exact outcome the IsVisible flag exists to allow. A transport
   * failure instead keeps the last-known-good hero (the repo throws, so the
   * catch below is live): a flaked refresh must not blank claims that are
   * still published. There is no default to fall back to at any layer - on a
   * first-load failure the initial `[]` is what stays.
   */
  async loadHelpSiteStats(): Promise<HelpSiteStatDto[]> {
    try {
      const stats = await this.repo.getHelpSiteStats()
      this.helpSiteStats.value = stats
      return this.helpSiteStats.value
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[content] loadHelpSiteStats failed', e)
      return this.helpSiteStats.value
    }
  }

  async createHelpSiteStat(payload: UpsertHelpSiteStatPayload) {
    const created = await this.repo.createHelpSiteStat(payload)
    this.helpSiteStats.value = [...this.helpSiteStats.value, created]
    return created
  }

  async updateHelpSiteStat(id: string, payload: UpsertHelpSiteStatPayload) {
    const updated = await this.repo.updateHelpSiteStat(id, payload)
    this.helpSiteStats.value = this.helpSiteStats.value.map((s) => (s.id === id ? updated : s))
    return updated
  }

  async deleteHelpSiteStat(id: string) {
    await this.repo.deleteHelpSiteStat(id)
    this.helpSiteStats.value = this.helpSiteStats.value.filter((s) => s.id !== id)
  }

  async loadSiteLogo(): Promise<SiteLogoDto> {
    try {
      const data = await this.repo.getSiteLogo()
      // Store returned site logo (empty logoUrl means no logo is set)
      if (data) {
        this.siteLogo.value = data
      }
      this.siteLogoLoaded = true
      return this.siteLogo.value
    } catch {
      this.siteLogoLoaded = true
      return this.siteLogo.value
    }
  }

  async upsertSiteLogo(payload: UpsertSiteLogoPayload): Promise<SiteLogoDto> {
    const updated = await this.repo.upsertSiteLogo(payload)
    if (updated) {
      this.siteLogo.value = updated
    }
    return this.siteLogo.value
  }
}
