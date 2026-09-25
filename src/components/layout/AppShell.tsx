import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui'
import { isMockMode } from '@/data'
import { useInfluencers } from '@/hooks/queries'

/** 메뉴가 길어져 하는 일끼리 묶는다 — 크리에이터 쪽과 광고 쪽 */
const navGroups = [
  {
    title: '인플루언서 마케팅',
    items: [
      { to: '/dashboard', label: '대시보드', icon: '📊' },
      { to: '/discovery', label: '셀러 발굴', icon: '🔍' },
      { to: '/influencers', label: '셀러 리스트', icon: '👥' },
      { to: '/pipeline', label: '협업 파이프라인', icon: '🗂️' },
      { to: '/performance', label: '마켓 관리', icon: '💰' },
      { to: '/rejected', label: '거절 명단', icon: '🚫' },
    ],
  },
  {
    title: 'CRM 마케팅',
    items: [
      { to: '/crm/groups', label: '고객 행동 관리', icon: '🎯' },
      { to: '/crm/send', label: '문자·푸시 전송', icon: '💬' },
    ],
  },
  {
    title: '퍼포먼스 마케팅',
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
const exactOnly = (to: string) => menuPaths.some((path) => path !== to && path.startsWith(`${to}/`))

/** 저장에 실패하면 화면 위에 띄운다. 조용히 사라지는 것보다 낫다. */
function SaveErrorBanner() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const onFailed = (event: Event) => setMessage(String((event as CustomEvent).detail))
    window.addEventListener('breevo:save-failed', onFailed)
    return () => window.removeEventListener('breevo:save-failed', onFailed)
  }, [])

  if (!message) return null

  return (
    <div className="border-b border-rose-200 bg-rose-50 px-6 py-2.5">
      <div className="flex items-start gap-3">
        <p className="flex-1 text-sm text-rose-800">
          <b>저장하지 못했습니다.</b> 적은 내용은 새로고침하면 사라집니다.
          <span className="ml-1 text-xs text-rose-600">{message}</span>
        </p>
        <button
          type="button"
          onClick={() => setMessage(null)}
          className="shrink-0 text-sm text-rose-400 hover:text-rose-700"
        >
          ×
        </button>
      </div>
    </div>
  )
}

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
          <p className="text-xs font-semibold tracking-widest text-violet-600">Breevo</p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">마케팅 허브</p>
        </Link>

        <nav className="flex-1 space-y-0.5 px-3">
          {navGroups.map((group, index) => (
            <div key={group.title} className={index === 0 ? 'pt-1' : 'pt-5'}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-slate-400">
                {group.title}
              </p>
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

        <SaveErrorBanner />

        <main className="flex-1 overflow-x-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
