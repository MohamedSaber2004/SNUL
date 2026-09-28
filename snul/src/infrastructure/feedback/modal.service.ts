import { computed, reactive } from 'vue'

export type FeedbackType = 'success' | 'error' | 'info'

export interface FeedbackData {
  type: FeedbackType
  message: string
}

export class ModalService {
  private state = reactive<{ visible: boolean; data: FeedbackData | null }>({
    visible: false,
    data: null,
  })

  readonly visible = computed(() => this.state.visible)
  readonly data = computed(() => this.state.data)

  show(data: FeedbackData): void {
    this.state.data = data
    this.state.visible = true
  }

  showSuccess(message: string): void {
    this.show({ type: 'success', message })
  }

  showError(message: string): void {
    this.show({ type: 'error', message })
  }

  showInfo(message: string): void {
    this.show({ type: 'info', message })
  }

  close(): void {
    this.state.visible = false
    this.state.data = null
  }
}
