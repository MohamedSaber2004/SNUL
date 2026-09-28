<script setup lang="ts">
import DataState from './DataState.vue'

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    icon?: string
    actionText?: string
    fill?: boolean
    compact?: boolean
    code?: string
    status?: string
    variant?: 'default' | 'search' | 'catalog' | 'neutral'
  }>(),
  {
    icon: 'inventory_2',
    fill: false,
    compact: false,
    code: undefined,
    status: undefined,
    variant: 'default',
  },
)

defineEmits<{ action: [] }>()

const variantMap: Record<string, 'first-use' | 'no-results' | 'cleared'> = {
  default: 'first-use',
  search: 'no-results',
  catalog: 'first-use',
  neutral: 'cleared',
}
</script>

<template>
  <DataState
    state="empty"
    :emptyVariant="variantMap[variant]"
    :icon="icon"
    :title="title"
    :description="description"
    :actionText="actionText"
    :emptyCode="code"
    :emptyStatus="status"
    :fill="fill"
    :compact="compact"
    @action="$emit('action')"
  />
</template>
