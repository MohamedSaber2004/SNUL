import { ref, computed, onMounted, watch } from 'vue'
import { locationService } from '../di/container'
import { locale, t } from '../i18n'
import type { CountryDto } from '../domain/models/location'

export function useLocations() {
  const selectedCountry = ref('')
  const selectedCity = ref('')
  const searchQuery = ref('')
  const error = ref('')

  const countries = locationService.countries
  const cities = locationService.cities
  const zones = locationService.zones
  const loading = locationService.loading

  const localized = (en?: string | null, ar?: string | null): string => {
    if (locale.value === 'ar') return ar || en || ''
    return en || ar || ''
  }

  const loadCountries = async () => {
    error.value = ''
    try {
      await locationService.loadCountries()
    } catch (e) {
      error.value = e instanceof Error ? e.message : t('common.loadFailed')
    }
  }

  onMounted(loadCountries)

  watch(selectedCountry, async (countryId) => {
    selectedCity.value = ''
    locationService.clearZones()
    if (countryId) {
      try {
        await locationService.loadCities(countryId)
      } catch (e) {
        error.value = e instanceof Error ? e.message : t('common.loadFailed')
      }
    } else {
      locationService.clearCities()
    }
  })

  watch(selectedCity, async (cityId) => {
    if (cityId) {
      try {
        await locationService.loadZones(cityId)
      } catch (e) {
        error.value = e instanceof Error ? e.message : t('common.loadFailed')
      }
    } else {
      locationService.clearZones()
    }
  })

  const filteredCountries = computed<CountryDto[]>(() => {
    const rawList = Array.isArray(countries.value) ? countries.value : []
    if (!searchQuery.value.trim()) return rawList
    const q = searchQuery.value.toLowerCase().trim()
    return rawList.filter((c) => {
      if (!c) return false
      const matchEn = c.nameEn ? String(c.nameEn).toLowerCase().includes(q) : false
      const matchAr = c.nameAr ? String(c.nameAr).toLowerCase().includes(q) : false
      const matchCode = c.code ? String(c.code).toLowerCase().includes(q) : false
      return matchEn || matchAr || matchCode
    })
  })

  const resetSelection = () => {
    selectedCountry.value = ''
    selectedCity.value = ''
    locationService.clearCities()
    locationService.clearZones()
  }

  return {
    selectedCountry,
    selectedCity,
    searchQuery,
    error,
    loading,
    countries,
    cities,
    zones,
    filteredCountries,
    localized,
    loadCountries,
    resetSelection,
  }
}
