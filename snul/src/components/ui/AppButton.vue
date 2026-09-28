<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'gold'
    size?: 'sm' | 'md' | 'lg'
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    block?: boolean
  }>(),
  { variant: 'primary', size: 'md', loading: false, disabled: false, type: 'button', block: false },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : undefined"
    :class="['btn', `btn--${variant}`, `btn--${size}`, { 'btn--block': block, 'is-loading': loading }]"
  >
    <span v-if="loading" class="btn__spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-sm, 4px);
  border: 1px solid transparent;
  font-family: var(--font-body);
  font-size: var(--text-md);
  font-weight: var(--weight-medium);
  line-height: 1;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out);
  white-space: nowrap;
  box-shadow: var(--shadow-xs);
  user-select: none;
  text-decoration: none;
}
.btn:hover { text-decoration: none; }

.btn:active:not(:disabled) {
  transform: translateY(1px);
}

.btn--primary:focus-visible,
.btn--secondary:focus-visible,
.btn--outline:focus-visible,
.btn--ghost:focus-visible,
.btn--gold:focus-visible {
  outline: none;
  box-shadow: var(--ring-focus);
}

.btn--danger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px var(--color-danger-500);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}

.btn--block {
  width: 100%;
}

.btn--gold {
  background: var(--brand-soft);
  color: var(--brand);
  border-color: var(--brand-soft);
}
.btn--gold:hover:not(:disabled) {
  background: var(--color-brand-200);
  color: var(--brand-hover);
}

.btn--primary {
  background: var(--brand);
  color: var(--fg-on-brand);
  border-color: var(--brand);
  box-shadow: var(--shadow-brand);
}
.btn--primary:hover:not(:disabled) {
  background: var(--brand-hover);
  border-color: var(--brand-hover);
  color: var(--fg-on-brand);
}

.btn--secondary {
  background: var(--bg-surface);
  color: var(--fg-body);
  border-color: var(--border);
  box-shadow: var(--shadow-xs);
}

.btn--secondary:hover:not(:disabled) {
  background: var(--bg-subtle);
  color: var(--fg-heading);
}

.btn--outline {
  background: transparent;
  color: var(--fg-heading);
  border-color: var(--border);
}

.btn--outline:hover:not(:disabled) {
  background: var(--brand-soft);
  border-color: var(--brand);
  color: var(--brand);
}

.btn--ghost {
  background: transparent;
  color: var(--fg-muted);
  border-color: transparent;
  box-shadow: none;
}

.btn--ghost:hover:not(:disabled) {
  background: var(--bg-subtle);
  color: var(--fg-heading);
}

.btn--danger {
  background: var(--color-danger-500);
  color: #fff;
  border-color: var(--color-danger-500);
}

.btn--danger:hover:not(:disabled) {
  background: var(--color-danger-600);
  color: #fff;
  border-color: var(--color-danger-600);
}

.btn--sm {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  border-radius: var(--radius-sm);
}

.btn--md {
  padding: var(--space-3) var(--space-5);
  font-size: var(--text-md);
  border-radius: var(--radius-md);
}

.btn--lg {
  padding: var(--space-4) var(--space-7);
  font-size: var(--text-base);
  border-radius: var(--radius-md);
}

.btn__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
