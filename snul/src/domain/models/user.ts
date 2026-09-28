export enum UserType {
  Admin = 1,
  OrganizationUser = 2,
  SnulStaff = 3,
  Sales = 3,
  Client = 4,
}

export enum AppLanguage {
  En = 1,
  Ar = 2,
}

/** Backend-persisted UI mode per user (mirrors AppLanguage numbering). */
export enum ThemeMode {
  White = 1,
  Dark = 2,
}

/** Light-only mode: the site is always white. Backend enum is kept for
 * API compatibility, but every value normalizes to White. */
export function normalizeThemeMode(_value: unknown): ThemeMode | null {
  return ThemeMode.White
}

export interface User {
  id: string
  fullName: string
  email: string
  phoneNumber?: string | null
  phoneCode?: string | null
  profilePictureName?: string | null
  userType: UserType
  language: AppLanguage
  /** Backend-persisted UI mode; null until the backend exposes the column. */
  themeMode?: ThemeMode | null
  isEmailConfirmed: boolean
  createdAt: string
  updatedAt?: string | null
  roles: string[]
  companyId?: string | null
  company?: import('./company').CompanyDto | null
  tint?: string
}

export interface AuthResponseDto {
  userId: string
  fullName: string
  email: string
  userName?: string | null
  userType: UserType
  language: AppLanguage
  themeMode?: ThemeMode | null
  roles: string[]
  companyId?: string | null
  accessToken: string
  refreshToken: string
  refreshTokenExpiryTime: string
}

export interface UserProfileDto {
  userId: string
  fullName: string
  email: string
  phoneNumber?: string | null
  phoneCode?: string | null
  profilePictureName?: string | null
  userType: UserType
  language: AppLanguage
  themeMode?: ThemeMode | null
  isEmailConfirmed: boolean
  createdAt: string
  roles: string[]
  companyId?: string | null
  company?: import('./company').CompanyDto | null
  addresses: import('./address').UserAddressDto[]
}

export interface UserDto {
  id: string
  fullName: string
  email: string
  phoneNumber?: string | null
  phoneCode?: string | null
  profilePictureName?: string | null
  userType: UserType
  language: AppLanguage
  themeMode?: ThemeMode | null
  isActive: boolean
  isEmailConfirmed: boolean
  createdAt: string
  updatedAt?: string | null
  roles: string[]
  companyId?: string | null
  company?: import('./company').CompanyDto | null
}

export interface UserDetailsDto extends UserDto {
  addresses: import('./address').UserAddressDto[]
  companyId?: string | null
  company?: import('./company').CompanyDto | null
}

export interface CreateUserPayload {
  fullName: string
  email: string
  phoneNumber?: string
  password: string
  userType?: UserType
  profilePictureName?: string | null
  isActive?: boolean
}

export interface UpdateUserPayload {
  fullName?: string
  phoneNumber?: string
  profilePictureName?: string | null
  userType?: UserType
  isActive?: boolean
}

export const USER_TINTS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'] as const

export const USER_TYPE_ROLE_KEY = (
  userType: UserType,
): 'roleAdmin' | 'roleSales' | 'roleProvider' | 'roleClient' =>
  userType === UserType.Admin
    ? 'roleAdmin'
    : userType === UserType.SnulStaff
      ? 'roleSales'
      : userType === UserType.OrganizationUser
        ? 'roleProvider'
        : 'roleClient'
