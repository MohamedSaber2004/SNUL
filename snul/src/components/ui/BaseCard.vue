<script setup lang="ts">
withDefaults(
  defineProps<{
    hoverable?: boolean
    padding?: 'none' | 'sm' | 'md' | 'lg'
  }>(),
  {
    hoverable: false,
    padding: 'md',
  },
)
</script>

<template>
  <div :class="['card', `card--pad-${padding}`, { 'card--hover': hoverable }]">
    <div v-if="$slots.header" class="card__header">
      <slot name="header" />
    </div>
    <div class="card__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="card__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out);
  overflow: hidden;
  position: relative;
}
.card--hover:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--border-strong);
}
.card--pad-none .card__body { padding: 0; }
.card--pad-sm .card__body { padding: var(--space-4); }
.card--pad-md .card__body { padding: var(--space-6); }
.card--pad-lg .card__body { padding: var(--space-8); }
.card__header {
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}
.card__footer {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}
</style>
