<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useLiveStore } from '@/stores/live'

const live = useLiveStore()
const { snapshot, timeline, connected, agentUrl, usingStub } = storeToRefs(live)

onMounted(() => live.connect())
</script>

<template>
  <div>
    <p class="page-lead">
      Stream SSE de este proceso. IPs bloqueadas y honeypot son del ThreatRegistry del hub, no de otro demo.
    </p>
    <div class="two-col">
      <section class="panel">
        <h2>Timeline</h2>
        <p class="muted">{{ connected ? 'SSE vivo' : 'SSE caído' }} · {{ usingStub ? 'stub' : agentUrl }}</p>
        <div class="timeline">
          <div v-for="(row, i) in timeline" :key="i" class="timeline__row" :class="row.cls">
            {{ new Date(row.at).toLocaleTimeString() }} {{ row.text }}
          </div>
          <p v-if="!timeline.length" class="muted">Esperando eventos…</p>
        </div>
      </section>
      <section class="panel">
        <h2>Estado del servidor</h2>
        <div class="kv" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)">
          <span>API key</span><strong>…{{ snapshot.apiKeySuffix }}</strong>
        </div>
        <div class="kv" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)">
          <span>Honeypot</span><strong>{{ snapshot.honeypotArmed ? 'armado' : 'off' }}</strong>
        </div>
        <div class="kv" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)">
          <span>IPs bloqueadas</span><strong>{{ (snapshot.blocked || []).join(', ') || '—' }}</strong>
        </div>
        <h3>Logs</h3>
        <pre class="timeline">{{ (snapshot.logs || []).join('\n') || '—' }}</pre>
        <h3>SIEM (audit sink local)</h3>
        <pre class="timeline">{{ JSON.stringify(snapshot.siemEvents || [], null, 2) }}</pre>
      </section>
    </div>
  </div>
</template>
