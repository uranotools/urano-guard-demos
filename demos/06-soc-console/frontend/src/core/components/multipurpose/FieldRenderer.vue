<script setup lang="ts">
import type { Field } from '../../types/modules'
import CustomSelect from './CustomSelect.vue'

defineProps<{
  field: Field
  modelValue: unknown
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
}>()
</script>

<template>
  <label class="field" :class="field.gridClassName || 'w-full'">
    <span v-if="field.type !== 'hidden'" class="field__label">
      {{ field.title }}
      <em v-if="field.required">*</em>
    </span>

    <input
      v-if="field.type === 'text' || field.type === 'number' || field.type === 'date' || field.type === 'hidden'"
      class="field__input"
      :type="field.type === 'hidden' ? 'hidden' : field.type"
      :required="field.required"
      :value="modelValue as string | number | undefined"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />

    <textarea
      v-else-if="field.type === 'textarea'"
      class="field__input field__textarea"
      :required="field.required"
      :value="String(modelValue ?? '')"
      rows="4"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />

    <select
      v-else-if="field.type === 'select'"
      class="field__input"
      :required="field.required"
      :value="String(modelValue ?? '')"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled>Seleccione…</option>
      <option v-for="opt in field.options || []" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>

    <CustomSelect
      v-else-if="field.type === 'customselect' && field.select2"
      :config="field.select2"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </label>
</template>
