<script setup lang="ts">
import type { ModuleConfig } from '../../types/modules'
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'
import ToastHost from './ToastHost.vue'

defineProps<{ modules: ModuleConfig[] }>()
</script>

<template>
  <div class="shell">
    <Sidebar :modules="modules" />
    <div class="shell__main">
      <Header />
      <main class="shell__content">
        <slot />
      </main>
    </div>
    <ToastHost />
  </div>
</template>
