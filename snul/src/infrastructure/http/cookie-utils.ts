export interface CookieOptions {
  path?: string
  maxAge?: number
  expires?: Date
  sameSite?: 'Lax' | 'Strict' | 'None'
  secure?: boolean
  domain?: string
}

const isClient = typeof document !== 'undefined'

export function getCookie(name: string): string | null {
  if (!isClient) return null
  const encodedName = encodeURIComponent(name)
  const cookies = document.cookie ? document.cookie.split(/;\s*/) : []
  for (const cookie of cookies) {
    const equalIdx = cookie.indexOf('=')
    if (equalIdx === -1) continue
    const key = cookie.slice(0, equalIdx).trim()
    if (key === encodedName) {
      const val = cookie.slice(equalIdx + 1)
      try {
        return decodeURIComponent(val)
      } catch {
        return val
      }
    }
  }
  return null
}

export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  if (!isClient) return
  const {
    path = '/',
    maxAge,
    expires,
    sameSite = 'Lax',
    secure = typeof window !== 'undefined' && window.location.protocol === 'https:',
    domain,
  } = options

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=${path}; SameSite=${sameSite}`

  if (typeof maxAge === 'number' && Number.isFinite(maxAge)) {
    cookieString += `; max-age=${Math.max(0, Math.floor(maxAge))}`
  }

  if (expires instanceof Date && !Number.isNaN(expires.getTime())) {
    cookieString += `; expires=${expires.toUTCString()}`
  }

  if (secure) {
    cookieString += '; Secure'
  }

  if (domain) {
    cookieString += `; domain=${domain}`
  }

  document.cookie = cookieString
}

export function deleteCookie(name: string, path = '/'): void {
  if (!isClient) return
  setCookie(name, '', {
    path,
    maxAge: 0,
    expires: new Date(0),
  })
}
