import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/auth/AuthProvider'
import { Button, Card, CardHeader, Field, Input, Modal, Select, Spinner } from '@/components/ui'
import { repository } from '@/data'
import {
  CHANNELS,
  CHANNEL_LABELS,
  LMS_BYTE_LIMIT,
  MESSAGE_TYPES,
  SMS_BYTE_LIMIT,
  TARGET_MODES,
  TARGET_MODE_LABELS,
  UNIT_COST,
  buildAdBody,
  emptyConditions,
  formatPhone,
  isSendableNumber,
  messageBytes,
  parseNumbers,
  smsKindOf,
  type Channel,
  type TargetMode,
} from '@/data/types'
import { useCustomerGroups } from '@/hooks/queries'
import { daysSince, formatNumber } from '@/utils/format'

/** 광고 문자 끝에 붙는 무료 수신거부 번호 */
const OPTOUT_NUMBER = '08012345678'

/** 광고 문자를 보내면 안 되는 시간 */
const isNight = () => {
  const hour = new Date().getHours()
  return hour >= 21 || hour < 8
}

export default function CampaignSendPage() {
  const user = useCurrentUser()
  const client = useQueryClient()
  const navigate = useNavigate()
  const { data: groups = [], isLoading } = useCustomerGroups()

  const [targetMode, setTargetMode] = useState<TargetMode>('segment')
  const [segmentId, setSegmentId] = useState('')
  const [numberText, setNumberText] = useState('')
  const [channel, setChannel] = useState<Channel>('sms')
  const [messageType, setMessageType] = useState('SMS')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isAd, setIsAd] = useState(false)

  const [purpose, setPurpose] = useState('')
  const [concepts, setConcepts] = useState<string[]>([])
  const [offerType, setOfferType] = useState('없음')
  const [offerValue, setOfferValue] = useState('')
  const [hypothesis, setHypothesis] = useState('')

  const [confirming, setConfirming] = useState(false)
  // 테스트 번호는 매번 다시 치기 번거로우니 이 브라우저에 기억해 둔다
  const [testNumber, setTestNumber] = useState(
    () => localStorage.getItem('breevo:testNumber') ?? '',
  )

  const group = groups.find((g) => g.id === segmentId)

  // 붙여넣은 덩어리에서 번호를 뽑는다. 타자마다 다시 하지 않게 기억해 둔다.
  const parsed = useMemo(() => parseNumbers(numberText), [numberText])

  const options = useQuery({
    queryKey: ['campaignOptions'],
    queryFn: () => repository.listCampaignOptions(),
  })
  const campaigns = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => repository.listCampaigns(),
  })

  // 조건에 맞는 사람 중 실제로 보낼 수 있는 사람. 명단은 받지 않고 숫자만 본다.
  const targets = useQuery({
    queryKey: ['sendTargets', targetMode, group?.conditions, parsed.valid],
    queryFn: () =>
      targetMode === 'numbers'
        ? repository.checkSendNumbers(parsed.valid)
        : repository.listSendTargets(group!.conditions, 0),
    enabled: targetMode === 'numbers' ? parsed.valid.length > 0 : !!group,
  })

  const send = useMutation({
    mutationFn: (draftOnly: boolean) =>
      repository.sendCampaign(
        {
          title: title.trim(),
          messageBody: finalBody,
          channel,
          messageType: channel === 'sms' ? smsKindOf(finalBody) : messageType,
          isAd,
          targetMode,
          segmentId: targetMode === 'segment' ? (group?.id ?? null) : null,
          segmentName: targetMode === 'segment' ? (group?.name ?? '') : '직접 입력한 번호',
          conditions: group?.conditions ?? emptyConditions(),
          numbers: targetMode === 'numbers' ? parsed.valid : [],
          purpose,
          concepts,
          offerType,
          offerValue: offerValue.trim(),
          hypothesis: hypothesis.trim(),
          draftOnly,
        },
        user.id,
      ),
    onSuccess: (made) => {
      setConfirming(false)
      client.invalidateQueries({ queryKey: ['campaigns'] })
      navigate(`/crm/campaigns/${made.id}`)
    },
  })

  const test = useMutation({
    mutationFn: () => {
      localStorage.setItem('breevo:testNumber', testNumber)
      return repository.sendTestMessage({
        title: title.trim(),
        messageBody: finalBody,
        channel,
        messageType: kind,
        number: testNumber,
      })
    },
  })

  if (isLoading) return <Spinner />

  const purposes = (options.data ?? []).filter((o) => o.kind === 'purpose')
  const conceptOptions = (options.data ?? []).filter((o) => o.kind === 'concept')
  const offerTypes = (options.data ?? []).filter((o) => o.kind === 'offer_type')

  // 광고 문구는 법으로 붙여야 하는 것이라, 사람이 잊지 않게 자동으로 붙인다
  const finalBody = isAd && body.trim() ? buildAdBody(body, OPTOUT_NUMBER) : body
  const bytes = messageBytes(finalBody)
  const kind = channel === 'sms' ? smsKindOf(finalBody) : messageType
  const limit = kind === 'SMS' ? SMS_BYTE_LIMIT : LMS_BYTE_LIMIT
  const unit = channel === 'brand_message' ? UNIT_COST.brand_message : (UNIT_COST[kind] ?? 20)
  const sendable = targets.data?.sendable ?? 0
  const cost = sendable * unit

  // 이 고객군에 얼마나 자주 보냈는지 — 너무 자주 보내면 수신거부가 는다
  const groupSends = (campaigns.data ?? []).filter(
    (c) => c.segmentId === segmentId && c.sentAt && c.status === 'sent',
  )
  const lastSentAt = groupSends[0]?.sentAt ?? null
  const monthAgo = Date.now() - 30 * 86_400_000
  const recentCount = groupSends.filter((c) => new Date(c.sentAt!).getTime() >= monthAgo).length

  const missing: string[] = []
  if (targetMode === 'segment' && !group) missing.push('고객군')
  if (targetMode === 'numbers' && parsed.valid.length === 0) missing.push('보낼 번호')
  if (!body.trim()) missing.push('보낼 내용')
  if (!purpose) missing.push('목적')
  if (concepts.length === 0) missing.push('컨셉')

  const blocked =
    missing.length > 0 ||
    sendable === 0 ||
    bytes > LMS_BYTE_LIMIT ||
    send.isPending ||
    (isAd && isNight())

  const toggleConcept = (label: string) =>
    setConcepts((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label],
    )

  return (
    <div className="space-y-4">
      <div>
        <button
          type="button"
          onClick={() => navigate('/crm/campaigns')}
          className="text-sm text-slate-500 hover:text-violet-600"
        >
          ← 캠페인 관리
        </button>
        <h1 className="mt-1 text-xl font-bold text-slate-900">새 캠페인 보내기</h1>
        <p className="mt-1 text-sm text-slate-500">
          번호가 없거나 수신거부하신 분은 자동으로 빠집니다.
        </p>
      </div>

      <Card>
        <CardHeader
          title="1. 누구에게"
          description="고객군으로 보내거나, 번호를 직접 넣어 보냅니다"
        />
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-4">
            {TARGET_MODES.map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="targetMode"
                  checked={targetMode === mode}
                  onChange={() => setTargetMode(mode)}
                />
                {TARGET_MODE_LABELS[mode]}
              </label>
            ))}
          </div>

          {targetMode === 'segment' ? (
            <Field label="고객군">
              <Select value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
                <option value="">선택하지 않음</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">보낼 번호</p>
                <p className="text-xs text-slate-400">
                  줄바꿈·쉼표·공백 아무거나로 나눠도 됩니다. 엑셀에서 복사해 붙여넣으세요.
                </p>
              </div>
              <textarea
                value={numberText}
                onChange={(e) => setNumberText(e.target.value)}
                rows={6}
                placeholder={'010-1234-5678\n01098765432\n010 2222 3333'}
                className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-violet-400"
              />

              {numberText.trim() && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className="text-slate-600">
                    번호 <b className="text-slate-900">{formatNumber(parsed.valid.length)}개</b>
                  </span>
                  {parsed.duplicates > 0 && (
                    <span className="text-slate-500">
                      같은 번호 {formatNumber(parsed.duplicates)}개는 하나로 묶었습니다
                    </span>
                  )}
                  {parsed.invalid.length > 0 && (
                    <span className="text-rose-600">
                      문자를 보낼 수 없는 것 {formatNumber(parsed.invalid.length)}개 —{' '}
                      {parsed.invalid.slice(0, 3).join(', ')}
                      {parsed.invalid.length > 3 && ' ...'}
                    </span>
                  )}
                  {parsed.valid.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setNumberText(parsed.valid.map(formatPhone).join('\n'))}
                      className="text-violet-600 underline"
                    >
                      정리해서 다시 넣기
                    </button>
                  )}
                </div>
              )}

              <p className="mt-2 text-xs text-slate-500">
                휴대폰 번호만 받습니다. 유선번호로는 문자가 가지 않습니다. 수신거부하신 분은
                아래에서 자동으로 빠집니다.
              </p>
            </div>
          )}

          {targets.isLoading && <Spinner label="대상을 세는 중..." />}

          {targets.data && (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat
                  label={targetMode === 'numbers' ? '넣은 번호' : '조건에 맞는 분'}
                  value={`${formatNumber(targets.data.total)}${targetMode === 'numbers' ? '개' : '명'}`}
                />
                <Stat
                  label="보낼 수 있는 분"
                  value={`${formatNumber(targets.data.sendable)}명`}
                  strong
                />
                <Stat label="번호 없음" value={`${formatNumber(targets.data.noNumber)}명`} />
                <Stat
                  label="수신거부"
                  value={`${formatNumber(targets.data.optedOut)}명`}
                  warn={targets.data.optedOut > 0}
                />
              </div>

              {targetMode === 'segment' && group && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Stat
                    label="이 고객군에 마지막 발송 후"
                    value={lastSentAt ? `${daysSince(lastSentAt)}일 전` : '보낸 적 없음'}
                  />
                  <Stat
                    label="최근 30일 발송 횟수"
                    value={`${formatNumber(recentCount)}회`}
                    warn={recentCount >= 4}
                  />
                </div>
              )}

              {targetMode === 'segment' && recentCount >= 4 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                  최근 30일에 벌써 {recentCount}번 보냈습니다. 너무 자주 보내면 수신거부가 늘어
                  나중에 보낼 대상이 줄어듭니다.
                </p>
              )}
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="2. 무엇을" description="90바이트를 넘으면 LMS가 되어 요금이 오릅니다" />
        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="보내는 방법">
              <Select
                value={channel}
                onChange={(e) => {
                  const next = e.target.value as Channel
                  setChannel(next)
                  setMessageType(MESSAGE_TYPES[next][0])
                }}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_LABELS[c]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="메시지 유형"
              hint={channel === 'sms' ? '글자 수에 따라 자동으로 정해집니다' : undefined}
            >
              {channel === 'sms' ? (
                <Input value={kind} readOnly className="bg-slate-50 text-slate-500" />
              ) : (
                <Select value={messageType} onChange={(e) => setMessageType(e.target.value)}>
                  {MESSAGE_TYPES[channel].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

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
              지금은 광고 문자를 보낼 수 없는 시간입니다 (밤 9시 ~ 아침 8시).
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
        <CardHeader
          title="3. 왜 보내나요"
          description="나중에 '무엇이 반응이 좋았나'를 비교하려면 이게 있어야 합니다"
        />
        <div className="space-y-5 p-5">
          <div>
            <p className="text-sm font-medium text-slate-700">
              목적 <span className="text-rose-500">*</span>
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {purposes.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  on={purpose === option.label}
                  onClick={() => setPurpose(purpose === option.label ? '' : option.label)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">
              컨셉 <span className="text-rose-500">*</span>
              <span className="ml-1.5 text-xs font-normal text-slate-400">
                여러 개 고를 수 있습니다
              </span>
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {conceptOptions.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  on={concepts.includes(option.label)}
                  onClick={() => toggleConcept(option.label)}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="오퍼 유형">
              <Select value={offerType} onChange={(e) => setOfferType(e.target.value)}>
                {offerTypes.map((option) => (
                  <option key={option.id} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="오퍼 값" hint="예) 15, 3000원, 2개 구매 시">
              <Input
                value={offerValue}
                onChange={(e) => setOfferValue(e.target.value)}
                disabled={offerType === '없음'}
                placeholder={offerType === '없음' ? '오퍼 유형을 먼저 고르세요' : '예) 15'}
              />
            </Field>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">가설</p>
            <p className="text-xs text-slate-500">
              무엇을 기대하고 보내는지 적어두면, 결과를 보고 배울 수 있습니다
            </p>
            <textarea
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              rows={2}
              placeholder="예) 구매 40일 지난 분들은 다 떨어질 때라 재구매 안내에 반응할 것이다"
              className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="4. 테스트 발송"
          description="내 번호로 먼저 보내 실제로 어떻게 보이는지 확인하세요"
        />
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <Field label="테스트로 받을 번호">
                <Input
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                  placeholder="010-0000-0000"
                />
              </Field>
            </div>
            <Button
              variant="secondary"
              onClick={() => test.mutate()}
              disabled={!isSendableNumber(testNumber) || !body.trim() || test.isPending}
            >
              {test.isPending ? '보내는 중...' : '테스트 발송'}
            </Button>
          </div>

          {test.isSuccess && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {formatPhone(testNumber)} 로 보냈습니다. 휴대폰에서 확인해보세요.
            </p>
          )}
          {test.isError && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {(test.error as Error).message}
            </p>
          )}

          <p className="text-xs text-slate-500">
            테스트도 실제로 문자가 나가고 요금이 듭니다({formatNumber(unit)}원). 캠페인 기록에는
            남지 않습니다 — 테스트가 성과 비교에 섞이면 안 되기 때문입니다.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="5. 보내기" description="보내고 나면 되돌릴 수 없습니다" />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="text-sm text-slate-600">
            {missing.length > 0 ? (
              <span className="text-amber-700">
                아직 비어 있습니다 — <b>{missing.join(' · ')}</b>
              </span>
            ) : (
              <>
                <b className="text-slate-900">{formatNumber(sendable)}명</b>에게 {kind} 발송 · 예상
                비용{' '}
                <b className="text-slate-900">
                  {formatNumber(cost)}원 ({formatNumber(unit)}원 × {formatNumber(sendable)})
                </b>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => send.mutate(true)} disabled={send.isPending}>
              임시저장
            </Button>
            <Button onClick={() => setConfirming(true)} disabled={blocked}>
              {send.isPending ? '보내는 중...' : '보내기'}
            </Button>
          </div>
        </div>

        {send.isError && (
          <p className="mx-5 mb-5 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">
            {(send.error as Error).message}
          </p>
        )}
      </Card>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="정말 보낼까요?"
        width="max-w-lg"
      >
        <div className="space-y-3 text-sm">
          <Row label="누구에게">
            {targetMode === 'segment' ? group?.name : '직접 입력한 번호'} ·{' '}
            <b className="text-slate-900">{formatNumber(sendable)}명</b>
          </Row>
          <Row label="무엇을">
            {CHANNEL_LABELS[channel]} · {kind} · {formatNumber(bytes)}바이트
          </Row>
          <Row label="왜">
            {purpose} · {concepts.join(', ')}
            {offerType !== '없음' && ` · ${offerType} ${offerValue}`}
          </Row>
          <pre className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs break-words whitespace-pre-wrap text-slate-700">
            {finalBody}
          </pre>
          <p className="text-xs text-slate-500">
            예상 비용 <b className="text-slate-700">{formatNumber(cost)}원</b>
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            아니요
          </Button>
          <Button onClick={() => send.mutate(false)} disabled={send.isPending}>
            {send.isPending ? '보내는 중...' : '보냅니다'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-20 shrink-0 text-slate-400">{label}</span>
      <span className="text-slate-700">{children}</span>
    </div>
  )
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
        on
          ? 'border-violet-500 bg-violet-500 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
      }`}
    >
      {label}
    </button>
  )
}

function Stat({
  label,
  value,
  strong,
  warn,
}: {
  label: string
  value: string
  strong?: boolean
  warn?: boolean
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-0.5 text-lg font-bold ${
          warn ? 'text-amber-600' : strong ? 'text-violet-600' : 'text-slate-700'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
