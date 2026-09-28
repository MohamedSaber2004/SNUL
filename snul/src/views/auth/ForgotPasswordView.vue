<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '../../di/container'
import { t } from '../../i18n'
import { toastService } from '../../infrastructure/feedback/toast.service'
import AuthShell from '../../components/auth/AuthShell.vue'

const router = useRouter()
const email = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

const handleSubmit = async () => {
  error.value = ''
  if (!email.value.trim()) {
    error.value = t('auth.errEmailRequired')
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    error.value = t('auth.errEmailInvalid')
    return
  }
  loading.value = true
  let res: Awaited<ReturnType<typeof authService.forgotPassword>>
  try {
    res = await authService.forgotPassword({ email: email.value.trim() })
  } finally {
    loading.value = false
  }
  if (res.ok) {
    success.value = true
    toastService.success(t('auth.codeSent'))
    setTimeout(() => {
      void router.push({
        name: 'verify-password-otp',
        query: { email: email.value.trim() },
      })
    }, 800)
  } else {
    error.value = res.error
  }
}
</script>

<template>
  <AuthShell :title="t('auth.forgotTitle')" :subtitle="t('auth.forgotSubtitle')">
    <div class="auth-recovery-flow">
      <nav class="recovery-steps mono" :aria-label="t('auth.recoveryProgress')">
        <div class="step-pill step-pill--active">
          <span class="step-num">1</span>
          <span>{{ t('auth.email') }}</span>
        </div>
        <span class="step-sep icon--directional">→</span>
        <div class="step-pill">
          <span class="step-num">2</span>
          <span>{{ t('auth.otpCode') }}</span>
        </div>
        <span class="step-sep icon--directional">→</span>
        <div class="step-pill">
          <span class="step-num">3</span>
          <span>{{ t('auth.newPassword') }}</span>
        </div>
      </nav>

      <form class="auth-form-body" @submit.prevent="handleSubmit" novalidate>
        <div class="form-group">
          <label class="form-label mono" for="forgot-email">
            {{ t('auth.email') }} <span class="req">*</span>
          </label>
          <div class="input-wrap input-wrap--ltr">
            <span class="material-symbols-outlined input-icon">mail</span>
            <input
              id="forgot-email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              :placeholder="t('auth.emailPlaceholder')"
              class="vip-input"
            />
          </div>
        </div>

        <div v-if="error" class="form-error-banner" role="alert">
          <span class="material-symbols-outlined text-[18px]">error</span>
          <span>{{ error }}</span>
        </div>

        <div v-if="success" class="form-success-banner" role="status">
          <span class="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{{ t('auth.codeSent') }} {{ t('auth.redirecting') }}</span>
        </div>

        <button type="submit" :disabled="loading || success" class="vip-submit-btn">
          <span v-if="!loading">{{ t('auth.sendCode') }}</span>
          <span v-else>{{ t('auth.sendingCode') }}</span>
          <span class="material-symbols-outlined text-[18px] icon--directional">arrow_forward</span>
        </button>

        <div class="recovery-foot mono">
          <router-link
            :to="{ name: 'verify-password-otp', query: { email: email.trim() || undefined } }"
            class="foot-link"
          >
            {{ t('auth.alreadyHaveOtp') }}
          </router-link>
          <span class="foot-sep">•</span>
          <router-link to="/auth/login" class="foot-link">
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

.recovery-steps {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
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

.step-pill--active {
  color: var(--wl-primary);
  font-weight: 700;
}

.step-num {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-pill);
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
  padding-inline-start: 42px;
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

.form-success-banner {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.75rem 1rem;
  background: var(--wl-success-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  color: var(--wl-success);
  font-size: 13px;
  font-weight: 600;
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

.recovery-foot {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.65rem;
  font-size: 12px;
  color: var(--wl-muted);
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.foot-link {
  color: var(--wl-primary);
  font-weight: 600;
  text-decoration: none;
}

.foot-link:hover {
  text-decoration: underline;
}

.foot-sep {
  color: var(--wl-border);
}
</style>

