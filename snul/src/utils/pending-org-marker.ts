const STORAGE_KEY = 'snul-pending-org'
const LEGACY_STORAGE_KEY = 'welco-pending-org'

const normalize = (email?: string | null): string => (email ?? '').trim().toLowerCase()

export function setPendingOrg(email: string): void {
  try {
    const v = normalize(email)
    if (v) {
      localStorage.setItem(STORAGE_KEY, v)
      localStorage.setItem(LEGACY_STORAGE_KEY, v)
    }
  } catch {
  }
}

export function isPendingOrg(email?: string | null): boolean {
  try {
    const v = normalize(email)
    return !!v && (localStorage.getItem(STORAGE_KEY) === v || localStorage.getItem(LEGACY_STORAGE_KEY) === v)
  } catch {
    return false
  }
}

export function clearPendingOrg(email?: string | null): void {
  try {
    const current = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!email || normalize(current) === normalize(email)) {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
  } catch {
  }
}

export function syncPendingOrgMarker(user?: { email?: string | null; companyId?: string | null } | null): void {
  if (!user) return
  if (user.companyId) clearPendingOrg(user.email)
}
