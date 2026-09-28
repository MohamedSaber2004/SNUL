import { watch } from 'vue'
import { authService } from '../di/container'

export const applyRoleTheme = () => {
  const update = () => {
    const role = authService.isAdmin.value ? 'admin' : authService.isProvider.value ? 'provider' : authService.isSales.value ? 'sales' : authService.isClient.value ? 'client' : 'guest'
    document.documentElement.dataset.role = role
  }
  update()
  watch(() => authService.user.value, update)
}
