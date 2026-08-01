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
import NewDonation from './pages/NewDonation';
import NgoClaims from './pages/NgoClaims';
import NgoDashboard from './pages/NgoDashboard';
import VolunteerDashboard from './pages/VolunteerDashboard';

/** Home is role-dependent. */
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
      return <p className="text-gray-500">Finish registration to continue.</p>;
  }
}

function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-gray-400">Loading…</div>;
  }
  if (!session) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Protected><Home /></Protected>} />
          <Route path="/donations/new" element={<Protected><NewDonation /></Protected>} />
          <Route path="/donations/:id" element={<Protected><DonationDetail /></Protected>} />
          <Route path="/claims" element={<Protected><NgoClaims /></Protected>} />
          <Route path="/emergency" element={<Protected><EmergencyPage /></Protected>} />
          <Route path="/admin" element={<Protected><AdminPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
