import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toPng } from 'html-to-image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCurrentUser } from '@/auth/AuthProvider'
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
} from '@/components/ui'
import { studioRepository, type AdAsset, type AdCopy } from '@/data/studioRepository'
import { DEFAULT_OPS } from '@/data/adTypes'
import { useOpsSettings, useTagOptions } from '@/hooks/adTagQueries'
import { isBlocked, reviewCopy, type CopyFlag } from '@/utils/copyReview'
import { formatNumber } from '@/utils/format'
import CreativeUploadPage from './CreativeUploadPage'
import { RATIOS, TEMPLATES, ratioOf, templateOf, type RatioKey } from './studio/templates'

const TABS = [
  { key: 'assets', label: '에셋' },
  { key: 'copies', label: '카피' },
  { key: 'review', label: '조합·검수' },
  { key: 'upload', label: '업로드' },
] as const

type TabKey = (typeof TABS)[number]['key']

const PRODUCTS = ['사과', '복숭아', '레몬진저', '복수']
const SCENES = ['제품 단독', '라이프스타일', '인물']
const ORIGINS = ['힘스필드', '촬영', '기타']

export default function StudioPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey) ?? 'assets'

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">소재</h1>
        <p className="mt-1 text-sm text-slate-500">
          이미지는 힘스필드에서 만든 검수본만 씁니다. 어드민은 카피를 여러 벌 만들고 조합해
          올립니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setParams({ tab: item.key })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === item.key
                ? 'border-violet-500 font-medium text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'assets' && <AssetsTab />}
      {tab === 'copies' && <CopiesTab />}
      {tab === 'review' && <ReviewTab />}
      {/* 기존 업로드 화면을 그대로 끼운다 — 새로 짜지 않는다 */}
      {tab === 'upload' && <CreativeUploadPage />}
    </div>
  )
}

/** 비공개 보관함이라 볼 때마다 서명된 주소를 받아야 한다 */
function useAssetUrl(path: string) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let alive = true
    if (!path) return
    studioRepository
      .assetUrl(path)
      .then((value) => alive && setUrl(value))
      .catch(() => alive && setUrl(''))
    return () => {
      alive = false
    }
  }, [path])
  return url
}

function AssetThumb({ asset, size = 80 }: { asset: AdAsset; size?: number }) {
  const url = useAssetUrl(asset.path)
  return url ? (
    <img
      src={url}
      alt={asset.fileName}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-lg object-cover"
    />
  ) : (
    <div style={{ width: size, height: size }} className="shrink-0 rounded-lg bg-slate-100" />
  )
}

function AssetsTab() {
  const user = useCurrentUser()
  const client = useQueryClient()
  const assets = useQuery({
    queryKey: ['studio', 'assets'],
    queryFn: () => studioRepository.listAssets(),
  })

  const add = useMutation({
    mutationFn: async (files: FileList) => {
      for (const file of Array.from(files)) {
        const size = await readSize(file)
        await studioRepository.addAsset(
          file,
          { ...size, ratio: ratioOf(size.width, size.height) },
          user.id,
        )
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['studio', 'assets'] }),
  })

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<AdAsset> }) =>
      studioRepository.updateAsset(id, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: ['studio', 'assets'] }),
  })

  if (assets.isLoading) return <Spinner />
  const live = (assets.data ?? []).filter((row) => row.status === 'active')

  return (
    <Card>
      <CardHeader
        title={`에셋 ${formatNumber(live.length)}개`}
        description="힘스필드에서 받은 검수본을 올려두고 조합에 씁니다"
        action={
          <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-violet-300">
            {add.isPending ? '올리는 중...' : '이미지 올리기'}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files?.length && add.mutate(e.target.files)}
            />
          </label>
        }
      />

      {live.length === 0 ? (
        <EmptyState
          title="아직 에셋이 없습니다"
          description="이미지를 올리면 여기에 쌓입니다. 여러 장을 한 번에 고를 수 있습니다."
        />
      ) : (
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {live.map((asset) => (
            <div key={asset.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex gap-3">
                <AssetThumb asset={asset} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-slate-500" title={asset.fileName}>
                    {asset.fileName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {asset.width}×{asset.height} · {asset.ratio}
                  </p>
                  <button
                    type="button"
                    onClick={() => update.mutate({ id: asset.id, patch: { status: 'archived' } })}
                    className="mt-1 text-xs text-slate-400 underline hover:text-rose-600"
                  >
                    보관하기
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <Select
                  value={asset.product}
                  onChange={(e) =>
                    update.mutate({ id: asset.id, patch: { product: e.target.value } })
                  }
                  className="py-1 text-xs"
                >
                  <option value="">제품</option>
                  {PRODUCTS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
                <Select
                  value={asset.scene}
                  onChange={(e) =>
                    update.mutate({ id: asset.id, patch: { scene: e.target.value } })
                  }
                  className="py-1 text-xs"
                >
                  <option value="">장면</option>
                  {SCENES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
                <Select
                  value={asset.origin}
                  onChange={(e) =>
                    update.mutate({ id: asset.id, patch: { origin: e.target.value } })
                  }
                  className="py-1 text-xs"
                >
                  {ORIGINS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function readSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
      URL.revokeObjectURL(url)
    }
    image.onerror = () => resolve({ width: 0, height: 0 })
    image.src = url
  })
}

const emptyCopy = () => ({
  headline: '',
  subhead: '',
  badge: '',
  body: '',
  linkTitle: '',
  segment: '',
  angle: '',
  hook: '',
  offerType: '없음',
  offerValue: '',
})

function CopiesTab() {
  const user = useCurrentUser()
  const client = useQueryClient()
  const copies = useQuery({
    queryKey: ['studio', 'copies'],
    queryFn: () => studioRepository.listCopies(),
  })
  const options = useTagOptions()
  const ops = useOpsSettings()
  const settings = ops.data ?? DEFAULT_OPS

  const [draft, setDraft] = useState(emptyCopy)

  const rules = useMemo(
    () => ({
      bannedWords: settings.bannedWords,
      fiberGram: settings.fiberGram,
      headlineMaxChars: settings.headlineMaxChars,
      subheadMaxChars: settings.subheadMaxChars,
      bodyMaxChars: settings.bodyMaxChars,
    }),
    [settings],
  )

  const flags = reviewCopy(draft, rules)

  const add = useMutation({
    mutationFn: () => studioRepository.addCopies([{ ...draft, flags }], user.id),
    onSuccess: () => {
      setDraft(emptyCopy())
      client.invalidateQueries({ queryKey: ['studio', 'copies'] })
    },
  })

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<AdCopy> }) =>
      studioRepository.updateCopy(id, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: ['studio', 'copies'] }),
  })

  if (copies.isLoading || options.isLoading) return <Spinner />

  const pick = (dimension: string) =>
    (options.data ?? []).filter((o) => o.dimension === dimension && o.active)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="카피 쓰기" description="쓰는 동안 규제에 걸리는 표현을 짚어 줍니다" />
        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="이미지 헤드라인" hint={`${rules.headlineMaxChars}자 안쪽`}>
              <Input
                value={draft.headline}
                onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
                placeholder="예) 매일 마시는 식이섬유"
              />
            </Field>
            <Field label="서브헤드" hint={`${rules.subheadMaxChars}자 안쪽`}>
              <Input
                value={draft.subhead}
                onChange={(e) => setDraft({ ...draft, subhead: e.target.value })}
              />
            </Field>
            <Field label="배지 문구">
              <Input
                value={draft.badge}
                onChange={(e) => setDraft({ ...draft, badge: e.target.value })}
                placeholder="예) 15% 할인"
              />
            </Field>
            <Field label="제목 (메타 headline)">
              <Input
                value={draft.linkTitle}
                onChange={(e) => setDraft({ ...draft, linkTitle: e.target.value })}
              />
            </Field>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">광고 본문</p>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {(['segment', 'angle', 'hook'] as const).map((dimension) => (
              <Field
                key={dimension}
                label={{ segment: '세그먼트', angle: '앵글', hook: '훅' }[dimension]}
              >
                <Select
                  value={draft[dimension]}
                  onChange={(e) => setDraft({ ...draft, [dimension]: e.target.value })}
                >
                  <option value="">-</option>
                  {pick(dimension).map((o) => (
                    <option key={o.id} value={o.label}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
            <Field label="오퍼">
              <Select
                value={draft.offerType}
                onChange={(e) => setDraft({ ...draft, offerType: e.target.value })}
              >
                {pick('offer').map((o) => (
                  <option key={o.id} value={o.label}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <FlagList flags={flags} />

          <div className="flex justify-end">
            <Button
              onClick={() => add.mutate()}
              disabled={!draft.headline.trim() || isBlocked(flags) || add.isPending}
            >
              {add.isPending ? '저장 중...' : '카피 추가'}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`카피 ${formatNumber((copies.data ?? []).length)}개`}
          description="승인한 것만 조합에 쓸 수 있습니다"
        />
        {(copies.data ?? []).length === 0 ? (
          <EmptyState title="아직 카피가 없습니다" description="위에서 하나 써보세요." />
        ) : (
          <div className="divide-y divide-slate-100">
            {(copies.data ?? []).map((copy) => (
              <div key={copy.id} className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{copy.headline}</p>
                  {copy.subhead && <p className="text-sm text-slate-600">{copy.subhead}</p>}
                  {copy.body && <p className="mt-1 text-xs text-slate-500">{copy.body}</p>}
                  <p className="mt-1 text-xs text-slate-400">
                    {[copy.segment, copy.angle, copy.hook].filter(Boolean).join(' · ') ||
                      '분류 없음'}
                    {copy.rejectReason && (
                      <span className="ml-2 text-rose-500">반려: {copy.rejectReason}</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      copy.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : copy.status === 'rejected'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {{ approved: '승인', rejected: '반려', draft: '초안' }[copy.status]}
                  </span>
                  {copy.status !== 'approved' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => update.mutate({ id: copy.id, patch: { status: 'approved' } })}
                    >
                      승인
                    </Button>
                  )}
                  {copy.status !== 'rejected' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const why = prompt('반려 사유 (문구 어색·규제 위험·브랜드 톤·디자인·기타)')
                        if (why)
                          update.mutate({
                            id: copy.id,
                            patch: { status: 'rejected', rejectReason: why },
                          })
                      }}
                    >
                      반려
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function FlagList({ flags }: { flags: CopyFlag[] }) {
  if (flags.length === 0) return null
  return (
    <div className="space-y-1.5">
      {flags.map((flag, i) => (
        <p
          key={i}
          className={`rounded-lg px-3 py-2 text-xs ${
            flag.level === 'block' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'
          }`}
        >
          <b>{flag.field}</b> — {flag.message}
        </p>
      ))}
    </div>
  )
}

function ReviewTab() {
  const user = useCurrentUser()
  const client = useQueryClient()
  const assets = useQuery({
    queryKey: ['studio', 'assets'],
    queryFn: () => studioRepository.listAssets(),
  })
  const copies = useQuery({
    queryKey: ['studio', 'copies'],
    queryFn: () => studioRepository.listCopies(),
  })
  const drafts = useQuery({
    queryKey: ['studio', 'drafts'],
    queryFn: () => studioRepository.listDrafts(),
  })

  const [templateKey, setTemplateKey] = useState(TEMPLATES[0].key)
  const [ratio, setRatio] = useState<RatioKey>('1:1')

  const make = useMutation({
    mutationFn: () => {
      const approved = (copies.data ?? []).filter((row) => row.status === 'approved')
      const live = (assets.data ?? []).filter((row) => row.status === 'active')
      const rows = approved.flatMap((copy) =>
        live.map((asset) => ({
          copyId: copy.id,
          assetId: asset.id,
          templateKey,
          ratio,
        })),
      )
      return studioRepository.addDrafts(rows, user.id)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['studio', 'drafts'] }),
  })

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      studioRepository.updateDraft(id, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: ['studio', 'drafts'] }),
  })

  if (assets.isLoading || copies.isLoading || drafts.isLoading) return <Spinner />

  const approved = (copies.data ?? []).filter((row) => row.status === 'approved')
  const live = (assets.data ?? []).filter((row) => row.status === 'active')
  const combos = approved.length * live.length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="조합 만들기"
          description="승인한 카피 × 에셋 × 템플릿으로 소재를 만듭니다"
        />
        <div className="flex flex-wrap items-end gap-3 p-5">
          <Field label="템플릿">
            <Select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
              {TEMPLATES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="비율">
            <Select value={ratio} onChange={(e) => setRatio(e.target.value as RatioKey)}>
              {templateOf(templateKey).ratios.map((item) => (
                <option key={item} value={item}>
                  {item} ({RATIOS[item].width}×{RATIOS[item].height})
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex-1 text-sm text-slate-600">
            승인 카피 {approved.length}개 × 에셋 {live.length}개 ={' '}
            <b className="text-slate-900">{combos}개</b>
          </div>
          <Button onClick={() => make.mutate()} disabled={combos === 0 || make.isPending}>
            {make.isPending ? '만드는 중...' : '조합 만들기'}
          </Button>
        </div>
      </Card>

      {(drafts.data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            title="아직 만든 소재가 없습니다"
            description="카피를 승인하고 에셋을 올린 뒤 조합을 만들어보세요."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={`만든 소재 ${formatNumber((drafts.data ?? []).length)}개`}
            description="승인한 것만 업로드 탭에서 가져올 수 있습니다"
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {(drafts.data ?? []).map((draft) => {
              const copy = (copies.data ?? []).find((row) => row.id === draft.copyId)
              const asset = (assets.data ?? []).find((row) => row.id === draft.assetId)
              if (!copy || !asset) return null
              return (
                <DraftCard
                  key={draft.id}
                  draftId={draft.id}
                  status={draft.status}
                  copy={copy}
                  asset={asset}
                  templateKey={draft.templateKey}
                  ratio={draft.ratio as RatioKey}
                  onApprove={() => update.mutate({ id: draft.id, patch: { status: 'approved' } })}
                  onReject={() => {
                    const why = prompt('반려 사유 (문구 어색·규제 위험·브랜드 톤·디자인 깨짐·기타)')
                    if (why)
                      update.mutate({
                        id: draft.id,
                        patch: { status: 'rejected', reject_reason: why },
                      })
                  }}
                />
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

function DraftCard({
  draftId,
  status,
  copy,
  asset,
  templateKey,
  ratio,
  onApprove,
  onReject,
}: {
  draftId: string
  status: string
  copy: AdCopy
  asset: AdAsset
  templateKey: string
  ratio: RatioKey
  onApprove: () => void
  onReject: () => void
}) {
  const url = useAssetUrl(asset.path)
  const stage = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const template = templateOf(templateKey)
  const { width, height } = RATIOS[ratio]
  // 원본은 1080px이라 화면에는 줄여 보여준다
  const scale = 260 / width

  const save = async () => {
    if (!stage.current) return
    setSaving(true)
    try {
      const dataUrl = await toPng(stage.current, { width, height, pixelRatio: 1, cacheBust: true })
      const blob = await (await fetch(dataUrl)).blob()
      await studioRepository.saveRendered(draftId, blob)
      onApprove()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div
        className="overflow-hidden rounded-lg bg-slate-50"
        style={{ width: 260, height: height * scale }}
      >
        <div
          ref={stage}
          style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {template.render(
            {
              imageUrl: url,
              headline: copy.headline,
              subhead: copy.subhead,
              badge: copy.badge,
              cta: copy.linkTitle,
            },
            ratio,
          )}
        </div>
      </div>

      <p className="mt-2 truncate text-xs text-slate-500" title={copy.headline}>
        {copy.headline}
      </p>
      <p className="text-[11px] text-slate-400">
        {template.label} · {ratio} · {asset.fileName}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            status === 'approved'
              ? 'bg-emerald-100 text-emerald-700'
              : status === 'rejected'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-slate-100 text-slate-500'
          }`}
        >
          {{ approved: '승인', rejected: '반려', draft: '검수 전' }[status]}
        </span>
        {status !== 'approved' && (
          <Button size="sm" variant="secondary" onClick={save} disabled={saving || !url}>
            {saving ? '만드는 중...' : '승인하고 이미지 만들기'}
          </Button>
        )}
        {status !== 'rejected' && (
          <Button size="sm" variant="ghost" onClick={onReject}>
            반려
          </Button>
        )}
      </div>
    </div>
  )
}
