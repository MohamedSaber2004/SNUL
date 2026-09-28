<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { authService, userRepository, locationService, companyService } from '../di/container'
import { t, setLocale, locale } from '../i18n'
import SkeletonLoader from '../components/ui/SkeletonLoader.vue'
import BackButton from '../components/ui/BackButton.vue'
import PhoneInput from '../components/ui/PhoneInput.vue'
import AppImage from '../components/ui/AppImage.vue'
import { AppLanguage, UserType } from '../domain/models/user'
import type { CompanyDto } from '../domain/models/company'
import { CompanyType, CompanyStatus } from '../domain/models/company'
import { resolveFileUrl } from '../utils/file-url'
import { resolvePhoneDetails, type DetailedPhoneInfo } from '../utils/phone'

const fullName = ref('')
const phoneNumber = ref('')
const language = ref<AppLanguage>(AppLanguage.En)
const loading = ref(false)
const error = ref('')
const user = authService.user

const profilePictureName = ref<string | null>(null)
const uploadingPicture = ref(false)

const profileCompany = ref<CompanyDto | null>(null)
const myCompany = computed<CompanyDto | null>(() => companyService.myCompany.value ?? profileCompany.value ?? null)
const companyLoading = computed(() => companyService.loading.value && !myCompany.value)

const isApproved = (status?: CompanyStatus | string | number) =>
  status === CompanyStatus.Approved || status === 'Approved' || status === 2 || status === '2'
const isPending = (status?: CompanyStatus | string | number) =>
  status === CompanyStatus.Pending || status === 'Pending' || status === 1 || status === '1'
const isRejected = (status?: CompanyStatus | string | number) =>
  status === CompanyStatus.Rejected || status === 'Rejected' || status === 3 || status === '3'

const companyTypeName = (type?: CompanyType | number) => {
  if (type === CompanyType.Distributor || type === 2) return locale.value === 'ar' ? 'موزع معتمد' : 'Authorized Distributor'
  if (type === CompanyType.Hospital || type === 1) return locale.value === 'ar' ? 'مستشفى / مركز طبي' : 'Hospital / Medical Center'
  if (type === CompanyType.Clinic || type === 3) return locale.value === 'ar' ? 'عيادة تخصصية' : 'Specialized Clinic'
  return locale.value === 'ar' ? 'منشأة مؤسسية' : 'Enterprise Entity'
}

const companyStatusLabel = (status?: CompanyStatus | string | number) => {
  if (isApproved(status)) return locale.value === 'ar' ? 'شريك معتمد' : t('account.verifiedPartner')
  if (isPending(status)) return locale.value === 'ar' ? 'قيد المراجعة' : t('common.pending')
  if (isRejected(status)) return locale.value === 'ar' ? 'مرفوض' : t('sales.statusDeclined')
  return t('common.pending')
}

const companyCountryName = (comp?: CompanyDto | null) => {
  if (!comp) return ''
  if (locale.value === 'ar' && comp.countryNameAr) return comp.countryNameAr
  if (comp.countryId) {
    const c = locationService.countries.value.find((x) => x.id === comp.countryId)
    if (c) return locale.value === 'ar' ? (c.nameAr || c.nameEn) : (c.nameEn || c.nameAr)
  }
  return (locale.value === 'ar' ? (comp.countryNameAr || comp.countryNameEn) : (comp.countryNameEn || comp.countryNameAr)) || ''
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString(locale.value === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const newPassword = ref('')
const confirmNewPassword = ref('')
const pwLoading = ref(false)
const pwError = ref('')
const pwSuccess = ref('')

const phoneCountryHint = computed(() => {
  if (!phoneNumber.value) return null
  const c = locationService.findCountryByPhone(phoneNumber.value)
  if (!c) return null
  return { code: c.phoneCode, name: locale.value === 'ar' ? c.nameAr : c.nameEn, iso: c.code }
})

const userPhoneDetails = computed<DetailedPhoneInfo | null>(() => {
  const phone = phoneNumber.value || user.value?.phoneNumber || ''
  const countries = locationService.countries.value
  const fallbackId = myCompany.value?.countryId || profileCompany.value?.countryId || null
  const explicitCode = user.value?.phoneCode || null
  return resolvePhoneDetails(phone, countries, locale.value, fallbackId, explicitCode)
})

const userTypeInfo = computed(() => {
  const type = user.value?.userType ?? UserType.OrganizationUser
  if (type === UserType.Admin) {
    return {
      type,
      label: t('admin.roleAdmin'),
      icon: 'shield_person',
      pillClass: 'user-role-pill--admin',
      desc: locale.value === 'ar' ? 'صلاحيات إدارية كاملة' : 'Full Administrator Privileges',
    }
  }
  if (type === UserType.SnulStaff) {
    return {
      type,
      label: t('admin.roleSales'),
      icon: 'support_agent',
      pillClass: 'user-role-pill--sales',
      desc: locale.value === 'ar' ? 'فريق المبيعات والعمليات' : 'Sales & Operational Specialist',
    }
  }
  if (type === UserType.Client) {
    return {
      type,
      label: t('admin.roleClient'),
      icon: 'person',
      pillClass: 'user-role-pill--client',
      desc: locale.value === 'ar' ? 'مشتري / عميل معتمد' : 'Verified Buyer / Client',
    }
  }
  // OrganizationUser is a Provider/Distributor (the company IS the provider).
  return {
    type,
    label: t('admin.roleProvider'),
    icon: 'handshake',
    pillClass: 'user-role-pill--org',
    desc: locale.value === 'ar' ? 'مورّد / موزع معتمد — الشركة هي الجهة المورّدة' : 'Verified Provider / Distributor — your company is the supplying entity',
  }
})

const isAdminOrSales = computed(() => authService.isAdmin.value || authService.isSales.value)
const showCompanyInfo = computed(() => !isAdminOrSales.value)
const companyAddressesCount = computed(() => (showCompanyInfo.value ? companyService.companyAddresses.value.length : 0))

const load = async () => {
  void locationService.loadCountries().catch(() => {})
  if (showCompanyInfo.value) {
    void companyService.loadMyCompany(true).then(() => {
      if (companyService.myCompany.value?.id) void companyService.loadCompanyAddresses().catch(() => {})
    })
  }
  const res = await authService.loadProfile()
  if (res.ok && res.profile) {
    fullName.value = res.profile.fullName
    phoneNumber.value = res.profile.phoneNumber ?? ''
    language.value = res.profile.language
    profilePictureName.value = res.profile.profilePictureName ?? null
    profileCompany.value = (res.profile.company as CompanyDto) ?? null
  } else if (user.value) {
    fullName.value = user.value.fullName
    phoneNumber.value = user.value.phoneNumber ?? ''
    language.value = user.value.language
    profilePictureName.value = user.value.profilePictureName ?? null
  }
}
onMounted(load)

const avatarUrl = () => resolveFileUrl(profilePictureName.value)
const pictureInput = ref<HTMLInputElement | null>(null)

const onPicturePicked = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingPicture.value = true
  try {
    const res = await authService.uploadProfilePicture(file)
    if (res.ok && res.profilePictureName) profilePictureName.value = res.profilePictureName
  } finally {
    uploadingPicture.value = false
    input.value = ''
  }
}

const handleSave = async () => {
  error.value = ''
  if (!fullName.value.trim()) {
    error.value = t('auth.errFullNameRequired')
    return
  }
  loading.value = true
  const res = await authService.updateProfile({
    fullName: fullName.value.trim(),
    phoneNumber: phoneNumber.value.trim() || undefined,
    language: language.value,
  })
  loading.value = false
  if (!res.ok) {
    error.value = res.error
    return
  }
  const newLocale = language.value === AppLanguage.Ar ? 'ar' : 'en'
  if (locale.value !== newLocale) setLocale(newLocale)
  await load()
}

const handleChangePassword = async () => {
  pwError.value = ''
  pwSuccess.value = ''
  if (!newPassword.value || newPassword.value.length < 6) {
    pwError.value = t('auth.errPasswordMin')
    return
  }
  if (newPassword.value !== confirmNewPassword.value) {
    pwError.value = t('auth.errPasswordMismatch')
    return
  }
  if (!user.value) return
  pwLoading.value = true
  try {
    await userRepository.changePassword(user.value.id, newPassword.value)
    pwSuccess.value = t('auth.passwordChanged')
    newPassword.value = ''
    confirmNewPassword.value = ''
    setTimeout(() => {
      void authService.logout()
    }, 1200)
  } catch (e) {
    pwError.value = e instanceof Error ? e.message : t('auth.errGeneric')
  } finally {
    pwLoading.value = false
  }
}

const setLang = async (v: AppLanguage) => {
  language.value = v
  const newLocale = v === AppLanguage.Ar ? 'ar' : 'en'
  if (locale.value !== newLocale) setLocale(newLocale)
  // Always persist: fall back to the stored user values when the form fields
  // are not populated yet, so the choice survives the next login.
  if (!user.value) return
  try {
    await authService.updateProfile({
      fullName: fullName.value.trim() || user.value.fullName,
      phoneNumber: phoneNumber.value.trim() || user.value.phoneNumber || undefined,
      language: v,
    })
  } catch {}
}
</script>

<template>
  <div class="page-shell profile-view">
    <div class="profile-top-bar">
      <BackButton fallback="/" variant="minimal" />

      <!-- Breadcrumb -->
      <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
        <router-link to="/">{{ t('nav.home') }}</router-link>
        <span class="crumb-sep icon--directional">/</span>
        <span class="crumb-active">{{ t('profile.title') }}</span>
      </nav>
    </div>

    <!-- Executive Header -->
    <header class="profile-head" :class="{ 'is-admin-head': isAdminOrSales }">
      <div class="head-chip mono" :class="{ 'head-chip--gold': isAdminOrSales }">
        <span class="pulse-dot"></span>
        <span>{{ t('profile.headerEyebrow') }}</span>
      </div>
      <h1 class="head-title" :class="{ 'head-title--gold': isAdminOrSales }">{{ t('profile.title') }}</h1>
      <p class="head-subtitle">{{ t('profile.subtitle') }}</p>
    </header>

    <SkeletonLoader v-if="!user" type="profile" />

    <div v-else class="profile-grid">
      <!-- Left Column: Identity Card, Language, Addresses Link -->
      <aside class="profile-sidebar">
        <!-- Identity Card -->
        <div class="card id-card" :class="{ 'id-card--admin': userTypeInfo.pillClass === 'user-role-pill--admin', 'id-card--sales': userTypeInfo.pillClass === 'user-role-pill--sales' }">
          <div class="avatar-holder">
            <AppImage
              :src="avatarUrl()"
              placeholder-type="avatar"
              :alt="user?.fullName ?? 'Profile'"
              class="avatar-img"
            />
            <button
              type="button"
              class="btn-camera"
              :aria-label="t('attachment.uploadImage')"
              :disabled="uploadingPicture"
              @click="pictureInput?.click()"
            >
              <span v-if="!uploadingPicture" class="material-symbols-outlined text-[16px]">photo_camera</span>
              <span v-else class="material-symbols-outlined text-[16px] spin-glyph">progress_activity</span>
            </button>
          </div>

          <input
            ref="pictureInput"
            class="sr-only"
            type="file"
            accept="image/*"
            :disabled="uploadingPicture"
            @change="onPicturePicked"
          />

          <h2
            class="user-display-name"
            :class="{
              'is-admin': userTypeInfo.pillClass === 'user-role-pill--admin',
              'is-sales': userTypeInfo.pillClass === 'user-role-pill--sales',
            }"
          >
            {{ user?.fullName }}
          </h2>
          <span class="user-email-text mono">{{ user?.email }}</span>

          <!-- User Role / Type Pill (All User Types) -->
          <div class="user-role-pill mono" :class="userTypeInfo.pillClass" :title="userTypeInfo.desc">
            <span class="material-symbols-outlined text-[15px]">{{ userTypeInfo.icon }}</span>
            <span>{{ userTypeInfo.label }}</span>
          </div>

          <!-- User Phone with Country Phone Code Badge -->
          <div class="user-phone-badge mono" :class="{ 'is-set': !!userPhoneDetails }">
            <span class="material-symbols-outlined text-[15px] phone-icon">call</span>
            <template v-if="userPhoneDetails">
              <span class="flag-icon" :title="userPhoneDetails.countryName">{{ userPhoneDetails.flag }}</span>
              <strong class="phone-code text-indigo-600 font-bold">{{ userPhoneDetails.dialCode }}</strong>
              <span class="phone-national">{{ userPhoneDetails.nationalNumber }}</span>
            </template>
            <template v-else-if="phoneNumber">
              <span class="phone-national">{{ phoneNumber }}</span>
            </template>
            <template v-else>
              <span class="no-phone text-slate-400">{{ t('profile.noPhoneSet') }}</span>
            </template>
          </div>

          <div v-if="userPhoneDetails" class="user-phone-country-sub mono">
            <span>{{ userPhoneDetails.countryName }} ({{ userPhoneDetails.iso }})</span>
          </div>

          <div v-if="myCompany" class="org-name-pill mono">
            <span class="material-symbols-outlined text-[15px] text-indigo-600">domain</span>
            <span class="truncate">{{ myCompany.name }}</span>
          </div>

          <div v-if="user?.isEmailConfirmed" class="verified-pill mono">
            <span class="material-symbols-outlined text-[14px]">verified</span>
            <span>{{ t('profile.verified') }}</span>
          </div>
        </div>

        <!-- Language Preference Card -->
        <div class="card lang-card">
          <div class="card-mini-head">
            <span class="material-symbols-outlined text-[18px] text-indigo-600">language</span>
            <h3 class="card-mini-title">{{ t('profile.language') }}</h3>
          </div>
          <p class="card-mini-desc">{{ t('profile.langHint') }}</p>

          <div class="lang-switch-box" dir="ltr">
            <button
              type="button"
              class="lang-btn mono"
              :class="{ 'is-active': language === AppLanguage.En }"
              @click="setLang(AppLanguage.En)"
            >
              English
            </button>
            <button
              type="button"
              class="lang-btn mono"
              :class="{ 'is-active': language === AppLanguage.Ar }"
              @click="setLang(AppLanguage.Ar)"
            >
              العربية
            </button>
          </div>
        </div>

        <!-- Addresses Navigation Card -->
        <div class="card addr-card">
          <div class="card-mini-head">
            <span class="material-symbols-outlined text-[18px] text-indigo-600">location_on</span>
            <h3 class="card-mini-title">{{ t('profile.addresses') }}</h3>
          </div>
          <p class="card-mini-desc">{{ t('profile.deliveryDesc') }}</p>

          <button
            type="button"
            class="btn-manage-addr mono"
            @click="$router.push({ name: 'addresses' })"
          >
            <span>{{ t('profile.addresses') }}</span>
            <span class="material-symbols-outlined text-[16px] icon--directional">arrow_forward</span>
          </button>
          <span v-if="showCompanyInfo && companyAddressesCount" class="mono addr-count-hint">
            {{ t('profile.companyAddrCount', { count: companyAddressesCount }) }}
          </span>
        </div>
      </aside>

      <!-- Right Column: Personal Information & Password Change -->
      <main class="profile-main-stack">
        <!-- Executive Identity & Phone Code Overview for All User Types -->
        <div class="account-specs-bar card" :class="{ 'account-specs-bar--admin': isAdminOrSales }">
          <div class="specs-bar-cell">
            <span class="specs-bar-lbl mono">{{ t('profile.userType') }}</span>
            <div class="specs-bar-val">
              <span
                class="material-symbols-outlined text-[18px]"
                :class="userTypeInfo.pillClass === 'user-role-pill--admin' ? 'wl-text-gold' : 'text-indigo-600'"
                >{{ userTypeInfo.icon }}</span
              >
              <strong
                class="font-bold"
                :class="userTypeInfo.pillClass === 'user-role-pill--admin' ? 'specs-admin-name' : 'text-slate-900'"
                >{{ userTypeInfo.label }}</strong
              >
            </div>
          </div>

          <div class="specs-bar-cell">
            <span class="specs-bar-lbl mono">{{ t('profile.phoneCode') }}</span>
            <div class="specs-bar-val">
              <template v-if="userPhoneDetails">
                <span class="flag-icon text-[18px]">{{ userPhoneDetails.flag }}</span>
                <strong
                  class="font-extrabold text-base"
                  :class="isAdminOrSales ? 'specs-admin-name' : 'text-indigo-600'"
                  >{{ userPhoneDetails.dialCode }}</strong
                >
                <span class="text-xs text-slate-500 font-mono">({{ userPhoneDetails.iso }})</span>
              </template>
              <span v-else class="text-slate-400">—</span>
            </div>
          </div>

          <div class="specs-bar-cell">
            <span class="specs-bar-lbl mono">{{ t('profile.phone') }}</span>
            <div class="specs-bar-val">
              <span v-if="userPhoneDetails" class="font-mono text-slate-800 font-semibold" dir="ltr">{{ userPhoneDetails.fullFormatted }}</span>
              <span v-else-if="phoneNumber" class="font-mono text-slate-800">{{ phoneNumber }}</span>
              <span v-else class="text-slate-400 text-xs">{{ t('profile.noPhoneSet') }}</span>
            </div>
          </div>

          <div class="specs-bar-cell">
            <span class="specs-bar-lbl mono">{{ t('profile.status') }}</span>
            <div class="specs-bar-val">
              <span class="status-pulse-dot"></span>
              <span class="font-medium text-emerald-700 text-xs">{{ t('admin.active') }} · {{ user?.isEmailConfirmed ? t('profile.verified') : t('profile.pending') }}</span>
            </div>
          </div>
        </div>

        <!-- Personal Information Form -->
        <div class="card form-card">
          <div class="form-card-head">
            <div>
              <h2 class="form-card-title">{{ t('profile.personalInfo') }}</h2>
              <p class="form-card-subtitle">{{ t('profile.subtitle') }}</p>
            </div>
            <span class="mono card-badge">{{ t('profile.identityBadge') }}</span>
          </div>

          <form class="profile-form-inner" @submit.prevent="handleSave">
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.fullName') }} *</label>
              <input
                v-model="fullName"
                required
                class="vip-48-input"
                :placeholder="t('profile.fullNamePlaceholder')"
              />
            </div>

            <div class="fields-2col">
              <div class="field-item">
                <label class="vip-field-label mono">{{ t('profile.email') }}</label>
                <div class="disabled-email-wrap">
                  <span class="material-symbols-outlined email-icon">mail</span>
                  <input :value="user?.email" disabled class="vip-48-input is-disabled" />
                </div>
                <span class="field-caption mono">{{ t('profile.emailVerified') }}</span>
              </div>

              <div class="field-item">
                <div class="phone-label-row">
                  <label class="vip-field-label mono mb-0">{{ t('profile.phone') }}</label>
                  <span v-if="userPhoneDetails" class="phone-code-live-pill mono">
                    <span class="flag">{{ userPhoneDetails.flag }}</span>
                    <span class="lbl">{{ t('profile.phoneCode') }}:</span>
                    <strong class="code">{{ userPhoneDetails.dialCode }}</strong>
                  </span>
                </div>

                <PhoneInput
                  v-model="phoneNumber"
                  :country-id="myCompany?.countryId || profileCompany?.countryId"
                  :placeholder="t('auth.phonePlaceholder')"
                />

                <div v-if="userPhoneDetails" class="phone-meta-banner mono">
                  <div class="meta-banner-item">
                    <span class="meta-label">{{ t('profile.phoneCode') }}:</span>
                    <strong class="meta-val text-indigo-600 font-bold">{{ userPhoneDetails.flag }} {{ userPhoneDetails.dialCode }}</strong>
                  </div>
                  <span class="meta-sep">•</span>
                  <div class="meta-banner-item">
                    <span class="meta-label">{{ t('profile.country') }}:</span>
                    <span class="meta-val">{{ userPhoneDetails.countryName }} ({{ userPhoneDetails.iso }})</span>
                  </div>
                  <template v-if="userPhoneDetails.nationalNumber">
                    <span class="meta-sep">•</span>
                    <div class="meta-banner-item">
                      <span class="meta-label">{{ locale === 'ar' ? 'الرقم:' : 'Number:' }}</span>
                      <span class="meta-val font-semibold text-slate-800">{{ userPhoneDetails.nationalNumber }}</span>
                    </div>
                  </template>
                </div>
                <span v-else-if="phoneCountryHint" class="field-caption mono">
                  {{ phoneCountryHint.code }} — {{ phoneCountryHint.name }} ({{ phoneCountryHint.iso }})
                </span>
                <span v-else class="field-caption mono text-slate-400">
                  {{ locale === 'ar' ? 'حدد رمز الدولة من القائمة وأدخل رقم الهاتف' : 'Select country phone code from the list and enter phone number' }}
                </span>
              </div>
            </div>

            <p v-if="error" class="modal-error-banner" role="alert">{{ error }}</p>

            <button type="submit" :disabled="loading" class="btn-vip-save">
              <span class="material-symbols-outlined text-[18px]">save</span>
              <span>{{ loading ? t('profile.saving') : t('profile.saveChanges') }}</span>
            </button>
          </form>
        </div>

        <!-- Organization / Company Profile Card -->
        <div v-if="showCompanyInfo" class="card form-card company-card-section">
          <div class="form-card-head">
            <div>
              <h2 class="form-card-title">{{ t('profile.companyInfo') }}</h2>
              <p class="form-card-subtitle">{{ t('profile.companyInfoDesc') }}</p>
            </div>
            <span class="mono card-badge card-badge--indigo">{{ t('profile.companyBadge') }}</span>
          </div>

          <!-- Loading state -->
          <div v-if="companyLoading" class="company-detail-box" style="pointer-events:none">
            <div class="company-headline" style="border:none">
              <div class="company-icon-box animate-pulse" style="background:var(--bg-subtle)"></div>
              <div class="company-name-meta" style="width:70%">
                <div class="company-title-row">
                  <div class="sk animate-pulse" style="height:20px;width:180px;border-radius:var(--radius-sm);background:var(--bg-subtle)"></div>
                  <div class="sk animate-pulse" style="height:22px;width:80px;border-radius:var(--radius-pill);background:var(--bg-subtle)"></div>
                </div>
                <div class="sk animate-pulse" style="height:12px;width:140px;border-radius:var(--radius-sm);margin-top:6px;background:var(--bg-subtle)"></div>
              </div>
            </div>
            <div class="company-specs-grid">
              <div v-for="s in 3" :key="s" class="spec-cell">
                <div class="sk animate-pulse" style="height:10px;width:60px;border-radius:var(--radius-sm);background:var(--bg-subtle)"></div>
                <div class="sk animate-pulse" style="height:16px;width:100px;border-radius:var(--radius-sm);margin-top:6px;background:var(--bg-subtle)"></div>
              </div>
            </div>
          </div>

          <!-- Linked Company View -->
          <div v-else-if="myCompany" class="company-detail-box">
            <!-- Company Headline Banner -->
            <div class="company-headline">
              <div class="company-icon-box">
                <span class="material-symbols-outlined text-[28px] text-indigo-600">domain</span>
              </div>
              <div class="company-name-meta">
                <div class="company-title-row">
                  <h3 class="company-display-name">{{ myCompany.name }}</h3>
                  <span
                    class="status-pill mono"
                    :class="{
                      'status-pill--verified': isApproved(myCompany.status),
                      'status-pill--pending': isPending(myCompany.status),
                      'status-pill--declined': isRejected(myCompany.status),
                    }"
                  >
                    <span class="pill-dot"></span>
                    <span>{{ companyStatusLabel(myCompany.status) }}</span>
                  </span>
                </div>
                <p v-if="myCompany.email" class="company-email mono">
                  <span class="material-symbols-outlined text-[15px] text-slate-400">mail</span>
                  <span>{{ myCompany.email }}</span>
                </p>
              </div>
            </div>

            <!-- Key Specs Grid -->
            <div class="company-specs-grid">
              <div class="spec-cell">
                <span class="spec-label mono">{{ t('profile.companyType') }}</span>
                <div class="spec-val">
                  <span class="material-symbols-outlined text-[17px] text-indigo-500">category</span>
                  <span>{{ companyTypeName(myCompany.type) }}</span>
                </div>
              </div>

              <div class="spec-cell">
                <span class="spec-label mono">{{ t('profile.companyCountry') }}</span>
                <div class="spec-val">
                  <span class="material-symbols-outlined text-[17px] text-emerald-500">public</span>
                  <span>{{ companyCountryName(myCompany) || '—' }}</span>
                </div>
              </div>

              <div class="spec-cell">
                <span class="spec-label mono">{{ t('profile.companyCreated') }}</span>
                <div class="spec-val">
                  <span class="material-symbols-outlined text-[17px] text-slate-400">calendar_today</span>
                  <span class="mono">{{ formatDate(myCompany.createdAt) }}</span>
                </div>
              </div>
            </div>

            <!-- Addresses & Actions Foot -->
            <div class="company-foot-actions">
              <div class="foot-info">
                <span class="material-symbols-outlined text-[18px] text-indigo-600">location_on</span>
                <span class="mono text-xs text-slate-700">
                  {{ t('profile.companyAddrCount', { count: companyAddressesCount }) }}
                </span>
              </div>
              <router-link to="/addresses" class="btn-company-addr mono">
                <span>{{ t('profile.addresses') }}</span>
                <span class="material-symbols-outlined text-[15px] icon--directional">arrow_forward</span>
              </router-link>
            </div>
          </div>

          <!-- Empty Company State -->
          <div v-else class="empty-company-box">
            <div class="empty-company-icon">
              <span class="material-symbols-outlined text-[32px] text-slate-400">business</span>
            </div>
            <div class="empty-company-text">
              <strong class="empty-title">{{ t('profile.noCompanyLinked') }}</strong>
              <p class="empty-desc">{{ t('profile.noCompanyLinkedDesc') }}</p>
            </div>
            <router-link to="/auth/register" class="btn-apply-dist mono">
              <span>{{ t('profile.applyDistributor') }}</span>
              <span class="material-symbols-outlined text-[16px] icon--directional">arrow_forward</span>
            </router-link>
          </div>
        </div>

        <!-- Change Password Form -->
        <div class="card form-card">
          <div class="form-card-head">
            <div>
              <h2 class="form-card-title">{{ t('profile.changePassword') }}</h2>
              <p class="form-card-subtitle">{{ t('auth.resetSubtitle') }}</p>
            </div>
            <span class="mono card-badge card-badge--amber">{{ t('profile.credentialBadge') }}</span>
          </div>

          <form class="profile-form-inner" @submit.prevent="handleChangePassword">
            <div class="fields-2col">
              <div class="field-item">
                <label class="vip-field-label mono">{{ t('auth.newPassword') }} *</label>
                <input
                  v-model="newPassword"
                  type="password"
                  required
                  class="vip-48-input"
                  autocomplete="new-password"
                />
              </div>

              <div class="field-item">
                <label class="vip-field-label mono">{{ t('auth.confirmNewPassword') }} *</label>
                <input
                  v-model="confirmNewPassword"
                  type="password"
                  required
                  class="vip-48-input"
                  autocomplete="new-password"
                />
              </div>
            </div>

            <p v-if="pwError" class="modal-error-banner">{{ pwError }}</p>
            <p v-if="pwSuccess" class="modal-success-banner">{{ pwSuccess }}</p>

            <button type="submit" :disabled="pwLoading" class="btn-vip-outline">
              <span class="material-symbols-outlined text-[18px]">key</span>
              <span>{{ pwLoading ? t('auth.resetting') : t('auth.resetPassword') }}</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.profile-view {
  width: 100%;
}

.profile-top-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-1);
}

.crumb-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.crumb-bar a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.crumb-bar a:hover {
  color: var(--wl-primary);
}

.crumb-sep {
  color: var(--wl-line-strong);
}

.crumb-active {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

.profile-head {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.25rem;
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(105, 169, 255, 0.2);
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-pill);
  letter-spacing: 0.06em;
  width: fit-content;
  margin-bottom: var(--space-1);
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--wl-primary);
}

.head-chip--gold {
  color: var(--wl-gold);
  background: var(--wl-gold-soft);
  border-color: rgba(255, 209, 102, 0.35);
}

.head-chip--gold .pulse-dot {
  background: var(--wl-gold);
  box-shadow: 0 0 0 3px rgba(255, 209, 102, 0.22);
}

.head-title {
  font-family: var(--wl-font-display);
  font-size: clamp(1.5rem, 2.5vw, 1.85rem);
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.15;
  background: var(--wl-gradient-gold);
  -webkit-background-clip: text;
  background-clip: text;
}

.head-title--gold {
  background: var(--wl-gradient-gold);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.head-subtitle {
  font-size: var(--step-0);
  color: var(--wl-text-secondary);
  margin: 0;
  line-height: 1.5;
}

/* 2-Column Responsive Layout */
.profile-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: var(--wl-page-gap);
  align-items: start;
}

.profile-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--wl-page-gap);
}

.card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg, 16px);
  padding: var(--wl-card-padding);
  box-shadow: var(--wl-shadow-card);
}

/* Identity Card */
.id-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.35rem;
}

.avatar-holder {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: visible;
  margin-bottom: 0.65rem;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-pill);
  object-fit: cover;
  border: 3px solid var(--wl-primary-soft);
  box-shadow: var(--shadow-card);
}

.btn-camera {
  position: absolute;
  bottom: 0;
  inset-inline-end: 0;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-pill);
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: 2px solid var(--wl-surface);
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition: background 0.15s ease, transform 0.15s ease;
}

.btn-camera:hover:not(:disabled) {
  background: var(--wl-primary-hover);
  transform: scale(1.05);
}

.btn-camera:active:not(:disabled) {
  transform: scale(0.95);
}

.user-display-name {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
}

/* Yellow-degree visualization for admin identity */
.user-display-name.is-admin {
  background: var(--wl-gradient-gold);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: 800;
  letter-spacing: -0.015em;
}

.user-display-name.is-staff {
  color: var(--wl-success);
}

.id-card--admin {
  border-color: rgba(255, 209, 102, 0.4) !important;
  background:
    linear-gradient(180deg, rgba(255, 209, 102, 0.08) 0%, transparent 32%),
    var(--wl-surface) !important;
  box-shadow: var(--wl-gold-ring), var(--wl-shadow-card) !important;
}

.id-card--admin .avatar-img {
  border-color: rgba(255, 209, 102, 0.55) !important;
  box-shadow: 0 0 0 3px rgba(255, 209, 102, 0.18), var(--shadow-sm) !important;
}

.id-card--staff {
  border-color: rgba(62, 215, 180, 0.35) !important;
}

.user-email-text {
  font-size: 12px;
  color: var(--wl-text-secondary);
}

.verified-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-success);
  background: var(--wl-success-soft);
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: 0.2rem 0.65rem;
  border-radius: var(--radius-pill);
  margin-top: var(--space-1);
}

.user-role-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--step--1);
  font-weight: 700;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  margin-top: var(--space-1);
  letter-spacing: 0.03em;
}

.user-role-pill--admin {
  background: var(--wl-gold-soft);
  color: var(--wl-gold);
  border: 1px solid rgba(255, 209, 102, 0.4);
  box-shadow: 0 0 0 3px rgba(255, 209, 102, 0.12), var(--shadow-card);
  text-shadow: 0 1px 8px rgba(233, 168, 37, 0.25);
}

.user-role-pill--sales {
  background: rgba(62, 215, 180, 0.12);
  color: var(--wl-success);
  border: 1px solid rgba(62, 215, 180, 0.32);
}

.user-role-pill--org {
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  border: 1px solid rgba(105, 169, 255, 0.25);
}

.user-phone-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  font-size: var(--step-0);
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  margin-top: var(--space-1);
  max-width: 100%;
}

.user-phone-badge.is-set {
  background: var(--wl-primary-soft);
  border-color: var(--wl-primary-soft);
}

.user-phone-badge .phone-icon {
  color: var(--wl-primary);
}

.user-phone-badge .flag-icon {
  font-size: 14px;
  line-height: 1;
}

.user-phone-badge .phone-code {
  color: var(--wl-primary);
  font-weight: 700;
}

.user-phone-badge .phone-national {
  color: var(--wl-ink-strong);
  font-weight: 600;
}

.user-phone-badge .no-phone {
  font-size: 11.5px;
}

.user-phone-country-sub {
  font-size: var(--step--1);
  color: var(--wl-text-secondary);
  margin-top: var(--space-1);
}

.org-name-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(105, 169, 255, 0.25);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  margin-top: var(--space-1);
  max-width: 100%;
}

/* Mini Cards */
.card-mini-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.card-mini-title {
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
}

.card-mini-desc {
  font-size: var(--step-0);
  color: var(--wl-text-secondary);
  margin: 0 0 var(--space-3);
  line-height: 1.45;
}

.lang-switch-box {
  display: flex;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-sm);
  padding: 3px;
  gap: 3px;
}

.lang-btn {
  flex: 1;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: none;
  background: transparent;
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.lang-btn.is-active {
  background: var(--wl-surface);
  color: var(--wl-primary);
  box-shadow: var(--shadow-card);
}

.btn-manage-addr {
  width: 100%;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  background: var(--wl-primary-soft);
  border: 1px solid rgba(105, 169, 255, 0.25);
  color: var(--wl-primary);
  border-radius: var(--radius-md);
  font-size: var(--step-0);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-manage-addr:hover:not(:disabled) {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
}

.addr-count-hint {
  display: block;
  text-align: center;
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin-top: var(--space-2);
}

/* Main Form Stack */
.profile-main-stack {
  display: flex;
  flex-direction: column;
  gap: var(--wl-page-gap);
}

/* Executive Account & Identity Overview Bar */
.account-specs-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: linear-gradient(135deg, var(--wl-surface) 0%, var(--wl-surface-soft) 100%);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}

.account-specs-bar--admin {
  border-color: rgba(255, 209, 102, 0.35);
  background:
    linear-gradient(135deg, rgba(255, 209, 102, 0.1) 0%, transparent 45%),
    linear-gradient(135deg, var(--wl-surface) 0%, var(--wl-surface-soft) 100%);
}

.specs-admin-name {
  background: var(--wl-gradient-gold);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent !important;
  font-weight: 800;
}

.specs-bar-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-inline-end: 1px solid var(--wl-border);
}

.specs-bar-cell:last-child {
  border-inline-end: none;
}

.specs-bar-lbl {
  font-size: var(--step--1);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--wl-muted);
}

.specs-bar-val {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
  flex-wrap: wrap;
}

.status-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-pill);
  background: var(--fg-success, #198754);
  box-shadow: 0 0 0 3px rgba(25, 135, 84, 0.2);
  flex-shrink: 0;
}

.form-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--wl-border);
  padding-bottom: var(--space-3);
  margin-bottom: var(--space-5);
  gap: var(--space-4);
}

.form-card-title {
  font-size: var(--step-1);
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.2;
}

.card-badge {
  font-size: var(--step--1);
  font-weight: 800;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(15, 61, 86, 0.15);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-xs, 3px);
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.card-badge--amber {
  color: var(--fg-warning, #E67E22);
  background: var(--color-warning-50, #FFF8E1);
  border-color: rgba(230, 126, 34, 0.25);
}

.card-badge--indigo {
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border-color: var(--wl-primary-soft);
}

.form-card-subtitle {
  font-size: var(--step-0);
  color: var(--wl-text-secondary);
  margin: var(--space-1) 0 0;
  line-height: 1.45;
}

.profile-form-inner {
  display: flex;
  flex-direction: column;
  gap: var(--wl-form-gap);
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: var(--wl-field-gap);
}

.vip-field-label {
  font-family: var(--wl-font-body);
  font-size: var(--step-0);
  font-weight: 600;
  color: var(--wl-ink-soft);
  letter-spacing: 0.015em;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.vip-48-input {
  width: 100%;
  height: 44px;
  min-height: 44px;
  padding: 0 1rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  font-size: var(--step-0);
  font-family: var(--wl-font-body);
  font-weight: 500;
  color: var(--wl-ink-strong);
  outline: none;
  box-shadow: var(--shadow-card);
  transition: border-color 0.22s var(--wl-ease-spring), box-shadow 0.22s var(--wl-ease-spring), background-color 0.2s ease;
}

.vip-48-input:focus {
  background: var(--wl-surface);
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.vip-48-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.disabled-email-wrap {
  position: relative;
}

.email-icon {
  position: absolute;
  inset-inline-start: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: var(--wl-muted);
  pointer-events: none;
}

.is-disabled {
  background: var(--wl-surface-soft) !important;
  color: var(--wl-ink-soft) !important;
  padding-inline-start: 38px !important;
  cursor: not-allowed;
  border-color: var(--wl-border) !important;
}

.field-caption {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.phone-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.phone-code-live-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--step--1);
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  border: 1px solid rgba(105, 169, 255, 0.25);
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-2);
}

.phone-code-live-pill .flag {
  font-size: var(--step-0);
  line-height: 1;
}

.phone-code-live-pill .lbl {
  color: var(--wl-muted);
  font-size: var(--step--1);
}

.phone-meta-banner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  margin-top: var(--space-1);
  font-size: var(--step--1);
  color: var(--wl-ink-soft);
}

.meta-banner-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.meta-label {
  color: var(--wl-muted);
}

.meta-val {
  color: var(--wl-ink-strong);
}

.meta-sep {
  color: var(--wl-border-strong);
}

.fields-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--wl-form-gap);
}

.btn-vip-save {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 44px;
  min-height: 44px;
  padding: 0 1.5rem;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: 1px solid var(--wl-primary);
  border-radius: var(--radius-sm, 10px);
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  width: fit-content;
  box-shadow: var(--wl-primary-shadow);
  transition: all 0.18s var(--wl-ease-spring);
}

.btn-vip-save:hover:not(:disabled) {
  background: var(--wl-primary-hover);
  transform: translateY(-1px);
}

.btn-vip-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 44px;
  min-height: 44px;
  padding: 0 1.5rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  color: var(--wl-ink-strong);
  border-radius: var(--radius-sm, 10px);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  width: fit-content;
  box-shadow: var(--shadow-card);
  transition: all 0.18s ease;
}

.btn-vip-outline:hover:not(:disabled) {
  border-color: var(--wl-primary);
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
}

.btn-vip-outline:active:not(:disabled) {
  transform: scale(0.985);
}

.modal-error-banner {
  background: var(--wl-danger-soft);
  border: 1px solid rgba(244, 63, 94, 0.25);
  color: var(--wl-danger);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--step-0);
}

.modal-success-banner {
  background: var(--wl-success-soft);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: var(--wl-success);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--step-0);
}

.spin-glyph {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Company Card & Detail Section */
.company-card-section {
  background: var(--wl-surface);
}

.company-loading-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  padding: 2.5rem 1rem;
}

.company-detail-box {
  display: flex;
  flex-direction: column;
  gap: var(--wl-form-gap);
}

/* Company Headline */
.company-headline {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
}

.company-icon-box {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  box-shadow: var(--shadow-card);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.company-name-meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}

.company-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.company-display-name {
  font-size: var(--step-1);
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.2;
}

.company-email {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--step-0);
  color: var(--wl-text-secondary);
  margin: 0;
  word-break: break-all;
}

/* Status Pill */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--step--1);
  font-weight: 700;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: currentColor;
}

.status-pill--verified {
  color: var(--wl-success);
  background: var(--wl-success-soft);
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.status-pill--pending {
  color: var(--wl-warning);
  background: var(--wl-warning-soft);
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.status-pill--declined {
  color: var(--wl-danger);
  background: var(--wl-danger-soft);
  border: 1px solid rgba(244, 63, 94, 0.25);
}

/* Specs Grid */
.company-specs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.spec-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  transition: border-color 0.15s ease;
}

.spec-cell:hover {
  border-color: var(--wl-border-strong);
}

.spec-label {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.spec-val {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-strong);
}

/* Foot actions */
.company-foot-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--space-3);
  border-top: 1px solid var(--wl-border);
  gap: var(--space-4);
  flex-wrap: wrap;
}

.foot-info {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.btn-company-addr {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(105, 169, 255, 0.2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-company-addr:hover:not(:disabled) {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
}

/* Empty Company */
.empty-company-box {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-6);
  background: var(--wl-surface-soft);
  border: 1.5px dashed var(--wl-border-strong);
  border-radius: var(--radius-md);
  flex-wrap: wrap;
}

.empty-company-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.empty-company-text {
  flex: 1;
  min-width: 220px;
}

.empty-title {
  display: block;
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin-bottom: var(--space-1);
}

.empty-desc {
  font-size: var(--step-0);
  color: var(--wl-text-secondary);
  margin: 0;
  line-height: 1.45;
}

.btn-apply-dist {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-on-primary);
  background: var(--wl-primary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  text-decoration: none;
  white-space: nowrap;
  box-shadow: var(--wl-primary-shadow);
  transition: background 0.15s ease;
}

.btn-apply-dist:hover:not(:disabled) {
  background: var(--wl-primary-hover);
}

@media (max-width: 900px) {
  .account-specs-bar {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
  }
  .specs-bar-cell:nth-child(2) {
    border-inline-end: none;
  }
  .profile-grid {
    grid-template-columns: 1fr;
    gap: var(--wl-page-gap);
  }
  .fields-2col {
    grid-template-columns: 1fr;
    gap: var(--wl-form-gap);
  }
}

@media (max-width: 768px) {
  .company-specs-grid {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }
  .company-headline {
    flex-direction: column;
    align-items: flex-start;
  }
  .btn-vip-save, .btn-vip-outline {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 560px) {
  .account-specs-bar {
    grid-template-columns: 1fr;
  }
  .specs-bar-cell {
    border-inline-end: none;
    border-bottom: 1px solid var(--wl-border);
    padding-bottom: 0.65rem;
  }
  .specs-bar-cell:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
}
</style>
