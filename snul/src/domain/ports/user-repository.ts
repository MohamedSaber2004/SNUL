import type { PaginatedResult } from '../models/location'
import type { UserDto, UserDetailsDto, CreateUserPayload, UpdateUserPayload } from '../models/user'

export interface UserRepository {
  getUsers(params?: {
    pageNumber?: number
    pageSize?: number
    searchTerm?: string
    userType?: number
    isActive?: boolean
  }): Promise<PaginatedResult<UserDto>>
  getUserById(id: string): Promise<UserDetailsDto>
  createUser(payload: CreateUserPayload): Promise<UserDto>
  updateUser(id: string, payload: UpdateUserPayload): Promise<UserDto>
  deleteUser(id: string): Promise<void>
  changePassword(id: string, newPassword: string): Promise<void>
}
