import { ref, computed, onMounted, watch } from 'vue'
import { userRepository } from '../di/container'
import { toastService } from '../infrastructure/feedback/toast.service'
import { confirmService } from '../infrastructure/feedback/confirm.service'
import { t } from '../i18n'
import { UserType, USER_TYPE_ROLE_KEY } from '../domain/models/user'
import type { UserDto } from '../domain/models/user'

export function useUsers() {
  const rawUsers = ref<UserDto[]>([])
  const loading = ref(true)
  const search = ref('')
  const page = ref(1)
  const pageSize = 10
  const error = ref('')

  const showForm = ref(false)
  const editing = ref<UserDto | null>(null)
  const form = ref({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    userType: UserType.OrganizationUser,
    isActive: true,
    profilePictureName: null as string | null,
  })
  const formLoading = ref(false)
  const formError = ref('')

  const filteredUsers = computed(() => {
    const list = Array.isArray(rawUsers.value)
      ? rawUsers.value.filter((u) => u.userType !== UserType.SnulStaff)
      : []
    if (!search.value.trim()) return list
    const q = search.value.trim().toLowerCase()
    return list.filter((u) => {
      if (!u) return false
      const name = u.fullName ? String(u.fullName).toLowerCase().includes(q) : false
      const email = u.email ? String(u.email).toLowerCase().includes(q) : false
      const phone = u.phoneNumber ? String(u.phoneNumber).toLowerCase().includes(q) : false
      let role = ''
      try {
        role = u.userType !== undefined ? USER_TYPE_ROLE_KEY(u.userType).toLowerCase() : ''
        // 3-role model: an OrganizationUser is a Provider/Distributor — match those labels too.
        if (u.userType === UserType.OrganizationUser) role += ' provider distributor'
      } catch {
        role = ''
      }
      const matchId = u.id ? String(u.id).toLowerCase().includes(q) : false
      return name || email || phone || (role ? role.includes(q) : false) || matchId
    })
  })

  const totalCount = computed(() => filteredUsers.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / pageSize)))
  const paginatedUsers = computed(() => {
    const start = (page.value - 1) * pageSize
    return filteredUsers.value.slice(start, start + pageSize)
  })

  const load = async () => {
    loading.value = true
    error.value = ''
    try {
      const res = await userRepository.getUsers({
        pageNumber: 1,
        pageSize: 50,
      })

      const data = res as unknown as Record<string, unknown> | null | undefined
      if (Array.isArray((res as unknown as { data?: unknown } | null | undefined)?.data)) {
        rawUsers.value = (res as unknown as { data: UserDto[] }).data
      } else if (Array.isArray(res as unknown as UserDto[])) {
        rawUsers.value = res as unknown as UserDto[]
} else if (data && Array.isArray(data.data)) {
      // Filter out sales/staff users (UserType.SnulStaff) from the raw data
      rawUsers.value = (data.data as UserDto[]).filter(u => u.userType !== UserType.SnulStaff)
    } else {
      rawUsers.value = []
    }
    } catch (e) {
      const message = e instanceof Error && e.message ? e.message : t('common.loadFailed')
      error.value = message
      // Surface the backend message (e.g. 500 detail) instead of a generic
      // "Error" so the admin can report the real cause. The error state +
      // toast already surface this in the UI — keep console output dev-only
      // so a down service doesn't spam production consoles.
      if (import.meta.env.DEV) console.warn('[useUsers] getUsers failed:', e)
      toastService.error(message)
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  watch(search, () => {
    page.value = 1
  })

  const onSearch = () => {
    page.value = 1
  }

  const openCreate = () => {
    editing.value = null
    form.value = {
      fullName: '',
      email: '',
      phoneNumber: '',
      password: '',
      userType: UserType.OrganizationUser,
      isActive: true,
      profilePictureName: null,
    }
    formError.value = ''
    showForm.value = true
  }

  const openEdit = (u: UserDto) => {
    editing.value = u
    form.value = {
      fullName: u.fullName,
      email: u.email,
      phoneNumber: u.phoneNumber ?? '',
      password: '',
      userType: u.userType,
      isActive: u.isActive,
      profilePictureName: u.profilePictureName ?? null,
    }
    formError.value = ''
    showForm.value = true
  }

  const closeForm = () => {
    showForm.value = false
    editing.value = null
  }

  const handleSubmit = async () => {
    formError.value = ''
    if (!form.value.fullName.trim() || !form.value.email.trim()) {
      formError.value = t('auth.errGeneric')
      return
    }
    if (!editing.value && !form.value.password) {
      formError.value = t('auth.errPasswordRequired')
      return
    }

    formLoading.value = true
    try {
      if (editing.value) {
        // FIX: FileUpload emits null on remove. Backend's `if (ProfilePictureName != null)` only
        // enters when value != null, so we send "" (empty) to clear — handler converts "" → null.
        // Sending null would be ignored (keeps old image), sending "" clears correctly.
        const pic = form.value.profilePictureName
        const profilePictureName = !pic || !String(pic).trim() ? "" : String(pic).trim()
        const updated = await userRepository.updateUser(editing.value.id, {
          fullName: form.value.fullName.trim(),
          phoneNumber: form.value.phoneNumber.trim() || undefined,
          userType: form.value.userType,
          isActive: form.value.isActive,
          profilePictureName,
        })
        rawUsers.value = rawUsers.value.map((x) => (x.id === updated.id ? updated : x))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('snul:users-changed'))
          window.dispatchEvent(new CustomEvent('welco:users-changed'))
        }
        toastService.success(t('admin.updateSuccess'))
      } else {
        const pic = form.value.profilePictureName
        const profilePictureName = pic === '' ? null : pic
        const created = await userRepository.createUser({
          fullName: form.value.fullName.trim(),
          email: form.value.email.trim(),
          password: form.value.password,
          phoneNumber: form.value.phoneNumber.trim() || undefined,
          userType: form.value.userType,
          profilePictureName: profilePictureName ?? undefined,
        })
        rawUsers.value = [created, ...rawUsers.value]
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('snul:users-changed'))
          window.dispatchEvent(new CustomEvent('welco:users-changed'))
        }
        toastService.success(t('admin.createSuccess'))
      }
      closeForm()
    } catch (e: unknown) {
      formError.value = e instanceof Error ? e.message : t('common.error')
    } finally {
      formLoading.value = false
    }
  }

  const handleDelete = async (u: UserDto) => {
    const ok = await confirmService.confirm({
      title: t('common.delete'),
      message: `${t('admin.confirmDelete')} "${u.fullName}"? This action cannot be undone.`,
      variant: 'danger',
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
    })
    if (!ok) return
    try {
      await userRepository.deleteUser(u.id)
      rawUsers.value = rawUsers.value.filter((x) => x.id !== u.id)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('snul:users-changed'))
        window.dispatchEvent(new CustomEvent('welco:users-changed'))
      }
      toastService.success(t('admin.deleteSuccess'))
    } catch (e: unknown) {
      toastService.error(e instanceof Error ? e.message : t('common.error'))
    }
  }

  return {
    users: paginatedUsers,
    rawUsers,
    loading,
    search,
    page,
    totalPages,
    totalCount,
    error,
    showForm,
    editing,
    form,
    formLoading,
    formError,
    load,
    onSearch,
    openCreate,
    openEdit,
    closeForm,
    handleSubmit,
    handleDelete,
  }
}
