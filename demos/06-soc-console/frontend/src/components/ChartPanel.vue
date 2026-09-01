<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
  LineController,
  LineElement,
  PointElement,
} from 'chart.js'

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
  LineController,
  LineElement,
  PointElement,
)

const props = defineProps<{
  type: 'bar' | 'doughnut' | 'line'
  labels: string[]
  datasets: Array<{ label: string; data: number[]; backgroundColor?: string | string[]; borderColor?: string }>
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

function ink() {
  return getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#edf1f5'
}

function render() {
  if (!canvas.value) return
  chart?.destroy()
  chart = new Chart(canvas.value, {
    type: props.type,
    data: { labels: props.labels, datasets: props.datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: ink() } },
      },
      scales: props.type === 'doughnut'
        ? undefined
        : {
            x: { ticks: { color: ink() }, grid: { color: 'rgba(128,128,128,0.15)' } },
            y: { ticks: { color: ink() }, grid: { color: 'rgba(128,128,128,0.15)' }, beginAtZero: true },
          },
    },
  })
}

onMounted(render)
watch(() => [props.labels, props.datasets], render, { deep: true })
onUnmounted(() => chart?.destroy())
</script>

<template>
  <div class="chart-wrap">
    <canvas ref="canvas" />
  </div>
</template>
