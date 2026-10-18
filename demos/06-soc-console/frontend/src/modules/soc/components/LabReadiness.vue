<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiService } from '@core'
const diagnostic = ref<any>(null)
const busy = ref(false)
async function load() {
  busy.value = true
  try { diagnostic.value = await apiService.request({ url: '/api/diagnostics' }) }
  catch { diagnostic.value = { ready: false, state: 'hub_error', message: 'No se pudo consultar el diagnóstico del hub.' } }
  finally { busy.value = false }
}
onMounted(load)
</script>
<template>
  <section class="readiness" :class="{ 'readiness--warn': diagnostic && !diagnostic.ready }" aria-live="polite">
    <div><span class="eyebrow">PREVUELO / SIN INFERENCIA</span><strong>{{ !diagnostic ? 'Consultando el core…' : diagnostic.ready ? 'Webhook · protocolo v1 disponible' : 'Revisar conexión del agente' }}</strong>
      <p>{{ diagnostic?.message || 'Solo se consulta el descubrimiento; no envía tareas al agente.' }}</p>
      <div v-if="diagnostic?.transports?.length" class="pill-row"><span v-for="transport in diagnostic.transports" :key="transport" class="badge">{{ transport }}</span><small class="muted">{{ diagnostic.ms }} ms · {{ new Date(diagnostic.at).toLocaleTimeString() }}</small></div>
    </div>
    <button class="btn btn--ghost" :disabled="busy" @click="load">{{ busy ? 'Consultando…' : 'Comprobar' }}</button>
  </section>
</template>
