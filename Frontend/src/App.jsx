import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { TournamentContext, TournamentProvider } from './context/TournamentContext';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/auth" />;
  return children;
};

function App() {
  return (
    <TournamentProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<Auth />} />
          
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