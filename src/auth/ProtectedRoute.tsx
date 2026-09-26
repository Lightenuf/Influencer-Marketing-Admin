import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Spinner } from '@/components/ui'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner />
  // 가려던 곳을 기억했다가 로그인 뒤 그리로 보낸다.
  // 슬랙 알림 링크를 눌렀는데 대시보드로 떨어지면 다시 찾아가야 한다.
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  return <Outlet />
}
