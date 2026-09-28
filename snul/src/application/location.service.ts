import { ref, computed } from 'vue'
import type { CityDto, CountryDto, ZoneDto } from '../domain/models/location'
import type { LocationRepository } from '../domain/ports/location-repository'
import { buildMergedDials, type MergedDial } from '../utils/phone'

export class LocationService {
  readonly countries = ref<CountryDto[]>([])
  readonly cities = ref<CityDto[]>([])
  readonly zones = ref<ZoneDto[]>([])
  readonly loading = ref(false)

  private readonly repo: LocationRepository
  private loadedCountries = false
  private inFlightCountries: Promise<void> | null = null

  constructor(repo: LocationRepository) {
    this.repo = repo
  }

  async loadCountries(force = false): Promise<void> {
    if (this.loadedCountries && !force) return
    if (this.inFlightCountries && !force) return this.inFlightCountries
    this.loading.value = true
    this.inFlightCountries = (async () => {
      try {
        this.countries.value = await this.repo.getCountries()
        this.loadedCountries = true
      } catch {
        // repo now returns fallback instead of throwing for 404, but keep guard
        if (!this.countries.value.length) this.loadedCountries = true
      } finally {
        this.loading.value = false
        this.inFlightCountries = null
      }
    })()
    return this.inFlightCountries
  }

  // — sync helpers for admin CRUD — invalidates cache and keeps global state in sync
  private emitChange(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('snul:location-changed'))
      window.dispatchEvent(new CustomEvent('welco:location-changed'))
    }
  }
  upsertCountry(dto: CountryDto): void {
    const i = this.countries.value.findIndex((x) => x.id === dto.id)
    if (i >= 0) this.countries.value[i] = dto
    else this.countries.value = [dto, ...this.countries.value]
    this.loadedCountries = true
    this.emitChange()
  }
  removeCountry(id: string): void {
    this.countries.value = this.countries.value.filter((x) => x.id !== id)
    this.emitChange()
  }
  upsertCity(dto: CityDto): void {
    const i = this.cities.value.findIndex((x) => x.id === dto.id)
    if (i >= 0) this.cities.value[i] = dto
    else this.cities.value = [dto, ...this.cities.value]
    this.emitChange()
  }
  removeCity(id: string): void {
    this.cities.value = this.cities.value.filter((x) => x.id !== id)
    this.emitChange()
  }
  upsertZone(dto: ZoneDto): void {
    const i = this.zones.value.findIndex((x) => x.id === dto.id)
    if (i >= 0) this.zones.value[i] = dto
    else this.zones.value = [dto, ...this.zones.value]
    this.emitChange()
  }
  removeZone(id: string): void {
    this.zones.value = this.zones.value.filter((x) => x.id !== id)
    this.emitChange()
  }
  invalidateAll(): void {
    this.loadedCountries = false
    this.emitChange()
  }

  async loadCities(countryId?: string): Promise<void> {
    this.loading.value = true
    try {
      if (countryId) {
        this.cities.value = await this.repo.getCitiesByCountry(countryId)
      } else {
        this.cities.value = await this.repo.getCities()
      }
    } finally {
      this.loading.value = false
    }
  }

  async loadZones(cityId?: string): Promise<void> {
    this.loading.value = true
    try {
      if (cityId) {
        this.zones.value = await this.repo.getZonesByCity(cityId)
      } else {
        this.zones.value = await this.repo.getZones()
      }
    } finally {
      this.loading.value = false
    }
  }

  clearCities(): void {
    this.cities.value = []
  }

  clearZones(): void {
    this.zones.value = []
  }

  // ── Phone ↔ Country bridge ────────────────────────────────────────────
  /** Merged dial codes derived purely from API Countries (phoneCode) — no static fallback */
  readonly mergedDials = computed<MergedDial[]>(() => buildMergedDials(this.countries.value))

  getCountryById(id: string): CountryDto | undefined {
    return this.countries.value.find((c) => c.id === id)
  }

  getCountryPhoneCode(countryId: string): string | null {
    return this.getCountryById(countryId)?.phoneCode?.trim() ?? null
  }

  getCountryIso(countryId: string): string | null {
    return this.getCountryById(countryId)?.code?.trim() ?? null
  }

  /** Given a phone like "+971 50 123 4567", find matching Country */
  findCountryByPhone(phone: string): CountryDto | undefined {
    const trimmed = phone.trim()
    if (!trimmed.startsWith('+')) return undefined
    // longest dial first
    const sorted = [...this.countries.value]
      .filter((c) => c.phoneCode)
      .sort((a, b) => (b.phoneCode!.length ?? 0) - (a.phoneCode!.length ?? 0))
    for (const c of sorted) {
      if (trimmed.startsWith(c.phoneCode!.trim())) return c
    }
    return undefined
  }

  /** Group address-like items by country for UI (many addresses same/different country) */
  groupByCountry<T extends { countryId: string }>(items: T[]): Map<string, T[]> {
    const m = new Map<string, T[]>()
    for (const it of items) {
      const arr = m.get(it.countryId) ?? []
      arr.push(it)
      m.set(it.countryId, arr)
    }
    return m
  }
}
