import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from '@/auth/LoginPage'
import ProtectedRoute from '@/auth/ProtectedRoute'
import SignupPage from '@/auth/SignupPage'
import AppShell from '@/components/layout/AppShell'
import AdsDashboardPage from '@/features/ads/AdsDashboardPage'
import AdsManagePage from '@/features/ads/AdsManagePage'
import CreativePerformancePage from '@/features/ads/CreativePerformancePage'
import CalendarPage from '@/features/calendar/CalendarPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import DiscoveryPage from '@/features/discovery/DiscoveryPage'
import RejectedListPage from '@/features/rejected/RejectedListPage'
import InfluencerDetailPage from '@/features/influencers/InfluencerDetailPage'
import InfluencerFormPage from '@/features/influencers/InfluencerFormPage'
import InfluencerListPage from '@/features/influencers/InfluencerListPage'
import PerformancePage from '@/features/performance/PerformancePage'
import PipelinePage from '@/features/pipeline/PipelinePage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/discovery" element={<DiscoveryPage />} />
          <Route path="/influencers" element={<InfluencerListPage />} />
          <Route path="/influencers/new" element={<InfluencerFormPage />} />
          <Route path="/influencers/:id" element={<InfluencerDetailPage />} />
          <Route path="/influencers/:id/edit" element={<InfluencerFormPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/rejected" element={<RejectedListPage />} />
          {/* 예전 주소로 들어오면 거절 명단으로 보낸다 */}
          <Route path="/do-not-contact" element={<Navigate to="/rejected" replace />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/ads" element={<AdsDashboardPage />} />
          <Route path="/ads/creatives" element={<CreativePerformancePage />} />
          <Route path="/ads/manage" element={<AdsManagePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
