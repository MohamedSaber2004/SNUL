import { reactive, readonly } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  duration?: number
  action?: ToastAction
}

export interface Toast {
  id: number
  type: ToastType
  message: string
  action?: ToastAction
}

const DEFAULT_DURATION = 3200

export class ToastService {
  private state = reactive<{ toasts: Toast[] }>({ toasts: [] })
  private nextId = 1
  private timers = new Map<number, ReturnType<typeof setTimeout>>()

  readonly toasts: readonly Toast[] = readonly(this.state.toasts)

  private push(type: ToastType, message: string, options: ToastOptions): void {
    const id = this.nextId++
    const duration = options.duration ?? DEFAULT_DURATION
    this.state.toasts.push({ id, type, message, action: options.action })
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), duration),
    )
  }

  success(message: string, options: ToastOptions = {}): void {
    this.push('success', message, options)
  }

  error(message: string, options: ToastOptions = {}): void {
    this.push('error', message, options)
  }

  info(message: string, options: ToastOptions = {}): void {
    this.push('info', message, options)
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(id)
    }
    const index = this.state.toasts.findIndex((toast) => toast.id === id)
    if (index !== -1) {
      this.state.toasts.splice(index, 1)
    }
  }
}

export const toastService = new ToastService()
