import { ref, onMounted, watch } from 'vue'
import { companyService, locationService, authService } from '../di/container'
import { confirmService } from '../infrastructure/feedback/confirm.service'
import { t, locale } from '../i18n'
import type { CompanyAddressDto } from '../domain/models/address'

export interface CompanyAddressFormData {
  countryId: string
  cityId: string
  zoneId: string
  street: string
  building: string
  floor: string
  apartment: string
  isDefault: boolean
  addressType: number
}

export function useCompanyAddresses() {
  const addresses = companyService.companyAddresses
  const loading = companyService.companyAddressesLoading
  const showModal = ref(false)
  const editingId = ref<string | null>(null)
  const formError = ref('')
  const submitting = ref(false)
  const error = ref('')

  const countries = locationService.countries
  const cities = locationService.cities
  const zones = locationService.zones

  const form = ref<CompanyAddressFormData>({
    countryId: '',
    cityId: '',
    zoneId: '',
    street: '',
    building: '',
    floor: '',
    apartment: '',
    isDefault: false,
    addressType: 3,
  })

  const localized = (en?: string | null, ar?: string | null): string => {
    if (locale.value === 'ar') return ar || en || ''
    return en || ar || ''
  }

  const resetForm = () => {
    form.value = {
      countryId: '',
      cityId: '',
      zoneId: '',
      street: '',
      building: '',
      floor: '',
      apartment: '',
      isDefault: false,
      addressType: 3,
    }
    locationService.clearCities()
    locationService.clearZones()
    editingId.value = null
    formError.value = ''
  }

  const load = async () => {
    error.value = ''
    if (!authService.isAuthenticated) return
    await companyService.loadMyCompany().catch(() => {})
    const cid = companyService.myCompany.value?.id
    if (!cid) {
      error.value = ''
      return
    }
    try {
      await companyService.loadCompanyAddresses(cid)
    } catch (e) {
      error.value = e instanceof Error ? e.message : t('common.loadFailed')
    }
  }

  onMounted(load)

  const openCreate = async () => {
    resetForm()
    showModal.value = true
    await locationService.loadCountries()
  }

  const openEdit = async (addr: CompanyAddressDto) => {
    form.value = {
      countryId: addr.countryId,
      cityId: addr.cityId,
      zoneId: addr.zoneId,
      street: addr.street,
      building: addr.building || '',
      floor: addr.floor || '',
      apartment: addr.apartment || '',
      isDefault: Boolean(addr.isDefault),
      addressType: addr.addressType ?? 3,
    }
    editingId.value = addr.id
    showModal.value = true
    await locationService.loadCountries()
    await locationService.loadCities(addr.countryId)
    await locationService.loadZones(addr.cityId)
  }

  watch(
    () => form.value.countryId,
    async (v, o) => {
      if (!v) {
        locationService.clearCities()
        locationService.clearZones()
        form.value.cityId = ''
        form.value.zoneId = ''
        return
      }
      if (v !== o) {
        form.value.cityId = ''
        form.value.zoneId = ''
        locationService.clearZones()
        await locationService.loadCities(v)
      }
    },
  )

  watch(
    () => form.value.cityId,
    async (v, o) => {
      if (!v) {
        locationService.clearZones()
        form.value.zoneId = ''
        return
      }
      if (v !== o) {
        form.value.zoneId = ''
        await locationService.loadZones(v)
      }
    },
  )

  const handleSubmit = async (): Promise<boolean> => {
    formError.value = ''
    if (!form.value.countryId || !form.value.cityId || !form.value.zoneId || !form.value.street.trim()) {
      formError.value = t('auth.errGeneric')
      return false
    }
    await companyService.loadMyCompany().catch(() => {})
    const cid = companyService.myCompany.value?.id
    if (!cid) {
      formError.value = t('common.error')
      return false
    }

    submitting.value = true
    const payload = {
      companyId: cid,
      countryId: form.value.countryId,
      cityId: form.value.cityId,
      zoneId: form.value.zoneId,
      street: form.value.street.trim(),
      building: form.value.building.trim() || undefined,
      floor: form.value.floor.trim() || undefined,
      apartment: form.value.apartment.trim() || undefined,
      isDefault: form.value.isDefault || undefined,
      addressType: form.value.addressType || undefined,
    }

    let res
    if (editingId.value) {
      res = await companyService.updateCompanyAddress(editingId.value, payload)
    } else {
      res = await companyService.createCompanyAddress(payload)
    }
    submitting.value = false

    if (res.ok) {
      showModal.value = false
      resetForm()
      return true
    } else {
      formError.value = res.error || t('auth.errGeneric')
      return false
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirmService.confirm({
      title: t('profile.deleteAddress'),
      message: t('profile.confirmDelete'),
      variant: 'danger',
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
    })
    if (!ok) return
    await companyService.deleteCompanyAddress(id)
  }

  return {
    addresses,
    loading,
    error,
    showModal,
    editingId,
    form,
    formError,
    submitting,
    countries,
    cities,
    zones,
    localized,
    load,
    openCreate,
    openEdit,
    handleSubmit,
    handleDelete,
    resetForm,
  }
}
