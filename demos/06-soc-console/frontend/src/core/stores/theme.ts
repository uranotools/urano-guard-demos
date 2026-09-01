import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<'light' | 'dark'>((localStorage.getItem('ug_soc_theme') as 'light' | 'dark') || 'dark')

  watch(
    mode,
    (v) => {
      localStorage.setItem('ug_soc_theme', v)
      document.documentElement.dataset.theme = v
    },
    { immediate: true },
  )

  function toggle() {
    mode.value = mode.value === 'light' ? 'dark' : 'light'
  }

  return { mode, toggle }
})
