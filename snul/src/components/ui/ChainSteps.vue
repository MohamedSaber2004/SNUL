<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    steps: string[]
    current: number
    compact?: boolean
  }>(),
  { compact: false },
)

const activeIndex = computed(() => Math.min(props.current, props.steps.length - 1))
</script>

<template>
  <div class="chain-steps" :class="{ 'chain-steps--compact': compact }" role="list" :aria-label="steps.join(' → ')">
    <template v-for="(step, i) in steps" :key="step">
      <div
        class="chain-steps__node"
        :class="{
          'is-active': i === activeIndex,
          'is-done': i < activeIndex,
          'is-pending': i > activeIndex,
        }"
        role="listitem"
      >
        <span class="chain-steps__ring" aria-hidden="true"></span>
        <span class="chain-steps__label">{{ step }}</span>
      </div>
      <span v-if="i < steps.length - 1" class="chain-steps__link" aria-hidden="true"></span>
    </template>
  </div>
</template>

<style scoped>
.chain-steps {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0.6rem 0;
}
.chain-steps__node {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--wl-muted);
  white-space: nowrap;
}
.chain-steps__ring {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid var(--wl-line-strong);
  background: var(--wl-surface);
  position: relative;
  flex-shrink: 0;
}
.chain-steps__node.is-active .chain-steps__ring {
  border-color: var(--wl-primary);
  box-shadow: 0 0 0 4px rgba(var(--wl-primary-rgb), 0.14);
}
.chain-steps__node.is-active .chain-steps__ring::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: var(--wl-primary);
}
.chain-steps__node.is-done .chain-steps__ring {
  border-color: var(--wl-primary);
  background: var(--wl-primary);
}
.chain-steps__node.is-done .chain-steps__ring::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: var(--wl-surface);
}
.chain-steps__node.is-done { color: var(--wl-primary); }
.chain-steps__node.is-active { color: var(--wl-ink-strong); }
.chain-steps__link {
  flex: 1;
  height: 1px;
  background: repeating-linear-gradient(90deg, var(--wl-line-strong) 0 4px, transparent 4px 8px);
  margin: 0 0.65rem;
  min-width: 14px;
}
.chain-steps--compact .chain-steps__label { font-size: 0.66rem; }
.chain-steps--compact .chain-steps__node { gap: 0.4rem; }
</style>
