<script setup lang="ts">
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t } from '../../i18n'

const toasts = toastService.toasts
</script>

<template>
  <div class="toast-stack" aria-live="polite" aria-atomic="true">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast--${toast.type}`]"
        role="status"
      >
        <span class="toast__msg">{{ toast.message }}</span>
        <button
          v-if="toast.action"
          class="toast__action"
          @click="toast.action.onClick"
        >
          {{ toast.action.label }}
        </button>
        <button class="toast__close" :aria-label="t('common.dismiss')" @click="toastService.dismiss(toast.id)">
          ×
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: var(--space-6);
  inset-inline-end: var(--space-6);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 420px;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 280px;
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-md);
  color: var(--fg-body);
  position: relative;
  overflow: hidden;
}

.toast--success {
  border-inline-start: 3px solid var(--fg-success);
}
.toast--error {
  border-inline-start: 3px solid var(--fg-danger);
}
.toast--warning {
  border-inline-start: 3px solid var(--fg-warning);
}
.toast--info {
  border-inline-start: 3px solid var(--fg-info);
}

.toast__msg {
  flex: 1;
}

.toast__action {
  font-weight: var(--weight-medium);
  color: var(--brand);
  background: none;
  border: none;
  cursor: pointer;
}

.toast__close {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  color: var(--fg-subtle);
  line-height: 1;
}
.toast__close:hover { color: var(--fg-heading); }

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
