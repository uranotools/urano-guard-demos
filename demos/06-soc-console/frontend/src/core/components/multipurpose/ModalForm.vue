<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { FieldConfig } from '../../types/modules'
import type { Field } from '../../types/modules'
import FieldRenderer from './FieldRenderer.vue'

const props = defineProps<{
  open: boolean
  title: string
  fields: Record<string, FieldConfig>
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [data: Record<string, unknown>]
}>()

const model = reactive<Record<string, unknown>>({})

const fieldList = () =>
  Object.entries(props.fields).map(
    ([name, cfg]): Field => ({
      name,
      title: cfg.label,
      type: cfg.type,
      required: cfg.required,
      options: cfg.options,
      select2: cfg.select2,
    }),
  )

watch(
  () => props.open,
  (v) => {
    if (v) {
      for (const key of Object.keys(props.fields)) {
        if (!(key in model)) model[key] = ''
      }
    }
  },
)

function setData(data: Record<string, unknown>) {
  for (const key of Object.keys(data)) model[key] = data[key]
}

defineExpose({ setData })
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-card" role="dialog">
      <header class="modal-card__head">
        <h3>{{ title }}</h3>
        <button type="button" class="btn btn--ghost" @click="emit('close')">✕</button>
      </header>
      <form
        class="mp-form"
        @submit.prevent="emit('submit', { ...model })"
      >
        <div class="mp-form__grid">
          <FieldRenderer
            v-for="field in fieldList()"
            :key="field.name"
            :field="field"
            :model-value="model[field.name]"
            @update:model-value="model[field.name] = $event"
          />
        </div>
        <div class="mp-form__actions">
          <button type="button" class="btn btn--ghost" @click="emit('close')">Cancelar</button>
          <button type="submit" class="btn btn--primary" :disabled="loading">
            {{ loading ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
