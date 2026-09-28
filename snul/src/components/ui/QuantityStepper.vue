<script setup lang="ts">
import { t } from '../../i18n'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    label?: string
  }>(),
  { min: 1, max: 99999, label: undefined },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function step(delta: number) {
  const next = props.modelValue + delta
  if (next < props.min || next > props.max) return
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="qty" :aria-label="label || t('common.quantity')">
    <button
      type="button"
      class="qty__btn qty__btn--minus"
      :disabled="modelValue <= min"
      :aria-label="label ? `${label} ${t('common.decreaseQuantity')}` : t('common.decreaseQuantity')"
      @click="step(-1)"
    >
      <span class="material-symbols-outlined text-[15px]">remove</span>
    </button>
    <span class="qty__val mono">{{ modelValue }}</span>
    <button
      type="button"
      class="qty__btn qty__btn--plus"
      :disabled="modelValue >= max"
      :aria-label="label ? `${label} ${t('common.increaseQuantity')}` : t('common.increaseQuantity')"
      @click="step(1)"
    >
      <span class="material-symbols-outlined text-[15px]">add</span>
    </button>
  </div>
</template>

<style scoped>
.qty {
  display: inline-flex;
  align-items: center;
  height: 38px;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 10, 25, 0.05);
  transition: border-color 0.18s var(--wl-ease-spring), box-shadow 0.18s var(--wl-ease-spring);
}

.qty:focus-within,
.qty:hover {
  border-color: var(--wl-primary);
}

.qty__btn {
  width: 36px;
  height: 100%;
  border: none;
  background: var(--wl-surface-soft);
  color: var(--wl-ink-strong);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.qty__btn:hover:not(:disabled) {
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
}

.qty__btn:active:not(:disabled) {
  transform: scale(0.92);
}

.qty__btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
  color: var(--wl-muted);
}

.qty__val {
  min-width: 44px;
  padding: 0 0.4rem;
  height: 100%;
  display: grid;
  place-items: center;
  text-align: center;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  background: var(--wl-surface);
  border-inline-start: 1px solid var(--wl-border);
  border-inline-end: 1px solid var(--wl-border);
  letter-spacing: -0.01em;
}
</style>
