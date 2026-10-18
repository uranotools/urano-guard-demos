<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { apiService, useToast } from '@core'
const toast=useToast(), labs=ref<any[]>([]), selected=ref('hub'), busy=ref(''), error=ref(''), refreshed=ref(''), result=ref<any>(null)
let timer: ReturnType<typeof setInterval> | undefined, loading=false
const guides:Record<string,{goal:string;steps:string[];watch:string}>= {
  hub:{goal:'Recorrer el flujo completo desde el middleware hasta la consola.',steps:['Comprueba /health y el prevuelo del agente.','Envía un control benigno y observa Live.','Ejecuta la suite de contrato y conserva una línea base.'],watch:'El estado y el Guard pertenecen a este proceso.'},
  '00':{goal:'Entender el contrato mínimo de integración Express.',steps:['Confirma el endpoint /chat del registro.','Compara una petición benigna con el fixture de override.','Comprueba la diferencia entre HTTP y decisión observada.'],watch:'El arranque individual usa un puerto diferente al stack.'},
  '01':{goal:'Observar el plano de control y sus cambios de estado.',steps:['Abre el lab y revisa su estado inicial.','Envía un único fixture y examina la auditoría.','Compara el estado posterior sin asumir que un HTTP 200 es ALLOW.'],watch:'El registro de amenazas y los cambios pertenecen a este lab.'},
  '02':{goal:'Inspeccionar el contrato NEED y el segundo hop con cuerpo.',steps:['Envía primero el control benigno.','Observa el resumen del hop logger de la demo.','Compara tiempo total con el resto de integraciones.'],watch:'El segundo hop divulga el cuerpo al agente. Usa datos sintéticos.'},
  '03':{goal:'Evaluar la integración de pagos en monitor_only.',steps:['Revisa el contrato propio del webhook de pagos.','Prueba los fixtures del catálogo como entradas sintéticas.','En suites, OBSERVE acepta MONITOR o protección explícita.'],watch:'Un veredicto de riesgo no implica que se haya detenido un pago. No se realizan pagos reales.'},
  '04':{goal:'Separar la aplicación de la capa de proxy opcional.',steps:['Comprueba primero la aplicación directa del registro.','Ejecuta el contrato básico contra ese destino.','Si usas nginx, verifica su configuración aparte.'],watch:'Health directo no prueba que nginx esté levantado ni que el tráfico lo atraviese.'},
  '05':{goal:'Explorar las políticas de fallo y la disponibilidad.',steps:['Revisa FAIL_POLICY y STUB_MODE del proceso.','Conserva una línea base del contrato básico.','Cambia el entorno manualmente, reinicia este lab y compara.'],watch:'La suite no cambia variables de entorno ni provoca fallos de red automáticamente.'},
}
const current=computed(()=>labs.value.find(x=>x.id===selected.value)), guide=computed(()=>guides[selected.value]||guides.hub)
async function load(){if(loading)return;loading=true;try{labs.value=(await apiService.request({url:'/api/labs/status'})).labs||[];refreshed.value=new Date().toLocaleTimeString();error.value=''}catch{error.value='No se pudo actualizar el estado de los labs.'}finally{loading=false}}
onMounted(()=>{load();timer=setInterval(load,5000)});onUnmounted(()=>clearInterval(timer))
async function fire(payloadId:string){busy.value=payloadId;result.value=null;try{const response=await apiService.request({url:'/api/attacks/fire',method:'POST',data:{payloadId,labId:selected.value}});result.value={status:response.result.status,ms:response.result.ms,labId:selected.value};toast.success('Petición completada; revisa la decisión en Live.')}catch{}finally{busy.value=''}}
</script>
<template><div class="workbench">
  <header class="lab-hero"><div><span class="eyebrow">INTEGRACIONES / MAPA DEL LAB</span><h2>Siete entradas. Un mismo Guard.</h2><p>Cada proceso pone a prueba un contrato distinto. Recorre el flujo, observa evidencia y compara resultados.</p></div><RouterLink to="/evaluaciones" class="btn btn--primary">Crear evaluación →</RouterLink></header>
  <div class="section-head"><p class="muted">{{ labs.filter(x=>x.up).length }} / {{ labs.length }} disponibles · última lectura {{ refreshed || 'pendiente' }}</p><button class="btn btn--ghost" @click="load">Actualizar health</button></div>
  <div v-if="error" class="banner banner--error" role="alert">{{ error }}</div>
  <div class="workbench-grid"><aside class="lab-index"><button v-for="lab in labs" :key="lab.id" class="lab-index-item" :class="{'is-selected':selected===lab.id}" @click="selected=lab.id;result=null"><span class="lab-number">{{ lab.id==='hub'?'06':lab.id }}</span><span><strong>{{ lab.name }}</strong><small>:{{ lab.port }} · {{ lab.up?'disponible':'sin respuesta' }}</small></span><i class="dot" :class="lab.up?'dot--up':'dot--down'" /></button></aside>
    <section v-if="current" class="panel lab-detail"><span class="eyebrow">{{ current.up?'CONEXIÓN DISPONIBLE':'REQUIERE ATENCIÓN' }} / {{ current.ms }} ms</span><h2>{{ current.name }}</h2><p class="lead-copy">{{ guide?.goal }}</p>
      <div class="endpoint-line"><span class="badge">{{ current.ingestMethod }}</span><code>:{{ current.port }}{{ current.ingestPath }}</code><a :href="'http://127.0.0.1:'+current.port+current.health" target="_blank" rel="noopener" class="btn btn--ghost">Ver health ↗</a></div>
      <h3>Recorrido sugerido</h3><ol class="lab-steps"><li v-for="step in guide?.steps" :key="step">{{ step }}</li></ol>
      <p class="callout">{{ guide?.watch }}</p><p v-if="current.note" class="muted">{{ current.note }}</p>
      <div class="pill-row"><button class="btn btn--primary" :disabled="!!busy||!current.up" @click="fire('benign')">{{ busy==='benign'?'Enviando…':'Control benigno' }}</button><button class="btn btn--ghost" :disabled="!!busy||!current.up" @click="fire('jailbreak')">{{ busy==='jailbreak'?'Enviando…':'Fixture de override' }}</button><RouterLink class="btn btn--ghost" to="/live">Inspeccionar Live →</RouterLink></div>
      <p v-if="result" class="callout" role="status">Lab {{ result.labId }} · HTTP {{ result.status }} · {{ result.ms }} ms. El estado HTTP por sí solo no demuestra protección ni permiso.</p>
      <details class="evidence"><summary>Arranque y alcance de esta integración</summary><code>npm run {{ current.id==='hub'?'start:06':'start:'+current.id }}</code><p class="muted">El comando individual puede usar otro puerto. Para conservar los puertos de este registro usa <code>npm start</code> desde la raíz. El estado local se conserva hasta reiniciar cada proceso.</p></details>
    </section><section v-else class="panel empty-state">Leyendo el registro de integraciones…</section>
  </div>
</div></template>
