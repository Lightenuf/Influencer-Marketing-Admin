import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { metaRepository, repository } from '@/data'
import type { MetaPeriod } from '@/data/metaRepository'
import type {
  AdCreateInput,
  AdSetCreateInput,
  CampaignCreateInput,
  MetaLevel,
  MetaStatus,
  MetaUploadPresetInput,
} from '@/data/metaTypes'

/**
 * 메타 지표는 실시간일 필요가 없고, 메타 API에는 호출 한도가 있다.
 * 5분 동안은 받아둔 값을 그대로 쓴다.
 */
const FRESH_FOR = 5 * 60 * 1000

export const metaKeys = {
  campaigns: ['meta', 'campaigns'] as const,
  adsets: ['meta', 'adsets'] as const,
  ads: ['meta', 'ads'] as const,
  insights: (level: MetaLevel, period: MetaPeriod) =>
    ['meta', 'insights', level, period.from, period.to] as const,
  weekly: (adIds: string[], period: MetaPeriod) =>
    ['meta', 'weekly', [...adIds].sort().join(','), period.from, period.to] as const,
}

export const useMetaCampaigns = () =>
  useQuery({
    queryKey: metaKeys.campaigns,
    queryFn: () => metaRepository.listCampaigns(),
    staleTime: FRESH_FOR,
  })

export const useMetaAdSets = () =>
  useQuery({
    queryKey: metaKeys.adsets,
    queryFn: () => metaRepository.listAdSets(),
    staleTime: FRESH_FOR,
  })

export const useMetaAds = () =>
  useQuery({
    queryKey: metaKeys.ads,
    queryFn: () => metaRepository.listAds(),
    staleTime: FRESH_FOR,
  })

/** 맞춤 타겟은 자주 바뀌지 않는다 — 한참 두고 쓴다 */
export const useMetaCustomAudiences = () =>
  useQuery({
    queryKey: ['meta', 'audiences'] as const,
    queryFn: () => metaRepository.listCustomAudiences(),
    staleTime: 30 * 60 * 1000,
  })

export const useMetaInsights = (level: Exclude<MetaLevel, 'account'>, period: MetaPeriod) =>
  useQuery({
    queryKey: metaKeys.insights(level, period),
    queryFn: () => metaRepository.getInsights(level, period),
    staleTime: FRESH_FOR,
  })

export const useMetaWeeklySeries = (adIds: string[], period: MetaPeriod) =>
  useQuery({
    queryKey: metaKeys.weekly(adIds, period),
    queryFn: () => metaRepository.getWeeklySeries(adIds, period),
    staleTime: FRESH_FOR,
    enabled: adIds.length > 0,
  })

export function useSetAdStatus() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ adId, status }: { adId: string; status: MetaStatus }) =>
      metaRepository.setAdStatus(adId, status),
    onSuccess: () => client.invalidateQueries({ queryKey: metaKeys.ads }),
  })
}

export function useSetDailyBudget() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ level, id, won }: { level: 'campaign' | 'adset'; id: string; won: number }) =>
      metaRepository.setDailyBudget({ level, id }, won),
    onSuccess: (_result, variables) => {
      client.invalidateQueries({
        queryKey: variables.level === 'campaign' ? metaKeys.campaigns : metaKeys.adsets,
      })
    },
  })
}

/** 자주 쓰는 업로드 설정 묶음 */
export const useUploadPresets = () =>
  useQuery({
    queryKey: ['meta', 'presets'] as const,
    queryFn: () => repository.listUploadPresets(),
  })

export function useCreateUploadPreset(actorId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: MetaUploadPresetInput) => repository.createUploadPreset(input, actorId),
    onSuccess: () => client.invalidateQueries({ queryKey: ['meta', 'presets'] }),
  })
}

export function useDeleteUploadPreset() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => repository.deleteUploadPreset(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['meta', 'presets'] }),
  })
}

/** 소재 파일을 메타에 올린다 */
export const useUploadCreative = () =>
  useMutation({ mutationFn: (file: File) => metaRepository.uploadCreative(file) })

export function useCreateAd() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: AdCreateInput) => metaRepository.createAd(input),
    onSuccess: () => client.invalidateQueries({ queryKey: metaKeys.ads }),
  })
}

export function useCreateCampaign() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: CampaignCreateInput) => metaRepository.createCampaign(input),
    onSuccess: () => client.invalidateQueries({ queryKey: metaKeys.campaigns }),
  })
}

export function useCreateAdSet() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: AdSetCreateInput) => metaRepository.createAdSet(input),
    onSuccess: () => client.invalidateQueries({ queryKey: metaKeys.adsets }),
  })
}
