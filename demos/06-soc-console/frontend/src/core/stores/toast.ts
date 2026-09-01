import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ToastItem {
  id: number
  message: string
  type: 'info' | 'success' | 'error'
}

let seq = 0

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([])

  function push(message: string, type: ToastItem['type'] = 'info') {
    const id = ++seq
    items.value.push({ id, message, type })
    setTimeout(() => {
      items.value = items.value.filter((t) => t.id !== id)
    }, 3500)
  }

  return { items, push, success: (m: string) => push(m, 'success'), error: (m: string) => push(m, 'error') }
})
