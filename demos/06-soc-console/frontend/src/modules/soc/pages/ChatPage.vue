<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiService, useToast } from '@core'

const toast = useToast()
const message = ref('Resume los logs locales y decide si hay un incidente que investigar.')
const attachLogs = ref(true)
const busy = ref(false)
const thread = ref<Array<{ role: 'user' | 'agent'; text: string; analysis?: string; report?: any; verdict?: string }>>([])
const last = ref<any>(null)

onMounted(() => {})

async function send() {
  const text = message.value.trim()
  if (!text) return
  busy.value = true
  thread.value.push({ role: 'user', text })
  try {
    const resp = await apiService.request({
      url: '/api/soc/chat',
      method: 'POST',
      data: { message: text, attachLogs: attachLogs.value },
    })
    last.value = resp
    const blob = [resp.analysis, resp.report ? JSON.stringify(resp.report, null, 2) : ''].filter(Boolean).join('\n\n')
    thread.value.push({
      role: 'agent',
      text: blob || resp.reason || JSON.stringify(resp.raw || resp).slice(0, 2000),
      analysis: resp.analysis,
      report: resp.report,
      verdict: resp.verdict,
    })
    message.value = ''
  } catch {
    thread.value.push({ role: 'agent', text: 'El agente no respondió. Revisa Settings / Desktop :6274.' })
  } finally {
    busy.value = false
  }
}

async function saveLast() {
  if (!last.value) return
  await apiService.request({
    url: '/api/reports',
    method: 'POST',
    data: {
      title: last.value.report?.title || last.value.reason || 'SOC chat',
      severity: last.value.report?.severity,
      source: 'soc-chat',
      verdict: last.value.verdict,
      analysis: last.value.analysis,
      report: last.value.report,
      question: thread.value.filter((m) => m.role === 'user').at(-1)?.text,
    },
  })
  toast.success('Reporte guardado')
}
</script>

<template>
  <div class="chat">
    <p class="page-lead">
      No pasa por el WAF (el analista no se bloquea a sí mismo). El JSON va al webhook de Desktop
      con logs/SIEM/decisiones adjuntos. El modelo y la API key son los del agente en Vault.
    </p>
    <div class="chat__log">
      <div v-for="(m, i) in thread" :key="i" class="bubble" :class="m.role === 'user' ? 'bubble--user' : 'bubble--agent'">
        <strong>{{ m.role === 'user' ? 'Tú' : 'Agente' }}</strong>
        <span v-if="m.verdict" class="badge" style="margin-left:8px">{{ m.verdict }}</span>
        <pre>{{ m.text }}</pre>
      </div>
      <p v-if="!thread.length" class="muted">Escribe un plan de análisis. Ejemplo: “¿Hay un patrón de SQLi en los últimos eventos?”</p>
    </div>
    <div class="chat__composer">
      <label class="muted" style="display:flex;gap:8px;align-items:center">
        <input v-model="attachLogs" type="checkbox" /> Adjuntar logs, SIEM y decisiones recientes
      </label>
      <textarea v-model="message" class="field__input field__textarea" rows="3" @keydown.ctrl.enter="send" />
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn--primary" :disabled="busy" @click="send">
          {{ busy ? 'Esperando al agente…' : 'Enviar' }}
        </button>
        <button type="button" class="btn btn--ghost" :disabled="!last" @click="saveLast">Guardar reporte</button>
      </div>
    </div>
  </div>
</template>
