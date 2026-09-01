<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useToastStore } from '../../stores/toast'

const { items } = storeToRefs(useToastStore())
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <div
      v-for="t in items"
      :key="t.id"
      class="toast"
      :class="`toast--${t.type}`"
    >
      {{ t.message }}
    </div>
  </div>
</template>
