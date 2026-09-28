import { computed, reactive } from 'vue'

export type ConfirmVariant = 'danger' | 'warning' | 'primary' | 'neutral'

export interface ConfirmOptions {
  title?: string
  message: string
  variant?: ConfirmVariant
  icon?: string
  confirmText?: string
  cancelText?: string
  requireType?: string 
}

interface ConfirmState {
  visible: boolean
  options: ConfirmOptions | null
  resolver: ((value: boolean) => void) | null
}

class ConfirmServiceImpl {
  private state = reactive<ConfirmState>({
    visible: false,
    options: null,
    resolver: null,
  })

  readonly visible = computed(() => this.state.visible)
  readonly options = computed(() => this.state.options)

  confirm(options: ConfirmOptions | string): Promise<boolean> {
    const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options
    if (this.state.visible && this.state.resolver) {
      this.state.resolver(false)
    }
    return new Promise<boolean>((resolve) => {
      this.state.options = {
        title: opts.title ?? 'Please confirm',
        message: opts.message,
        variant: opts.variant ?? 'danger',
        icon: opts.icon,
        confirmText: opts.confirmText ?? 'Delete',
        cancelText: opts.cancelText ?? 'Cancel',
        requireType: opts.requireType,
      }
      this.state.resolver = resolve
      this.state.visible = true
      document.body.style.overflow = 'hidden'
    })
  }

  confirmDelete(message: string, title?: string): Promise<boolean> {
    return this.confirm({
      title: title ?? 'Delete — Are you sure?',
      message,
      variant: 'danger',
      icon: 'delete',
      confirmText: 'Delete',
      cancelText: 'Cancel',
    })
  }

  confirmAction(message: string, opts: Partial<ConfirmOptions> = {}): Promise<boolean> {
    return this.confirm({ message, ...opts })
  }

  accept() {
    if (this.state.resolver) this.state.resolver(true)
    this.close()
  }

  cancel() {
    if (this.state.resolver) this.state.resolver(false)
    this.close()
  }

  private close() {
    this.state.visible = false
    this.state.options = null
    this.state.resolver = null
    document.body.style.overflow = ''
  }

  dismiss() {
    this.cancel()
  }
}

export const confirmService = new ConfirmServiceImpl()
export type ConfirmService = typeof confirmService
