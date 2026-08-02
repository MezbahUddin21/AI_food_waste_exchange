import { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Login from './auth/Login';
import Signup from './auth/Signup';
import Layout from './components/Layout';
import AdminPage from './pages/AdminPage';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import DonationDetail from './pages/DonationDetail';
import DonorDashboard from './pages/DonorDashboard';
import EmergencyPage from './pages/EmergencyPage';
import Landing from './pages/Landing';
import NewDonation from './pages/NewDonation';
import NgoClaims from './pages/NgoClaims';
import NgoDashboard from './pages/NgoDashboard';
import ProfilePage from './pages/ProfilePage';
import { About, Contact, HowItWorks, NotFound } from './pages/StaticPages';
import VolunteerDashboard from './pages/VolunteerDashboard';

/** App home is role-dependent. */
function Home() {
  const { profile } = useAuth();
  switch (profile?.role) {
    case 'donor':
      return <DonorDashboard />;
    case 'ngo':
      return <NgoDashboard />;
    case 'volunteer':
      return <VolunteerDashboard />;
    case 'government':
    case 'admin':
      return <AnalyticsDashboard />;
    default:
      return <Navigate to="/signup" replace />;
  }
}

function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          Loading…
        </div>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<About />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* App (authenticated) */}
          <Route path="/app" element={<Protected><Home /></Protected>} />
          <Route path="/app/donations/new" element={<Protected><NewDonation /></Protected>} />
          <Route path="/app/donations/:id" element={<Protected><DonationDetail /></Protected>} />
          <Route path="/app/claims" element={<Protected><NgoClaims /></Protected>} />
          <Route path="/app/emergency" element={<Protected><EmergencyPage /></Protected>} />
          <Route path="/app/admin" element={<Protected><AdminPage /></Protected>} />
          <Route path="/app/profile" element={<Protected><ProfilePage /></Protected>} />
          <Route path="/app/impact" element={<Protected><AnalyticsDashboard /></Protected>} />

          {/* Legacy redirects (old paths before /app prefix) */}
          <Route path="/donations/new" element={<Navigate to="/app/donations/new" replace />} />
          <Route path="/claims" element={<Navigate to="/app/claims" replace />} />
          <Route path="/emergency" element={<Navigate to="/app/emergency" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
