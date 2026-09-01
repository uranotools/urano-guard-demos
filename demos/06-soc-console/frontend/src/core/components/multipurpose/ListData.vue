<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { apiService } from '../../services/apiService'

export interface ListColumn {
  Header: string
  accessor: string
  Cell?: (row: Record<string, unknown>) => string
}

const props = defineProps<{
  tableConfig: {
    title: string
    apiEndpoint: string
    method?: 'GET' | 'POST'
    dataField?: string
  }
  columns: ListColumn[]
  filters?: Record<string, unknown>
  refreshKey?: number | string
}>()

const emit = defineEmits<{
  rowClick: [row: Record<string, unknown>]
}>()

const rows = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const method = props.tableConfig.method || 'GET'
    const resp = await apiService.request({
      url: props.tableConfig.apiEndpoint,
      method,
      params: method === 'GET' ? { q: search.value || undefined, ...props.filters } : undefined,
      data: method === 'POST' ? { q: search.value, ...props.filters } : undefined,
    })
    const field = props.tableConfig.dataField || 'data'
    rows.value = (resp[field] || []) as Record<string, unknown>[]
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Error al cargar'
    rows.value = []
  } finally {
    loading.value = false
  }
}

function cellValue(col: ListColumn, row: Record<string, unknown>) {
  if (col.Cell) return col.Cell(row)
  const v = row[col.accessor]
  return v == null ? '' : String(v)
}

onMounted(load)
watch(() => [props.filters, props.refreshKey], load, { deep: true })

defineExpose({ reload: load })
</script>

<template>
  <section class="list-data">
    <header class="list-data__head">
      <h2>{{ tableConfig.title }}</h2>
      <div class="list-data__tools">
        <input
          v-model="search"
          class="field__input list-data__search"
          type="search"
          placeholder="Buscar…"
          @keyup.enter="load"
        />
        <button type="button" class="btn btn--ghost" @click="load">Actualizar</button>
        <slot name="toolbar" />
      </div>
    </header>

    <p v-if="error" class="banner banner--error">{{ error }}</p>
    <p v-if="loading" class="muted">Cargando…</p>

    <div v-else class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.accessor">{{ col.Header }}</th>
            <th v-if="$slots.actions">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td :colspan="columns.length + ($slots.actions ? 1 : 0)" class="muted">Sin registros</td>
          </tr>
          <tr
            v-for="(row, idx) in rows"
            :key="String(row.id ?? idx)"
            @click="emit('rowClick', row)"
          >
            <td v-for="col in columns" :key="col.accessor">{{ cellValue(col, row) }}</td>
            <td v-if="$slots.actions" class="data-table__actions" @click.stop>
              <slot name="actions" :row="row" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
