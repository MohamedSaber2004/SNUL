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
} from '../models/auth'
import type { AuthResponseDto, UserProfileDto } from '../models/user'

export interface AuthRepository {
  register(payload: RegisterPayload): Promise<string>
  login(payload: LoginPayload): Promise<AuthResponseDto>
  logout(payload?: LogoutPayload | string): Promise<void>
  verifyEmailOtp(payload: VerifyEmailOtpPayload): Promise<AuthResponseDto>
  /** Issues a fresh registration code for an unverified account. */
  resendRegisterOtp(payload: ResendRegisterOtpPayload): Promise<string>
  forgotPassword(payload: ForgotPasswordPayload): Promise<string>
  verifyPasswordOtp(payload: VerifyPasswordOtpPayload): Promise<string>
  resetPassword(payload: ResetPasswordPayload): Promise<string>
  refreshToken(payload: RefreshTokenPayload): Promise<AuthResponseDto>
  getProfile(): Promise<UserProfileDto>
  updateProfile(payload: UpdateProfilePayload): Promise<UserProfileDto>
}
