export enum AddressType {
  Shipping = 1,
  Billing = 2,
  Both = 3,
}

export interface UserAddressDto {
  id: string
  userId: string
  countryId: string
  countryNameEn?: string | null
  countryNameAr?: string | null
  countryCode?: string | null
  countryPhoneCode?: string | null
  cityId: string
  cityNameEn?: string | null
  cityNameAr?: string | null
  zoneId: string
  zoneNameEn?: string | null
  zoneNameAr?: string | null
  street: string
  building?: string | null
  floor?: string | null
  apartment?: string | null
  addressType?: AddressType
  isDefault?: boolean
  createdAt: string
  updatedAt?: string | null
}

export interface CreateAddressPayload {
  userId?: string
  countryId: string
  cityId: string
  zoneId: string
  street: string
  building?: string
  floor?: string
  apartment?: string
  addressType?: AddressType
  isDefault?: boolean
}

export interface UpdateAddressPayload {
  countryId?: string
  cityId?: string
  zoneId?: string
  street?: string
  building?: string | null
  floor?: string | null
  apartment?: string | null
  addressType?: AddressType
  isDefault?: boolean
}

/** Company address — mirrors UserAddress but owned by Company instead of User */
export interface CompanyAddressDto {
  id: string
  companyId: string
  countryId: string
  countryNameEn?: string | null
  countryNameAr?: string | null
  countryCode?: string | null
  countryPhoneCode?: string | null
  cityId: string
  cityNameEn?: string | null
  cityNameAr?: string | null
  zoneId: string
  zoneNameEn?: string | null
  zoneNameAr?: string | null
  street: string
  building?: string | null
  floor?: string | null
  apartment?: string | null
  addressType?: AddressType
  isDefault?: boolean
  isActive?: boolean
  createdAt: string
  updatedAt?: string | null
}

export interface CreateCompanyAddressPayload {
  companyId: string
  countryId: string
  cityId: string
  zoneId: string
  street: string
  building?: string
  floor?: string
  apartment?: string
  addressType?: AddressType
  isDefault?: boolean
}

export interface UpdateCompanyAddressPayload {
  countryId?: string
  cityId?: string
  zoneId?: string
  street?: string
  building?: string | null
  floor?: string | null
  apartment?: string | null
  addressType?: AddressType
  isDefault?: boolean
}

export const ADDRESS_TYPE_LABEL: Record<AddressType, string> = {
  [AddressType.Shipping]: 'Shipping',
  [AddressType.Billing]: 'Billing',
  [AddressType.Both]: 'Both',
}
