<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useLiveStore } from '@/stores/live'
import ChartPanel from '@/components/ChartPanel.vue'

const live = useLiveStore()
const { kpis, decisions, threatCats, snapshot, usingStub, agentUrl, connected } = storeToRefs(live)

onMounted(() => live.connect())

const verdictSeries = computed(() => {
  const buckets: Record<string, { ALLOW: number; BLOCK: number; MONITOR: number }> = {}
  for (const d of [...decisions.value].reverse()) {
    const t = new Date(d.at)
    const key = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
    if (!buckets[key]) buckets[key] = { ALLOW: 0, BLOCK: 0, MONITOR: 0 }
    const v = String(d.verdict || '').toUpperCase()
    if (v === 'BLOCK' || d.allowed === false) buckets[key].BLOCK++
    else if (v === 'MONITOR') buckets[key].MONITOR++
    else buckets[key].ALLOW++
  }
  const labels = Object.keys(buckets).slice(-12)
  return {
    labels,
    datasets: [
      { label: 'ALLOW', data: labels.map((k) => buckets[k].ALLOW), backgroundColor: 'rgba(61,186,154,0.75)' },
      { label: 'BLOCK', data: labels.map((k) => buckets[k].BLOCK), backgroundColor: 'rgba(240,113,120,0.8)' },
      { label: 'MONITOR', data: labels.map((k) => buckets[k].MONITOR), backgroundColor: 'rgba(224,154,91,0.8)' },
    ],
  }
})

const riskHist = computed(() => {
  const bins = [0, 0, 0, 0, 0]
  const labels = ['0–19', '20–39', '40–59', '60–79', '80–100']
  for (const d of decisions.value) {
    const s = Number(d.riskScore)
    if (!Number.isFinite(s)) continue
    bins[Math.min(4, Math.floor(s / 20))]++
  }
  return {
    labels,
    datasets: [{ label: 'Eventos', data: bins, backgroundColor: 'rgba(61,186,154,0.7)' }],
  }
})

const catChart = computed(() => {
  const counts: Record<string, number> = {}
  for (const t of threatCats.value) {
    const c = t.category || 'CUSTOM'
    counts[c] = (counts[c] || 0) + 1
  }
  const labels = Object.keys(counts)
  const palette = ['#3dba9a', '#f07178', '#e09a5b', '#7aa2f7', '#c792ea', '#89ddff']
  return {
    labels: labels.length ? labels : ['sin amenazas aún'],
    datasets: [{
      label: 'Categorías',
      data: labels.length ? labels.map((k) => counts[k]) : [1],
      backgroundColor: labels.length ? labels.map((_, i) => palette[i % palette.length]) : ['rgba(154,166,178,0.4)'],
    }],
  }
})
</script>

<template>
  <div>
    <p class="page-lead">
      Consola de demo: gráficas del ring de esta sesión (se vacía al reiniciar).
      Jailbreak en <strong>este proceso</strong> entra por el Guard local.
      Disparos a otros Labs se copian aquí (el 200 del honeypot sigue siendo un BLOCK).
      Agente: {{ usingStub ? 'stub local' : agentUrl || '…' }}
      · SSE {{ connected ? 'conectado' : 'reconectando' }}
      · modo {{ snapshot.securityMode || '—' }}
    </p>

    <div class="kpi-grid">
      <article class="kpi"><small>Eventos</small><strong>{{ kpis.total }}</strong></article>
      <article class="kpi"><small>ALLOW</small><strong class="ok">{{ kpis.allowed }}</strong></article>
      <article class="kpi"><small>BLOCK</small><strong class="bad">{{ kpis.blocked }}</strong></article>
      <article class="kpi"><small>MONITOR</small><strong class="warn">{{ kpis.monitor }}</strong></article>
      <article class="kpi"><small>Risk medio</small><strong>{{ kpis.avgRisk }}</strong></article>
      <article class="kpi"><small>Hops con análisis</small><strong>{{ kpis.hops }}</strong></article>
    </div>

    <div class="chart-grid">
      <section class="panel">
        <h2>Veredictos en el tiempo</h2>
        <ChartPanel type="bar" :labels="verdictSeries.labels" :datasets="verdictSeries.datasets" />
      </section>
      <section class="panel">
        <h2>Histograma de riskScore</h2>
        <ChartPanel type="bar" :labels="riskHist.labels" :datasets="riskHist.datasets" />
      </section>
    </div>
    <section class="panel">
      <h2>Categorías threatDetected</h2>
      <ChartPanel type="doughnut" :labels="catChart.labels" :datasets="catChart.datasets" />
    </section>
  </div>
</template>
