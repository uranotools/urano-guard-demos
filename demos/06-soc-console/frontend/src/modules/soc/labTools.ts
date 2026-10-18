export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function percentile(values: number[], fraction: number) {
  const sorted = values.filter(Number.isFinite).sort((a,b) => a-b)
  return sorted.length ? Math.round(sorted[Math.ceil(sorted.length*fraction)-1]!) : null
}
