<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { Field } from '../../types/modules'
import FieldRenderer from './FieldRenderer.vue'

const props = defineProps<{
  fields: Field[]
  loading?: boolean
  submitLabel?: string
}>()

const emit = defineEmits<{ submit: [data: Record<string, unknown>] }>()

const model = reactive<Record<string, unknown>>({})

function resetFromFields() {
  for (const f of props.fields) {
    if (!(f.name in model)) model[f.name] = ''
  }
}

watch(() => props.fields, resetFromFields, { immediate: true, deep: true })

function setData(data: Record<string, unknown>) {
  for (const key of Object.keys(data)) {
    model[key] = data[key]
  }
}

function onSubmit(e: Event) {
  e.preventDefault()
  emit('submit', { ...model })
}

defineExpose({ setData, model })
</script>

<template>
  <form class="mp-form" @submit="onSubmit">
    <div class="mp-form__grid">
      <FieldRenderer
        v-for="field in fields"
        :key="field.name"
        :field="field"
        :model-value="model[field.name]"
        @update:model-value="model[field.name] = $event"
      />
    </div>
    <div class="mp-form__actions">
      <button class="btn btn--primary" type="submit" :disabled="loading">
        {{ loading ? 'Guardando…' : submitLabel || 'Guardar' }}
      </button>
      <slot name="actions" />
    </div>
  </form>
</template>
