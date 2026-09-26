import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Card, CardHeader, EmptyState, Spinner, linkButtonClass } from '@/components/ui'
import { repository } from '@/data'
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_LABELS,
  CHANNELS,
  CHANNEL_LABELS,
  needsTagging,
  successRate,
  type Campaign,
  type CampaignStatus,
  type Channel,
} from '@/data/types'
import { formatDateTime, formatNumber } from '@/utils/format'
import CampaignImportDialog from './CampaignImportDialog'
import CampaignOptionsDialog from './CampaignOptionsDialog'

/** 한 번에 보여줄 줄 수 */
const PAGE_SIZE = 20

/** 성공률이 이보다 낮으면 눈에 띄게 한다 — 번호가 죽었거나 문제가 있다는 뜻이다 */
const LOW_SUCCESS = 0.5

const STATUS_STYLE: Record<CampaignStatus, string> = {
  sent: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
  pending: 'bg-amber-100 text-amber-700',
  canceled: 'bg-slate-200 text-slate-600',
  draft: 'bg-slate-100 text-slate-500',
}

export default function CampaignsPage() {
  const [params, setParams] = useSearchParams()
  const [importing, setImporting] = useState(false)
  const [editingOptions, setEditingOptions] = useState(false)

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => repository.listCampaigns(),
  })

  const concept = params.get('concept') ?? ''
  const purpose = params.get('purpose') ?? ''

  if (isLoading) return <Spinner />

  // 대시보드에서 컨셉·목적을 눌러 들어오면 그것만 보여준다
  const filtered = campaigns.filter(
    (c) => (!concept || c.concepts.includes(concept)) && (!purpose || c.purpose === purpose),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">캠페인 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            어드민에서 보낸 것과 아임웹에서 보내고 올린 예전 기록을 함께 봅니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setEditingOptions(true)}>
            목적·컨셉 설정
          </Button>
          <Button variant="secondary" onClick={() => setImporting(true)}>
            CSV 업로드
          </Button>
          <Link to="/crm/campaigns/new" className={linkButtonClass}>
            + 새 캠페인 보내기
          </Link>
        </div>
      </div>

      {(concept || purpose) && (
        <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-4 py-2.5 text-sm text-violet-800">
          <span>
            <b>{concept || purpose}</b> 만 보고 있습니다 ({formatNumber(filtered.length)}건)
          </span>
          <button
            type="button"
            onClick={() => setParams({})}
            className="text-xs text-violet-600 underline"
          >
            전체 보기
          </button>
        </div>
      )}

      {CHANNELS.map((channel) => (
        <ChannelSection
          key={channel}
          channel={channel}
          campaigns={filtered.filter((c) => c.channel === channel)}
        />
      ))}

      <CampaignImportDialog open={importing} onClose={() => setImporting(false)} />
      <CampaignOptionsDialog open={editingOptions} onClose={() => setEditingOptions(false)} />
    </div>
  )
}

function ChannelSection({ channel, campaigns }: { channel: Channel; campaigns: Campaign[] }) {
  const [status, setStatus] = useState<CampaignStatus | 'all'>('all')
  const [page, setPage] = useState(0)

  const rows = campaigns.filter((c) => status === 'all' || c.status === status)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const shown = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const tabs: (CampaignStatus | 'all')[] = ['all', ...CAMPAIGN_STATUSES]

  return (
    <Card>
      <CardHeader
        title={`${CHANNEL_LABELS[channel]} 발송`}
        description={`${formatNumber(campaigns.length)}건`}
      />

      <div className="flex flex-wrap gap-1 border-b border-slate-100 px-5 pb-3">
        {tabs.map((tab) => {
          const count =
            tab === 'all' ? campaigns.length : campaigns.filter((c) => c.status === tab).length
          return (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setStatus(tab)
                setPage(0)
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                status === tab
                  ? 'bg-violet-100 font-medium text-violet-700'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {tab === 'all' ? '전체' : CAMPAIGN_STATUS_LABELS[tab]} {formatNumber(count)}
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title="해당하는 캠페인이 없습니다"
          description="새로 보내거나, 예전 기록을 CSV로 올려보세요."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">상태</th>
                  <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">발송 일시</th>
                  <th className="px-3 py-2.5 text-left font-medium">유형</th>
                  <th className="px-3 py-2.5 text-left font-medium">제목</th>
                  <th className="px-3 py-2.5 text-left font-medium">목적</th>
                  <th className="px-3 py-2.5 text-left font-medium">컨셉</th>
                  <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">대상</th>
                  <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">성공</th>
                  <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">성공률</th>
                  <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">유입</th>
                  <th className="px-5 py-2.5 text-right font-medium whitespace-nowrap">
                    구매 전환
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((c) => {
                  const rate = successRate(c)
                  const low = c.targetCount > 0 && rate < LOW_SUCCESS
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS_STYLE[c.status]}`}
                        >
                          {CAMPAIGN_STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap text-slate-500">
                        {c.sentAt ? formatDateTime(c.sentAt) : '-'}
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap text-slate-500">
                        {c.messageType || '-'}
                      </td>
                      <td className="max-w-[220px] px-3 py-3">
                        <Link
                          to={`/crm/campaigns/${c.id}`}
                          className="block truncate font-medium text-slate-900 hover:text-violet-600"
                        >
                          {c.title || c.messageBody.slice(0, 30) || '(제목 없음)'}
                        </Link>
                      </td>
                      {needsTagging(c) ? (
                        <td colSpan={2} className="px-3 py-3">
                          <Link
                            to={`/crm/campaigns/${c.id}`}
                            className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-amber-700 hover:bg-amber-200"
                          >
                            태깅 필요
                          </Link>
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-3 text-xs whitespace-nowrap text-slate-600">
                            {c.purpose || '-'}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            {c.concepts.join(', ') || '-'}
                          </td>
                        </>
                      )}
                      <td className="tabular px-3 py-3 text-right text-slate-600">
                        {formatNumber(c.targetCount)}
                      </td>
                      <td className="tabular px-3 py-3 text-right text-slate-900">
                        {formatNumber(c.successCount)}
                      </td>
                      <td
                        className={`tabular px-3 py-3 text-right ${low ? 'font-bold text-rose-600' : 'text-slate-600'}`}
                      >
                        {c.targetCount > 0 ? `${(rate * 100).toFixed(1)}%` : '-'}
                      </td>
                      <td className="tabular px-3 py-3 text-right text-slate-600">
                        {c.visitCount ? formatNumber(c.visitCount) : '-'}
                      </td>
                      <td className="tabular px-5 py-3 text-right whitespace-nowrap text-slate-900">
                        {c.purchaseAmount ? `${formatNumber(c.purchaseAmount)}원` : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                이전
              </Button>
              <span className="text-xs text-slate-500">
                {page + 1} / {pages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                disabled={page >= pages - 1}
              >
                다음
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
