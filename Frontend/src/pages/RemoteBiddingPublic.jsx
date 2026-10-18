import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { apiRequest, getSocketBaseUrl } from '../utils/apiClient';

export default function RemoteBiddingPublic() {
  // Authentication & Login State
  const [tournamentId, setTournamentId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [authData, setAuthData] = useState(() => {
    try {
      const stored = localStorage.getItem('remoteAuth');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'squad' | 'other-teams' | 'sold' | 'unsold' | 'summary' | 'profile'
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Live Socket & Auction State
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [auctionState, setAuctionState] = useState({
    currentPlayer: null,
    currentBid: 0,
    biddingTeamId: '',
    biddingTeamName: '',
    playerStatus: 'pending',
    version: null
  });
  const [bidStatus, setBidStatus] = useState(null); // { loading: boolean, message: string, type: 'success' | 'error' | 'info' }
  const [teamInfo, setTeamInfo] = useState(null);
  const [tournamentInfo, setTournamentInfo] = useState(null);

  // Authorized Data Tab States
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState(null);
  const [squadData, setSquadData] = useState(null);
  const [otherTeamsData, setOtherTeamsData] = useState([]);
  const [soldPlayersData, setSoldPlayersData] = useState([]);
  const [unsoldPlayersData, setUnsoldPlayersData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);

  // Search & Filter within tabs
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  // Change Password Form State
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdStatus, setPwdStatus] = useState(null);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(val || 0));

  // =========================================================================
  // Authentication Handlers
  // =========================================================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const payload = { username: username.trim(), password };
      if (tournamentId.trim()) payload.tournamentId = tournamentId.trim();

      const res = await apiRequest({
        method: 'post',
        path: '/api/auth/team-login',
        data: payload
      });
      const responseData = res?.data || res;

      localStorage.setItem('remoteAuth', JSON.stringify(responseData));
      setAuthData(responseData);
      setActiveTab('live');
    } catch (err) {
      setLoginError(err.response?.data?.message || err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('remoteAuth');
    setAuthData(null);
    if (socket) socket.disconnect();
    setDrawerOpen(false);
    setActiveTab('live');
    setTeamInfo(null);
    setTournamentInfo(null);
  };

  // =========================================================================
  // Initial Data Fetch & Socket Connection
  // =========================================================================
  const fetchLiveTeamInfo = async (token) => {
    try {
      const res = await apiRequest({
        method: 'get',
        path: '/api/auth/team-info',
        headers: { Authorization: `Bearer ${token}` }
      });
      const resData = res?.data || res;
      if (resData?.team) setTeamInfo(resData.team);
      if (resData?.tournament) setTournamentInfo(resData.tournament);
    } catch (err) {
      console.warn('Failed to fetch team info:', err.message);
    }
  };

  const fetchAuthoritativeAuctionState = async (token) => {
    try {
      const res = await apiRequest({
        method: 'get',
        path: '/api/auction/state',
        headers: { Authorization: `Bearer ${token}` }
      });
      const resData = res?.data || res;
      if (resData?.status === 'bidding' && resData?.activePlayer) {
        setAuctionState({
          currentPlayer: resData.activePlayer,
          currentBid: Number(resData.currentBid || resData.activePlayer.basePrice || 0),
          biddingTeamId: resData.highestBidder?._id || resData.highestBidder || '',
          biddingTeamName: resData.highestBidder?.teamName || '',
          playerStatus: 'bidding',
          version: resData.version
        });
      }
    } catch (err) {
      console.warn('Failed to fetch auction state:', err.message);
    }
  };

  useEffect(() => {
    if (!authData?.token) return;

    fetchLiveTeamInfo(authData.token);
    fetchAuthoritativeAuctionState(authData.token);

    const newSocket = io(getSocketBaseUrl(), {
      auth: { token: authData.token }
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      setIsConnected(false);
      if (String(err?.message || '').toLowerCase().includes('unauthorized')) {
        handleLogout();
      }
    });

    newSocket.on('sessionExpired', () => {
      handleLogout();
    });

    newSocket.on('updateAudienceScreen', (data) => {
      if (!data) return;
      setAuctionState((prev) => ({
        ...prev,
        currentPlayer: data.player || data.currentPlayer || prev.currentPlayer,
        currentBid: Number(data.bidAmount !== undefined ? data.bidAmount : data.currentBid !== undefined ? data.currentBid : prev.currentBid),
        biddingTeamId: data.teamId || data.biddingTeamId || '',
        biddingTeamName: data.teamName || data.biddingTeamName || '',
        playerStatus: data.status || data.playerStatus || 'bidding',
        version: data.version !== undefined ? data.version : prev.version
      }));

      // Refresh team purse & stats on any accepted bid
      fetchLiveTeamInfo(authData.token);
      setBidStatus(null);
      if (activeTabRef.current && activeTabRef.current !== 'live' && activeTabRef.current !== 'profile') {
        loadTabData(activeTabRef.current, { silent: true });
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [authData?.token]);

  // =========================================================================
  // Tab-Specific Data Fetching
  // =========================================================================
  const loadTabData = async (tab, { silent = false } = {}) => {
    if (!authData?.token) return;
    if (!silent) {
      setTabLoading(true);
      setTabError(null);
      setSearchQuery('');
    }

    const headers = { Authorization: `Bearer ${authData.token}` };

    try {
      if (tab === 'squad') {
        const res = await apiRequest({ method: 'get', path: '/api/auction/team-squad', headers });
        setSquadData(res?.data || res);
      } else if (tab === 'other-teams') {
        const res = await apiRequest({ method: 'get', path: '/api/auction/other-teams', headers });
        const d = res?.data || res;
        setOtherTeamsData(Array.isArray(d) ? d : []);
      } else if (tab === 'sold') {
        const res = await apiRequest({ method: 'get', path: '/api/auction/sold-players', headers });
        const d = res?.data || res;
        setSoldPlayersData(Array.isArray(d) ? d : []);
      } else if (tab === 'unsold') {
        const res = await apiRequest({ method: 'get', path: '/api/auction/unsold-players', headers });
        const d = res?.data || res;
        setUnsoldPlayersData(Array.isArray(d) ? d : []);
      } else if (tab === 'summary') {
        const res = await apiRequest({ method: 'get', path: '/api/auction/summary', headers });
        setSummaryData(res?.data || res);
      }
    } catch (err) {
      if (!silent) {
        setTabError(err.response?.data?.message || err.message || 'Failed to load data.');
      }
    } finally {
      if (!silent) {
        setTabLoading(false);
      }
    }
  };

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    setDrawerOpen(false);
    if (tab !== 'live' && tab !== 'profile') {
      loadTabData(tab);
    }
  };

  // =========================================================================
  // Place Server-Authoritative Remote Bid
  // =========================================================================
  const handleBid = (incrementAmount) => {
    if (!socket || !auctionState.currentPlayer || auctionState.playerStatus !== 'bidding') return;

    setBidStatus({ loading: true, message: 'Submitting bid...', type: 'info' });

    socket.emit(
      'requestRemoteBid',
      {
        playerId: auctionState.currentPlayer._id,
        amount: incrementAmount,
        expectedVersion: auctionState.version
      },
      (response) => {
        if (response && response.success) {
          setAuctionState((prev) => ({
            ...prev,
            currentBid: Number(response.newBidAmount !== undefined ? response.newBidAmount : prev.currentBid),
            biddingTeamId: response.teamId || prev.biddingTeamId,
            biddingTeamName: authData?.team?.teamName || prev.biddingTeamName,
            version: response.version !== undefined ? response.version : prev.version
          }));
          setBidStatus({
            loading: false,
            message: `✅ Bid of ₹${response.newBidAmount?.toLocaleString()} accepted!`,
            type: 'success'
          });
          fetchLiveTeamInfo(authData.token);
        } else {
          setBidStatus({
            loading: false,
            message: `🚫 ${response?.message || 'Bid was rejected by server.'}`,
            type: 'error'
          });
          // Auto-synchronize latest authoritative auction state & version so user NEVER needs to refresh!
          fetchAuthoritativeAuctionState(authData.token);
        }
      }
    );
  };

  // =========================================================================
  // Password Change Handler
  // =========================================================================
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdNew !== pwdConfirm) {
      setPwdStatus({ type: 'error', message: 'New password and confirm password do not match.' });
      return;
    }
    if (pwdNew.length < 6) {
      setPwdStatus({ type: 'error', message: 'New password must be at least 6 characters long.' });
      return;
    }

    setPwdStatus({ loading: true, message: 'Updating password...', type: 'info' });
    try {
      const res = await apiRequest({
        method: 'post',
        path: '/api/auction/change-password',
        data: { currentPassword: pwdCurrent, newPassword: pwdNew },
        headers: { Authorization: `Bearer ${authData.token}` }
      });
      const resData = res?.data || res;
      setPwdStatus({ type: 'success', message: resData?.message || 'Password changed successfully!' });
      setPwdCurrent('');
      setPwdNew('');
      setPwdConfirm('');
    } catch (err) {
      setPwdStatus({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to update password.'
      });
    }
  };

  // =========================================================================
  // LOGIN SCREEN (If not authenticated)
  // =========================================================================
  if (!authData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 text-white">
        <div className="bg-slate-900/90 border border-slate-700/80 p-6 rounded-3xl shadow-2xl w-full max-w-sm backdrop-blur-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 mx-auto flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/30 mb-3">
              📱
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Team Owner Login</h1>
            <p className="text-xs text-slate-400 font-semibold mt-1">Remote Auction Bidding Portal</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold rounded-xl text-center">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Team username"
                className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-semibold text-sm text-white placeholder-slate-500 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-semibold text-sm text-white placeholder-slate-500 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1">
                Tournament ID <span className="text-slate-500 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="text"
                value={tournamentId}
                onChange={(e) => setTournamentId(e.target.value)}
                placeholder="Optional tournament code"
                className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-semibold text-xs text-white placeholder-slate-500 transition"
              />
              <p className="text-[10px] text-slate-500 mt-1">Leave blank if using universal team login.</p>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-black rounded-xl shadow-lg shadow-indigo-600/30 transition active:scale-98 disabled:opacity-50 text-sm mt-2 cursor-pointer"
            >
              {loginLoading ? 'Authenticating...' : 'Enter Auction Room ⚡'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN MOBILE-FIRST INTERFACE
  // =========================================================================
  const { currentPlayer, currentBid, biddingTeamId, playerStatus } = auctionState;
  const isMyTeamLeading = Boolean(biddingTeamId && teamInfo?._id && String(biddingTeamId) === String(teamInfo._id));

  // Dynamic buttons based on tournament configuration
  const btn1 = tournamentInfo?.bidButton1 || 500;
  const btn2 = tournamentInfo?.bidButton2 || 1000;
  const btn3 = tournamentInfo?.bidButton3 || 5000;
  const btnCount = tournamentInfo?.biddingButtonsCount || 3;

  const effectiveMaxBid = Number(
    teamInfo?.maxBid !== undefined && teamInfo?.maxBid !== null && teamInfo?.maxBid > 0
      ? teamInfo.maxBid
      : (teamInfo?.remainingPurse || 0)
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-white select-none max-w-md mx-auto shadow-2xl relative overflow-hidden font-sans">
      {/* 🌟 TOP APP BAR 🌟 */}
      <header className="px-3.5 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 hover:text-white hover:bg-slate-700 active:scale-95 transition"
            title="Open Menu"
          >
            ☰
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-white truncate leading-tight">
              {teamInfo?.shortName ? `[${teamInfo.shortName}] ` : ''}
              {teamInfo?.teamName || authData.team?.teamName || 'My Team'}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold truncate">
              {tournamentInfo?.name || 'Live Auction'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
              isConnected
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </header>

      {/* 🌟 QUICK PURSE STRIP 🌟 */}
      {teamInfo && (
        <div className="px-3.5 py-1.5 bg-slate-900/90 border-b border-slate-800/80 flex justify-between items-center text-[11px] font-bold text-slate-300 shrink-0">
          <div>
            Purse: <span className="text-emerald-400 font-black">{formatCurrency(teamInfo.remainingPurse)}</span>
          </div>
          <div>
            Max Bid: <span className="text-amber-400 font-black">{formatCurrency(effectiveMaxBid)}</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🌟 SLIDING DRAWER MENU (8 SECTIONS REQUIRED BY PHASE 6) 🌟 */}
      {/* ========================================================================= */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-slate-900 border-r border-slate-800 z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Team Owner Menu</div>
            <h2 className="text-base font-black text-white truncate mt-0.5">
              {teamInfo?.teamName || authData.team?.teamName || 'My Team'}
            </h2>
            {teamInfo?.ownerName && (
              <p className="text-[11px] text-slate-400 font-semibold truncate">👤 {teamInfo.ownerName}</p>
            )}
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Drawer Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {[
            { id: 'live', icon: '⚡', label: 'Live Bidding' },
            { id: 'squad', icon: '🛡️', label: 'My Team Squad' },
            { id: 'other-teams', icon: '👥', label: 'Other Teams / Squads' },
            { id: 'sold', icon: '🔨', label: 'Sold Players' },
            { id: 'unsold', icon: '❌', label: 'Unsold Players' },
            { id: 'summary', icon: '📊', label: 'Auction Summary' },
            { id: 'profile', icon: '🔑', label: 'Profile / Change Password' }
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition text-left ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.id === 'live' && isConnected && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Drawer Footer / Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-850">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 font-black text-xs transition"
          >
            <span>🚪 Logout</span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 🌟 MAIN CONTENT VIEW 🌟 */}
      {/* ========================================================================= */}
      <main className="flex-1 overflow-y-auto p-3 flex flex-col">
        {/* VIEW 1: LIVE BIDDING */}
        {activeTab === 'live' && (
          <div className="flex-1 flex flex-col justify-between">
            {!currentPlayer ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <span className="text-4xl mb-3">⏳</span>
                <h3 className="text-base font-black text-slate-400">Waiting for Auctioneer</h3>
                <p className="text-xs font-medium text-slate-500 mt-1 max-w-xs">
                  The auction operator has not placed a player on the bidding stage yet. Please wait...
                </p>
              </div>
            ) : (
              <div className="flex flex-col flex-1">
                {/* ACTIVE PLAYER STAGE CARD */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg mb-3">
                  <div className="flex items-center gap-3.5 mb-3">
                    <img
                      src={currentPlayer.photoUrl || currentPlayer.photo || 'https://via.placeholder.com/150?text=Player'}
                      alt={currentPlayer.name}
                      className="w-20 h-20 rounded-2xl object-cover bg-slate-800 border-2 border-indigo-500/40 shadow-md shrink-0"
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/150?text=Player';
                      }}
                    />
                    <div className="min-w-0">
                      <h2 className="text-xl font-black text-white capitalize truncate" title={currentPlayer.name}>
                        {currentPlayer.name}
                      </h2>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {currentPlayer.role || 'Player'}
                        </span>
                        {currentPlayer.category && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {currentPlayer.category}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-slate-400 mt-1.5">
                        Base Price: <span className="text-emerald-400 font-extrabold">{formatCurrency(currentPlayer.basePrice)}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* CURRENT BID & HIGHEST BIDDER CARD */}
                <div className="bg-gradient-to-b from-slate-900 to-slate-900/90 border border-slate-800 rounded-2xl p-4 text-center shadow-lg mb-3">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest block mb-1">
                    Current Highest Bid
                  </span>
                  <div className="text-3xl font-black text-amber-400 mb-2">
                    {formatCurrency(currentBid || currentPlayer.basePrice)}
                  </div>

                  {biddingTeamId ? (
                    <div
                      className={`text-xs font-black px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 border ${
                        isMyTeamLeading
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {isMyTeamLeading ? (
                        <>
                          <span>🎉</span>
                          <span>Your Team is Leading!</span>
                        </>
                      ) : (
                        <>
                          <span>Leading:</span>
                          <span className="text-white">{auctionState.biddingTeamName || 'Opponent Team'}</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-slate-500">No bids placed yet</div>
                  )}
                </div>

                {/* STATUS / ERROR NOTIFICATION */}
                {bidStatus && (
                  <div
                    className={`mb-3 px-3.5 py-2 rounded-xl text-center text-xs font-black border transition ${
                      bidStatus.type === 'error'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : bidStatus.type === 'success'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    }`}
                  >
                    {bidStatus.message}
                  </div>
                )}

                {/* BIDDING BUTTONS ROW (PHASE 6: EXACT INCREMENTS ONLY, NO CUSTOM BIDS) */}
                <div className="mt-auto">
                  {playerStatus === 'bidding' ? (
                    <div className="space-y-2">
                      {isMyTeamLeading && (
                        <p className="text-[11px] font-bold text-emerald-400 text-center mb-1">
                          ✓ You currently hold the highest bid
                        </p>
                      )}

                      <div className="grid grid-cols-1 gap-2">
                        {btnCount >= 1 && (
                          <button
                            onClick={() => handleBid(btn1)}
                            disabled={
                              bidStatus?.loading ||
                              isMyTeamLeading ||
                              currentBid + btn1 > effectiveMaxBid ||
                              currentBid + btn1 > Number(teamInfo?.remainingPurse || 0)
                            }
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-98 text-white font-black rounded-xl shadow-lg shadow-indigo-600/30 transition disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm flex items-center justify-between px-4 cursor-pointer"
                          >
                            <span>Bid +{formatCurrency(btn1)}</span>
                            <span className="text-indigo-200 text-xs">Next: {formatCurrency(currentBid + btn1)}</span>
                          </button>
                        )}

                        {btnCount >= 2 && (
                          <button
                            onClick={() => handleBid(btn2)}
                            disabled={
                              bidStatus?.loading ||
                              isMyTeamLeading ||
                              currentBid + btn2 > effectiveMaxBid ||
                              currentBid + btn2 > Number(teamInfo?.remainingPurse || 0)
                            }
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-98 text-white font-black rounded-xl shadow-lg shadow-indigo-600/30 transition disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm flex items-center justify-between px-4 cursor-pointer"
                          >
                            <span>Bid +{formatCurrency(btn2)}</span>
                            <span className="text-indigo-200 text-xs">Next: {formatCurrency(currentBid + btn2)}</span>
                          </button>
                        )}

                        {btnCount >= 3 && (
                          <button
                            onClick={() => handleBid(btn3)}
                            disabled={
                              bidStatus?.loading ||
                              isMyTeamLeading ||
                              currentBid + btn3 > effectiveMaxBid ||
                              currentBid + btn3 > Number(teamInfo?.remainingPurse || 0)
                            }
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-98 text-white font-black rounded-xl shadow-lg shadow-indigo-600/30 transition disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm flex items-center justify-between px-4 cursor-pointer"
                          >
                            <span>Bid +{formatCurrency(btn3)}</span>
                            <span className="text-indigo-200 text-xs">Next: {formatCurrency(currentBid + btn3)}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`w-full py-4 rounded-xl text-center font-black uppercase tracking-wider text-sm border ${
                        playerStatus === 'sold'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {playerStatus === 'sold' ? 'Player Sold!' : 'Player Marked Unsold'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: MY TEAM SQUAD */}
        {activeTab === 'squad' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>🛡️</span> My Team Squad
              </h2>
              <span className="text-xs font-bold text-slate-400">
                {squadData?.squadCount || 0} Players
              </span>
            </div>

            {/* SQUAD FINANCIAL SUMMARY */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Spent</span>
                <span className="text-sm font-black text-amber-400">{formatCurrency(squadData?.totalSpent || 0)}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Remaining Purse</span>
                <span className="text-sm font-black text-emerald-400">{formatCurrency(squadData?.team?.remainingPurse || teamInfo?.remainingPurse || 0)}</span>
              </div>
            </div>

            {(tabLoading && !squadData) ? (
              <div className="text-center py-8 text-xs font-bold text-slate-500">Loading squad players...</div>
            ) : (!squadData?.squad || squadData.squad.length === 0) ? (
              <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-bold text-slate-500">
                No players acquired yet. Place bids in live auction to build your squad!
              </div>
            ) : (
              <div className="space-y-2">
                {squadData?.squad?.map((player) => (
                  <div
                    key={player._id}
                    className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={player.photoUrl || 'https://via.placeholder.com/150'}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover bg-slate-800 border border-slate-700 shrink-0"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/150?text=Player';
                        }}
                      />
                      <div className="min-w-0">
                        <h4 className="font-black text-xs text-white truncate">{player.name}</h4>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold mt-0.5">
                          <span>{player.role || 'Player'}</span>
                          <span>•</span>
                          <span>{player.category || 'Standard'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-emerald-400 block">{formatCurrency(player.soldPrice)}</span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Acquired</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: OTHER TEAMS / SQUADS */}
        {activeTab === 'other-teams' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>👥</span> Other Tournament Teams
              </h2>
              <span className="text-xs font-bold text-slate-400">{otherTeamsData.length} Teams</span>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teams by name..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder-slate-500 outline-none focus:border-indigo-500"
            />

            {(tabLoading && (!otherTeamsData || otherTeamsData.length === 0)) ? (
              <div className="text-center py-8 text-xs font-bold text-slate-500">Loading other teams...</div>
            ) : (
              <div className="space-y-2">
                {otherTeamsData
                  .filter((t) => {
                    const q = searchQuery.trim().toLowerCase();
                    return !q || t.teamName?.toLowerCase().includes(q) || t.shortName?.toLowerCase().includes(q);
                  })
                  .map((team) => {
                    const isExpanded = expandedTeamId === team._id;
                    return (
                      <div
                        key={team._id}
                        className={`bg-slate-900 border rounded-xl overflow-hidden transition ${
                          team.isMyTeam ? 'border-indigo-500/50 bg-indigo-950/20' : 'border-slate-800'
                        }`}
                      >
                        <div
                          onClick={() => setExpandedTeamId(isExpanded ? null : team._id)}
                          className="p-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-850/50 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {team.logoUrl ? (
                              <img src={team.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain bg-slate-800 p-0.5 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-800 text-indigo-400 font-black text-xs flex items-center justify-center shrink-0">
                                {team.shortName || team.teamName?.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <h4 className="font-black text-xs text-white truncate">
                                {team.teamName} {team.isMyTeam && <span className="text-indigo-400 text-[10px]">(My Team)</span>}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                Purse: <b className="text-emerald-400">{formatCurrency(team.remainingPurse)}</b> • Squad: <b>{team.squadCount}</b>
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-slate-500 font-bold shrink-0">{isExpanded ? '▲' : '▼'}</span>
                        </div>

                        {/* EXPANDABLE SQUAD LIST */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 border-t border-slate-800/80 bg-slate-950/40 space-y-1.5">
                            {team.squad?.length === 0 ? (
                              <p className="text-[11px] text-slate-500 font-medium py-1">No players bought yet.</p>
                            ) : (
                              team.squad?.map((p) => (
                                <div key={p._id} className="flex justify-between items-center text-[11px] font-semibold text-slate-300 py-0.5 border-b border-slate-850">
                                  <span>{p.name} <span className="text-[10px] text-slate-500">({p.role || 'P'})</span></span>
                                  <span className="font-black text-emerald-400">{formatCurrency(p.soldPrice)}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: SOLD PLAYERS */}
        {activeTab === 'sold' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>🔨</span> Sold Players
              </h2>
              <span className="text-xs font-bold text-slate-400">{soldPlayersData.length} Sold</span>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by player or team name..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder-slate-500 outline-none focus:border-indigo-500"
            />

            {(tabLoading && (!soldPlayersData || soldPlayersData.length === 0)) ? (
              <div className="text-center py-8 text-xs font-bold text-slate-500">Loading sold players...</div>
            ) : soldPlayersData.length === 0 ? (
              <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-bold text-slate-500">
                No players sold yet in this tournament.
              </div>
            ) : (
              <div className="space-y-2">
                {soldPlayersData
                  .filter((p) => {
                    const q = searchQuery.trim().toLowerCase();
                    return !q || p.name?.toLowerCase().includes(q) || p.soldToTeam?.teamName?.toLowerCase().includes(q);
                  })
                  .map((player) => (
                    <div
                      key={player._id}
                      className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={player.photoUrl || 'https://via.placeholder.com/150'}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover bg-slate-800 border border-slate-700 shrink-0"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/150?text=Player';
                          }}
                        />
                        <div className="min-w-0">
                          <h4 className="font-black text-xs text-white truncate">{player.name}</h4>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            Sold to: <span className="font-bold text-indigo-400">{player.soldToTeam?.teamName || 'Team'}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-emerald-400 block">{formatCurrency(player.soldPrice)}</span>
                        <span className="text-[9px] font-bold text-slate-500">{player.role || 'Player'}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: UNSOLD PLAYERS */}
        {activeTab === 'unsold' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>❌</span> Unsold Players
              </h2>
              <span className="text-xs font-bold text-slate-400">{unsoldPlayersData.length} Unsold</span>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search unsold players..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder-slate-500 outline-none focus:border-indigo-500"
            />

            {(tabLoading && (!unsoldPlayersData || unsoldPlayersData.length === 0)) ? (
              <div className="text-center py-8 text-xs font-bold text-slate-500">Loading unsold players...</div>
            ) : unsoldPlayersData.length === 0 ? (
              <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-bold text-slate-500">
                No unsold players currently.
              </div>
            ) : (
              <div className="space-y-2">
                {unsoldPlayersData
                  .filter((p) => {
                    const q = searchQuery.trim().toLowerCase();
                    return !q || p.name?.toLowerCase().includes(q) || p.role?.toLowerCase().includes(q);
                  })
                  .map((player) => (
                    <div
                      key={player._id}
                      className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={player.photoUrl || 'https://via.placeholder.com/150'}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover bg-slate-800 border border-slate-700 shrink-0"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/150?text=Player';
                          }}
                        />
                        <div className="min-w-0">
                          <h4 className="font-black text-xs text-white truncate">{player.name}</h4>
                          <span className="text-[10px] text-slate-400 font-semibold">{player.role || 'Player'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-slate-400 block">{formatCurrency(player.basePrice)}</span>
                        <span className="text-[9px] font-extrabold text-rose-400 uppercase">Unsold</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 6: AUCTION SUMMARY */}
        {activeTab === 'summary' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>📊</span> Auction Summary
              </h2>
            </div>

            {(tabLoading && !summaryData) ? (
              <div className="text-center py-8 text-xs font-bold text-slate-500">Loading auction summary...</div>
            ) : summaryData ? (
              <div className="space-y-3">
                {/* 4 STATS CARDS */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Sold Players</span>
                    <span className="text-base font-black text-emerald-400">{summaryData.soldCount}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Unsold Players</span>
                    <span className="text-base font-black text-rose-400">{summaryData.unsoldCount}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Total Spent</span>
                    <span className="text-xs font-black text-amber-400">{formatCurrency(summaryData.totalSoldValue)}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Remaining Purse</span>
                    <span className="text-xs font-black text-emerald-400">{formatCurrency(summaryData.totalRemainingPurse)}</span>
                  </div>
                </div>

                {/* TOP 10 HIGHEST BIDDINGS */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
                  <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider mb-2 flex items-center gap-1">
                    <span>🏆</span> Top 10 Highest Bids
                  </h3>
                  {summaryData.topBiddings?.length === 0 ? (
                    <p className="text-[11px] text-slate-500 font-medium">No sales recorded yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {summaryData.topBiddings?.map((item, idx) => (
                        <div
                          key={item._id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-850 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-black text-[10px] flex items-center justify-center shrink-0">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <h5 className="font-black text-white truncate text-xs">{item.name}</h5>
                              <p className="text-[10px] text-slate-400 truncate">{item.teamName}</p>
                            </div>
                          </div>
                          <span className="font-black text-emerald-400 text-xs shrink-0">{formatCurrency(item.soldPrice)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* VIEW 7: PROFILE / CHANGE PASSWORD */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>🔑</span> Profile & Password
              </h2>
            </div>

            {/* TEAM INFO CARD */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <h3 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider mb-2">Team Details</h3>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Team Name:</span>
                <span className="font-black text-white">{teamInfo?.teamName}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Short Code:</span>
                <span className="font-black text-white">{teamInfo?.shortName || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Owner Name:</span>
                <span className="font-black text-white">{teamInfo?.ownerName || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-400">Tournament:</span>
                <span className="font-black text-white">{tournamentInfo?.name || 'Active'}</span>
              </div>
            </div>

            {/* CHANGE PASSWORD FORM */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider mb-3">Change Password</h3>

              {pwdStatus && (
                <div
                  className={`mb-3 p-2.5 rounded-xl text-xs font-bold text-center border ${
                    pwdStatus.type === 'error'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : pwdStatus.type === 'success'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  }`}
                >
                  {pwdStatus.message}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase text-slate-400 mb-1">Current Password</label>
                  <input
                    type="password"
                    required
                    value={pwdCurrent}
                    onChange={(e) => setPwdCurrent(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase text-slate-400 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={pwdNew}
                    onChange={(e) => setPwdNew(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase text-slate-400 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={pwdConfirm}
                    onChange={(e) => setPwdConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={pwdStatus?.loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-black rounded-xl text-xs shadow-md transition disabled:opacity-50 mt-1 cursor-pointer"
                >
                  {pwdStatus?.loading ? 'Updating...' : 'Save New Password'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
