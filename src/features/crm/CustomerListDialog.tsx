import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, EmptyState, Modal, Spinner } from '@/components/ui'
import { repository } from '@/data'
import type { GroupConditions } from '@/data/types'
import { downloadCsv } from '@/utils/csv'
import { formatDate, formatDateTime, formatNumber } from '@/utils/format'

/** 한 번에 보여줄 명단 수 */
const LIST_SIZE = 200

/**
 * 고객 명단.
 *
 * 실제 이름과 연락처가 보이는 화면이라, 열기 전에 한 번 묻는다.
 * 무심코 열어 화면에 띄워 두거나 아무 데나 내려받는 일을 줄이기 위함이다.
 */
export default function CustomerListDialog({
  group,
  open,
  onClose,
}: {
  group: { name: string; conditions: GroupConditions } | null
  open: boolean
  onClose: () => void
}) {
  const [agreed, setAgreed] = useState(false)

  const preview = useQuery({
    queryKey: ['customerPreview', group?.conditions, agreed],
    queryFn: () => repository.previewCustomerGroup(group!.conditions, LIST_SIZE),
    enabled: open && agreed && !!group,
  })

  const close = () => {
    setAgreed(false)
    onClose()
  }

  if (!group) return null

  // ── 열기 전: 개인정보 안내 ──
  if (!agreed) {
    return (
      <Modal open={open} onClose={close} title="명단을 열기 전에" width="max-w-md">
        <div className="space-y-3 text-sm leading-relaxed text-slate-700">
          <p>
            지금 보시려는 것은 <b>고객의 이름과 연락처가 담긴 명단</b>입니다. 개인정보라 다루는 데
            주의가 필요합니다.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-slate-600">
            <li>업무에 필요한 만큼만 보고, 화면을 띄워 둔 채 자리를 비우지 마세요</li>
            <li>내려받은 파일을 개인 저장소·메신저로 옮기지 마세요</li>
            <li>다 쓴 파일은 지우고, 외부에 전달하지 마세요</li>
          </ul>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            그룹 <b className="text-slate-700">{group.name}</b>
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            닫기
          </Button>
          <Button onClick={() => setAgreed(true)}>확인하기</Button>
        </div>
      </Modal>
    )
  }

  // ── 확인한 뒤: 명단 ──
  const data = preview.data
  const rows = data?.rows ?? []

  const exportCsv = () =>
    downloadCsv(
      `고객명단_${group.name}`,
      rows.map((row) => ({
        회원코드: row.memberCode,
        이름: row.name,
        연락처: row.callnum,
        이메일: row.email,
        등급: row.memberGrade,
        SMS동의: row.marketingAgreeSms ? 'Y' : 'N',
        구매횟수: row.orderCount,
        누적구매액: row.totalSpent,
        마지막구매일: formatDate(row.lastOrderedAt),
      })),
    )

  return (
    <Modal
      open={open}
      onClose={close}
      title={`${group.name} — 고객 명단`}
      description={
        data
          ? `조건에 맞는 ${formatNumber(data.total)}명 중 SMS 수신동의 ${formatNumber(data.smsAgreed)}명`
          : undefined
      }
      width="max-w-4xl"
    >
      <div className="space-y-3">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          개인정보가 담긴 화면입니다. 필요한 만큼만 보고, 내려받은 파일은 다 쓴 뒤 지워주세요.
        </p>

        {data && rows.length > 0 && data.smsAgreed === 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
            이 명단에는 <b className="text-slate-800">마케팅 수신에 동의한 분이 없습니다.</b> 누가
            해당되는지 확인하는 데는 문제가 없지만, 실제 문자·이메일 발송은 할 수 없습니다.
          </p>
        )}

        {preview.isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState
            title="아직 명단을 만들 수 없습니다"
            description="아임웹 회원·주문 자료를 데이터베이스로 옮기면 이곳에 조건에 맞는 고객이 나옵니다."
          />
        ) : (
          <>
            <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">이름</th>
                    <th className="px-3 py-2 text-left font-medium">연락처</th>
                    <th className="px-3 py-2 text-left font-medium">이메일</th>
                    <th className="px-3 py-2 text-left font-medium">등급</th>
                    <th className="px-3 py-2 text-center font-medium whitespace-nowrap">SMS</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">구매</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">누적액</th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      마지막 구매
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.memberCode} className="hover:bg-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap text-slate-900">{row.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">{row.callnum}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">{row.email}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                        {row.memberGrade || '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.marketingAgreeSms ? (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                            동의
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-300">-</span>
                        )}
                      </td>
                      <td className="tabular px-3 py-2 text-right text-slate-600">
                        {formatNumber(row.orderCount)}회
                      </td>
                      <td className="tabular px-3 py-2 text-right whitespace-nowrap text-slate-600">
                        {formatNumber(row.totalSpent)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                        {formatDate(row.lastOrderedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data && data.total > rows.length && (
              <p className="text-xs text-slate-400">
                조건에 맞는 {formatNumber(data.total)}명 가운데 {formatNumber(rows.length)}명까지
                보여줍니다. 전체는 엑셀로 내려받아 확인하세요.
              </p>
            )}
          </>
        )}

        {data?.syncedAt && (
          <p className="text-xs text-slate-400">자료 기준 {formatDateTime(data.syncedAt)}</p>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={close}>
          닫기
        </Button>
        <Button onClick={exportCsv} disabled={rows.length === 0}>
          엑셀 다운로드
        </Button>
      </div>
    </Modal>
  )
}
