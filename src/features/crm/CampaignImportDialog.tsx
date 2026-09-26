import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Modal } from '@/components/ui'
import { repository } from '@/data'
import type { CampaignImportRow, CampaignStatus, Channel } from '@/data/types'
import { CAMPAIGN_STATUS_LABELS, CHANNEL_LABELS } from '@/data/types'
import { downloadCsv } from '@/utils/csv'
import { formatDateTime, formatNumber } from '@/utils/format'

/**
 * 아임웹 발송 내역 올리기.
 *
 * 아임웹은 발송 기록을 API로 주지 않는다. 관리자 화면에서 내려받은 CSV를 그대로 올린다.
 * 그래야 예전에 보낸 것까지 한자리에서 비교할 수 있다.
 */

/** 아임웹이 쓰는 말과 우리 상태를 잇는다 */
const STATUS_MAP: Record<string, CampaignStatus> = {
  '발송 완료': 'sent',
  발송완료: 'sent',
  완료: 'sent',
  '발송 실패': 'failed',
  발송실패: 'failed',
  실패: 'failed',
  '발송 대기': 'pending',
  발송대기: 'pending',
  대기: 'pending',
  '발송 취소': 'canceled',
  발송취소: 'canceled',
  취소: 'canceled',
  임시저장: 'draft',
}

/** 브랜드 메시지 유형으로 보이는 말들 */
const BRAND_TYPES = ['기본', '이미지', '와이드', '캐러셀', '브랜드']

/** "1,234원" → 1234 — 아임웹은 쉼표와 '원'을 붙여서 준다 */
const toNumber = (value: string): number => {
  const digits = (value ?? '').replace(/[^0-9-]/g, '')
  return digits ? Number(digits) : 0
}

/** "2026-08-21 14:03" 같은 여러 모양을 받아준다 */
const toDate = (value: string): string | null => {
  const text = (value ?? '').trim().replace(/\./g, '-').replace(/-\s*$/, '')
  if (!text) return null
  const parsed = new Date(text.includes(':') ? text : `${text} 00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/** 따옴표 안의 쉼표를 지키면서 한 줄을 쪼갠다 */
function splitRow(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = !quoted
    } else if (ch === ',' && !quoted) {
      cells.push(cell)
      cell = ''
    } else cell += ch
  }
  cells.push(cell)
  return cells.map((c) => c.trim())
}

/** 머리글 이름이 조금씩 달라도 찾아준다 */
const findColumn = (headers: string[], ...names: string[]) =>
  headers.findIndex((h) => names.some((n) => h.replace(/\s/g, '').includes(n)))

function parseCsv(text: string): { rows: CampaignImportRow[]; skipped: number } {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
  if (lines.length < 2) return { rows: [], skipped: 0 }

  const headers = splitRow(lines[0])
  const at = {
    status: findColumn(headers, '상태'),
    sentAt: findColumn(headers, '발송일시', '발송일', '일시'),
    messageType: findColumn(headers, '메시지유형', '유형'),
    title: findColumn(headers, '제목'),
    target: findColumn(headers, '발송대상', '대상'),
    success: findColumn(headers, '발송성공', '성공'),
    visit: findColumn(headers, '유입전환', '유입'),
    purchase: findColumn(headers, '구매전환', '구매'),
  }

  const rows: CampaignImportRow[] = []
  let skipped = 0

  for (const line of lines.slice(1)) {
    const cells = splitRow(line)
    const pick = (index: number) => (index >= 0 ? (cells[index] ?? '') : '')

    const sentAt = toDate(pick(at.sentAt))
    const messageType = pick(at.messageType)
    // 발송 일시가 없으면 언제 것인지 알 수 없어 비교에 쓸 수 없다
    if (!sentAt) {
      skipped++
      continue
    }

    const channel: Channel = BRAND_TYPES.some((t) => messageType.includes(t))
      ? 'brand_message'
      : 'sms'

    rows.push({
      channel,
      status:
        STATUS_MAP[pick(at.status).replace(/\s/g, '')] ?? STATUS_MAP[pick(at.status)] ?? 'sent',
      sentAt,
      messageType,
      title: pick(at.title),
      targetCount: toNumber(pick(at.target)),
      successCount: toNumber(pick(at.success)),
      visitCount: toNumber(pick(at.visit)),
      purchaseAmount: toNumber(pick(at.purchase)),
    })
  }

  return { rows, skipped }
}

export default function CampaignImportDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const client = useQueryClient()
  const [rows, setRows] = useState<CampaignImportRow[]>([])
  const [skipped, setSkipped] = useState(0)
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')

  const save = useMutation({
    mutationFn: () => repository.importCampaigns(rows),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['campaigns'] })
      close()
    },
  })

  const close = () => {
    setRows([])
    setSkipped(0)
    setFileName('')
    setParseError('')
    onClose()
  }

  const read = async (file: File) => {
    setFileName(file.name)
    setParseError('')
    try {
      const parsed = parseCsv(await file.text())
      if (parsed.rows.length === 0) {
        setParseError('읽을 수 있는 줄이 없습니다. 발송 일시 칸이 있는지 확인해주세요.')
      }
      setRows(parsed.rows)
      setSkipped(parsed.skipped)
    } catch {
      setParseError('파일을 읽지 못했습니다. CSV 파일이 맞는지 확인해주세요.')
    }
  }

  const downloadTemplate = () =>
    downloadCsv('캠페인_업로드_양식', [
      {
        상태: '발송 완료',
        '발송 일시': '2026-08-21 14:03',
        '메시지 유형': 'LMS',
        제목: '브리보 재입고 안내',
        '발송 대상': 1200,
        '발송 성공': 1187,
        '유입 전환': 210,
        '구매 전환': '1,340,000원',
      },
    ])

  return (
    <Modal open={open} onClose={close} title="예전 캠페인 올리기" width="max-w-3xl">
      <div className="space-y-4">
        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
          아임웹은 발송 기록을 API로 주지 않습니다. 아임웹 관리자에서 발송 내역을 CSV로 내려받아
          그대로 올려주세요. <b>같은 채널·발송 일시·유형이면 덮어씁니다</b> — 두 번 올려도 늘지
          않습니다. 올린 캠페인은 <b>태깅 필요</b> 로 표시되니, 나중에 목적과 컨셉을 달아주세요.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-violet-300">
            CSV 파일 고르기
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) read(file)
              }}
            />
          </label>
          {fileName && <span className="text-xs text-slate-500">{fileName}</span>}
          <button
            type="button"
            onClick={downloadTemplate}
            className="ml-auto text-xs text-violet-600 underline"
          >
            양식 내려받기
          </button>
        </div>

        {parseError && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{parseError}</p>
        )}

        {rows.length > 0 && (
          <>
            <p className="text-sm text-slate-700">
              <b>{formatNumber(rows.length)}건</b>을 올립니다
              {skipped > 0 && (
                <span className="text-amber-700">
                  {' '}
                  · 발송 일시가 없어 건너뛴 줄 {formatNumber(skipped)}개
                </span>
              )}
            </p>

            <div className="max-h-[320px] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">채널</th>
                    <th className="px-3 py-2 text-left font-medium">상태</th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">발송 일시</th>
                    <th className="px-3 py-2 text-left font-medium">유형</th>
                    <th className="px-3 py-2 text-left font-medium">제목</th>
                    <th className="px-3 py-2 text-right font-medium">대상</th>
                    <th className="px-3 py-2 text-right font-medium">성공</th>
                    <th className="px-3 py-2 text-right font-medium">유입</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                      구매 전환
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.slice(0, 50).map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">
                        {CHANNEL_LABELS[row.channel]}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">
                        {CAMPAIGN_STATUS_LABELS[row.status]}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-500">
                        {formatDateTime(row.sentAt)}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-500">
                        {row.messageType}
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-1.5 text-slate-800">
                        {row.title}
                      </td>
                      <td className="tabular px-3 py-1.5 text-right text-slate-600">
                        {formatNumber(row.targetCount)}
                      </td>
                      <td className="tabular px-3 py-1.5 text-right text-slate-600">
                        {formatNumber(row.successCount)}
                      </td>
                      <td className="tabular px-3 py-1.5 text-right text-slate-600">
                        {formatNumber(row.visitCount)}
                      </td>
                      <td className="tabular px-3 py-1.5 text-right whitespace-nowrap text-slate-900">
                        {formatNumber(row.purchaseAmount)}원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length > 50 && (
              <p className="text-xs text-slate-400">
                앞 50건만 보여줍니다. 저장하면 {formatNumber(rows.length)}건 모두 올라갑니다.
              </p>
            )}
          </>
        )}

        {save.isError && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {(save.error as Error).message}
          </p>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={close}>
          닫기
        </Button>
        <Button onClick={() => save.mutate()} disabled={rows.length === 0 || save.isPending}>
          {save.isPending ? '올리는 중...' : `${formatNumber(rows.length)}건 저장`}
        </Button>
      </div>
    </Modal>
  )
}
