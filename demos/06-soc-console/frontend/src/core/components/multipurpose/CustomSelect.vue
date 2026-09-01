<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { apiService } from '../../services/apiService'

const props = defineProps<{
  config: { route: string; endpoint?: string; labelField: string; valueField: string }
  modelValue: unknown
}>()

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const options = ref<Array<{ label: string; value: string | number }>>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const url = props.config.endpoint
      ? `${props.config.route}/${props.config.endpoint}`.replace(/\/+/g, '/').replace(':/', '://')
      : props.config.route
    const resp = await apiService.request({ url, method: 'GET' })
    const rows = (resp.data || resp.rows || []) as Record<string, unknown>[]
    options.value = rows.map((r) => ({
      label: String(r[props.config.labelField] ?? ''),
      value: r[props.config.valueField] as string | number,
    }))
  } catch {
    options.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.config.route, load)
</script>

<template>
  <select
    class="field__input"
    :disabled="loading"
    :value="modelValue == null ? '' : String(modelValue)"
    @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option value="">{{ loading ? 'Cargando…' : 'Seleccione…' }}</option>
    <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
  </select>
</template>
