import { USER_MANAGEMENT_ROUTES } from '../../config/api.config'
import type { LocationRepository } from '../../domain/ports/location-repository'
import type {
  CityDto,
  CountryDto,
  ZoneDto,
  CreateCountryPayload,
  UpdateCountryPayload,
  CreateCityPayload,
  UpdateCityPayload,
  CreateZonePayload,
  UpdateZonePayload,
} from '../../domain/models/location'
import type { HttpClient } from '../../infrastructure/http/http-client'

function extractArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[]
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.data)) return obj.data as T[]
    if (Array.isArray(obj.Data)) return obj.Data as T[]
    if (Array.isArray(obj.items)) return obj.items as T[]
    if (Array.isArray(obj.Items)) return obj.Items as T[]
  }
  return []
}

export class ApiLocationRepository implements LocationRepository {
  constructor(private readonly http: HttpClient) {}

  async getCountries(): Promise<CountryDto[]> {
    const data = await this.http.get<CountryDto[] | { data: CountryDto[] }>(USER_MANAGEMENT_ROUTES.countries, {
      showFeedback: false,
    })
    return extractArray<CountryDto>(data as unknown)
  }

  async getCountryById(id: string): Promise<CountryDto> {
    return await this.http.get<CountryDto>(USER_MANAGEMENT_ROUTES.countryById(id), { showFeedback: false })
  }
  async createCountry(payload: CreateCountryPayload): Promise<CountryDto> {
    return await this.http.post<CountryDto>(USER_MANAGEMENT_ROUTES.countries, payload, { showFeedback: false })
  }
  async updateCountry(id: string, payload: UpdateCountryPayload): Promise<CountryDto> {
    return await this.http.put<CountryDto>(USER_MANAGEMENT_ROUTES.countryById(id), { id, ...payload }, { showFeedback: false })
  }
  async deleteCountry(id: string): Promise<void> {
    return await this.http.del<void>(USER_MANAGEMENT_ROUTES.countryById(id), { showFeedback: false })
  }

  async getCities(countryId?: string): Promise<CityDto[]> {
    const path = countryId
      ? `${USER_MANAGEMENT_ROUTES.cities}?countryId=${encodeURIComponent(countryId)}`
      : USER_MANAGEMENT_ROUTES.cities
    const data = await this.http.get<CityDto[] | { data: CityDto[] }>(path, { showFeedback: false })
    return extractArray<CityDto>(data as unknown)
  }

  async getCitiesByCountry(countryId: string): Promise<CityDto[]> {
    const data = await this.http.get<CityDto[] | { data: CityDto[] }>(
      USER_MANAGEMENT_ROUTES.citiesByCountry(countryId),
      { showFeedback: false },
    )
    return extractArray<CityDto>(data as unknown)
  }

  async getCityById(id: string): Promise<CityDto> {
    return await this.http.get<CityDto>(USER_MANAGEMENT_ROUTES.cityById(id), { showFeedback: false })
  }
  async createCity(payload: CreateCityPayload): Promise<CityDto> {
    return await this.http.post<CityDto>(USER_MANAGEMENT_ROUTES.cities, payload, { showFeedback: false })
  }
  async updateCity(id: string, payload: UpdateCityPayload): Promise<CityDto> {
    return await this.http.put<CityDto>(USER_MANAGEMENT_ROUTES.cityById(id), { id, ...payload }, { showFeedback: false })
  }
  async deleteCity(id: string): Promise<void> {
    return await this.http.del<void>(USER_MANAGEMENT_ROUTES.cityById(id), { showFeedback: false })
  }

  async getZones(cityId?: string): Promise<ZoneDto[]> {
    const path = cityId
      ? `${USER_MANAGEMENT_ROUTES.zones}?cityId=${encodeURIComponent(cityId)}`
      : USER_MANAGEMENT_ROUTES.zones
    const data = await this.http.get<ZoneDto[] | { data: ZoneDto[] }>(path, { showFeedback: false })
    return extractArray<ZoneDto>(data as unknown)
  }

  async getZonesByCity(cityId: string): Promise<ZoneDto[]> {
    const data = await this.http.get<ZoneDto[] | { data: ZoneDto[] }>(
      USER_MANAGEMENT_ROUTES.zonesByCity(cityId),
      { showFeedback: false },
    )
    return extractArray<ZoneDto>(data as unknown)
  }

  async getZoneById(id: string): Promise<ZoneDto> {
    return await this.http.get<ZoneDto>(USER_MANAGEMENT_ROUTES.zoneById(id), { showFeedback: false })
  }
  async createZone(payload: CreateZonePayload): Promise<ZoneDto> {
    return await this.http.post<ZoneDto>(USER_MANAGEMENT_ROUTES.zones, payload, { showFeedback: false })
  }
  async updateZone(id: string, payload: UpdateZonePayload): Promise<ZoneDto> {
    return await this.http.put<ZoneDto>(USER_MANAGEMENT_ROUTES.zoneById(id), { id, ...payload }, { showFeedback: false })
  }
  async deleteZone(id: string): Promise<void> {
    return await this.http.del<void>(USER_MANAGEMENT_ROUTES.zoneById(id), { showFeedback: false })
  }
}
