import { AppLanguage, ThemeMode, UserType } from './user'
export { AppLanguage, ThemeMode, UserType }
import type { CompanyType } from './company'

export interface RegisterPayload {
  fullName: string
  email: string
  password: string
  confirmPassword: string
  phoneNumber?: string
  phoneCountryId?: string
  phoneCountryCode?: string
  userType?: UserType
  language?: AppLanguage
  // Unified distributor application (OrganizationUser)
  companyType?: CompanyType
  companyName?: string
  companyEmail?: string
  distributorCountryId?: string
  salesVolumeBand?: string
  website?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface LogoutPayload {
  refreshToken?: string
}

export interface VerifyEmailOtpPayload {
  email: string
  otpCode: string
}

export interface ResendRegisterOtpPayload {
  email: string
}

export interface ForgotPasswordPayload {
  email: string
}

export interface VerifyPasswordOtpPayload {
  email: string
  otpCode: string
}

export interface ResetPasswordPayload {
  email: string
  token: string
  newPassword: string
  confirmNewPassword: string
}

export interface RefreshTokenPayload {
  refreshToken: string
}

export interface UpdateProfilePayload {
  fullName?: string
  phoneNumber?: string
  profilePictureName?: string
  language?: AppLanguage
  themeMode?: ThemeMode
  addresses?: UpdateProfileAddressDto[]
}

export interface UpdateProfileAddressDto {
  id?: string
  countryId: string
  cityId: string
  zoneId: string
  street: string
  building?: string | null
  floor?: string | null
  apartment?: string | null
  addressType?: number | null
  isDefault?: boolean | null
}
