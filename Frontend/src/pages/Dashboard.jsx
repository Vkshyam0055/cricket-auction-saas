import React, { useContext, useEffect, useMemo, useState } from 'react';
import HamburgerMenu from '../components/HamburgerMenu';
import PrerequisiteModal from '../components/PrerequisiteModal';
import InfoModal from '../components/InfoModal';
import { useNavigate } from 'react-router-dom';
import { TournamentContext } from '../context/TournamentContext';

import { apiRequest, restoreSuperAdminSession } from '../utils/apiClient';
import { getEffectivePlanPolicy, fetchAndCachePlans, normalizePlanName } from '../utils/planHelper';

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
  const [plansCacheKey, setPlansCacheKey] = useState(0);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showBiddingModal, setShowBiddingModal] = useState(false);
  const [jitSaving, setJitSaving] = useState(false);
  const [infoModalType, setInfoModalType] = useState(null);

  const normalizedPlan = useMemo(() => (organizerRole === 'SuperAdmin' ? 'Pro' : normalizePlanName(organizerPlan)), [organizerPlan, organizerRole]);
  const activePolicy = useMemo(() => getEffectivePlanPolicy(organizerPlan, organizerRole), [organizerPlan, organizerRole, plansCacheKey]);

  const publicRegistrationUrl = useMemo(() => {
    if (!tournament?._id) return '';
    return `${window.location.origin}/register/${tournament._id}`;
  }, [tournament?._id]);

  useEffect(() => {
    if (!loading && !tournament) navigate('/setup');
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

    fetchAndCachePlans().then(() => {
      setPlansCacheKey(Date.now());
    });
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
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      const exitToAdmin = window.confirm("You are currently acting as this user. Do you want to return to Super Admin instead of logging out completely?");
      if (exitToAdmin) {
        restoreSuperAdminSession();
        window.location.href = '/super-admin';
        return;
      }
    }
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

  const handleUpgradeClick = () => setInfoModalType('pricing');

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

  const handleShareRegistrationLink = async () => {
    if (!publicRegistrationUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${tournament?.name || 'Tournament'} - Player Registration`,
          text: `Register for ${tournament?.name || 'Tournament'} using this link:`,
          url: publicRegistrationUrl,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      handleCopyRegistrationLink();
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

  // 🌟 JIT Prerequisite Check Handlers 🌟
  const isBudgetSet = tournament && (tournament.teamBudget !== 50000000 || tournament.minPlayersPerTeam !== 15);
  const isBiddingSet = tournament && (tournament.bidButton1 !== 500 || tournament.bidButton2 !== 1000 || tournament.bidButton3 !== 5000);

  const handleAddTeamClick = () => {
    if (!isBudgetSet) {
      setShowBudgetModal(true);
    } else {
      navigate('/add-team');
    }
  };

  const handleControlPanelClick = () => {
    if (!isBiddingSet) {
      setShowBiddingModal(true);
    } else {
      navigate('/control-panel');
    }
  };

  const handleJitSave = async (data, redirectTo) => {
    setJitSaving(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        name: tournament.name,
        venue: tournament.venue,
        logoUrl: tournament.logoUrl || '',
        tournamentPoster: tournament.tournamentPoster || '',
        teamBudget: data.teamBudget !== undefined ? Number(data.teamBudget) : tournament.teamBudget,
        minPlayersPerTeam: data.minPlayersPerTeam !== undefined ? Number(data.minPlayersPerTeam) : tournament.minPlayersPerTeam,
        bidButton1: data.bidButton1 !== undefined ? Number(data.bidButton1) : tournament.bidButton1,
        bidButton2: data.bidButton2 !== undefined ? Number(data.bidButton2) : tournament.bidButton2,
        bidButton3: data.bidButton3 !== undefined ? Number(data.bidButton3) : tournament.bidButton3,
        customFields: tournament.customFields || [],
        upiQrUrl: tournament.upiQrUrl || '',
        upiId: tournament.upiId || '',
        paymentMessage: tournament.paymentMessage || '',
      };
      await apiRequest({ method: 'post', path: '/api/tournament', data: payload, headers });
      await fetchTournament();
      setShowBudgetModal(false);
      setShowBiddingModal(false);
      navigate(redirectTo);
    } catch (err) {
      console.error(err);
      alert('Settings save failed!');
    } finally {
      setJitSaving(false);
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
          phone: localStorage.getItem('organizerPhone'),
          plan: normalizedPlan
        }}
        onLogout={handleLogout}
        onNavigate={(key) => {
          setMenuOpen(false);
          switch(key) {
            case 'dashboard': navigate('/dashboard'); break;
            case 'tournament-settings': navigate('/tournament-settings'); break;
            case 'view-auction': navigate('/live'); break;
            case 'teams': navigate('/teams'); break;
            case 'players': navigate('/manage-players'); break;
            case 'registration-form': navigate('/registration-settings'); break;
            case 'change-password': navigate('/forgot-password'); break;
            case 'pricing': setInfoModalType('pricing'); break;
            case 'tutorial-videos': setInfoModalType('tutorial-videos'); break;
            case 'support': setInfoModalType('support'); break;
            case 'about': setInfoModalType('about'); break;
            case 'policies': setInfoModalType('policies'); break;
            default: break;
          }
        }}
      />

      {/* 🌟 Modern SaaS Navbar (Compact Mobile App Header) 🌟 */}
      <nav className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-18 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            {tournament.logoUrl ? (
              <img
                src={tournament.logoUrl}
                alt="Logo"
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white p-0.5 border border-slate-700 object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-amber-400 p-0.5 shrink-0 shadow-sm">
                <div className="w-full h-full bg-slate-950 rounded-[7px] sm:rounded-[9px] flex items-center justify-center text-sm sm:text-lg">
                  🏏
                </div>
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-white truncate max-w-[140px] sm:max-w-sm">
                  {tournament.name}
                </h1>
                <span className="hidden sm:inline-flex text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Control Room
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium hidden sm:block">Tournament Management & Bidding Hub</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="flex items-center space-x-1.5 bg-slate-800/90 px-2 sm:px-3 py-1 rounded-full border border-slate-700/80">
              <div className="bg-amber-400 text-slate-950 font-black rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-xs shadow-sm shrink-0">
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
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 flex items-center justify-center text-base sm:text-lg font-bold transition shadow-2xs"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              ☰
            </button>
          </div>
        </div>
      </nav>

      {/* 🌟 Main Dashboard Container (Mobile-First Cricbuzz Style) 🌟 */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
        {/* 1. Compact Status Strip (Zero Wasted Space) */}
        <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 px-0.5">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="text-sm sm:text-base font-black text-slate-900 truncate">
              👋 Hi, {organizerName}
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
              {normalizedPlan}
            </span>
          </div>
          <div className="flex items-center space-x-1.5 shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Server</span>
          </div>
        </div>

        {/* 🌟 2. Cricbuzz-Style "Hero Auction Match Card" (Above the Fold) 🌟 */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 rounded-2xl p-4 sm:p-6 border border-indigo-900/40 text-white shadow-xl mb-4 sm:mb-6 relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

          {/* Card Top Strip */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3.5 relative z-10">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-indigo-300">
                LIVE AUCTION ARENA
              </span>
            </div>
            <div className="flex items-center space-x-1.5 text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              <span>Ready to Start</span>
              <span>🚀</span>
            </div>
          </div>

          {/* Primary Action Buttons (Thumb Reachable Immediately) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 mb-3.5 relative z-10">
            <button
              type="button"
              onClick={handleControlPanelClick}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition group text-left border border-indigo-400/30 cursor-pointer"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                  ⚙️
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-black text-white leading-tight">
                    Open Auctioneer Panel
                  </div>
                  <div className="text-[11px] text-indigo-100 font-medium truncate mt-0.5">
                    Bid increment, sold hammer & squad assign
                  </div>
                </div>
              </div>
              <span className="text-base text-indigo-200 group-hover:translate-x-1 transition-transform pl-2">
                →
              </span>
            </button>

            <button
              type="button"
              onClick={() => (activePolicy.canLiveScreen || organizerRole === 'SuperAdmin') ? navigate('/live') : handleUpgradeClick()}
              className={`hidden sm:flex w-full items-center justify-between p-3.5 sm:p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-white border border-slate-700/80 active:scale-[0.98] transition group text-left cursor-pointer ${(!activePolicy.canLiveScreen && organizerRole !== 'SuperAdmin') ? 'opacity-75' : ''}`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center text-xl shrink-0 border border-purple-500/30 group-hover:scale-105 transition-transform">
                  {(!activePolicy.canLiveScreen && organizerRole !== 'SuperAdmin') ? '🔒' : '📺'}
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-black text-white leading-tight">
                    Audience TV Display
                  </div>
                  <div className="text-[11px] text-slate-300 font-medium truncate mt-0.5">
                    Live projector broadcast & sound effects
                  </div>
                </div>
              </div>
              <span className="text-xs text-purple-300 font-bold px-2 py-0.5 rounded bg-white/10 shrink-0">
                {(!activePolicy.canLiveScreen && organizerRole !== 'SuperAdmin') ? 'Pro 🔒' : 'Live →'}
              </span>
            </button>
          </div>

          {/* Integrated Match Summary Stats (Cricbuzz Match Card Style) */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10 text-center relative z-10">
            <div className="bg-white/5 rounded-xl p-2 sm:p-2.5">
              <div className="text-base sm:text-2xl font-black text-white leading-none">
                {totalTeams}
                {activePolicy.teamLimit !== -1 && (
                  <span className="text-xs sm:text-sm font-semibold text-slate-400">/{activePolicy.teamLimit}</span>
                )}
              </div>
              <div className="text-[10px] sm:text-xs font-bold text-indigo-300 uppercase tracking-wider mt-1 truncate">
                Squads 🛡️
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-2 sm:p-2.5">
              <div className="text-base sm:text-2xl font-black text-white leading-none">
                {totalPlayers}
                {activePolicy.playerLimit !== -1 && (
                  <span className="text-xs sm:text-sm font-semibold text-slate-400">/{activePolicy.playerLimit}</span>
                )}
              </div>
              <div className="text-[10px] sm:text-xs font-bold text-emerald-300 uppercase tracking-wider mt-1 truncate">
                In Pool 🏏
              </div>
            </div>
          </div>
        </div>

        {/* 🌟 3. Quick Actions Grid (Cricbuzz-Style Touch Tiles) 🌟 */}
        <div className="bg-white p-3.5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-500">
              ⚡ QUICK MANAGEMENT ACTIONS
            </span>
            <span className="text-[10px] text-indigo-600 font-bold hidden sm:inline-block">
              Tournament Entity Controls
            </span>
          </div>

          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3.5">
            {/* 1. Tournament Settings */}
            <button
              type="button"
              onClick={() => navigate('/tournament-settings')}
              className="flex flex-col items-center justify-center text-center p-2.5 sm:p-4 rounded-xl bg-slate-50/70 hover:bg-slate-100 border border-slate-200/80 active:scale-95 transition group"
            >
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg sm:text-xl mb-1 group-hover:scale-110 transition-transform shadow-2xs">
                ⚙️
              </div>
              <span className="text-[11px] sm:text-xs font-black text-slate-800 group-hover:text-indigo-600 transition truncate w-full">
                Settings
              </span>
              <span className="text-[9px] text-slate-400 font-medium hidden sm:inline-block">Rules & Info</span>
            </button>

            {/* 2. Add Team */}
            <button
              type="button"
              onClick={handleAddTeamClick}
              className="flex flex-col items-center justify-center text-center p-2.5 sm:p-4 rounded-xl bg-slate-50/70 hover:bg-slate-100 border border-slate-200/80 active:scale-95 transition group"
            >
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg sm:text-xl mb-1 group-hover:scale-110 transition-transform shadow-2xs">
                🛡️
              </div>
              <span className="text-[11px] sm:text-xs font-black text-slate-800 group-hover:text-blue-600 transition truncate w-full">
                Add Team
              </span>
              <span className="text-[9px] text-slate-400 font-medium hidden sm:inline-block">New Franchise</span>
            </button>

            {/* 3. Add Player */}
            <button
              type="button"
              onClick={() => navigate('/add-player')}
              className="flex flex-col items-center justify-center text-center p-2.5 sm:p-4 rounded-xl bg-slate-50/70 hover:bg-slate-100 border border-slate-200/80 active:scale-95 transition group"
            >
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg sm:text-xl mb-1 group-hover:scale-110 transition-transform shadow-2xs">
                ➕
              </div>
              <span className="text-[11px] sm:text-xs font-black text-slate-800 group-hover:text-emerald-600 transition truncate w-full">
                Add Player
              </span>
              <span className="text-[9px] text-slate-400 font-medium hidden sm:inline-block">Direct Entry</span>
            </button>

            {/* 4. View Teams */}
            <button
              type="button"
              onClick={() => ((activePolicy.canViewTeams || organizerRole === 'SuperAdmin') ? navigate('/teams') : handleUpgradeClick())}
              className="flex flex-col items-center justify-center text-center p-2.5 sm:p-4 rounded-xl bg-slate-50/70 hover:bg-slate-100 border border-slate-200/80 active:scale-95 transition group relative"
            >
              {(!activePolicy.canViewTeams && organizerRole !== 'SuperAdmin') && (
                <span className="absolute top-1 right-1 text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-black border border-amber-200">🔒</span>
              )}
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg sm:text-xl mb-1 group-hover:scale-110 transition-transform shadow-2xs">
                📊
              </div>
              <span className="text-[11px] sm:text-xs font-black text-slate-800 group-hover:text-amber-600 transition truncate w-full">
                View Teams
              </span>
              <span className="text-[9px] text-slate-400 font-medium hidden sm:inline-block">Rosters & Purse</span>
            </button>

            {/* 5. Manage Players */}
            <button
              type="button"
              onClick={() => navigate('/manage-players')}
              className="flex flex-col items-center justify-center text-center p-2.5 sm:p-4 rounded-xl bg-slate-50/70 hover:bg-slate-100 border border-slate-200/80 active:scale-95 transition group"
            >
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-lg sm:text-xl mb-1 group-hover:scale-110 transition-transform shadow-2xs">
                🛠️
              </div>
              <span className="text-[11px] sm:text-xs font-black text-slate-800 group-hover:text-rose-600 transition truncate w-full">
                Players
              </span>
              <span className="text-[9px] text-slate-400 font-medium hidden sm:inline-block">Pool & CSV</span>
            </button>

            {/* 6. Registration Form & Fee */}
            <button
              type="button"
              onClick={() => navigate('/registration-settings')}
              className="flex flex-col items-center justify-center text-center p-2.5 sm:p-4 rounded-xl bg-slate-50/70 hover:bg-slate-100 border border-slate-200/80 active:scale-95 transition group"
            >
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg sm:text-xl mb-1 group-hover:scale-110 transition-transform shadow-2xs">
                📋
              </div>
              <span className="text-[11px] sm:text-xs font-black text-slate-800 group-hover:text-purple-600 transition truncate w-full">
                Reg Form
              </span>
              <span className="text-[9px] text-slate-400 font-medium hidden sm:inline-block">Form & Fee</span>
            </button>

            {/* 7. Admin Panel (SuperAdmin only) */}
            {organizerRole === 'SuperAdmin' && (
              <button
                type="button"
                onClick={() => navigate('/super-admin')}
                className="col-span-3 lg:col-span-6 flex items-center justify-center gap-2 p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-purple-900 to-indigo-900 text-white shadow-sm hover:shadow active:scale-98 transition group cursor-pointer"
              >
                <span className="text-base">👑</span>
                <span className="text-xs sm:text-sm font-black text-white">
                  Super Admin Panel
                </span>
                <span className="text-[10px] text-purple-200 font-medium hidden sm:inline-block">— Global User & System Control</span>
              </button>
            )}
          </div>

          {/* 🌟 Public Player Registration Link Section 🌟 */}
          {(!activePolicy.canPublicRegistration && organizerRole !== 'SuperAdmin') ? (
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
                Upgrade to Unlock →
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
                    onClick={() => navigate('/registration-settings')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition"
                    title="Configure Form & Payment Settings"
                  >
                    <span>⚙️</span>
                    <span className="hidden sm:inline">Form Settings</span>
                    <span className="sm:hidden">Form</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareRegistrationLink}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition"
                    title="Share Link"
                  >
                    <span>📱</span>
                    <span>Share</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyRegistrationLink}
                    className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-slate-900 hover:bg-indigo-600 active:bg-indigo-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all duration-200 border border-slate-800"
                    title="Copy Link to Clipboard"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="hidden sm:inline">{registrationLinkMessage === 'Registration link copied!' ? 'Copied! ✓' : 'Copy Link'}</span>
                    <span className="sm:hidden">{registrationLinkMessage === 'Registration link copied!' ? '✓' : 'Copy'}</span>
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

      {/* 🌟 JIT Prerequisite Modals 🌟 */}
      <PrerequisiteModal
        open={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        onSave={(data) => handleJitSave(data, '/add-team')}
        title="पहले Team Budget & Rules सेट करें"
        description="Team add करने से पहले purse amount और minimum players set करें।"
        fields={[
          { name: 'teamBudget', label: 'Points Balance / Purse per Team (₹)', type: 'number', defaultValue: tournament?.teamBudget || 100000 },
          { name: 'minPlayersPerTeam', label: 'Min Players per Team', type: 'number', defaultValue: tournament?.minPlayersPerTeam || 16 },
        ]}
        saveButtonText="Save & Add Team →"
        saving={jitSaving}
      />

      <PrerequisiteModal
        open={showBiddingModal}
        onClose={() => setShowBiddingModal(false)}
        onSave={(data) => handleJitSave(data, '/control-panel')}
        title="पहले Bidding Buttons सेट करें"
        description="Auctioneer Panel खोलने से पहले bidding increment buttons configure करें।"
        fields={[
          { name: 'bidButton1', label: 'Button 1 (₹)', type: 'number', defaultValue: tournament?.bidButton1 || 500 },
          { name: 'bidButton2', label: 'Button 2 (₹)', type: 'number', defaultValue: tournament?.bidButton2 || 1000 },
          { name: 'bidButton3', label: 'Button 3 (₹)', type: 'number', defaultValue: tournament?.bidButton3 || 5000 },
        ]}
        saveButtonText="Save & Open Panel →"
        saving={jitSaving}
      />

      {/* 🌟 Info & Help Modal 🌟 */}
      <InfoModal
        open={Boolean(infoModalType)}
        type={infoModalType}
        onClose={() => setInfoModalType(null)}
      />
    </div>
  );
}

export default Dashboard;
