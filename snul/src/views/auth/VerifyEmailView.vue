<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authService } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t } from '../../i18n'
import AuthShell from '../../components/auth/AuthShell.vue'
import { isPendingOrg } from '../../utils/pending-org-marker'

const router = useRouter()
const route = useRoute()
const email = ref((route.query.email as string) || '')
const otpCode = ref('')
const loading = ref(false)
const resending = ref(false)
const error = ref('')
const secondsLeft = ref(60)
let timer: ReturnType<typeof setInterval> | null = null

const startTimer = () => {
  secondsLeft.value = 60
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    secondsLeft.value -= 1
    if (secondsLeft.value <= 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

onMounted(() => {
  if (!email.value) {
    try {
      const s = sessionStorage.getItem('snul-pending-email') || sessionStorage.getItem('welco-pending-email')
      if (s) email.value = s
    } catch {}
  }
  startTimer()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const handleVerify = async () => {
  error.value = ''
  if (!otpCode.value.trim()) {
    error.value = t('auth.errInvalidOtp')
    return
  }
  if (!email.value.trim()) {
    error.value = t('auth.errEmailRequired')
    return
  }

  loading.value = true
  const res = await authService.verifyEmailOtp({
    email: email.value.trim(),
    otpCode: otpCode.value.trim(),
  })
  loading.value = false

  if (res.ok) {
    let registeredAsOrg = false
    try {
      // The register payload (with its password) is no longer stashed; the
      // org-vs-client signal comes from the pending-org marker instead.
      sessionStorage.removeItem('snul-pending-email')
      sessionStorage.removeItem('snul-pending-register')
      sessionStorage.removeItem('welco-pending-email')
      sessionStorage.removeItem('welco-pending-register')
    } catch {}
    if (isPendingOrg(email.value)) registeredAsOrg = true

    if (registeredAsOrg) {
      if (authService.isAuthenticated) {
        await authService.logout().catch(() => {})
      }
      toastService.info(t('distributor.pendingApproval'))
      await router.push({ name: 'login' })
      return
    }

    if (authService.isAuthenticated) {
      toastService.success(t('auth.welcomeBackToast'))
      const redirect = (route.query.redirect as string) || ''
      if (redirect) await router.push(redirect)
      // Role-correct landing: providers go to the quote desk, staff to the
      // dashboard, buyers to their account — not the public home page.
      else await router.push({ name: authService.getDashboardRouteName() })
    } else {
      toastService.success(t('common.operationDone'))
      await router.push({ name: 'login' })
    }
  } else {
    error.value = res.error
  }
}

const handleResend = async () => {
  if (secondsLeft.value > 0) return
  if (!email.value.trim()) {
    error.value = t('auth.errEmailRequired')
    return
  }

  resending.value = true
  try {
    const res = await authService.resendRegisterOtp({ email: email.value.trim() })
    if (res.ok) {
      toastService.success(t('auth.codeSent'))
      startTimer()
    } else {
      error.value = res.error
    }
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('auth.errGeneric'))
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <AuthShell :title="t('auth.verifyTitle')" :subtitle="t('auth.verifySubtitle')">
    <div class="auth-recovery-flow">
      <div class="email-notice-card">
        <span class="material-symbols-outlined notice-icon">mark_email_read</span>
        <div>
          <strong class="notice-title">{{ t('auth.verifyNoticeTitle') }}</strong>
          <p class="notice-sub">
            {{ t('auth.verifyNoticeDesc') }}
            <span class="mono email-highlight">{{ email || t('auth.verifyFallbackEmail') }}</span>.
          </p>
        </div>
      </div>

      <form class="auth-form-body" @submit.prevent="handleVerify" novalidate>
        <div class="form-group">
          <label class="form-label mono" for="verify-email-input">{{ t('auth.email') }}</label>
          <input
            id="verify-email-input"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            :placeholder="t('auth.emailPlaceholder')"
            class="vip-input"
          />
        </div>

        <div class="form-group">
          <div class="label-row">
            <label class="form-label mono" for="verify-otp-input">{{ t('auth.otpCode') }}</label>
            <span class="mono text-xs text-muted">{{ t('auth.otpLengthHint') }}</span>
          </div>
          <input
            id="verify-otp-input"
            v-model="otpCode"
            type="text"
            inputmode="numeric"
            maxlength="8"
            required
            placeholder="123456"
            class="vip-input vip-otp-input mono"
            autocomplete="one-time-code"
          />
        </div>

        <div v-if="error" class="form-error-banner" role="alert">
          <span class="material-symbols-outlined text-[18px]">error</span>
          <span>{{ error }}</span>
        </div>

        <button type="submit" :disabled="loading" class="vip-submit-btn">
          <span v-if="!loading">{{ t('auth.verify') }}</span>
          <span v-else>{{ t('auth.verifying') }}</span>
          <span class="material-symbols-outlined text-[18px] icon--directional">arrow_forward</span>
        </button>

        <div class="resend-box">
          <button
            type="button"
            class="resend-btn mono"
            :disabled="secondsLeft > 0 || resending"
            @click="handleResend"
          >
            <span v-if="secondsLeft > 0">{{ t('auth.resendTimer', { seconds: secondsLeft }) }}</span>
            <span v-else-if="resending">{{ t('common.loading') }}</span>
            <span v-else>{{ t('auth.resend') }}</span>
          </button>
        </div>

        <div class="auth-switch mono">
          <router-link to="/auth/login" class="switch-link">
            {{ t('auth.backToLogin') }}
          </router-link>
        </div>
      </form>
    </div>
  </AuthShell>
</template>

<style scoped>
.auth-recovery-flow {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.email-notice-card {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  background: var(--wl-success-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: 1rem 1.15rem;
}

.notice-icon {
  font-size: 24px;
  color: var(--wl-success);
  flex-shrink: 0;
  margin-top: 1px;
}

.notice-title {
  display: block;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin-bottom: 0.2rem;
}

.notice-sub {
  font-size: 12.5px;
  color: var(--wl-ink-soft);
  margin: 0;
  line-height: 1.45;
}

.email-highlight {
  font-weight: 700;
  color: var(--wl-ink-strong);
  background: var(--wl-surface);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--wl-border);
}

.auth-form-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-ink-soft);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.vip-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: var(--wl-font-body, system-ui);
  color: var(--wl-ink-strong);
  box-shadow: var(--shadow-xs);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  outline: none;
}

.vip-input:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
  transform: translateY(-0.5px);
}

.vip-otp-input {
  text-align: center;
  font-size: 1.4rem;
  letter-spacing: 0.35em;
  font-weight: 800;
}

.form-error-banner {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.75rem 1rem;
  background: var(--wl-danger-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  color: var(--wl-danger);
  font-size: 13px;
  font-weight: 500;
}

.vip-submit-btn {
  height: 44px;
  width: 100%;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--wl-font-body, system-ui);
  font-size: 14.5px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.vip-submit-btn:hover:not(:disabled) {
  background: var(--wl-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-hover);
}

.vip-submit-btn:active:not(:disabled) {
  transform: scale(0.985);
}

.vip-submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.resend-box {
  display: flex;
  justify-content: center;
}

.resend-btn {
  background: none;
  border: none;
  color: var(--wl-primary);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.resend-btn:hover:not(:disabled) {
  text-decoration: underline;
}

.resend-btn:disabled {
  color: var(--wl-muted);
  cursor: not-allowed;
  text-decoration: none;
}

.auth-switch {
  display: flex;
  justify-content: center;
  margin-top: 0.25rem;
}

.switch-link {
  color: var(--wl-primary);
  font-weight: 600;
  font-size: 12.5px;
  text-decoration: none;
}

.switch-link:hover {
  text-decoration: underline;
}
</style>

