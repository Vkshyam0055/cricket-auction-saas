import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import AddTeam from './pages/AddTeam';
import ManagePlayers from './pages/ManagePlayers';
import ControlPanel from './pages/ControlPanel';
import LiveScreen from './pages/LiveScreen';
import CreateTournament from './pages/CreateTournament';
import AddPlayer from './pages/AddPlayer';
import Teams from './pages/Teams';
import SuperAdmin from './pages/SuperAdmin';
import PublicPlayerRegistration from './pages/PublicPlayerRegistration'; // 🌟 नया इम्पोर्ट
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import CompleteProfileEmail from './pages/CompleteProfileEmail';
import { TournamentContext, TournamentProvider } from './context/TournamentContext';
import { isTokenExpired, onSessionExpired, apiRequest, clearAuthSession } from './utils/apiClient';

const ImpersonationBanner = () => {
  const adminToken = localStorage.getItem('adminToken');
  const impersonatingUser = localStorage.getItem('impersonatingUser');
  const impersonatedUserId = localStorage.getItem('impersonatedUserId');
  const navigate = React.useCallback(() => window.location.href = '/super-admin', []); // use location to force full reload

  if (!adminToken) return null;

  const handleExit = async () => {
    try {
      // 1. Kill the impersonation session
      const currentToken = localStorage.getItem('token');
      if (currentToken) {
        await apiRequest({
          method: 'post',
          path: '/api/auth/logout',
          headers: { Authorization: `Bearer ${currentToken}` }
        }).catch(() => {}); // Ignore error on logout
      }

      // 2. Log the exit event using the admin token
      if (impersonatedUserId) {
        await apiRequest({
          method: 'post',
          path: `/api/admin/impersonate/${impersonatedUserId}/exit`,
          headers: { Authorization: `Bearer ${adminToken}` }
        }).catch(e => console.error("Failed to log exit impersonation", e));
      }

      // 3. Restore the original admin token
      localStorage.setItem('token', adminToken);

      // 4. Clear the impersonation metadata
      localStorage.removeItem('adminToken');
      localStorage.removeItem('impersonatingUser');
      localStorage.removeItem('impersonatedUserId');

      // 5. Navigate back to super admin
      navigate();
    } catch (error) {
      console.error("Error exiting impersonation", error);
      // Fallback: force clear everything
      clearAuthSession();
      localStorage.removeItem('adminToken');
      localStorage.removeItem('impersonatingUser');
      localStorage.removeItem('impersonatedUserId');
      window.location.href = '/auth';
    }
  };

  return (
    <div className="bg-red-600 text-white p-3 text-center font-bold flex justify-center items-center space-x-4 shadow-lg sticky top-0 z-50">
      <span>⚠️ You are acting as {impersonatingUser || 'User'}</span>
      <button onClick={handleExit} className="bg-white text-red-600 px-4 py-1 rounded-md text-sm hover:bg-gray-100 transition-colors border border-red-200">
        Exit User Mode
      </button>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  if (!token || isTokenExpired(token)) {
    localStorage.removeItem('token');
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  return children;
};

const SessionExpiryWatcher = () => {
  const location = useLocation();
  const [expired, setExpired] = React.useState(false);

  React.useEffect(() => onSessionExpired(() => setExpired(true)), []);

  if (expired && location.pathname !== '/auth') {
    return <Navigate to="/auth" replace />;
  }
  return null;
};

function App() {
  return (
    <TournamentProvider>
      <BrowserRouter>
        <ImpersonationBanner />
        <SessionExpiryWatcher />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/complete-profile-email" element={<ProtectedRoute><CompleteProfileEmail /></ProtectedRoute>} />          
          
          {/* 🌟 FIX: यहाँ :tournamentId लगा दिया है ताकि यूनीक लिंक बन सके 🌟 */}
          <Route path="/register/:tournamentId" element={<PublicPlayerRegistration />} />
          
          <Route path="/super-admin" element={<ProtectedRoute><SuperAdmin /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/add-team" element={<ProtectedRoute><AddTeam /></ProtectedRoute>} />
          <Route path="/manage-players" element={<ProtectedRoute><ManagePlayers /></ProtectedRoute>} />
          <Route path="/control-panel" element={<ProtectedRoute><ControlPanel /></ProtectedRoute>} />
          <Route path="/create-tournament" element={<ProtectedRoute><CreateTournament /></ProtectedRoute>} />
          <Route path="/add-player" element={<ProtectedRoute><AddPlayer /></ProtectedRoute>} />
          <Route path="/teams" element={<ProtectedRoute><Teams /></ProtectedRoute>} />
          <Route path="/live" element={<LiveScreen />} />
        </Routes>
      </BrowserRouter>
    </TournamentProvider>
  );
}

export default App;