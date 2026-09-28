
export interface CountryRef {
  id: string
  code?: string | null
  nameEn?: string | null
  nameAr?: string | null
  currencyCode?: string | null
  currencyId?: string | null
  currency?: CurrencyRef | null
}

export interface CurrencyRef {
  id?: string | null
  code?: string | null
  symbol?: string | null
  symbolNative?: string | null
  nameEn?: string | null
  nameAr?: string | null
  countryCode?: string | null
  countryId?: string | null
}

export interface AddressRef {
  countryId: string
  countryCode?: string | null
  currencyCode?: string | null
}

export interface ResolvedCurrency {
  code: string
  currencyNameEn: string
  currencyNameAr: string
  countryCode: string
  countryNameEn: string
  countryNameAr: string
  flag: string
  symbol: string
}

export function normalizeCurrencyCode(code?: string | null): string {
  return (code ?? '').trim().toUpperCase()
}
export function getFlagEmoji(countryCode?: string | null): string {
  if (!countryCode) return '🌐'
  const upper = countryCode.trim().toUpperCase()
  if (upper === 'EU') return '🇪🇺'
  if (upper.length !== 2) return '🌐'
  const offset = 127397
  return String.fromCodePoint(...[...upper].map((c) => c.charCodeAt(0) + offset))
}

function readLinkCurrencyCode(ref?: CountryRef | CurrencyRef | AddressRef | null): string {
  if (!ref) return ''
  const withLink = ref as CountryRef & CurrencyRef & AddressRef & {
    currency?: CurrencyRef | null
  }
  return normalizeCurrencyCode(withLink.currencyCode ?? withLink.currency?.code ?? null)
}
export function currencyCodeForCountry(country?: CountryRef | null): string | null {
  return readLinkCurrencyCode(country) || null
}

export function currencyForAddressCountry(
  countries: CountryRef[],
  countryId: string,
): string | null {
  const c = countries.find((x) => x.id === countryId)
  return currencyCodeForCountry(c ?? null)
}
export function distinctCurrenciesFromAddresses(
  addresses: AddressRef[],
  countries: CountryRef[],
): string[] {
  const set = new Set<string>()
  for (const a of addresses) {
    const direct = readLinkCurrencyCode(a)
    if (direct) {
      set.add(direct)
      continue
    }
    const viaCountry = currencyForAddressCountry(countries, a.countryId)
    if (viaCountry) set.add(viaCountry.toUpperCase())
  }
  return [...set]
}

export function findCurrencyByCode<T extends CurrencyRef>(
  currencies: T[],
  code?: string | null,
): T | undefined {
  const upper = normalizeCurrencyCode(code)
  if (!upper) return undefined
  return currencies.find((c) => normalizeCurrencyCode(c.code) === upper)
}

export function currencyDisplaySymbol(currency?: CurrencyRef | null, locale = 'en'): string {
  if (!currency) return '$'
  const code = normalizeCurrencyCode(currency.code)
  const sym = (currency.symbol ?? '').trim()
  const nat = (currency.symbolNative ?? '').trim()
  if (locale === 'ar') return nat || sym || code || '$'
  return sym || nat || code || '$'
}

export function resolveCurrencyCountry(
  currencyCode?: string | null,
  currencies: CurrencyRef[] = [],
  countries: CountryRef[] = [],
  locale = 'en',
): ResolvedCurrency {
  const code = normalizeCurrencyCode(currencyCode)
  const currency = findCurrencyByCode(currencies, code)
  const linkedCountry = code
    ? countries.find((c) => readLinkCurrencyCode(c) === code)
    : undefined
  const linkedByCurrency =
    !linkedCountry && currency?.countryCode
      ? countries.find(
          (c) => (c.code ?? '').trim().toUpperCase() === normalizeCurrencyCode(currency.countryCode),
        )
      : undefined
  const country = linkedCountry ?? linkedByCurrency

  const currencyNameEn = (currency?.nameEn ?? '').trim() || code
  const currencyNameAr = (currency?.nameAr ?? '').trim() || currencyNameEn
  const countryCode = (country?.code ?? '').trim().toUpperCase()
  const countryNameEn = (country?.nameEn ?? '').trim()
  const countryNameAr = (country?.nameAr ?? '').trim() || countryNameEn

  return {
    code,
    currencyNameEn,
    currencyNameAr,
    countryCode,
    countryNameEn,
    countryNameAr,
    flag: countryCode ? getFlagEmoji(countryCode) : '🌐',
    symbol: currencyDisplaySymbol(currency ?? { code }, locale),
  }
}
