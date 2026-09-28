import { getCookie, setCookie, deleteCookie } from './cookie-utils'

export const ACCESS_TOKEN_COOKIE = 'snul_access_token'
export const REFRESH_TOKEN_COOKIE = 'snul_refresh_token'
export const REFRESH_TOKEN_EXPIRY_COOKIE = 'snul_refresh_token_expiry'
export const SESSION_COOKIE = 'snul_session'

const LEGACY_ACCESS_TOKEN_COOKIE = 'welco_access_token'
const LEGACY_REFRESH_TOKEN_COOKIE = 'welco_refresh_token'
const LEGACY_REFRESH_TOKEN_EXPIRY_COOKIE = 'welco_refresh_token_expiry'
const LEGACY_SESSION_COOKIE = 'welco_session'

export interface TokenSet {
  accessToken: string
  refreshToken: string
  refreshTokenExpiryTime?: string
}

const isClient = typeof window !== 'undefined'

function safeGetStorage(key: string): string | null {
  if (!isClient) return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetStorage(key: string, val: string): void {
  if (!isClient) return
  try {
    window.localStorage.setItem(key, val)
  } catch {
  }
}

function safeRemoveStorage(key: string): void {
  if (!isClient) return
  try {
    window.localStorage.removeItem(key)
  } catch {
  }
}

export function parseUtcTimestamp(val: unknown): number | null {
  if (!val) return null
  if (typeof val === 'number') {
    return Number.isFinite(val) ? (val > 1e11 ? val : val * 1000) : null
  }
  if (typeof val !== 'string') return null
  const str = val.trim()
  if (!str) return null
  if (/^\d+$/.test(str)) {
    const n = Number(str)
    return n > 1e11 ? n : n * 1000
  }
  let normalized = str.replace(' ', 'T')
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(normalized)) {
    normalized += 'Z'
  }
  const time = new Date(normalized).getTime()
  return Number.isFinite(time) ? time : null
}

export function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2 || !parts[1]) return null
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) base64 += '='
    const json = atob(base64)
    const payload = JSON.parse(json) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export class TokenStore {
  private accessToken = ''
  private refreshToken = ''
  private refreshTokenExpiryTime = ''
  private cachedSession: unknown | null = null

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage(): void {
    this.accessToken = safeGetStorage(ACCESS_TOKEN_COOKIE) ?? getCookie(ACCESS_TOKEN_COOKIE) ?? safeGetStorage(LEGACY_ACCESS_TOKEN_COOKIE) ?? getCookie(LEGACY_ACCESS_TOKEN_COOKIE) ?? ''
    this.refreshToken = safeGetStorage(REFRESH_TOKEN_COOKIE) ?? getCookie(REFRESH_TOKEN_COOKIE) ?? safeGetStorage(LEGACY_REFRESH_TOKEN_COOKIE) ?? getCookie(LEGACY_REFRESH_TOKEN_COOKIE) ?? ''
    this.refreshTokenExpiryTime = safeGetStorage(REFRESH_TOKEN_EXPIRY_COOKIE) ?? getCookie(REFRESH_TOKEN_EXPIRY_COOKIE) ?? safeGetStorage(LEGACY_REFRESH_TOKEN_EXPIRY_COOKIE) ?? getCookie(LEGACY_REFRESH_TOKEN_EXPIRY_COOKIE) ?? ''
    try {
      const rawSession = safeGetStorage(SESSION_COOKIE) ?? getCookie(SESSION_COOKIE) ?? safeGetStorage(LEGACY_SESSION_COOKIE) ?? getCookie(LEGACY_SESSION_COOKIE)
      if (rawSession) {
        this.cachedSession = JSON.parse(rawSession)
      }
    } catch {
      this.cachedSession = null
    }
  }

  /**
   * Re-read tokens from storage, discarding in-memory copies. Used when another
   * tab rotated the tokens (refresh rotation revokes the old refresh token),
   * so this tab keeps working with the current token set instead of its stale one.
   */
  reloadFromStorage(): void {
    this.accessToken = ''
    this.refreshToken = ''
    this.refreshTokenExpiryTime = ''
    this.loadFromStorage()
  }

  setTokens(tokens: TokenSet): void {
    this.accessToken = tokens.accessToken || ''
    this.refreshToken = tokens.refreshToken || ''
    this.refreshTokenExpiryTime = tokens.refreshTokenExpiryTime || ''

    let refreshMaxAge = 30 * 24 * 60 * 60
    if (this.refreshTokenExpiryTime) {
      const expTime = parseUtcTimestamp(this.refreshTokenExpiryTime)
      if (expTime && expTime > Date.now()) {
        refreshMaxAge = Math.floor((expTime - Date.now()) / 1000)
      }
    }

    const accessMaxAge = refreshMaxAge

    if (this.accessToken) {
      safeSetStorage(ACCESS_TOKEN_COOKIE, this.accessToken)
      setCookie(ACCESS_TOKEN_COOKIE, this.accessToken, { maxAge: accessMaxAge })
    } else {
      safeRemoveStorage(ACCESS_TOKEN_COOKIE)
      deleteCookie(ACCESS_TOKEN_COOKIE)
    }

    if (this.refreshToken) {
      safeSetStorage(REFRESH_TOKEN_COOKIE, this.refreshToken)
      setCookie(REFRESH_TOKEN_COOKIE, this.refreshToken, { maxAge: refreshMaxAge })
    } else {
      safeRemoveStorage(REFRESH_TOKEN_COOKIE)
      deleteCookie(REFRESH_TOKEN_COOKIE)
    }

    if (this.refreshTokenExpiryTime) {
      safeSetStorage(REFRESH_TOKEN_EXPIRY_COOKIE, this.refreshTokenExpiryTime)
      setCookie(REFRESH_TOKEN_EXPIRY_COOKIE, this.refreshTokenExpiryTime, { maxAge: refreshMaxAge })
    } else {
      safeRemoveStorage(REFRESH_TOKEN_EXPIRY_COOKIE)
      deleteCookie(REFRESH_TOKEN_EXPIRY_COOKIE)
    }
  }

  clear(): void {
    this.accessToken = ''
    this.refreshToken = ''
    this.refreshTokenExpiryTime = ''
    this.cachedSession = null
    safeRemoveStorage(ACCESS_TOKEN_COOKIE)
    safeRemoveStorage(REFRESH_TOKEN_COOKIE)
    safeRemoveStorage(REFRESH_TOKEN_EXPIRY_COOKIE)
    safeRemoveStorage(SESSION_COOKIE)
    safeRemoveStorage(LEGACY_ACCESS_TOKEN_COOKIE)
    safeRemoveStorage(LEGACY_REFRESH_TOKEN_COOKIE)
    safeRemoveStorage(LEGACY_REFRESH_TOKEN_EXPIRY_COOKIE)
    safeRemoveStorage(LEGACY_SESSION_COOKIE)
    deleteCookie(ACCESS_TOKEN_COOKIE)
    deleteCookie(REFRESH_TOKEN_COOKIE)
    deleteCookie(REFRESH_TOKEN_EXPIRY_COOKIE)
    deleteCookie(SESSION_COOKIE)
    deleteCookie(LEGACY_ACCESS_TOKEN_COOKIE)
    deleteCookie(LEGACY_REFRESH_TOKEN_COOKIE)
    deleteCookie(LEGACY_REFRESH_TOKEN_EXPIRY_COOKIE)
    deleteCookie(LEGACY_SESSION_COOKIE)
  }

  hasAccessToken(): boolean {
    return this.getAccessToken() !== ''
  }

  getAccessToken(): string {
    if (!this.accessToken) {
      this.accessToken = safeGetStorage(ACCESS_TOKEN_COOKIE) ?? getCookie(ACCESS_TOKEN_COOKIE) ?? ''
    }
    return this.accessToken
  }

  getRefreshToken(): string {
    if (!this.refreshToken) {
      this.refreshToken = safeGetStorage(REFRESH_TOKEN_COOKIE) ?? getCookie(REFRESH_TOKEN_COOKIE) ?? ''
    }
    return this.refreshToken
  }

  getRefreshTokenExpiryTime(): string {
    if (!this.refreshTokenExpiryTime) {
      this.refreshTokenExpiryTime = safeGetStorage(REFRESH_TOKEN_EXPIRY_COOKIE) ?? getCookie(REFRESH_TOKEN_EXPIRY_COOKIE) ?? ''
    }
    return this.refreshTokenExpiryTime
  }

  isRefreshTokenExpired(): boolean {
    const expiry = this.getRefreshTokenExpiryTime()
    if (!expiry) return false
    const time = parseUtcTimestamp(expiry)
    if (!time) return false
    return Date.now() > time
  }

  isAccessTokenExpired(): boolean {
    const token = this.getAccessToken()
    if (!token) return true
    const exp = decodeJwtExp(token)
    if (!exp) return false
    // Buffer 60 seconds against clock skew and slow network latencies
    return Date.now() >= exp - 60_000
  }

  isExpiringSoon(exp: number, windowSec = 300): boolean {
    return exp - Math.floor(Date.now() / 1000) < windowSec
  }

  saveSession<T>(session: T): void {
    this.cachedSession = session
    try {
      const serialized = JSON.stringify(session)
      let maxAge = 30 * 24 * 60 * 60
      const expiry = this.getRefreshTokenExpiryTime()
      if (expiry) {
        const expTime = parseUtcTimestamp(expiry)
        if (expTime && expTime > Date.now()) {
          maxAge = Math.floor((expTime - Date.now()) / 1000)
        }
      }
      safeSetStorage(SESSION_COOKIE, serialized)
      setCookie(SESSION_COOKIE, serialized, { maxAge })
    } catch {
    }
  }

  getSession<T>(): T | null {
    if (this.cachedSession) {
      return this.cachedSession as T
    }
    try {
      const raw = safeGetStorage(SESSION_COOKIE) ?? getCookie(SESSION_COOKIE)
      if (!raw) return null
      const parsed = JSON.parse(raw) as T
      this.cachedSession = parsed
      return parsed
    } catch {
      safeRemoveStorage(SESSION_COOKIE)
      deleteCookie(SESSION_COOKIE)
      return null
    }
  }

  clearSession(): void {
    this.cachedSession = null
    safeRemoveStorage(SESSION_COOKIE)
    deleteCookie(SESSION_COOKIE)
  }
}
