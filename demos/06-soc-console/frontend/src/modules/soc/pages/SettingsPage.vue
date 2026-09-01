<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { apiService, useToast } from '@core'
import { useLiveStore } from '@/stores/live'

const toast = useToast()
const busy = ref(false)
const ping = ref<any>(null)
const form = reactive({
  agentUrl: '',
  timeoutMs: 35000,
  securityMode: 'block_threats',
  failPolicy: 'open',
  agentToken: '',
  agentHmac: '',
  targetLabId: 'hub',
})
const defaults = ref({ desktop: '', stub: 'stub' })
const labs = ref<any[]>([])

onMounted(async () => {
  const s = await apiService.request({ url: '/api/settings' })
  Object.assign(form, {
    agentUrl: s.agentUrl,
    timeoutMs: s.timeoutMs,
    securityMode: s.securityMode,
    failPolicy: s.failPolicy,
    agentToken: s.agentToken || '',
    agentHmac: s.agentHmac || '',
    targetLabId: s.targetLabId || 'hub',
  })
  defaults.value = s.defaults || defaults.value
  const status = await apiService.request({ url: '/api/labs' })
  labs.value = status.labs || []
})

async function save() {
  busy.value = true
  try {
    await apiService.request({ url: '/api/settings', method: 'PUT', data: { ...form } })
    useLiveStore().connect()
    toast.success('Guard recreado con la nueva config')
  } finally {
    busy.value = false
  }
}

async function pingAgent() {
  ping.value = await apiService.request({ url: '/api/settings/ping', method: 'POST' })
  toast.success(ping.value.ok ? `Ping HTTP ${ping.value.status}` : 'Ping falló')
}

function useDesktop() {
  form.agentUrl = defaults.value.desktop
}
function useStub() {
  form.agentUrl = 'stub'
}
</script>

<template>
  <div class="two-col">
    <section class="panel">
      <p class="page-lead">
        Sin login. Cambiar AGENT_URL recrea UranoGuard en este proceso. El chat SOC y los hops de ingest usan esta URL.
      </p>
      <label class="field">
        <span class="field__label">Agent URL</span>
        <input v-model="form.agentUrl" class="field__input" />
      </label>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <button type="button" class="btn btn--ghost" @click="useDesktop">Desktop /default</button>
        <button type="button" class="btn btn--ghost" @click="useStub">Stub local</button>
      </div>
      <label class="field md:w-1/2">
        <span class="field__label">Timeout ms</span>
        <input v-model.number="form.timeoutMs" class="field__input" type="number" min="1500" />
      </label>
      <label class="field md:w-1/2">
        <span class="field__label">Security mode</span>
        <select v-model="form.securityMode" class="field__input">
          <option value="block_threats">block_threats</option>
          <option value="monitor_only">monitor_only</option>
        </select>
      </label>
      <label class="field md:w-1/2">
        <span class="field__label">Fail policy</span>
        <select v-model="form.failPolicy" class="field__input">
          <option value="open">open</option>
          <option value="closed">closed</option>
        </select>
      </label>
      <label class="field md:w-1/2">
        <span class="field__label">Lab destino (ataques)</span>
        <select v-model="form.targetLabId" class="field__input">
          <option v-for="lab in labs" :key="lab.id" :value="lab.id">{{ lab.name }}</option>
        </select>
      </label>
      <label class="field">
        <span class="field__label">Bearer token (opcional)</span>
        <input v-model="form.agentToken" class="field__input" type="password" autocomplete="off" />
      </label>
      <label class="field">
        <span class="field__label">HMAC secret (opcional)</span>
        <input v-model="form.agentHmac" class="field__input" type="password" autocomplete="off" />
      </label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn--primary" :disabled="busy" @click="save">Guardar y recrear Guard</button>
        <button type="button" class="btn btn--ghost" @click="pingAgent">Ping webhook</button>
      </div>
    </section>
    <section class="panel">
      <h2>Último ping</h2>
      <pre class="timeline">{{ ping ? JSON.stringify(ping, null, 2) : 'NEED sin body (~25ms) si Desktop está up.' }}</pre>
    </section>
  </div>
</template>
