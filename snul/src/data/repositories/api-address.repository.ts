import { USER_MANAGEMENT_ROUTES } from '../../config/api.config'
import type { AddressRepository } from '../../domain/ports/address-repository'
import type { CreateAddressPayload, UpdateAddressPayload, UserAddressDto } from '../../domain/models/address'
import type { HttpClient } from '../../infrastructure/http/http-client'

function extractArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[]
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.data)) return obj.data as T[]
    if (Array.isArray(obj.Data)) return obj.Data as T[]
  }
  return []
}

export class ApiAddressRepository implements AddressRepository {
  constructor(private readonly http: HttpClient) {}

  async getUserAddresses(userId: string): Promise<UserAddressDto[]> {
    const data = await this.http.get<UserAddressDto[] | { data: UserAddressDto[] }>(
      USER_MANAGEMENT_ROUTES.addressesByUser(userId),
      { showFeedback: false },
    )
    return extractArray<UserAddressDto>(data as unknown)
  }

  async getAddressById(id: string): Promise<UserAddressDto> {
    return await this.http.get<UserAddressDto>(USER_MANAGEMENT_ROUTES.addressById(id), { showFeedback: false })
  }

  async createAddress(payload: CreateAddressPayload): Promise<UserAddressDto> {
    return await this.http.post<UserAddressDto>(USER_MANAGEMENT_ROUTES.addresses, payload, { showFeedback: false })
  }

  async updateAddress(id: string, payload: UpdateAddressPayload): Promise<UserAddressDto> {
    return await this.http.put<UserAddressDto>(USER_MANAGEMENT_ROUTES.addressById(id), { id, ...payload }, { showFeedback: false })
  }

  async deleteAddress(id: string): Promise<void> {
    return await this.http.del<void>(USER_MANAGEMENT_ROUTES.addressById(id), { showFeedback: false })
  }
}
