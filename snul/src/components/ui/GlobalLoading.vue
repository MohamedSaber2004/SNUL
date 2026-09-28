<script setup lang="ts">
import { computed } from 'vue'
import GlobalLoader from './GlobalLoader.vue'

const props = withDefaults(
  defineProps<{
    show?: boolean
    message?: string
    size?: 'sm' | 'md' | 'lg'
    variant?: 'fullscreen' | 'inline' | 'overlay'
    logoOnly?: boolean
  }>(),
  {
    show: false,
    message: '',
    size: 'md',
    variant: 'fullscreen',
    logoOnly: false,
  },
)

const emit = defineEmits<{ complete: [] }>()

const displayMessage = computed(() => {
  return props.message || 'Loading...'
})
</script>

<template>
  <GlobalLoader
    :show="show"
    :message="displayMessage"
    :size="size"
    :variant="variant"
    :logoOnly="logoOnly"
    @complete="emit('complete')"
  />
</template>
