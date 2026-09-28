export interface CountryDto {
  id: string
  nameEn: string
  nameAr: string
  code?: string | null
  phoneCode?: string | null
  isActive: boolean
  createdAt: string
}

export interface CityDto {
  id: string
  countryId: string
  countryNameEn?: string | null
  countryNameAr?: string | null
  nameEn: string
  nameAr: string
  isActive: boolean
  createdAt: string
}

export interface ZoneDto {
  id: string
  cityId: string
  cityNameEn?: string | null
  cityNameAr?: string | null
  nameEn: string
  nameAr: string
  isActive: boolean
  createdAt: string
}

export interface CreateCountryPayload {
  nameEn: string
  nameAr: string
  code?: string
  phoneCode?: string
}

export interface UpdateCountryPayload {
  nameEn?: string
  nameAr?: string
  code?: string
  phoneCode?: string
  isActive?: boolean
}

export interface CreateCityPayload {
  countryId: string
  nameEn: string
  nameAr: string
}

export interface UpdateCityPayload {
  countryId?: string
  nameEn?: string
  nameAr?: string
  isActive?: boolean
}

export interface CreateZonePayload {
  cityId: string
  nameEn: string
  nameAr: string
}

export interface UpdateZonePayload {
  cityId?: string
  nameEn?: string
  nameAr?: string
  isActive?: boolean
}

export function localizedName(
  item: { nameEn: string; nameAr: string },
  locale: string,
): string {
  return locale === 'ar' ? item.nameAr : item.nameEn
}

/** Helpers for Country ↔ phoneCode linkage */
export function countryDialCode(country: CountryDto): string | null {
  return country.phoneCode?.trim() || null
}

export function countryIsoCode(country: CountryDto): string | null {
  return country.code?.trim() || null
}

export function findCountryByPhoneCode(countries: CountryDto[], dial: string): CountryDto | undefined {
  const clean = dial.trim()
  return countries.find((c) => (c.phoneCode?.trim() ?? '') === clean)
}

export function findCountryByIso(countries: CountryDto[], iso: string): CountryDto | undefined {
  const clean = iso.trim().toLowerCase()
  return countries.find((c) => (c.code?.trim().toLowerCase() ?? '') === clean)
}

export interface PaginatedResult<T> {
  isSuccess: boolean
  data: T[]
  totalCount: number
  pageNumber: number
  pageSize: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  message: string
  statusCode: number
}
