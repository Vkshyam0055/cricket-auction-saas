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
import { apiRequest } from '../utils/apiClient';

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
        const teamsRes = await apiRequest({ path: '/api/teams', headers });
        const playersRes = await apiRequest({ path: '/api/players', headers });
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
        await apiRequest({
          method: 'post',
          path: '/api/auth/logout',
          data: { phone, deviceId },
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
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

      const res = await apiRequest({
        method: 'patch',
        path: '/api/tournament/registration-status',
        data: { isRegistrationOpen: newStatus },
        headers
      });
        
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
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="font-black text-lg tracking-tight">PRO AUCTION CONTROL ROOM</div>
        <p className="text-xs text-slate-400 font-medium mt-1">Loading tournament dashboard & live stats...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 font-sans text-slate-900 selection:bg-indigo-500 selection:text-white">
      <HamburgerMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        profile={{
          name: organizerName,
          email: organizerEmail,
          phone: localStorage.getItem('organizerPhone')
        }}
        onLogout={handleLogout}
        onNavigate={(item) => {
          setMenuOpen(false);
          if (item === 'Create Auction') navigate('/create-tournament');
          if (item === 'My Auction') navigate('/dashboard');
          if (item === 'Join as Player' && tournament?._id)
            window.open(`${window.location.origin}/register/${tournament._id}`, '_blank');
          if (item === 'View Auction') navigate('/live');
          if (item === 'Reset Password') navigate('/forgot-password');
        }}
      />

      {/* 🌟 Modern SaaS Navbar 🌟 */}
      <nav className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            {tournament.logoUrl ? (
              <img
                src={tournament.logoUrl}
                alt="Logo"
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white p-0.5 border border-slate-700 object-cover shrink-0"
              />
            ) : (
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-amber-400 p-0.5 shrink-0 shadow-sm">
                <div className="w-full h-full bg-slate-950 rounded-[9px] sm:rounded-[10px] flex items-center justify-center text-base sm:text-xl">
                  🏏
                </div>
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white truncate max-w-[170px] sm:max-w-sm">
                  {tournament.name}
                </h1>
                <span className="hidden sm:inline-flex text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Control Room
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium hidden sm:block">Tournament Management & Bidding Hub</p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="flex items-center space-x-2 bg-slate-800/80 px-2.5 sm:px-3 py-1.5 rounded-full border border-slate-700/80">
              <div className="bg-amber-400 text-slate-950 font-black rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs sm:text-sm shadow-sm shrink-0">
                {organizerName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="font-bold text-xs text-white leading-tight">{organizerName}</span>
                <span
                  className={`text-[9px] font-black uppercase tracking-wider ${
                    normalizedPlan === 'Pro' ? 'text-amber-400' : 'text-slate-300'
                  }`}
                >
                  {normalizedPlan} PLAN
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 flex items-center justify-center text-lg font-bold transition shadow-xs"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              ☰
            </button>
          </div>
        </div>
      </nav>

      {/* 🌟 Main Dashboard Container 🌟 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header Greeting Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6 sm:mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome Back, {organizerName}! 👋
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
              Manage squads, configure auction rules, and monitor live bidding in real time.
            </p>
          </div>
          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              Live Server Connected
            </span>
          </div>
        </div>

        {/* 🌟 1. Stats Overview Cards (Responsive Grid) 🌟 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Total Teams Card */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shadow-xs">
                🛡️
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                Squads
              </span>
            </div>
            <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{totalTeams}</div>
            <div className="text-xs uppercase font-bold text-slate-500 tracking-wider mt-1">Total Teams</div>
          </div>

          {/* Total Players Card */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shadow-xs">
                🏏
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                In Pool
              </span>
            </div>
            <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{totalPlayers}</div>
            <div className="text-xs uppercase font-bold text-slate-500 tracking-wider mt-1">Total Players</div>
          </div>

          {/* Auction Status Card */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shadow-xs">
                ⚡
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                Status
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-600 tracking-tight flex items-center gap-1.5">
              <span>Ready to Start</span>
              <span className="text-lg">🚀</span>
            </div>
            <div className="text-xs uppercase font-bold text-slate-500 tracking-wider mt-1">Auction Arena</div>
          </div>
        </div>

        {/* 🌟 2. Live Auction Controls (Prominent Action Cards) 🌟 */}
        <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs mb-6 sm:mb-8 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-6 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                LIVE CONTROL ROOM
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-2 flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse mr-2.5 inline-block"></span>
                Live Auction Controls
              </h3>
            </div>
            <p className="text-xs text-slate-600 font-medium">Broadcast bidding & live audience projector screens</p>
          </div>

          {/* Buttons Stack Vertically on Mobile */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => navigate('/control-panel')}
              className="group relative flex-1 overflow-hidden rounded-2xl p-5 sm:p-7 bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 text-white shadow-lg shadow-indigo-950/25 hover:shadow-xl hover:shadow-indigo-950/35 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 text-left border border-indigo-800/40"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-2xl border border-indigo-500/30 group-hover:scale-105 transition-transform">
                  ⚙️
                </div>
                <span className="text-xs font-bold text-indigo-300 px-2.5 py-1 rounded-full bg-white/10 group-hover:bg-white/20 transition">
                  Auctioneer Mode →
                </span>
              </div>
              <h4 className="text-lg sm:text-xl font-black text-white mb-1.5">Open Auctioneer Panel</h4>
              <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
                Manage real-time bidding, hammer sold/unsold, and assign players to team squads.
              </p>
            </button>

            <button
              type="button"
              onClick={() => navigate('/live')}
              className="group relative flex-1 overflow-hidden rounded-2xl p-5 sm:p-7 bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 text-white shadow-lg shadow-purple-950/25 hover:shadow-xl hover:shadow-purple-950/35 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 text-left border border-purple-800/40"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center text-2xl border border-purple-500/30 group-hover:scale-105 transition-transform">
                  📺
                </div>
                <span className="text-xs font-bold text-purple-300 px-2.5 py-1 rounded-full bg-white/10 group-hover:bg-white/20 transition">
                  Live Display →
                </span>
              </div>
              <h4 className="text-lg sm:text-xl font-black text-white mb-1.5">Open Audience Display</h4>
              <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
                Full-screen TV/projector broadcast with instant animations, sound effects, and team purse ledger.
              </p>
            </button>
          </div>
        </div>

        {/* 🌟 3. Data Management & Settings (Responsive Action Grid) 🌟 */}
        <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-6 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300">
                CONFIGURATION
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-2 flex items-center">
                📂 Data Management & Settings
              </h3>
            </div>
            <p className="text-xs text-slate-600 font-medium">Create and manage tournament entities</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* 1. Edit Info */}
            <button
              type="button"
              onClick={() => navigate('/create-tournament')}
              className="flex flex-col items-center justify-center text-center p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md active:scale-95 transition-all duration-200 group"
            >
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl mb-2.5 group-hover:scale-110 transition-transform">
                🏆
              </div>
              <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition">
                Edit Info
              </span>
              <span className="text-[10px] text-slate-500 font-medium mt-0.5 hidden sm:inline-block">Rules & Name</span>
            </button>

            {/* 2. Add Team */}
            <button
              type="button"
              onClick={() => navigate('/add-team')}
              className="flex flex-col items-center justify-center text-center p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md active:scale-95 transition-all duration-200 group"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mb-2.5 group-hover:scale-110 transition-transform">
                🛡️
              </div>
              <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-blue-600 transition">
                Add Team
              </span>
              <span className="text-[10px] text-slate-500 font-medium mt-0.5 hidden sm:inline-block">New Franchise</span>
            </button>

            {/* 3. Add Player */}
            <button
              type="button"
              onClick={() => navigate('/add-player')}
              className="flex flex-col items-center justify-center text-center p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md active:scale-95 transition-all duration-200 group"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mb-2.5 group-hover:scale-110 transition-transform">
                ➕
              </div>
              <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-emerald-600 transition">
                Add Player
              </span>
              <span className="text-[10px] text-slate-500 font-medium mt-0.5 hidden sm:inline-block">Direct Entry</span>
            </button>

            {/* 4. View Teams */}
            <button
              type="button"
              onClick={() => (activePolicy.canViewTeams ? navigate('/teams') : handleUpgradeClick())}
              className="flex flex-col items-center justify-center text-center p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md active:scale-95 transition-all duration-200 group"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl mb-2.5 group-hover:scale-110 transition-transform">
                📊
              </div>
              <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-amber-600 transition">
                View Teams
              </span>
              <span className="text-[10px] text-slate-500 font-medium mt-0.5 hidden sm:inline-block">Rosters & Purse</span>
            </button>

            {/* 5. Manage Players */}
            <button
              type="button"
              onClick={() => navigate('/manage-players')}
              className="flex flex-col items-center justify-center text-center p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md active:scale-95 transition-all duration-200 group"
            >
              <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl mb-2.5 group-hover:scale-110 transition-transform">
                🛠️
              </div>
              <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-rose-600 transition">
                Manage Players
              </span>
              <span className="text-[10px] text-slate-500 font-medium mt-0.5 hidden sm:inline-block">Pool & CSV</span>
            </button>

            {/* 6. Admin Panel (SuperAdmin only) */}
            {organizerRole === 'SuperAdmin' && (
              <button
                type="button"
                onClick={() => navigate('/super-admin')}
                className="flex flex-col items-center justify-center text-center p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-purple-900 to-indigo-900 text-white shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 group"
              >
                <div className="w-11 h-11 rounded-xl bg-white/10 text-amber-300 flex items-center justify-center text-xl mb-2.5 group-hover:scale-110 transition-transform">
                  👑
                </div>
                <span className="text-xs sm:text-sm font-bold text-white transition">
                  Admin Panel
                </span>
                <span className="text-[10px] text-purple-200 font-medium mt-0.5 hidden sm:inline-block">System Control</span>
              </button>
            )}
          </div>

          {/* 🌟 Public Player Registration Link Section 🌟 */}
          {!activePolicy.canPublicRegistration ? (
            <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center text-lg shrink-0">
                  🔒
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Public Player Registration Link</h4>
                  <p className="text-xs text-slate-600 font-medium">Allows players across the country to register directly for your auction.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleUpgradeClick}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition"
              >
                Available in Pro →
              </button>
            </div>
          ) : (
            <div className="mt-8 p-5 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center space-x-3 min-w-0 w-full lg:w-auto">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-sm shrink-0 mt-1 sm:mt-0">
                  🔗
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">Public Player Registration Link</h4>
                    <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Pro Active
                    </span>
                  </div>
                  <a
                    href={publicRegistrationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold truncate block mt-0.5 underline decoration-indigo-300 underline-offset-2"
                    title={publicRegistrationUrl}
                  >
                    {publicRegistrationUrl}
                  </a>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
                <div className="flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={handleCopyRegistrationLink}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-slate-900 hover:bg-indigo-600 active:bg-indigo-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all duration-200 border border-slate-800"
                    title="Copy Link to Clipboard"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>{registrationLinkMessage === 'Registration link copied!' ? 'Copied! ✓' : 'Copy Link'}</span>
                  </button>
                  {registrationLinkMessage && registrationLinkMessage !== 'Registration link copied!' && (
                    <span className="text-xs font-bold text-rose-600">
                      {registrationLinkMessage}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-start space-x-3 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs font-bold text-slate-700">Registration:</span>
                  <button
                    type="button"
                    onClick={handleRegistrationToggle}
                    disabled={isUpdatingRegistration}
                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                      tournament?.isRegistrationOpen !== false ? 'bg-emerald-500' : 'bg-slate-300'
                    } ${isUpdatingRegistration ? 'opacity-50 cursor-not-allowed' : ''}`}
                    aria-label="Toggle Public Registration"
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                        tournament?.isRegistrationOpen !== false ? 'translate-x-8' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span
                    className={`text-xs font-black uppercase ${
                      tournament?.isRegistrationOpen !== false ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {tournament?.isRegistrationOpen !== false ? 'OPEN' : 'CLOSED'}
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
