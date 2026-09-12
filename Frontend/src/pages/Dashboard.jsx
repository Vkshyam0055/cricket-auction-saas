import React, { useContext, useEffect, useMemo, useState } from 'react';
import HamburgerMenu from '../components/HamburgerMenu';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TournamentContext } from '../context/TournamentContext';

const PLAN_POLICIES = {
  Free: { teamLimit: 3, canViewTeams: false, canPublicRegistration: false },
  Basic: { teamLimit: 8, canViewTeams: true, canPublicRegistration: false },
  Pro: { teamLimit: -1, canViewTeams: true, canPublicRegistration: true }
};

const normalizePlanName = (planName = 'Free') => {
  if (['Pro', 'Pro Plan'].includes(planName)) return 'Pro';
  if (['Basic', 'Basic Plan'].includes(planName)) return 'Basic';
  return 'Free';
};

// 🌟 Live Server API 🌟
const API_BASE_CANDIDATES = Array.from(new Set([
  localStorage.getItem('apiBaseUrl'),
  import.meta.env.VITE_API_URL,
  'http://localhost:5000'
].filter(Boolean).map((url) => String(url).replace(/\/$/, ''))));

const buildApiUrl = (baseUrl, path) => {
  const normalizedBase = String(baseUrl || '').replace(/\/$/, '');
  const normalizedPath = String(path || '').trim();
  const requestPath = normalizedBase.endsWith('/api') && normalizedPath.startsWith('/api/')
    ? normalizedPath.replace(/^\/api/, '')
    : normalizedPath;
  return `${normalizedBase}${requestPath}`;
}; 

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [organizerEmail, setOrganizerEmail] = useState('');  
  const [registrationLinkMessage, setRegistrationLinkMessage] = useState('');

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
    const storedEmail = localStorage.getItem('organizerEmail');
    if (storedEmail) setOrganizerEmail(storedEmail);    
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        let teamsRes = null;
        let playersRes = null;
        let usedBase = '';
        let lastError = null;
        for (const baseUrl of API_BASE_CANDIDATES) {
          try {
            teamsRes = await axios.get(buildApiUrl(baseUrl, '/api/teams'), { headers });
            playersRes = await axios.get(buildApiUrl(baseUrl, '/api/players'), { headers });
            usedBase = String(baseUrl).replace(/\/$/, '');
            break;
          } catch (error) {
            lastError = error;
          }
        }
        if (!teamsRes || !playersRes) throw lastError;
        if (usedBase) localStorage.setItem('apiBaseUrl', usedBase);
        setTotalTeams(teamsRes.data.length);
        setTotalPlayers(playersRes.data.length);
      } catch (error) { console.error('डेटा लाने में दिक्कत:', error); }
    };
    if (tournament) fetchDashboardData();
  }, [tournament]);

  const handleLogout = async () => {
    const deviceId = localStorage.getItem('deviceId');
    try {
      const phone = localStorage.getItem('organizerPhone');
      const token = localStorage.getItem('token');
      if (deviceId) {
        for (const baseUrl of API_BASE_CANDIDATES) {
          try {
            await axios.post(
              buildApiUrl(baseUrl, '/api/auth/logout'),
              { phone, deviceId },
              token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
            );
            break;
          } catch (error) {
            // try next base
          }
        }
      }
    } catch (error) { console.error(error); }
    localStorage.clear();
    if (deviceId) localStorage.setItem('deviceId', deviceId);
    navigate('/');
  };

  const handleUpgradeClick = () => alert('🚀 फीचर अनलॉक करने के लिए अपने प्लान को अपग्रेड करें। सहायता के लिए एडमिन से संपर्क करें।');

  const copyTextToClipboard = async (text) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (!copied) throw new Error('Clipboard copy failed');
  };

  const handleCopyRegistrationLink = async () => {
    if (!publicRegistrationUrl) return;
    try {
      await copyTextToClipboard(publicRegistrationUrl);
      setRegistrationLinkMessage('Registration link copied!');
    } catch (error) {
      console.error('Registration link copy failed:', error);
      setRegistrationLinkMessage('Could not copy the link. Please copy it manually.');
    }
  };

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

      let res = null;
      let usedBase = '';
      let lastError = null;
      for (const baseUrl of API_BASE_CANDIDATES) {
        try {
          res = await axios.patch(
            buildApiUrl(baseUrl, '/api/tournament/registration-status'),
            { isRegistrationOpen: newStatus },
            { headers }
          );
          usedBase = String(baseUrl).replace(/\/$/, '');
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!res) throw lastError;
      if (usedBase) localStorage.setItem('apiBaseUrl', usedBase);
        
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

  if (loading || !tournament) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mb-4"></div>
          <p className="font-bold text-lg text-slate-600">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-200 selection:text-blue-900">
      <HamburgerMenu open={menuOpen} onClose={() => setMenuOpen(false)} profile={{name: organizerName, email: organizerEmail, phone: localStorage.getItem('organizerPhone')}} onLogout={handleLogout} onNavigate={(item)=>{ setMenuOpen(false); if (item==='Create Auction') navigate('/create-tournament'); if (item==='My Auction') navigate('/dashboard'); if (item==='Join as Player' && tournament?._id) window.open(`${window.location.origin}/register/${tournament._id}`, '_blank'); if (item==='View Auction') navigate('/live'); if (item==='Reset Password') navigate('/forgot-password'); }} />      

      {/* 🌟 Modern Navbar 🌟 */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-40 px-6 py-4 flex flex-col md:flex-row justify-between items-center shadow-sm gap-4 md:gap-0 transition-all">
        <div className="flex items-center space-x-4">
          {tournament.logoUrl ? (
            <img src={tournament.logoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-cover bg-white shadow-md border border-slate-100" />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-2xl">🏏</span>
            </div>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center">
              {tournament.name}
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5 flex items-center">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
              Control Room
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 bg-slate-100/50 p-1.5 rounded-full border border-slate-200/50">
          <div className="flex items-center space-x-3 pl-2 pr-4 cursor-default">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black rounded-full w-10 h-10 flex items-center justify-center text-lg shadow-sm">
              {organizerName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:flex flex-col items-start justify-center">
              <span className="font-bold text-sm tracking-wide text-slate-800 leading-tight">{organizerName}</span>
              <span className={`text-[10px] font-black uppercase tracking-widest ${normalizedPlan === 'Pro' ? 'text-blue-600' : 'text-slate-500'}`}>
                {normalizedPlan} PLAN
              </span>
            </div>
          </div>
          <button onClick={() => setMenuOpen(true)} className="bg-white p-2.5 rounded-full hover:bg-slate-50 border border-slate-200 text-slate-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Welcome Back, {organizerName}! 👋</h2>
          <p className="text-slate-500 font-medium mt-1 text-sm md:text-base">Here is what's happening with your auction today.</p>
        </div>

        {/* 🌟 KPI Cards 🌟 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-shadow">
            <div>
              <h3 className="text-slate-500 text-xs uppercase font-bold tracking-widest mb-1">Total Teams</h3>
              <p className="text-4xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{totalTeams}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-shadow">
            <div>
              <h3 className="text-slate-500 text-xs uppercase font-bold tracking-widest mb-1">Total Players</h3>
              <p className="text-4xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{totalPlayers}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-shadow">
            <div>
              <h3 className="text-slate-500 text-xs uppercase font-bold tracking-widest mb-1">Auction Status</h3>
              <p className="text-xl font-black text-slate-900 mt-2">Ready to Start 🚀</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-yellow-50 flex items-center justify-center text-yellow-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 🌟 Live Auction Controls 🌟 */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-blue-50 rounded-full opacity-50 blur-3xl pointer-events-none"></div>

          <div className="flex items-center mb-6">
            <span className="flex h-3 w-3 relative mr-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Live Auction Controls</h3>
          </div>

          <div className="flex flex-col md:flex-row gap-5">
            <button onClick={() => navigate('/control-panel')} className="flex-1 bg-gradient-to-br from-blue-600 to-indigo-700 text-white px-6 py-6 rounded-2xl font-bold text-lg shadow-[0_8px_20px_rgba(37,99,235,0.2)] hover:shadow-[0_12px_25px_rgba(37,99,235,0.3)] hover:-translate-y-1 transition-all duration-300 flex items-center justify-center group">
              <span className="text-2xl mr-3 bg-white/20 p-2 rounded-xl group-hover:scale-110 transition-transform">⚙️</span>
              <span>Open Auctioneer Panel</span>
            </button>
            <button onClick={() => navigate('/live')} className="flex-1 bg-slate-900 text-white px-6 py-6 rounded-2xl font-bold text-lg shadow-[0_8px_20px_rgba(15,23,42,0.2)] hover:shadow-[0_12px_25px_rgba(15,23,42,0.3)] hover:-translate-y-1 transition-all duration-300 flex items-center justify-center group">
              <span className="text-2xl mr-3 bg-white/10 p-2 rounded-xl group-hover:scale-110 transition-transform">📺</span>
              <span>Open Audience Display</span>
            </button>
          </div>
        </div>

        {/* 🌟 Data Management 🌟 */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
          <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center">
            <span className="bg-slate-100 p-2 rounded-lg mr-3 text-lg">📂</span>
            <span className="uppercase tracking-tight">Data Management & Settings</span>
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <button onClick={() => navigate('/create-tournament')} className="bg-white text-slate-700 px-3 py-5 rounded-[1.25rem] font-bold border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all flex flex-col items-center justify-center gap-2 group">
              <span className="text-2xl group-hover:scale-110 transition-transform">🏆</span>
              <span className="text-sm">Edit Info</span>
            </button>
            <button onClick={() => navigate('/add-team')} className="bg-blue-50 text-blue-700 px-3 py-5 rounded-[1.25rem] font-bold border border-blue-100 hover:border-blue-200 hover:bg-blue-100/50 transition-all flex flex-col items-center justify-center gap-2 group">
              <span className="text-2xl group-hover:scale-110 transition-transform text-blue-500">➕</span>
              <span className="text-sm">Add Team</span>
            </button>
            <button onClick={() => navigate('/add-player')} className="bg-emerald-50 text-emerald-700 px-3 py-5 rounded-[1.25rem] font-bold border border-emerald-100 hover:border-emerald-200 hover:bg-emerald-100/50 transition-all flex flex-col items-center justify-center gap-2 group">
              <span className="text-2xl group-hover:scale-110 transition-transform text-emerald-500">➕</span>
              <span className="text-sm">Add Player</span>
            </button>
            <button onClick={() => activePolicy.canViewTeams ? navigate('/teams') : handleUpgradeClick()} className="bg-amber-50 text-amber-700 px-3 py-5 rounded-[1.25rem] font-bold border border-amber-100 hover:border-amber-200 hover:bg-amber-100/50 transition-all flex flex-col items-center justify-center gap-2 group">
              <span className="text-2xl group-hover:scale-110 transition-transform">📊</span>
              <span className="text-sm">View Teams</span>
            </button>
            <button onClick={() => navigate('/manage-players')} className="bg-red-50 text-red-700 px-3 py-5 rounded-[1.25rem] font-bold border border-red-100 hover:border-red-200 hover:bg-red-100/50 transition-all flex flex-col items-center justify-center gap-2 group">
              <span className="text-2xl group-hover:scale-110 transition-transform">🛠️</span>
              <span className="text-sm text-center leading-tight">Manage<br/>Players</span>
            </button>
            {organizerRole === 'SuperAdmin' && (
              <button onClick={() => navigate('/super-admin')} className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white px-3 py-5 rounded-[1.25rem] font-bold shadow-md hover:shadow-lg transition-all flex flex-col items-center justify-center gap-2 group">
                <span className="text-2xl group-hover:scale-110 transition-transform">👑</span>
                <span className="text-sm text-center leading-tight">Admin<br/>Panel</span>
              </button>
            )}
          </div>

          {!activePolicy.canPublicRegistration ? (
            <div className="mt-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center gap-3">
              <span className="text-2xl">🔒</span>
              <p className="text-slate-600 font-medium">Public Registration Link is <span className="text-blue-600 font-bold ml-1">Available in Pro.</span></p>
              <button onClick={handleUpgradeClick} className="ml-4 text-xs font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">Upgrade</button>
            </div>
          ) : (
            <div className="mt-8 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100/50 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto z-10">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-blue-100 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">Public Registration Link</h4>
                  <a href={publicRegistrationUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-medium hover:text-blue-800 hover:underline break-all text-sm">{publicRegistrationUrl}</a>
                </div>
              </div>
              
              <div className="flex flex-row items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-blue-200/50 pt-4 md:pt-0 z-10">
                <div className="flex flex-col items-center relative">
                  <button type="button" onClick={handleCopyRegistrationLink} title="Copy Link" className="bg-white hover:bg-blue-50 text-slate-700 border border-slate-200 w-10 h-10 rounded-xl font-bold flex items-center justify-center transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  {registrationLinkMessage && <span className={`absolute -bottom-5 text-[10px] font-bold ${registrationLinkMessage.includes('manual') ? 'text-red-500' : 'text-emerald-600'}`}>{registrationLinkMessage.includes('manual') ? 'Failed' : 'Copied!'}</span>}
                </div>

                <div className="h-8 w-px bg-blue-200 hidden md:block"></div>

                <div className="flex items-center space-x-3 bg-white py-2 px-3 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-bold text-slate-500 uppercase">Status</span>
                  <button
                    type="button"
                    onClick={handleRegistrationToggle}
                    disabled={isUpdatingRegistration}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${tournament?.isRegistrationOpen !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${tournament?.isRegistrationOpen !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className={`text-xs font-black uppercase w-8 text-center ${tournament?.isRegistrationOpen !== false ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {tournament?.isRegistrationOpen !== false ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
