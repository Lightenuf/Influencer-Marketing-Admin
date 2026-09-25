import { Link } from 'react-router-dom'
import { Button, Card, CardHeader, EmptyState, Spinner, linkButtonClass } from '@/components/ui'
import { summarizeConditions } from '@/data/types'
import { useCustomerGroups, useDeleteCustomerGroup } from '@/hooks/queries'
import { formatDateTime, formatNumber } from '@/utils/format'

export default function CustomerGroupsPage() {
  const { data: groups = [], isLoading } = useCustomerGroups()
  const remove = useDeleteCustomerGroup()

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">고객 행동 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            조건으로 고객을 묶어 둡니다. 명단이 아니라 조건을 저장하므로, 열어볼 때마다 지금
            기준으로 맞는 분들을 셉니다.
          </p>
        </div>
        <Link to="/crm/groups/new" className={linkButtonClass}>
          + 새 그룹 만들기
        </Link>
      </div>

      <Card>
        <CardHeader
          title={`고객 그룹 ${formatNumber(groups.length)}개`}
          description="대상 고객 수는 아임웹 자료를 연결하면 실제 숫자로 바뀝니다"
        />

        {groups.length === 0 ? (
          <EmptyState
            title="아직 만든 그룹이 없습니다"
            description="예를 들어 '구매 40일 경과 · SMS 동의'처럼 다시 말을 걸 분들을 묶어 두세요."
            action={
              <Link to="/crm/groups/new" className={linkButtonClass}>
                새 그룹 만들기
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">그룹명</th>
                  <th className="px-3 py-2.5 text-left font-medium">조건</th>
                  <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                    대상 고객
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                    SMS 수신동의
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">
                    마지막 수정
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groups.map((group) => (
                  <tr key={group.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        to={`/crm/groups/${group.id}`}
                        className="font-medium text-slate-900 hover:text-violet-600"
                      >
                        {group.name}
                      </Link>
                    </td>
                    <td className="max-w-md px-3 py-3 text-xs text-slate-500">
                      {summarizeConditions(group.conditions)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-400">-</td>
                    <td className="px-3 py-3 text-right text-slate-400">-</td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap text-slate-500">
                      {formatDateTime(group.updatedAt)}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <Link
                        to={`/crm/groups/${group.id}`}
                        className="mr-1 text-xs text-slate-500 hover:text-violet-600"
                      >
                        수정
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-500 hover:bg-rose-50"
                        onClick={() => {
                          if (confirm(`'${group.name}' 그룹을 지울까요?`)) remove.mutate(group.id)
                        }}
                      >
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
        <b>대상 고객 수가 아직 '-' 로 보입니다.</b> 아임웹 회원·주문 자료를 데이터베이스로 옮기면
        조건에 맞는 실제 인원이 표시됩니다. 지금은 조건을 만들어 두는 단계입니다.
      </p>
    </div>
  )
}
