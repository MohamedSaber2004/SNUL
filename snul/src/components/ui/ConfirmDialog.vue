<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { t } from '../../i18n'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import BaseButton from './BaseButton.vue'

const visible = confirmService.visible
const opts = confirmService.options

const typeInput = ref('')
const canConfirm = computed(() => {
  const req = opts.value?.requireType
  if (!req) return true
  return typeInput.value.trim() === req
})

watch(visible, (v) => {
  if (v) typeInput.value = ''
})

const onKeyDown = (e: KeyboardEvent) => {
  if (!visible.value) return
  if (e.key === 'Escape') confirmService.dismiss()
  if (e.key === 'Enter' && canConfirm.value && e.metaKey) confirmService.accept()
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

const variantIcon = computed(() => {
  const v = opts.value?.variant ?? 'danger'
  const i = opts.value?.icon
  if (i) return i
  if (v === 'danger') return 'warning'
  if (v === 'warning') return 'warning'
  if (v === 'primary') return 'help'
  return 'info'
})

const variantClass = computed(() => `confirm__icon--${opts.value?.variant ?? 'danger'}`)
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div
        v-if="visible && opts"
        class="confirm-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'confirm-title'"
        @click.self="confirmService.dismiss()"
      >
        <div class="confirm-card" :class="`confirm-card--${opts.variant ?? 'danger'}`">
          <!-- header accent -->
          <div class="confirm-accent" aria-hidden="true"></div>

          <button class="confirm-close" :aria-label="t('common.close')" @click="confirmService.dismiss()">✕</button>

          <div class="confirm-body">
            <div class="confirm-icon-wrap" :class="variantClass" aria-hidden="true">
              <span class="material-symbols-outlined">{{ variantIcon }}</span>
            </div>

            <div class="confirm-copy">
              <h3 id="confirm-title" class="confirm-title">{{ opts.title }}</h3>
              <p class="confirm-message">{{ opts.message }}</p>

              <div v-if="opts.requireType" class="confirm-verify">
                <p class="mono confirm-verify-hint">{{ t('common.typeToConfirm', { word: opts.requireType }) }}</p>
                <input
                  v-model="typeInput"
                  class="field__input confirm-verify-input"
                  :placeholder="opts.requireType"
                  autocomplete="off"
                  @keydown.enter.prevent="canConfirm && confirmService.accept()"
                />
              </div>
            </div>
          </div>

          <div class="confirm-actions">
            <BaseButton variant="ghost" @click="confirmService.dismiss()">
              {{ opts.cancelText }}
            </BaseButton>
            <BaseButton
              :variant="opts.variant === 'danger' ? 'danger' : 'primary'"
              :disabled="!canConfirm"
              @click="confirmService.accept()"
            >
              {{ opts.confirmText }}
            </BaseButton>
          </div>

          <!-- subtle caliper ticks footer -->
          <div class="confirm-ticks" aria-hidden="true">
            <span v-for="i in 14" :key="i" class="confirm-tick" :class="{ 'confirm-tick--major': i % 5 === 0 }"></span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: var(--space-4);
  z-index: var(--z-overlay);
  }

  .confirm-card {
  width: min(520px, 100%);
  max-width: 460px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--shadow-lg);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: var(--z-modal);
}
.confirm-accent {
  height: 2px;
  background: var(--border);
  opacity: 1;
}
.confirm-card--danger .confirm-accent { background: var(--fg-danger); }
.confirm-card--warning .confirm-accent { background: var(--fg-warning); }
.confirm-card--primary .confirm-accent { background: var(--brand); }

.confirm-close {
  position: absolute;
  top: 1rem;
  inset-inline-end: 1rem;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-pill);
  background: transparent;
  border: 1px solid transparent;
  color: var(--fg-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 13px;
  transition: all var(--duration-fast) ease;
}
.confirm-close:hover {
  background: var(--bg-subtle);
  color: var(--fg-heading);
}

.confirm-body {
  display: flex;
  gap: 1rem;
  padding: 1.5rem 1.5rem 1.1rem;
  align-items: flex-start;
}
.confirm-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm, 4px);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 1px solid transparent;
}
.confirm-icon-wrap .material-symbols-outlined { font-size: 22px; }
.confirm__icon--danger { background: var(--color-danger-100); color: var(--fg-danger); border-color: var(--color-danger-100); }
.confirm__icon--warning { background: var(--color-warning-100); color: var(--fg-warning); border-color: var(--color-warning-100); }
.confirm__icon--primary { background: var(--brand-soft); color: var(--brand); border-color: var(--brand-soft); }
.confirm__icon--neutral { background: var(--bg-subtle); color: var(--fg-muted); border-color: var(--border); }

.confirm-copy { flex: 1; min-width: 0; }
.confirm-title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-tight);
  color: var(--fg-heading);
  line-height: var(--leading-tight);
  margin: 0 0 0.45rem;
}
.confirm-message {
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--fg-muted);
  margin: 0;
  word-break: break-word;
}

.confirm-verify { margin-top: 1rem; }
.confirm-verify-hint { font-size: var(--text-xs); color: var(--fg-subtle); margin-bottom: 0.45rem; }
.confirm-verify-hint strong { color: var(--fg-heading); }
.confirm-verify-input { width: 100%; }

.confirm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  padding: 0 1.5rem 1.2rem;
}
.confirm-ticks {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  justify-content: center;
  padding: 0.7rem 1rem 0.9rem;
  border-top: 1px solid var(--border);
  background: var(--bg-subtle);
}
.confirm-tick { width: 1px; height: 6px; background: var(--border-strong); opacity: 0.45; }
.confirm-tick--major { height: 10px; background: var(--fg-heading); opacity: 0.18; }

/* transition */
.confirm-fade-enter-active, .confirm-fade-leave-active { transition: opacity var(--duration-base) var(--ease-out), transform var(--duration-base) var(--ease-out); }
.confirm-fade-enter-from, .confirm-fade-leave-to { opacity: 0; }
.confirm-fade-enter-from .confirm-card, .confirm-fade-leave-to .confirm-card { transform: scale(0.96) translateY(8px); }

@media (max-width: 480px) {
  .confirm-body { flex-direction: column; align-items: center; text-align: center; }
  .confirm-actions { grid-template-columns: 1fr; }
}
</style>
