import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from '@/auth/LoginPage'
import ProtectedRoute from '@/auth/ProtectedRoute'
import SignupPage from '@/auth/SignupPage'
import AppShell from '@/components/layout/AppShell'
import CalendarPage from '@/features/calendar/CalendarPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import DoNotContactPage from '@/features/dnc/DoNotContactPage'
import RejectedListPage from '@/features/rejected/RejectedListPage'
import InfluencerDetailPage from '@/features/influencers/InfluencerDetailPage'
import InfluencerFormPage from '@/features/influencers/InfluencerFormPage'
import InfluencerListPage from '@/features/influencers/InfluencerListPage'
import PipelinePage from '@/features/pipeline/PipelinePage'
import ShipmentsPage from '@/features/shipments/ShipmentsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/influencers" element={<InfluencerListPage />} />
          <Route path="/influencers/new" element={<InfluencerFormPage />} />
          <Route path="/influencers/:id" element={<InfluencerDetailPage />} />
          <Route path="/influencers/:id/edit" element={<InfluencerFormPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/rejected" element={<RejectedListPage />} />
          <Route path="/do-not-contact" element={<DoNotContactPage />} />
          <Route path="/shipments" element={<ShipmentsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
