<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authService } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t } from '../../i18n'
import AuthShell from '../../components/auth/AuthShell.vue'

const route = useRoute()
const router = useRouter()
const email = ref((route.query.email as string) || '')
const token = ref((route.query.token as string) || '')
const newPassword = ref('')
const confirmNewPassword = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

const strength = computed(() => {
  if (!newPassword.value) return 0
  let s = 0
  if (newPassword.value.length >= 8) s++
  if (/[A-Z]/.test(newPassword.value)) s++
  if (/[0-9]/.test(newPassword.value)) s++
  if (/[^A-Za-z0-9]/.test(newPassword.value)) s++
  return s
})

const handleReset = async () => {
  error.value = ''
  if (!newPassword.value) {
    error.value = t('auth.errPasswordRequired')
    return
  }
  if (newPassword.value !== confirmNewPassword.value) {
    error.value = t('auth.errPasswordMismatch')
    return
  }
  if (newPassword.value.length < 8) {
    error.value = t('auth.errPasswordMin')
    return
  }
  loading.value = true
  let res: Awaited<ReturnType<typeof authService.resetPassword>>
  try {
    res = await authService.resetPassword({
      email: email.value.trim(),
      token: token.value.trim(),
      newPassword: newPassword.value,
      confirmNewPassword: confirmNewPassword.value,
    })
  } finally {
    loading.value = false
  }
  if (res.ok) {
    toastService.success(t('auth.passwordChanged'))
    await router.push({ name: 'login' })
  } else {
    error.value = res.error
  }
}
</script>

<template>
  <AuthShell :title="t('auth.resetTitle')" :subtitle="t('auth.resetSubtitle')">
    <div class="auth-recovery-flow">
      <!-- 3-Step Indicator -->
      <nav class="recovery-steps mono" :aria-label="t('auth.recoveryProgress')">
        <div class="step-pill step-pill--done">
          <span class="step-num">✓</span>
          <span>{{ t('auth.email') }}</span>
        </div>
        <span class="step-sep icon--directional">→</span>
        <div class="step-pill step-pill--done">
          <span class="step-num">✓</span>
          <span>{{ t('auth.otpCode') }}</span>
        </div>
        <span class="step-sep icon--directional">→</span>
        <div class="step-pill step-pill--active">
          <span class="step-num">3</span>
          <span>{{ t('auth.newPassword') }}</span>
        </div>
      </nav>

      <form class="auth-form-body" @submit.prevent="handleReset" novalidate>
        <div class="form-group">
          <label class="form-label mono" for="reset-email">{{ t('auth.email') }}</label>
          <input
            id="reset-email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            :placeholder="t('auth.emailPlaceholder')"
            class="vip-input"
          />
        </div>

        <div class="form-group">
          <label class="form-label mono" for="reset-token">{{ t('auth.otpCode') }}</label>
          <input
            id="reset-token"
            v-model="token"
            type="text"
            required
            placeholder="123456"
            class="vip-input mono"
          />
        </div>

        <div class="form-group">
          <label class="form-label mono" for="reset-new-password">
            {{ t('auth.newPassword') }} <span class="req">*</span>
          </label>
          <div class="input-wrap">
            <span class="material-symbols-outlined input-icon">lock</span>
            <input
              id="reset-new-password"
              v-model="newPassword"
              :type="showPassword ? 'text' : 'password'"
              required
              autocomplete="new-password"
              :placeholder="t('auth.passwordPlaceholder')"
              class="vip-input vip-input--with-toggle"
            />
            <button
              type="button"
              class="pwd-toggle-btn"
              :aria-label="showPassword ? t('auth.hidePassword') : t('auth.showPassword')"
              @click="showPassword = !showPassword"
            >
              <span class="material-symbols-outlined">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>

          <!-- Password Strength Bar -->
          <div class="strength-bar">
            <div class="strength-segments">
              <span
                v-for="i in 4"
                :key="i"
                class="seg"
                :class="{
                  'seg--weak': i <= strength && strength === 1,
                  'seg--fair': i <= strength && strength === 2,
                  'seg--good': i <= strength && strength === 3,
                  'seg--strong': i <= strength && strength === 4,
                }"
              ></span>
            </div>
            <span class="strength-label mono">
              {{ strength <= 1 ? t('auth.passwordWeak') : strength === 2 ? t('auth.passwordFair') : strength === 3 ? t('auth.passwordGood') : t('auth.passwordStrong') }}
            </span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label mono" for="reset-confirm">
            {{ t('auth.confirmPassword') }} <span class="req">*</span>
          </label>
          <div class="input-wrap">
            <span class="material-symbols-outlined input-icon">lock</span>
            <input
              id="reset-confirm"
              v-model="confirmNewPassword"
              :type="showPassword ? 'text' : 'password'"
              required
              autocomplete="new-password"
              :placeholder="t('auth.passwordPlaceholder')"
              class="vip-input vip-input--with-toggle"
              :class="{ 'is-invalid': confirmNewPassword && newPassword !== confirmNewPassword }"
            />
          </div>
          <p v-if="confirmNewPassword && newPassword !== confirmNewPassword" class="field-error-text">
            {{ t('auth.errPasswordMismatch') }}
          </p>
        </div>

        <div v-if="error" class="form-error-banner" role="alert">
          <span class="material-symbols-outlined text-[18px]">error</span>
          <span>{{ error }}</span>
        </div>

        <button type="submit" :disabled="loading" class="vip-submit-btn">
          <span v-if="!loading">{{ t('auth.resetPassword') }}</span>
          <span v-else>{{ t('auth.resetting') }}</span>
          <span class="material-symbols-outlined text-[18px] icon--directional">arrow_forward</span>
        </button>
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

.recovery-steps {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  padding: 0.6rem 0.85rem;
  font-size: 11px;
}

.step-pill {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--wl-muted);
  font-weight: 600;
}

.step-pill--done {
  color: var(--wl-success);
}

.step-pill--done .step-num {
  background: var(--wl-success);
  color: var(--wl-on-primary);
}

.step-pill--active {
  color: var(--wl-primary);
  font-weight: 700;
}

.step-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--wl-surface-hover);
  color: var(--wl-muted);
  display: grid;
  place-items: center;
  font-size: 10px;
  font-weight: 800;
}

.step-pill--active .step-num {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
}

.step-sep {
  color: var(--wl-border);
  font-size: 12px;
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

.req {
  color: var(--wl-danger);
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

/* Email/password inputs are forced to direction:ltr in RTL (see base.css), so
   their icon row must share the same direction context. Otherwise the icons'
   logical insets resolve to the opposite side from the input's logical
   padding and the icons overlap the field text. */
.input-wrap--ltr {
  direction: ltr;
}

.input-icon {
  position: absolute;
  inset-inline-start: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 19px;
  color: var(--wl-muted);
  pointer-events: none;
  line-height: 1;
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

.input-wrap .vip-input {
  padding-inline-start: 42px;
}

.vip-input--with-toggle {
  padding-inline-end: 44px;
}

.vip-input:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
  transform: translateY(-0.5px);
}

.vip-input.is-invalid {
  border-color: var(--wl-danger);
}

.pwd-toggle-btn {
  position: absolute;
  inset-inline-end: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--wl-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 4px;
  border-radius: 6px;
  line-height: 1;
}

.pwd-toggle-btn:hover {
  color: var(--wl-primary);
}

.strength-bar {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: 0.35rem;
}

.strength-segments {
  flex: 1;
  display: flex;
  gap: 4px;
}

.seg {
  flex: 1;
  height: 4px;
  border-radius: 9999px;
  background: var(--wl-surface-hover);
  transition: background 0.2s ease;
}

.seg--weak { background: var(--wl-danger); }
.seg--fair { background: var(--wl-warning); }
.seg--good { background: var(--wl-success); }
.seg--strong { background: var(--wl-primary); }

.strength-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-muted);
}

.field-error-text {
  font-size: 11px;
  color: var(--wl-danger);
  margin-top: 0.2rem;
}

.form-error-banner {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.75rem 1rem;
  background: var(--wl-danger-soft);
  border: 1px solid var(--wl-border);
  border-radius: 10px;
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
  box-shadow: 0 4px 12px -2px rgba(105, 169, 255, 0.35);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.vip-submit-btn:hover:not(:disabled) {
  background: var(--wl-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px -2px rgba(105, 169, 255, 0.45);
}

.vip-submit-btn:active:not(:disabled) {
  transform: scale(0.985);
}

.vip-submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

