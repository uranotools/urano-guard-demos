import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface DecisionPoint {
  id: string
  at: string
  verdict: string
  allowed?: boolean
  riskScore?: number
  category?: string
  source?: string
  reason?: string
  analysis?: string
  report?: any
  latencyMs?: number
  labId?: string
}

export interface TimelineRow {
  at: string
  name: string
  cls: string
  text: string
}

export const useLiveStore = defineStore('live', () => {
  const connected = ref(false)
  const agentUrl = ref('')
  const usingStub = ref(false)
  const snapshot = ref<any>({})
  const decisions = ref<DecisionPoint[]>([])
  const threatCats = ref<Array<{ at: string; category: string; score?: number; summary?: string }>>([])
  const timeline = ref<TimelineRow[]>([])
  let es: EventSource | null = null

  const kpis = computed(() => snapshot.value?.kpis || { total: 0, blocked: 0, allowed: 0, monitor: 0, avgRisk: 0, hops: 0 })

  function pushLine(name: string, text: string, cls = '') {
    timeline.value.unshift({ at: new Date().toISOString(), name, cls, text })
    if (timeline.value.length > 200) timeline.value.pop()
  }

  function applyState(s: any) {
    snapshot.value = s
    if (Array.isArray(s.decisions)) decisions.value = s.decisions
    if (Array.isArray(s.threatCats)) threatCats.value = s.threatCats
    if (s.agentUrl) agentUrl.value = s.agentUrl
    if (typeof s.usingStub === 'boolean') usingStub.value = s.usingStub
  }

  function connect() {
    if (es) return
    es = new EventSource('/events')
    es.addEventListener('hello', (e) => {
      const d = JSON.parse((e as MessageEvent).data)
      usingStub.value = !!d.usingStub
      agentUrl.value = d.agentUrl || ''
      connected.value = true
      pushLine('hello', d.usingStub ? 'stub local (sin Desktop)' : 'agente ' + d.agentUrl)
    })
    es.addEventListener('state', (e) => applyState(JSON.parse((e as MessageEvent).data)))
    es.addEventListener('decision', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as DecisionPoint
      if (!decisions.value.some((x) => x.id === d.id)) decisions.value.unshift(d)
    })
    es.addEventListener('requestBlocked', (e) => {
      const d = JSON.parse((e as MessageEvent).data)
      pushLine('block', `BLOCK score=${d.riskScore ?? '—'} ${d.reason || d.source || ''}`, 'bad')
    })
    es.addEventListener('requestAllowed', (e) => {
      const d = JSON.parse((e as MessageEvent).data)
      pushLine('allow', `ALLOW score=${d.riskScore ?? '—'}${d.analysis ? ' — ' + String(d.analysis).slice(0, 80) : ''}`, 'ok')
    })
    es.addEventListener('threatDetected', (e) => {
      const d = JSON.parse((e as MessageEvent).data)
      threatCats.value.unshift({ at: new Date().toISOString(), category: d.category, score: d.score, summary: d.summary })
      pushLine('threat', `${d.category || 'THREAT'} ${d.summary || ''}`.trim(), 'warn')
    })
    es.addEventListener('agentInvestigationComplete', (e) => {
      const d = JSON.parse((e as MessageEvent).data)
      pushLine('async', `investigación ${d.report?.title || d.reason || ''}`.trim(), 'warn')
    })
    es.addEventListener('serverMutated', (e) => {
      pushLine('skill', 'skill ' + (e as MessageEvent).data)
    })
    es.addEventListener('attackFired', (e) => {
      const d = JSON.parse((e as MessageEvent).data)
      pushLine('attack', `disparo ${d.payloadId} → ${d.labId} HTTP ${d.status} (${d.ms}ms)`)
    })
    es.onerror = () => {
      connected.value = false
    }
  }

  return { connected, agentUrl, usingStub, snapshot, decisions, threatCats, timeline, kpis, connect }
})
