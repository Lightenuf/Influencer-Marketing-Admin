import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adTagRepository } from '@/data/adTagRepository'
import type { AdTagsInput, OpsSettings, TagDimension } from '@/data/adTypes'

export const adTagKeys = {
  options: ['adTags', 'options'] as const,
  aliases: ['adTags', 'aliases'] as const,
  tags: ['adTags', 'tags'] as const,
  ops: ['adTags', 'ops'] as const,
}

/** 태그 사전은 자주 바뀌지 않는다 — 한참 두고 쓴다 */
const LONG = 10 * 60 * 1000

export const useTagOptions = () =>
  useQuery({
    queryKey: adTagKeys.options,
    queryFn: () => adTagRepository.listTagOptions(),
    staleTime: LONG,
  })

export const useNameAliases = () =>
  useQuery({
    queryKey: adTagKeys.aliases,
    queryFn: () => adTagRepository.listNameAliases(),
    staleTime: LONG,
  })

export const useAdTags = () =>
  useQuery({
    queryKey: adTagKeys.tags,
    queryFn: () => adTagRepository.listAdTags(),
  })

export const useOpsSettings = () =>
  useQuery({
    queryKey: adTagKeys.ops,
    queryFn: () => adTagRepository.getOpsSettings(),
    staleTime: LONG,
  })

export function useSaveAdTags(actorId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (rows: (AdTagsInput & { adId: string })[]) =>
      adTagRepository.saveAdTags(rows, actorId),
    onSuccess: () => client.invalidateQueries({ queryKey: adTagKeys.tags }),
  })
}

export function useSaveOpsSettings() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<OpsSettings>) => adTagRepository.saveOpsSettings(patch),
    onSuccess: () => client.invalidateQueries({ queryKey: adTagKeys.ops }),
  })
}

export function useAddTagOption() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ dimension, label }: { dimension: TagDimension; label: string }) =>
      adTagRepository.addTagOption(dimension, label),
    onSuccess: () => client.invalidateQueries({ queryKey: adTagKeys.options }),
  })
}

export function useSetTagOptionActive() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adTagRepository.setTagOptionActive(id, active),
    onSuccess: () => client.invalidateQueries({ queryKey: adTagKeys.options }),
  })
}

export function useAddNameAlias() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { dimension: string; token: string; label: string }) =>
      adTagRepository.addNameAlias(input.dimension, input.token, input.label),
    onSuccess: () => client.invalidateQueries({ queryKey: adTagKeys.aliases }),
  })
}

export function useRemoveNameAlias() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adTagRepository.removeNameAlias(id),
    onSuccess: () => client.invalidateQueries({ queryKey: adTagKeys.aliases }),
  })
}
