<script setup lang="ts">
import { RouterView } from 'vue-router'
import type { ModuleConfig } from '../types/modules'
import MainLayout from './layout/MainLayout.vue'

defineProps<{ modules: ModuleConfig[] }>()
</script>

<template>
  <MainLayout :modules="modules">
    <RouterView />
  </MainLayout>
</template>
