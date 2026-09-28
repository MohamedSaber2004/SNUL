import { computed } from 'vue'
import { authService, companyService } from '../di/container'
import { t } from '../i18n'
import {
  BusinessRole,
  businessRoleKey,
  isProviderCompany,
  resolveBusinessRole,
  type BusinessRoleContext,
} from '../domain/models/business-role'


export function useBusinessRole() {
  const user = computed(() => authService.user.value)
  const providerCompany = computed(() => companyService.myCompany.value ?? null)

  const ctx = computed<BusinessRoleContext>(() => ({
    userType: user.value?.userType ?? null,
    roles: user.value?.roles ?? [],
    companyId: user.value?.companyId ?? null,
    company: providerCompany.value,
  }))

  const role = computed<BusinessRole>(() => resolveBusinessRole(ctx.value))

  const roleLabel = computed(() => t(`admin.${businessRoleKey(role.value)}`))

  const isAdmin = computed(() => role.value === BusinessRole.Admin)
  const isSales = computed(() => role.value === BusinessRole.Sales)
  const isProvider = computed(() => role.value === BusinessRole.Provider)
  const isClient = computed(() => role.value === BusinessRole.Client)
  const isBuyer = computed(() => isClient.value)
  const isSeller = computed(() => isProvider.value)
  const isStaff = computed(() => isAdmin.value || isSales.value)
  const isProviderCompanyLinked = computed(() => isProviderCompany(providerCompany.value))

  return {
    role,
    roleLabel,
    providerCompany,
    isAdmin,
    isSales,
    isStaff,
    isProvider,
    isClient,
    isBuyer,
    isSeller,
    isProviderCompanyLinked,
  }
}