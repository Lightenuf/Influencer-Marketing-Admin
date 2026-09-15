export const formatNumber = (value: number) => value.toLocaleString('ko-KR')

/** 12,000 → 1.2만 */
export function formatFollowers(value: number) {
  if (value >= 10_000) {
    const man = value / 10_000
    return `${man >= 100 ? Math.round(man) : man.toFixed(1).replace(/\.0$/, '')}만`
  }
  return formatNumber(value)
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${formatDate(value)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function daysSince(value: string | null | undefined) {
  if (!value) return 0
  const diff = Date.now() - new Date(value).getTime()
  return Math.max(0, Math.floor(diff / 86_400_000))
}

export const toDateInputValue = (value: string | null) => (value ? value.slice(0, 10) : '')
