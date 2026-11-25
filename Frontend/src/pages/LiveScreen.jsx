import React, { useState, useEffect, useContext, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { TournamentContext } from '../context/TournamentContext';
import { apiRequest, clearAuthSession, getSocketBaseUrl } from '../utils/apiClient';
import { DISPLAY_MODES, PHOTO_SIZE_CLASS } from '../components/live-screen/liveScreenConstants';
import BreakViewRenderer from '../components/live-screen/BreakViewRenderer';

function LiveScreen() {
  const navigate = useNavigate();
  const { tournament } = useContext(TournamentContext);

  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [liveBid, setLiveBid] = useState(0);
  const [liveTeam, setLiveTeam] = useState('');
  const [liveTeamData, setLiveTeamData] = useState(null);
  const [playerStatus, setPlayerStatus] = useState('bidding');
  const [isAwaitingTeam, setIsAwaitingTeam] = useState(false);
  const lastAuctionVersionRef = useRef(0);

  const [displayMode, setDisplayMode] = useState('night');
  const [layout, setLayout] = useState('classic');
  const [photoSize, setPhotoSize] = useState('medium');
  const [screenView, setScreenView] = useState('live');
  const [breakView, setBreakView] = useState('teams-dashboard');
  const [selectedSquadTeam, setSelectedSquadTeam] = useState('');
  const lastConfigVersionRef = useRef(0);

  const [teams, setTeams] = useState([]);
  const [soldPlayers, setSoldPlayers] = useState([]);
  const [squadsByTeam, setSquadsByTeam] = useState({});
  const [summary, setSummary] = useState({
    totalTeams: 0,
    soldPlayers: 0,
    unsoldPlayers: 0,
    readyForAuction: 0,
    totalSoldValue: 0,
    totalLeaguePurse: 0,
    totalRemainingPurse: 0,
    avgPlayerPrice: 0,
    highestBid: null,
    topSpendingTeam: null
  });
  const [topBiddings, setTopBiddings] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !tournament?._id) return;

    const fetchAuctionState = () => {
      apiRequest({
        method: 'get',
        path: '/api/auction/state',
        params: { tournamentId: tournament._id },
        headers: { Authorization: 'Bearer ' + token },
        skipAuthRedirect: true
      })
        .then((res) => {
          const data = res.data;
          if (!data) return;

          const incomingVersion = Number(data.version) || 0;
          if (incomingVersion > 0 && incomingVersion < lastAuctionVersionRef.current) {
            return;
          }
          if (incomingVersion > 0) {
            lastAuctionVersionRef.current = incomingVersion;
          }

          if (data.status === 'idle' || !data.activePlayer) {
            setCurrentPlayer(null);
            setLiveBid(0);
            setLiveTeam('');
            setLiveTeamData(null);
            setIsAwaitingTeam(false);
            setPlayerStatus('bidding');
            return;
          }

          setCurrentPlayer(data.activePlayer);
          setLiveBid(Number(data.currentBid || 0));
          const isAwaiting = data.isAwaitingTeam !== undefined
            ? Boolean(data.isAwaitingTeam)
            : Boolean(!data.highestBidder && Number(data.currentBid || 0) > Number(data.activePlayer?.basePrice || 0));
          setIsAwaitingTeam(isAwaiting);
          if (data.highestBidder && !isAwaiting && data.status !== 'unsold') {
            setLiveTeam(data.highestBidder.teamName || '');
            setLiveTeamData({
              _id: data.highestBidder._id,
              teamName: data.highestBidder.teamName,
              shortName: data.highestBidder.shortName,
              logoUrl: data.highestBidder.logoUrl || data.highestBidder.logo || ''
            });
          } else {
            setLiveTeam('');
            setLiveTeamData(null);
          }
          if (data.status) {
            setPlayerStatus(data.status);
          }
        })
        .catch(() => {});
    };

    fetchAuctionState();

    const socket = io(getSocketBaseUrl(), {
      auth: { token, tournamentId: tournament._id }
    });

    socket.on('connect', () => {
      fetchAuctionState();
    });

    socket.on('updateAudienceScreen', (data) => {
      if (!data) return;
      if (data.tournamentId && tournament?._id && String(data.tournamentId) !== String(tournament._id)) {
        return;
      }
      const incomingVersion = Number(data.version);
      if (Number.isFinite(incomingVersion) && incomingVersion > 0) {
        if (incomingVersion <= lastAuctionVersionRef.current) return;
        lastAuctionVersionRef.current = incomingVersion;
      }
      const nextBidVal = Number(data.bidAmount !== undefined ? data.bidAmount : data.currentBid || 0);
      const activeBasePrice = Number(data.player?.basePrice || data.currentPlayer?.basePrice || 0);
      const hasTeam = Boolean(data.teamId || data.teamName);
      const isAwaiting = data.isAwaitingTeam !== undefined
        ? Boolean(data.isAwaitingTeam)
        : Boolean(!hasTeam && nextBidVal > activeBasePrice);

      setLiveBid(nextBidVal);
      setIsAwaitingTeam(isAwaiting);
      const nextStatus = data.status || 'bidding';
      if (hasTeam && !isAwaiting && nextStatus !== 'unsold' && nextStatus !== 'idle') {
        setLiveTeam(data.teamName || '');
        setLiveTeamData(data.teamId || data.logoUrl ? {
          _id: data.teamId,
          teamName: data.teamName,
          shortName: data.shortName,
          logoUrl: data.logoUrl
        } : null);
      } else {
        setLiveTeam('');
        setLiveTeamData(null);
      }
      setPlayerStatus(nextStatus);
      if (data.player !== undefined) {
        setCurrentPlayer(data.player);
      } else if (data.currentPlayer !== undefined) {
        setCurrentPlayer(data.currentPlayer);
      }
    });

    const applyScreenConfig = (config) => {
      if (!config) return;
      const incomingVersion = Number(config.version || 0);
      if (incomingVersion < lastConfigVersionRef.current) return;
      lastConfigVersionRef.current = incomingVersion;
      setDisplayMode(config.displayMode || 'night');
      setLayout(config.layout || 'classic');
      setPhotoSize(config.photoSize || 'medium');
      setScreenView(config.screenView === 'break' ? 'break' : 'live');
      setBreakView(config.breakView || 'teams-dashboard');
      if (config.selectedSquadTeam !== undefined) {
        setSelectedSquadTeam(config.selectedSquadTeam);
      }
    };

    socket.on('liveScreenConfigSync', applyScreenConfig);
    socket.on('liveScreenConfigUpdate', applyScreenConfig);
    socket.on('breakDataSnapshotSync', (snapshot) => {
      if (!snapshot) return;
      setTeams(Array.isArray(snapshot.teams) ? snapshot.teams : []);
      setSoldPlayers(Array.isArray(snapshot.soldPlayers) ? snapshot.soldPlayers : []);
      setSquadsByTeam(snapshot.squadsByTeam || {});
      setSummary(snapshot.summary || {});
      setTopBiddings(Array.isArray(snapshot.topBiddings) ? snapshot.topBiddings : []);
    });
    socket.on('breakDataSnapshotUpdate', (snapshot) => {
      if (!snapshot) return;
      setTeams(Array.isArray(snapshot.teams) ? snapshot.teams : []);
      setSoldPlayers(Array.isArray(snapshot.soldPlayers) ? snapshot.soldPlayers : []);
      setSquadsByTeam(snapshot.squadsByTeam || {});
      setSummary(snapshot.summary || {});
      setTopBiddings(Array.isArray(snapshot.topBiddings) ? snapshot.topBiddings : []);
    });
    socket.on('sessionExpired', () => {
      clearAuthSession();
      navigate('/auth');
    });
    socket.on('connect_error', (error) => {
      if (String(error?.message || '').toLowerCase().includes('unauthorized')) {
        clearAuthSession();
        navigate('/auth');
      }
    });

    return () => {
      socket.off('connect');
      socket.off('updateAudienceScreen');
      socket.off('liveScreenConfigSync');
      socket.off('liveScreenConfigUpdate');
      socket.off('breakDataSnapshotSync');
      socket.off('breakDataSnapshotUpdate');
      socket.off('sessionExpired');
      socket.off('connect_error');
      socket.disconnect();
    };
  }, [navigate, tournament?._id]);

  const modeTheme = DISPLAY_MODES[displayMode] || DISPLAY_MODES.night;
  const photoWidthClass = PHOTO_SIZE_CLASS[photoSize] || PHOTO_SIZE_CLASS.medium;
  const effectiveScreenView = screenView;

  const { teamsById, teamsByName } = useMemo(() => {
    const byId = new Map();
    const byName = new Map();
    teams.forEach((t) => {
      if (t?._id) byId.set(String(t._id), t);
      if (t?.teamName) byName.set(String(t.teamName).trim().toLowerCase(), t);
    });
    return { teamsById: byId, teamsByName: byName };
  }, [teams]);

  // Resolve team from teamRef (handles ObjectId, populated object, or teamName string)
  const resolveTeam = useCallback((teamRef) => {
    if (!teamRef) return null;
    if (typeof teamRef === 'object') {
      const id = teamRef._id ? String(teamRef._id) : null;
      if (id) {
        const found = teamsById.get(id);
        if (found) return found;
      }
      return teamRef;
    }
    const str = String(teamRef).trim();
    if (!str) return null;
    return teamsById.get(str) ||
           teamsByName.get(str.toLowerCase()) ||
           null;
  }, [teamsById, teamsByName]);

  const getTeamFullName = (teamRef) => {
    if (!teamRef) return '';
    const match = resolveTeam(teamRef);
    if (match?.teamName) return match.teamName;
    if (typeof teamRef === 'object' && teamRef?.teamName) return teamRef.teamName;
    if (typeof teamRef === 'string') return teamRef;
    return '';
  };

  const getTeamShortName = (teamRef) => {
    if (!teamRef) return '';
    const match = resolveTeam(teamRef);
    if (match?.shortName) return match.shortName;
    if (match?.teamName) return match.teamName.slice(0, 3).toUpperCase();
    if (typeof teamRef === 'object') return teamRef?.shortName || teamRef?.teamName?.slice(0, 3).toUpperCase() || '';
    if (typeof teamRef === 'string') return teamRef.slice(0, 3).toUpperCase();
    return '';
  };

  const getTeamLogo = (teamRef) => {
    if (!teamRef) return '';
    const match = resolveTeam(teamRef);
    return match?.logoUrl || match?.logo || (typeof teamRef === 'object' ? (teamRef?.logoUrl || teamRef?.logo || '') : '');
  };

  // Resolve active bidder team object for logos & abbreviations
  const activeBidderTeam = (liveTeam || liveTeamData)
    ? (resolveTeam(liveTeamData) || resolveTeam(liveTeam) || liveTeamData)
    : null;
  const activeBidderLogo = activeBidderTeam ? getTeamLogo(activeBidderTeam) : '';
  const activeBidderShortName = activeBidderTeam ? getTeamShortName(activeBidderTeam) : '';
  const activeBidderFullName = activeBidderTeam ? (getTeamFullName(activeBidderTeam) || liveTeam || '') : '';

  const renderBreakView = () => (
    <BreakViewRenderer
      breakView={breakView}
      displayMode={displayMode}
      soldPlayers={soldPlayers}
      selectedSquadTeam={selectedSquadTeam}
      resolveTeam={resolveTeam}
      teams={teams}
      squadsByTeam={squadsByTeam}
      summary={summary}
      topBiddings={topBiddings}
      modeTheme={modeTheme}
      getTeamLogo={getTeamLogo}
      getTeamFullName={getTeamFullName}
      getTeamShortName={getTeamShortName}
    />
  );

  /* ========================================================================= */
  /* 🌟 4 DISTINCT LIVE AUCTION LAYOUT PRESETS (REQUIREMENT 3) 🌟 */
  /* ========================================================================= */

  // 1. CLASSIC: Original balanced 2-column layout
  const renderClassicLayout = () => (
    <div className="h-full flex flex-col lg:flex-row gap-4 items-stretch min-h-0">
      {/* Player Photo Card */}
      <div className={`${photoWidthClass} order-1 lg:order-2 p-3 rounded-2xl border shadow-xl relative flex items-center justify-center min-h-0 overflow-hidden ${modeTheme.panel}`}>
        <img
          src={currentPlayer?.photoUrl || 'https://via.placeholder.com/700x900?text=No+Player+Photo'}
          alt={currentPlayer?.name || 'Player'}
          className="w-full h-full max-h-full object-contain rounded-xl"
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/700x900?text=No+Photo';
          }}
        />
      </div>

      {/* Player Info & Bidding Details */}
      <div className="flex-1 order-2 lg:order-1 flex flex-col justify-between gap-3 min-h-0">
        <div className={`p-4 lg:p-6 rounded-2xl border-l-8 shadow-xl flex-1 flex flex-col justify-center ${modeTheme.strongPanel}`}>
          <h2 className={`text-xs lg:text-sm font-bold uppercase tracking-widest mb-1 ${modeTheme.mutedText}`}>
            Current Player
          </h2>
          <h1 className={`text-2xl lg:text-5xl xl:text-6xl font-black capitalize leading-tight ${modeTheme.headingText}`}>
            {currentPlayer?.name || 'Unknown'}
          </h1>
          <p className="text-base lg:text-xl font-bold mt-1 text-slate-300">
            📍 {currentPlayer?.city || 'Location Unknown'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 shrink-0">
          <div className={`p-3 lg:p-4 rounded-xl border ${modeTheme.panel}`}>
            <p className={`font-bold text-xs uppercase tracking-wider mb-0.5 ${modeTheme.mutedText}`}>Role</p>
            <p className="text-lg lg:text-2xl font-black truncate">{currentPlayer?.role || 'Unspecified'}</p>
          </div>
          <div className={`p-3 lg:p-4 rounded-xl border ${modeTheme.panel}`}>
            <p className={`font-bold text-xs uppercase tracking-wider mb-0.5 ${modeTheme.mutedText}`}>Base Price</p>
            <p className="text-lg lg:text-2xl font-black">
              ₹{(currentPlayer?.basePrice || 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className={`p-4 lg:p-6 rounded-2xl border-l-8 shadow-xl flex-1 flex flex-col justify-center ${liveTeam ? modeTheme.strongPanel : modeTheme.panel}`}>
          <p className={`font-bold text-xs lg:text-sm uppercase tracking-wider mb-1 ${modeTheme.mutedText}`}>
            {liveTeam ? 'Current Highest Bid' : isAwaitingTeam ? '' : 'Waiting for Opening Bid...'}
          </p>
          <p className={`text-3xl lg:text-5xl xl:text-6xl font-black ${modeTheme.bidText}`}>
            ₹{liveBid.toLocaleString()}
          </p>
          {liveTeam && !isAwaitingTeam && (
            <div className="mt-2 flex justify-between items-center border-t pt-2">
              <span className={`text-xs lg:text-sm font-bold uppercase ${modeTheme.mutedText}`}>
                Highest Bidder
              </span>
              <div className="flex items-center gap-2 min-w-0">
                {activeBidderLogo ? (
                  <img src={activeBidderLogo} alt={activeBidderFullName} className="w-8 h-8 rounded-lg object-cover border border-amber-400/60 shadow-sm shrink-0" />
                ) : activeBidderShortName ? (
                  <span className="text-xs font-black px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 shrink-0">{activeBidderShortName}</span>
                ) : null}
                <span className={`text-xl lg:text-2xl font-black capitalize truncate ${modeTheme.bidderText}`}>
                  {activeBidderFullName}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // 2. SPLIT: 50/50 Symmetrical Split Stage
  const renderSplitLayout = () => (
    <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-h-0">
      {/* Left Column: Full-Height Player Stage Showcase */}
      <div className="lg:col-span-6 rounded-2xl border shadow-2xl relative flex flex-col min-h-0 overflow-hidden bg-slate-950/60 p-3">
        <div className="flex-1 min-h-0 relative rounded-xl overflow-hidden flex items-center justify-center bg-black/30">
          <img
            src={currentPlayer?.photoUrl || 'https://via.placeholder.com/700x900?text=No+Player+Photo'}
            alt={currentPlayer?.name || 'Player'}
            className="w-full h-full max-h-full object-contain"
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/700x900?text=No+Photo';
            }}
          />
          {/* Bottom Gradient Player Bio Strip */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4 pt-12 flex flex-col justify-end">
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
              {currentPlayer?.category || 'General'} • {currentPlayer?.role || 'All-Rounder'}
            </span>
            <h1 className="text-3xl lg:text-5xl font-black text-white capitalize leading-tight truncate">
              {currentPlayer?.name || 'Unknown'}
            </h1>
            <p className="text-sm font-bold text-slate-300 mt-0.5">
              📍 {currentPlayer?.city || 'Location Unknown'}
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Stacked Bidding Arena */}
      <div className="lg:col-span-6 flex flex-col justify-between gap-3 min-h-0">
        <div className="grid grid-cols-2 gap-3 shrink-0">
          <div className={`p-3.5 rounded-xl border flex flex-col justify-center ${modeTheme.panel}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block mb-0.5 ${modeTheme.mutedText}`}>
              Player Role
            </span>
            <span className="text-xl font-black truncate">{currentPlayer?.role || 'Unspecified'}</span>
          </div>
          <div className={`p-3.5 rounded-xl border flex flex-col justify-center ${modeTheme.panel}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block mb-0.5 ${modeTheme.mutedText}`}>
              Opening Base Price
            </span>
            <span className="text-xl font-black">₹{(currentPlayer?.basePrice || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Hero Bid Display */}
        <div className={`p-6 lg:p-8 rounded-2xl border-2 shadow-2xl flex-1 flex flex-col justify-center items-center text-center ${modeTheme.strongPanel}`}>
          {!isAwaitingTeam && (
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-3 animate-pulse">
              {liveTeam ? '⚡ Live Bidding In Progress' : '⏳ Awaiting First Bid'}
            </span>
          )}
          <span className={`text-xs lg:text-sm font-bold uppercase tracking-widest block mb-1 ${modeTheme.mutedText}`}>
            Current Highest Bid
          </span>
          <h2 className={`text-4xl lg:text-6xl xl:text-7xl font-black ${modeTheme.bidText} tracking-tight`}>
            ₹{liveBid.toLocaleString()}
          </h2>
        </div>

        {/* Winning Team Banner */}
        <div className={`p-4 lg:p-5 rounded-2xl border shadow-lg flex items-center justify-between gap-4 shrink-0 ${liveTeam ? modeTheme.strongPanel : modeTheme.panel}`}>
          <div className="flex items-center gap-3 min-w-0">
            {activeBidderLogo ? (
              <img src={activeBidderLogo} alt={activeBidderFullName} className="w-12 h-12 rounded-xl object-cover border-2 border-amber-400 shadow-md shrink-0" />
            ) : null}
            <div className="min-w-0">
              {!isAwaitingTeam && (
                <span className={`text-[10px] uppercase font-black tracking-widest block ${modeTheme.mutedText}`}>
                  Current Leader
                </span>
              )}
              <span className={`text-2xl lg:text-3xl font-black uppercase truncate block ${liveTeam ? modeTheme.bidderText : 'text-slate-400'}`}>
                {liveTeam ? (activeBidderFullName || '') : (isAwaitingTeam ? '' : 'No Active Bidder')}
              </span>
            </div>
          </div>
          {liveTeam && (
            <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black text-xs uppercase tracking-wider shrink-0">
              👑 Top Bidder
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // 3. SPOTLIGHT: Centerpiece Hero Portrait Showcase
  const renderSpotlightLayout = () => (
    <div className="h-full flex flex-col justify-between gap-3 min-h-0">
      {/* Top Header Banner: Centered Player Spotlight Name */}
      <div className={`p-3 lg:p-4 rounded-2xl border shadow-md flex items-center justify-between gap-4 shrink-0 ${modeTheme.strongPanel}`}>
        <div className="min-w-0">
          <span className="text-[10px] uppercase font-black tracking-[0.2em] text-indigo-400 block">
            Player Spotlight
          </span>
          <h1 className="text-2xl lg:text-4xl font-black uppercase tracking-wide truncate">
            {currentPlayer?.name || 'Unknown'}
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-bold text-slate-300">
            📍 {currentPlayer?.city || 'Location Unknown'}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {currentPlayer?.category || 'General'}
          </span>
        </div>
      </div>

      {/* 3-Way Centerpiece Stage */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 items-stretch">
        {/* Left Column: Player Bio & Credentials */}
        <div className="lg:col-span-3 flex flex-col justify-between gap-2.5 min-h-0">
          <div className={`p-4 rounded-xl border flex-1 flex flex-col justify-center ${modeTheme.panel}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${modeTheme.mutedText}`}>
              Primary Role
            </span>
            <p className="text-xl lg:text-2xl font-black truncate">{currentPlayer?.role || 'Unspecified'}</p>
          </div>
          <div className={`p-4 rounded-xl border flex-1 flex flex-col justify-center ${modeTheme.panel}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${modeTheme.mutedText}`}>
              Base Price
            </span>
            <p className="text-xl lg:text-2xl font-black">₹{(currentPlayer?.basePrice || 0).toLocaleString()}</p>
          </div>
          <div className={`p-4 rounded-xl border flex-1 flex flex-col justify-center ${modeTheme.panel}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${modeTheme.mutedText}`}>
              Registration City
            </span>
            <p className="text-base lg:text-lg font-black truncate">{currentPlayer?.city || 'Not Specified'}</p>
          </div>
        </div>

        {/* Center Column: Portrait Hero Showcase */}
        <div className="lg:col-span-5 rounded-2xl border-2 border-indigo-500/30 shadow-2xl relative flex items-center justify-center min-h-0 overflow-hidden bg-black/40 p-3">
          <img
            src={currentPlayer?.photoUrl || 'https://via.placeholder.com/700x900?text=No+Player+Photo'}
            alt={currentPlayer?.name || 'Player'}
            className="w-full h-full max-h-full object-contain rounded-xl"
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/700x900?text=No+Photo';
            }}
          />
        </div>

        {/* Right Column: Live Bidding Arena */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-3 min-h-0">
          <div className={`p-5 lg:p-6 rounded-2xl border-l-8 shadow-xl flex-1 flex flex-col justify-center items-center text-center ${modeTheme.strongPanel}`}>
            <span className={`text-xs font-bold uppercase tracking-widest block mb-1 ${modeTheme.mutedText}`}>
              Current Highest Bid
            </span>
            <p className={`text-4xl lg:text-6xl font-black ${modeTheme.bidText} tracking-tight`}>
              ₹{liveBid.toLocaleString()}
            </p>
          </div>

          <div className={`p-4 lg:p-5 rounded-xl border shadow-md flex items-center gap-3.5 shrink-0 ${liveTeam ? modeTheme.strongPanel : modeTheme.panel}`}>
            {activeBidderLogo ? (
              <img src={activeBidderLogo} alt={activeBidderFullName} className="w-11 h-11 rounded-xl object-cover border-2 border-amber-400/70 shadow-sm shrink-0" />
            ) : null}
            <div className="min-w-0">
              {!isAwaitingTeam && (
                <span className={`text-[10px] uppercase font-bold tracking-widest block mb-0.5 ${modeTheme.mutedText}`}>
                  Highest Bidder Team
                </span>
              )}
              <span className={`text-2xl font-black uppercase truncate block ${liveTeam ? modeTheme.bidderText : 'text-slate-400'}`}>
                {liveTeam ? (activeBidderFullName || '') : (isAwaitingTeam ? '' : 'Waiting for Bids')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // 4. BROADCAST: Television Broadcast Lower-Third Studio Style
  const renderBroadcastLayout = () => (
    <div className="h-full flex flex-col justify-between gap-3 min-h-0">
      {/* Upper Stage: Widescreen Cinematic Display */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 items-stretch min-h-0">
        {/* Cinematic Player Info Card */}
        <div className={`flex-1 p-5 lg:p-8 rounded-2xl border shadow-xl flex flex-col justify-center min-h-0 ${modeTheme.strongPanel}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-[0.25em] text-amber-400">
              LIVE AUCTION BROADCAST
            </span>
          </div>
          <h1 className="text-3xl lg:text-6xl xl:text-7xl font-black uppercase tracking-tight leading-none truncate">
            {currentPlayer?.name || 'Unknown'}
          </h1>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="px-3.5 py-1 rounded-xl text-sm font-bold bg-white/10 border border-white/20">
              🏏 {currentPlayer?.role || 'Unspecified'}
            </span>
            <span className="px-3.5 py-1 rounded-xl text-sm font-bold bg-white/10 border border-white/20">
              📍 {currentPlayer?.city || 'Location Unknown'}
            </span>
            <span className="px-3.5 py-1 rounded-xl text-sm font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              🏷️ {currentPlayer?.category || 'Category A'}
            </span>
          </div>
        </div>

        {/* Player Photo Right */}
        <div className={`${photoWidthClass} p-3 rounded-2xl border shadow-xl relative flex items-center justify-center min-h-0 overflow-hidden ${modeTheme.panel}`}>
          <img
            src={currentPlayer?.photoUrl || 'https://via.placeholder.com/700x900?text=No+Player+Photo'}
            alt={currentPlayer?.name || 'Player'}
            className="w-full h-full max-h-full object-contain rounded-xl"
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/700x900?text=No+Photo';
            }}
          />
        </div>
      </div>

      {/* Lower-Third Television Broadcast Control Deck */}
      <div className={`p-3 lg:p-4 rounded-2xl border-2 shadow-2xl flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 shrink-0 ${modeTheme.panel}`}>
        {/* Deck Item 1: Base Price */}
        <div className="flex items-center gap-3 pr-4 lg:border-r border-slate-700/60 shrink-0">
          <span className="text-2xl">🏷️</span>
          <div>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${modeTheme.mutedText}`}>
              Base Price
            </span>
            <span className="text-lg lg:text-xl font-black">
              ₹{(currentPlayer?.basePrice || 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Deck Item 2: Live Bid (Hero Centerpiece) */}
        <div className="flex-1 flex items-center justify-center gap-3 px-4 min-w-[200px]">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping shrink-0" />
          <div className="text-center">
            <span className={`text-[10px] font-black uppercase tracking-widest block ${modeTheme.mutedText}`}>
              Current High Bid
            </span>
            <span className={`text-3xl lg:text-5xl font-black tracking-tight ${modeTheme.bidText}`}>
              ₹{liveBid.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Deck Item 3: Highest Bidder */}
        <div className="flex items-center gap-3 pl-4 lg:border-l border-slate-700/60 shrink-0">
          {activeBidderLogo ? (
            <img src={activeBidderLogo} alt={activeBidderFullName} className="w-10 h-10 rounded-xl object-cover border border-amber-400 shadow-sm shrink-0" />
          ) : !isAwaitingTeam ? (
            <span className="text-2xl">👑</span>
          ) : null}
          <div className="text-right">
            {!isAwaitingTeam && (
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${modeTheme.mutedText}`}>
                Leading Bidder
              </span>
            )}
            <span className={`text-xl lg:text-2xl font-black uppercase ${liveTeam ? modeTheme.bidderText : 'text-slate-400'}`}>
              {liveTeam ? (activeBidderFullName || '') : (isAwaitingTeam ? '' : 'No Bids')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLiveAuctionView = () => {
    switch (layout) {
      case 'split':
        return renderSplitLayout();
      case 'spotlight':
        return renderSpotlightLayout();
      case 'broadcast':
        return renderBroadcastLayout();
      case 'classic':
      default:
        return renderClassicLayout();
    }
  };

  /* 🌟 WAITING SCREEN (NO PLAYER LOADED IN LIVE AUCTION) 🌟 */
  if (!currentPlayer && screenView === 'live') {
    return (
      <div className={`h-screen max-h-screen w-screen max-w-screen overflow-hidden flex flex-col items-center justify-center p-8 text-center relative ${modeTheme.page}`}>
        <div className={`absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] ${modeTheme.gradient} z-0`} />
        <div className="relative z-10 flex flex-col items-center">
          {tournament?.logoUrl && (
            <img
              src={tournament.logoUrl}
              alt="Logo"
              className="w-32 h-32 mb-6 rounded-full bg-white object-contain border-4 border-yellow-400 shadow-xl"
            />
          )}
          <h1 className="text-4xl lg:text-6xl font-black uppercase mb-3 tracking-wide">
            {tournament?.name || 'PREMIUM LEAGUE 2026'}
          </h1>
          <p className="text-xl lg:text-2xl font-bold uppercase mt-4 text-slate-300">
            Waiting for Auctioneer to start...
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="absolute top-5 right-5 bg-slate-800 text-white px-5 py-1.5 rounded-xl font-bold hover:bg-slate-700 transition z-20 text-xs"
        >
          Exit
        </button>
      </div>
    );
  }

  /* 🌟 MAIN AUDIENCE / PROJECTOR SCREEN (STRICTLY NON-SCROLLABLE) 🌟 */
  return (
    <div className={`h-screen max-h-screen w-screen max-w-screen overflow-hidden flex flex-col relative font-sans select-none transition-colors duration-500 ${modeTheme.page}`}>
      <div className={`absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] ${modeTheme.gradient} z-0`} />

      {/* HEADER */}
      <header className={`relative z-10 px-4 lg:px-6 h-12 lg:h-14 flex justify-between items-center shadow-md border-b shrink-0 ${modeTheme.panel}`}>
        <div className="flex items-center space-x-3">
          {tournament?.logoUrl ? (
            <img
              src={tournament.logoUrl}
              alt="logo"
              className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-white object-contain border-2 border-yellow-400 shadow-sm"
            />
          ) : (
            <div className="w-3.5 h-3.5 rounded-full bg-red-600 animate-pulse" />
          )}
          <h1 className="text-base lg:text-xl font-extrabold tracking-wider uppercase truncate">
            {tournament?.name || 'PREMIUM LEAGUE 2026'}
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-[10px] lg:text-xs font-black uppercase px-2.5 py-0.5 rounded-full border ${modeTheme.panel}`}>
            {effectiveScreenView === 'break' ? 'Break Mode' : 'Live Mode'}
          </span>
          <button onClick={() => navigate('/dashboard')} className="text-xs font-bold opacity-80 hover:opacity-100">
            Exit
          </button>
        </div>
      </header>

      {/* MAIN VIEW AREA (FLEX-1 MIN-H-0 STRICTLY NON-SCROLLABLE) */}
      <main className="relative z-10 flex-1 min-h-0 overflow-hidden p-3 lg:p-4 flex flex-col">
        {/* BREAK CONTENT VIEW */}
        <div
          className={`h-full flex flex-col min-h-0 overflow-hidden transition-opacity duration-150 ${
            effectiveScreenView === 'break' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0 p-3 lg:p-4'
          }`}
        >
          {renderBreakView()}
        </div>

        {/* LIVE AUCTION PLAYER VIEW */}
        <div
          className={`h-full flex flex-col min-h-0 overflow-hidden transition-opacity duration-150 ${
            effectiveScreenView === 'live' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0 p-3 lg:p-4'
          }`}
        >
          {renderLiveAuctionView()}
        </div>
      </main>

      {/* 🌟 ANIMATED HAMMER / STAMP OVERLAY (SOLD / UNSOLD - REQUIREMENT 1) 🌟 */}
      {effectiveScreenView === 'live' && (playerStatus === 'sold' || playerStatus === 'unsold') && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none p-4 bg-black/10">
          {playerStatus === 'sold' ? (
            <div className="animate-stamp-sold border-4 sm:border-8 border-emerald-400 bg-slate-950/92 text-emerald-400 rounded-3xl p-6 sm:p-10 text-center shadow-[0_0_80px_rgba(16,185,129,0.55)] ring-4 ring-emerald-500/30 max-w-lg w-full flex flex-col items-center">
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.3em] text-emerald-300/90 mb-1">
                Official Auction Result
              </span>
              <h1 className="text-6xl sm:text-8xl lg:text-9xl font-black uppercase tracking-wider text-emerald-400 leading-none drop-shadow-[0_2px_15px_rgba(16,185,129,0.7)]">
                SOLD
              </h1>
              {liveTeam && (
                <div className="mt-4 sm:mt-5 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 px-6 py-2.5 rounded-2xl flex items-center gap-4 sm:gap-6 shadow-2xl border-2 border-emerald-300">
                  {activeBidderLogo ? (
                    <img src={activeBidderLogo} alt={activeBidderFullName} className="w-12 h-12 rounded-xl object-cover border-2 border-slate-900 shadow-md shrink-0 bg-white/20" />
                  ) : null}
                  <div className="text-left">
                    <span className="text-[10px] uppercase font-black tracking-wider block text-slate-900/80">
                      Bought By
                    </span>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-black uppercase leading-tight">
                      {activeBidderFullName}
                    </p>
                  </div>
                  <div className="border-l-2 border-slate-900/30 pl-4 sm:pl-6 text-right">
                    <span className="text-[10px] uppercase font-black tracking-wider block text-slate-900/80">
                      Sold Price
                    </span>
                    <p className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight text-slate-950">
                      ₹{liveBid.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="animate-stamp-unsold border-4 sm:border-8 border-rose-500 bg-slate-950/92 text-rose-500 rounded-3xl p-6 sm:p-10 text-center shadow-[0_0_80px_rgba(244,63,94,0.55)] ring-4 ring-rose-500/30 max-w-lg w-full flex flex-col items-center">
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.3em] text-rose-300/90 mb-1">
                Round 1 Concluded
              </span>
              <h1 className="text-6xl sm:text-8xl lg:text-9xl font-black uppercase tracking-wider text-rose-500 leading-none drop-shadow-[0_2px_15px_rgba(244,63,94,0.7)]">
                UNSOLD
              </h1>
              <div className="mt-4 sm:mt-5 bg-rose-500/20 border-2 border-rose-500/50 text-rose-200 px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg">
                Eligible for Round-2 Pool
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LiveScreen;
