import type { CountryDto } from '../domain/models/location'

/**
 * Bridge between territory Countries (API) and phone dial codes.
 * All dial data is now loaded from the API (Country.phoneCode).
 * No static fallback — the list is empty until countries are loaded.
 */

export interface MergedDial {
  code: string // ISO2 e.g. AE
  nameEn: string
  nameAr: string
  dial: string // +971
  source: 'api'
  countryId?: string
}

/**
 * Build dial list purely from API countries.
 * Only countries with a non-empty phoneCode are included.
 * Handles duplicate dial+ISO (e.g. +1 for US/CA) by keeping separate entries.
 */
export function buildMergedDials(countries: CountryDto[]): MergedDial[] {
  const byKey = new Map<string, MergedDial>()
  for (const c of countries) {
    if (!c.phoneCode) continue
    const dial = c.phoneCode.trim()
    if (!dial) continue
    const iso = (c.code ?? '').toUpperCase() || 'XX'
    const key = `${dial}:${iso}:${c.id}`
    // avoid duplicate key if same country appears twice
    if (!byKey.has(key)) {
      byKey.set(key, {
        code: iso,
        nameEn: c.nameEn,
        nameAr: c.nameAr,
        dial,
        source: 'api',
        countryId: c.id,
      })
    }
  }
  // If the same dial+ISO appears for multiple countries (US/CA both +1),
  // we keep separate entries via unique key above; for UI we dedupe by dial for selector
  // but keep all for correct flag/name resolution. For selector, uniqueness by dial+code is fine.
  return [...byKey.values()].sort((a, b) => a.dial.localeCompare(b.dial))
}

/** Extract dial prefix from E.164-like string using provided dial list or regex fallback */
export function extractDial(fullPhone: string, dials: MergedDial[] = []): string | null {
  const clean = fullPhone.trim()
  if (!clean.startsWith('+')) return null
  if (dials.length) {
    const sorted = [...dials].sort((a, b) => b.dial.length - a.dial.length)
    for (const d of sorted) {
      if (clean.startsWith(d.dial)) return d.dial
    }
  }
  const m = clean.match(/^(\+\d{1,4})/)
  return m?.[1] ?? null
}

/** Split full phone into dial + national part */
export function splitPhone(fullPhone: string, dials: MergedDial[] = []): { dial: string | null; national: string } {
  if (!fullPhone.trim()) return { dial: null, national: '' }
  const dial = extractDial(fullPhone, dials)
  if (!dial) return { dial: null, national: fullPhone.trim() }
  return { dial, national: fullPhone.trim().slice(dial.length).trim() }
}

/** Validate national number length roughly (6-15 digits) */
export function isValidNational(national: string): boolean {
  const digits = national.replace(/\D/g, '')
  return digits.length >= 6 && digits.length <= 15
}

/** Build E.164 string from dial + national */
export function combinePhone(dial: string, national: string): string {
  const n = national.trim().replace(/^\+/, '').replace(/\s+/g, ' ').trim()
  if (!n) return ''
  const d = dial.trim()
  return `${d} ${n}`.trim()
}

/** Resolve which Country a phone's dial belongs to (API-aware) */
export function resolveCountryForPhone(fullPhone: string, countries: CountryDto[]): CountryDto | undefined {
  const dial = extractDial(fullPhone)
  if (!dial) return undefined
  return countries.find((c) => (c.phoneCode?.trim() ?? '') === dial)
}

/** For register flow: given a selected delivery country, suggest its phoneCode as default dial */
export function suggestedDialForCountry(countryId: string | null | undefined, countries: CountryDto[]): string | null {
  if (!countryId) return null
  const c = countries.find((x) => x.id === countryId)
  return c?.phoneCode?.trim() ?? null
}

/** Group addresses by country for UI — supports many addresses same country or across countries */
export function groupByCountry<T extends { countryId: string }>(items: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const it of items) {
    const arr = m.get(it.countryId) ?? []
    arr.push(it)
    m.set(it.countryId, arr)
  }
  return m
}

/** Convert ISO2 country code to emoji flag */
export function getFlagEmoji(code?: string | null): string {
  if (!code || code.length !== 2) return '🌐'
  const offset = 127397
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => c.charCodeAt(0) + offset))
}

export interface DetailedPhoneInfo {
  dialCode: string
  countryName: string
  iso: string
  flag: string
  nationalNumber: string
  fullFormatted: string
}

/**
 * Universal phone details resolver for all user types.
 * Extracts dial code, country name, flag, and national number.
 */
export function resolvePhoneDetails(
  fullPhone?: string | null,
  countries: CountryDto[] = [],
  locale: string = 'en',
  fallbackCountryId?: string | null,
  explicitDialCode?: string | null,
): DetailedPhoneInfo | null {
  if (!fullPhone || !fullPhone.trim()) return null
  let clean = fullPhone.trim()
  if (clean.startsWith('00')) {
    clean = '+' + clean.slice(2)
  }

  // 1. If explicit dial code from backend is provided (e.g. +966)
  if (explicitDialCode && explicitDialCode.trim()) {
    const rawDial = explicitDialCode.trim()
    const withPlus = rawDial.startsWith('+') ? rawDial : `+${rawDial}`
    const withoutPlus = withPlus.slice(1)
    const matchingCountry = countries.find(
      (c) => (c.phoneCode?.trim() === withPlus) || (c.phoneCode?.trim() === withoutPlus),
    )
    const iso = (matchingCountry?.code || '').toUpperCase()
    const countryName = matchingCountry
      ? (locale === 'ar' ? (matchingCountry.nameAr || matchingCountry.nameEn) : (matchingCountry.nameEn || matchingCountry.nameAr))
      : withPlus

    let national = clean
    if (clean.startsWith(withPlus)) {
      national = clean.slice(withPlus.length).trim()
    } else if (clean.startsWith(withoutPlus)) {
      national = clean.slice(withoutPlus.length).trim()
    }
    national = national.replace(/^0+/, '')

    return {
      dialCode: withPlus,
      countryName,
      iso,
      flag: getFlagEmoji(iso),
      nationalNumber: national,
      fullFormatted: `${withPlus} ${national}`.trim(),
    }
  }

  // Sort countries with non-empty phoneCode by descending length of phoneCode
  const sorted = [...countries]
    .filter((c) => c && c.phoneCode)
    .sort((a, b) => (b.phoneCode?.length ?? 0) - (a.phoneCode?.length ?? 0))

  for (const c of sorted) {
    const rawDial = c.phoneCode?.trim() ?? ''
    if (!rawDial) continue
    const withPlus = rawDial.startsWith('+') ? rawDial : `+${rawDial}`
    const withoutPlus = withPlus.slice(1)

    let matched = false
    let prefixLength = 0

    if (clean.startsWith(withPlus)) {
      matched = true
      prefixLength = withPlus.length
    } else if (clean.startsWith(withoutPlus) && !clean.startsWith('+')) {
      matched = true
      prefixLength = withoutPlus.length
    }

    if (matched) {
      const nationalNumber = clean.slice(prefixLength).trim().replace(/^0+/, '')
      const iso = (c.code || '').toUpperCase()
      const countryName = locale === 'ar' ? (c.nameAr || c.nameEn) : (c.nameEn || c.nameAr)
      return {
        dialCode: withPlus,
        countryName,
        iso,
        flag: getFlagEmoji(iso),
        nationalNumber,
        fullFormatted: `${withPlus} ${nationalNumber}`.trim(),
      }
    }
  }

  // Fallback regex for +digits
  const match = clean.match(/^(\+\d{1,4})(.*)$/)
  if (match && match[1]) {
    const dialCode = match[1]
    const nationalNumber = (match[2] || '').trim().replace(/^0+/, '')
    const foundCountry = countries.find((c) => (c.phoneCode?.trim() ?? '') === dialCode)
    const iso = foundCountry ? (foundCountry.code || '').toUpperCase() : ''
    const countryName = foundCountry
      ? (locale === 'ar' ? (foundCountry.nameAr || foundCountry.nameEn) : (foundCountry.nameEn || foundCountry.nameAr))
      : dialCode
    return {
      dialCode,
      countryName,
      iso,
      flag: getFlagEmoji(iso),
      nationalNumber,
      fullFormatted: `${dialCode} ${nationalNumber}`.trim(),
    }
  }

  // Fallback by countryId if phone is just national digits (e.g. 0501234567)
  if (fallbackCountryId) {
    const fallbackCountry = countries.find((c) => c.id === fallbackCountryId)
    if (fallbackCountry && fallbackCountry.phoneCode) {
      const withPlus = fallbackCountry.phoneCode.startsWith('+')
        ? fallbackCountry.phoneCode.trim()
        : `+${fallbackCountry.phoneCode.trim()}`
      const nationalNumber = clean.replace(/^0+/, '')
      const iso = (fallbackCountry.code || '').toUpperCase()
      const countryName = locale === 'ar'
        ? (fallbackCountry.nameAr || fallbackCountry.nameEn)
        : (fallbackCountry.nameEn || fallbackCountry.nameAr)
      return {
        dialCode: withPlus,
        countryName,
        iso,
        flag: getFlagEmoji(iso),
        nationalNumber,
        fullFormatted: `${withPlus} ${nationalNumber}`.trim(),
      }
    }
  }

  return null
}
