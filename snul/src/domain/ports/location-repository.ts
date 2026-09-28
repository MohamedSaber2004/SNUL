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
} from '../models/location'

export interface LocationRepository {
  getCountries(): Promise<CountryDto[]>
  getCountryById(id: string): Promise<CountryDto>
  createCountry(payload: CreateCountryPayload): Promise<CountryDto>
  updateCountry(id: string, payload: UpdateCountryPayload): Promise<CountryDto>
  deleteCountry(id: string): Promise<void>

  getCities(countryId?: string): Promise<CityDto[]>
  getCitiesByCountry(countryId: string): Promise<CityDto[]>
  getCityById(id: string): Promise<CityDto>
  createCity(payload: CreateCityPayload): Promise<CityDto>
  updateCity(id: string, payload: UpdateCityPayload): Promise<CityDto>
  deleteCity(id: string): Promise<void>

  getZones(cityId?: string): Promise<ZoneDto[]>
  getZonesByCity(cityId: string): Promise<ZoneDto[]>
  getZoneById(id: string): Promise<ZoneDto>
  createZone(payload: CreateZonePayload): Promise<ZoneDto>
  updateZone(id: string, payload: UpdateZonePayload): Promise<ZoneDto>
  deleteZone(id: string): Promise<void>
}
