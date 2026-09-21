import { useMemo, useState } from 'react'
import { useCurrentUser } from '@/auth/AuthProvider'
import { Button, Card, CardHeader, Field, Input, Select, Spinner, Textarea } from '@/components/ui'
import { isMetaMockMode } from '@/data'
import {
  DEFAULT_CTA,
  DEFAULT_LANDING_URL,
  DEFAULT_OBJECTIVE,
  DEFAULT_TARGETING,
  FAVORITE_CTAS,
  META_CTAS,
  META_OBJECTIVES,
  PLACEMENT_LABELS,
  RECENT_BUYER_EXCLUSION_DAYS,
  ctaLabel,
  guessRecentBuyerAudience,
  slotOfRatio,
  type MetaCta,
  type MetaObjective,
  type PlacementSlot,
} from '@/data/metaTypes'
import {
  useCreateAd,
  useCreateAdSet,
  useCreateCampaign,
  useCreateUploadPreset,
  useDeleteUploadPreset,
  useMetaAdSets,
  useMetaCampaigns,
  useMetaCustomAudiences,
  useUploadCreative,
  useUploadPresets,
} from '@/hooks/metaQueries'
import { formatNumber } from '@/utils/format'

type Stage = '대기' | '올리는 중' | '완료' | '실패'

interface Item {
  file: File
  /**
   * 광고 이름.
   * 이름이 같은 소재끼리 한 광고로 묶인다 — 1:1과 9:16을 함께 올릴 때를 위한 것.
   */
  name: string
  /** 피드용인지 스토리용인지. 파일 비율을 보고 정하고, 손으로 바꿀 수 있다. */
  slot: PlacementSlot
  /** '1080×1080' 처럼 보여줄 크기 */
  size: string
  stage: Stage
  message: string
}

/** 확장자만 뗀 파일 이름 */
const niceName = (fileName: string) => fileName.replace(/\.[^.]+$/, '').trim()

/**
 * 같은 광고의 다른 비율은 보통 이름 뒤에 꼬리표만 붙는다.
 * ('인스타 피드_3' 과 '인스타 피드_3-1')
 * 그래서 다른 이름의 앞부분인 이름이 있으면 짧은 쪽으로 맞춰 한 광고로 묶는다.
 * 숫자만 이어 붙은 다른 소재('..._3' 과 '..._30')가 섞이지 않도록,
 * 꼬리표가 구분자(- _ 공백 괄호)로 시작할 때만 같은 것으로 본다.
 */
function mergeNames(names: string[]): string[] {
  const unique = [...new Set(names)].sort((a, b) => a.length - b.length)
  return names.map((name) => {
    const shorter = unique.find(
      (candidate) =>
        candidate.length < name.length &&
        name.startsWith(candidate) &&
        /^[-_ (]/.test(name.slice(candidate.length)),
    )
    return shorter ?? name
  })
}

/** 이미지·영상의 실제 크기를 읽는다 — 비율로 놓일 자리를 정하기 위함 */
function readSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const done = (width: number, height: number) => {
      URL.revokeObjectURL(url)
      resolve({ width, height })
    }
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video')
      video.onloadedmetadata = () => done(video.videoWidth, video.videoHeight)
      video.onerror = () => done(0, 0)
      video.src = url
    } else {
      const image = new Image()
      image.onload = () => done(image.naturalWidth, image.naturalHeight)
      image.onerror = () => done(0, 0)
      image.src = url
    }
  })
}

const stageTone: Record<Stage, string> = {
  대기: 'bg-slate-100 text-slate-500',
  '올리는 중': 'bg-amber-100 text-amber-700',
  완료: 'bg-emerald-100 text-emerald-700',
  실패: 'bg-rose-100 text-rose-700',
}

export default function CreativeUploadPage() {
  const user = useCurrentUser()

  const { data: campaigns = [] } = useMetaCampaigns()
  const { data: adsets = [], isLoading } = useMetaAdSets()
  const { data: audiences = [] } = useMetaCustomAudiences()
  const { data: presets = [] } = useUploadPresets()

  const uploadCreative = useUploadCreative()
  const createAd = useCreateAd()
  const createCampaign = useCreateCampaign()
  const createAdSet = useCreateAdSet()
  const savePreset = useCreateUploadPreset(user.id)
  const removePreset = useDeleteUploadPreset()

  const [items, setItems] = useState<Item[]>([])
  const [objective, setObjective] = useState<MetaObjective>(DEFAULT_OBJECTIVE)
  const [adsetId, setAdsetId] = useState('')
  const [cta, setCta] = useState<MetaCta>(DEFAULT_CTA[DEFAULT_OBJECTIVE])
  const [extraCtas, setExtraCtas] = useState<MetaCta[]>([])
  const [landingUrl, setLandingUrl] = useState(DEFAULT_LANDING_URL)
  const [primaryText, setPrimaryText] = useState('')
  const [isPartnership, setIsPartnership] = useState(false)
  const [partnerInstagramId, setPartnerInstagramId] = useState('')
  const [running, setRunning] = useState(false)
  const [presetName, setPresetName] = useState('')

  // 새 광고 세트 만들기
  const [creatingSet, setCreatingSet] = useState(false)
  const [newSetName, setNewSetName] = useState('')
  const [newSetCampaign, setNewSetCampaign] = useState('')
  const [newSetBudget, setNewSetBudget] = useState('')
  const [excludeBuyers, setExcludeBuyers] = useState(true)
  const [newCampaignName, setNewCampaignName] = useState('')

  const ctaChoices = useMemo(
    () => [...new Set([...FAVORITE_CTAS, ...extraCtas, cta])],
    [extraCtas, cta],
  )

  const buyerAudience = useMemo(() => guessRecentBuyerAudience(audiences), [audiences])

  /**
   * 한 광고로 묶을 수 없는 조합을 미리 걸러낸다.
   * 메타는 노출 자리마다 소재를 하나씩만 받고, 영상과 이미지를 한 광고에 섞지 못한다.
   */
  const groupIssue = (group: { items: Array<{ item: Item }> }) => {
    if (group.items.length < 2) return null
    const slots = group.items.map(({ item }) => item.slot)
    if (new Set(slots).size !== slots.length) {
      return '같은 자리에 소재가 둘 이상입니다. 하나를 다른 자리로 바꾸거나, 이름을 다르게 해 따로 올리세요.'
    }
    const kinds = new Set(group.items.map(({ item }) => item.file.type.split('/')[0]))
    if (kinds.size > 1) return '영상과 이미지는 한 광고로 묶을 수 없습니다. 이름을 다르게 해주세요.'
    return null
  }

  /** 이름이 같은 소재는 한 광고가 된다 */
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: Array<{ item: Item; index: number }> }>()
    items.forEach((item, index) => {
      const key = item.name.trim() || `이름 없음 ${index + 1}`
      const group = map.get(key) ?? { name: key, items: [] }
      group.items.push({ item, index })
      map.set(key, group)
    })
    return [...map.values()]
  }, [items])

  const adsetLabel = (id: string) => {
    const adset = adsets.find((item) => item.id === id)
    if (!adset) return id
    const campaign = campaigns.find((item) => item.id === adset.campaignId)
    return campaign ? `${campaign.name} › ${adset.name}` : adset.name
  }

  const addFiles = async (files: FileList | null) => {
    if (!files) return
    const added = await Promise.all(
      [...files].map(async (file) => {
        const { width, height } = await readSize(file)
        return {
          file,
          name: niceName(file.name),
          slot: slotOfRatio(width, height),
          size: width && height ? `${width}×${height}` : '',
          stage: '대기' as Stage,
          message: '',
        }
      }),
    )
    setItems((current) => {
      const next = [...current, ...added]
      const merged = mergeNames(next.map((item) => item.name))
      return next.map((item, index) => ({ ...item, name: merged[index] }))
    })
  }

  const patch = (index: number, change: Partial<Item>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...change } : item)))

  const blocked = groups.some((group) => groupIssue(group) !== null)

  const ready =
    items.some((item) => item.stage === '대기') &&
    adsetId !== '' &&
    landingUrl.trim() !== '' &&
    !blocked &&
    !running

  /**
   * 이름이 같은 소재는 한 광고로 묶어 올린다.
   * 광고는 한 건씩 차례로 만든다 — 한꺼번에 보내면 메타가 막는다.
   */
  const run = async () => {
    setRunning(true)

    for (const group of groups) {
      if (group.items.every(({ item }) => item.stage === '완료')) continue
      for (const { index } of group.items) patch(index, { stage: '올리는 중', message: '' })

      try {
        const creatives = []
        for (const { item } of group.items) {
          const ref = await uploadCreative.mutateAsync(item.file)
          creatives.push({ ref, slot: item.slot })
        }

        await createAd.mutateAsync({
          adsetId,
          name: group.name,
          primaryText,
          landingUrl: landingUrl.trim(),
          cta,
          creatives,
          isPartnership,
          partnerInstagramId: isPartnership ? partnerInstagramId.trim() : undefined,
        })

        const where =
          creatives.length > 1
            ? `소재 ${creatives.length}개를 한 광고로 묶었습니다`
            : '일시중지 상태로 만들어졌습니다'
        for (const { index } of group.items) patch(index, { stage: '완료', message: where })
      } catch (error) {
        const message = error instanceof Error ? error.message : '알 수 없는 오류'
        for (const { index } of group.items) patch(index, { stage: '실패', message })
      }
    }

    setRunning(false)
  }

  const applyPreset = (id: string) => {
    const preset = presets.find((item) => item.id === id)
    if (!preset) return
    setObjective(preset.objective)
    setCta(preset.cta)
    setLandingUrl(preset.landingUrl)
    setPrimaryText(preset.primaryText)
    setIsPartnership(preset.isPartnership)
    if (preset.adsetId) setAdsetId(preset.adsetId)
  }

  const makeAdSet = async () => {
    let campaignId = newSetCampaign
    if (campaignId === 'new') {
      const made = await createCampaign.mutateAsync({
        name: newCampaignName.trim() || `${newSetName} 캠페인`,
        objective,
        dailyBudget: null,
      })
      campaignId = made.id
    }
    const made = await createAdSet.mutateAsync({
      campaignId,
      name: newSetName.trim(),
      dailyBudget: Number(newSetBudget.replace(/[^\d]/g, '')) || null,
      ageMin: DEFAULT_TARGETING.ageMin,
      ageMax: DEFAULT_TARGETING.ageMax,
      genders: DEFAULT_TARGETING.genders,
      excludedAudienceIds: excludeBuyers && buyerAudience ? [buyerAudience.id] : [],
    })
    setAdsetId(made.id)
    setCreatingSet(false)
  }

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">소재 업로드</h1>
          <p className="mt-1 text-sm text-slate-500">
            영상·이미지를 올려 광고를 만듭니다. 만들어진 광고는 <b>일시중지 상태</b>로 들어가니,
            확인한 뒤 광고 관리에서 켜세요.
          </p>
        </div>
        {isMetaMockMode && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
            예시 모드 — 실제로 올라가지 않습니다
          </span>
        )}
      </div>

      {presets.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">저장해 둔 설정</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <span
                key={preset.id}
                className="inline-flex items-center gap-1 rounded-full bg-violet-50 py-1 pr-1 pl-3 text-sm text-violet-700"
              >
                <button type="button" onClick={() => applyPreset(preset.id)}>
                  {preset.name}
                </button>
                <button
                  type="button"
                  title="지우기"
                  onClick={() => removePreset.mutate(preset.id)}
                  className="px-1 text-violet-300 hover:text-rose-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="1. 소재 고르기" description="여러 개를 한 번에 골라도 됩니다" />
        <div className="space-y-3 p-5">
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(e) => addFiles(e.target.files)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-violet-700"
          />

          {groups.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                이름이 같은 소재는 <b>광고 하나</b>로 묶여, 노출 자리마다 골라 쓰입니다. 자리는 한
                광고 안에서 겹칠 수 없습니다 — 1:1과 9:16이면 피드·스토리로, 1:1과 4:5처럼 둘 다
                피드용이면 페이스북 피드·인스타 피드로 갈라주세요.
              </p>

              {groups.map((group) => (
                <div key={group.name} className="rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <span className="text-xs text-slate-400">광고</span>
                    <span className="text-sm font-medium text-slate-800">{group.name}</span>
                    {group.items.length > 1 && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                        소재 {group.items.length}개 묶음
                      </span>
                    )}
                  </div>

                  {groupIssue(group) && (
                    <p className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {groupIssue(group)}
                    </p>
                  )}

                  <div className="divide-y divide-slate-100">
                    {group.items.map(({ item, index }) => (
                      <div key={index} className="flex items-center gap-2 p-2.5">
                        <span className="w-10 shrink-0 text-center text-xs text-slate-400">
                          {item.file.type.startsWith('video/') ? '영상' : '이미지'}
                        </span>
                        <Input
                          value={item.name}
                          onChange={(e) => patch(index, { name: e.target.value })}
                          className="py-1 text-sm"
                          placeholder="광고 이름"
                        />
                        <div className="w-32 shrink-0">
                          <Select
                            value={item.slot}
                            onChange={(e) =>
                              patch(index, { slot: e.target.value as PlacementSlot })
                            }
                            className="py-1 text-xs"
                          >
                            {(Object.keys(PLACEMENT_LABELS) as PlacementSlot[]).map((slot) => (
                              <option key={slot} value={slot}>
                                {PLACEMENT_LABELS[slot]}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <span className="w-28 shrink-0 text-right text-xs whitespace-nowrap text-slate-400">
                          {item.size || `${formatNumber(Math.round(item.file.size / 1024))}KB`}
                        </span>
                        <span
                          className={`w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-medium ${stageTone[item.stage]}`}
                        >
                          {item.stage}
                        </span>
                        <button
                          type="button"
                          disabled={running}
                          onClick={() =>
                            setItems((current) => current.filter((_, i) => i !== index))
                          }
                          className="px-1 text-slate-300 hover:text-rose-500 disabled:opacity-40"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {groups.some((group) => group.items[0].item.message) && (
            <div className="space-y-1">
              {groups
                .filter((group) => group.items[0].item.message)
                .map((group) => (
                  <p
                    key={group.name}
                    className={
                      group.items[0].item.stage === '실패'
                        ? 'text-xs text-rose-600'
                        : 'text-xs text-emerald-600'
                    }
                  >
                    {group.name} — {group.items[0].item.message}
                  </p>
                ))}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="2. 어디에 붙일지"
          description="기존 광고 세트에 붙이거나, 새로 만들어 붙입니다"
        />
        <div className="space-y-4 p-5">
          {!creatingSet ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="광고 세트">
                  <Select value={adsetId} onChange={(e) => setAdsetId(e.target.value)}>
                    <option value="">고르세요</option>
                    {adsets.map((adset) => (
                      <option key={adset.id} value={adset.id}>
                        {adsetLabel(adset.id)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="pb-0.5">
                <Button variant="secondary" onClick={() => setCreatingSet(true)}>
                  새로 만들기
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">새 광고 세트</p>
                <button
                  type="button"
                  onClick={() => setCreatingSet(false)}
                  className="text-xs text-slate-500 hover:text-violet-600"
                >
                  기존 것에서 고르기
                </button>
              </div>

              <Field label="캠페인">
                <Select value={newSetCampaign} onChange={(e) => setNewSetCampaign(e.target.value)}>
                  <option value="">고르세요</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                      {campaign.isCbo ? ' (예산은 캠페인에서)' : ''}
                    </option>
                  ))}
                  <option value="new">+ 새 캠페인 만들기</option>
                </Select>
              </Field>

              {newSetCampaign === 'new' && (
                <Field label="새 캠페인 이름">
                  <Input
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    placeholder="예) CV_신규획득_1010"
                  />
                </Field>
              )}

              <Field label="광고 세트 이름">
                <Input
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="예) 광범위_20-45"
                />
              </Field>

              <Field
                label="하루 예산 (원)"
                hint="캠페인 예산 최적화(CBO)를 쓰는 캠페인이면 비워 두세요"
              >
                <Input
                  inputMode="numeric"
                  value={newSetBudget}
                  onChange={(e) => setNewSetBudget(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="예) 50000"
                />
              </Field>

              <p className="text-xs text-slate-500">
                타겟은 연령·성별을 가르지 않습니다 (만 {DEFAULT_TARGETING.ageMin}세 이상 · 전체).
              </p>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={excludeBuyers}
                  onChange={(e) => setExcludeBuyers(e.target.checked)}
                  disabled={!buyerAudience}
                  className="h-4 w-4 accent-violet-600"
                />
                최근 {RECENT_BUYER_EXCLUSION_DAYS}일 안에 산 사람 빼기
                {buyerAudience ? (
                  <span className="text-xs text-slate-400">({buyerAudience.name})</span>
                ) : (
                  <span className="text-xs text-amber-600">
                    쓸 수 있는 맞춤 타겟을 찾지 못했습니다
                  </span>
                )}
              </label>

              <div className="flex justify-end">
                <Button
                  onClick={makeAdSet}
                  disabled={
                    !newSetName.trim() ||
                    !newSetCampaign ||
                    (newSetCampaign === 'new' && !newCampaignName.trim()) ||
                    createAdSet.isPending ||
                    createCampaign.isPending
                  }
                >
                  {createAdSet.isPending || createCampaign.isPending
                    ? '만드는 중...'
                    : '광고 세트 만들기'}
                </Button>
              </div>
            </div>
          )}

          {adsetId && !creatingSet && (
            <p className="text-xs text-slate-500">붙일 곳 — {adsetLabel(adsetId)}</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="3. 광고 내용" description="기본값이 채워져 있습니다" />
        <div className="space-y-4 p-5">
          <Field label="캠페인 목표">
            <Select
              value={objective}
              onChange={(e) => {
                const next = e.target.value as MetaObjective
                setObjective(next)
                setCta(DEFAULT_CTA[next])
              }}
            >
              {META_OBJECTIVES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} — {item.hint}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="광고 문구">
            <Textarea
              rows={3}
              value={primaryText}
              onChange={(e) => setPrimaryText(e.target.value)}
              placeholder="소재 위에 붙는 본문입니다"
            />
          </Field>

          <Field label="랜딩 주소">
            <Input value={landingUrl} onChange={(e) => setLandingUrl(e.target.value)} />
          </Field>

          <Field label="버튼">
            <div className="flex flex-wrap items-center gap-1.5">
              {ctaChoices.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCta(value)}
                  className={
                    cta === value
                      ? 'rounded-full bg-violet-600 px-3 py-1.5 text-sm font-medium text-white'
                      : 'rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50'
                  }
                >
                  {ctaLabel(value)}
                </button>
              ))}
              <Select
                value=""
                onChange={(e) => {
                  const value = e.target.value as MetaCta
                  if (!value) return
                  setExtraCtas((current) => [...new Set([...current, value])])
                  setCta(value)
                }}
                className="w-40 py-1.5 text-sm"
              >
                <option value="">다른 버튼 고르기</option>
                {META_CTAS.filter((item) => !ctaChoices.includes(item.value)).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </div>
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isPartnership}
              onChange={(e) => setIsPartnership(e.target.checked)}
              className="h-4 w-4 accent-violet-600"
            />
            파트너십 광고로 돌리기
          </label>

          {isPartnership && (
            <Field
              label="크리에이터 인스타그램 계정 ID"
              hint="계정 레벨 파트너십이 미리 연결돼 있어야 승인 없이 나갑니다"
            >
              <Input
                value={partnerInstagramId}
                onChange={(e) => setPartnerInstagramId(e.target.value)}
                placeholder="숫자로 된 계정 ID"
              />
            </Field>
          )}

          <div className="flex items-end gap-2 border-t border-slate-100 pt-4">
            <div className="flex-1">
              <Field label="이 설정 저장해 두기" hint="다음에 골라서 그대로 씁니다">
                <Input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="예) 파트너십 기본 · 신규획득 기본"
                />
              </Field>
            </div>
            <div className="pb-6">
              <Button
                variant="secondary"
                disabled={!presetName.trim() || savePreset.isPending}
                onClick={() =>
                  savePreset.mutate(
                    {
                      name: presetName.trim(),
                      objective,
                      adsetId: adsetId || null,
                      cta,
                      landingUrl,
                      primaryText,
                      isPartnership,
                    },
                    { onSuccess: () => setPresetName('') },
                  )
                }
              >
                저장
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3 pb-4">
        {items.length > 0 && (
          <span className="text-sm text-slate-500">
            소재 {items.filter((item) => item.stage === '완료').length} / {items.length} 완료
          </span>
        )}
        <Button onClick={run} disabled={!ready}>
          {running
            ? '올리는 중...'
            : `광고 ${formatNumber(
                groups.filter((group) => group.items.some(({ item }) => item.stage !== '완료'))
                  .length,
              )}개 만들기`}
        </Button>
      </div>
    </div>
  )
}
