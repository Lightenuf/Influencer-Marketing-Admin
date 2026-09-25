import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useCurrentUser } from '@/auth/AuthProvider'
import { Button, Card, CardHeader, Field, Input, Modal, Select, Spinner } from '@/components/ui'
import { repository } from '@/data'
import {
  LMS_BYTE_LIMIT,
  SEND_CHANNELS,
  SEND_CHANNEL_LABELS,
  SMS_BYTE_LIMIT,
  UNIT_COST,
  buildAdBody,
  messageBytes,
  smsKindOf,
  type SendChannel,
} from '@/data/types'
import { useCustomerGroups } from '@/hooks/queries'
import { downloadCsv } from '@/utils/csv'
import { formatDateTime, formatNumber } from '@/utils/format'

/** 광고 문자 끝에 붙는 무료 수신거부 번호 */
const OPTOUT_NUMBER = '08012345678'

/** 광고 문자를 보내면 안 되는 시간 */
const isNight = () => {
  const hour = new Date().getHours()
  return hour >= 21 || hour < 8
}

export default function MessageSendPage() {
  const user = useCurrentUser()
  const client = useQueryClient()
  const { data: groups = [], isLoading } = useCustomerGroups()

  const [groupId, setGroupId] = useState('')
  const [channel, setChannel] = useState<SendChannel>('sms')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isAd, setIsAd] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const group = groups.find((g) => g.id === groupId)

  // 조건에 맞는 사람 중 실제로 보낼 수 있는 사람. 명단은 받지 않고 숫자만 본다.
  const targets = useQuery({
    queryKey: ['sendTargets', group?.conditions],
    queryFn: () => repository.listSendTargets(group!.conditions, 0),
    enabled: !!group,
  })

  const history = useQuery({
    queryKey: ['messageSends'],
    queryFn: () => repository.listMessageSends(),
  })

  const send = useMutation({
    mutationFn: () =>
      repository.sendMessage(
        {
          title: title.trim(),
          body: finalBody,
          channel,
          isAd,
          groupId: group?.id ?? null,
          groupName: group?.name ?? '',
          conditions: group!.conditions,
        },
        user.id,
      ),
    onSuccess: () => {
      setConfirming(false)
      setBody('')
      setTitle('')
      client.invalidateQueries({ queryKey: ['messageSends'] })
    },
  })

  if (isLoading) return <Spinner />

  // 광고 문구는 법으로 붙여야 하는 것이라, 사람이 잊지 않게 자동으로 붙인다
  const finalBody = isAd && body.trim() ? buildAdBody(body, OPTOUT_NUMBER) : body
  const bytes = messageBytes(finalBody)
  const kind = smsKindOf(finalBody)
  const limit = kind === 'SMS' ? SMS_BYTE_LIMIT : LMS_BYTE_LIMIT
  const unit = channel === 'alimtalk' ? UNIT_COST.alimtalk : UNIT_COST[kind]
  const sendable = targets.data?.sendable ?? 0
  const cost = sendable * unit

  const blocked =
    !group ||
    !body.trim() ||
    sendable === 0 ||
    bytes > LMS_BYTE_LIMIT ||
    (isAd && isNight()) ||
    send.isPending

  const exportTargets = async () => {
    if (!group) return
    const all = await repository.listSendTargets(group.conditions, 100_000)
    downloadCsv(
      `발송대상_${group.name}`,
      all.rows.map((row) => ({ 이름: row.name, 연락처: row.callnum })),
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">문자·푸시 전송</h1>
        <p className="mt-1 text-sm text-slate-500">
          고객 행동 관리에서 만든 고객군에게 바로 보냅니다. 번호가 없거나 수신거부하신 분은 자동으로
          빠집니다.
        </p>
      </div>

      <Card>
        <CardHeader title="1. 누구에게" description="고객 행동 관리에서 만든 고객군을 고릅니다" />
        <div className="space-y-4 p-5">
          <Field label="고객군">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">선택하지 않음</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>

          {group && targets.isLoading && <Spinner label="대상을 세는 중..." />}

          {group && targets.data && (
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="조건에 맞는 분" value={targets.data.total} tone="muted" />
              <Stat label="보낼 수 있는 분" value={targets.data.sendable} tone="strong" />
              <Stat label="번호 없음" value={targets.data.noNumber} tone="muted" />
              <Stat label="수신거부" value={targets.data.optedOut} tone="muted" />
            </div>
          )}

          {group && targets.data && targets.data.sendable > 0 && (
            <Button size="sm" variant="secondary" onClick={exportTargets}>
              대상 명단 내려받기
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="2. 무엇을" description="90바이트를 넘으면 LMS가 되어 요금이 오릅니다" />
        <div className="space-y-4 p-5">
          <Field label="보내는 방법">
            <Select value={channel} onChange={(e) => setChannel(e.target.value as SendChannel)}>
              {SEND_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {SEND_CHANNEL_LABELS[c]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="제목" hint="LMS로 나갈 때만 쓰입니다">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 브리보 재입고 안내"
              maxLength={20}
            />
          </Field>

          <div>
            <div className="flex items-end justify-between">
              <p className="text-sm font-medium text-slate-700">보낼 내용</p>
              <p className={`text-xs ${bytes > limit ? 'text-rose-600' : 'text-slate-400'}`}>
                {formatNumber(bytes)} / {formatNumber(limit)} 바이트 · {kind}
              </p>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="보낼 내용을 쓰세요"
              className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isAd}
              onChange={(e) => setIsAd(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              광고성 메시지입니다
              <span className="mt-0.5 block text-xs text-slate-500">
                켜면 앞에 <b>(광고)</b>, 끝에 <b>무료수신거부 {OPTOUT_NUMBER}</b> 가 자동으로
                붙습니다. 법으로 정해진 것이라 빼면 과태료 대상입니다.
              </span>
            </span>
          </label>

          {isAd && isNight() && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">
              지금은 광고 문자를 보낼 수 없는 시간입니다 (밤 9시 ~ 아침 8시). 낮에 다시
              시도해주세요.
            </p>
          )}

          {finalBody.trim() && (
            <div>
              <p className="text-sm font-medium text-slate-700">고객에게 보이는 모습</p>
              <pre className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2.5 text-sm break-words whitespace-pre-wrap text-slate-800">
                {finalBody}
              </pre>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="3. 보내기" description="보내고 나면 되돌릴 수 없습니다" />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="text-sm text-slate-600">
            {group ? (
              <>
                <b className="text-slate-900">{formatNumber(sendable)}명</b>에게 {kind} 발송 · 예상
                비용{' '}
                <b className="text-slate-900">
                  {formatNumber(cost)}원 ({formatNumber(unit)}원 × {formatNumber(sendable)})
                </b>
              </>
            ) : (
              '고객군을 먼저 고르세요'
            )}
          </div>
          <Button onClick={() => setConfirming(true)} disabled={blocked}>
            {send.isPending ? '보내는 중...' : '보내기'}
          </Button>
        </div>

        {send.isError && (
          <p className="mx-5 mb-5 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">
            {(send.error as Error).message}
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="보낸 기록" description="누구에게 무엇을 언제 보냈는지 남습니다" />
        {history.data && history.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">보낸 때</th>
                  <th className="px-3 py-2.5 text-left font-medium">고객군</th>
                  <th className="px-3 py-2.5 text-left font-medium">내용</th>
                  <th className="px-3 py-2.5 text-right font-medium">보냄</th>
                  <th className="px-3 py-2.5 text-right font-medium">실패</th>
                  <th className="px-5 py-2.5 text-right font-medium">비용</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.data.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-xs whitespace-nowrap text-slate-500">
                      {formatDateTime(row.sentAt ?? row.createdAt)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-700">
                      {row.groupName || '-'}
                    </td>
                    <td className="max-w-xs truncate px-3 py-3 text-slate-600">{row.body}</td>
                    <td className="tabular px-3 py-3 text-right text-slate-900">
                      {formatNumber(row.sentCount)}
                    </td>
                    <td className="tabular px-3 py-3 text-right text-slate-500">
                      {row.failedCount ? (
                        <span className="text-rose-600">{formatNumber(row.failedCount)}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="tabular px-5 py-3 text-right text-slate-600">
                      {formatNumber(row.costWon)}원
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-slate-400">아직 보낸 기록이 없습니다</p>
        )}
      </Card>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="정말 보낼까요?"
        width="max-w-md"
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            <b className="text-slate-900">{group?.name}</b> 고객군의{' '}
            <b className="text-slate-900">{formatNumber(sendable)}명</b>에게 지금 보냅니다. 보내고
            나면 취소할 수 없습니다.
          </p>
          <pre className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs break-words whitespace-pre-wrap text-slate-700">
            {finalBody}
          </pre>
          <p className="text-xs text-slate-500">
            예상 비용 <b className="text-slate-700">{formatNumber(cost)}원</b> · {kind}
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            아니요
          </Button>
          <Button onClick={() => send.mutate()} disabled={send.isPending}>
            {send.isPending ? '보내는 중...' : '보냅니다'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'strong' | 'muted' }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-0.5 text-xl font-bold ${tone === 'strong' ? 'text-violet-600' : 'text-slate-700'}`}
      >
        {formatNumber(value)}명
      </p>
    </div>
  )
}
