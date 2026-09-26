import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from '@/auth/LoginPage'
import ProtectedRoute from '@/auth/ProtectedRoute'
import SignupPage from '@/auth/SignupPage'
import AppShell from '@/components/layout/AppShell'
import ActionsPage from '@/features/ads/ActionsPage'
import AdsSettingsPage from '@/features/ads/AdsSettingsPage'
import InsightsPage from '@/features/ads/InsightsPage'
import ExperimentsPage from '@/features/ads/ExperimentsPage'
import StudioPage from '@/features/ads/StudioPage'
import CustomerGroupEditPage from '@/features/crm/CustomerGroupEditPage'
import CustomerGroupsPage from '@/features/crm/CustomerGroupsPage'
import CampaignDetailPage from '@/features/crm/CampaignDetailPage'
import CampaignSendPage from '@/features/crm/CampaignSendPage'
import CampaignsPage from '@/features/crm/CampaignsPage'
import CrmDashboardPage from '@/features/crm/CrmDashboardPage'
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
          {/* 캘린더는 마켓 관리 화면 아래로 들어갔다 */}
          <Route path="/calendar" element={<Navigate to="/performance" replace />} />
          {/* 옛 주소는 깨뜨리지 않는다. 북마크와 링크가 남아 있다 (원칙 6) */}
          <Route path="/ads" element={<Navigate to="/ads/actions" replace />} />
          <Route
            path="/ads/creatives"
            element={<Navigate to="/ads/insights?tab=creative" replace />}
          />
          <Route path="/ads/manage" element={<Navigate to="/ads/insights?tab=budget" replace />} />
          <Route path="/ads/upload" element={<Navigate to="/ads/studio?tab=upload" replace />} />
          <Route path="/ads/actions" element={<ActionsPage />} />
          <Route path="/ads/insights" element={<InsightsPage />} />
          <Route path="/ads/studio" element={<StudioPage />} />
          <Route path="/ads/experiments" element={<ExperimentsPage />} />
          <Route
            path="/ads/tagging"
            element={<Navigate to="/ads/settings?tab=tagging" replace />}
          />
          <Route path="/ads/settings" element={<AdsSettingsPage />} />
          <Route path="/crm/groups" element={<CustomerGroupsPage />} />
          <Route path="/crm/groups/new" element={<CustomerGroupEditPage />} />
          <Route path="/crm/groups/:id" element={<CustomerGroupEditPage />} />
          <Route path="/crm" element={<CrmDashboardPage />} />
          <Route path="/crm/campaigns" element={<CampaignsPage />} />
          <Route path="/crm/campaigns/new" element={<CampaignSendPage />} />
          <Route path="/crm/campaigns/:id" element={<CampaignDetailPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
