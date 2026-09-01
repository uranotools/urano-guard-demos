import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HeaderConfig } from '../types/modules'

export const useHeaderStore = defineStore('header', () => {
  const title = ref('Urano Guard — SOC')

  function apply(config?: HeaderConfig) {
    title.value = config?.title || 'Urano Guard — SOC'
  }

  return { title, apply }
})
