import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { repository } from '@/data'
import type {
  CollabInput,
  DncChange,
  HoldChange,
  InfluencerInput,
  ShipmentInput,
} from '@/data/repository'
import type { CollabStage, DiscoveryRequest } from '@/data/types'

export const keys = {
  members: ['members'] as const,
  influencers: ['influencers'] as const,
  influencer: (id: string) => ['influencers', id] as const,
  dncAudit: (id?: string) => ['dncAudit', id ?? 'all'] as const,
  collabs: ['collabs'] as const,
  shipments: ['shipments'] as const,
  reasonTags: ['reasonTags'] as const,
  discoveryRequests: ['discoveryRequests'] as const,
  notes: (id: string) => ['notes', id] as const,
}

export const useTeamMembers = () =>
  useQuery({ queryKey: keys.members, queryFn: () => repository.listTeamMembers(), staleTime: Infinity })

export const useInfluencers = () =>
  useQuery({ queryKey: keys.influencers, queryFn: () => repository.listInfluencers() })

export const useInfluencer = (id: string) =>
  useQuery({ queryKey: keys.influencer(id), queryFn: () => repository.getInfluencer(id) })

export const useDncAudit = (influencerId?: string) =>
  useQuery({
    queryKey: keys.dncAudit(influencerId),
    queryFn: () => repository.listDncAudit(influencerId),
  })

export const useCollabs = () =>
  useQuery({ queryKey: keys.collabs, queryFn: () => repository.listCollabs() })

export const useShipments = () =>
  useQuery({ queryKey: keys.shipments, queryFn: () => repository.listShipments() })

export const useNotes = (influencerId: string) =>
  useQuery({ queryKey: keys.notes(influencerId), queryFn: () => repository.listNotes(influencerId) })

/** 인플루언서가 바뀌면 목록·상세·감사로그가 모두 영향을 받으므로 함께 무효화한다. */
function useInvalidateInfluencers() {
  const client = useQueryClient()
  return () => {
    client.invalidateQueries({ queryKey: keys.influencers })
    client.invalidateQueries({ queryKey: ['dncAudit'] })
  }
}

export function useCreateInfluencer(actorId: string) {
  const invalidate = useInvalidateInfluencers()
  return useMutation({
    mutationFn: (input: InfluencerInput) => repository.createInfluencer(input, actorId),
    onSuccess: invalidate,
  })
}

export function useUpdateInfluencer() {
  const client = useQueryClient()
  const invalidate = useInvalidateInfluencers()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<InfluencerInput> }) =>
      repository.updateInfluencer(id, patch),
    onSuccess: (influencer) => {
      client.invalidateQueries({ queryKey: keys.influencer(influencer.id) })
      invalidate()
    },
  })
}

export function useDeleteInfluencer() {
  const client = useQueryClient()
  const invalidate = useInvalidateInfluencers()
  return useMutation({
    mutationFn: (id: string) => repository.deleteInfluencer(id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.collabs })
      client.invalidateQueries({ queryKey: keys.shipments })
      invalidate()
    },
  })
}

export function useChangeDnc(actorId: string) {
  const client = useQueryClient()
  const invalidate = useInvalidateInfluencers()
  return useMutation({
    mutationFn: (change: DncChange) => repository.changeDnc(change, actorId),
    onSuccess: (influencer) => {
      client.invalidateQueries({ queryKey: keys.influencer(influencer.id) })
      invalidate()
    },
  })
}

export function useCreateCollab() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: CollabInput) => repository.createCollab(input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.collabs }),
  })
}

export function useUpdateCollab() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CollabInput> }) =>
      repository.updateCollab(id, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.collabs }),
  })
}

export function useMoveCollabStage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: CollabStage }) =>
      repository.moveCollabStage(id, stage),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.collabs }),
  })
}

export function useCancelCollab() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reasons, detail }: { id: string; reasons: string[]; detail: string }) =>
      repository.cancelCollab(id, reasons, detail),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.collabs }),
  })
}

export function useHoldCollab() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: Partial<HoldChange> }) =>
      repository.holdCollab(id, change),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.collabs }),
  })
}

export function useResumeCollab() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => repository.resumeCollab(id),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.collabs }),
  })
}

export function useSetCancelDate() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) => repository.setCancelDate(id, date),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.collabs }),
  })
}

export function useDeleteCollab() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => repository.deleteCollab(id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.collabs })
      client.invalidateQueries({ queryKey: keys.shipments })
    },
  })
}

/** 자동화가 결과를 채워 넣으면 화면이 저절로 갱신되도록 주기적으로 확인한다. */
export const useDiscoveryRequests = () =>
  useQuery({
    queryKey: keys.discoveryRequests,
    queryFn: () => repository.listDiscoveryRequests(),
    refetchInterval: 15_000,
  })

export function useCreateDiscoveryRequest(actorId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { keywords: string[]; minFollowers: number; wanted: number }) =>
      repository.createDiscoveryRequest(input, actorId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.discoveryRequests }),
  })
}

export function useUpdateDiscoveryRequest() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Pick<DiscoveryRequest, 'status' | 'resultRaw' | 'note'>>
    }) => repository.updateDiscoveryRequest(id, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.discoveryRequests }),
  })
}

export function useDeleteDiscoveryRequest() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => repository.deleteDiscoveryRequest(id),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.discoveryRequests }),
  })
}

export const useReasonTags = () =>
  useQuery({ queryKey: keys.reasonTags, queryFn: () => repository.listReasonTags() })

export function useCreateReasonTag(actorId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (label: string) => repository.createReasonTag(label, actorId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.reasonTags }),
  })
}

export function useDeleteReasonTag() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => repository.deleteReasonTag(id),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.reasonTags }),
  })
}

export function useCreateShipment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: ShipmentInput) => repository.createShipment(input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.shipments }),
  })
}

export function useUpdateShipment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ShipmentInput> }) =>
      repository.updateShipment(id, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.shipments }),
  })
}

export function useDeleteShipment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => repository.deleteShipment(id),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.shipments }),
  })
}

export function useAddNote(actorId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ influencerId, note }: { influencerId: string; note: string }) =>
      repository.addNote(influencerId, note, actorId),
    onSuccess: (entry) => client.invalidateQueries({ queryKey: keys.notes(entry.influencerId) }),
  })
}

export function useDeleteNote(influencerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => repository.deleteNote(id),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.notes(influencerId) }),
  })
}

export function useDemoData() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (action: 'load' | 'reset') =>
      action === 'load' ? repository.loadDemoData() : repository.resetAll(),
    onSuccess: () => client.invalidateQueries(),
  })
}
