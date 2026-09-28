import { computed, ref } from 'vue'


class RequestTracker {
  private pending = ref(0)
  private watchdogs = new Map<number, ReturnType<typeof setTimeout>>()
  private nextId = 0

  private static readonly WATCHDOG_MS = 45_000

  readonly isLoading = computed(() => this.pending.value > 0)

  begin(): void {
    this.pending.value += 1
    const id = this.nextId++
    if (typeof setTimeout !== 'undefined') {
      const timer = setTimeout(() => {
        this.watchdogs.delete(id)
        if (this.pending.value > 0) {
          if (import.meta.env.DEV) {
            console.warn('[request-tracker] stale request force-settled after 45s — check Network tab for a hanging call')
          }
          this.pending.value = Math.max(0, this.pending.value - 1)
        }
      }, RequestTracker.WATCHDOG_MS)
      // Don't keep workers/tests alive just for the watchdog.
      const t = timer as unknown as { unref?: () => void }
      if (typeof t.unref === 'function') t.unref()
      this.watchdogs.set(id, timer)
    }
  }

  settle(): void {
    // Clear the oldest outstanding watchdog (FIFO approximates matching).
    const first = this.watchdogs.keys().next()
    if (!first.done) {
      clearTimeout(this.watchdogs.get(first.value))
      this.watchdogs.delete(first.value)
    }
    this.pending.value = Math.max(0, this.pending.value - 1)
  }
}

export const requestTracker = new RequestTracker()
