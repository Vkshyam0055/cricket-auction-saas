import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import AddTeam from './pages/AddTeam';
import ManagePlayers from './pages/ManagePlayers';
import ControlPanel from './pages/ControlPanel';
import LiveScreen from './pages/LiveScreen';

// 🌟 जो 3 पेजेज़ छूट गए थे, उन्हें यहाँ इम्पोर्ट कर लिया है 🌟
import CreateTournament from './pages/CreateTournament';
import AddPlayer from './pages/AddPlayer';
import Teams from './pages/Teams';

import { TournamentContext, TournamentProvider } from './context/TournamentContext';

// 🛡️ Frontend Security Guard 🛡️
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/" />;
  }
  
  return children;
};

function App() {
  return (
    <TournamentProvider>
      <BrowserRouter>
        <Routes>
          {/* 🔓 Open Route */}
          <Route path="/" element={<Auth />} />
          
          {/* 🔒 Protected Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/add-team" element={<ProtectedRoute><AddTeam /></ProtectedRoute>} />
          <Route path="/manage-players" element={<ProtectedRoute><ManagePlayers /></ProtectedRoute>} />
          <Route path="/control-panel" element={<ProtectedRoute><ControlPanel /></ProtectedRoute>} />
          
          {/* 🌟 छूटे हुए राउट्स अब यहाँ जोड़ दिए गए हैं 🌟 */}
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