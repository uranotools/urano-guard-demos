<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { PanelLeft, Moon, Sun } from 'lucide-vue-next'
import { useHeaderStore } from '../../stores/header'
import { useThemeStore } from '../../stores/theme'
import { useLayoutStore } from '../../stores/layout'

const header = useHeaderStore()
const theme = useThemeStore()
const layout = useLayoutStore()
const { title } = storeToRefs(header)
const { mode } = storeToRefs(theme)
</script>

<template>
  <header class="app-header">
    <div class="app-header__left">
      <button type="button" class="btn btn--icon" @click="layout.toggleSidebar()">
        <PanelLeft :size="18" />
      </button>
      <h1>{{ title }}</h1>
    </div>
    <div class="app-header__right">
      <span class="app-header__user">demo · sin login</span>
      <button type="button" class="btn btn--icon" @click="theme.toggle()">
        <Sun v-if="mode === 'dark'" :size="18" />
        <Moon v-else :size="18" />
      </button>
    </div>
  </header>
</template>
