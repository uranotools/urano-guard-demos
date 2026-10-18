<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { apiService, useToast } from '@core'
import LabReadiness from '../components/LabReadiness.vue'
import { downloadJson } from '../labTools'
const toast = useToast(), data = ref<any>({ suites: [], cases: [], runs: [] }), labs = ref<any[]>([])
const suiteId = ref('smoke'), selectedLabs = ref<string[]>(['hub']), selectedId = ref(''), baselineId = ref(''), busy = ref(false), error = ref(''), filter = ref('all')
let timer: ReturnType<typeof setInterval> | undefined, loading = false
const current = computed(() => data.value.runs.find((run: any) => run.id === selectedId.value) || data.value.runs[0])
const suite = computed(() => data.value.suites.find((item: any) => item.id === suiteId.value))
const count = computed(() => (suite.value?.cases.length || 0) * selectedLabs.value.length)
const active = computed(() => data.value.runs.some((item: any) => item.state === 'running'))
const baselines = computed(() => data.value.runs.filter((item: any) => item.state === 'completed' && item.suiteId === suiteId.value))
const rows = computed(() => (current.value?.rows || []).filter((row: any) => filter.value === 'all' || row.outcome === filter.value))
async function refresh() { if (loading) return; loading = true; try { data.value = await apiService.request({ url: '/api/evaluations' }); error.value = '' } catch { error.value = 'No se pudo actualizar la ejecución.' } finally { loading = false } }
onMounted(async () => { await refresh(); try { labs.value = (await apiService.request({url:'/api/labs/status'})).labs || [] } catch {} timer = setInterval(refresh, 3000) })
onUnmounted(() => clearInterval(timer))
async function start() {
  busy.value = true
  try { const run = await apiService.request({url:'/api/evaluations', method:'POST', data:{suiteId:suiteId.value,labIds:selectedLabs.value,baselineId:baselines.value.some((run: any) => run.id === baselineId.value) ? baselineId.value : undefined}}); selectedId.value = run.id; await refresh(); toast.success('Suite iniciada') } catch {} finally { busy.value = false }
}
async function cancel() { try { await apiService.request({url:`/api/evaluations/${current.value.id}/cancel`,method:'POST'}); await refresh() } catch {} }
</script>
<template>
  <div class="workbench">
    <header class="lab-hero"><div><span class="eyebrow">EVALUACIÓN / FIXTURES 01</span><h2>Medir. Comparar. Repetir.</h2><p>Un banco de pruebas para observar el comportamiento de Guard en cada integración.</p></div><span class="stamp">24 CASOS MÁX.<br>UNA SUITE A LA VEZ</span></header>
    <LabReadiness />
    <div class="workbench-grid">
      <aside class="panel setup-panel"><span class="eyebrow">01 / DISEÑAR LA PRUEBA</span><h3>Suite de evaluación</h3>
        <label class="field"><span class="field__label">Suite</span><select v-model="suiteId" class="field__input"><option v-for="item in data.suites" :key="item.id" :value="item.id">{{ item.title }}</option></select></label>
        <p class="muted">{{ suite?.description }}</p>
        <fieldset class="lab-fieldset"><legend>Integraciones destino</legend><label v-for="lab in labs" :key="lab.id" class="check-line"><input v-model="selectedLabs" type="checkbox" :value="lab.id" /><span>{{ lab.name }}</span><i class="dot" :class="lab.up ? 'dot--up' : 'dot--down'" /></label></fieldset>
        <label class="field"><span class="field__label">Comparar con una línea base</span><select v-model="baselineId" class="field__input"><option value="">Sin comparación</option><option v-for="run in baselines" :key="run.id" :value="run.id">{{ new Date(run.at).toLocaleString() }} · {{ run.rows.length }} casos</option></select></label>
        <div class="run-budget"><strong>{{ count }}</strong><span>peticiones secuenciales<br>pueden consumir tokens</span></div>
        <button class="btn btn--primary w-full" :disabled="busy || active || count === 0 || count > 24" @click="start">{{ active ? 'Hay una suite en curso' : 'Ejecutar suite' }}</button>
        <p class="fine-print">La suite no cambia políticas ni resetea el estado de los labs. Un bloqueo persistente puede afectar casos posteriores. Resultados en RAM, máximo 20 ejecuciones.</p>
      </aside>
      <main class="results-column"><div v-if="error" role="alert" class="banner banner--error">{{ error }}</div>
        <div class="run-tabs"><button v-for="run in data.runs" :key="run.id" class="btn btn--ghost" :class="{'is-selected':current?.id===run.id}" @click="selectedId=run.id">{{ run.suiteId }} · {{ new Date(run.at).toLocaleTimeString() }} <span class="badge">{{ run.state }}</span></button></div>
        <section v-if="current" class="panel">
          <div class="section-head"><div><span class="eyebrow">02 / RESULTADO OBSERVADO</span><h3>{{ current.rows.length }} / {{ current.total }} comprobaciones</h3></div><div class="pill-row"><button v-if="current.state==='running'" class="btn btn--danger" @click="cancel">Detener suite</button><button class="btn btn--ghost" @click="downloadJson('urano-evaluation-'+current.id+'.json',current)">Exportar JSON</button></div></div>
          <progress :value="current.rows.length" :max="current.total" class="suite-progress" aria-label="Progreso de suite" />
          <div class="metric-strip"><div><small>Pasan</small><strong class="ok">{{ current.summary.pass }}</strong></div><div><small>Difieren</small><strong class="bad">{{ current.summary.fail }}</strong></div><div><small>Sin evidencia</small><strong>{{ current.summary.unknown }}</strong></div><div><small>Error</small><strong class="warn">{{ current.summary.error }}</strong></div><div><small>P50 / P95</small><strong>{{ current.summary.p50 ?? '—' }} / {{ current.summary.p95 ?? '—' }}<small> ms</small></strong></div></div>
          <p class="fine-print">Latencias de todas las respuestas HTTP, incluidos errores. Sin repetir automáticamente las peticiones. Cancelar detiene la entrega y los casos pendientes; no cancela turnos ya aceptados por el agente.</p>
          <label class="field"><span class="field__label">Filtrar resultados</span><select v-model="filter" class="field__input"><option value="all">Todos</option><option value="pass">Pasan</option><option value="fail">Difieren</option><option value="unknown">Sin evidencia</option><option value="error">Errores</option></select></label>
          <div class="table-wrap"><table class="data-table"><thead><tr><th>Lab / caso</th><th>Esperado</th><th>Observado</th><th>Resultado</th><th>HTTP / ms</th></tr></thead><tbody><tr v-for="row in rows" :key="row.id"><td><small class="muted">{{ row.labId }}</small><br>{{ row.title }}</td><td>{{ row.expected }}</td><td>{{ row.observed }}</td><td><span class="badge" :class="row.outcome==='fail'?'badge--danger':row.outcome==='error'?'badge--warn':''">{{ row.outcome }}</span></td><td>{{ row.status ?? '—' }} / {{ row.ms ?? '—' }}</td></tr></tbody></table><p v-if="!rows.length" class="empty-state">Sin resultados para este filtro.</p></div>
          <details v-if="current.comparisons.length" class="evidence"><summary>Comparación con línea base · {{ current.comparisons.filter((x:any)=>x.regression).length }} regresiones observadas</summary><div v-for="item in current.comparisons" :key="item.labId+item.caseId" class="comparison-row"><span>{{ item.labId }} / {{ item.caseId }}</span><span :class="item.regression?'bad':item.unavailable?'warn':''">{{ item.before || 'sin base' }} → {{ item.after }} · {{ item.deltaMs == null ? '—' : (item.deltaMs>0?'+':'')+item.deltaMs+' ms' }}</span></div></details>
          <p class="fine-print">HTTP 200 no demuestra ALLOW: los honeypots pueden devolver 200. UNKNOWN significa que el contrato de respuesta no expone evidencia suficiente. OBSERVE acepta MONITOR o protección en la demo 03. La configuración capturada describe el hub; los otros procesos conservan su entorno.</p>
        </section>
        <section v-else class="panel empty-state"><span class="eyebrow">LISTO PARA MEDIR</span><h3>Tu primera línea base empieza aquí.</h3><p>Selecciona una suite y uno o varios labs. Los casos usan fixtures sintéticos y no se envían hasta pulsar Ejecutar.</p></section>
        <section class="panel"><span class="eyebrow">03 / CONTRATO DE PRUEBA</span><h3>Qué se está comprobando</h3><div v-for="item in data.cases.filter((x:any)=>suite?.cases.includes(x.id))" :key="item.id" class="comparison-row"><div><strong>{{ item.title }}</strong><small class="muted"> · {{ item.category }}</small></div><span class="badge">{{ item.expected }}</span></div><p class="fine-print">Son expectativas de este fixture, no una certificación de seguridad ni un benchmark del modelo.</p></section>
      </main>
    </div>
  </div>
</template>
