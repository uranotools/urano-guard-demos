<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import type { ModuleConfig, MenuItem, MenuSection } from '../../types/modules'
import { useLayoutStore } from '../../stores/layout'

const props = defineProps<{ modules: ModuleConfig[] }>()
const route = useRoute()
const layout = useLayoutStore()
const { sidebarCollapsed } = storeToRefs(layout)

function isSection(item: MenuItem | MenuSection): item is MenuSection {
  return 'items' in item && Array.isArray((item as MenuSection).items)
}

const nav = computed(() => props.modules)
</script>

<template>
  <aside class="sidebar" :class="{ 'is-collapsed': sidebarCollapsed }">
    <div class="sidebar__brand">
      <span class="sidebar__mark">UG</span>
      <div v-if="!sidebarCollapsed">
        <strong>Urano Guard</strong>
        <small>SOC demo</small>
      </div>
    </div>

    <nav class="sidebar__nav">
      <div v-for="mod in nav" :key="mod.id" class="sidebar__module">
        <p v-if="!sidebarCollapsed && mod.category" class="sidebar__cat">{{ mod.category }}</p>
        <template v-for="(entry, idx) in mod.items" :key="idx">
          <template v-if="isSection(entry)">
            <p v-if="!sidebarCollapsed" class="sidebar__section">{{ entry.title }}</p>
            <RouterLink
              v-for="item in entry.items"
              :key="item.path"
              :to="item.path"
              class="sidebar__link"
              :class="{ 'is-active': route.path === item.path || route.path.startsWith(item.path + '/') }"
            >
              <component :is="item.icon" :size="18" />
              <span v-if="!sidebarCollapsed">{{ item.label }}</span>
            </RouterLink>
          </template>
          <RouterLink
            v-else
            :to="entry.path"
            class="sidebar__link"
            :class="{ 'is-active': route.path === entry.path }"
          >
            <component :is="entry.icon" :size="18" />
            <span v-if="!sidebarCollapsed">{{ entry.label }}</span>
          </RouterLink>
        </template>
      </div>
    </nav>
  </aside>
</template>
