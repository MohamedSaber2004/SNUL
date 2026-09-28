<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import FileUpload from '../../components/ui/FileUpload.vue'
import { useUsers } from '../../composables/useUsers'
import { t, locale } from '../../i18n'
import { UserType, USER_TYPE_ROLE_KEY } from '../../domain/models/user'
import type { UserDto } from '../../domain/models/user'
import { authService, locationService, userRepository, companyRepository } from '../../di/container'
import type { CompanyDto } from '../../domain/models/company'
import { CompanyType, CompanyStatus } from '../../domain/models/company'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { ATTACHMENT_PLACE, MEDIA_TYPE } from '../../config/api.config'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { resolveFileUrl, PLACEHOLDER } from '../../utils/file-url'
import { resolvePhoneDetails } from '../../utils/phone'

const {
  users,
  loading,
  search,
  page,
  totalPages,
  totalCount,
  error,
  load,
  onSearch,
  showForm,
  editing,
  form,
  formLoading,
  formError,
  openCreate,
  openEdit,
  closeForm,
  handleSubmit,
  handleDelete,
} = useUsers()

// --- Details modal & Company data loading ---
const showDetailsModal = ref(false)
const selectedUser = ref<UserDto | null>(null)
const detailsLoading = ref(false)
const relatedCompany = ref<CompanyDto | null>(null)
const companyLoading = ref(false)

const isDistributorOrProvider = (u: UserDto | null): boolean => {
  if (!u) return false
  if (u.userType === UserType.OrganizationUser) return true
  if (Array.isArray(u.roles)) {
    return u.roles.some((r) => ['Provider', 'Distributor', 'OrganizationUser'].includes(r))
  }
  return false
}

const openDetails = async (u: UserDto) => {
  selectedUser.value = u
  showDetailsModal.value = true
  relatedCompany.value = null
  detailsLoading.value = true

  try {
    const userDetails = await userRepository.getUserById(u.id)
    if (userDetails) {
      selectedUser.value = userDetails
    }
  } catch {
    // Keep initial user if getById fails
  } finally {
    detailsLoading.value = false
  }

  // Load related company data if provider or distributor
  if (isDistributorOrProvider(selectedUser.value)) {
    companyLoading.value = true
    try {
      const compId = selectedUser.value?.companyId || (selectedUser.value as unknown as Record<string, unknown>)?.CompanyId
      if (selectedUser.value?.company) {
        relatedCompany.value = selectedUser.value.company
      } else if (compId) {
        const comp = await companyRepository.getCompanyById(String(compId)).catch(() => null)
        if (comp) {
          relatedCompany.value = comp
        }
      }

      if (!relatedCompany.value && selectedUser.value?.email) {
        const compList = await companyRepository.getCompanies({ searchTerm: selectedUser.value.email }).catch(() => null)
        const matched = compList?.data?.find(
          (c) => c.email?.toLowerCase() === selectedUser.value?.email.toLowerCase(),
        )
        if (matched) {
          relatedCompany.value = matched
        } else {
          const apps = await companyRepository.getDistributorApplications({ searchTerm: selectedUser.value.email }).catch(() => null)
          const matchedApp = apps?.data?.find(
            (a) => a.email?.toLowerCase() === selectedUser.value?.email.toLowerCase(),
          )
          if (matchedApp) {
            relatedCompany.value = {
              id: matchedApp.id,
              name: matchedApp.companyName,
              email: matchedApp.email,
              type: matchedApp.type,
              countryId: matchedApp.countryId,
              countryNameEn: matchedApp.countryName,
              status: (typeof matchedApp.status === 'number' ? (matchedApp.status as unknown as CompanyStatus) : CompanyStatus.Pending),
              isActive: true,
              isProvider: true,
              createdAt: '',
            }
          }
        }
      }
    } catch {
      // Non-blocking
    } finally {
      companyLoading.value = false
    }
  }
}

const closeDetails = () => {
  showDetailsModal.value = false
  selectedUser.value = null
  relatedCompany.value = null
}

// --- Activate / Deactivate (never yourself — backend rejects self-deactivation) ---
const togglePendingId = ref<string | null>(null)
const isSelf = (u: UserDto): boolean => authService.user.value?.id === u.id

const toggleActive = async (u: UserDto) => {
  if (isSelf(u)) return
  const nextActive = !u.isActive
  const ok = await confirmService.confirmAction(
    nextActive ? t('admin.confirmActivate') : t('admin.confirmDeactivate'),
    {
      title: nextActive ? t('admin.activate') : t('admin.deactivate'),
      variant: nextActive ? 'primary' : 'warning',
      icon: nextActive ? 'check_circle' : 'block',
      confirmText: nextActive ? t('admin.activate') : t('admin.deactivate'),
      cancelText: t('common.cancel'),
    },
  )
  if (!ok) return
  togglePendingId.value = u.id
  try {
    await userRepository.updateUser(u.id, { isActive: nextActive })
    toastService.success(nextActive ? t('admin.activated') : t('admin.deactivated'))
    await load()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    togglePendingId.value = null
  }
}

// --- Change password modal ---
const showPasswordModal = ref(false)
const passwordTarget = ref<UserDto | null>(null)
const newPassword = ref('')
const confirmPassword = ref('')
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const passwordError = ref('')
const passwordLoading = ref(false)

const openPasswordModal = (u: UserDto) => {
  passwordTarget.value = u
  newPassword.value = ''
  confirmPassword.value = ''
  showNewPassword.value = false
  showConfirmPassword.value = false
  passwordError.value = ''
  showPasswordModal.value = true
}

const closePasswordModal = () => {
  showPasswordModal.value = false
  passwordTarget.value = null
  passwordError.value = ''
}

const submitPassword = async () => {
  if (!passwordTarget.value) return
  if (newPassword.value.length < 8) {
    passwordError.value = t('auth.errPasswordMin')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = t('auth.errPasswordMismatch')
    return
  }
  passwordLoading.value = true
  passwordError.value = ''
  try {
    await userRepository.changePassword(passwordTarget.value.id, newPassword.value)
    toastService.success(t('admin.updateSuccess'))
    closePasswordModal()
  } catch (e) {
    passwordError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    passwordLoading.value = false
  }
}

const getAvatarColor = (name?: string): string => {
  // Clinical Precision series: deep medical navy, steel teal, precision cyan, amber, green, muted slate
  const colors = ['#0F3D56', '#147D92', '#28A7A1', '#E67E22', '#198754', '#627D98']
  if (!name) return '#0F3D56'
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length] ?? '#0F3D56'
}

const getAvatarTextColor = (bg: string): string => {
  return bg === '#E67E22' ? '#102A43' : '#FFFFFF'
}

onMounted(() => {
  if (!locationService.countries.value.length) {
    void locationService.loadCountries().catch(() => {})
  }
})

const getUserPhoneDetails = (phone?: string | null, explicitCode?: string | null) => {
  if (!phone) return null
  return resolvePhoneDetails(phone, locationService.countries.value, 'en', null, explicitCode)
}
</script>

<template>
  <AdminLayout>
    <div class="users-view">
      <!-- Executive Header -->
      <header class="users-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>IDENTITY &amp; ACCESS CONTROL</span>
          </div>
          <h1 class="head-title">{{ t('admin.users') }}</h1>
          <p class="head-subtitle">{{ t('admin.usersDesc') }}</p>
        </div>
        <BaseButton variant="primary" @click="openCreate">
          <span class="material-symbols-outlined text-[18px]">add</span>
          <span>{{ t('admin.createUser') }}</span>
        </BaseButton>
      </header>

      <!-- 44px Search & Counts Toolbar -->
      <div class="toolbar-card">
        <div class="search-input-wrap">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            v-model="search"
            :placeholder="t('admin.searchPlaceholder')"
            :aria-label="t('common.searchPlaceholder')"
            class="toolbar-search-input"
            @input="onSearch"
          />
        </div>
        <span class="mono counter-text">{{ t('admin.accountsCount', { count: totalCount }) }}</span>
      </div>

      <!-- Executive Data Table -->
      <DataState
        :loading="loading && !users.length"
        :error="error && !users.length ? error : null"
        :empty="!users.length && !loading && !error"
        :empty-title="t('admin.noResults')"
        :empty-description="t('admin.emptyUsersDesc')"
        skeleton-type="table"
        :skeleton-count="5"
        min-height="320px"
        @retry="load"
      >
        <div class="table-card">
          <div class="table-wrap">
            <table class="exec-table">
              <thead>
                <tr>
                  <th>{{ t('admin.users') }}</th>
                  <th>{{ t('admin.email') }}</th>
                  <th>{{ t('admin.userType') }}</th>
                  <th>{{ t('commerce.status') }}</th>
                  <th class="text-end">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in users" :key="u.id" class="exec-row">
                  <td>
                    <div class="user-cell">
                      <div class="user-avatar-wrap">
                        <img
                          v-if="u.profilePictureName"
                          :src="resolveFileUrl(u.profilePictureName, PLACEHOLDER)"
                          :alt="u.fullName"
                          class="user-avatar-img"
                        />
                        <div
                          v-else
                          class="user-avatar-fallback mono"
                          :style="{
                            backgroundColor: getAvatarColor(u.fullName),
                            color: getAvatarTextColor(getAvatarColor(u.fullName)),
                          }"
                        >
                          {{ (u.fullName || 'U').slice(0, 2).toUpperCase() }}
                        </div>
                      </div>
                      <div class="user-info">
                        <strong class="user-name">{{ u.fullName }}</strong>
                        <div v-if="u.phoneNumber" class="user-phone-line mono">
                          <template v-if="getUserPhoneDetails(u.phoneNumber, u.phoneCode)">
                            <span
                              v-if="getUserPhoneDetails(u.phoneNumber, u.phoneCode)?.flag"
                              class="flag-icon"
                              :title="getUserPhoneDetails(u.phoneNumber, u.phoneCode)?.countryName"
                            >
                              {{ getUserPhoneDetails(u.phoneNumber, u.phoneCode)?.flag }}
                            </span>
                            <span class="phone-dial-code">
                              {{ getUserPhoneDetails(u.phoneNumber, u.phoneCode)?.dialCode }}
                            </span>
                            <span class="phone-number">
                              {{ getUserPhoneDetails(u.phoneNumber, u.phoneCode)?.nationalNumber }}
                            </span>
                          </template>
                          <span v-else class="user-phone">{{ u.phoneNumber }}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="mono text-xs text-slate-600">{{ u.email }}</td>
                  <td>
                    <span
                      class="role-pill mono"
                      :class="{
                        'role-pill--admin': u.userType === UserType.Admin,
                        'role-pill--sales': u.userType === UserType.SnulStaff,
                        'role-pill--org': u.userType === UserType.OrganizationUser,
                      }"
                    >
                      {{ t(`admin.${USER_TYPE_ROLE_KEY(u.userType)}`) }}
                    </span>
                  </td>
                  <td>
                    <span
                      class="status-dot-badge mono"
                      :class="u.isActive ? 'status-dot-badge--active' : 'status-dot-badge--inactive'"
                    >
                      <span class="dot"></span>
                      <span>{{ u.isActive ? t('admin.active') : t('admin.inactive') }}</span>
                    </span>
                  </td>
                  <td>
                    <div class="row-actions">
                      <button
                        type="button"
                        class="row-action-btn"
                        :title="t('admin.viewDetails')"
                        :aria-label="t('admin.viewDetails')"
                        @click="openDetails(u)"
                      >
                        <span class="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn"
                        :title="t('common.edit')"
                        :aria-label="t('common.edit')"
                        @click="openEdit(u)"
                      >
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn row-action-btn--gold"
                        :title="t('admin.changeUserPassword')"
                        :aria-label="t('admin.changeUserPassword')"
                        @click="openPasswordModal(u)"
                      >
                        <span class="material-symbols-outlined text-[18px]">key</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn"
                        :class="u.isActive ? 'row-action-btn--deactivate' : 'row-action-btn--activate'"
                        :title="u.isActive ? t('admin.deactivate') : t('admin.activate')"
                        :aria-label="u.isActive ? t('admin.deactivate') : t('admin.activate')"
                        :disabled="togglePendingId === u.id || isSelf(u)"
                        @click="toggleActive(u)"
                      >
                        <span class="material-symbols-outlined text-[18px]">{{
                          u.isActive ? 'block' : 'check_circle'
                        }}</span>
                      </button>
                      <button
                        type="button"
                        class="row-action-btn row-action-btn--danger"
                        :title="t('common.delete')"
                        :aria-label="t('common.delete')"
                        @click="handleDelete(u)"
                      >
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Integrated Pagination -->
          <AppPagination
            v-model:page="page"
            :total-pages="totalPages"
            :total-items="totalCount"
            :page-size="10"
            variant="table"
          />
        </div>
      </DataState>

      <!-- Add / Edit Modal -->
      <BaseModal
        v-model="showForm"
        :title="editing ? t('admin.editUser') : t('admin.createUser')"
        max-width="600px"
        @close="closeForm"
      >
        <form class="admin-modal-form" @submit.prevent="handleSubmit">
          <div class="form-field">
            <FileUpload
              :model-value="form.profilePictureName"
              :place="ATTACHMENT_PLACE.USERS"
              :file-type="MEDIA_TYPE.IMAGE"
              accept="image/*"
              :label="t('admin.userAvatar')"
              @update:modelValue="form.profilePictureName = $event"
            />
          </div>
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="user-fullname">{{ t('admin.userFullName') }} *</label>
              <input id="user-fullname" v-model="form.fullName" type="text" class="field-input" required />
            </div>
            <div class="form-field">
              <label class="field-label" for="user-email">{{ t('admin.email') }} *</label>
              <input
                id="user-email"
                v-model="form.email"
                type="email"
                class="field-input mono"
                required
                :disabled="!!editing"
              />
            </div>
          </div>
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="user-phone">{{ t('admin.phone') }}</label>
              <input id="user-phone" v-model="form.phoneNumber" type="tel" class="field-input mono" />
            </div>
            <div class="form-field">
              <label class="field-label" for="user-role">{{ t('admin.userType') }} *</label>
                <select id="user-role" v-model="form.userType" class="field-select">
                  <option :value="UserType.Admin">{{ t('admin.roleAdmin') }}</option>
                  <option :value="UserType.Client">{{ t('admin.roleClient') }}</option>
                  <option :value="UserType.OrganizationUser">{{ t('admin.roleProvider') }}</option>
                </select>
            </div>
          </div>
          <div v-if="!editing" class="form-field">
            <label class="field-label" for="user-password">{{ t('admin.userPassword') }} *</label>
            <input
              id="user-password"
              v-model="form.password"
              type="password"
              class="field-input mono"
              minlength="8"
              autocomplete="new-password"
            />
          </div>
          <div class="form-field">
            <label class="toggle-label">
              <input v-model="form.isActive" type="checkbox" />
              <span>{{ t('admin.active') }}</span>
            </label>
          </div>

          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

          <div class="modal-foot">
            <BaseButton variant="secondary" type="button" @click="closeForm">
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton variant="primary" type="submit" :loading="formLoading">
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </form>
      </BaseModal>

      <!-- Details Modal -->
      <BaseModal
        v-model="showDetailsModal"
        :title="t('admin.userDetails')"
        max-width="560px"
        @close="closeDetails"
      >
        <div v-if="selectedUser" class="admin-details">
          <div class="user-details-hero">
            <div class="user-avatar-wrap user-avatar-wrap--lg">
              <img
                v-if="selectedUser.profilePictureName"
                :src="resolveFileUrl(selectedUser.profilePictureName, PLACEHOLDER)"
                :alt="selectedUser.fullName"
                class="user-avatar-img"
              />
              <div
                v-else
                class="user-avatar-fallback mono"
                :style="{
                  backgroundColor: getAvatarColor(selectedUser.fullName),
                  color: getAvatarTextColor(getAvatarColor(selectedUser.fullName)),
                }"
              >
                {{ (selectedUser.fullName || 'U').slice(0, 2).toUpperCase() }}
              </div>
            </div>
            <div>
              <strong
                class="user-details-name"
                :class="{ 'wl-text-gold-gradient': selectedUser.userType === UserType.Admin }"
                >{{ selectedUser.fullName }}</strong
              >
              <div class="mono text-xs text-slate-600">{{ selectedUser.email }}</div>
              <div class="user-details-badges">
                <span
                  class="role-pill mono"
                  :class="{
                    'role-pill--admin': selectedUser.userType === UserType.Admin,
                    'role-pill--staff': selectedUser.userType === UserType.SnulStaff,
                    'role-pill--org': selectedUser.userType === UserType.OrganizationUser,
                  }"
                >
                  {{ t(`admin.${USER_TYPE_ROLE_KEY(selectedUser.userType)}`) }}
                </span>
                <span
                  class="status-dot-badge mono"
                  :class="selectedUser.isActive ? 'status-dot-badge--active' : 'status-dot-badge--inactive'"
                >
                  <span class="dot"></span>
                  <span>{{ selectedUser.isActive ? t('admin.active') : t('admin.inactive') }}</span>
                </span>
              </div>
            </div>
          </div>
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.phone') }}</span>
              <strong class="detail-v mono">{{ selectedUser.phoneNumber || '—' }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.email') }}</span>
              <strong class="detail-v mono">{{ selectedUser.isEmailConfirmed ? t('common.verified') : t('common.pending') }}</strong>
            </div>
          </div>

          <!-- Related Company Data (for Distributor / Provider) -->
          <div v-if="isDistributorOrProvider(selectedUser)" class="user-company-section">
            <div class="company-section-head mono">
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[17px] text-teal-600">apartment</span>
                <span class="font-bold">{{ t('admin.companies') }}</span>
              </div>
              <router-link to="/admin/companies" class="comp-link mono text-xs">
                <span>{{ t('common.viewAll') }}</span>
                <span class="material-symbols-outlined text-[13px] icon--directional">open_in_new</span>
              </router-link>
            </div>

            <div v-if="companyLoading" class="company-loading-card">
              <span class="pulse-dot"></span>
              <span class="mono text-xs text-muted">{{ t('common.loading') }}...</span>
            </div>

            <div v-else-if="relatedCompany" class="company-info-card">
              <div class="company-info-head">
                <div class="company-icon-box">
                  <span class="material-symbols-outlined text-[20px] text-teal-700">domain</span>
                </div>
                <div class="company-meta-col">
                  <strong class="company-name-title">{{ relatedCompany.name }}</strong>
                  <div class="company-chips flex items-center gap-1.5 flex-wrap">
                    <span class="badge-chip mono text-[10px]">
                      {{ relatedCompany.type === CompanyType.Distributor ? (t('providers.distributor') || 'Distributor') : (t('admin.roleProvider') || 'Provider') }}
                    </span>
                    <span
                      class="badge-chip mono text-[10px]"
                      :class="relatedCompany.status === CompanyStatus.Approved ? 'badge-chip--success' : 'badge-chip--warning'"
                    >
                      {{ relatedCompany.status === CompanyStatus.Approved ? t('common.verified') : t('common.pending') }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="company-grid-props mono text-xs">
                <div v-if="relatedCompany.email" class="prop-item">
                  <span class="prop-label">{{ t('admin.email') }}:</span>
                  <span class="prop-value">{{ relatedCompany.email }}</span>
                </div>
                <div v-if="relatedCompany.countryNameEn || relatedCompany.countryNameAr" class="prop-item">
                  <span class="prop-label">{{ t('admin.countries') }}:</span>
                  <span class="prop-value">{{ locale === 'ar' ? (relatedCompany.countryNameAr || relatedCompany.countryNameEn) : (relatedCompany.countryNameEn || relatedCompany.countryNameAr) }}</span>
                </div>
              </div>
            </div>

            <div v-else class="company-empty-box mono text-xs">
              <span class="material-symbols-outlined text-[17px] text-amber-500">info</span>
              <span>{{ locale === 'ar' ? 'لم يتم ربط شركة بهذا المستخدم حتى الآن.' : 'No company record is currently linked to this user.' }}</span>
            </div>
          </div>
          <div class="modal-foot modal-foot--split">
            <div class="modal-foot__group">
              <BaseButton variant="secondary" @click="selectedUser && openPasswordModal(selectedUser)">
                <span class="material-symbols-outlined text-[16px]">key</span>
                <span>{{ t('admin.changeUserPassword') }}</span>
              </BaseButton>
            </div>
            <div class="modal-foot__group">
              <BaseButton variant="secondary" @click="selectedUser && openEdit(selectedUser)">
                {{ t('common.edit') }}
              </BaseButton>
              <BaseButton variant="secondary" @click="closeDetails">
                {{ t('common.close') }}
              </BaseButton>
            </div>
          </div>
        </div>
      </BaseModal>

      <!-- Change Password Modal -->
      <BaseModal
        v-model="showPasswordModal"
        :title="t('admin.changeUserPassword')"
        max-width="460px"
        @close="closePasswordModal"
      >
        <form class="admin-modal-form" @submit.prevent="submitPassword">
          <!-- Target user banner -->
          <div v-if="passwordTarget" class="pw-target-banner">
            <div class="user-avatar-wrap user-avatar-wrap--sm">
              <img
                v-if="passwordTarget.profilePictureName"
                :src="resolveFileUrl(passwordTarget.profilePictureName, PLACEHOLDER)"
                :alt="passwordTarget.fullName"
                class="user-avatar-img"
              />
              <div
                v-else
                class="user-avatar-fallback mono text-xs"
                :style="{
                  backgroundColor: getAvatarColor(passwordTarget.fullName),
                  color: getAvatarTextColor(getAvatarColor(passwordTarget.fullName)),
                }"
              >
                {{ (passwordTarget.fullName || 'U').slice(0, 2).toUpperCase() }}
              </div>
            </div>
            <div class="pw-target-info">
              <span class="pw-target-name">{{ passwordTarget.fullName }}</span>
              <span class="pw-target-email mono">{{ passwordTarget.email }}</span>
            </div>
          </div>

          <div class="form-field">
            <label class="field-label" for="new-password">{{ t('admin.userPassword') }} *</label>
            <div class="pw-input-wrapper">
              <input
                id="new-password"
                v-model="newPassword"
                :type="showNewPassword ? 'text' : 'password'"
                class="field-input mono"
                minlength="8"
                autocomplete="new-password"
                required
              />
              <button
                type="button"
                class="pw-toggle-btn"
                :aria-label="showNewPassword ? 'Hide password' : 'Show password'"
                tabindex="-1"
                @click="showNewPassword = !showNewPassword"
              >
                <span class="material-symbols-outlined text-[18px]">{{ showNewPassword ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
          </div>

          <div class="form-field">
            <label class="field-label" for="confirm-password">{{ t('auth.confirmNewPassword') }} *</label>
            <div class="pw-input-wrapper">
              <input
                id="confirm-password"
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                class="field-input mono"
                autocomplete="new-password"
                required
              />
              <button
                type="button"
                class="pw-toggle-btn"
                :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
                tabindex="-1"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <span class="material-symbols-outlined text-[18px]">{{ showConfirmPassword ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
          </div>

          <p v-if="passwordError" class="form-error" role="alert">{{ passwordError }}</p>

          <div class="modal-foot">
            <BaseButton variant="secondary" type="button" @click="closePasswordModal">
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton variant="primary" type="submit" :loading="passwordLoading">
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </form>
      </BaseModal>
    </div>
  </AdminLayout>
</template>

<style scoped>
.users-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.users-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  letter-spacing: 0.06em;
  margin-bottom: 0.5rem;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-primary);
}

.head-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: 1.68rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.1;
}

.head-subtitle {
  font-size: 13.5px;
  color: var(--wl-muted);
  margin: 0.25rem 0 0;
}

/* Toolbar */
.toolbar-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  padding: 0.85rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  box-shadow: var(--shadow-xs);
  flex-wrap: wrap;
}

.search-input-wrap {
  position: relative;
  width: 320px;
  max-width: 100%;
}

.search-icon {
  position: absolute;
  inset-inline-start: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: var(--wl-muted-soft);
  pointer-events: none;
}

.toolbar-search-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  padding-inline-start: 38px;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 13.5px;
  color: var(--wl-ink-strong);
  outline: none;
  box-shadow: var(--shadow-xs);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.toolbar-search-input:focus {
  border-color: var(--wl-primary);
  box-shadow: 0 0 0 3px rgba(105, 169, 255, 0.12);
}

.counter-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--wl-muted);
}

/* Executive Table */
.table-card {
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-card, 8px);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.table-wrap {
  overflow-x: auto;
}

.exec-table {
  width: 100%;
  border-collapse: collapse;
  text-align: start;
}

.exec-table thead th {
  background: var(--wl-surface-soft);
  border-bottom: 1px solid var(--wl-border);
  padding: 0.85rem 1.25rem;
  font-family: var(--wl-font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.exec-row {
  height: 56px;
  border-bottom: 1px solid var(--wl-border);
  transition: background 0.15s ease;
}

.exec-row:hover {
  background: var(--wl-surface-soft);
}

.exec-row td {
  padding: 0.65rem 1.25rem;
  vertical-align: middle;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar-wrap {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--wl-surface-hover);
}

.user-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 800;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.user-name {
  font-size: 13.5px;
  color: var(--wl-ink-strong);
}

.user-phone-line {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11.5px;
  color: var(--wl-muted);
}

.flag-icon {
  font-size: 13px;
  line-height: 1;
}

.phone-dial-code {
  font-weight: 700;
  color: var(--wl-primary);
}

.phone-number {
  color: var(--wl-ink-soft);
}

.user-phone {
  font-size: 11.5px;
  color: var(--wl-muted);
}

.role-pill {
  display: inline-flex;
  font-size: 11px;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  letter-spacing: 0.03em;
}

.role-pill--admin {
  background: var(--wl-gold-soft);
  color: var(--wl-gold);
  border: 1px solid rgba(255, 209, 102, 0.4);
  box-shadow: 0 0 0 3px rgba(255, 209, 102, 0.1);
}

.role-pill--sales {
  background: var(--wl-success-soft);
  color: var(--wl-success);
  border: 1px solid rgba(62, 215, 180, 0.32);
}

.role-pill--org {
  background: var(--wl-surface-soft);
  color: var(--wl-ink-soft);
  border: 1px solid var(--wl-border);
}

.status-dot-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11px;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
}

.status-dot-badge .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot-badge--active {
  background: var(--color-success-50, #E8F5E9);
  color: var(--fg-success, #198754);
}
.status-dot-badge--active .dot { background: var(--color-success-500, #198754); }

.status-dot-badge--inactive {
  background: var(--wl-surface-soft);
  color: var(--wl-muted);
}
.status-dot-badge--inactive .dot { background: var(--wl-muted-soft); }

.user-details-hero {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.user-avatar-wrap--lg {
  width: 64px;
  height: 64px;
}

.user-details-name {
  font-size: 1.1rem;
  color: var(--wl-ink-strong);
}

.user-details-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.4rem;
}

.modal-foot--split {
  justify-content: space-between;
}

.modal-foot__group {
  display: flex;
  gap: 0.75rem;
}

/* Password Modal Additions */
.pw-target-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  margin-bottom: 0.5rem;
}

.user-avatar-wrap--sm {
  width: 34px;
  height: 34px;
}

.pw-target-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.pw-target-name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  line-height: 1.2;
}

.pw-target-email {
  font-size: 11.5px;
  color: var(--wl-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pw-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.pw-input-wrapper .field-input {
  width: 100%;
  padding-inline-end: 40px;
}

.pw-toggle-btn {
  position: absolute;
  inset-inline-end: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  color: var(--wl-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s ease;
}

.pw-toggle-btn:hover {
  color: var(--wl-ink-strong);
}

/* ── Related Company Section ── */
.user-company-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--slate-200, #e2e8f0);
}

.company-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--slate-700, #334155);
}

.comp-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--primary-700, #147d92);
  text-decoration: none;
  font-weight: 600;
}

.comp-link:hover {
  text-decoration: underline;
}

.company-info-card {
  background: var(--slate-50, #f8fafc);
  border: 1px solid var(--slate-200, #e2e8f0);
  border-radius: var(--radius-md, 8px);
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.company-info-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.company-icon-box {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #e0f2fe;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.company-meta-col {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.company-name-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--slate-900, #0f172a);
}

.badge-chip {
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-weight: 700;
  background: var(--slate-200, #e2e8f0);
  color: var(--slate-700, #334155);
}

.badge-chip--success {
  background: rgba(16, 185, 129, 0.15);
  color: var(--emerald-700, #047857);
}

.badge-chip--warning {
  background: rgba(245, 158, 11, 0.15);
  color: var(--amber-700, #b45309);
}

.company-grid-props {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--slate-200, #e2e8f0);
}

.prop-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.prop-label {
  font-size: 10px;
  color: var(--slate-500, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.prop-value {
  font-weight: 600;
  color: var(--slate-800, #1e293b);
  word-break: break-word;
}

.company-empty-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  background: #fffbeb;
  border: 1px solid #fef3c7;
  border-radius: 6px;
  color: #92400e;
}

.company-loading-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
}
</style>
