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
import { isTokenExpired, onSessionExpired } from './utils/apiClient';

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