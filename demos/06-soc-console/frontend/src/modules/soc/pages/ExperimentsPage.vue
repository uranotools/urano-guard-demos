<script setup lang="ts">
import LabReadiness from '../components/LabReadiness.vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Activity, ArrowUpRight, Check, Circle, Download, FlaskConical, Pause, Play, RefreshCw, Square, Waves, X } from 'lucide-vue-next'
import { apiService, useToast } from '@core'

const toast = useToast()
const scenarios = ref<any[]>([])
const runs = ref<any[]>([])
const scenarioId = ref('incident')
const selectedId = ref('')
const transport = ref('sse')
const sessionId = ref('')
const connected = ref(false)
const follow = ref(true)
const timelineEl = ref<HTMLElement>()
const eventFilter = ref('all')
const pending = ref(false)
let stream: EventSource | undefined
const selected = computed(() => runs.value.find(run => run.id === selectedId.value))
const scenario = computed(() => scenarios.value.find(item => item.id === scenarioId.value))
const eventCount = computed(() => selected.value?.events?.length || 0)
const toolCount = computed(() => selected.value?.events?.filter((event: any) => event.type === 'ToolCallStarted').length || 0)
const textChars = computed(() => selected.value?.events?.reduce((sum: number, event: any) => sum + (event.chars || 0), 0) || 0)
function upsert(run: any) {
  const existing = runs.value.find(item => item.id === run.id)
  if (existing) Object.assign(existing, run)
  else runs.value.unshift({ ...run, events: run.events || [] })
  if (runs.value.length > 50) runs.value.length = 50
}
function applySnapshot(snapshot: any) {
  scenarios.value = snapshot.scenarios || []
  runs.value = snapshot.runs || []
  if (!selectedId.value && runs.value.length) selectedId.value = runs.value[0].id
}
onMounted(async () => {
  try { applySnapshot(await apiService.request({ url: '/api/experiments' })) } catch {}
  stream = new EventSource('/api/experiments/events')
  stream.onopen = () => { connected.value = true }
  stream.onerror = () => { connected.value = false }
  stream.addEventListener('snapshot', event => applySnapshot(JSON.parse((event as MessageEvent).data)))
  stream.addEventListener('run', event => upsert(JSON.parse((event as MessageEvent).data)))
  stream.addEventListener('audit', event => {
    const data = JSON.parse((event as MessageEvent).data)
    const run = runs.value.find(item => item.id === data.runId)
    if (!run) return
    Object.assign(run, data.ids)
    if (!run.events.some((row: any) => row.id === data.row.id)) run.events.push(data.row)
    if (run.events.length > 500) run.events.shift()
  })
})
onUnmounted(() => stream?.close())
async function start() {
  pending.value = true
  try {
    const run = await apiService.request({ url: '/api/experiments', method: 'POST', data: { scenarioId: scenarioId.value, transport: transport.value, sessionId: sessionId.value.trim() || undefined } })
    upsert(run); selectedId.value = run.id
  } finally { pending.value = false }
}
async function action(name: string) {
  if (!selected.value) return
  pending.value = true
  try {
    upsert(await apiService.request({ url: `/api/experiments/${selected.value.id}/${name}`, method: 'POST' }))
    if (name === 'detach') toast.success('Entrega desconectada. El agente puede continuar en el core.')
  } finally { pending.value = false }
}
function exportAudit() {
  if (!selected.value) return
  const { result, ...audit } = selected.value
  const blob = new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = `audit-${audit.id}.json`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function useSession() {
  sessionId.value = selected.value?.sessionId || ''
  toast.success('La siguiente ejecución continuará esta sesión.')
}
const filteredEvents = computed(() => (selected.value?.events || []).filter((row: any) => eventFilter.value === 'all' || eventFilter.value === 'tools' && row.tool || eventFilter.value === 'text' && row.type === 'TokenStreamChunk' || eventFilter.value === 'errors' && row.error))
watch([eventCount, selectedId], async () => { if (follow.value) { await nextTick(); if (timelineEl.value) timelineEl.value.scrollTop = timelineEl.value.scrollHeight } })
const short = (value?: string) => value ? value.slice(0, 8) + '…' + value.slice(-4) : 'Por asignar'
</script>

<template>
  <div class="lab">
    <header class="lab__hero">
      <div><p class="lab__eyebrow">EXPERIMENTAL / PROTOCOLO V1</p><h1>Observar. Interrumpir. Retomar.</h1><p>La conexión puede terminar antes que el trabajo. Sigue cada turno y comprueba qué ocurre de verdad.</p></div>
      <span class="lab__connection"><i :class="{ 'is-on': connected }" />{{ connected ? 'Auditoría conectada' : 'Reconectando auditoría' }}</span>
    </header>
    <LabReadiness />
    <div class="lab__layout">
      <aside class="lab__catalog">
        <div class="lab__section-title"><FlaskConical :size="17" /><h2>Cuaderno de experimentos</h2></div>
        <button v-for="item in scenarios" :key="item.id" type="button" class="lab__case" :class="{ 'is-selected': scenarioId === item.id }" @click="scenarioId = item.id">
          <small>{{ item.category }}</small><strong>{{ item.title }}</strong><span>{{ item.description }}</span>
        </button>
        <p class="lab__fine">Fixtures sintéticos. Cada experimento puede consumir turnos y tokens del agente configurado. No ejecuta despliegues, pagos ni bloqueos reales.</p>
      </aside>
      <main class="lab__workspace">
        <section class="panel lab__launch">
          <div><span class="lab__eyebrow">{{ scenario?.category || 'Cargando' }}</span><h2>{{ scenario?.title || 'Selecciona un caso' }}</h2><p class="muted">{{ scenario?.description }}</p></div>
          <div class="lab__form">
            <label>Transporte<select v-model="transport" class="field__input"><option value="sse">SSE · eventos en vivo</option><option value="wait">HTTP · esperar respuesta</option><option value="ws">WS · experimental</option></select></label>
            <label>Sesión existente <span class="muted">opcional</span><input v-model="sessionId" class="field__input" placeholder="Vacío: nueva conversación" maxlength="256" /></label>
            <button class="btn btn--primary" type="button" :disabled="pending || !scenario" @click="start"><Play :size="15" /> Iniciar experimento</button>
          </div>
          <p v-if="scenario?.mechanism === 'reconnect' || scenario?.mechanism === 'cancel'" class="lab__fine">Este caso usa SSE/HTTP para comprobar el mecanismo de recuperación o cancelación, independientemente del transporte seleccionado.</p>
        </section>
        <div class="lab__runs" aria-label="Ejecuciones recientes">
          <button v-for="run in runs" :key="run.id" type="button" :class="{ active: selectedId === run.id }" @click="selectedId = run.id"><span class="lab__state" :data-state="run.state">{{ run.state }}</span>{{ run.title }}</button>
          <span v-if="!runs.length" class="muted">Tu primera ejecución aparecerá aquí.</span>
        </div>
        <template v-if="selected">
          <section class="panel lab__execution">
            <div class="lab__execution-top"><div><span class="lab__eyebrow">{{ selected.transport.toUpperCase() }} / {{ selected.state }}</span><h2>{{ selected.title }}</h2></div><button class="btn btn--ghost" @click="exportAudit"><Download :size="15" /> Auditoría JSON</button></div>
            <div class="lab__identities">
              <div><small>TURN ID</small><code :title="selected.turnId">{{ short(selected.turnId) }}</code></div><div><small>SESSION ID</small><button :disabled="!selected.sessionId" :title="selected.sessionId" @click="useSession">{{ short(selected.sessionId) }} <ArrowUpRight :size="12" /></button></div><div><small>REQUEST ID</small><code :title="selected.requestId">{{ short(selected.requestId) }}</code></div>
            </div>
            <div class="lab__controls">
              <button class="btn btn--ghost" :disabled="pending" @click="action('status')"><RefreshCw :size="14" /> Consultar</button>
              <button class="btn btn--ghost" :disabled="pending" @click="action('detach')"><Pause :size="14" /> Desconectar entrega</button>
              <button class="btn btn--ghost" :disabled="pending || !selected.turnId" @click="action('resume')"><Waves :size="14" /> Retomar eventos</button>
              <button class="btn btn--ghost" :disabled="pending" @click="action('retry')">Reintentar misma clave</button>
              <button class="btn btn--ghost lab__cancel" :disabled="pending || !selected.turnId" @click="action('cancel')"><Square :size="13" /> Solicitar cancelación</button>
            </div>
            <p v-if="selected.error" role="status" class="lab__error">{{ selected.error }} · Puedes consultar o recuperar el turno. Un error de entrega no prueba que el agente haya terminado.</p>
          </section>
          <section class="panel lab__audit">
            <div class="lab__audit-heading"><div class="lab__section-title"><Activity :size="17" /><h2>Traza en vivo</h2></div><span>{{ eventCount }} eventos · {{ toolCount }} tools · {{ textChars }} caracteres de texto</span></div>
            <div class="lab__audit-options"><label><input v-model="follow" type="checkbox" /> Seguir eventos</label><label>Mostrar <select v-model="eventFilter"><option value="all">Todos</option><option value="tools">Herramientas</option><option value="text">Texto</option><option value="errors">Errores</option></select></label></div>
            <div ref="timelineEl" class="lab__timeline" role="log" aria-live="polite" aria-label="Eventos de la ejecución">
              <div v-for="row in filteredEvents" :key="row.id" class="lab__event" :class="{ 'is-tool': row.tool, 'is-error': row.error }"><time>{{ new Date(row.at).toLocaleTimeString() }}</time><span class="lab__event-dot" /><div><strong>{{ row.type }}</strong><code v-if="row.tool">{{ row.tool }}</code><small v-if="row.chars">+{{ row.chars }} caracteres</small><small v-if="row.error">{{ row.error }}</small><small v-if="row.state">{{ row.state }}</small></div><code class="lab__sequence">{{ row.sequence != null ? '#' + row.sequence : '' }}</code></div>
              <div v-if="!selected.events.length" class="lab__empty"><Waves :size="26" /><p>{{ selected.transport === 'wait' ? 'HTTP devuelve el resultado completo. Usa Retomar eventos para revisar la traza registrada.' : 'Esperando eventos del core…' }}</p></div>
            </div>
            <p class="lab__fine">Auditoría de metadatos en RAM. No guarda cuerpos, cookies, tokens, argumentos ni resultados de herramientas. El JSON exportado excluye el resultado del modelo.</p>
          </section>
          <div class="lab__details">
            <section class="panel"><h2>Comprobaciones</h2><div v-for="(check, index) in selected.checks" :key="index" class="lab__check"><Check v-if="check.passed" :size="17" /><X v-else :size="17" /><div><strong>{{ check.label }}</strong><p v-if="check.detail" class="muted">{{ check.detail }}</p></div></div><p v-if="!selected.checks.length" class="muted">Las comprobaciones aparecen al terminar cada paso. Las respuestas del LLM no son deterministas.</p></section>
            <section class="panel"><h2>Resultado separado</h2><p class="lab__fine">Vista acotada, solo en memoria; las métricas finales están disponibles mediante Consultar.</p><pre class="lab__result">{{ selected.result || 'Aún no hay resultado. Consultar no vuelve a ejecutar el agente.' }}</pre></section>
          </div>
        </template>
        <section v-else class="panel lab__welcome"><Circle :size="34" /><h2>Cada experimento deja una traza.</h2><p>Elige un caso, observa sus IDs y comprueba continuidad, entrega y recuperación sin confundirlas con el resultado del agente.</p></section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.lab { max-width: 1500px; margin: 0 auto; }
.lab__hero { display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; padding: .4rem 0 1.8rem; border-bottom: 1px solid var(--line); margin-bottom: 1.5rem; }
.lab__hero h1 { font-size: clamp(1.7rem, 3vw, 2.65rem); letter-spacing: -.055em; margin: .4rem 0 .6rem; font-weight: 600; }
.lab__hero p:not(.lab__eyebrow) { color: var(--muted); max-width: 650px; line-height: 1.6; margin: 0; }
.lab__eyebrow { color: var(--primary); font: 600 .68rem 'IBM Plex Mono', Consolas, monospace; letter-spacing: .12em; }
.lab__connection { display: flex; align-items: center; gap: 8px; font-size: .75rem; white-space: nowrap; padding-top: .5rem; color: var(--muted); }
.lab__connection i { width: 7px; height: 7px; background: var(--accent); border-radius: 50%; }.lab__connection i.is-on { background: var(--primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent); }
.lab__layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 1.5rem; }.lab__workspace { min-width: 0; }.lab__section-title { display: flex; align-items: center; gap: 8px; }.lab__section-title h2 { font-size: .85rem; margin: .5rem 0 1rem; }
.lab__case { display: block; width: 100%; text-align: left; color: var(--ink); background: transparent; border: 1px solid transparent; border-bottom-color: var(--line); padding: .9rem .75rem; cursor: pointer; transition: background .15s; border-radius: 4px; }
.lab__case small { display: block; color: var(--muted); font-size: .65rem; text-transform: uppercase; letter-spacing: .08em; }.lab__case strong { display: block; font-size: .88rem; margin: .3rem 0; }.lab__case span { font-size: .75rem; line-height: 1.5; display: block; color: var(--muted); }.lab__case.is-selected { background: color-mix(in srgb, var(--primary) 8%, var(--bg-elev)); border-color: var(--primary); box-shadow: inset 3px 0 var(--primary); }
.lab__audit-options { display:flex; gap:1rem; justify-content:space-between; margin-top:1rem; color:var(--muted); font-size:.7rem; }.lab__audit-options label { display:flex; gap:.4rem; align-items:center; }.lab__audit-options select { background:var(--bg-elev); color:var(--ink); border:1px solid var(--line); border-radius:4px; padding:.25rem; }
.lab__fine { color: var(--muted); font-size: .7rem; line-height: 1.6; margin: .9rem 0 0; }.lab__launch h2 { margin: .45rem 0; font-size: 1.3rem; }.lab__launch .muted { margin: .3rem 0 1rem; font-size: .83rem; }.lab__form { display: grid; grid-template-columns: 1fr 1.2fr auto; gap: .8rem; align-items: end; }.lab__form label { font-size: .74rem; }.lab__form .field__input { margin-top: .35rem; width: 100%; }.lab__form .btn { min-height: 40px; }
.lab__runs { display: flex; gap: 8px; overflow-x: auto; padding: 1rem 0; }.lab__runs button { border: 1px solid var(--line); border-radius: 5px; padding: .6rem .7rem; background: var(--bg-elev); color: var(--ink); white-space: nowrap; cursor: pointer; font-size: .72rem; }.lab__runs button.active { border-color: var(--primary); }.lab__state { color: var(--muted); margin-right: .5rem; font: .65rem Consolas, monospace; }.lab__state[data-state='succeeded'] { color: var(--primary); }.lab__state[data-state='error'] { color: var(--danger); }
.lab__execution-top, .lab__audit-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }.lab__execution-top h2 { font-size: 1.05rem; margin: .35rem 0; }.lab__identities { display: grid; grid-template-columns: repeat(3, 1fr); margin: 1rem 0; border: 1px solid var(--line); border-radius: 5px; }.lab__identities > div { padding: .75rem; min-width: 0; }.lab__identities > div + div { border-left: 1px solid var(--line); }.lab__identities small { display: block; font: .6rem Consolas, monospace; color: var(--muted); letter-spacing: .08em; margin-bottom: .35rem; }.lab__identities code, .lab__identities button { font: .75rem Consolas, monospace; color: var(--ink); }.lab__identities button { padding: 0; background: none; border: 0; cursor: pointer; }
.lab__controls { display: flex; flex-wrap: wrap; gap: .35rem; }.lab__controls .btn { font-size: .7rem; padding: .5rem .6rem; display: inline-flex; gap: .35rem; align-items: center; }.lab__cancel { color: var(--danger); }.lab__error { color: var(--danger); font-size: .8rem; }.lab__audit { margin-top: 1rem; }.lab__audit-heading > span { font: .65rem Consolas, monospace; color: var(--muted); }.lab__audit-heading h2 { margin: 0; }.lab__timeline { height: 300px; overflow: auto; margin-top: 1rem; border-top: 1px solid var(--line); }
.lab__event { display: grid; grid-template-columns: 65px 10px minmax(0, 1fr) 40px; gap: 10px; align-items: start; padding: .65rem .15rem; border-bottom: 1px solid color-mix(in srgb, var(--line) 50%, transparent); font-size: .75rem; }.lab__event time { font: .65rem Consolas, monospace; color: var(--muted); padding-top: 3px; }.lab__event-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--muted); margin-top: 6px; }.lab__event.is-tool .lab__event-dot { background: var(--accent); }.lab__event.is-error .lab__event-dot { background: var(--danger); }.lab__event strong { font-weight: 500; }.lab__event small, .lab__event code { display: inline-block; margin-left: .65rem; color: var(--muted); font-size: .65rem; }.lab__event .lab__sequence { margin: 2px 0 0; text-align: right; }.lab__details { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; }.lab__details h2 { font-size: .9rem; }.lab__check { display: flex; align-items: start; gap: .5rem; padding: .6rem 0; color: var(--primary); }.lab__check strong { color: var(--ink); font-size: .75rem; }.lab__check p { font-size: .7rem; margin: .3rem 0; }.lab__result { font: .7rem/1.7 Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 300px; overflow: auto; }.lab__welcome { text-align: center; padding: 3.5rem 2rem; color: var(--muted); }.lab__welcome svg { color: var(--primary); }.lab__welcome h2 { color: var(--ink); font-size: 1.2rem; }.lab__welcome p { max-width: 460px; margin: auto; line-height: 1.7; font-size: .85rem; }.lab__empty { display: grid; place-items: center; min-height: 240px; text-align: center; color: var(--muted); font-size: .8rem; }.lab__empty p { max-width: 350px; }button:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
@media (max-width: 1100px) { .lab__form { grid-template-columns: 1fr 1fr; }.lab__form .btn { grid-column: 1 / -1; justify-content: center; }.lab__layout { grid-template-columns: 220px minmax(0, 1fr); }.lab__details { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .lab__hero { display: block; }.lab__connection { margin-top: 1rem; }.lab__layout { grid-template-columns: 1fr; }.lab__catalog { display: flex; gap: .5rem; overflow-x: auto; }.lab__catalog .lab__section-title, .lab__catalog > p { display: none; }.lab__case { min-width: 210px; border: 1px solid var(--line); }.lab__identities { grid-template-columns: 1fr; }.lab__identities > div + div { border-left: 0; border-top: 1px solid var(--line); }.lab__form { grid-template-columns: 1fr; }.lab__execution-top, .lab__audit-heading { align-items: start; flex-direction: column; } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
