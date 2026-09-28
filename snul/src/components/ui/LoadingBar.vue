<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { routeLoading } from '../../application/route-loading'

// Ensure the spinner stays visible for at least one animation frame
// so it actually renders before it can be hidden. Without this,
// beforeEach → afterEach can resolve in the same microtask tick and
// Vue's reactivity batching collapses the true→false into a no-op.
const visible = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

watch(routeLoading, async (loading) => {
  if (loading) {
    if (hideTimer !== null) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
    await nextTick()
    visible.value = true
  } else {
    // Keep visible for at least 280ms so the animation is perceivable
    hideTimer = setTimeout(() => {
      visible.value = false
      hideTimer = null
    }, 280)
  }
}, { immediate: true })
</script>

<template>
  <Transition name="loading-spinner">
    <div v-if="visible" class="loading-spinner" role="status" aria-live="polite" aria-label="Loading">
      <span class="loading-spinner__ring" aria-hidden="true" />
      <span class="loading-spinner__label">Loading…</span>
    </div>
  </Transition>
</template>

<!-- Global block: @keyframes must NOT be scoped — Vue adds a hash suffix
     to scoped keyframe names but not to the animation: property references,
     causing the animation to silently fail. -->
<style>
@keyframes spinner-rotate { to { transform: rotate(360deg); } }
@keyframes spinner-pulse {
  0%, 100% { transform: scale(.86); opacity: .55; }
  50%       { transform: scale(1.08); opacity: 1; }
}
</style>

<style scoped>
.loading-spinner {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: rgba(4, 25, 38, .24);
  backdrop-filter: blur(3px);
  pointer-events: none;
}
.loading-spinner::before {
  content: '';
  position: absolute;
  width: min(16rem, 58vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(214,243,106,.16), transparent 68%);
  animation: spinner-pulse 1.8s ease-in-out infinite;
}
.loading-spinner__ring {
  position: relative;
  width: 58px;
  height: 58px;
  border: 5px solid rgba(255,255,255,.28);
  border-top-color: #d6f36a;
  border-right-color: #2dd4bf;
  border-bottom-color: rgba(45,212,191,.4);
  border-radius: 50%;
  box-shadow: 0 0 0 8px rgba(214,243,106,.1), 0 10px 28px rgba(2,25,39,.25);
  animation: spinner-rotate .78s linear infinite;
}
.loading-spinner__label {
  position: absolute;
  margin-top: 6.2rem;
  color: #f7fffe;
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  text-shadow: 0 1px 10px rgba(2,25,39,.55);
}
.loading-spinner-enter-active,
.loading-spinner-leave-active { transition: opacity .18s ease; }
.loading-spinner-enter-from,
.loading-spinner-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .loading-spinner__ring,
  .loading-spinner::before { animation: none; }
}
@media (max-width: 520px) {
  .loading-spinner { padding: 1rem; }
  .loading-spinner__ring { width: 50px; height: 50px; }
}
</style>
