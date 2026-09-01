<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { apiService, useToast } from '@core'
import { useLiveStore } from '@/stores/live'

const toast = useToast()
const labs = ref<any[]>([])
const busyId = ref('')
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  load()
  timer = setInterval(load, 4000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

async function load() {
  const resp = await apiService.request({ url: '/api/labs/status' })
  labs.value = resp.labs || []
}

async function fire(labId: string, payloadId: string) {
  busyId.value = labId + payloadId
  try {
    const resp = await apiService.request({
      url: '/api/attacks/fire',
      method: 'POST',
      data: { labId, payloadId },
    })
    toast.success(`${labId} HTTP ${resp.result?.status}`)
    useLiveStore().connect()
  } finally {
    busyId.value = ''
  }
}
</script>

<template>
  <div>
    <p class="page-lead">
      <code>npm start</code> en la raíz levanta el stack (00–06). Health se refresca cada 4s.
      Demo 00 en el stack usa <code>:3006</code> para no chocar con 01 en <code>:3000</code>.
    </p>
    <div class="lab-grid">
      <article v-for="lab in labs" :key="lab.id" class="panel lab-card">
        <header style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <strong>{{ lab.name }}</strong>
          <span><i class="dot" :class="lab.up ? 'dot--up' : 'dot--down'" /> {{ lab.up ? 'up' : 'down' }}</span>
        </header>
        <p class="muted">:{{ lab.port }}{{ lab.ingestPath }}</p>
        <p v-if="lab.note" class="muted">{{ lab.note }}</p>
        <div>
          <button type="button" class="btn btn--ghost" :disabled="!lab.up || !!busyId" @click="fire(lab.id, 'benign')">
            Benigno
          </button>
          <button type="button" class="btn btn--ghost" :disabled="!lab.up || !!busyId" @click="fire(lab.id, 'jailbreak')">
            Jailbreak
          </button>
        </div>
      </article>
    </div>
    <p style="margin-top:1rem">
      <button type="button" class="btn btn--ghost" @click="load">Actualizar health</button>
    </p>
  </div>
</template>
