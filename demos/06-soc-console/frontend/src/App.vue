<script setup lang="ts">
import { onMounted } from 'vue'
import { AppShell } from '@core'
import { registeredModules } from './modules'
import { useLiveStore } from './stores/live'

onMounted(() => useLiveStore().connect())
</script>

<template>
  <AppShell :modules="registeredModules" />
</template>
