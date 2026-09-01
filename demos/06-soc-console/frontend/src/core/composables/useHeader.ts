import { storeToRefs } from 'pinia'
import { useHeaderStore } from '../stores/header'

export function useHeader() {
  const store = useHeaderStore()
  const { title } = storeToRefs(store)
  return { title, apply: store.apply }
}
