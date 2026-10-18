<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { apiService, useToast } from '@core'
import { useLiveStore } from '@/stores/live'

const live = useLiveStore()
const { snapshot } = storeToRefs(live)
const toast = useToast()
const catalog = ref<Record<string, { label: string; description: string; body: any }>>({})
const payloadId = ref('benign')
const customJson = ref('')
const busy = ref(false)
const last = ref<any>(null)
const labs = ref<any[]>([])
const targetLabId = ref('hub')
const history = ref<Array<{at:string;labId:string;payloadId:string;status:number;ms:number}>>([])

onMounted(async () => {
  live.connect()
  targetLabId.value = snapshot.value.targetLabId || 'hub'
  catalog.value = await apiService.request({ url: '/api/payloads' })
  const first = catalog.value.benign
  customJson.value = JSON.stringify(first?.body ?? {}, null, 2)
  const status = await apiService.request({ url: '/api/labs/status' })
  labs.value = status.labs || []
})

function pick(id: string) {
  payloadId.value = id
  const item = catalog.value[id]
  if (item) customJson.value = JSON.stringify(item.body, null, 2)
}

async function fire() {
  busy.value = true
  last.value = null
  try {
    let body: any
    try {
      body = JSON.parse(customJson.value)
    } catch {
      toast.error('JSON inválido')
      return
    }
    last.value = await apiService.request({
      url: '/api/attacks/fire',
      method: 'POST',
      data: { payloadId: payloadId.value, labId: targetLabId.value, body },
    })
    toast.success(`HTTP ${last.value.result?.status} en ${last.value.result?.ms}ms`)
    history.value.unshift({ at:new Date().toISOString(),labId:targetLabId.value,payloadId:payloadId.value,status:last.value.result.status,ms:last.value.result.ms }); history.value = history.value.slice(0,20)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <header class="lab-hero"><div><span class="eyebrow">ENTRADAS SINTÉTICAS / PRUEBA MANUAL</span><h2>Una petición. Una observación.</h2><p>Ajusta el fixture, selecciona la integración y examina su respuesta. Para repetir y comparar usa las suites.</p></div><RouterLink class="btn btn--ghost" to="/evaluaciones">Evaluar una suite →</RouterLink></header>
    <p class="page-lead">
        Elige el lab destino para esta petición; la selección no cambia Settings.
      Jailbreaks obvios los corta el Engine local; texto ambiguo llega al agente de Desktop (~20s).
    </p>
    <div class="two-col">
      <section class="panel">
        <h2>Payloads</h2>
        <div>
          <button
            v-for="(item, id) in catalog"
            :key="id"
            type="button"
            class="btn"
            :class="payloadId === id ? 'btn--primary' : 'btn--ghost'"
            @click="pick(String(id))"
          >
            {{ item.label }}
          </button>
        </div>
        <p class="muted">{{ catalog[payloadId]?.description }}</p>
        <label class="field">
          <span class="field__label">JSON</span>
          <textarea v-model="customJson" class="field__input json-editor" rows="8" />
        </label>
        <label class="field"><span class="field__label">Integración destino</span><select v-model="targetLabId" class="field__input"><option v-for="lab in labs" :key="lab.id" :value="lab.id">{{ lab.name }} · :{{ lab.port }} {{ lab.up ? '' : '(sin respuesta)' }}</option></select></label>
        <button type="button" class="btn btn--primary" :disabled="busy" @click="fire">
          {{ busy ? 'Disparando…' : 'Disparar' }}
        </button>
      </section>
      <section class="panel">
        <h2>Última respuesta</h2>
        <pre class="timeline">{{ last ? JSON.stringify(last, null, 2) : 'Aún no hay disparos en esta sesión.' }}</pre>
      </section>
    </div>
    <section class="panel" style="margin-top:1rem"><div class="section-head"><h3>Historial de esta página</h3><RouterLink class="btn btn--ghost" to="/live">Ver decisiones en Live →</RouterLink></div><p class="fine-print">HTTP es el estado de entrega, no el veredicto. Un honeypot puede responder 200. Hasta 20 disparos; sin guardar cuerpos en este historial.</p><div v-for="(row,i) in history" :key="row.at+i" class="comparison-row"><span>{{ new Date(row.at).toLocaleTimeString() }} · {{ row.payloadId }} → {{ row.labId }}</span><span>HTTP {{ row.status }} / {{ row.ms }} ms</span></div><p v-if="!history.length" class="empty-state">Envía un fixture para iniciar el historial.</p></section>
  </div>
</template>
