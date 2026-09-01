<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { apiService } from '../../services/apiService'
import type { PopoverOption, PopoverSection } from '../../types/modules'

const props = withDefaults(
  defineProps<{
    title?: string
    type?: 'options' | 'filters'
    options?: PopoverOption[]
    sections?: PopoverSection[]
    endpoint?: string
    endpointMethod?: 'GET' | 'POST'
    searchable?: boolean
    searchPlaceholder?: string
    limit?: number
    formatter?: (item: Record<string, unknown>) => PopoverOption
    label?: string
  }>(),
  {
    type: 'options',
    options: () => [],
    sections: () => [],
    endpointMethod: 'GET',
    searchable: false,
    limit: 20,
    label: 'Acciones',
  },
)

const emit = defineEmits<{
  action: [item: PopoverOption]
  change: [selected: Record<string, Array<string | number>>]
}>()

const open = ref(false)
const search = ref('')
const remoteOptions = ref<PopoverOption[]>([])
const selected = ref<Record<string, Array<string | number>>>({})
const root = ref<HTMLElement | null>(null)

const displayOptions = computed(() => {
  if (props.endpoint) return remoteOptions.value
  return props.options
})

async function loadRemote() {
  if (!props.endpoint) return
  const resp = await apiService.request({
    url: props.endpoint,
    method: props.endpointMethod,
    params: { q: search.value || undefined, limit: props.limit },
  })
  const rows = (resp.data || []) as Record<string, unknown>[]
  remoteOptions.value = rows.map((r) =>
    props.formatter
      ? props.formatter(r)
      : { id: r.id as string | number, text: String(r.name ?? r.label ?? r.id) },
  )
}

function toggle() {
  open.value = !open.value
  if (open.value && props.endpoint) loadRemote()
}

function onOption(opt: PopoverOption) {
  emit('action', opt)
  open.value = false
}

function toggleFilter(section: string, id: string | number) {
  const cur = selected.value[section] || []
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
  selected.value = { ...selected.value, [section]: next }
  emit('change', { ...selected.value })
}

function onDocClick(e: MouseEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
watch(search, () => {
  if (props.endpoint) loadRemote()
})
</script>

<template>
  <div ref="root" class="mp-popover">
    <button type="button" class="btn btn--ghost" @click.stop="toggle">
      <slot name="trigger">{{ label }}</slot>
    </button>
    <div v-if="open" class="mp-popover__panel" @click.stop>
      <header v-if="title" class="mp-popover__title">{{ title }}</header>

      <input
        v-if="searchable"
        v-model="search"
        class="field__input"
        type="search"
        :placeholder="searchPlaceholder || 'Buscar…'"
      />

      <template v-if="type === 'filters'">
        <div v-for="sec in sections" :key="sec.title" class="mp-popover__section">
          <strong>{{ sec.title }}</strong>
          <button
            v-for="opt in sec.options"
            :key="opt.id"
            type="button"
            class="mp-popover__item"
            :class="{ 'is-active': (selected[sec.title] || []).includes(opt.id) }"
            @click="toggleFilter(sec.title, opt.id)"
          >
            {{ opt.text }}
          </button>
        </div>
      </template>

      <template v-else>
        <button
          v-for="opt in displayOptions"
          :key="opt.id"
          type="button"
          class="mp-popover__item"
          :class="{ 'is-danger': opt.variant === 'danger' }"
          @click="onOption(opt)"
        >
          {{ opt.text }}
        </button>
        <p v-if="!displayOptions.length" class="muted">Sin opciones</p>
      </template>
    </div>
  </div>
</template>
