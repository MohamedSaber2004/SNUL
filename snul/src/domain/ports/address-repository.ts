import type { CreateAddressPayload, UpdateAddressPayload, UserAddressDto } from '../models/address'

export interface AddressRepository {
  getUserAddresses(userId: string): Promise<UserAddressDto[]>
  getAddressById(id: string): Promise<UserAddressDto>
  createAddress(payload: CreateAddressPayload): Promise<UserAddressDto>
  updateAddress(id: string, payload: UpdateAddressPayload): Promise<UserAddressDto>
  deleteAddress(id: string): Promise<void>
  isPhoneCompatibleWithCountry?(phone: string, countryId: string): Promise<boolean>
}
