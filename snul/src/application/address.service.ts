import { ref } from 'vue'
import type { CreateAddressPayload, UpdateAddressPayload, UserAddressDto } from '../domain/models/address'
import type { UpdateProfileAddressDto } from '../domain/models/auth'
import type { AddressRepository } from '../domain/ports/address-repository'
import type { AuthService } from './auth.service'
import { toastService } from '../infrastructure/feedback/toast.service'
import { t } from '../i18n'

const toUpdateDto = (
  a: UserAddressDto | CreateAddressPayload | (UpdateAddressPayload & { id?: string }),
): UpdateProfileAddressDto => ({
  id: 'id' in a ? a.id : undefined,
  countryId: a.countryId || '',
  cityId: a.cityId || '',
  zoneId: a.zoneId || '',
  street: a.street || '',
  building: a.building ?? null,
  floor: a.floor ?? null,
  apartment: a.apartment ?? null,
  addressType: (a as UserAddressDto).addressType ?? (a as CreateAddressPayload).addressType ?? null,
  isDefault: (a as UserAddressDto).isDefault ?? (a as CreateAddressPayload).isDefault ?? null,
})

export class AddressService {
  readonly addresses = ref<UserAddressDto[]>([])
  readonly loading = ref(false)

  private readonly repo: AddressRepository
  private readonly authService: AuthService

  constructor(repo: AddressRepository, authService: AuthService) {
    this.repo = repo
    this.authService = authService
  }

  async refresh(): Promise<void> {
    if (!this.authService.isAuthenticated) {
      this.addresses.value = []
      return
    }
    this.loading.value = true
    try {
      const res = await this.authService.loadProfile()
      if (res.ok && res.profile?.addresses) {
        this.addresses.value = res.profile.addresses
        return
      }
      const userId = this.authService.user.value?.id
      if (userId && this.authService.isAdmin.value) {
        this.addresses.value = await this.repo.getUserAddresses(userId)
      }
    } catch {
      this.addresses.value = []
    } finally {
      this.loading.value = false
    }
  }

  async create(payload: CreateAddressPayload): Promise<boolean> {
    try {
      // 1. Doctor / Self workflow via /api/v1/auth/profile
      const current = this.addresses.value.map(toUpdateDto)
      const newAddressDto = toUpdateDto(payload)
      const updatedList = [...current, newAddressDto]
      const res = await this.authService.updateProfile({ addresses: updatedList })
      if (res.ok && res.profile?.addresses) {
        this.addresses.value = res.profile.addresses
        return true
      }
      // 2. Admin dashboard workflow via user-management service
      const userId = payload.userId || this.authService.user.value?.id
      if (userId && this.authService.isAdmin.value) {
        const created = await this.repo.createAddress({ ...payload, userId })
        this.addresses.value = [...this.addresses.value, created]
        return true
      }
      return res.ok
    } catch {
      return false
    }
  }

  async update(id: string, payload: UpdateAddressPayload): Promise<boolean> {
    try {
      const updatedList = this.addresses.value.map((a) => (a.id === id ? toUpdateDto({ ...a, ...payload }) : toUpdateDto(a)))
      const res = await this.authService.updateProfile({ addresses: updatedList })
      if (res.ok && res.profile?.addresses) {
        this.addresses.value = res.profile.addresses
        return true
      }
      if (this.authService.isAdmin.value) {
        const updated = await this.repo.updateAddress(id, payload)
        this.addresses.value = this.addresses.value.map((a) => (a.id === id ? updated : a))
        return true
      }
      return res.ok
    } catch {
      return false
    }
  }

  async remove(id: string): Promise<boolean> {
    try {
      const updatedList = this.addresses.value.filter((a) => a.id !== id).map(toUpdateDto)
      const res = await this.authService.updateProfile({ addresses: updatedList })
      if (res.ok && res.profile?.addresses) {
        this.addresses.value = res.profile.addresses
        return true
      }
      if (this.authService.isAdmin.value) {
        await this.repo.deleteAddress(id)
        this.addresses.value = this.addresses.value.filter((a) => a.id !== id)
        toastService.success(t('profile.savedToast'))
        return true
      }
      return res.ok
    } catch {
      return false
    }
  }

  clear(): void {
    this.addresses.value = []
  }
}
