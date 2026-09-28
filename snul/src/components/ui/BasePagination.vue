<script setup lang="ts">
import AppPagination from './AppPagination.vue'

defineProps<{
  totalPages: number
  page?: number
  modelValue?: number
  totalItems?: number
  pageSize?: number
  siblingCount?: number
  showInfo?: boolean
  showPageNumbers?: boolean
  variant?: 'default' | 'table' | 'compact'
  disabled?: boolean
}>()

defineEmits<{
  (e: 'update:page', value: number): void
  (e: 'update:modelValue', value: number): void
  (e: 'change', value: number): void
}>()
</script>

<template>
  <AppPagination
    :total-pages="totalPages"
    :page="page"
    :model-value="modelValue"
    :total-items="totalItems"
    :page-size="pageSize"
    :sibling-count="siblingCount"
    :show-info="showInfo"
    :show-page-numbers="showPageNumbers"
    :variant="variant"
    :disabled="disabled"
    @update:page="$emit('update:page', $event)"
    @update:model-value="$emit('update:modelValue', $event)"
    @change="$emit('change', $event)"
  />
</template>
