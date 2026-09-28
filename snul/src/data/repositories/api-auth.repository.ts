import { AUTH_ROUTES } from '../../config/api.config'
import type { AuthRepository } from '../../domain/ports/auth-repository'
import type {
  ForgotPasswordPayload,
  LoginPayload,
  LogoutPayload,
  RefreshTokenPayload,
  RegisterPayload,
  ResendRegisterOtpPayload,
  ResetPasswordPayload,
  UpdateProfilePayload,
  VerifyEmailOtpPayload,
  VerifyPasswordOtpPayload,
} from '../../domain/models/auth'
import type { AuthResponseDto, UserProfileDto } from '../../domain/models/user'
import type { HttpClient } from '../../infrastructure/http/http-client'

export class ApiAuthRepository implements AuthRepository {
  constructor(private readonly http: HttpClient) {}

  register(payload: RegisterPayload): Promise<string> {
    return this.http.post<string>(AUTH_ROUTES.register, payload, { showFeedback: false })
  }

  login(payload: LoginPayload): Promise<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(AUTH_ROUTES.login, payload, { showFeedback: false })
  }

  async logout(payload?: LogoutPayload | string): Promise<void> {
    const body = typeof payload === 'string' ? { refreshToken: payload } : payload || {}
    try {
      await this.http.post<unknown>(AUTH_ROUTES.logout, body, { showFeedback: false })
    } catch {
    }
  }

  verifyEmailOtp(payload: VerifyEmailOtpPayload): Promise<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(AUTH_ROUTES.verifyEmailOtp, payload, { showFeedback: false })
  }

  resendRegisterOtp(payload: ResendRegisterOtpPayload): Promise<string> {
    return this.http.post<string>(AUTH_ROUTES.resendRegisterOtp, payload, { showFeedback: false })
  }

  forgotPassword(payload: ForgotPasswordPayload): Promise<string> {
    return this.http.post<string>(AUTH_ROUTES.forgotPassword, payload, { showFeedback: false })
  }

  verifyPasswordOtp(payload: VerifyPasswordOtpPayload): Promise<string> {
    return this.http.post<string>(AUTH_ROUTES.verifyPasswordOtp, payload, { showFeedback: false })
  }

  resetPassword(payload: ResetPasswordPayload): Promise<string> {
    return this.http.post<string>(AUTH_ROUTES.resetPassword, payload, { showFeedback: false })
  }

  refreshToken(payload: RefreshTokenPayload): Promise<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(AUTH_ROUTES.refreshToken, payload, { showFeedback: false })
  }

  refresh(refreshToken: string): Promise<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(AUTH_ROUTES.refreshToken, { refreshToken }, { showFeedback: false })
  }

  getProfile(): Promise<UserProfileDto> {
    return this.http.get<UserProfileDto>(AUTH_ROUTES.profile, { showFeedback: false })
  }

  updateProfile(payload: UpdateProfilePayload): Promise<UserProfileDto> {
    return this.http.put<UserProfileDto>(AUTH_ROUTES.profile, payload, { showFeedback: false })
  }
}
