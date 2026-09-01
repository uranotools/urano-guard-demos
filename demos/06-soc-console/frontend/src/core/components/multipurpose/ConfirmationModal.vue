<script setup lang="ts">
defineProps<{
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  danger?: boolean
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('cancel')">
    <div class="modal-card modal-card--sm" role="alertdialog">
      <h3>{{ title || 'Confirmar' }}</h3>
      <p>{{ message }}</p>
      <div class="mp-form__actions">
        <button type="button" class="btn btn--ghost" @click="emit('cancel')">Cancelar</button>
        <button
          type="button"
          class="btn"
          :class="danger ? 'btn--danger' : 'btn--primary'"
          @click="emit('confirm')"
        >
          {{ confirmLabel || 'Confirmar' }}
        </button>
      </div>
    </div>
  </div>
</template>
