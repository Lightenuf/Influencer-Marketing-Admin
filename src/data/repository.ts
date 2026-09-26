import type { MetaUploadPreset, MetaUploadPresetInput } from './metaTypes'
import type {
  CustomerGroup,
  CustomerGroupInput,
  Campaign,
  CampaignConversion,
  CampaignImportRow,
  CampaignOption,
  CampaignPatch,
  CampaignSendInput,
  CustomerOptout,
  CustomerPreview,
  GroupConditions,
  OptionKind,
  SendTargets,
  TestSendInput,
} from './types'
import type {
  Collab,
  CollabStage,
  HoldReason,
  CommunicationLog,
  DiscoveryRequest,
  DncAuditEntry,
  Influencer,
  MessageTemplate,
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
  | 'contactedDates'
>

export type CollabInput = Omit<
  Collab,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'stageEnteredAt'
  | 'memo'
  | 'sortOrder'
  | 'targetRevenue'
  | 'plannedUnits'
  | 'settlementAmount'
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

  /** 메시지를 보낸 날을 한 건 기록한다 */
  logContact(id: string, date: string): Promise<Influencer>
  /** 마지막 발송 기록 한 건을 지운다 — 잘못 눌렀을 때 되돌리기 */
  undoContact(id: string): Promise<Influencer>

  /** 연락 금지 설정/해제. 항상 감사 로그를 함께 남긴다. */
  changeDnc(change: DncChange, actorId: string): Promise<Influencer>
  listDncAudit(influencerId?: string): Promise<DncAuditEntry[]>

  listCollabs(): Promise<Collab[]>
  createCollab(input: CollabInput): Promise<Collab>
  updateCollab(
    id: string,
    patch: Partial<
      CollabInput & Pick<Collab, 'memo' | 'targetRevenue' | 'plannedUnits' | 'settlementAmount'>
    >,
  ): Promise<Collab>
  /** 한 단계 안의 카드 순서를 준 순서대로 다시 매긴다 */
  reorderCollabs(orderedIds: string[]): Promise<void>
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

  /** CRM 고객 그룹 — 조건만 저장하고 볼 때마다 다시 센다 */
  listCustomerGroups(): Promise<CustomerGroup[]>
  createCustomerGroup(input: CustomerGroupInput, actorId: string): Promise<CustomerGroup>
  updateCustomerGroup(id: string, input: CustomerGroupInput): Promise<CustomerGroup>
  deleteCustomerGroup(id: string): Promise<void>

  /**
   * 조건에 맞는 고객을 세고 명단을 준다.
   * 명단을 저장해 두지 않고 부를 때마다 다시 세므로 늘 최신이다.
   */
  previewCustomerGroup(conditions: GroupConditions, limit: number): Promise<CustomerPreview>

  /**
   * 조건에 맞는 사람 중 실제로 보낼 수 있는 사람만 추린다.
   * 번호가 없거나 수신거부한 분은 빠진다. 발송 대상의 유일한 기준이다.
   */
  listSendTargets(conditions: GroupConditions, limit: number): Promise<SendTargets>

  /**
   * 손으로 넣은 번호를 발송 대상으로 다듬는다.
   * 수신거부는 여기서 거른다 — 화면에서만 거르면 실수로 나갈 수 있다.
   */
  checkSendNumbers(numbers: string[]): Promise<SendTargets>

  /** 캠페인 — 최근 것부터. 어드민 발송과 CSV로 올린 예전 기록이 함께 담긴다 */
  listCampaigns(): Promise<Campaign[]>
  getCampaign(id: string): Promise<Campaign | null>

  /** 사후 태깅과 성과 숫자를 고친다. 보낸 원문은 고치지 않는다 */
  updateCampaign(id: string, patch: CampaignPatch): Promise<void>
  deleteCampaign(id: string): Promise<void>

  /**
   * 실제로 보낸다. 되돌릴 수 없다.
   * draftOnly면 보내지 않고 임시저장만 한다.
   */
  sendCampaign(input: CampaignSendInput, actorId: string): Promise<Campaign>

  /**
   * 한 번호로만 보내 본다.
   * 캠페인 기록을 남기지 않는다 — 테스트가 성과 비교에 섞이면 안 된다.
   */
  sendTestMessage(input: TestSendInput): Promise<void>

  /**
   * 받은 사람 중 발송 뒤 windowDays 안에 주문한 것을 센다.
   * 저장해 둔 숫자가 아니라 주문 자료에서 그때그때 센다.
   */
  campaignConversion(id: string, windowDays: number): Promise<CampaignConversion>

  /** 예전 캠페인 기록을 한꺼번에 올린다. 같은 채널·일시·유형이면 덮어쓴다 */
  importCampaigns(rows: CampaignImportRow[]): Promise<number>

  /** 목적·컨셉·오퍼 선택지 */
  listCampaignOptions(): Promise<CampaignOption[]>
  addCampaignOption(kind: OptionKind, label: string): Promise<void>
  removeCampaignOption(id: string): Promise<void>

  /** 수신거부 명단 */
  listOptouts(): Promise<CustomerOptout[]>
  addOptout(callnum: string, reason: string): Promise<void>
  removeOptout(callnum: string): Promise<void>

  /** 소재 업로드 프리셋 — 자주 쓰는 설정 묶음 */
  listUploadPresets(): Promise<MetaUploadPreset[]>
  createUploadPreset(input: MetaUploadPresetInput, actorId: string): Promise<MetaUploadPreset>
  deleteUploadPreset(id: string): Promise<void>

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

  /** 시딩 메시지 등 자주 바뀌는 문구를 팀원이 어드민에서 고친다. */
  listMessageTemplates(): Promise<MessageTemplate[]>
  saveMessageTemplate(
    id: string,
    patch: { name?: string; body?: string },
    actorId: string,
  ): Promise<MessageTemplate>
  createMessageTemplate(name: string, actorId: string): Promise<MessageTemplate>
  deleteMessageTemplate(id: string): Promise<void>

  listNotes(influencerId: string): Promise<CommunicationLog[]>
  addNote(influencerId: string, note: string, authorId: string): Promise<CommunicationLog>
  deleteNote(id: string): Promise<void>

  /** 데모용 예시 데이터 주입 / 전체 초기화 (목업 단계 전용) */
  loadDemoData(): Promise<void>
  resetAll(): Promise<void>
}
