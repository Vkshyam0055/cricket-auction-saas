import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TournamentProvider } from './context/TournamentContext'; // 🌟 नया इम्पोर्ट

import Login from './pages/Login';
import AddTeam from './pages/AddTeam';
import Dashboard from './pages/Dashboard';
import AddPlayer from './pages/AddPlayer';
import LiveScreen from './pages/LiveScreen';
import Teams from './pages/Teams';
import ControlPanel from './pages/ControlPanel';
import PublicPlayerRegistration from './pages/PublicPlayerRegistration';
import ManagePlayers from './pages/ManagePlayers';
import CreateTournament from './pages/CreateTournament';

function App() {
  return (
    <TournamentProvider> {/* 🌟 पूरे ऐप को प्रोवाइडर से कवर कर दिया */}
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/add-team" element={<AddTeam />} />
          <Route path="/add-player" element={<AddPlayer />} />
          <Route path="/live" element={<LiveScreen />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/control-panel" element={<ControlPanel />} />
          <Route path="/register-player" element={<PublicPlayerRegistration />} />
          <Route path="/manage-players" element={<ManagePlayers />} />
          <Route path="/create-tournament" element={<CreateTournament />} />
        </Routes>
      </BrowserRouter>
    </TournamentProvider>
  );
}

export default App;