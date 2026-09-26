import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from '@/auth/LoginPage'
import ProtectedRoute from '@/auth/ProtectedRoute'
import SignupPage from '@/auth/SignupPage'
import AppShell from '@/components/layout/AppShell'
import AdsDashboardPage from '@/features/ads/AdsDashboardPage'
import AdsManagePage from '@/features/ads/AdsManagePage'
import CreativePerformancePage from '@/features/ads/CreativePerformancePage'
import CreativeUploadPage from '@/features/ads/CreativeUploadPage'
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
          <Route path="/ads" element={<AdsDashboardPage />} />
          <Route path="/ads/creatives" element={<CreativePerformancePage />} />
          <Route path="/ads/manage" element={<AdsManagePage />} />
          <Route path="/ads/upload" element={<CreativeUploadPage />} />
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
