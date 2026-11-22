import React, { useState, useEffect, useContext, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TournamentContext } from '../context/TournamentContext';
import { apiRequest } from '../utils/apiClient';
import ResultsModal from '../components/control-panel/ResultsModal';
import SettingsModal from '../components/control-panel/SettingsModal';
import ActiveBiddingZone from '../components/control-panel/ActiveBiddingZone';
import ControlPanelHeader from '../components/control-panel/ControlPanelHeader';
import BreakModeManager from '../components/control-panel/BreakModeManager';
import PlayerStageCard from '../components/control-panel/PlayerStageCard';
import BiddingControlBar from '../components/control-panel/BiddingControlBar';
import TeamAuctionGrid from '../components/control-panel/TeamAuctionGrid';
import { useAuctionRecovery } from '../components/control-panel/useAuctionRecovery';
import { useBreakDataSnapshot } from '../components/control-panel/useBreakDataSnapshot';
import { useControlPanelSocket } from '../components/control-panel/useControlPanelSocket';
import { useAuctionHistory } from '../components/control-panel/useAuctionHistory';
import { useAuctionDataSync } from '../components/control-panel/useAuctionDataSync';
import { useAuctionBidding } from '../components/control-panel/useAuctionBidding';


function ControlPanel() {
  const navigate = useNavigate();
  const { tournament } = useContext(TournamentContext);
  const socketRef = useRef(null);

  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [auctionVersion, setAuctionVersion] = useState(null);
  const auctionVersionRef = useRef(0);

  useEffect(() => {
    if (auctionVersion !== null && auctionVersion !== undefined) {
      const num = Number(auctionVersion);
      if (Number.isFinite(num) && num > auctionVersionRef.current) {
        auctionVersionRef.current = num;
      }
    }
  }, [auctionVersion]);

  // Auction progress is restored only from /api/auction/state. Browser storage
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [biddingTeam, setBiddingTeam] = useState('');
  const [lastBidSource, setLastBidSource] = useState('onsite'); // 'onsite' | 'remote'
  const [latestRemoteToast, setLatestRemoteToast] = useState(null);
  const [playerStatus, setPlayerStatus] = useState('bidding');
  const [customBid, setCustomBid] = useState('');
  const [hasBiddingStarted, setHasBiddingStarted] = useState(false);
  const [isAwaitingTeam, setIsAwaitingTeam] = useState(false);

  useEffect(() => {
    if (!latestRemoteToast) return;
    const timer = setTimeout(() => {
      setLatestRemoteToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [latestRemoteToast]);
  const [playerOrderMode, setPlayerOrderMode] = useState(() => localStorage.getItem('playerOrderMode') || 'all-random');
  const [categoryOrder, setCategoryOrder] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('categoryOrder') || '[]');
    } catch {
      return [];
    }
  });

  // 🌟 DETERMINISTIC ACTIVE BIDDING ZONE (MAX 4 TEAMS) (REQUIREMENT 3) 🌟
  const [activeBiddingList, setActiveBiddingList] = useState([]);

  const [teamBidActivity, setTeamBidActivity] = useState({});

  const [displayMode, setDisplayMode] = useState('night');
  const [layout, setLayout] = useState('classic');
  const [photoSize, setPhotoSize] = useState('medium');
  const [screenView, setScreenView] = useState('live');
  const [breakView, setBreakView] = useState('teams-dashboard');
  const [selectedSquadTeam, setSelectedSquadTeam] = useState(() => localStorage.getItem('selectedSquadTeam') || '');
  const [biddingActive, setBiddingActive] = useState(false);

  const currentPlayerRef = useRef(currentPlayer);
  const playerStatusRef = useRef(playerStatus);
  const currentBidRef = useRef(currentBid);
  const biddingTeamRef = useRef(biddingTeam);

  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  useEffect(() => {
    playerStatusRef.current = playerStatus;
  }, [playerStatus]);

  useEffect(() => {
    currentBidRef.current = currentBid;
  }, [currentBid]);

  useEffect(() => {
    biddingTeamRef.current = biddingTeam;
  }, [biddingTeam]);

  const isAwaitingTeamRef = useRef(isAwaitingTeam);
  useEffect(() => {
    isAwaitingTeamRef.current = isAwaitingTeam;
  }, [isAwaitingTeam]);

  const configVersionRef = useRef(0);
  const configDebounceRef = useRef(null);
  const lastSyncedConfigRef = useRef(null);

  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [auctionResultDatabase, setAuctionResultDatabase] = useState([]);
  const [resultsActiveTab, setResultsActiveTab] = useState('all');
  const [resultsSearchQuery, setResultsSearchQuery] = useState('');
  const [isProcessingRecovery, setIsProcessingRecovery] = useState(false);
  const [isActionProcessing, setIsActionProcessing] = useState(false);
  const isActionProcessingRef = useRef(false);
  const [directSellTeam, setDirectSellTeam] = useState('');
  const [jumpBidTeam, setJumpBidTeam] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');

  // 🌟 DYNAMIC BID BUTTONS VALUES 🌟
  const btn1 = tournament?.bidButton1 || 500;
  const btn2 = tournament?.bidButton2 || 1000;
  const btn3 = tournament?.bidButton3 || 5000;
  const biddingButtonsCount = tournament?.biddingButtonsCount || 3;

  const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString()}`;

  const resolveTeam = useCallback((teamRef) => {
    if (!teamRef) return null;
    if (typeof teamRef === 'object') {
      const id = teamRef._id ? String(teamRef._id) : null;
      if (id) {
        const found = teams.find((t) => String(t._id) === id);
        if (found) return found;
      }
      return teamRef;
    }
    const str = String(teamRef).trim();
    return teams.find((t) => String(t._id) === str) ||
           teams.find((t) => t.teamName.trim().toLowerCase() === str.toLowerCase()) ||
           null;
  }, [teams]);

  const getTeamLabel = useCallback((teamRef) => {
    const match = resolveTeam(teamRef);
    return match?.shortName || match?.teamName || (typeof teamRef === 'string' ? teamRef : '') || '';
  }, [resolveTeam]);

  const getTeamFullName = useCallback((teamRef) => {
    const match = resolveTeam(teamRef);
    return match?.teamName || (typeof teamRef === 'string' ? teamRef : '') || '';
  }, [resolveTeam]);

  useEffect(() => {
    localStorage.setItem('currentPlayer', JSON.stringify(currentPlayer));
    localStorage.setItem('currentBid', String(currentBid));
    localStorage.setItem('biddingTeam', biddingTeam);
    localStorage.setItem('playerStatus', playerStatus);
    localStorage.setItem('hasBiddingStarted', String(hasBiddingStarted));
    localStorage.setItem('playerOrderMode', playerOrderMode);
    localStorage.setItem('categoryOrder', JSON.stringify(categoryOrder));
    localStorage.setItem('activeBiddingList', JSON.stringify(activeBiddingList));
    localStorage.setItem('lastBidActions', JSON.stringify(activeBiddingList));
    localStorage.setItem('teamBidActivity', JSON.stringify(teamBidActivity));
    localStorage.setItem('selectedSquadTeam', selectedSquadTeam);
  }, [currentPlayer, currentBid, biddingTeam, playerStatus, hasBiddingStarted, playerOrderMode, categoryOrder, activeBiddingList, teamBidActivity, selectedSquadTeam]);

  const syncActiveBiddingState = useCallback((type, payload = {}) => {
    if (!socketRef.current?.connected) return false;
    socketRef.current.emit('activeBiddingUpdate', { type, ...payload });
    return true;
  }, []);

  const syncLiveScreenConfig = useCallback((nextConfig) => {
    if (!socketRef.current?.connected || !nextConfig) return;
    const key = `${nextConfig.displayMode}|${nextConfig.layout}|${nextConfig.photoSize}|${nextConfig.screenView}|${nextConfig.breakView}|${nextConfig.selectedSquadTeam}`;
    if (lastSyncedConfigRef.current === key) return;
    lastSyncedConfigRef.current = key;
    socketRef.current.emit('liveScreenConfigUpdate', nextConfig);
  }, []);

  const syncBreakSnapshot = useCallback((snapshot) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('breakDataSnapshotUpdate', snapshot);
  }, []);

  // Map active teams list to team objects
  const activeBiddingTeams = useMemo(() => {
    return activeBiddingList
      .map((item) => resolveTeam(item))
      .filter(Boolean);
  }, [activeBiddingList, resolveTeam]);

  const normalizeCategory = useCallback((category) => {
    const value = String(category || '').trim();
    return value || 'Uncategorized';
  }, []);

  const normalizeTeam = useCallback((team) => ({
    ...team,
    teamName: String(team?.teamName || '').trim(),
    shortName: String(team?.shortName || '').trim(),
    remainingPurse: Number(team?.remainingPurse || 0),
    maxBid: Number(team?.maxBid || 0),
    remainingRequiredPlayers: Number(team?.remainingRequiredPlayers || 0)
  }), []);

  const { fetchData, fetchTeamsWithMaxBid } = useAuctionDataSync({
    currentPlayer,
    currentPlayerRef,
    playerStatusRef,
    socketRef,
    setAllPlayers,
    setCurrentPlayer,
    setCurrentBid,
    setBiddingTeam,
    setHasBiddingStarted,
    setPlayerStatus,
    auctionVersionRef,
    setAuctionVersion,
    setBiddingActive,
    setPlayers,
    setCategoryOrder,
    setActiveBiddingList,
    setTeamBidActivity,
    setTeams,
    normalizeCategory,
    normalizeTeam,
    setIsAwaitingTeam,
    isAwaitingTeamRef,
  });

  useControlPanelSocket({
    socketRef,
    setBiddingActive,
    setCurrentBid,
    currentBidRef,
    currentPlayerRef,
    setBiddingTeam,
    biddingTeamRef,
    auctionVersionRef,
    setAuctionVersion,
    setHasBiddingStarted,
    setLastBidSource,
    setLatestRemoteToast,
    setActiveBiddingList,
    setDisplayMode,
    setLayout,
    setPhotoSize,
    setScreenView,
    setBreakView,
    setSelectedSquadTeam,
    configVersionRef,
    lastSyncedConfigRef,
    navigate,
    configDebounceRef,
    syncLiveScreenConfig,
    displayMode,
    layout,
    photoSize,
    screenView,
    breakView,
    selectedSquadTeam,
    setIsAwaitingTeam,
    isAwaitingTeamRef,
  });

  useEffect(() => {
    if (screenView === 'break') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBiddingActive(false);
    }
  }, [screenView]);

  // 🌟 ENRICHED BREAK DATA SNAPSHOT FOR PROJECTOR/LIVE SCREEN (REQUIREMENTS 8 & 9) 🌟
  const breakDataSnapshot = useBreakDataSnapshot({
    allPlayers,
    resolveTeam,
    normalizeCategory,
    teams,
  });

  const lastEmittedSnapshotRef = useRef('');
  useEffect(() => {
    if (!socketRef.current?.connected) return;
    const snapKey = `${breakDataSnapshot?.summary?.soldPlayers || 0}-${breakDataSnapshot?.summary?.totalSoldValue || 0}-${teams.length}-${allPlayers.length}`;
    if (lastEmittedSnapshotRef.current !== snapKey) {
      lastEmittedSnapshotRef.current = snapKey;
      syncBreakSnapshot(breakDataSnapshot);
    }
  }, [breakDataSnapshot, syncBreakSnapshot, teams.length, allPlayers.length]);

  const teamsRef = useRef(teams);
  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (currentPlayerRef.current && socketRef.current) {
        const p = currentPlayerRef.current;
        const currentTeams = teamsRef.current || [];
        const isAwaiting = Boolean(isAwaitingTeamRef?.current);
        const winningTeamObj = (!isAwaiting && biddingTeamRef.current)
          ? currentTeams.find((t) => t._id === biddingTeamRef.current || t.teamName === biddingTeamRef.current)
          : null;
        socketRef.current.emit('newLiveBid', {
          bidAmount: currentBidRef.current,
          teamId: winningTeamObj?._id || '',
          teamName: winningTeamObj?.teamName || (!isAwaiting ? biddingTeamRef.current || '' : ''),
          shortName: winningTeamObj?.shortName || '',
          logoUrl: winningTeamObj?.logoUrl || winningTeamObj?.logo || '',
          player: p,
          status: playerStatusRef.current,
          version: auctionVersionRef.current || undefined,
          isAwaitingTeam: isAwaiting
        });
      }
    }, 2000);
    return () => clearInterval(syncInterval);
  }, []);

  const {
    actionHistory,
    setActionHistory,
    saveStateToHistory,
    handleUndo,
  } = useAuctionHistory({
    currentPlayer,
    currentBid,
    biddingTeam,
    playerStatus,
    players,
    teams,
    activeBiddingList,
    teamBidActivity,
    setCurrentPlayer,
    setCurrentBid,
    setBiddingTeam,
    setPlayerStatus,
    setHasBiddingStarted,
    setPlayers,
    setTeams,
    setActiveBiddingList,
    setTeamBidActivity,
    syncActiveBiddingState,
    fetchTeamsWithMaxBid,
    fetchData,
    currentPlayerRef,
    playerStatusRef,
    socketRef,
  });

  const pickRandomPlayer = async () => {
    if (isActionProcessingRef.current) return;
    if (currentPlayer && playerStatus === 'bidding' && hasBiddingStarted && !isAwaitingTeam && Boolean(biddingTeam)) {
      alert('बिडिंग शुरू होने के बाद खिलाड़ी बदला नहीं जा सकता। पहले SOLD करें।');
      return;
    }

    const availablePlayers = players.filter((p) => p._id !== currentPlayer?._id);
    if (availablePlayers.length === 0) {
      alert('ऑक्शन के लिए कोई नया खिलाड़ी नहीं बचा है!');
      return;
    }

    isActionProcessingRef.current = true;
    setIsActionProcessing(true);

    try {
      saveStateToHistory('PICK_PLAYER');

      let selectionPool = availablePlayers;
      if (playerOrderMode === 'category-random') {
        const fallbackOrder = Array.from(new Set(availablePlayers.map((player) => normalizeCategory(player.category))));
        const effectiveOrder = categoryOrder.length > 0 ? categoryOrder : fallbackOrder;
        const activeCat = effectiveOrder.find((cat) =>
          availablePlayers.some((player) => normalizeCategory(player.category) === cat)
        );
        if (!activeCat) {
          alert('चुनी गई कैटेगरी में कोई खिलाड़ी उपलब्ध नहीं है।');
          return;
        }
        selectionPool = availablePlayers.filter((player) => normalizeCategory(player.category) === activeCat);
      } else if (playerOrderMode === 'by-name' || playerOrderMode === 'alphabetical') {
        selectionPool = [...availablePlayers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }

      const selected = (playerOrderMode === 'by-name' || playerOrderMode === 'alphabetical')
        ? selectionPool[0]
        : selectionPool[Math.floor(Math.random() * selectionPool.length)];

      let result;
      try {
        const token = localStorage.getItem('token');
        result = await apiRequest({ method: 'post', path: '/api/auction/start', data: { playerId: selected._id }, headers: { Authorization: `Bearer ${token}` } });
        const newVer = Number(result.data.state.version);
        if (Number.isFinite(newVer)) { auctionVersionRef.current = newVer; }
        setAuctionVersion(newVer);
      } catch (error) {
        alert(`🚫 ${error.response?.data?.message || 'Auction could not be started.'}`);
        return;
      }

      setCurrentPlayer(selected);
      currentPlayerRef.current = selected;
      setCurrentBid(selected.basePrice);
      setBiddingTeam('');
      setDirectSellTeam('');
      setJumpBidTeam('');
      setCustomBid('');
      setHasBiddingStarted(false);
      setIsAwaitingTeam(false);
      if (isAwaitingTeamRef) isAwaitingTeamRef.current = false;
      setPlayerStatus('bidding');
      playerStatusRef.current = 'bidding';
      setBiddingActive(false);
      setActiveBiddingList([]);
      setTeamBidActivity({});
      syncActiveBiddingState('reset');

      socketRef.current?.emit('newLiveBid', {
        bidAmount: selected.basePrice,
        teamId: '',
        teamName: '',
        shortName: '',
        logoUrl: '',
        player: selected,
        status: 'bidding',
        version: Number(result.data.state.version),
        isRemote: false,
        bidSource: 'onsite',
        isAwaitingTeam: false
      });
    } finally {
      isActionProcessingRef.current = false;
      setIsActionProcessing(false);
    }
  };

  const handleResetBid = async () => {
    if (!currentPlayer || playerStatus !== 'bidding') return;
    let newResetVersion;
    try {
      const token = localStorage.getItem('token');
      const curExpectedVersion = auctionVersionRef.current > 0 ? auctionVersionRef.current : ((auctionVersion !== undefined && auctionVersion !== null && Number(auctionVersion) > 0) ? Number(auctionVersion) : undefined);
      const result = await apiRequest({ method: 'post', path: '/api/auction/reset-bid', data: { playerId: currentPlayer._id, expectedVersion: curExpectedVersion }, headers: { Authorization: `Bearer ${token}` } });
      newResetVersion = Number(result.data.state.version);
      auctionVersionRef.current = Number.isFinite(newResetVersion) && newResetVersion > auctionVersionRef.current ? newResetVersion : auctionVersionRef.current;
      setAuctionVersion(newResetVersion);
    } catch (error) {
      alert(`🚫 ${error.response?.data?.message || 'Bid reset was rejected.'}`);
      return;
    }
    saveStateToHistory('RESET_BID');

    setCurrentBid(currentPlayer.basePrice);
    setBiddingTeam('');
    setJumpBidTeam('');
    setCustomBid('');
    setHasBiddingStarted(false);
    setIsAwaitingTeam(false);
    if (isAwaitingTeamRef) isAwaitingTeamRef.current = false;
    setActiveBiddingList([]);
    setTeamBidActivity({});
    syncActiveBiddingState('reset');
    socketRef.current?.emit('newLiveBid', {
      bidAmount: currentPlayer.basePrice,
      teamId: '',
      teamName: '',
      shortName: '',
      logoUrl: '',
      player: currentPlayer,
      status: playerStatus,
      version: newResetVersion,
      isRemote: false,
      bidSource: 'onsite',
      isAwaitingTeam: false
    });
    return true;
  };

  const finalizePlayer = async (status, options = {}) => {
    if (isActionProcessingRef.current) return;
    if (!currentPlayer || !currentPlayer._id) {
      return;
    }
    const targetTeamRef = options.soldTeamId || options.soldTeamName || biddingTeam;
    const winningTeam = resolveTeam(targetTeamRef);
    const soldPrice = Number(options.soldPrice || currentBid);
    if (status === 'Sold' && (!winningTeam || isAwaitingTeam)) {
      alert('टीम सेलेक्ट करें!');
      return;
    }
    if (status === 'Unsold' && hasBiddingStarted && !isAwaitingTeam && Boolean(biddingTeam)) {
      alert('बिडिंग शुरू होने के बाद खिलाड़ी को Unsold नहीं कर सकते।');
      return;
    }

    isActionProcessingRef.current = true;
    setIsActionProcessing(true);

    try {
      saveStateToHistory(status.toUpperCase(), currentPlayer);

      const token = localStorage.getItem('token');
      const endpoint = status === 'Sold' ? `/api/players/sell/${currentPlayer._id}` : `/api/players/unsold/${currentPlayer._id}`;
      const payload = status === 'Sold' ? { teamId: winningTeam?._id, teamName: winningTeam?.teamName, soldPrice } : {};

      await apiRequest({
        method: 'put',
        path: endpoint,
        data: payload,
        headers: { Authorization: `Bearer ${token}` }
      });

      const updatedPlayers = players.filter((p) => p._id !== currentPlayer._id);
      setPlayers(updatedPlayers);

      setPlayerStatus(status.toLowerCase());
      playerStatusRef.current = status.toLowerCase();
      setHasBiddingStarted(false);
      setIsAwaitingTeam(false);
      if (isAwaitingTeamRef) isAwaitingTeamRef.current = false;
      setDirectSellTeam('');
      setJumpBidTeam('');
      setCustomBid('');
      setActiveBiddingList([]);
      setTeamBidActivity({});
      syncActiveBiddingState('reset');

      socketRef.current?.emit('newLiveBid', {
        bidAmount: soldPrice,
        teamId: winningTeam?._id || '',
        teamName: winningTeam?.teamName || '',
        shortName: winningTeam?.shortName || '',
        logoUrl: winningTeam?.logoUrl || winningTeam?.logo || '',
        player: currentPlayer,
        status: status.toLowerCase(),
        isAwaitingTeam: false
      });

      await Promise.all([fetchTeamsWithMaxBid(), fetchData()]);
    } catch (error) {
      const backendMessage = error.response?.data?.message;
      if (backendMessage) {
        alert(`🚫 ${backendMessage}`);
      } else {
        alert('एरर! तकनीकी खराबी आ गई है।');
      }
      await Promise.all([fetchTeamsWithMaxBid(), fetchData()]);
    } finally {
      isActionProcessingRef.current = false;
      setIsActionProcessing(false);
    }
  };

  const {
    updateBid,
    handleCommonBid,
    isCommonBidProcessing,
    handleCustomBidSubmit,
    handleToggleBidding,
    handleDirectBaseSell,
  } = useAuctionBidding({
    playerStatus,
    biddingActive,
    setBiddingActive,
    biddingButtonsCount,
    btn1,
    btn2,
    btn3,
    currentBid,
    setCurrentBid,
    currentBidRef,
    biddingTeam,
    setBiddingTeam,
    biddingTeamRef,
    currentPlayer,
    currentPlayerRef,
    auctionVersion,
    auctionVersionRef,
    setAuctionVersion,
    saveStateToHistory,
    setLastBidSource,
    setHasBiddingStarted,
    teamBidActivity,
    setTeamBidActivity,
    activeBiddingList,
    setActiveBiddingList,
    syncActiveBiddingState,
    socketRef,
    resolveTeam,
    getTeamLabel,
    formatCurrency,
    customBid,
    setCustomBid,
    jumpBidTeam,
    setJumpBidTeam,
    directSellTeam,
    setDirectSellTeam,
    finalizePlayer,
    screenView,
    isAwaitingTeam,
    setIsAwaitingTeam,
    isAwaitingTeamRef,
  });

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = String(event.target?.tagName || '').toLowerCase();
      const isTypingTarget = ['input', 'textarea', 'select'].includes(tag) || event.target?.isContentEditable;
      if (isTypingTarget || event.ctrlKey || event.metaKey || event.altKey) return;

      const key = String(event.key || '').toLowerCase();
      if (key === 'n') {
        event.preventDefault();
        if (isActionProcessingRef.current) return;
        pickRandomPlayer();
      } else if (key === 's') {
        event.preventDefault();
        if (isActionProcessingRef.current) return;
        finalizePlayer('Sold');
      } else if (key === 'u') {
        event.preventDefault();
        if (isActionProcessingRef.current) return;
        if (!currentPlayer || !currentPlayer._id) return;
        finalizePlayer('Unsold');
      } else if (key === 'r') {
        event.preventDefault();
        if (isActionProcessingRef.current) return;
        handleResetBid();
      } else if (key === 'c') {
        event.preventDefault();
        if (isActionProcessingRef.current) return;
        handleCommonBid();
      } else if (key === 'b') {
        event.preventDefault();
        setScreenView((prev) => {
          const next = prev === 'live' ? 'break' : 'live';
          configVersionRef.current += 1;
          syncLiveScreenConfig({
            displayMode,
            layout,
            photoSize,
            screenView: next,
            breakView,
            selectedSquadTeam,
            version: configVersionRef.current,
            updatedAtMs: Date.now()
          });
          return next;
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pickRandomPlayer, finalizePlayer, handleResetBid, displayMode, layout, photoSize, breakView, selectedSquadTeam, syncLiveScreenConfig]);

  const {
    openResultsModal,
    bringBackToAuction,
    bringAllBackToAuction,
    bringAllPlayersBack,
    resetWholeAuction,
    isLoadingResults,
    resultsError,
    retryFetchResults,
  } = useAuctionRecovery({
    allPlayers,
    players,
    setPlayers,
    currentPlayer,
    setCurrentPlayer,
    setCurrentBid,
    setBiddingTeam,
    setPlayerStatus,
    setHasBiddingStarted,
    setActionHistory,
    setActiveBiddingList,
    setTeamBidActivity,
    syncActiveBiddingState,
    setShowSettingsModal,
    setShowResultsModal,
    auctionResultDatabase,
    setAuctionResultDatabase,
    fetchData,
    fetchTeamsWithMaxBid,
    isProcessingRecovery,
    setIsProcessingRecovery,
    currentPlayerRef,
    playerStatusRef,
    socketRef,
  });

    // Switch Break View directly
  const handleSwitchBreakView = (view) => {
    setBreakView(view);
    setScreenView('break');
    configVersionRef.current += 1;
    syncLiveScreenConfig({
      displayMode,
      layout,
      photoSize,
      screenView: 'break',
      breakView: view,
      selectedSquadTeam: selectedSquadTeam || teams[0]?.teamName || '',
      version: configVersionRef.current,
      updatedAtMs: Date.now()
    });
  };

  // Select team for Squad View
  const handleSelectSquadTeam = (teamName) => {
    setSelectedSquadTeam(teamName);
    setScreenView('break');
    configVersionRef.current += 1;
    syncLiveScreenConfig({
      displayMode,
      layout,
      photoSize,
      screenView: 'break',
      breakView: 'squad-list',
      selectedSquadTeam: teamName,
      version: configVersionRef.current,
      updatedAtMs: Date.now()
    });
  };

  const categoriesFromPlayers = Array.from(new Set(players.map((player) => normalizeCategory(player.category))));
  const effectiveCategoryOrder = categoryOrder.length > 0 ? categoryOrder : categoriesFromPlayers;
  const activeCategory = effectiveCategoryOrder.find((category) =>
    players.some((player) => normalizeCategory(player.category) === category)
  );

  const activeBiddingTeamData = useMemo(() => {
    if (isAwaitingTeam) return null;
    return resolveTeam(biddingTeam);
  }, [biddingTeam, resolveTeam, isAwaitingTeam]);

  const filteredTeams = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    return teams.filter((team) => {
      const name = String(team.teamName || '').toLowerCase();
      const shortName = String(team.shortName || '').toLowerCase();
      const owner = String(team.ownerName || team.owner || '').toLowerCase();
      const matchesSearch = !query || name.includes(query) || shortName.includes(query) || owner.includes(query);
      if (!matchesSearch) return false;

      if (teamFilter === 'can-bid') {
        return currentBid + btn1 <= Number(team.maxBid || 0) && Number(team.remainingPurse || 0) >= currentBid + btn1;
      }
      if (teamFilter === 'low-purse') {
        return Number(team.remainingPurse || 0) < 100000;
      }
      if (teamFilter === 'active-zone') {
        return activeBiddingList.some((item) => {
          const resolved = resolveTeam(item);
          return resolved && String(resolved._id) === String(team._id);
        });
      }
      return true;
    });
  }, [teams, teamSearch, teamFilter, currentBid, btn1, activeBiddingList, resolveTeam]);

  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden text-slate-900 select-none">
      {/* 🌟 TOP APP BAR 🌟 */}
      <ControlPanelHeader
        tournament={tournament}
        screenView={screenView}
        setScreenView={setScreenView}
        actionHistory={actionHistory}
        handleUndo={handleUndo}
        configVersionRef={configVersionRef}
        syncLiveScreenConfig={syncLiveScreenConfig}
        displayMode={displayMode}
        layout={layout}
        photoSize={photoSize}
        breakView={breakView}
        selectedSquadTeam={selectedSquadTeam}
        openResultsModal={openResultsModal}
        setShowSettingsModal={setShowSettingsModal}
        navigate={navigate}
      />

      {/* 🌟 MAIN OPERATOR WORKSPACE 🌟 */}
      <main className="flex-1 min-h-0 p-2.5 lg:p-3 overflow-hidden">
        {screenView === 'break' ? (
          <BreakModeManager
            setScreenView={setScreenView}
            configVersionRef={configVersionRef}
            syncLiveScreenConfig={syncLiveScreenConfig}
            displayMode={displayMode}
            layout={layout}
            photoSize={photoSize}
            breakView={breakView}
            selectedSquadTeam={selectedSquadTeam}
            handleSwitchBreakView={handleSwitchBreakView}
            teams={teams}
            handleSelectSquadTeam={handleSelectSquadTeam}
            breakDataSnapshot={breakDataSnapshot}
          />        ) : (
          /* ========================================================================= */
          /* 🌟 AUCTIONEER OPERATOR WORKSPACE (REQUIREMENTS 1, 2, 3 & 4) 🌟 */
          /* ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 h-full overflow-hidden">
            {/* 🌟 LEFT COLUMN: PLAYER CARD & AUCTIONEER HAMMER 🌟 */}
            <PlayerStageCard
              isActionProcessing={isActionProcessing}
              pickRandomPlayer={pickRandomPlayer}
              currentPlayer={currentPlayer}
              playerStatus={playerStatus}
              hasBiddingStarted={hasBiddingStarted}
              players={players}
              biddingActive={biddingActive}
              handleToggleBidding={handleToggleBidding}
              normalizeCategory={normalizeCategory}
              finalizePlayer={finalizePlayer}
              biddingTeam={biddingTeam}
              getTeamLabel={getTeamLabel}
              currentBid={currentBid}
              isAwaitingTeam={isAwaitingTeam}
            />

                        {/* 🌟 RIGHT COLUMN: BID STATUS, QUICK BIDS, ACTIVE BIDDERS & 16-TEAM GRID 🌟 */}
            <div
              className={`lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-3 flex flex-col overflow-hidden transition-all ${
                !currentPlayer || playerStatus !== 'bidding' ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              <BiddingControlBar
                isActionProcessing={isActionProcessing}
                currentPlayer={currentPlayer}
                currentBid={currentBid}
                handleResetBid={handleResetBid}
                activeBiddingTeamData={activeBiddingTeamData}
                lastBidSource={lastBidSource}
                latestRemoteToast={latestRemoteToast}
                setLatestRemoteToast={setLatestRemoteToast}
                jumpBidTeam={jumpBidTeam}
                setJumpBidTeam={setJumpBidTeam}
                biddingTeam={biddingTeam}
                resolveTeam={resolveTeam}
                teams={teams}
                formatCurrency={formatCurrency}
                customBid={customBid}
                setCustomBid={setCustomBid}
                handleCustomBidSubmit={handleCustomBidSubmit}
                biddingActive={biddingActive}
                directSellTeam={directSellTeam}
                setDirectSellTeam={setDirectSellTeam}
                handleDirectBaseSell={handleDirectBaseSell}
                handleCommonBid={handleCommonBid}
                isCommonBidProcessing={isCommonBidProcessing}
                isAwaitingTeam={isAwaitingTeam}
                playerStatus={playerStatus}
              />

                            {/* 🌟 ACTIVE BIDDERS ZONE (MAX 4 TEAMS) (REQUIREMENT 3) 🌟 */}
              <ActiveBiddingZone
                activeBiddingTeams={activeBiddingTeams}
                biddingTeam={biddingTeam}
                lastBidSource={lastBidSource}
                formatCurrency={formatCurrency}
                biddingButtonsCount={biddingButtonsCount}
                biddingActive={biddingActive}
                currentBid={currentBid}
                btn1={btn1}
                btn2={btn2}
                btn3={btn3}
                updateBid={updateBid}
                isAwaitingTeam={isAwaitingTeam}
              />

              <TeamAuctionGrid
                teamSearch={teamSearch}
                setTeamSearch={setTeamSearch}
                teamFilter={teamFilter}
                setTeamFilter={setTeamFilter}
                filteredTeams={filteredTeams}
                teams={teams}
                biddingTeam={biddingTeam}
                currentBid={currentBid}
                lastBidSource={lastBidSource}
                activeBiddingTeams={activeBiddingTeams}
                updateBid={updateBid}
                btn1={btn1}
                btn2={btn2}
                btn3={btn3}
                biddingButtonsCount={biddingButtonsCount}
                formatCurrency={formatCurrency}
                biddingActive={biddingActive}
                isAwaitingTeam={isAwaitingTeam}
              />
            </div>
          </div>
        )}
      </main>

      {/* 🌟 REDESIGNED AUCTION RESULTS & RECOVERY MODAL 🌟 */}
      <ResultsModal
        showResultsModal={showResultsModal}
        setShowResultsModal={setShowResultsModal}
        auctionResultDatabase={auctionResultDatabase}
        isLoadingResults={isLoadingResults}
        resultsError={resultsError}
        retryFetchResults={retryFetchResults}
        resultsActiveTab={resultsActiveTab}
        setResultsActiveTab={setResultsActiveTab}
        resultsSearchQuery={resultsSearchQuery}
        setResultsSearchQuery={setResultsSearchQuery}
        getTeamLabel={getTeamLabel}
        getTeamFullName={getTeamFullName}
        bringAllBackToAuction={bringAllBackToAuction}
        bringAllPlayersBack={bringAllPlayersBack}
        bringBackToAuction={bringBackToAuction}
        resetWholeAuction={resetWholeAuction}
        isProcessingRecovery={isProcessingRecovery}
      />

      {/* 🌟 SETTINGS MODAL 🌟 */}
      <SettingsModal
        showSettingsModal={showSettingsModal}
        setShowSettingsModal={setShowSettingsModal}
        playerOrderMode={playerOrderMode}
        setPlayerOrderMode={setPlayerOrderMode}
        effectiveCategoryOrder={effectiveCategoryOrder}
        categoriesFromPlayers={categoriesFromPlayers}
        setCategoryOrder={setCategoryOrder}
        activeCategory={activeCategory}
        displayMode={displayMode}
        setDisplayMode={setDisplayMode}
        layout={layout}
        setLayout={setLayout}
        photoSize={photoSize}
        setPhotoSize={setPhotoSize}
        openResultsModal={openResultsModal}
        resetWholeAuction={resetWholeAuction}
      />
    </div>
  );
}

export default ControlPanel;
