<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authService, locationService } from '../../di/container'
import { t, locale } from '../../i18n'
import { toastService } from '../../infrastructure/feedback/toast.service'
import AuthShell from '../../components/auth/AuthShell.vue'
import PhoneInput from '../../components/ui/PhoneInput.vue'
import { AppLanguage, UserType } from '../../domain/models/user'
import { CompanyType } from '../../domain/models/company'
import type { CountryDto } from '../../domain/models/location'
import { setPendingOrg } from '../../utils/pending-org-marker'

const router = useRouter()
const fullName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const phoneNumber = ref('')
const companyName = ref('')
const companyType = ref<CompanyType | ''>('')
const companyEmail = ref('')
const distributorCountryId = ref('')
const salesVolumeBand = ref('')
const website = ref('')
const accountType = ref<'customer' | 'organization'>('customer')
const loading = ref(false)
const error = ref('')
const showPassword = ref(false)
const countries = ref<CountryDto[]>([])
const loadingCountries = ref(false)

onMounted(async () => {
  loadingCountries.value = true
  try {
    await locationService.loadCountries()
    countries.value = [...locationService.countries.value]
  } finally {
    loadingCountries.value = false
  }
})

const localized = (en: string, ar: string) => (locale.value === 'ar' ? ar : en)
const phoneCountry = computed(() => {
  if (!phoneNumber.value) return null
  return locationService.findCountryByPhone(phoneNumber.value) ?? null
})
const phoneCountryLabel = computed(() => {
  const c = phoneCountry.value
  if (!c) return null
  return locale.value === 'ar' ? c.nameAr : c.nameEn
})

const emailValid = computed(() => !email.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))
const companyEmailValid = computed(() => !companyEmail.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail.value))
const strength = computed(() => {
  if (!password.value) return 0
  let s = 0
  if (password.value.length >= 8) s++
  if (/[A-Z]/.test(password.value)) s++
  if (/[0-9]/.test(password.value)) s++
  if (/[^A-Za-z0-9]/.test(password.value)) s++
  return s
})

const handleRegister = async () => {
  error.value = ''
  if (!fullName.value.trim()) {
    error.value = t('auth.errFullNameRequired')
    return
  }
  if (!emailValid.value || !email.value.trim()) {
    error.value = t('auth.errEmailInvalid')
    return
  }
  if (accountType.value === 'organization') {
    if (!companyName.value.trim()) {
      error.value = t('auth.errCompanyRequired')
      return
    }
    if (companyType.value === '') {
      error.value = t('auth.errCompanyTypeRequired')
      return
    }
    if (!distributorCountryId.value) {
      error.value = t('auth.errCountryRequired')
      return
    }
    if (!salesVolumeBand.value) {
      error.value = t('auth.errVolumeRequired')
      return
    }
    if (companyEmail.value && !companyEmailValid.value) {
      error.value = t('auth.errEmailInvalid')
      return
    }
    if (website.value && website.value.trim() && !/^https?:\/\/.+/i.test(website.value.trim())) {
      error.value = t('auth.errWebsiteInvalid')
      return
    }
  }
  if (password.value !== confirmPassword.value) {
    error.value = t('auth.errPasswordMismatch')
    return
  }
  if (password.value.length < 8) {
    error.value = t('auth.errPasswordMin')
    return
  }

  loading.value = true
  const phoneCountryId = phoneCountry.value?.id
  const userType = accountType.value === 'customer' ? UserType.Client : UserType.OrganizationUser
  const payload = {
    fullName: fullName.value.trim(),
    email: email.value.trim(),
    password: password.value,
    confirmPassword: confirmPassword.value,
    phoneNumber: phoneNumber.value.trim() || undefined,
    phoneCountryId: phoneCountryId ?? undefined,
    phoneCountryCode: phoneCountry.value?.code ?? undefined,
    userType,
    language: locale.value === 'ar' ? AppLanguage.Ar : AppLanguage.En,
    ...(accountType.value === 'organization' && {
      companyType: companyType.value,
      companyName: companyName.value.trim(),
      companyEmail: companyEmail.value.trim() || undefined,
      distributorCountryId: distributorCountryId.value,
      salesVolumeBand: salesVolumeBand.value,
      website: website.value.trim() || undefined,
    }),
  } as Parameters<typeof authService.register>[0]

  const res = await authService.register(payload)
  loading.value = false

  if (res.ok) {
    try {
      // Store only the email. The full register payload (which contains the
      // plaintext password) must never be persisted; resending a code is done
      // by POST /auth/resend-register-otp instead of replaying registration.
      sessionStorage.setItem('snul-pending-email', payload.email)
      sessionStorage.setItem('welco-pending-email', payload.email)
      sessionStorage.removeItem('snul-pending-register')
      sessionStorage.removeItem('welco-pending-register')
    } catch {}
    if (userType === UserType.OrganizationUser) {
      setPendingOrg(payload.email)
    }
    toastService.success(t('auth.registrationSuccess'))
    await router.push({ name: 'verify-email', query: { email: payload.email } })
  } else {
    error.value = res.error
  }
}
</script>

<template>
  <AuthShell :title="t('auth.registerTitle')" :subtitle="accountType === 'organization' ? t('auth.registerSubtitle') : t('auth.registerAsCustomerSubtitle')" :wide="true">
    <form class="reg-form" @submit.prevent="handleRegister" novalidate>
      <section class="reg-card">
        <header class="reg-card-head">
          <span class="reg-card-step mono">1</span>
          <div>
            <h3 class="reg-card-title">{{ t('auth.registerStep1Title') }}</h3>
            <p class="reg-card-subtitle">{{ t('auth.registerStep1Subtitle') }}</p>
          </div>
        </header>

        <div class="reg-grid">
          <div class="form-group">
            <label class="form-label mono" for="reg-fullname">
              {{ t('auth.fullName') }} <span class="req">*</span>
            </label>
            <div class="input-wrap">
              <span class="material-symbols-outlined input-icon">person</span>
              <input
                id="reg-fullname"
                v-model="fullName"
                required
                autocomplete="name"
                :placeholder="t('auth.fullNamePlaceholder')"
                class="vip-input"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label mono" for="reg-email">
              {{ t('auth.email') }} <span class="req">*</span>
            </label>
            <div class="input-wrap input-wrap--ltr">
              <span class="material-symbols-outlined input-icon">mail</span>
              <input
                id="reg-email"
                v-model="email"
                type="email"
                required
                autocomplete="email"
                :placeholder="t('auth.emailPlaceholder')"
                class="vip-input"
              />
            </div>
            <p v-if="!emailValid" class="field-error-text">{{ t('auth.errEmailInvalid') }}</p>
          </div>

          <div class="form-group col-span-2">
            <PhoneInput v-model="phoneNumber" :label="t('auth.phoneNumber')" :placeholder="t('auth.phonePlaceholder')" />
            <p v-if="phoneCountryLabel" class="phone-hint mono">
              ↳ {{ t('locations.phoneCode') }} {{ phoneCountry?.phoneCode }} — {{ phoneCountryLabel }} ({{ phoneCountry?.code }})
            </p>
          </div>

          <div class="form-group">
            <label class="form-label mono" for="reg-password">
              {{ t('auth.password') }} <span class="req">*</span>
            </label>
            <div class="input-wrap">
              <span class="material-symbols-outlined input-icon">lock</span>
              <input
                id="reg-password"
                v-model="password"
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
            <label class="form-label mono" for="reg-confirm">
              {{ t('auth.confirmPassword') }} <span class="req">*</span>
            </label>
            <div class="input-wrap">
              <span class="material-symbols-outlined input-icon">lock</span>
              <input
                id="reg-confirm"
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="new-password"
                :placeholder="t('auth.passwordPlaceholder')"
                class="vip-input vip-input--with-toggle"
                :class="{ 'is-invalid': confirmPassword && password !== confirmPassword }"
              />
            </div>
            <p v-if="confirmPassword && password !== confirmPassword" class="field-error-text">
              {{ t('auth.errPasswordMismatch') }}
            </p>
          </div>
        </div>
      </section>

      <section class="reg-card">
        <header class="reg-card-head">
          <span class="reg-card-step mono">2</span>
          <div>
            <h3 class="reg-card-title">{{ t('auth.registerStepAccountType') }}</h3>
            <p class="reg-card-subtitle">{{ t('auth.registerStepAccountTypeDesc') }}</p>
          </div>
        </header>

        <div class="reg-choice-grid">
          <button
            type="button"
            class="reg-choice-card"
            :class="{ 'reg-choice-card--active': accountType === 'customer' }"
            @click="accountType = 'customer'"
          >
            <span class="material-symbols-outlined reg-choice-icon">person</span>
            <span class="reg-choice-title">{{ t('auth.registerAsCustomer') }}</span>
            <span class="reg-choice-desc">{{ t('auth.registerAsCustomerDesc') }}</span>
          </button>
          <button
            type="button"
            class="reg-choice-card"
            :class="{ 'reg-choice-card--active': accountType === 'organization' }"
            @click="accountType = 'organization'"
          >
            <span class="material-symbols-outlined reg-choice-icon">business</span>
            <span class="reg-choice-title">{{ t('auth.registerAsOrganization') }}</span>
            <span class="reg-choice-desc">{{ t('auth.registerAsOrganizationDesc') }}</span>
          </button>
        </div>
      </section>

        <section v-if="accountType === 'organization'" class="reg-card">
        <header class="reg-card-head">
          <span class="reg-card-step mono">3</span>
          <div>
            <h3 class="reg-card-title">{{ t('auth.registerStep3Title') }}</h3>
            <p class="reg-card-subtitle">{{ t('auth.registerStep3Subtitle') }}</p>
          </div>
        </header>

        <div class="reg-grid">
          <div class="form-group col-span-2">
            <label class="form-label mono" for="reg-company">
              {{ t('distributor.companyName') }} <span class="req">*</span>
            </label>
            <input
              id="reg-company"
              v-model="companyName"
              :placeholder="t('distributor.companyNamePlaceholder')"
              class="vip-input"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label mono" for="reg-company-email">
              {{ t('distributor.email') }}
            </label>
            <div class="input-wrap input-wrap--ltr">
              <span class="material-symbols-outlined input-icon">mail</span>
              <input
                id="reg-company-email"
                v-model="companyEmail"
                type="email"
                autocomplete="email"
                :placeholder="t('distributor.emailPh')"
                class="vip-input"
              />
            </div>
            <p v-if="companyEmail && !companyEmailValid" class="field-error-text">{{ t('auth.errEmailInvalid') }}</p>
          </div>

          <div class="form-group">
            <label class="form-label mono" for="reg-company-type">
              {{ t('auth.companyType') }} <span class="req">*</span>
            </label>
            <select id="reg-company-type" v-model="companyType" required class="vip-input vip-select">
              <option value="" disabled>{{ t('auth.companyType') }}</option>
              <option :value="CompanyType.Hospital">{{ t('providers.hospital') }}</option>
              <option :value="CompanyType.Distributor">{{ t('providers.distributor') }}</option>
              <option :value="CompanyType.Clinic">{{ t('providers.clinic') }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label mono" for="reg-country">
              {{ t('distributor.country') }} <span class="req">*</span>
            </label>
            <select id="reg-country" v-model="distributorCountryId" required class="vip-input vip-select">
              <option value="" disabled>{{ loadingCountries ? t('common.loading') : t('distributor.country') }}</option>
              <option v-for="c in countries" :key="c.id" :value="c.id">
                {{ localized(c.nameEn, c.nameAr) }} — {{ c.code }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label mono" for="reg-volume">
              {{ t('distributor.salesVolume') }} <span class="req">*</span>
            </label>
            <select id="reg-volume" v-model="salesVolumeBand" required class="vip-input vip-select">
              <option value="" disabled>{{ t('distributor.salesVolume') }}</option>
              <option value="Under 100k USD">{{ t('distributor.volume1') }}</option>
              <option value="100k – 250k USD">{{ t('distributor.volume2') }}</option>
              <option value="250k – 500k USD">{{ t('distributor.volume3') }}</option>
              <option value="Over 500k USD">{{ t('distributor.volume4') }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label mono" for="reg-website">
              {{ t('distributor.website') }}
            </label>
            <input
              id="reg-website"
              v-model="website"
              type="url"
              :placeholder="t('distributor.websitePlaceholder')"
              class="vip-input"
            />
</div>
        </div>
      </section>

      <p v-if="accountType === 'organization'" class="reg-provider-note mono">
        {{ t('auth.providerApprovalNote') }}
      </p>

      <div v-if="error" class="form-error-banner" role="alert">
        <span class="material-symbols-outlined text-[18px]">error</span>
        <span>{{ error }}</span>
      </div>

      <button type="submit" :disabled="loading" class="vip-submit-btn">
        <span v-if="!loading">{{ t('auth.register') }}</span>
        <span v-else>{{ t('auth.registering') }}</span>
        <span class="material-symbols-outlined text-[18px] icon--directional">arrow_forward</span>
      </button>

      <div class="auth-switch mono">
        <span>{{ t('auth.hasAccount') }}</span>
        <router-link to="/auth/login" class="switch-link">
          {{ t('auth.login') }}
        </router-link>
      </div>
    </form>
  </AuthShell>
</template>

<style scoped>
.reg-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.reg-card {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: 1.25rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.reg-card-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--wl-border);
}

.reg-card-step {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.reg-card-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
}

.reg-card-subtitle {
  font-size: 12px;
  color: var(--wl-muted);
  margin: 0;
}

.reg-choice-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
}

.reg-choice-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 1rem;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: var(--radius-md);
  color: var(--wl-ink-soft);
  text-align: start;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: var(--wl-font-body, system-ui);
}

.reg-choice-card:hover {
  border-color: var(--wl-primary);
  box-shadow: var(--shadow-xs);
  transform: translateY(-1px);
}

.reg-choice-card--active {
  border-color: var(--wl-primary);
  background: color-mix(in srgb, var(--wl-primary) 8%, var(--wl-surface));
  color: var(--wl-ink-strong);
}

.reg-choice-icon {
  font-size: 22px;
  color: var(--wl-primary);
}

.reg-choice-title {
  font-size: 13px;
  font-weight: 700;
}

.reg-choice-desc {
  font-size: 11px;
  line-height: 1.45;
  color: var(--wl-muted);
}

.reg-provider-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: color-mix(in srgb, var(--wl-primary) 8%, var(--wl-surface));
  border: 1px solid color-mix(in srgb, var(--wl-primary) 30%, var(--wl-border));
  border-radius: var(--radius-md);
  color: var(--wl-ink-soft);
  font-size: 12px;
}

.reg-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.col-span-2 {
  grid-column: span 2;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
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
  color: var(--wl-muted-soft);
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

.input-wrap .vip-input--with-toggle {
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

.vip-select {
  cursor: pointer;
  appearance: auto;
}

.pwd-toggle-btn {
  position: absolute;
  inset-inline-end: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--wl-muted-soft);
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
  border-radius: var(--radius-pill);
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

.phone-hint {
  font-size: 11px;
  color: var(--wl-muted);
  margin-top: 0.25rem;
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

.auth-switch {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.45rem;
  font-size: 12.5px;
  color: var(--wl-muted);
}

.switch-link {
  color: var(--wl-primary);
  font-weight: 700;
  text-decoration: none;
}

.switch-link:hover {
  text-decoration: underline;
}

.acct-type-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.acct-type-opt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  padding: 0.9rem 1rem;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: start;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.acct-type-opt:hover {
  border-color: var(--secondary, #147D92);
  transform: translateY(-1px);
}

.acct-type-opt.is-active {
  border-color: var(--primary, #0F3D56);
  background: var(--brand-soft, #EDF4FF);
  box-shadow: var(--shadow-sm);
}

.acct-type-icon {
  font-size: 22px;
  color: var(--wl-primary);
}

.acct-type-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--wl-ink-strong);
}

.acct-type-desc {
  font-size: 11.5px;
  color: var(--wl-muted);
  line-height: 1.45;
}

@media (max-width: 640px) {
  .acct-type-grid {
    grid-template-columns: 1fr;
  }
  .reg-grid {
    grid-template-columns: 1fr;
  }
  .col-span-2 {
    grid-column: span 1;
  }
}
</style>

