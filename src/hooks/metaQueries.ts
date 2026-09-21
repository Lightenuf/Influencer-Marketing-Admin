import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { metaRepository } from '@/data'
import type { MetaPeriod } from '@/data/metaRepository'
import type { MetaLevel, MetaStatus } from '@/data/metaTypes'

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
