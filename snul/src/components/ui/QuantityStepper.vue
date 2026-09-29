<script setup lang="ts">
import { t } from '../../i18n'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    label?: string
    /** Control height. `sm` fits dense rows, `lg` is the roomy product-page size. */
    size?: 'sm' | 'md' | 'lg'
    /** Replace the read-only value with a number input so the quantity can be
     *  typed as well as stepped. */
    editable?: boolean
    disabled?: boolean
  }>(),
  { min: 1, max: 99999, label: undefined, size: 'md', editable: false, disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function clamp(value: number): number {
  return Math.min(props.max, Math.max(props.min, value))
}

function step(delta: number) {
  const next = props.modelValue + delta
  if (next < props.min || next > props.max) return
  emit('update:modelValue', next)
}

function onInput(e: Event) {
  const raw = Number((e.target as HTMLInputElement).value)
  if (!Number.isFinite(raw)) return
  emit('update:modelValue', clamp(raw))
}
</script>

<template>
  <div class="qty" :class="`qty--${size}`" :aria-label="label || t('common.quantity')">
    <button
      type="button"
      class="qty__btn qty__btn--minus"
      :disabled="disabled || modelValue <= min"
      :aria-label="label ? `${label} ${t('common.decreaseQuantity')}` : t('common.decreaseQuantity')"
      @click="step(-1)"
    >
      <span class="material-symbols-outlined text-[15px]">remove</span>
    </button>
    <input
      v-if="editable"
      class="qty__val qty__val--input mono"
      type="number"
      inputmode="numeric"
      :value="modelValue"
      :min="min"
      :max="max"
      :disabled="disabled"
      :aria-label="label || t('common.quantity')"
      @change="onInput"
    />
    <span v-else class="qty__val mono">{{ modelValue }}</span>
    <button
      type="button"
      class="qty__btn qty__btn--plus"
      :disabled="disabled || modelValue >= max"
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
  background: var(--bg-surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: border-color 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out);
}

.qty--sm { height: 32px; }
.qty--md { height: 38px; }
.qty--lg { height: 48px; }

.qty:focus-within,
.qty:hover {
  border-color: var(--brand);
}

.qty__btn {
  width: 36px;
  height: 100%;
  min-width: var(--wl-touch-min);
  border: none;
  background: var(--bg-subtle);
  color: var(--fg-heading);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
  user-select: none;
}

.qty--sm .qty__btn { min-width: 32px; }
.qty--lg .qty__btn { min-width: 48px; }

.qty__btn:hover:not(:disabled) {
  background: var(--brand-soft);
  color: var(--brand);
}

.qty__btn:active:not(:disabled) {
  transform: scale(0.92);
}

.qty__btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
  color: var(--fg-subtle);
}

.qty__btn:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: -2px;
}

.qty__val {
  min-width: 44px;
  padding: 0 0.4rem;
  height: 100%;
  display: grid;
  place-items: center;
  text-align: center;
  font-size: var(--text-base);
  font-weight: var(--weight-extrabold);
  color: var(--fg-heading);
  background: var(--bg-surface);
  border-inline-start: 1px solid var(--border);
  border-inline-end: 1px solid var(--border);
  letter-spacing: -0.01em;
}

/* The editable variant is a real form control: strip the number spinners so it
   matches the read-only pill, and keep the focus ring on the input itself. */
.qty__val--input {
  -moz-appearance: textfield;
  appearance: textfield;
  outline: none;
}

.qty__val--input::-webkit-outer-spin-button,
.qty__val--input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.qty__val--input:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: -2px;
}

@media (pointer: coarse) {
  .qty__btn { min-width: var(--wl-touch-min); }
  .qty--sm .qty__btn { min-width: 38px; }
}
</style>
