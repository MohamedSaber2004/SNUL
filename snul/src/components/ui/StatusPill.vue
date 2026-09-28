<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: string
  label?: string
}>()

const TONE: Record<string, string> = {
  Success: 'emerald',
  Failed: 'rose',
  Partial: 'amber',
  Pending: 'amber',
  Draft: 'slate',
  Sent: 'indigo',
  Quoted: 'indigo',
  Ordered: 'slate',
  Approved: 'emerald',
  Declined: 'rose',
  Expired: 'slate',
  Cancelled: 'rose',
  Confirmed: 'indigo',
  Shipped: 'slate',
  Delivered: 'emerald',
  Paid: 'emerald',
  Active: 'emerald',
  Inactive: 'slate',
}

const tone = computed(() => TONE[props.status] ?? 'slate')
</script>

<template>
  <span class="status-pill" :class="`status-pill--${tone}`">
    <span class="status-pill__dot" aria-hidden="true"></span>
    <span class="status-pill__text">{{ label ?? status }}</span>
  </span>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  line-height: 1.4;
  padding: 2px 8px;
  border-radius: var(--radius-xs, 3px);
  border: 1px solid transparent;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.status-pill__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.status-pill--emerald {
  color: var(--color-success-600);
  background: var(--color-success-100);
  border-color: var(--color-success-600);
}


.status-pill--indigo {
  color: var(--chart-1);
  background: var(--color-info-100);
  border-color: var(--chart-1);
}


.status-pill--amber {
  color: var(--color-warning-600);
  background: var(--color-warning-100);
  border-color: var(--color-warning-600);
}


.status-pill--rose {
  color: var(--color-danger-600);
  background: var(--color-danger-100);
  border-color: var(--color-danger-600);
}


.status-pill--slate {
  color: var(--fg-muted);
  background: var(--bg-subtle);
  border-color: var(--fg-muted);
}

</style>
