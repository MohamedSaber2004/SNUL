<script setup lang="ts">
import DataState from './DataState.vue'

const props = withDefaults(
  defineProps<{
    title?: string
    message?: string
    retryText?: string
    code?: string
  }>(),
  {
    title: 'Something went wrong',
    message: 'Unable to load data. Please check your connection and try again.',
    retryText: 'Retry',
    code: undefined,
  },
)

defineEmits<{ retry: [] }>()
</script>

<template>
  <DataState
    state="error"
    :errorTitle="title"
    :errorMessage="message"
    :retryText="retryText"
    :errorCode="code"
    @retry="$emit('retry')"
  />
</template>
