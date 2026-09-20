import type {
  Collab,
  CollabStage,
  HoldReason,
  CommunicationLog,
  DiscoveryRequest,
  DncAuditEntry,
  Influencer,
  ReasonTag,
  Shipment,
  TeamMember,
} from './types'

export type InfluencerInput = Omit<
  Influencer,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'createdBy'
  | 'doNotContact'
  | 'dncReason'
  | 'dncSetBy'
  | 'dncSetAt'
>

export type CollabInput = Omit<
  Collab,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'stageEnteredAt'
  | 'isCancelled'
  | 'cancelReasons'
  | 'cancelReasonDetail'
  | 'cancelledAt'
  | 'isOnHold'
  | 'holdReason'
  | 'holdDetail'
  | 'heldAt'
  | 'recontactAt'
>

export interface HoldChange {
  reason: HoldReason
  detail: string
  recontactAt: string | null
}

export type ShipmentInput = Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>

export interface DncChange {
  influencerId: string
  action: 'set' | 'unset'
  reason: string
  reasonDetail: string
}

/**
 * 앱 전체가 의존하는 데이터 계약.
 * 지금은 localStorage 어댑터가, 나중에는 Supabase 어댑터가 이 인터페이스를 구현한다.
 * 화면 코드는 어떤 어댑터가 연결됐는지 알 필요가 없다.
 */
export interface DataRepository {
  listTeamMembers(): Promise<TeamMember[]>

  listInfluencers(): Promise<Influencer[]>
  getInfluencer(id: string): Promise<Influencer | null>
  createInfluencer(input: InfluencerInput, actorId: string): Promise<Influencer>
  updateInfluencer(id: string, patch: Partial<InfluencerInput>): Promise<Influencer>
  deleteInfluencer(id: string): Promise<void>

  /** 연락 금지 설정/해제. 항상 감사 로그를 함께 남긴다. */
  changeDnc(change: DncChange, actorId: string): Promise<Influencer>
  listDncAudit(influencerId?: string): Promise<DncAuditEntry[]>

  listCollabs(): Promise<Collab[]>
  createCollab(input: CollabInput): Promise<Collab>
  updateCollab(id: string, patch: Partial<CollabInput>): Promise<Collab>
  moveCollabStage(id: string, stage: CollabStage): Promise<Collab>
  cancelCollab(id: string, reasons: string[], reasonDetail: string): Promise<Collab>
  /** 거절 시점을 고친다 — 어드민을 만들기 전에 있었던 거절을 실제 날짜로 옮길 때 쓴다. */
  setCancelDate(id: string, date: string): Promise<Collab>
  /**
   * 보류로 옮기거나, 이미 보류 중인 건의 정보를 고친다.
   * 넘긴 항목만 바뀐다 — 날짜만 고치려고 사유·메모를 다시 보낼 필요가 없다.
   * 단계는 그대로 두어 복귀할 자리를 기억한다.
   */
  holdCollab(id: string, change: Partial<HoldChange>): Promise<Collab>
  /** 보류를 풀고 원래 단계로 되돌린다. */
  resumeCollab(id: string): Promise<Collab>
  deleteCollab(id: string): Promise<void>

  /** 발굴 요청 — 어드민이 남기고 크롬 자동화가 처리한다 */
  listDiscoveryRequests(): Promise<DiscoveryRequest[]>
  createDiscoveryRequest(
    input: { keywords: string[]; minFollowers: number; wanted: number },
    actorId: string,
  ): Promise<DiscoveryRequest>
  updateDiscoveryRequest(
    id: string,
    patch: Partial<Pick<DiscoveryRequest, 'status' | 'resultRaw' | 'note'>>,
  ): Promise<DiscoveryRequest>
  deleteDiscoveryRequest(id: string): Promise<void>

  /** 거절·연락 금지 사유 태그 — 팀원이 함께 관리한다 */
  listReasonTags(): Promise<ReasonTag[]>
  createReasonTag(label: string, actorId: string): Promise<ReasonTag>
  deleteReasonTag(id: string): Promise<void>

  listShipments(): Promise<Shipment[]>
  createShipment(input: ShipmentInput): Promise<Shipment>
  updateShipment(id: string, patch: Partial<ShipmentInput>): Promise<Shipment>
  deleteShipment(id: string): Promise<void>

  listNotes(influencerId: string): Promise<CommunicationLog[]>
  addNote(influencerId: string, note: string, authorId: string): Promise<CommunicationLog>
  deleteNote(id: string): Promise<void>

  /** 데모용 예시 데이터 주입 / 전체 초기화 (목업 단계 전용) */
  loadDemoData(): Promise<void>
  resetAll(): Promise<void>
}
