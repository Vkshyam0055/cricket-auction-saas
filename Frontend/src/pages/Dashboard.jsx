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
  if (['Pro', 'Pro Plan', 'Premium', 'Premium Plan'].includes(planName)) return 'Pro';
  if (['Basic', 'Basic Plan'].includes(planName)) return 'Basic';
  return 'Free';
};

// 🌟 Live Server API 🌟
const API_BASE_URL = 'https://cricket-auction-backend-h8ud.onrender.com/api'; 

function Dashboard() {
  const navigate = useNavigate();
  // 🌟 FIX: यहाँ setTournament जोड़ दिया गया है ताकि UI तुरंत अपडेट हो सके 🌟
  const { tournament, loading, fetchTournament, setTournament } = useContext(TournamentContext);

  const [totalTeams, setTotalTeams] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [organizerName, setOrganizerName] = useState('Organizer');
  const [organizerPlan, setOrganizerPlan] = useState('Free');
  const [organizerRole, setOrganizerRole] = useState('Organizer');
  const [isUpdatingRegistration, setIsUpdatingRegistration] = useState(false);

  const normalizedPlan = useMemo(() => (organizerRole === 'SuperAdmin' ? 'Pro' : normalizePlanName(organizerPlan)), [organizerPlan, organizerRole]);
  const activePolicy = PLAN_POLICIES[normalizedPlan];

  const publicRegistrationUrl = useMemo(() => {
    if (!tournament?._id) return '';
    return `${window.location.origin}/register/${tournament._id}`;
  }, [tournament?._id]);

  useEffect(() => {
    if (!loading && !tournament) navigate('/create-tournament');
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
        const teamsRes = await axios.get(`${API_BASE_URL}/teams`, { headers });
        setTotalTeams(teamsRes.data.length);
        const playersRes = await axios.get(`${API_BASE_URL}/players`, { headers });
        setTotalPlayers(playersRes.data.length);
      } catch (error) { console.error('डेटा लाने में दिक्कत:', error); }
    };
    if (tournament) fetchDashboardData();
  }, [tournament]);

  const handleLogout = async () => {
    try {
      const phone = localStorage.getItem('organizerPhone');
      const deviceId = localStorage.getItem('deviceId');
      if (deviceId) await axios.post(`${API_BASE_URL}/auth/logout`, { phone, deviceId });
    } catch (error) { console.error(error); }
    localStorage.clear(); navigate('/');
  };

  const handleUpgradeClick = () => alert('🚀 फीचर अनलॉक करने के लिए अपने प्लान को अपग्रेड करें। सहायता के लिए एडमिन से संपर्क करें।');

  // 🌟 FIX: INSTANT TOGGLE LOGIC 🌟
  const handleRegistrationToggle = async () => {
    if (!tournament?._id || isUpdatingRegistration) return;
    try {
      setIsUpdatingRegistration(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // पता लगाओ कि अभी क्या स्टेटस है (अगर undefined है तो डिफ़ॉल्ट रूप से चालू (true) मानेंगे)
      const isCurrentlyOpen = tournament.isRegistrationOpen !== false; 
      const newStatus = !isCurrentlyOpen; // चालू है तो बंद करो, बंद है तो चालू करो

      const res = await axios.patch(`${API_BASE_URL}/tournament/registration-status`, 
        { isRegistrationOpen: newStatus }, { headers });
        
      if(res.data && res.data.tournament) {
          // 🌟 जादू: बिना रिफ्रेश किए तुरंत UI को अपडेट करो 🌟
          setTournament(res.data.tournament); 
      } else {
          await fetchTournament();
      }
    } catch (error) { 
      console.error(error);
      alert('Registration status update failed. Please check backend connection.'); 
    } finally { 
      setIsUpdatingRegistration(false); 
    }
  };

  if (loading || !tournament) return <div className="min-h-screen bg-gray-100 flex items-center justify-center font-bold text-xl">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-blue-800 p-4 text-white flex flex-col md:flex-row justify-between items-center shadow-lg gap-4 md:gap-0">
        <div className="flex items-center space-x-3">
          {tournament.logoUrl && <img src={tournament.logoUrl} alt="Logo" className="w-10 h-10 rounded-full bg-white border-2 border-blue-400" />}
          <h1 className="text-xl md:text-2xl font-black tracking-wide">🏏 {tournament.name} <span className="font-normal text-blue-300">| Control Room</span></h1>
        </div>

        <div className="flex items-center space-x-4 bg-blue-900 py-1 px-2 rounded-full border border-blue-700 shadow-inner">
          <div className="flex items-center space-x-2 pl-2 pr-2 cursor-default">
            <div className="bg-yellow-400 text-blue-900 font-black rounded-full w-9 h-9 flex items-center justify-center text-lg shadow-sm">
              {organizerName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:flex flex-col items-start justify-center">
              <span className="font-bold text-sm tracking-wide leading-tight">{organizerName}</span>
              <span className={`text-[10px] font-black uppercase tracking-widest ${normalizedPlan === 'Pro' ? 'text-green-300' : 'text-gray-300'}`}>
                {normalizedPlan} PLAN
              </span>
            </div>
          </div>
          <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-full hover:bg-red-600 font-bold shadow-md ml-2">Logout 🚪</button>
        </div>
      </nav>

      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-black text-gray-800 mb-6">Welcome Back, {organizerName}! 👋</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border-t-8 border-blue-500">
            <h3 className="text-gray-500 text-sm uppercase font-bold">Total Teams</h3>
            <p className="text-5xl font-black text-blue-600 mt-2">{totalTeams}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border-t-8 border-green-500">
            <h3 className="text-gray-500 text-sm uppercase font-bold">Total Players</h3>
            <p className="text-5xl font-black text-green-600 mt-2">{totalPlayers}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border-t-8 border-yellow-500">
            <h3 className="text-gray-500 text-sm uppercase font-bold">Auction Status</h3>
            <p className="text-2xl font-black text-yellow-600 mt-3">Ready to Start 🚀</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-lg mb-8 relative">
          <h3 className="text-xl font-black text-gray-800 mb-6 border-b pb-3 uppercase">🔴 Live Auction Controls</h3>
          <div className="flex flex-col md:flex-row gap-6 justify-center">
            <button onClick={() => navigate('/control-panel')} className="flex-1 bg-gradient-to-br from-blue-700 to-blue-900 text-white px-8 py-6 rounded-2xl font-black text-xl shadow-lg">⚙️ Open Auctioneer Panel</button>
            <button onClick={() => navigate('/live')} className="flex-1 bg-gradient-to-br from-purple-700 to-purple-900 text-white px-8 py-6 rounded-2xl font-black text-xl shadow-lg">📺 Open Audience Display</button>
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg border-2 border-gray-100">
          <h3 className="text-xl font-black text-gray-800 mb-6 border-b pb-3 uppercase">📂 Data Management & Settings</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <button onClick={() => navigate('/create-tournament')} className="bg-gray-50 text-gray-800 px-4 py-4 rounded-xl font-bold shadow-sm border border-gray-200">🏆 Edit Info</button>
            <button onClick={() => navigate('/add-team')} className="bg-blue-50 text-blue-800 px-4 py-4 rounded-xl font-bold border border-blue-200">➕ Add Team</button>
            <button onClick={() => navigate('/add-player')} className="bg-green-50 text-green-800 px-4 py-4 rounded-xl font-bold border border-green-200">➕ Add Player</button>
            <button onClick={() => activePolicy.canViewTeams ? navigate('/teams') : handleUpgradeClick()} className="bg-orange-50 text-orange-800 px-4 py-4 rounded-xl font-bold border border-orange-200">📊 View Teams</button>
            <button onClick={() => navigate('/manage-players')} className="bg-red-50 text-red-800 px-4 py-4 rounded-xl font-bold border border-red-200">🛠️ Manage Players</button>
            {organizerRole === 'SuperAdmin' && (
              <button onClick={() => navigate('/super-admin')} className="bg-purple-900 text-white px-4 py-4 rounded-xl font-black shadow-lg">👑 Admin Panel</button>
            )}
          </div>

          {!activePolicy.canPublicRegistration ? (
            <div className="mt-8 p-4 bg-gray-100 rounded-xl text-center grayscale">
              <span className="text-2xl">🔒</span> Public Registration Link: <span className="text-red-500 font-bold ml-1">Available in Pro.</span>
            </div>
          ) : (
            <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200 transition-all flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-col md:flex-row items-center gap-3">
                <span className="text-2xl">🔗</span>
                <p className="text-blue-900 font-bold">
                  Public Link: <a href={publicRegistrationUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 underline decoration-2 ml-1">{publicRegistrationUrl}</a>
                </p>
              </div>
              
              <div className="flex items-center space-x-3 bg-white p-2 rounded-xl border border-gray-300 shadow-sm">
                <span className="text-sm font-bold text-gray-600">Status:</span>
                <button
                  type="button"
                  onClick={handleRegistrationToggle}
                  disabled={isUpdatingRegistration}
                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${tournament?.isRegistrationOpen !== false ? 'bg-green-500' : 'bg-gray-400'}`}
                >
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${tournament?.isRegistrationOpen !== false ? 'translate-x-9' : 'translate-x-1'}`} />
                </button>
                <span className={`text-sm font-black uppercase ${tournament?.isRegistrationOpen !== false ? 'text-green-600' : 'text-red-500'}`}>
                  {tournament?.isRegistrationOpen !== false ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;