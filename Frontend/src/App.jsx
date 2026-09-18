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
import { 
  isTokenExpired, 
  onSessionExpired, 
  apiRequest, 
  clearAuthSession, 
  restoreSuperAdminSession, 
  clearAllAuthSessions 
} from './utils/apiClient';

const ImpersonationBanner = () => {
  const [isExiting, setIsExiting] = React.useState(false);
  const adminToken = localStorage.getItem('adminToken');
  const impersonatingUser = localStorage.getItem('impersonatingUser');
  const impersonatingPlan = localStorage.getItem('impersonatingPlan');

  if (!adminToken) return null;

  const handleExit = async () => {
    if (isExiting) return;
    setIsExiting(true);
    const currentToken = localStorage.getItem('token');
    const impersonatedUserId = localStorage.getItem('impersonatedUserId');
    const sessionId = localStorage.getItem('impersonationSessionId');

    try {
      // 1. Log the exit event and revoke session on backend using admin token
      if (impersonatedUserId && adminToken) {
        await apiRequest({
          method: 'post',
          path: `/api/admin/impersonate/${impersonatedUserId}/exit`,
          data: { sessionId },
          headers: { Authorization: `Bearer ${adminToken}` }
        }).catch((e) => console.warn("Exit API notice:", e));
      }

      // 2. Kill the impersonated user session on backend
      if (currentToken) {
        await apiRequest({
          method: 'post',
          path: '/api/auth/logout',
          headers: { Authorization: `Bearer ${currentToken}` }
        }).catch(() => {});
      }
    } catch (error) {
      console.error("Error exiting impersonation", error);
    } finally {
      // 3. Always restore original Super Admin session safely
      restoreSuperAdminSession();
      // 4. Navigate back to super admin
      window.location.href = '/super-admin';
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-600 via-red-600 to-amber-700 text-white px-4 py-2.5 shadow-xl sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-300/40 backdrop-blur-sm">
      <div className="flex items-center space-x-2 text-sm md:text-base font-bold tracking-wide">
        <span className="text-xl animate-pulse">⚠️</span>
        <span>
          You are currently viewing as <span className="underline decoration-amber-300 font-extrabold">{impersonatingUser || 'User'}</span>
          {impersonatingPlan ? <span className="ml-2 text-xs uppercase bg-black/30 px-2 py-0.5 rounded font-mono font-semibold">{impersonatingPlan} Plan</span> : null}
        </span>
      </div>
      <button 
        onClick={handleExit}
        disabled={isExiting}
        className="bg-white text-red-700 hover:bg-amber-50 active:bg-gray-100 font-black text-xs md:text-sm px-4 py-1.5 rounded-lg shadow-md hover:shadow-lg transition-all border border-amber-200 uppercase tracking-wider flex items-center space-x-1.5 disabled:opacity-60 cursor-pointer"
      >
        <span>{isExiting ? 'Exiting...' : 'Exit / Return to Super Admin ↩'}</span>
      </button>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const adminToken = localStorage.getItem('adminToken');

  if (!token || isTokenExpired(token)) {
    // 🌟 Safe handling: If an impersonated token expired but admin token is still valid, recover back to super admin
    if (adminToken && !isTokenExpired(adminToken)) {
      restoreSuperAdminSession();
      return <Navigate to="/super-admin" replace />;
    }

    clearAllAuthSessions();
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  return children;
};

const SessionExpiryWatcher = () => {
  const location = useLocation();
  const [expired, setExpired] = React.useState(false);

  React.useEffect(() => onSessionExpired(() => setExpired(true)), []);

  if (expired && location.pathname !== '/auth') {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken && !isTokenExpired(adminToken)) {
      restoreSuperAdminSession();
      return <Navigate to="/super-admin" replace />;
    }
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