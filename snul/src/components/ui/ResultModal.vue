<script setup lang="ts">
import { modalService } from '../../di/container'

const close = () => modalService.close()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modalService.visible.value" class="modal-overlay" @click.self="close">
        <div class="modal" role="dialog" aria-modal="true">
          <div :class="['modal__icon', `modal__icon--${modalService.data.value?.type}`]">
            <span v-if="modalService.data.value?.type === 'success'">✓</span>
            <span v-else-if="modalService.data.value?.type === 'error'">×</span>
            <span v-else>!</span>
          </div>
          <p class="modal__msg">{{ modalService.data.value?.message }}</p>
          <button class="modal__close" @click="close">OK</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  display: grid;
  place-items: center;
  background: var(--bg-overlay);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 1rem;
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: var(--shadow-lg);
  position: relative;
}

.modal__icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm, 4px);
  display: grid;
  place-items: center;
  margin: 0 auto 1rem;
  font-size: 1.4rem;
  font-weight: 700;
  border: 1px solid var(--border);
  font-family: var(--font-body);
}

.modal__icon--success {
  background: var(--color-success-100);
  color: var(--fg-success);
}

.modal__icon--error {
  background: var(--color-danger-100);
  color: var(--fg-danger);
}

.modal__icon--info {
  background: var(--brand-soft);
  color: var(--brand);
}

.modal__msg {
  color: var(--fg-body);
  margin-bottom: 1.25rem;
  line-height: var(--leading-normal);
  font-family: var(--font-body);
}

.modal__close {
  background: var(--brand);
  color: var(--fg-on-brand);
  border: none;
  border-radius: var(--radius-sm, 4px);
  padding: 0.62rem 1.5rem;
  font-weight: var(--weight-medium);
  font-family: var(--font-body);
  cursor: pointer;
  box-shadow: var(--shadow-brand);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
