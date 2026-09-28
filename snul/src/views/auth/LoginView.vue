<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authService } from '../../di/container'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t } from '../../i18n'
import AuthShell from '../../components/auth/AuthShell.vue'
import { isPendingOrg, clearPendingOrg } from '../../utils/pending-org-marker'

const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const showPassword = ref(false)

const handleLogin = async () => {
  error.value = ''
  if (!email.value.trim() || !password.value.trim()) {
    error.value = t('auth.errEmailRequired')
    return
  }
  loading.value = true
  let res: Awaited<ReturnType<typeof authService.login>>
  try {
    res = await authService.login({ email: email.value.trim(), password: password.value })
  } finally {
    loading.value = false
  }
  if (res.ok) {
    await authService.loadProfile().catch(() => null)
    clearPendingOrg(authService.user.value?.email)
  }
  if (res.ok) {
    const redirect = (route.query.redirect as string) || ''
    if (redirect && authService.canAccessPath(redirect)) await router.replace(redirect)
    else await router.replace({ name: authService.getDashboardRouteName() })
  } else {
    error.value = res.error
    const lower = res.error.toLowerCase()
    const isNotConfirmed = lower.includes('confirm') || lower.includes('موثق') || lower.includes('تأكيد') || lower.includes('not confirmed')
    if (isNotConfirmed) {
      setTimeout(async () => {
        const ok = await confirmService.confirm({
          title: t('auth.verifyTitle'),
          message: res.error,
          variant: 'primary',
          confirmText: t('auth.verifyTitle'),
          cancelText: t('common.cancel'),
        })
        if (ok) void router.push({ name: 'verify-email', query: { email: email.value.trim() } })
      }, 100)
    }
  }
}
</script>

<template>
  <AuthShell :title="t('auth.loginTitle')" :subtitle="t('auth.loginSubtitle')">
    <form class="auth-form-body" @submit.prevent="handleLogin" novalidate>
      <div class="form-group">
        <label class="form-label mono" for="login-email">{{ t('auth.email') }}</label>
        <div class="input-wrap input-wrap--ltr">
          <span class="material-symbols-outlined input-icon">mail</span>
          <input
            id="login-email"
            v-model="email"
            type="email"
            required
            :placeholder="t('auth.emailPlaceholderLogin')"
            autocomplete="email"
            class="vip-input"
          />
        </div>
      </div>

      <div class="form-group">
        <div class="label-row">
          <label class="form-label mono" for="login-password">{{ t('auth.password') }}</label>
          <router-link to="/auth/forgot-password" class="forgot-link mono">
            {{ t('auth.forgotPassword') }}
          </router-link>
        </div>
        <div class="input-wrap">
          <span class="material-symbols-outlined input-icon">lock</span>
          <input
            id="login-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            required
            :placeholder="t('auth.passwordPlaceholder')"
            autocomplete="current-password"
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
      </div>

      <div v-if="error" class="form-error-banner" role="alert">
        <span class="material-symbols-outlined text-[18px]">error</span>
        <span>{{ error }}</span>
      </div>

      <button type="submit" :disabled="loading" class="vip-submit-btn">
        <span v-if="!loading">{{ t('auth.login') }}</span>
        <span v-else>{{ t('auth.loggingIn') }}</span>
        <span class="material-symbols-outlined text-[18px] icon--directional">arrow_forward</span>
      </button>

      <div class="auth-switch mono">
        <span>{{ t('auth.noAccount') }}</span>
        <router-link to="/auth/register" class="switch-link">
          {{ t('auth.register') }}
        </router-link>
      </div>
    </form>
  </AuthShell>
</template>

<style scoped>
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

.forgot-link {
  font-size: 11px;
  font-weight: 600;
  color: var(--wl-primary);
  text-decoration: none;
  transition: color 0.15s ease;
}

.forgot-link:hover {
  color: var(--wl-primary-hover);
  text-decoration: underline;
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
  font-family: var(--wl-font-body);
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

.vip-input--with-toggle {
  padding-inline-end: 44px;
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
  transition: color 0.15s ease;
  line-height: 1;
}

.pwd-toggle-btn:hover {
  color: var(--wl-primary);
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
  font-family: var(--wl-font-body);
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
  transform: none;
}

.auth-switch {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.45rem;
  font-size: 12.5px;
  color: var(--wl-muted);
  margin-top: 0.5rem;
}

.switch-link {
  color: var(--wl-primary);
  font-weight: 700;
  text-decoration: none;
}

.switch-link:hover {
  text-decoration: underline;
}
</style>

