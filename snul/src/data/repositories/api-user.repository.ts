import { USER_MANAGEMENT_ROUTES } from '../../config/api.config'
import type { UserRepository } from '../../domain/ports/user-repository'
import type { PaginatedResult } from '../../domain/models/location'
import type { UserDto, UserDetailsDto, CreateUserPayload, UpdateUserPayload } from '../../domain/models/user'
import type { HttpClient } from '../../infrastructure/http/http-client'

export class ApiUserRepository implements UserRepository {
  constructor(private readonly http: HttpClient) {}

  async getUsers(params?: {
    pageNumber?: number
    pageSize?: number
    searchTerm?: string
    userType?: number
    isActive?: boolean
  }): Promise<PaginatedResult<UserDto>> {
    const search = new URLSearchParams()
    if (params?.pageNumber) search.set('pageNumber', String(params.pageNumber))
    if (params?.pageSize) search.set('pageSize', String(Math.min(50, Math.max(1, params.pageSize))))
    if (params?.searchTerm) search.set('searchTerm', params.searchTerm)
    if (params?.userType) search.set('userType', String(params.userType))
    if (params?.isActive !== undefined) search.set('isActive', String(params.isActive))

    const query = search.toString() ? `?${search.toString()}` : ''
    return await this.http.get<PaginatedResult<UserDto>>(`${USER_MANAGEMENT_ROUTES.users}${query}`, { showFeedback: false })
  }

  async getUserById(id: string): Promise<UserDetailsDto> {
    return await this.http.get<UserDetailsDto>(USER_MANAGEMENT_ROUTES.userById(id), { showFeedback: false })
  }

  async createUser(payload: CreateUserPayload): Promise<UserDto> {
    return await this.http.post<UserDto>(USER_MANAGEMENT_ROUTES.users, payload)
  }

  async updateUser(id: string, payload: UpdateUserPayload): Promise<UserDto> {
    return await this.http.put<UserDto>(USER_MANAGEMENT_ROUTES.userById(id), { id, ...payload })
  }

  async deleteUser(id: string): Promise<void> {
    return await this.http.del<void>(USER_MANAGEMENT_ROUTES.userById(id))
  }

  async changePassword(id: string, newPassword: string): Promise<void> {
    return await this.http.put<void>(USER_MANAGEMENT_ROUTES.changePassword(id), { id, newPassword })
  }
}
