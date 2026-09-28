import { HttpClient } from '../infrastructure/http/http-client'
import { TokenStore } from '../infrastructure/http/token-store'
import { AuthBridge } from '../infrastructure/http/auth-bridge'
import { ModalService } from '../infrastructure/feedback/modal.service'
import { ApiAuthRepository } from '../data/repositories/api-auth.repository'
import { ApiLocationRepository } from '../data/repositories/api-location.repository'
import { ApiAddressRepository } from '../data/repositories/api-address.repository'
import { ApiUserRepository } from '../data/repositories/api-user.repository'
import { ApiMarketplaceRepository } from '../data/repositories/api-marketplace.repository'
import { ApiWishlistRepository } from '../data/repositories/api-wishlist.repository'
import { ApiCommerceRepository } from '../data/repositories/api-commerce.repository'
import { ApiSalesRepository } from '../data/repositories/api-sales.repository'
import { ApiContentRepository } from '../data/repositories/api-content.repository'
import { ApiCertificationRepository } from '../data/repositories/api-certification.repository'
import { ApiCompanyRepository } from '../data/repositories/api-company.repository'
import { ApiAuditLogRepository } from '../data/repositories/api-audit-log.repository'
import { ApiAttachmentRepository } from '../data/repositories/api-attachment.repository'
import { ApiExchangeRateRepository } from '../data/repositories/api-exchange-rate.repository'
import { AuthService } from '../application/auth.service'
import { AttachmentService } from '../application/attachment.service'
import { LocationService } from '../application/location.service'
import { AddressService } from '../application/address.service'
import { MarketplaceService } from '../application/marketplace.service'
import { WishlistService } from '../application/wishlist.service'
import { CommerceService } from '../application/commerce.service'
import { SalesService } from '../application/sales.service'
import { ContentService } from '../application/content.service'
import { CertificationService } from '../application/certification.service'
import { CompanyService } from '../application/company.service'
import { AuditLogService } from '../application/audit-log.service'
import { ExchangeRateService } from '../application/exchange-rate.service'

type AnyConstructor = new (...args: never[]) => unknown

class ServiceContainer {
  private readonly factories = new Map<AnyConstructor, () => unknown>()
  private readonly instances = new Map<AnyConstructor, unknown>()

  register<T>(key: AnyConstructor, factory: () => T): void {
    this.factories.set(key, factory)
  }

  resolve<T>(key: AnyConstructor): T {
    let instance = this.instances.get(key) as T | undefined
    if (instance === undefined) {
      const factory = this.factories.get(key)
      if (!factory) throw new Error(`No factory registered for ${key.name}`)
      instance = factory() as T
      this.instances.set(key, instance)
    }
    return instance
  }
}

export const container = new ServiceContainer()

container.register(TokenStore, () => new TokenStore())
container.register(AuthBridge, () => new AuthBridge())
container.register(ModalService, () => new ModalService())
container.register(HttpClient, () =>
  new HttpClient({
    tokenStore: container.resolve<TokenStore>(TokenStore),
    authBridge: container.resolve<AuthBridge>(AuthBridge),
    feedback: container.resolve<ModalService>(ModalService),
  }),
)

container.register(ApiAuthRepository, () => new ApiAuthRepository(container.resolve<HttpClient>(HttpClient)))
container.register(
  ApiLocationRepository,
  () => new ApiLocationRepository(container.resolve<HttpClient>(HttpClient)),
)
container.register(
  ApiAddressRepository,
  () => new ApiAddressRepository(container.resolve<HttpClient>(HttpClient)),
)
container.register(ApiUserRepository, () => new ApiUserRepository(container.resolve<HttpClient>(HttpClient)))
container.register(ApiCommerceRepository, () => new ApiCommerceRepository(container.resolve<HttpClient>(HttpClient)))
container.register(ApiSalesRepository, () => new ApiSalesRepository(container.resolve<HttpClient>(HttpClient)))
container.register(ApiContentRepository, () => new ApiContentRepository(container.resolve<HttpClient>(HttpClient)))
container.register(ApiCertificationRepository, () => new ApiCertificationRepository(container.resolve<HttpClient>(HttpClient)))
container.register(ApiCompanyRepository, () => new ApiCompanyRepository(container.resolve<HttpClient>(HttpClient)))
container.register(ApiAuditLogRepository, () => new ApiAuditLogRepository(container.resolve<HttpClient>(HttpClient)))
container.register(ApiAttachmentRepository, () => new ApiAttachmentRepository(container.resolve<HttpClient>(HttpClient)))

container.register(AttachmentService, () => new AttachmentService(container.resolve<ApiAttachmentRepository>(ApiAttachmentRepository)))

container.register(AuthService, () =>
  new AuthService(
    container.resolve<ApiAuthRepository>(ApiAuthRepository),
    container.resolve<TokenStore>(TokenStore),
    container.resolve<AuthBridge>(AuthBridge),
    container.resolve<AttachmentService>(AttachmentService),
  ),
)

container.register(LocationService, () =>
  new LocationService(container.resolve<ApiLocationRepository>(ApiLocationRepository)),
)

container.register(AddressService, () =>
  new AddressService(
    container.resolve<ApiAddressRepository>(ApiAddressRepository),
    container.resolve<AuthService>(AuthService),
  ),
)

container.register(ApiMarketplaceRepository, () => new ApiMarketplaceRepository(container.resolve<HttpClient>(HttpClient)))
container.register(ApiWishlistRepository, () => new ApiWishlistRepository(container.resolve<HttpClient>(HttpClient)))
container.register(ApiExchangeRateRepository, () => new ApiExchangeRateRepository(container.resolve<HttpClient>(HttpClient)))
container.register(ExchangeRateService, () => new ExchangeRateService(container.resolve<ApiExchangeRateRepository>(ApiExchangeRateRepository)))
container.register(MarketplaceService, () => new MarketplaceService(container.resolve<ApiMarketplaceRepository>(ApiMarketplaceRepository)))
container.register(WishlistService, () => new WishlistService(container.resolve<ApiWishlistRepository>(ApiWishlistRepository), container.resolve<AuthService>(AuthService)))

container.register(CommerceService, () => new CommerceService(container.resolve<ApiCommerceRepository>(ApiCommerceRepository)))
container.register(SalesService, () => new SalesService(container.resolve<ApiSalesRepository>(ApiSalesRepository)))
container.register(ContentService, () => new ContentService(container.resolve<ApiContentRepository>(ApiContentRepository)))
container.register(CertificationService, () => new CertificationService(container.resolve<ApiCertificationRepository>(ApiCertificationRepository)))
container.register(CompanyService, () => new CompanyService(container.resolve<ApiCompanyRepository>(ApiCompanyRepository)))
container.register(AuditLogService, () => new AuditLogService(container.resolve<ApiAuditLogRepository>(ApiAuditLogRepository)))

export const services = {
  tokenStore: container.resolve<TokenStore>(TokenStore),
  authBridge: container.resolve<AuthBridge>(AuthBridge),
  modalService: container.resolve<ModalService>(ModalService),
  authService: container.resolve<AuthService>(AuthService),
  locationService: container.resolve<LocationService>(LocationService),
  addressService: container.resolve<AddressService>(AddressService),
  marketplaceService: container.resolve<MarketplaceService>(MarketplaceService),
  marketplaceRepository: container.resolve<ApiMarketplaceRepository>(ApiMarketplaceRepository),
  exchangeRateService: container.resolve<ExchangeRateService>(ExchangeRateService),
  exchangeRateRepository: container.resolve<ApiExchangeRateRepository>(ApiExchangeRateRepository),
  wishlistService: container.resolve<WishlistService>(WishlistService),
  wishlistRepository: container.resolve<ApiWishlistRepository>(ApiWishlistRepository),
  authRepository: container.resolve<ApiAuthRepository>(ApiAuthRepository),
  locationRepository: container.resolve<ApiLocationRepository>(ApiLocationRepository),
  addressRepository: container.resolve<ApiAddressRepository>(ApiAddressRepository),
  userRepository: container.resolve<ApiUserRepository>(ApiUserRepository),
  commerceService: container.resolve<CommerceService>(CommerceService),
  salesService: container.resolve<SalesService>(SalesService),
  contentService: container.resolve<ContentService>(ContentService),
  certificationService: container.resolve<CertificationService>(CertificationService),
  companyService: container.resolve<CompanyService>(CompanyService),
  attachmentService: container.resolve<AttachmentService>(AttachmentService),
  attachmentRepository: container.resolve<ApiAttachmentRepository>(ApiAttachmentRepository),
  certificationRepository: container.resolve<ApiCertificationRepository>(ApiCertificationRepository),
  contentRepository: container.resolve<ApiContentRepository>(ApiContentRepository),
  companyRepository: container.resolve<ApiCompanyRepository>(ApiCompanyRepository),
  commerceRepository: container.resolve<ApiCommerceRepository>(ApiCommerceRepository),
  salesRepository: container.resolve<ApiSalesRepository>(ApiSalesRepository),
  auditLogService: container.resolve<AuditLogService>(AuditLogService),
}

export const modalService = services.modalService
export const authService = services.authService
export const locationService = services.locationService
export const addressService = services.addressService
export const marketplaceService = services.marketplaceService
export const marketplaceRepository = services.marketplaceRepository
export const wishlistService = services.wishlistService
export const wishlistRepository = services.wishlistRepository
export const userRepository = services.userRepository
export const locationRepository = services.locationRepository
export const commerceService = services.commerceService
export const salesService = services.salesService
export const contentService = services.contentService
export const certificationService = services.certificationService
export const companyService = services.companyService
export const attachmentService = services.attachmentService
export const attachmentRepository = services.attachmentRepository
export const commerceRepository = container.resolve<ApiCommerceRepository>(ApiCommerceRepository)
export const salesRepository = container.resolve<ApiSalesRepository>(ApiSalesRepository)
export const contentRepository = container.resolve<ApiContentRepository>(ApiContentRepository)
export const certificationRepository = container.resolve<ApiCertificationRepository>(ApiCertificationRepository)
export const companyRepository = container.resolve<ApiCompanyRepository>(ApiCompanyRepository)
export const auditLogService = container.resolve<AuditLogService>(AuditLogService)
export const exchangeRateService = services.exchangeRateService
export const exchangeRateRepository = services.exchangeRateRepository
