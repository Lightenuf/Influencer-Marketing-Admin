import clsx from 'clsx'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui'
import { isMockMode } from '@/data'
import { useInfluencers } from '@/hooks/queries'

/** 메뉴가 길어져 하는 일끼리 묶는다 — 크리에이터 쪽과 광고 쪽 */
const navGroups = [
  {
    title: null,
    items: [
      { to: '/dashboard', label: '대시보드', icon: '📊' },
      { to: '/discovery', label: '인플루언서 발굴', icon: '🔍' },
      { to: '/influencers', label: '컨택 리스트', icon: '👥' },
      { to: '/pipeline', label: '협업 파이프라인', icon: '🗂️' },
      { to: '/performance', label: '마켓 성과', icon: '💰' },
      { to: '/rejected', label: '거절 명단', icon: '🚫' },
      { to: '/calendar', label: '캘린더', icon: '🗓️' },
    ],
  },
  {
    title: '메타 광고',
    items: [
      { to: '/ads', label: '광고 대시보드', icon: '📈' },
      { to: '/ads/creatives', label: '소재 성과', icon: '🎬' },
      { to: '/ads/manage', label: '광고 관리', icon: '🎛️' },
      { to: '/ads/upload', label: '소재 업로드', icon: '⬆️' },
    ],
  },
]

/**
 * 어떤 메뉴를 '정확히 그 주소일 때만' 켤지 가른다.
 *
 * 메뉴 주소가 다른 메뉴의 윗길이면(예: /ads 아래에 /ads/creatives), 하위 화면에 있을 때
 * 둘 다 켜져 보인다. 그런 항목만 정확히 일치할 때 켠다.
 * 반대로 /influencers 처럼 하위가 메뉴에 없는 경우는, 상세 화면에서도 메뉴가 켜져 있어야 한다.
 */
const menuPaths = navGroups.flatMap((group) => group.items.map((item) => item.to))
const exactOnly = (to: string) =>
  menuPaths.some((path) => path !== to && path.startsWith(`${to}/`))

export default function AppShell() {
  const { user, signOut } = useAuth()
  const { data: influencers = [] } = useInfluencers()
  const dncCount = influencers.filter((i) => i.doNotContact).length

  return (
    <div className="flex min-h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <Link
          to="/dashboard"
          className="block px-5 py-5 transition-colors hover:bg-slate-50"
          title="대시보드로 이동"
        >
          <p className="text-xs font-semibold tracking-widest text-violet-600">BREEVO</p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">인플루언서 관리</p>
        </Link>

        <nav className="flex-1 space-y-0.5 px-3">
          {navGroups.map((group) => (
            <div key={group.title ?? 'main'} className={group.title ? 'pt-3' : undefined}>
              {group.title && (
                <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-400">
                  {group.title}
                </p>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={exactOnly(item.to)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-violet-50 font-semibold text-violet-700'
                        : 'text-slate-600 hover:bg-slate-50',
                    )
                  }
                >
                  <span aria-hidden>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.to === '/rejected' && dncCount > 0 && (
                    <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-600">
                      {dncCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {isMockMode && (
          <p className="m-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
            미리보기 모드 — 이 브라우저에만 저장됩니다.
          </p>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-3 border-b border-slate-200 bg-white px-6">
          <span className="text-sm text-slate-600">
            {user?.displayName}
            <span className="ml-1 text-xs text-slate-400">
              {user?.role === 'admin' ? '관리자' : '팀원'}
            </span>
          </span>
          <Button variant="secondary" size="sm" onClick={signOut}>
            로그아웃
          </Button>
        </header>

        <main className="flex-1 overflow-x-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
