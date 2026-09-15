type Row = Record<string, string | number | boolean | null | undefined>

const escapeCell = (value: Row[string]) => {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * 엑셀에서 바로 열리는 CSV 다운로드.
 * UTF-8 BOM을 붙여야 한글이 깨지지 않는다.
 */
export function downloadCsv(filename: string, rows: Row[]) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const body = rows.map((row) => headers.map((header) => escapeCell(row[header])).join(','))
  const csv = ['﻿' + headers.join(','), ...body].join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
