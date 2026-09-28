<script setup lang="ts">
import { computed } from 'vue'
import DataState from './DataState.vue'
import { defaultSkeletonCount, type SkeletonType } from './skeleton'

const props = withDefaults(
  defineProps<{
    type?: SkeletonType
    lines?: number
    count?: number
    width?: string
    height?: string
    gap?: string
  }>(),
  {
    type: 'text',
    lines: 1,
  },
)

const gridCount = computed(() => props.count ?? defaultSkeletonCount(props.type))
</script>

<template>
  <DataState
    state="loading"
    :skeletonType="type"
    :skeletonLines="lines"
    :skeletonCount="gridCount"
    :skeletonWidth="width"
    :skeletonHeight="height"
    :skeletonGap="gap"
  />
</template>
