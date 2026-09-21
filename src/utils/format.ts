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

/** 1,234,000 → 123.4만 · 큰 광고비를 표에서 짧게 보이려고 쓴다 */
export function formatWon(value: number) {
  if (Math.abs(value) >= 10_000) {
    const man = value / 10_000
    return `${man >= 1000 ? formatNumber(Math.round(man)) : man.toFixed(1).replace(/\.0$/, '')}만`
  }
  return formatNumber(Math.round(value))
}

/** 2.345 → '2.35' — ROAS처럼 소수 둘째 자리까지 보는 값 */
export const formatRatio = (value: number, digits = 2) => value.toFixed(digits)

/** 1.234 → '1.23%' */
export const formatPercent = (value: number, digits = 2) => `${value.toFixed(digits)}%`
