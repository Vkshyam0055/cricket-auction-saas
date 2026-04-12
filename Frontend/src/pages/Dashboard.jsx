import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TournamentContext } from '../context/TournamentContext';

const PLAN_POLICIES = {
  Free: { teamLimit: 3, canViewTeams: false, canPublicRegistration: false },
  Basic: { teamLimit: 8, canViewTeams: true, canPublicRegistration: false },
  Pro: { teamLimit: -1, canViewTeams: true, canPublicRegistration: true }
};

const normalizePlanName = (planName = 'Free') => {
  if (planName === 'Free Plan') return 'Free';
  if (planName === 'Basic Plan') return 'Basic';
  if (planName === 'Pro Plan') return 'Pro';
  if (planName === 'Premium') return 'Pro';
  if (planName === 'Premium Plan') return 'Pro';
  return Object.prototype.hasOwnProperty.call(PLAN_POLICIES, planName) ? planName : 'Free';
};

const API_BASE_URL = 'https://cricket-auction-backend-h8ud.onrender.com/api';

function Dashboard() {
  const navigate = useNavigate();
  const { tournament, loading } = useContext(TournamentContext);

  const [totalTeams, setTotalTeams] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [organizerName, setOrganizerName] = useState('Organizer');
  const [organizerPlan, setOrganizerPlan] = useState('Free');
  const [organizerRole, setOrganizerRole] = useState('Organizer');

  const normalizedPlan = useMemo(
    () => (organizerRole === 'SuperAdmin' ? 'Pro' : normalizePlanName(organizerPlan)),
    [organizerPlan, organizerRole]
  );
  const activePolicy = PLAN_POLICIES[normalizedPlan];

  useEffect(() => {
    if (!loading && !tournament) {
      navigate('/create-tournament');
    }
  }, [loading, tournament, navigate]);

  useEffect(() => {
    const storedName = localStorage.getItem('organizerName');
    const storedPlan = localStorage.getItem('organizerPlan');
    const storedRole = localStorage.getItem('organizerRole');

    if (storedName) setOrganizerName(storedName);
    if (storedPlan) setOrganizerPlan(storedPlan);
    if (storedRole) setOrganizerRole(storedRole);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const headers = { Authorization: `Bearer ${token}` };
        const [teamsResponse, playersResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/teams`, { headers }),
          axios.get(`${API_BASE_URL}/players`, { headers })
        ]);

        setTotalTeams(Array.isArray(teamsResponse.data) ? teamsResponse.data.length : 0);
        setTotalPlayers(Array.isArray(playersResponse.data) ? playersResponse.data.length : 0);
      } catch (error) {
        console.error('डेटा लाने में दिक्कत:', error);
      }
    };

    if (tournament) {
      fetchDashboardData();
    }
  }, [tournament]);

  const handleLogout = async () => {
    try {
      const phone = localStorage.getItem('organizerPhone');
      const deviceId = localStorage.getItem('deviceId');

      if (deviceId) {
        await axios.post(`${API_BASE_URL}/auth/logout`, { phone, deviceId });
      }
    } catch (error) {
      console.error('लॉगआउट सर्वर एरर:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('organizerName');
      localStorage.removeItem('organizerPhone');
      localStorage.removeItem('organizerPlan');
      localStorage.removeItem('organizerRole');
      localStorage.removeItem('currentPlayer');
      localStorage.removeItem('currentBid');
      localStorage.removeItem('biddingTeam');
      localStorage.removeItem('playerStatus');
      navigate('/');
    }
  };

  const handleUpgradeClick = () => {
    alert('🚀 फीचर अनलॉक करने के लिए अपने प्लान को अपग्रेड करें। सहायता के लिए एडमिन से संपर्क करें।');
  };

  const handleViewTeamsClick = () => {
    if (!activePolicy.canViewTeams) {
      alert('🔒 View Teams फीचर आपके प्लान में उपलब्ध नहीं है। कृपया अपग्रेड करें।');
      return;
    }
    navigate('/teams');
  };

  if (loading || !tournament) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center font-bold text-xl">Loading Dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-blue-800 p-4 text-white flex flex-col md:flex-row justify-between items-center shadow-lg gap-4 md:gap-0">
        <div className="flex items-center space-x-3">
          {tournament.logoUrl && <img src={tournament.logoUrl} alt="Logo" className="w-10 h-10 rounded-full bg-white border-2 border-blue-400" />}
          <h1 className="text-xl md:text-2xl font-black tracking-wide">
            🏏 {tournament.name} <span className="font-normal text-blue-300">| Control Room</span>
          </h1>
        </div>

        <div className="flex items-center space-x-4 bg-blue-900 py-1 px-2 rounded-full border border-blue-700 shadow-inner">
          <div className="flex items-center space-x-2 pl-2 pr-2 cursor-default">
            <div className="bg-yellow-400 text-blue-900 font-black rounded-full w-9 h-9 flex items-center justify-center text-lg shadow-sm">
              {organizerName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:flex flex-col items-start justify-center">
              <span className="font-bold text-sm tracking-wide leading-tight">{organizerName}</span>
              <span
                className={`text-[10px] font-black uppercase tracking-widest ${
                  normalizedPlan === 'Pro' ? 'text-green-300' : normalizedPlan === 'Basic' ? 'text-blue-300' : 'text-gray-300'
                }`}
              >
                {normalizedPlan} PLAN
              </span>
            </div>
          </div>

          <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-full hover:bg-red-600 font-bold transition-all shadow-md flex items-center space-x-2 text-sm active:scale-95 ml-2">
            <span>Logout</span>
            <span className="text-lg">🚪</span>
          </button>
        </div>
      </nav>

      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-black text-gray-800 mb-6">Welcome Back, {organizerName}! 👋</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border-t-8 border-blue-500 hover:-translate-y-1 transition-transform">
            <h3 className="text-gray-500 text-sm uppercase tracking-wider font-bold">Total Teams</h3>
            <p className="text-5xl font-black text-blue-600 mt-2">{totalTeams}</p>
            <p className="text-xs text-gray-500 mt-2">Team Limit: {activePolicy.teamLimit === -1 ? 'Unlimited' : activePolicy.teamLimit}</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-t-8 border-green-500 hover:-translate-y-1 transition-transform">
            <h3 className="text-gray-500 text-sm uppercase tracking-wider font-bold">Total Players</h3>
            <p className="text-5xl font-black text-green-600 mt-2">{totalPlayers}</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-t-8 border-yellow-500 hover:-translate-y-1 transition-transform">
            <h3 className="text-gray-500 text-sm uppercase tracking-wider font-bold">Auction Status</h3>
            <p className="text-2xl font-black text-yellow-600 mt-3 flex items-center">
              Ready to Start <span className="ml-2 text-3xl">🚀</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-lg border-2 border-gray-100 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-10 -mt-10 blur-2xl" />
          <h3 className="text-xl font-black text-gray-800 mb-6 border-b pb-3 relative z-10 uppercase tracking-wide">🔴 Live Auction Controls</h3>
          <div className="flex flex-col md:flex-row gap-6 justify-center relative z-10">
            <button onClick={() => navigate('/control-panel')} className="flex-1 bg-gradient-to-br from-blue-700 to-blue-900 text-white px-8 py-6 rounded-2xl font-black text-xl hover:shadow-2xl hover:from-blue-600 hover:to-blue-800 transition-all border border-blue-500 shadow-lg active:scale-[0.98]">
              <div className="text-3xl mb-2">⚙️</div>
              Open Auctioneer Panel
              <br />
              <span className="text-xs font-semibold text-blue-300 uppercase tracking-widest mt-1 block opacity-80">(For Admin Only)</span>
            </button>
            <button onClick={() => navigate('/live')} className="flex-1 bg-gradient-to-br from-purple-700 to-purple-900 text-white px-8 py-6 rounded-2xl font-black text-xl hover:shadow-2xl hover:from-purple-600 hover:to-purple-800 transition-all border border-purple-500 shadow-lg active:scale-[0.98]">
              <div className="text-3xl mb-2">📺</div>
              Open Audience Display
              <br />
              <span className="text-xs font-semibold text-purple-300 uppercase tracking-widest mt-1 block opacity-80">(For Projector/TV)</span>
            </button>
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg border-2 border-gray-100">
          <h3 className="text-xl font-black text-gray-800 mb-6 border-b pb-3 uppercase tracking-wide">📂 Data Management & Settings</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <button onClick={() => navigate('/create-tournament')} className="bg-gray-50 text-gray-800 px-4 py-4 rounded-xl font-bold hover:bg-gray-100 shadow-sm border border-gray-200 transition flex flex-col items-center text-center text-sm">
              <span className="text-2xl mb-1">🏆</span> Edit Tournament Info
            </button>

            <button onClick={() => navigate('/add-team')} className="bg-blue-50 text-blue-800 px-4 py-4 rounded-xl font-bold hover:bg-blue-100 shadow-sm border border-blue-200 transition flex flex-col items-center text-center text-sm">
              <span className="text-2xl mb-1">➕</span> Add Team
            </button>

            <button onClick={() => navigate('/add-player')} className="bg-green-50 text-green-800 px-4 py-4 rounded-xl font-bold hover:bg-green-100 shadow-sm border border-green-200 transition flex flex-col items-center text-center text-sm">
              <span className="text-2xl mb-1">➕</span> Add Player
            </button>

            <button
              onClick={handleViewTeamsClick}
              className={`px-4 py-4 rounded-xl font-bold shadow-sm border transition flex flex-col items-center text-center text-sm ${
                activePolicy.canViewTeams ? 'bg-orange-50 text-orange-800 hover:bg-orange-100 border-orange-200' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              }`}
              title={activePolicy.canViewTeams ? 'View Teams' : 'Locked in Free plan'}
            >
              <span className="text-2xl mb-1">📊</span> View Teams
            </button>

            <button onClick={() => navigate('/manage-players')} className="bg-red-50 text-red-800 px-4 py-4 rounded-xl font-bold hover:bg-red-100 shadow-sm border border-red-200 transition flex flex-col items-center text-center text-sm">
              <span className="text-2xl mb-1">🛠️</span> Manage Players
            </button>

            {organizerRole === 'SuperAdmin' && (
              <button onClick={() => navigate('/super-admin')} className="bg-purple-900 text-white px-4 py-4 rounded-xl font-black hover:bg-purple-800 shadow-lg border border-purple-700 transition flex flex-col items-center text-center text-sm animate-pulse">
                <span className="text-2xl mb-1">👑</span> Developer Panel
              </button>
            )}
          </div>

          {!activePolicy.canPublicRegistration ? (
            <div className="mt-8 p-4 bg-gray-100 rounded-xl border border-gray-300 text-center flex flex-col md:flex-row items-center justify-center gap-2 grayscale transition-all">
              <span className="text-2xl">🔒</span>
              <p className="text-gray-500 font-bold">
                Public Registration Link: <span className="text-red-500 ml-1">Available only in Pro.</span>
                <button onClick={handleUpgradeClick} className="text-blue-600 hover:text-blue-800 underline decoration-2 underline-offset-4 ml-2 font-black">Upgrade Now</button>
              </p>
            </div>
          ) : (
            <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200 text-center flex flex-col md:flex-row items-center justify-center gap-2 transition-all">
              <span className="text-2xl">🔗</span>
              <p className="text-blue-900 font-bold">
                Public Registration Link:{' '}
                <a href="https://live-cric-auction.netlify.app/register-player" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 underline decoration-2 underline-offset-4 ml-1">
                  Share this with players
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;