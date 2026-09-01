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

onMounted(async () => {
  live.connect()
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
      data: { payloadId: payloadId.value, labId: snapshot.value.targetLabId || 'hub', body },
    })
    toast.success(`HTTP ${last.value.result?.status} en ${last.value.result?.ms}ms`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <p class="page-lead">
      Dispara fixtures contra el lab destino de Settings (por defecto este hub).
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
        <p class="muted">Destino: {{ snapshot.targetLabId || 'hub' }}</p>
        <button type="button" class="btn btn--primary" :disabled="busy" @click="fire">
          {{ busy ? 'Disparando…' : 'Disparar' }}
        </button>
      </section>
      <section class="panel">
        <h2>Última respuesta</h2>
        <pre class="timeline">{{ last ? JSON.stringify(last, null, 2) : 'Aún no hay disparos en esta sesión.' }}</pre>
      </section>
    </div>
  </div>
</template>
