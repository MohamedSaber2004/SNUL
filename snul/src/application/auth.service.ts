import { computed, ref } from 'vue'
import { t, type MessageKey } from '../i18n'
import type { User, AuthResponseDto, UserProfileDto } from '../domain/models/user'
import { UserType } from '../domain/models/user'
import { USER_TINTS, normalizeThemeMode } from '../domain/models/user'
import type { AuthRepository } from '../domain/ports/auth-repository'
import type {
  LoginPayload,
  RegisterPayload,
  VerifyEmailOtpPayload,
  ResendRegisterOtpPayload,
  ForgotPasswordPayload,
  VerifyPasswordOtpPayload,
  ResetPasswordPayload,
  UpdateProfilePayload,
} from '../domain/models/auth'
import { toastService } from '../infrastructure/feedback/toast.service'
import { ApiError } from '../infrastructure/http/api-error'
import type { TokenStore } from '../infrastructure/http/token-store'
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, SESSION_COOKIE } from '../infrastructure/http/token-store'
import type { AuthBridge } from '../infrastructure/http/auth-bridge'
import type { AttachmentService } from './attachment.service'
import {
  isAdminContext,
  isOrganizationUserContext,
  isSalesContext,
  resolveBusinessRole as resolveBusinessRoleFn,
  resolveBusinessRoleKey as resolveBusinessRoleKeyFn,
} from '../domain/models/business-role'
import { isPendingOrg, syncPendingOrgMarker } from '../utils/pending-org-marker'
import router from '../router'

export type AuthResult = { ok: true } | { ok: false; error: string }

const TINTS = [...USER_TINTS]

export interface StoredSession {
  accessToken: string
  refreshToken: string
  refreshTokenExpiryTime: string
  accessTokenExpiresAt: string
  user: User
}

/** Case-insensitive key lookup — the API may serialize PascalCase in some deployments. */
const pickField = (raw: Record<string, unknown>, ...keys: string[]): unknown => {
  const lowered = new Map<string, unknown>()
  for (const [k, v] of Object.entries(raw)) lowered.set(k.toLowerCase(), v)
  for (const k of keys) {
    const v = lowered.get(k.toLowerCase())
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

const normalizeRoles = (value: unknown): string[] => {
  if (value === undefined || value === null) return []
  const arr = Array.isArray(value) ? value : [value]
  return arr.map((r) => String(r).trim()).filter(Boolean)
}

/** Backend sends UserType as a number, but accept numeric/enum-name strings too. */
const normalizeUserType = (value: unknown): UserType => {
  if (typeof value === 'number' && Number.isFinite(value)) return value as UserType
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed !== '') {
      const n = Number(trimmed)
      if (Number.isFinite(n)) return n as UserType
      const byName: Record<string, UserType> = {
        admin: UserType.Admin,
        organizationuser: UserType.OrganizationUser,
        snulstaff: UserType.SnulStaff,
        sales: UserType.Sales,
        client: UserType.Client,
        customer: UserType.Client,
      }
      const mapped = byName[trimmed.toLowerCase()]
      if (mapped !== undefined) return mapped
    }
  }
  return UserType.Client
};

/** Role names embedded in the JWT (ClaimTypes.Role + "role") — backup source
 *  when the login/profile payload carries no roles. */
const tokenRoleClaims = (token: string): string[] => {
  try {
    const parts = token.split('.')
    if (parts.length < 2 || !parts[1]) return []
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const payload = JSON.parse(atob(b64)) as Record<string, unknown>
    const out: string[] = []
    const push = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(push)
      else if (typeof v === 'string' && v.trim()) out.push(v.trim())
    }
    push(payload['role'])
    push(payload['roles'])
    push(payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'])
    return out
  } catch {
    return []
  }
}

const nameToUser = (raw: AuthResponseDto | UserProfileDto): User => {
  const rec = raw as unknown as Record<string, unknown>
  const id = String(pickField(rec, 'userId') ?? '')
  const fullName = String(pickField(rec, 'fullName') ?? '')
  const email = String(pickField(rec, 'email') ?? '')
  const seed = `${id}${email}`.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const companyIdRaw = pickField(rec, 'companyId')
  return {
    id,
    fullName,
    email,
    phoneNumber: (pickField(rec, 'phoneNumber') as string | null) ?? null,
    phoneCode: (pickField(rec, 'phoneCode') as string | null) ?? null,
    profilePictureName: (pickField(rec, 'profilePictureName') as string | null) ?? null,
    userType: normalizeUserType(pickField(rec, 'userType')),
    language: (pickField(rec, 'language') as User['language']) ?? 1,
    themeMode: normalizeThemeMode(pickField(rec, 'themeMode')),
    // Login payloads carry no confirmation flag → default true; profiles do.
    isEmailConfirmed: (() => {
      const v = pickField(rec, 'isEmailConfirmed')
      return v === undefined ? true : Boolean(v)
    })(),
    createdAt: String(pickField(rec, 'createdAt') ?? new Date().toISOString()),
    roles: normalizeRoles(pickField(rec, 'roles')),
    companyId: companyIdRaw === undefined ? null : (companyIdRaw as string | null),
    company: (pickField(rec, 'company') as User['company']) ?? null,
    tint: TINTS[seed % TINTS.length] ?? '#0ea5e9',
  }
}

const decodeJwtExp = (token: string): number => {
  try {
    const parts = token.split('.')
    if (parts.length < 2 || !parts[1]) return Date.now() + 3_600_000
    const payload = JSON.parse(atob(parts[1])) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + 3_600_000
  } catch {
    return Date.now() + 3_600_000
  }
}

const toMessageKey = (err: unknown, fallback: MessageKey): MessageKey => {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        // Gateway routing 404 should surface as network/config error, not as invalid credentials.
        // Only forgotPassword uses 404 to mean email not found.
        if (fallback === 'auth.errEmailNotFound') return fallback
        return 'common.networkError'
      case 429:
        return 'auth.errTooManyAttempts'
      case 0:
        return 'auth.errNetwork'
      case 401:
        // For login, 401 means invalid credentials (user not found / wrong password / email not confirmed),
        // not session expiry. Preserve the caller's fallback for login.
        if (fallback === 'auth.errInvalidCredentials') return fallback
        return 'auth.errSessionExpired'
      case 500:
      case 502:
      case 503:
      case 504:
        return 'auth.errGeneric'
    }
  }
  return fallback
}

const toErrorMessage = (err: unknown, fallbackKey: MessageKey): string => {
  if (err instanceof ApiError) {
    // Map distributor gate keys to proper translations
    const distributorKeyMap: Record<string, MessageKey> = {
      'DistributorApplication.PendingApproval': 'distributor.pendingApproval',
      'DistributorApplication.NotApplied': 'distributor.notApplied',
      'DistributorApplication.CompanyNotApproved': 'distributor.companyNotApproved',
    }
    const checkDistributorKey = (msg: string | null | undefined): string | null => {
      if (!msg) return null
      for (const [k, v] of Object.entries(distributorKeyMap)) {
        if (msg.includes(k)) return t(v)
      }
      return null
    }
    const mapped = checkDistributorKey(err.message)
    if (mapped) return mapped
    if (err.errors) {
      for (const vals of Object.values(err.errors)) {
        for (const m of vals as string[]) {
          const mk = checkDistributorKey(m)
          if (mk) return mk
        }
      }
    }

    if (err.status === 404) {
      // Prefer server-provided message/errors for genuine 404s
      if (err.errors && Object.keys(err.errors).length > 0) {
        const msgs = Object.values(err.errors).flat().filter(Boolean)
        if (msgs.length > 0) return msgs.join(', ')
      }
      if (err.message && err.message !== 'Not found' && !err.message.startsWith('Request failed with status')) {
        return err.message
      }
      return t(toMessageKey(err, fallbackKey))
    }
    if (err.errors && Object.keys(err.errors).length > 0) {
      const msgs = Object.values(err.errors).flat().filter(Boolean)
      if (msgs.length > 0) return msgs.join(', ')
    }
    if (err.message && !err.message.startsWith('Request failed with status') && !err.message.includes('404')) {
      return err.message
    }
    return t(toMessageKey(err, fallbackKey))
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return t(fallbackKey)
}

export class AuthService {
  readonly user = ref<User | null>(null)
  readonly isLoadingProfile = ref(false)

  private readonly authRepository: AuthRepository
  private readonly tokenStore: TokenStore
  private readonly authBridge: AuthBridge
  private readonly attachmentService?: AttachmentService

  private session: StoredSession | null = null
  private sessionTimer: ReturnType<typeof setInterval> | null = null
  private redirectingToLogin = false

  constructor(
    authRepository: AuthRepository,
    tokenStore: TokenStore,
    authBridge: AuthBridge,
    attachmentService?: AttachmentService,
  ) {
    this.authRepository = authRepository
    this.tokenStore = tokenStore
    this.authBridge = authBridge
    this.attachmentService = attachmentService

    this.restore()
    this.authBridge.bind({
      onSessionExpired: () => this.handleSessionExpired(),
    })
    this.startSessionWatcher()
    this.bindCrossTabSync()
  }

  /**
   * Keeps sibling tabs in sync through localStorage events:
   * - Session/tokens cleared elsewhere (logout in another tab) → log out here too.
   * - Tokens changed elsewhere → adopt them, then force logout if expired.
   */
  private bindCrossTabSync(): void {
    if (typeof window === 'undefined') return
    window.addEventListener('storage', (e: StorageEvent) => {
      if (!e.key || ![SESSION_COOKIE, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE].includes(e.key)) return
      if (e.newValue === null) {
        if (this.isAuthenticated) this.handleSessionExpired('auth.signedOutElsewhere')
      } else {
        this.tokenStore.reloadFromStorage()
        if (this.isAuthenticated && this.tokenStore.isAccessTokenExpired()) {
          this.handleSessionExpired()
        }
      }
    })
  }

  private startSessionWatcher(): void {
    if (typeof window === 'undefined') return
    if (this.sessionTimer) clearInterval(this.sessionTimer)
    // Expired access token → try silent refresh first; force logout only when refresh fails.
    this.sessionTimer = setInterval(() => {
      void (async () => {
        if (!this.isAuthenticated) return
        if (this.redirectingToLogin) return
        if (this.tokenStore.isAccessTokenExpired()) {
          const refreshed = await this.trySilentRefresh()
          if (!refreshed) this.handleSessionExpired()
        }
      })()
    }, 30_000)
  }

  get isAuthenticated(): boolean {
    return this.user.value !== null
  }

  /** Single source of truth lives in `domain/models/business-role` — these just bind it to the session user. */
  readonly isAdmin = computed(() => {
    const u = this.user.value
    if (!u) return false
    return isAdminContext({ userType: u.userType, roles: u.roles })
  })

  readonly isOrganizationUser = computed(() => {
    const u = this.user.value
    if (!u) return false
    return isOrganizationUserContext({ userType: u.userType, roles: u.roles })
  })

  /** Sales/Internal Staff — internal operations roles (UserType 3), treated identically. */
  readonly isSales = computed(() => {
    const u = this.user.value
    if (!u) return false
    return isSalesContext({ userType: u.userType, roles: u.roles })
  })

  /** Provider / Distributor — the seller supplying goods on the platform. */
  readonly isProvider = computed(() => {
    const u = this.user.value
    if (!u) return false
    if (this.isAdmin.value || this.isSales.value) return false
    return (
      this.isOrganizationUser.value ||
      u.roles.some((r) => ['provider', 'distributor', 'supplier'].includes(r.toLowerCase())) ||
      !!u.companyId ||
      !!u.company
    )
  })

  /** Client — the buyer purchasing products on the site. */
  readonly isClient = computed(() => {
    const u = this.user.value
    if (!u) return false
    if (this.isAdmin.value || this.isSales.value || this.isProvider.value) return false
    return (
      u.userType === 4 ||
      u.roles.some((r) => ['client', 'buyer', 'customer'].includes(r.toLowerCase())) ||
      true
    )
  })

  /** Buyer = Client */
  readonly isBuyer = computed(() => this.isClient.value)

  /** Seller = Provider (supplies goods to the platform) */
  readonly isSeller = computed(() => this.isProvider.value)

  /** Staff = Admin or Sales (internal platform management) */
  readonly isStaff = computed(() => this.isAdmin.value || this.isSales.value)

  /**
   * 4 business roles derived on top of the backend UserTypes:
   * Admin, Sales, Provider (Seller), Client (Buyer).
   */
  private toBusinessCtx(company?: { id?: string | null; type?: number; status?: unknown } | null) {
    const u = this.user.value
    return {
      userType: u?.userType ?? null,
      roles: u?.roles ?? [],
      companyId: u?.companyId ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      company: (company ?? u?.company ?? null) as any,
    }
  }

  /** Suitable landing dashboard per role. Single source of truth for post-login + guestOnly redirects. */
  getDashboardRouteName(): string {
    if (this.isAdmin.value || this.isSales.value) return 'admin-dashboard'
    if (this.isProvider.value) return 'provider-quotes'
    if (this.isClient.value) return 'account'
    return 'home'
  }

  /**
   * Validate a `?redirect=` target against the current role so login never
   * pushes a buyer into /admin or /provider (or a seller into /account) just to bounce.
   * Mirrors the guards in `src/router/index.ts`.
   */
  canAccessPath(path: string): boolean {
    if (!path || !path.startsWith('/')) return false
    const clean = path.split('?')[0]?.split('#')[0] ?? '/'
    if (clean.startsWith('/admin')) return this.isAdmin.value || this.isSales.value
    if (clean.startsWith('/provider')) return this.isProvider.value || this.isAdmin.value
    if (clean.startsWith('/account') || clean === '/wishlist') return this.isClient.value && this.isAuthenticated
    if (clean === '/cart' || clean === '/checkout') return this.isClient.value
    return true
  }

  /** Pending org (no company + marker) has no dashboard yet — land on home. */
  isPendingApproval(): boolean {
    const u = this.user.value
    return !!u && this.isOrganizationUser.value && !u.companyId && isPendingOrg(u.email)
  }

  /** Whether the signed-in user already has a linked provider company. */
  readonly hasLinkedCompany = computed(() => !!(this.user.value?.companyId || this.user.value?.company?.id))

  /** Precise business role once the company detail is known (pass myCompany). */
  resolveBusinessRole(company?: { id?: string | null; type?: number; status?: unknown } | null) {
    return resolveBusinessRoleFn(this.toBusinessCtx(company))
  }

  /** i18n key (under `admin.*`) for the current business role. */
  resolveBusinessRoleKey(company?: { id?: string | null; type?: number; status?: unknown } | null) {
    return resolveBusinessRoleKeyFn(this.toBusinessCtx(company))
  }

  hasRole(role: string): boolean {
    return this.user.value?.roles.map((r) => r.toLowerCase()).includes(role.toLowerCase()) ?? false
  }

  async ensureValidSession(): Promise<boolean> {
    if (!this.user.value) return false
    // Proactive silent rotation when the access token is expiring soon
    // (5 min window); falls back to force logout when refresh fails.
    const accessToken = this.tokenStore.getAccessToken()
    if (accessToken) {
      const expSec = Math.floor(decodeJwtExp(accessToken) / 1000)
      if (this.tokenStore.isExpiringSoon(expSec)) {
        const refreshed = await this.trySilentRefresh()
        if (refreshed) return true
      }
    }
    // Expired access token → force logout; the user must sign in again.
    if (this.tokenStore.isAccessTokenExpired()) {
      this.handleSessionExpired()
      return false
    }
    return true
  }

  private async trySilentRefresh(): Promise<boolean> {
    try {
      const refreshToken = this.tokenStore.getRefreshToken()
      if (!refreshToken || this.tokenStore.isRefreshTokenExpired()) return false
      const data = await this.authRepository.refreshToken({ refreshToken })
      if (!data?.accessToken) return false
      this.tokenStore.setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || refreshToken,
        refreshTokenExpiryTime:
          data.refreshTokenExpiryTime || this.tokenStore.getRefreshTokenExpiryTime(),
      })
      if (this.session) {
        this.session.accessToken = data.accessToken
        this.session.refreshToken = data.refreshToken || refreshToken
        this.session.refreshTokenExpiryTime =
          data.refreshTokenExpiryTime || this.session.refreshTokenExpiryTime
        this.session.accessTokenExpiresAt = new Date(decodeJwtExp(data.accessToken)).toISOString()
        this.tokenStore.saveSession(this.session)
      }
      return true
    } catch {
      return false
    }
  }

  private restore(): void {
    const session = this.tokenStore.getSession<StoredSession>()
    if (session?.accessToken && session?.user) {
      this.tokenStore.setTokens({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        refreshTokenExpiryTime: session.refreshTokenExpiryTime,
      })
      // Stored access token already expired (e.g. returning after a long
      // absence) → drop the session; the user must sign in again.
      if (this.tokenStore.isAccessTokenExpired()) {
        this.expireSession()
        return
      }
      this.session = session
      this.user.value = session.user
      // Hydrate full profile (with profilePictureName) in background after restore
      if (typeof window !== 'undefined') {
        setTimeout(() => void this.loadProfile().catch(() => {}), 300)
      }
    } else if (this.tokenStore.hasAccessToken()) {
      if (this.tokenStore.isAccessTokenExpired()) {
        this.expireSession()
      }
    }
  }

  /** Merge JWT role claims into the user when the payload roles are empty —
   *  the token always carries them, so a shapeless payload can't demote the role. */
  private applyTokenRoles(user: User, accessToken: string): void {
    if (user.roles.length) return
    const tokenRoles = tokenRoleClaims(accessToken)
    if (!tokenRoles.length) return
    const merged = [...user.roles]
    for (const r of tokenRoles) {
      if (!merged.some((x) => x.toLowerCase() === r.toLowerCase())) merged.push(r)
    }
    user.roles = merged
  }

  private persistSession(auth: AuthResponseDto): void {
    const user = nameToUser(auth)
    this.applyTokenRoles(user, auth.accessToken)
    if (import.meta.env.DEV) {
      console.info('[auth] session role →', resolveBusinessRoleFn({
        userType: user.userType,
        roles: user.roles,
        companyId: user.companyId ?? null,
        company: user.company ?? null,
      }), { userType: user.userType, roles: user.roles })
    }
    // Approval self-heals the pending-org marker (Customer vs pending org
    // can't be told apart by the backend — it has no Customer role).
    syncPendingOrgMarker(user)
    const accessExp = new Date(decodeJwtExp(auth.accessToken)).toISOString()
    this.session = {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      refreshTokenExpiryTime: auth.refreshTokenExpiryTime,
      accessTokenExpiresAt: accessExp,
      user,
    }
    this.user.value = user
    this.tokenStore.setTokens({
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      refreshTokenExpiryTime: auth.refreshTokenExpiryTime,
    })
    this.tokenStore.saveSession(this.session)
  }

  private updateUserFromProfile(profile: UserProfileDto): void {
    const user = nameToUser(profile)
    syncPendingOrgMarker(user)
    if (this.session) {
      this.session.user = user
      this.tokenStore.saveSession(this.session)
    }
    // Skip replacement when nothing changed: every replacement notifies all
    // `user` watchers app-wide, and any watcher that writes back (e.g. theme
    // persistence) would otherwise ping-pong into an infinite request loop.
    const prev = this.user.value
    if (prev && JSON.stringify(prev) === JSON.stringify(user)) return
    this.user.value = user
  }

  async register(payload: RegisterPayload): Promise<AuthResult> {
    try {
      await this.authRepository.register(payload)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: toErrorMessage(err, 'auth.errGeneric') }
    }
  }

  async login(payload: LoginPayload): Promise<AuthResult> {
    try {
      const data = await this.authRepository.login(payload)
      this.persistSession(data)
      toastService.success(t('auth.welcomeBackToast'))
      // Fetch full profile (with profilePictureName) right after login for header avatar
      void this.loadProfile().catch(() => {})
      return { ok: true }
    } catch (err) {
      return { ok: false, error: toErrorMessage(err, 'auth.errInvalidCredentials') }
    }
  }

  async verifyEmailOtp(payload: VerifyEmailOtpPayload): Promise<AuthResult> {
    try {
      const data = await this.authRepository.verifyEmailOtp(payload)
      if (data && typeof data === 'object') {
        const token = (data as { accessToken?: string; AccessToken?: string }).accessToken || (data as { accessToken?: string; AccessToken?: string }).AccessToken
        if (token && typeof token === 'string' && token.trim()) {
          this.persistSession(data)
        }
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: toErrorMessage(err, 'auth.errInvalidOtp') }
    }
  }

  /**
   * Issues a fresh registration code. This replaces replaying the whole
   * `register` call, which could only ever fail with "email already
   * registered" once the account existed — and which meant persisting the
   * registration payload (including the password) just to resend.
   */
  async resendRegisterOtp(payload: ResendRegisterOtpPayload): Promise<AuthResult> {
    try {
      await this.authRepository.resendRegisterOtp(payload)
      toastService.success(t('auth.codeSent'))
      return { ok: true }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return { ok: false, error: t('auth.errEmailNotFound') }
      }
      return { ok: false, error: toErrorMessage(err, 'auth.errGeneric') }
    }
  }

  async forgotPassword(payload: ForgotPasswordPayload): Promise<AuthResult> {
    try {
      await this.authRepository.forgotPassword(payload)
      return { ok: true }
    } catch (err) {
      const fallback = err instanceof ApiError && err.status === 404 ? 'auth.errEmailNotFound' : 'auth.errGeneric'
      return { ok: false, error: toErrorMessage(err, fallback) }
    }
  }

  async verifyPasswordOtp(payload: VerifyPasswordOtpPayload): Promise<AuthResult> {
    try {
      await this.authRepository.verifyPasswordOtp(payload)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: toErrorMessage(err, 'auth.errInvalidOtp') }
    }
  }

  async resetPassword(payload: ResetPasswordPayload): Promise<AuthResult> {
    try {
      await this.authRepository.resetPassword(payload)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: toErrorMessage(err, 'auth.errGeneric') }
    }
  }

  async loadProfile(): Promise<AuthResult & { profile?: UserProfileDto }> {
    if (!this.user.value) return { ok: false, error: t('auth.errSessionExpired') }
    this.isLoadingProfile.value = true
    try {
      const profile = await this.authRepository.getProfile()
      this.updateUserFromProfile(profile)
      return { ok: true, profile }
    } catch (err) {
      return { ok: false, error: toErrorMessage(err, 'auth.errGeneric') }
    } finally {
      this.isLoadingProfile.value = false
    }
  }

  async updateProfile(
    payload: UpdateProfilePayload,
    opts?: { silent?: boolean },
  ): Promise<AuthResult & { profile?: UserProfileDto }> {
    if (!this.user.value) return { ok: false, error: t('auth.errSessionExpired') }
    try {
      const profile = await this.authRepository.updateProfile(payload)
      this.updateUserFromProfile(profile)
      if (!opts?.silent) toastService.success(t('profile.savedToast'))
      return { ok: true, profile }
    } catch (err) {
      return { ok: false, error: toErrorMessage(err, 'auth.errGeneric') }
    }
  }

  /**
   * Upload a profile picture via the Attachment service (place = Users),
   * then persist the returned stored name on the profile.
   * Returns the new `profilePictureName`.
   */
  async uploadProfilePicture(
    file: File,
  ): Promise<AuthResult & { profilePictureName?: string }> {
    if (!this.user.value) return { ok: false, error: t('auth.errSessionExpired') }
    if (!this.attachmentService) return { ok: false, error: t('common.networkError') }
    const { MEDIA_TYPE } = await import('../config/api.config')
    const res = await this.attachmentService.upload({ file, place: 2, fileType: MEDIA_TYPE.IMAGE })
    if (!res.ok) return { ok: false, error: res.error }
    const storedName = res.data
    const update = await this.updateProfile({ profilePictureName: storedName })
    if (!update.ok) return { ok: false, error: update.error }
    return { ok: true, profilePictureName: storedName }
  }

  expireSession(): void {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer)
      this.sessionTimer = null
    }
    this.session = null
    this.user.value = null
    this.tokenStore.clear()
  }

  private handleSessionExpired(messageKey: MessageKey = 'auth.errSessionExpired'): void {
    const hadSession = this.user.value !== null
    this.expireSession()
    if (hadSession) toastService.info(t(messageKey))
    const current = router.currentRoute.value
    if (current.name === 'login' || this.redirectingToLogin) return
    this.redirectingToLogin = true
    void router
      .push({ name: 'login', query: { redirect: current.fullPath } })
      .finally(() => {
        this.redirectingToLogin = false
      })
  }

  async logout(): Promise<void> {
    const refreshToken = this.tokenStore.getRefreshToken()
    try {
      if (refreshToken) {
        await this.authRepository.logout({ refreshToken })
      }
    } catch {
      // ignore
    } finally {
      this.expireSession()
      toastService.info(t('auth.logoutToast'))
      await router.push({ name: 'login' })
    }
  }
}
