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
        <Route path="google-reviews" element={<div className="p-6"><h1 className="text-2xl font-bold">Google Reviews</h1><p className="text-gray-500 mt-2">Google Business Profile — Not Connected — Configuration Required</p></div>} />
        <Route path="ai-replies" element={<div className="p-6"><h1 className="text-2xl font-bold">AI Replies</h1><p className="text-gray-500 mt-2">Connect Google Business Profile to enable AI reply generation.</p></div>} />
        <Route path="alerts" element={<div className="p-6"><h1 className="text-2xl font-bold">Reputation Alerts</h1><p className="text-gray-500 mt-2">Coming soon — alert rules for rating drops and sentiment changes.</p></div>} />
        <Route path="google-connection" element={<div className="p-6"><h1 className="text-2xl font-bold">Google Connection</h1><p className="text-gray-500 mt-2">Google OAuth integration will be configured here.</p></div>} />
      </Route>

      {/* Landing */}
      <Route path="/" element={<LandingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
