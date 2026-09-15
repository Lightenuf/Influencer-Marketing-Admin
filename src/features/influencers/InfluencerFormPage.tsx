import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { useCurrentUser } from '@/auth/AuthProvider'
import { Button, Card, CardHeader, Field, Input, Select, secondaryLinkButtonClass, Spinner, Textarea } from '@/components/ui'
import {
  CATEGORIES,
  INFLUENCER_STATUSES,
  REVENUE_BANDS,
  SNS_PLATFORM_LABELS,
  SNS_PLATFORMS,
} from '@/data/types'
import { useCreateInfluencer, useInfluencer, useUpdateInfluencer } from '@/hooks/queries'

const schema = z.object({
  name: z.string().trim().min(1, '이름을 입력해주세요.'),
  snsPlatform: z.enum(SNS_PLATFORMS),
  snsHandle: z.string().trim().min(1, '계정을 입력해주세요.'),
  snsUrl: z.string().trim(),
  followerCount: z.number().int().min(0, '0 이상 숫자를 입력해주세요.'),
  categories: z.array(z.string()),
  avgRevenueBand: z.enum(REVENUE_BANDS),
  contactEmail: z.string().trim(),
  contactPhone: z.string().trim(),
  contactEtc: z.string().trim(),
  status: z.enum(INFLUENCER_STATUSES),
  memo: z.string(),
})

type FormValues = z.infer<typeof schema>

const defaults: FormValues = {
  name: '',
  snsPlatform: 'instagram',
  snsHandle: '',
  snsUrl: '',
  followerCount: 0,
  categories: [],
  avgRevenueBand: '미확인',
  contactEmail: '',
  contactPhone: '',
  contactEtc: '',
  status: '제안중',
  memo: '',
}

export default function InfluencerFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const user = useCurrentUser()

  const { data: existing, isLoading } = useInfluencer(id ?? '')
  const createInfluencer = useCreateInfluencer(user.id)
  const updateInfluencer = useUpdateInfluencer()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults })

  useEffect(() => {
    if (!isEdit || !existing) return
    reset({
      name: existing.name,
      snsPlatform: existing.snsPlatform,
      snsHandle: existing.snsHandle,
      snsUrl: existing.snsUrl,
      followerCount: existing.followerCount,
      categories: existing.categories,
      avgRevenueBand: existing.avgRevenueBand,
      contactEmail: existing.contactEmail,
      contactPhone: existing.contactPhone,
      contactEtc: existing.contactEtc,
      status: existing.status,
      memo: existing.memo,
    })
  }, [isEdit, existing, reset])

  const selectedCategories = watch('categories')

  const toggleCategory = (category: string) => {
    const next = selectedCategories.includes(category)
      ? selectedCategories.filter((item) => item !== category)
      : [...selectedCategories, category]
    setValue('categories', next, { shouldDirty: true })
  }

  const onSubmit = handleSubmit(async (values) => {
    if (isEdit && id) {
      await updateInfluencer.mutateAsync({ id, patch: values })
      navigate(`/influencers/${id}`)
    } else {
      const created = await createInfluencer.mutateAsync(values)
      navigate(`/influencers/${created.id}`)
    }
  })

  if (isEdit && isLoading) return <Spinner />

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-bold text-slate-900">
        {isEdit ? '인플루언서 정보 수정' : '인플루언서 등록'}
      </h1>

      <form onSubmit={onSubmit}>
        <Card>
          <CardHeader title="기본 정보" />
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="이름" required error={errors.name?.message}>
              <Input {...register('name')} placeholder="예) 날씬쿡" />
            </Field>

            <Field label="플랫폼" required>
              <Select {...register('snsPlatform')}>
                {SNS_PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {SNS_PLATFORM_LABELS[platform]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="계정(아이디)" required error={errors.snsHandle?.message}>
              <Input {...register('snsHandle')} placeholder="@ 없이 입력" />
            </Field>

            <Field label="프로필 링크">
              <Input {...register('snsUrl')} placeholder="https://" />
            </Field>

            <Field label="팔로워 수" error={errors.followerCount?.message}>
              <Input type="number" min={0} {...register('followerCount', { valueAsNumber: true })} />
            </Field>

            <Field label="평균 매출 구간">
              <Select {...register('avgRevenueBand')}>
                {REVENUE_BANDS.map((band) => (
                  <option key={band} value={band}>
                    {band}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">카테고리</span>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((category) => {
                  const active = selectedCategories.includes(category)
                  return (
                    <button
                      type="button"
                      key={category}
                      onClick={() => toggleCategory(category)}
                      className={
                        active
                          ? 'rounded-full bg-violet-600 px-3 py-1.5 text-xs font-medium text-white'
                          : 'rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
                      }
                    >
                      {category}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <CardHeader title="연락처 · 상태" />
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="이메일">
              <Input {...register('contactEmail')} />
            </Field>
            <Field label="연락처">
              <Input {...register('contactPhone')} placeholder="010-0000-0000" />
            </Field>
            <Field label="기타 연락 수단" hint="카카오 채널, 소속사 담당자 등">
              <Input {...register('contactEtc')} />
            </Field>
            <Field label="현재 상태">
              <Select {...register('status')}>
                {INFLUENCER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label="메모">
                <Textarea rows={3} {...register('memo')} placeholder="특이사항, 협업 조건 등" />
              </Field>
            </div>
          </div>
        </Card>

        <div className="mt-4 flex justify-end gap-2">
          <Link
            to={isEdit && id ? `/influencers/${id}` : '/influencers'}
            className={secondaryLinkButtonClass}
          >
            취소
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isEdit ? '저장' : '등록'}
          </Button>
        </div>
      </form>
    </div>
  )
}
