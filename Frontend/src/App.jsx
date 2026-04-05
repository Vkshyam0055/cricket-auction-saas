import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage'; // 🌟 नया होमपेज
import Auth from './pages/Auth'; // 🌟 लॉगिन/रजिस्टर पेज
import Dashboard from './pages/Dashboard';
import AddTeam from './pages/AddTeam';
import ManagePlayers from './pages/ManagePlayers';
import ControlPanel from './pages/ControlPanel';
import LiveScreen from './pages/LiveScreen';
import CreateTournament from './pages/CreateTournament';
import AddPlayer from './pages/AddPlayer';
import Teams from './pages/Teams';
import SuperAdmin from './pages/SuperAdmin'; // 🌟 ऊपर इम्पोर्ट करें
import { TournamentContext, TournamentProvider } from './context/TournamentContext';

// 🛡️ Frontend Security Guard 🛡️
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    // अगर टोकन नहीं है, तो लॉगिन पेज पर भेजो
    return <Navigate to="/auth" />;
  }
  
  return children;
};

function App() {
  return (
    <TournamentProvider>
      <BrowserRouter>
        <Routes>
          {/* 🌟 Open Routes: कोई भी देख सकता है 🌟 */}
          <Route path="/" element={<LandingPage />} /> {/* दुकान का फ्रंट */}
          <Route path="/auth" element={<Auth />} /> {/* लॉगिन दरवाज़ा */}
          <Route path="/super-admin" element={<ProtectedRoute><SuperAdmin /></ProtectedRoute>} />
          {/* 🔒 Protected Routes: सिर्फ लॉगिन वाले यूज़र ही देख सकते हैं */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/add-team" element={<ProtectedRoute><AddTeam /></ProtectedRoute>} />
          <Route path="/manage-players" element={<ProtectedRoute><ManagePlayers /></ProtectedRoute>} />
          <Route path="/control-panel" element={<ProtectedRoute><ControlPanel /></ProtectedRoute>} />
          <Route path="/create-tournament" element={<ProtectedRoute><CreateTournament /></ProtectedRoute>} />
          <Route path="/add-player" element={<ProtectedRoute><AddPlayer /></ProtectedRoute>} />
          <Route path="/teams" element={<ProtectedRoute><Teams /></ProtectedRoute>} />
          
          {/* Live Screen */}
          <Route path="/live" element={<LiveScreen />} />
        </Routes>
      </BrowserRouter>
    </TournamentProvider>
  );
}

export default App;