<script setup lang="ts">
import { ref } from 'vue'
import ListData from '@core/components/multipurpose/ListData.vue'

const selected = ref<any>(null)
const table = ref<{ reload: () => void } | null>(null)

const columns = [
  { Header: 'Cuando', accessor: 'at' },
  { Header: 'Título', accessor: 'title' },
  { Header: 'Severidad', accessor: 'severity' },
  { Header: 'Origen', accessor: 'source' },
  { Header: 'Veredicto', accessor: 'verdict' },
]
</script>

<template>
  <div>
    <p class="page-lead">
      Reportes persistidos en <code>data/reports.json</code>. Se llenan al guardar desde el chat o cuando un hop trae <code>agentReport</code>.
    </p>
    <ListData
      ref="table"
      :table-config="{ title: 'Reportes de IA', apiEndpoint: '/api/reports', dataField: 'data' }"
      :columns="columns"
      @row-click="selected = $event"
    />
    <section v-if="selected" class="panel" style="margin-top:1rem">
      <h2>{{ selected.title }}</h2>
      <p class="muted">{{ selected.at }} · {{ selected.source }} · {{ selected.severity || '—' }}</p>
      <p v-if="selected.question"><strong>Pregunta:</strong> {{ selected.question }}</p>
      <h3>Analysis</h3>
      <pre class="timeline">{{ selected.analysis || '—' }}</pre>
      <h3>Report</h3>
      <pre class="timeline">{{ JSON.stringify(selected.report || {}, null, 2) }}</pre>
    </section>
  </div>
</template>
