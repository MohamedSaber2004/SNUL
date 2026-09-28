import { UserType } from './user'
import { CompanyStatus, type CompanyDto } from './company'

export enum BusinessRole {
  Admin = 'Admin',
  Sales = 'Sales',
  Provider = 'Provider',
  Client = 'Client',
}

export const DistributorBusinessRole = BusinessRole.Provider

export interface BusinessRoleContext {
  userType?: UserType | number | null
  roles?: string[] | null
  companyId?: string | null
  company?: CompanyDto | null
}

const roleList = (ctx: BusinessRoleContext): string[] =>
  (ctx.roles ?? []).map((r) => String(r).toLowerCase())

const isApprovedStatus = (status?: CompanyDto['status'] | string | number | null): boolean =>
  status === CompanyStatus.Approved || status === 'Approved' || status === 2 || status === '2'

export function isAdminContext(ctx: BusinessRoleContext): boolean {
  return roleList(ctx).includes('admin') || ctx.userType === UserType.Admin || ctx.userType === 1
}

export function isSalesRole(role: string | null | undefined): boolean {
  if (typeof role !== 'string') return false
  const n = role.trim().toLowerCase()
  return n === 'welcostaff' || n === 'snulstaff' || n === 'sales'
}

export function isSalesContext(ctx: BusinessRoleContext): boolean {
  return (
    roleList(ctx).some((r) => isSalesRole(r)) ||
    ctx.userType === UserType.SnulStaff ||
    ctx.userType === 3
  )
}

export function isOrganizationUserContext(ctx: BusinessRoleContext): boolean {
  return (
    roleList(ctx).some((r) => ['organizationuser', 'provider', 'distributor', 'supplier'].includes(r)) ||
    ctx.userType === UserType.OrganizationUser ||
    ctx.userType === 2
  )
}

export function isProviderContext(ctx: BusinessRoleContext): boolean {
  if (isAdminContext(ctx) || isSalesContext(ctx)) return false
  return (
    isOrganizationUserContext(ctx) ||
    roleList(ctx).some((r) => ['provider', 'distributor', 'supplier'].includes(r)) ||
    !!(ctx.companyId || ctx.company)
  )
}

export const isDistributorContext = isProviderContext

export function isClientContext(ctx: BusinessRoleContext): boolean {
  if (isAdminContext(ctx) || isSalesContext(ctx) || isProviderContext(ctx)) return false
  return (
    ctx.userType === UserType.Client ||
    ctx.userType === 4 ||
    roleList(ctx).some((r) => ['client', 'buyer', 'customer'].includes(r)) ||
    true
  )
}

export function isCustomerContext(ctx: BusinessRoleContext): boolean {
  return isClientContext(ctx)
}

export function resolveBusinessRole(ctx: BusinessRoleContext): BusinessRole {
  if (isAdminContext(ctx)) return BusinessRole.Admin
  if (isSalesContext(ctx)) return BusinessRole.Sales
  if (isProviderContext(ctx)) return BusinessRole.Provider
  return BusinessRole.Client
}

export type BusinessRoleKey = 'roleAdmin' | 'roleSales' | 'roleProvider' | 'roleClient'

export function businessRoleKey(role: BusinessRole): BusinessRoleKey {
  switch (role) {
    case BusinessRole.Admin:
      return 'roleAdmin'
    case BusinessRole.Sales:
      return 'roleSales'
    case BusinessRole.Provider:
      return 'roleProvider'
    case BusinessRole.Client:
    default:
      return 'roleClient'
  }
}

export function resolveBusinessRoleKey(ctx: BusinessRoleContext): BusinessRoleKey {
  return businessRoleKey(resolveBusinessRole(ctx))
}

export function isProviderCompany(company?: CompanyDto | null): boolean {
  return !!company?.id
}

export function resolveProviderCompany(ctx: BusinessRoleContext): CompanyDto | null {
  if (isAdminContext(ctx) || isSalesContext(ctx)) return null
  if (!isOrganizationUserContext(ctx)) return null
  return ctx.company ?? null
}

export function canAccessB2B(ctx: BusinessRoleContext): boolean {
  if (isAdminContext(ctx) || isSalesContext(ctx)) return true
  if (!isProviderContext(ctx)) return false
  if (ctx.company) return isApprovedStatus(ctx.company.status)
  return true
}