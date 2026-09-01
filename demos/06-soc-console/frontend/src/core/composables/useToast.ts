import { useToastStore } from '../stores/toast'

export function useToast() {
  const store = useToastStore()
  return {
    push: store.push,
    success: store.success,
    error: store.error,
  }
}
