import { Routes, Route, Navigate } from 'react-router-dom';
import { ReviewFlow } from './pages/customer/ReviewFlow';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { OverviewPage } from './pages/dashboard/OverviewPage';
import { FeedbackInboxPage } from './pages/dashboard/FeedbackInboxPage';
import { QuestionBuilderPage } from './pages/dashboard/QuestionBuilderPage';
import { QRStudioPage } from './pages/dashboard/QRStudioPage';
import { AnalyticsPage } from './pages/dashboard/AnalyticsPage';
import { SettingsPage } from './pages/dashboard/SettingsPage';
import { LandingPage } from './pages/LandingPage';
import AlertsPage from './pages/dashboard/AlertsPage';
import GoogleConnectionPage from './pages/dashboard/GoogleConnectionPage';
import GoogleReviewsPage from './pages/dashboard/GoogleReviewsPage';
import AIRepliesPage from './pages/dashboard/AIRepliesPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import BusinessManagementPage from './pages/admin/BusinessManagementPage';
import CategoryManagementPage from './pages/admin/CategoryManagementPage';
import SystemHealthPage from './pages/admin/SystemHealthPage';
import UserManagementPage from './pages/admin/UserManagementPage';

export default function App() {
  return (
    <Routes>
      {/* Public - Customer Review Flow */}
      <Route path="/review/:businessSlug/*" element={<ReviewFlow />} />

      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Protected - Business Dashboard */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<OverviewPage />} />
        <Route path="feedback" element={<FeedbackInboxPage />} />
        <Route path="questions" element={<QuestionBuilderPage />} />
        <Route path="qr-studio" element={<QRStudioPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="google-reviews" element={<GoogleReviewsPage />} />
        <Route path="ai-replies" element={<AIRepliesPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="google-connection" element={<GoogleConnectionPage />} />
      </Route>

      {/* Protected - Admin */}
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboardPage />} />
        <Route path="businesses" element={<BusinessManagementPage />} />
        <Route path="categories" element={<CategoryManagementPage />} />
        <Route path="users" element={<UserManagementPage />} />
        <Route path="health" element={<SystemHealthPage />} />
      </Route>

      {/* Landing */}
      <Route path="/" element={<LandingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
