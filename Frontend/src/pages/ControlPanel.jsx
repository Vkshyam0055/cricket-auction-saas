import React, { useState, useEffect, useContext, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { TournamentContext } from '../context/TournamentContext';
import { apiRequest, clearAuthSession, getSocketBaseUrl } from '../utils/apiClient';

function ControlPanel() {
  const navigate = useNavigate();
  const { tournament } = useContext(TournamentContext);
  const socketRef = useRef(null);

  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);

  const [currentPlayer, setCurrentPlayer] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('currentPlayer')) || null;
    } catch {
      return null;
    }
  });
  const [currentBid, setCurrentBid] = useState(() => Number(localStorage.getItem('currentBid')) || 0);
  const [biddingTeam, setBiddingTeam] = useState(() => localStorage.getItem('biddingTeam') || '');
  const [playerStatus, setPlayerStatus] = useState(() => localStorage.getItem('playerStatus') || 'bidding');
  const [customBid, setCustomBid] = useState('');
  const [hasBiddingStarted, setHasBiddingStarted] = useState(() => localStorage.getItem('hasBiddingStarted') === 'true');
  const [playerOrderMode, setPlayerOrderMode] = useState(() => localStorage.getItem('playerOrderMode') || 'all-random');
  const [categoryOrder, setCategoryOrder] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('categoryOrder') || '[]');
    } catch {
      return [];
    }
  });

  // 🌟 DETERMINISTIC ACTIVE BIDDING ZONE (MAX 4 TEAMS) (REQUIREMENT 3) 🌟
  const [activeBiddingList, setActiveBiddingList] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('activeBiddingList') || localStorage.getItem('lastBidActions') || '[]');
      return Array.isArray(saved) ? saved.slice(0, 4) : [];
    } catch {
      return [];
    }
  });

  const [teamBidActivity, setTeamBidActivity] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('teamBidActivity') || '{}');
    } catch {
      return {};
    }
  });

  const [displayMode, setDisplayMode] = useState('night');
  const [layout, setLayout] = useState('classic');
  const [photoSize, setPhotoSize] = useState('medium');
  const [screenView, setScreenView] = useState('live');
  const [breakView, setBreakView] = useState('teams-dashboard');
  const [selectedSquadTeam, setSelectedSquadTeam] = useState(() => localStorage.getItem('selectedSquadTeam') || '');

  const currentPlayerRef = useRef(currentPlayer);
  const playerStatusRef = useRef(playerStatus);

  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  useEffect(() => {
    playerStatusRef.current = playerStatus;
  }, [playerStatus]);

  const configVersionRef = useRef(0);
  const configDebounceRef = useRef(null);
  const lastSyncedConfigRef = useRef(null);

  const [actionHistory, setActionHistory] = useState([]);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [auctionResultDatabase, setAuctionResultDatabase] = useState([]);
  const [resultsActiveTab, setResultsActiveTab] = useState('all');
  const [resultsSearchQuery, setResultsSearchQuery] = useState('');
  const [isProcessingRecovery, setIsProcessingRecovery] = useState(false);
  const [directSellTeam, setDirectSellTeam] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');

  // 🌟 DYNAMIC BID BUTTONS VALUES 🌟
  const btn1 = tournament?.bidButton1 || 500;
  const btn2 = tournament?.bidButton2 || 1000;
  const btn3 = tournament?.bidButton3 || 5000;

  // 🌟 SMART FORMATTING 🌟
  const formatBidButton = (value) => {
    if (value >= 100000) return `+${value / 100000}L`;
    if (value >= 1000) return `+${value / 1000}K`;
    return `+${value}`;
  };

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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

  const normalizeCategory = (category) => {
    const value = String(category || '').trim();
    return value || 'Uncategorized';
  };

  const normalizeTeam = useCallback((team) => ({
    ...team,
    teamName: String(team?.teamName || '').trim(),
    shortName: String(team?.shortName || '').trim(),
    remainingPurse: Number(team?.remainingPurse || 0),
    maxBid: Number(team?.maxBid || 0),
    remainingRequiredPlayers: Number(team?.remainingRequiredPlayers || 0)
  }), []);

  const fetchTeamsWithMaxBid = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const teamsRes = await apiRequest({
        method: 'get',
        path: '/api/teams',
        headers,
        params: {
          basePrice: Number(currentPlayer?.basePrice || 0)
        }
      });
      const payload = Array.isArray(teamsRes.data) ? teamsRes.data : [];
      setTeams(payload.map(normalizeTeam));
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const playersRes = await apiRequest({ method: 'get', path: '/api/players', headers });
      const allPlayersPayload = Array.isArray(playersRes.data) ? playersRes.data : [];
      setAllPlayers(allPlayersPayload);

      const availablePlayers = allPlayersPayload.filter(
        (player) =>
          player.approvalStatus?.trim().toLowerCase() === 'approved' &&
          player.auctionStatus?.trim().toLowerCase() === 'readyforauction'
      );
      setPlayers(availablePlayers);
      setCategoryOrder((prev) => {
        const categories = Array.from(new Set(availablePlayers.map((player) => normalizeCategory(player.category))));
        if (categories.length === 0) return [];
        const preserved = prev.filter((category) => categories.includes(category));
        const missing = categories.filter((category) => !preserved.includes(category));
        return [...preserved, ...missing];
      });

      // 🌟 SYNCHRONIZE CURRENT PLAYER WITH DATABASE STATE 🌟
      const curr = currentPlayerRef.current;
      if (curr) {
        const dbPlayer = allPlayersPayload.find((p) => p._id === curr._id);
        const currStatus = playerStatusRef.current;

        if (!dbPlayer || dbPlayer.approvalStatus?.trim().toLowerCase() !== 'approved') {
          // Player does not exist or is unapproved in DB
          setCurrentPlayer(null);
          setPlayerStatus('bidding');
          setCurrentBid(0);
          setBiddingTeam('');
          setHasBiddingStarted(false);
          setActiveBiddingList([]);
          setTeamBidActivity({});
          localStorage.removeItem('currentPlayer');
          localStorage.removeItem('currentBid');
          localStorage.removeItem('biddingTeam');
          localStorage.removeItem('activeBiddingList');
          localStorage.removeItem('lastBidActions');
          localStorage.removeItem('teamBidActivity');
          socketRef.current?.emit('newLiveBid', { bidAmount: 0, teamName: '', player: null, status: 'bidding' });
        } else if (dbPlayer.auctionStatus?.trim().toLowerCase() === 'sold') {
          if (currStatus === 'bidding') {
            // STALE STATE DETECTED: Player is already Sold in DB, but local state was bidding!
            // Cleanly reset current player stage so operator can pick a valid player
            setCurrentPlayer(null);
            setPlayerStatus('bidding');
            setCurrentBid(0);
            setBiddingTeam('');
            setHasBiddingStarted(false);
            setActiveBiddingList([]);
            setTeamBidActivity({});
            localStorage.removeItem('currentPlayer');
            localStorage.removeItem('currentBid');
            localStorage.removeItem('biddingTeam');
            localStorage.removeItem('activeBiddingList');
            localStorage.removeItem('lastBidActions');
            localStorage.removeItem('teamBidActivity');
            socketRef.current?.emit('newLiveBid', { bidAmount: 0, teamName: '', player: null, status: 'bidding' });
          } else {
            // Legitimately sold in current session (hammer confirmation)
            setCurrentPlayer(dbPlayer);
            if (dbPlayer.soldPrice) setCurrentBid(dbPlayer.soldPrice);
            if (dbPlayer.soldTo) setBiddingTeam(dbPlayer.soldTo?._id || dbPlayer.soldTo);
          }
        } else if (dbPlayer.auctionStatus?.trim().toLowerCase() === 'unsold') {
          if (currStatus === 'bidding') {
            // STALE STATE DETECTED: Player is already Unsold in DB, but local state was bidding!
            setCurrentPlayer(null);
            setPlayerStatus('bidding');
            setCurrentBid(0);
            setBiddingTeam('');
            setHasBiddingStarted(false);
            setActiveBiddingList([]);
            setTeamBidActivity({});
            localStorage.removeItem('currentPlayer');
            localStorage.removeItem('currentBid');
            localStorage.removeItem('biddingTeam');
            localStorage.removeItem('activeBiddingList');
            localStorage.removeItem('lastBidActions');
            localStorage.removeItem('teamBidActivity');
            socketRef.current?.emit('newLiveBid', { bidAmount: 0, teamName: '', player: null, status: 'bidding' });
          } else {
            setCurrentPlayer(dbPlayer);
          }
        } else if (dbPlayer.auctionStatus?.trim().toLowerCase() === 'readyforauction') {
          // Fresh valid player ready for auction
          setCurrentPlayer(dbPlayer);
        } else {
          // Any other status (Pending, etc.)
          setCurrentPlayer(null);
          setPlayerStatus('bidding');
          setCurrentBid(0);
          setBiddingTeam('');
          setHasBiddingStarted(false);
          setActiveBiddingList([]);
          setTeamBidActivity({});
          localStorage.removeItem('currentPlayer');
          localStorage.removeItem('currentBid');
          localStorage.removeItem('biddingTeam');
          localStorage.removeItem('activeBiddingList');
          localStorage.removeItem('lastBidActions');
          localStorage.removeItem('teamBidActivity');
          socketRef.current?.emit('newLiveBid', { bidAmount: 0, teamName: '', player: null, status: 'bidding' });
        }
      }

      await fetchTeamsWithMaxBid();
    } catch (error) {
      console.error('Failed to fetch players:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchTeamsWithMaxBid();
  }, [currentPlayer?._id, currentPlayer?.basePrice]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchTeamsWithMaxBid();
    }, 15000);
    return () => clearInterval(id);
  }, [currentPlayer?._id, currentPlayer?.basePrice]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const socket = io(getSocketBaseUrl(), {
      auth: { token }
    });
    socketRef.current = socket;

    socket.on('activeBiddingSync', (data) => {
      if (Array.isArray(data?.lastBidActions)) {
        setActiveBiddingList(data.lastBidActions.slice(0, 4));
      }
    });

    socket.on('activeBiddingUpdate', (data) => {
      if (Array.isArray(data?.lastBidActions)) {
        setActiveBiddingList(data.lastBidActions.slice(0, 4));
      }
    });

    socket.on('liveScreenConfigSync', (data) => {
      if (!data) return;
      setDisplayMode(data.displayMode || 'night');
      setLayout(data.layout || 'classic');
      setPhotoSize(data.photoSize || 'medium');
      setScreenView(data.screenView === 'break' ? 'break' : 'live');
      setBreakView(data.breakView || 'teams-dashboard');
      if (data.selectedSquadTeam !== undefined) {
        setSelectedSquadTeam(data.selectedSquadTeam);
      }
      configVersionRef.current = Number(data.version || 0);
      lastSyncedConfigRef.current = `${data.displayMode || 'night'}|${data.layout || 'classic'}|${data.photoSize || 'medium'}|${data.screenView === 'break' ? 'break' : 'live'}|${data.breakView || 'teams-dashboard'}|${data.selectedSquadTeam !== undefined ? data.selectedSquadTeam : ''}`;
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
      socket.off('activeBiddingSync');
      socket.off('activeBiddingUpdate');
      socket.off('liveScreenConfigSync');
      socket.off('sessionExpired');
      socket.off('connect_error');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [navigate]);

  useEffect(() => {
    if (!socketRef.current?.connected) return;
    if (configDebounceRef.current) {
      clearTimeout(configDebounceRef.current);
    }
    configDebounceRef.current = setTimeout(() => {
      configVersionRef.current += 1;
      syncLiveScreenConfig({
        displayMode,
        layout,
        photoSize,
        screenView,
        breakView,
        selectedSquadTeam,
        version: configVersionRef.current,
        updatedAtMs: Date.now()
      });
    }, 180);
    return () => {
      if (configDebounceRef.current) {
        clearTimeout(configDebounceRef.current);
      }
    };
  }, [displayMode, layout, photoSize, screenView, breakView, selectedSquadTeam, syncLiveScreenConfig]);

  // 🌟 ENRICHED BREAK DATA SNAPSHOT FOR PROJECTOR/LIVE SCREEN (REQUIREMENTS 8 & 9) 🌟
  const breakDataSnapshot = useMemo(() => {
    const soldPlayers = allPlayers
      .filter((player) => String(player.auctionStatus || '').toLowerCase() === 'sold')
      .map((player) => {
        const teamMatch = resolveTeam(player.soldTo);
        return {
          _id: player._id,
          name: player.name,
          photoUrl: player.photoUrl,
          role: player.role,
          category: normalizeCategory(player.category),
          soldTo: teamMatch ? {
            _id: teamMatch._id,
            teamName: teamMatch.teamName,
            shortName: teamMatch.shortName,
            logoUrl: teamMatch.logoUrl || teamMatch.logo || ''
          } : player.soldTo,
          soldPrice: Number(player.soldPrice || 0)
        };
      });

    const squadsByTeam = {};
    for (const player of soldPlayers) {
      const team = resolveTeam(player.soldTo);
      const keys = [
        player.soldTo?._id ? String(player.soldTo._id) : null,
        player.soldTo ? String(player.soldTo) : null,
        team?._id ? String(team._id) : null,
        team?.teamName || null
      ].filter(Boolean);

      for (const k of new Set(keys)) {
        if (!squadsByTeam[k]) squadsByTeam[k] = [];
        squadsByTeam[k].push(player);
      }
    }

    const unsoldCount = allPlayers.filter((player) => String(player.auctionStatus || '').toLowerCase() === 'unsold').length;
    const readyCount = allPlayers.filter((player) => String(player.auctionStatus || '').toLowerCase() === 'readyforauction').length;

    const topBiddings = [...soldPlayers]
      .sort((a, b) => Number(b.soldPrice || 0) - Number(a.soldPrice || 0))
      .slice(0, 10);

    const totalSoldValue = soldPlayers.reduce((sum, player) => sum + Number(player.soldPrice || 0), 0);
    const totalLeaguePurse = teams.reduce((sum, team) => sum + Number(team.totalPurse || 0), 0);
    const totalRemainingPurse = teams.reduce((sum, team) => sum + Number(team.remainingPurse || 0), 0);
    const avgPlayerPrice = soldPlayers.length > 0 ? Math.round(totalSoldValue / soldPlayers.length) : 0;
    const highestBid = topBiddings.length > 0 ? topBiddings[0] : null;

    // Determine top spending team
    const spendingByTeam = teams.map((team) => {
      const teamSold = squadsByTeam[String(team._id)] || squadsByTeam[team.teamName] || [];
      const spent = teamSold.reduce((sum, p) => sum + Number(p.soldPrice || 0), 0);
      return {
        _id: team._id,
        teamName: team.teamName,
        shortName: team.shortName,
        logoUrl: team.logoUrl || team.logo || '',
        spent,
        playersCount: teamSold.length
      };
    });
    spendingByTeam.sort((a, b) => b.spent - a.spent);
    const topSpendingTeam = spendingByTeam.length > 0 && spendingByTeam[0].spent > 0 ? spendingByTeam[0] : null;

    return {
      teams: teams.map((team) => ({
        _id: team._id,
        teamName: team.teamName,
        shortName: team.shortName,
        logoUrl: team.logoUrl || team.logo || '',
        totalPurse: Number(team.totalPurse || 0),
        remainingPurse: Number(team.remainingPurse || 0),
        maxBid: Number(team.maxBid || 0),
        remainingRequiredPlayers: Number(team.remainingRequiredPlayers || 0),
        squadCount: (squadsByTeam[String(team._id)] || squadsByTeam[team.teamName] || []).length
      })),
      soldPlayers,
      squadsByTeam,
      summary: {
        totalTeams: teams.length,
        soldPlayers: soldPlayers.length,
        unsoldPlayers: unsoldCount,
        readyForAuction: readyCount,
        totalSoldValue,
        totalLeaguePurse,
        totalRemainingPurse,
        avgPlayerPrice,
        highestBid,
        topSpendingTeam
      },
      topBiddings
    };
  }, [teams, allPlayers]);

  useEffect(() => {
    syncBreakSnapshot(breakDataSnapshot);
  }, [breakDataSnapshot, syncBreakSnapshot]);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (currentPlayer && socketRef.current) {
        const winningTeamObj = teams.find((t) => t._id === biddingTeam || t.teamName === biddingTeam);
        socketRef.current.emit('newLiveBid', {
          bidAmount: currentBid,
          teamId: winningTeamObj?._id || '',
          teamName: winningTeamObj?.teamName || biddingTeam || '',
          shortName: winningTeamObj?.shortName || '',
          logoUrl: winningTeamObj?.logoUrl || winningTeamObj?.logo || '',
          player: currentPlayer,
          status: playerStatus
        });
      }
    }, 2000);
    return () => clearInterval(syncInterval);
  }, [currentPlayer, currentBid, biddingTeam, playerStatus, teams]);

  const saveStateToHistory = (actionType, affectedPlayer = null) => {
    setActionHistory((prev) => [
      ...prev,
      {
        actionType,
        affectedPlayer,
        snapshot: {
          currentPlayer,
          currentBid,
          biddingTeam,
          playerStatus,
          players: [...players],
          teams: JSON.parse(JSON.stringify(teams)),
          activeBiddingList: [...activeBiddingList],
          teamBidActivity: { ...teamBidActivity }
        }
      }
    ]);
  };

  const pickRandomPlayer = () => {
    if (currentPlayer && playerStatus === 'bidding' && hasBiddingStarted) {
      alert('बिडिंग शुरू होने के बाद खिलाड़ी बदला नहीं जा सकता। पहले SOLD करें।');
      return;
    }

    const availablePlayers = players.filter((p) => p._id !== currentPlayer?._id);
    if (availablePlayers.length === 0) {
      alert('ऑक्शन के लिए कोई नया खिलाड़ी नहीं बचा है!');
      return;
    }

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
    }

    const randomIndex = Math.floor(Math.random() * selectionPool.length);
    const selected = selectionPool[randomIndex];

    setCurrentPlayer(selected);
    currentPlayerRef.current = selected;
    setCurrentBid(selected.basePrice);
    setBiddingTeam('');
    setDirectSellTeam('');
    setCustomBid('');
    setHasBiddingStarted(false);
    setPlayerStatus('bidding');
    playerStatusRef.current = 'bidding';
    setActiveBiddingList([]);
    setTeamBidActivity({});
    syncActiveBiddingState('reset');

    socketRef.current?.emit('newLiveBid', {
      bidAmount: selected.basePrice,
      teamName: '',
      player: selected,
      status: 'bidding'
    });
  };

  const handleResetBid = () => {
    if (!currentPlayer || playerStatus !== 'bidding') return;
    saveStateToHistory('RESET_BID');

    setCurrentBid(currentPlayer.basePrice);
    setBiddingTeam('');
    setActiveBiddingList([]);
    setTeamBidActivity({});
    syncActiveBiddingState('reset');
    socketRef.current?.emit('newLiveBid', {
      bidAmount: currentPlayer.basePrice,
      teamName: '',
      player: currentPlayer,
      status: playerStatus
    });
  };

  // 🌟 DETERMINISTIC ACTIVE BIDDING RETENTION ALGORITHM (REQUIREMENT 3) 🌟
  // 1. If team is already in active 4: remains in active 4 (no eviction, update recency)
  // 2. If < 4 teams: add new team
  // 3. If 4 teams and 5th team enters: replace least recently active non-leading team
  const updateBid = async (teamRef, amount, isJump = false) => {
    if (playerStatus !== 'bidding') return;

    const team = resolveTeam(teamRef);
    if (!team) return;

    const newBidAmount = isJump ? amount : currentBid + amount;

    if (newBidAmount > team.remainingPurse) {
      alert(`⚠️ ${team.teamName} के पास इतने पैसे नहीं हैं!`);
      return;
    }

    if (newBidAmount > Number(team.maxBid || 0)) {
      alert(`🚫 ${team.teamName} का Max Bid ${formatCurrency(team.maxBid)} है। इस लिमिट से ऊपर bid नहीं कर सकते।`);
      return;
    }

    saveStateToHistory('BID');

    setCurrentBid(newBidAmount);
    setBiddingTeam(team._id);
    setHasBiddingStarted(true);

    const now = Date.now();
    const nextActivity = { ...teamBidActivity, [String(team._id)]: now, [team.teamName]: now };
    let nextList = [...activeBiddingList];

    // Check if team is already in active 4 (by _id or teamName)
    const existingIdx = nextList.findIndex((item) => {
      const match = resolveTeam(item);
      return match && String(match._id) === String(team._id);
    });

    if (existingIdx !== -1) {
      // Retain in-place, store team._id
      nextList[existingIdx] = team._id;
    } else if (nextList.length < 4) {
      nextList.push(team._id);
    } else {
      let oldestIdx = 0;
      let oldestTime = nextActivity[String(nextList[0])] ?? nextActivity[nextList[0]] ?? 0;
      for (let i = 1; i < nextList.length; i++) {
        const tTime = nextActivity[String(nextList[i])] ?? nextActivity[nextList[i]] ?? 0;
        if (tTime < oldestTime) {
          oldestTime = tTime;
          oldestIdx = i;
        }
      }
      nextList[oldestIdx] = team._id;
    }

    setActiveBiddingList(nextList);
    setTeamBidActivity(nextActivity);
    syncActiveBiddingState('replace', { lastBidActions: nextList });

    socketRef.current?.emit('newLiveBid', {
      bidAmount: newBidAmount,
      teamId: team._id,
      teamName: team.teamName,
      shortName: team.shortName,
      logoUrl: team.logoUrl || team.logo || '',
      player: currentPlayer,
      status: playerStatus
    });
  };

  const handleCustomBidSubmit = async () => {
    const amount = Number(customBid);
    if (!biddingTeam) {
      alert('पहले ग्रिड से एक टीम सेलेक्ट करें!');
      return;
    }
    if (amount <= currentBid) {
      alert('Jump Bid करंट बिड से ज़्यादा होनी चाहिए!');
      return;
    }
    await updateBid(biddingTeam, amount, true);
    setCustomBid('');
  };

  const handleDirectBaseSell = async () => {
    if (!currentPlayer || playerStatus !== 'bidding') return;
    if (!directSellTeam) {
      alert('पहले टीम चुनें।');
      return;
    }

    const basePrice = Number(currentPlayer.basePrice || 0);
    const selectedTeam = resolveTeam(directSellTeam);
    if (!selectedTeam) {
      alert('टीम नहीं मिली।');
      return;
    }
    if (basePrice > Number(selectedTeam.maxBid || 0)) {
      alert(`🚫 ${getTeamLabel(selectedTeam)} का Max Bid ${formatCurrency(selectedTeam.maxBid)} है।`);
      return;
    }

    setBiddingTeam(selectedTeam._id);
    setCurrentBid(basePrice);
    await finalizePlayer('Sold', {
      soldTeamId: selectedTeam._id,
      soldTeamName: selectedTeam.teamName,
      soldPrice: basePrice
    });
  };

  const finalizePlayer = async (status, options = {}) => {
    const targetTeamRef = options.soldTeamId || options.soldTeamName || biddingTeam;
    const winningTeam = resolveTeam(targetTeamRef);
    const soldPrice = Number(options.soldPrice || currentBid);
    if (status === 'Sold' && !winningTeam) {
      alert('टीम सेलेक्ट करें!');
      return;
    }
    if (status === 'Unsold' && hasBiddingStarted) {
      alert('बिडिंग शुरू होने के बाद खिलाड़ी को Unsold नहीं कर सकते।');
      return;
    }

    saveStateToHistory(status.toUpperCase(), currentPlayer);

    try {
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
      setDirectSellTeam('');
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
        status: status.toLowerCase()
      });

      await fetchTeamsWithMaxBid();
      await fetchData();
    } catch (error) {
      const backendMessage = error.response?.data?.message;
      if (backendMessage) {
        alert(`🚫 ${backendMessage}`);
      } else {
        alert('एरर! तकनीकी खराबी आ गई है।');
      }
      await fetchTeamsWithMaxBid();
      await fetchData();
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = String(event.target?.tagName || '').toLowerCase();
      const isTypingTarget = ['input', 'textarea', 'select'].includes(tag) || event.target?.isContentEditable;
      if (isTypingTarget || event.ctrlKey || event.metaKey || event.altKey) return;

      const key = String(event.key || '').toLowerCase();
      if (key === 'n') {
        event.preventDefault();
        pickRandomPlayer();
      } else if (key === 's') {
        event.preventDefault();
        finalizePlayer('Sold');
      } else if (key === 'u') {
        event.preventDefault();
        finalizePlayer('Unsold');
      } else if (key === 'r') {
        event.preventDefault();
        handleResetBid();
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

  const handleUndo = async () => {
    if (actionHistory.length === 0) return;
    const lastAction = actionHistory[actionHistory.length - 1];

    if (lastAction.actionType === 'SOLD' || lastAction.actionType === 'UNSOLD') {
      try {
        const token = localStorage.getItem('token');
        await apiRequest({
          method: 'put',
          path: `/api/players/undo/${lastAction.affectedPlayer._id}`,
          data: {},
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        alert('Database Revert Failed!');
        return;
      }
    }

    const snap = lastAction.snapshot;
    setCurrentPlayer(snap.currentPlayer);
    currentPlayerRef.current = snap.currentPlayer;
    setCurrentBid(snap.currentBid);
    setBiddingTeam(snap.biddingTeam);
    setPlayerStatus(snap.playerStatus);
    playerStatusRef.current = snap.playerStatus;
    setHasBiddingStarted(Boolean(snap.biddingTeam));
    setPlayers(snap.players);
    setTeams(snap.teams);

    const restoredActive = snap.activeBiddingList || [];
    setActiveBiddingList(restoredActive);
    const restoredActivity = snap.teamBidActivity || {};
    setTeamBidActivity(restoredActivity);
    syncActiveBiddingState('replace', { lastBidActions: restoredActive });

    const restoredTeam = (snap.teams || teams).find((t) => t._id === snap.biddingTeam || t.teamName === snap.biddingTeam);
    socketRef.current?.emit('newLiveBid', {
      bidAmount: snap.currentBid || 0,
      teamId: restoredTeam?._id || '',
      teamName: restoredTeam?.teamName || snap.biddingTeam || '',
      shortName: restoredTeam?.shortName || '',
      logoUrl: restoredTeam?.logoUrl || restoredTeam?.logo || '',
      player: snap.currentPlayer,
      status: snap.playerStatus
    });

    await fetchTeamsWithMaxBid();
    await fetchData();

    setActionHistory((prev) => prev.slice(0, -1));
  };

  const openResultsModal = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await apiRequest({ method: 'get', path: '/api/players', headers: { Authorization: `Bearer ${token}` } });

      const currentReadyIds = players.map((p) => p._id);
      if (currentPlayer) currentReadyIds.push(currentPlayer._id);

      const resultPlayers = res.data.filter(
        (p) =>
          p.approvalStatus?.trim().toLowerCase() === 'approved' &&
          (p.auctionStatus?.trim().toLowerCase() === 'sold' ||
            p.auctionStatus?.trim().toLowerCase() === 'unsold' ||
            p.auctionStatus?.trim().toLowerCase() === 'passed' ||
            p.auctionStatus?.trim().toLowerCase() === 'icon') &&
          !currentReadyIds.includes(p._id)
      );

      setAuctionResultDatabase(resultPlayers);
      setShowResultsModal(true);
    } catch (error) {
      console.error('Auction result error:', error);
    }
  };

  const bringBackToAuction = async (playerToBring) => {
    if (isProcessingRecovery) return;
    setIsProcessingRecovery(true);
    try {
      const token = localStorage.getItem('token');
      await apiRequest({
        method: 'put',
        path: `/api/players/undo/${playerToBring._id}`,
        data: {},
        headers: { Authorization: `Bearer ${token}` }
      });

      setPlayers((prev) => [...prev, { ...playerToBring, auctionStatus: 'ReadyForAuction', soldTo: 'Unsold', soldPrice: 0 }]);
      setAuctionResultDatabase((prev) => prev.filter((p) => p._id !== playerToBring._id));
      await fetchTeamsWithMaxBid();
      await fetchData();
      alert(`🔥 ${playerToBring.name} को वापस ऑक्शन पूल में शामिल कर लिया गया है!`);
    } catch (error) {
      console.error('Bring back error:', error);
      alert('एरर: डेटाबेस अपडेट नहीं हो पाया!');
    } finally {
      setIsProcessingRecovery(false);
    }
  };

  const bringAllBackToAuction = async () => {
    if (isProcessingRecovery) return;
    const unsoldRoundPlayers = auctionResultDatabase.filter(
      (p) => p.auctionStatus?.trim().toLowerCase() === 'unsold' || p.auctionStatus?.trim().toLowerCase() === 'passed'
    );

    if (unsoldRoundPlayers.length === 0) {
      alert('Round-2 के लिए कोई Unsold player उपलब्ध नहीं है।');
      return;
    }

    const confirmAction = window.confirm(`क्या आप सभी ${unsoldRoundPlayers.length} Unsold players को Round-2 auction के लिए वापस लाना चाहते हैं?`);
    if (!confirmAction) return;

    setIsProcessingRecovery(true);
    try {
      const token = localStorage.getItem('token');
      await apiRequest({
        method: 'post',
        path: '/api/players/restore-unsold',
        data: {},
        headers: { Authorization: `Bearer ${token}` }
      });

      setPlayers((prev) => [
        ...prev,
        ...unsoldRoundPlayers.map((p) => ({ ...p, auctionStatus: 'ReadyForAuction', soldTo: 'Unsold', soldPrice: 0 }))
      ]);
      setAuctionResultDatabase((prev) =>
        prev.filter((p) => !(p.auctionStatus?.trim().toLowerCase() === 'unsold' || p.auctionStatus?.trim().toLowerCase() === 'passed'))
      );
      await fetchTeamsWithMaxBid();
      await fetchData();
      alert('✅ सभी Unsold players Round-2 auction के लिए वापस आ गए हैं!');
    } catch (error) {
      console.error(error);
      alert('एरर: अनसोल्ड प्लेयर्स को वापस लाने में समस्या आई।');
    } finally {
      setIsProcessingRecovery(false);
    }
  };

  const bringAllPlayersBack = async () => {
    if (isProcessingRecovery) return;
    if (auctionResultDatabase.length === 0) {
      alert('कोई Sold या Unsold player उपलब्ध नहीं है।');
      return;
    }

    const confirmAction = window.confirm(
      `⚠️ क्या आप सभी ${auctionResultDatabase.length} खिलाड़ियों (Sold + Unsold) को वापस ऑक्शन पूल में लाना चाहते हैं?\nसभी टीमों का पर्स सही तरीके से रिफंड हो जाएगा।`
    );
    if (!confirmAction) return;

    setIsProcessingRecovery(true);
    try {
      const token = localStorage.getItem('token');
      await apiRequest({
        method: 'post',
        path: '/api/players/bring-all-back',
        data: {},
        headers: { Authorization: `Bearer ${token}` }
      });

      setAuctionResultDatabase([]);
      await fetchTeamsWithMaxBid();
      await fetchData();
      alert('✅ सभी खिलाड़ी वापस ऑक्शन पूल में शामिल कर लिए गए हैं और टीमों का पर्स रिफंड हो चुका है!');
    } catch (error) {
      console.error(error);
      alert('एरर: प्लेयर्स वापस लाने में समस्या आई।');
    } finally {
      setIsProcessingRecovery(false);
    }
  };

  const resetWholeAuction = async () => {
    if (isProcessingRecovery) return;
    const confirmReset = window.confirm(
      '⚠️ महत्वपूर्ण चेतावनी!\nक्या आप पूरा ऑक्शन रीसेट करना चाहते हैं?\nइससे सभी खिलाड़ी ऑक्शन पूल में आ जाएंगे और सभी टीमों का पर्स रिसेट हो जाएगा।'
    );
    if (!confirmReset) return;

    const confirmAgain = window.prompt("सुरक्षा के लिए, कृपया बॉक्स में 'RESET' टाइप करें (बिना सिंगल कोट्स के):");
    if (confirmAgain !== 'RESET') {
      alert('❌ रीसेट कैंसल कर दिया गया।');
      return;
    }

    setIsProcessingRecovery(true);
    try {
      const token = localStorage.getItem('token');
      await apiRequest({
        method: 'post',
        path: '/api/players/reset-auction',
        data: {},
        headers: { Authorization: `Bearer ${token}` }
      });

      setCurrentPlayer(null);
      currentPlayerRef.current = null;
      setCurrentBid(0);
      setBiddingTeam('');
      setPlayerStatus('bidding');
      playerStatusRef.current = 'bidding';
      setHasBiddingStarted(false);
      setActionHistory([]);
      setActiveBiddingList([]);
      setTeamBidActivity({});
      syncActiveBiddingState('reset');

      localStorage.removeItem('currentPlayer');
      localStorage.removeItem('currentBid');
      localStorage.removeItem('biddingTeam');
      localStorage.removeItem('playerStatus');
      localStorage.removeItem('hasBiddingStarted');
      localStorage.removeItem('activeBiddingList');
      localStorage.removeItem('lastBidActions');
      localStorage.removeItem('teamBidActivity');

      socketRef.current?.emit('newLiveBid', { bidAmount: 0, teamName: '', player: null, status: 'bidding' });

      setAuctionResultDatabase([]);
      setShowResultsModal(false);
      setShowSettingsModal(false);
      await fetchTeamsWithMaxBid();
      await fetchData();
      alert('✅ 100% ऑक्शन रीसेट सफल रहा! सभी खिलाड़ी और टीमें अपनी मूल स्थिति में आ चुके हैं।');
    } catch (error) {
      console.error(error);
      alert('एरर: रीसेट करने में दिक्कत आई।');
    } finally {
      setIsProcessingRecovery(false);
    }
  };

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

  const activeBiddingTeamData = teams.find((team) => team.teamName === biddingTeam);

  const filteredTeams = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    return teams.filter((team) => {
      const name = String(team.teamName || '').toLowerCase();
      const shortName = String(team.shortName || '').toLowerCase();
      const matchesSearch = !query || name.includes(query) || shortName.includes(query);
      if (!matchesSearch) return false;

      if (teamFilter === 'can-bid') {
        return currentBid + btn1 <= Number(team.maxBid || 0) && Number(team.remainingPurse || 0) >= currentBid + btn1;
      }
      if (teamFilter === 'low-purse') {
        return Number(team.remainingPurse || 0) < 100000;
      }
      if (teamFilter === 'active-zone') {
        return activeBiddingList.includes(team.teamName);
      }
      return true;
    });
  }, [teams, teamSearch, teamFilter, currentBid, btn1, activeBiddingList]);

  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden text-slate-900 select-none">
      {/* 🌟 TOP APP BAR 🌟 */}
      <header className="bg-slate-900 px-4 py-2 flex items-center justify-between gap-3 shadow-md text-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm lg:text-base font-black truncate tracking-wide">
            ⚙️ {tournament?.name || 'Auction Control'}
          </h1>
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
              screenView === 'live'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
            }`}
          >
            {screenView === 'live' ? '● Live Screen' : '☕ Break Content'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* UNDO BUTTON */}
          <button
            onClick={handleUndo}
            disabled={actionHistory.length === 0}
            className={`font-black px-2.5 py-1 rounded-lg text-xs transition-all flex items-center gap-1 ${
              actionHistory.length > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 shadow cursor-pointer active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
            }`}
          >
            <span>⏪ Undo</span>
            {actionHistory.length > 0 && (
              <span className="bg-amber-950/20 px-1 rounded-full text-[10px]">({actionHistory.length})</span>
            )}
          </button>

          {/* SCREEN VIEW SWITCHER */}
          <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => {
                setScreenView('live');
                configVersionRef.current += 1;
                syncLiveScreenConfig({
                  displayMode,
                  layout,
                  photoSize,
                  screenView: 'live',
                  breakView,
                  selectedSquadTeam,
                  version: configVersionRef.current,
                  updatedAtMs: Date.now()
                });
              }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                screenView === 'live' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Live Auction
            </button>
            <button
              onClick={() => {
                setScreenView('break');
                configVersionRef.current += 1;
                syncLiveScreenConfig({
                  displayMode,
                  layout,
                  photoSize,
                  screenView: 'break',
                  breakView,
                  selectedSquadTeam,
                  version: configVersionRef.current,
                  updatedAtMs: Date.now()
                });
              }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                screenView === 'break' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Break Content
            </button>
          </div>

          <button
            onClick={openResultsModal}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1"
            title="Auction Results & Recovery"
          >
            <span>♻️ Results</span>
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition"
          >
            ⚙️ Settings
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 px-2.5 py-1 rounded-lg text-xs font-bold transition"
          >
            Exit
          </button>
        </div>
      </header>

      {/* 🌟 MAIN OPERATOR WORKSPACE 🌟 */}
      <main className="flex-1 min-h-0 p-2.5 lg:p-3 overflow-hidden">
        {screenView === 'break' ? (
          /* ========================================================================= */
          /* 🌟 DEDICATED BREAK CONTENT CONTROL PANEL (REQUIREMENT 5 & 7) 🌟 */
          /* ========================================================================= */
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 h-full flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Break Content Control</h2>
                </div>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Select and project intermission content directly onto the Live Screen
                </p>
              </div>

              <button
                onClick={() => {
                  setScreenView('live');
                  configVersionRef.current += 1;
                  syncLiveScreenConfig({
                    displayMode,
                    layout,
                    photoSize,
                    screenView: 'live',
                    breakView,
                    selectedSquadTeam,
                    version: configVersionRef.current,
                    updatedAtMs: Date.now()
                  });
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-3.5 py-1.5 rounded-xl text-xs uppercase tracking-wider shadow active:scale-95 transition"
              >
                ▶ Return to Live Auction
              </button>
            </div>

            {/* 4 CONTENT VIEW SELECTORS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 my-3 shrink-0">
              {[
                { id: 'teams-dashboard', label: 'Teams Dashboard', icon: '📊', desc: 'Overview table of all teams with purse & max bid' },
                { id: 'squad-list', label: 'Squad View', icon: '👥', desc: 'Project a single team\'s acquired players roster' },
                { id: 'tournament-summary', label: 'Summary', icon: '📈', desc: 'Key auction finances & player statistics' },
                { id: 'top-biddings', label: 'Top Bids', icon: '🏆', desc: 'Top 10 highest player bids with photos' }
              ].map((tab) => {
                const isActive = breakView === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleSwitchBreakView(tab.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      isActive
                        ? 'border-orange-500 bg-orange-50/70 shadow-sm ring-2 ring-orange-400/20'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{tab.icon}</span>
                      <span className={`font-black text-xs lg:text-sm ${isActive ? 'text-orange-950' : 'text-slate-800'}`}>
                        {tab.label}
                      </span>
                      {isActive && (
                        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-orange-600 text-white font-black uppercase">
                          Live 📺
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium leading-snug">{tab.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* SQUAD TEAM SELECTOR (REQUIREMENT 7) */}
            {breakView === 'squad-list' ? (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-hidden">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Click a Team to Display its Squad on Live Screen:
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Showing on Screen: <span className="font-black text-indigo-700">{selectedSquadTeam || teams[0]?.teamName || 'None'}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 overflow-y-auto pr-1 pb-2">
                  {teams.map((team) => {
                    const isSelected = (selectedSquadTeam || teams[0]?.teamName) === team.teamName;
                    const squadCount = (breakDataSnapshot?.squadsByTeam?.[team.teamName] || []).length;
                    return (
                      <button
                        key={team._id}
                        onClick={() => handleSelectSquadTeam(team.teamName)}
                        className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/30'
                            : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-black text-xs truncate" title={team.teamName}>
                            {team.shortName || team.teamName}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] bg-white text-indigo-700 font-black px-1 rounded shrink-0">
                              📺 On Screen
                            </span>
                          )}
                        </div>
                        <div className={`text-[10px] flex justify-between ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                          <span>{squadCount} players</span>
                          <span>₹{Number(team.remainingPurse || 0).toLocaleString()}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* PREVIEW NOTICE FOR OTHER BREAK VIEWS */
              <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-500">
                <span className="text-4xl mb-2">
                  {breakView === 'teams-dashboard' ? '📊' : breakView === 'tournament-summary' ? '📈' : '🏆'}
                </span>
                <h3 className="font-black text-base text-slate-800 uppercase tracking-wider">
                  {breakView.replace('-', ' ')} is Broadcasting
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  The Live Screen is currently displaying the {breakView.replace('-', ' ')} in full screen for the audience.
                </p>
              </div>
            )}

            {/* BROADCAST STATUS FOOTER */}
            <div className="mt-2.5 bg-slate-900 text-white px-3 py-2 rounded-xl flex items-center justify-between shrink-0 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">● LIVE BROADCAST:</span>
                <span className="font-black text-orange-400 uppercase">{breakView.replace('-', ' ')}</span>
                {breakView === 'squad-list' && (
                  <span className="text-indigo-300 font-bold">({selectedSquadTeam || teams[0]?.teamName})</span>
                )}
              </div>
              <span className="text-slate-400 text-[11px]">Changes update audience display instantly</span>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* 🌟 AUCTIONEER OPERATOR WORKSPACE (REQUIREMENTS 1, 2, 3 & 4) 🌟 */
          /* ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 h-full overflow-hidden">
            {/* 🌟 LEFT COLUMN: PLAYER CARD & AUCTIONEER HAMMER 🌟 */}
            <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-3 flex flex-col justify-between overflow-hidden">
              <div>
                {/* NEXT PLAYER BUTTON */}
                <button
                  onClick={pickRandomPlayer}
                  disabled={Boolean(currentPlayer && playerStatus === 'bidding' && hasBiddingStarted)}
                  className={`w-full text-white font-black text-xs lg:text-sm py-2 rounded-xl shadow-sm active:translate-y-0.5 transition-all mb-2.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                    playerStatus !== 'bidding' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {playerStatus !== 'bidding' ? '📸 Next Player' : `🎲 Next Player (${players.length} Left)`}
                </button>

                {!currentPlayer ? (
                  <div className="text-center py-12 text-slate-400 font-bold text-xs border-2 border-dashed border-slate-200 rounded-xl">
                    No player on stage.<br />Click "Next Player" above to start bidding!
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-3 mb-2.5">
                      <img
                        src={currentPlayer.photoUrl || 'https://via.placeholder.com/150'}
                        alt="Player"
                        className="w-16 h-16 rounded-xl object-cover shadow-sm border-2 border-slate-100 shrink-0"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/150?text=No+Photo';
                        }}
                      />
                      <div className="min-w-0">
                        <h2 className="text-lg lg:text-xl font-black text-slate-900 capitalize truncate" title={currentPlayer.name}>
                          {currentPlayer.name}
                        </h2>
                        <p className="text-slate-500 font-semibold text-xs mt-0.5">
                          📍 {currentPlayer.city || 'Unknown'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                      <div className="flex justify-between items-center border-b border-slate-200/70 pb-1">
                        <span className="text-slate-500 font-bold uppercase text-[10px]">Role</span>
                        <span className="font-black text-blue-700 text-xs">{currentPlayer.role}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-200/70 pb-1">
                        <span className="text-slate-500 font-bold uppercase text-[10px]">Category</span>
                        <span className="font-black text-purple-700 text-xs">{normalizeCategory(currentPlayer.category)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold uppercase text-[10px]">Base Price</span>
                        <span className="font-black text-emerald-700 text-xs">₹{currentPlayer.basePrice.toLocaleString()}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* HAMMER SOLD / UNSOLD BUTTONS */}
              {currentPlayer && (
                <div className="mt-2.5">
                  {playerStatus === 'bidding' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => finalizePlayer('Sold')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs lg:text-sm py-2.5 rounded-xl shadow-sm active:translate-y-0.5 transition"
                      >
                        SOLD 🔨
                      </button>
                      <button
                        onClick={() => finalizePlayer('Unsold')}
                        disabled={hasBiddingStarted}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs lg:text-sm py-2.5 rounded-xl shadow-sm active:translate-y-0.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        UNSOLD ❌
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`p-2 rounded-xl text-center border-2 ${
                        playerStatus === 'sold'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                          : 'bg-rose-50 border-rose-500 text-rose-900'
                      }`}
                    >
                      <h3 className="text-sm font-black uppercase tracking-wider">{playerStatus}</h3>
                      <p className="text-[11px] font-semibold mt-0.5 truncate">
                        {playerStatus === 'sold'
                          ? `Sold to ${getTeamLabel(biddingTeam)} for ₹${currentBid.toLocaleString()}`
                          : 'Player marked unsold'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 🌟 RIGHT COLUMN: BID STATUS, QUICK BIDS, ACTIVE BIDDERS & 16-TEAM GRID 🌟 */}
            <div
              className={`lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-3 flex flex-col overflow-hidden transition-all ${
                !currentPlayer || playerStatus !== 'bidding' ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              {/* TOP STATUS BAR: CURRENT BID & HIGHEST BIDDER */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block leading-none">
                      Current Bid
                    </span>
                    <span className="text-2xl lg:text-3xl font-black text-emerald-600 leading-tight">
                      ₹{currentBid.toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={handleResetBid}
                    className="bg-slate-100 hover:bg-slate-200 p-1.5 rounded-lg border border-slate-300 transition text-xs shadow-xs"
                    title="Reset to Base Price"
                  >
                    🔄
                  </button>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block leading-none">
                    Highest Bidder
                  </span>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <span className="text-base lg:text-lg font-black text-amber-600 truncate max-w-[180px]">
                      {biddingTeam ? getTeamLabel(biddingTeam) : 'Waiting...'}
                    </span>
                    {activeBiddingTeamData && (
                      <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                        Max: {formatCurrency(activeBiddingTeamData.maxBid)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* QUICK BIDS: JUMP BID & BASE SELL ROW */}
              <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={customBid}
                    onChange={(e) => setCustomBid(e.target.value)}
                    placeholder="Custom ₹"
                    className="p-1 border border-slate-300 rounded-lg font-bold w-24 text-xs focus:border-blue-500 outline-none"
                  />
                  <button
                    onClick={handleCustomBidSubmit}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded-lg shadow-xs text-xs"
                  >
                    Jump
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={directSellTeam}
                    onChange={(e) => setDirectSellTeam(e.target.value)}
                    className="p-1 border border-slate-300 rounded-lg font-bold w-28 text-xs focus:border-emerald-500 outline-none"
                  >
                    <option value="">Team</option>
                    {teams.map((team) => (
                      <option key={`base-sell-${team._id}`} value={team._id}>
                        {team.shortName || team.teamName}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleDirectBaseSell}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg shadow-xs text-xs"
                  >
                    Base Sell
                  </button>
                </div>
              </div>

              {/* 🌟 ACTIVE BIDDERS ZONE (MAX 4 TEAMS) (REQUIREMENT 3) 🌟 */}
              <div className="py-2 shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-purple-800">
                    Active Bidders (Max 4)
                  </h3>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {activeBiddingTeams.length}/4 Active
                  </span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const team = activeBiddingTeams[slotIdx];
                    if (!team) {
                      return (
                        <div
                          key={`empty-slot-${slotIdx}`}
                          className="rounded-lg border border-dashed border-purple-200 bg-purple-50/40 p-1.5 flex items-center justify-center text-[10px] font-semibold text-purple-400"
                        >
                          + Slot {slotIdx + 1}
                        </div>
                      );
                    }

                    const isHighestBidder = Boolean(biddingTeam) && (String(biddingTeam) === String(team._id) || biddingTeam === team.teamName);
                    return (
                      <div
                        key={`active-${team._id}`}
                        className={`rounded-lg border p-1.5 flex flex-col justify-between transition-all ${
                          isHighestBidder
                            ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400/30 shadow-xs'
                            : 'border-purple-300 bg-purple-50/80 hover:border-purple-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {team.logoUrl || team.logo ? (
                              <img src={team.logoUrl || team.logo} alt="" className="w-5 h-5 rounded object-contain bg-white border border-purple-200 shrink-0" />
                            ) : (
                              <div className="w-5 h-5 rounded bg-purple-700 text-white font-black text-[9px] flex items-center justify-center shrink-0 uppercase">
                                {team.shortName || team.teamName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <h4 className="font-black text-xs text-slate-900 truncate" title={team.teamName}>
                              {team.shortName || team.teamName}
                            </h4>
                          </div>
                          {isHighestBidder ? (
                            <span className="text-[9px] px-1 rounded bg-amber-400 text-amber-950 font-black shrink-0">
                              Leader
                            </span>
                          ) : (
                            <span className="text-[9px] px-1 rounded bg-purple-700 text-white font-black shrink-0">
                              #{slotIdx + 1}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-purple-900 font-bold mb-1 leading-tight">
                          <span>₹{team.remainingPurse.toLocaleString()}</span>
                          <span className="text-[9px] text-purple-700 font-semibold">Max {formatCurrency(team.maxBid)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            disabled={currentBid + btn1 > Number(team.maxBid || 0) || currentBid + btn1 > Number(team.remainingPurse || 0)}
                            onClick={() => updateBid(team._id, btn1)}
                            className="bg-purple-100 text-purple-900 font-bold rounded py-0.5 text-[10px] hover:bg-purple-200 border border-purple-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            {formatBidButton(btn1)}
                          </button>
                          <button
                            disabled={currentBid + btn2 > Number(team.maxBid || 0) || currentBid + btn2 > Number(team.remainingPurse || 0)}
                            onClick={() => updateBid(team._id, btn2)}
                            className="bg-purple-100 text-purple-900 font-bold rounded py-0.5 text-[10px] hover:bg-purple-200 border border-purple-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            {formatBidButton(btn2)}
                          </button>
                          <button
                            disabled={currentBid + btn3 > Number(team.maxBid || 0) || currentBid + btn3 > Number(team.remainingPurse || 0)}
                            onClick={() => updateBid(team._id, btn3)}
                            className="bg-purple-100 text-purple-900 font-bold rounded py-0.5 text-[10px] hover:bg-purple-200 border border-purple-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            {formatBidButton(btn3)}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* FILTER & SEARCH TOOLBAR */}
              <div className="flex items-center justify-between gap-2 py-1.5 shrink-0">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <input
                    type="text"
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    placeholder="Search teams..."
                    className="p-1 border border-slate-300 rounded-lg text-xs font-semibold w-36 outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center gap-1 text-[10px] font-bold">
                    <button
                      onClick={() => setTeamFilter('all')}
                      className={`px-2 py-0.5 rounded-md border ${
                        teamFilter === 'all'
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setTeamFilter('can-bid')}
                      className={`px-2 py-0.5 rounded-md border ${
                        teamFilter === 'can-bid'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      Can Bid
                    </button>
                    <button
                      onClick={() => setTeamFilter('low-purse')}
                      className={`px-2 py-0.5 rounded-md border ${
                        teamFilter === 'low-purse'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                      }`}
                    >
                      Low Purse
                    </button>
                    {(teamSearch || teamFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setTeamSearch('');
                          setTeamFilter('all');
                        }}
                        className="px-1.5 py-0.5 rounded-md text-rose-600 bg-rose-50 border border-rose-200"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                  {filteredTeams.length}/{teams.length} Teams
                </span>
              </div>

              {/* 🌟 UP TO 16 TEAMS COMPACT GRID (REQUIREMENTS 2 & 4) 🌟 */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 auto-rows-fr">
                  {filteredTeams.map((team) => {
                    const isHighestBidder = Boolean(biddingTeam) && (String(biddingTeam) === String(team._id) || biddingTeam === team.teamName);
                    return (
                      <div
                        key={team._id}
                        className={`rounded-lg border p-1.5 transition-all flex flex-col justify-between ${
                          isHighestBidder
                            ? 'border-amber-400 bg-amber-50/80 ring-2 ring-amber-400/30 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-blue-300 shadow-2xs'
                        }`}
                      >
                        {/* ROW 1: TEAM NAME & PURSE */}
                        <div className="flex justify-between items-center mb-0.5 gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {team.logoUrl || team.logo ? (
                              <img src={team.logoUrl || team.logo} alt="" className="w-5 h-5 rounded object-contain bg-white border border-slate-200 shrink-0" />
                            ) : (
                              <div className="w-5 h-5 rounded bg-gradient-to-br from-slate-700 to-slate-900 text-white font-black text-[9px] flex items-center justify-center shrink-0 uppercase">
                                {team.shortName || team.teamName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <h4 className="font-bold text-xs text-slate-900 truncate" title={team.teamName}>
                              {team.shortName || team.teamName}
                              {isHighestBidder && (
                                <span className="ml-1 text-[9px] text-amber-800 bg-amber-200/80 px-1 py-0.2 rounded font-black">
                                  ★ Leader
                                </span>
                              )}
                            </h4>
                          </div>
                          <span
                            className={`font-black text-xs shrink-0 ${
                              Number(team.remainingPurse || 0) < 50000 ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            ₹{Number(team.remainingPurse || 0).toLocaleString()}
                          </span>
                        </div>

                        {/* ROW 2: MAX BID & NEED */}
                        <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1 leading-tight">
                          <span className="font-semibold text-amber-700">Max: {formatCurrency(team.maxBid)}</span>
                          <span>Need {team.remainingRequiredPlayers}</span>
                        </div>

                        {/* ROW 3: 3 INCREMENT BUTTONS */}
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            disabled={
                              currentBid + btn1 > Number(team.maxBid || 0) ||
                              currentBid + btn1 > Number(team.remainingPurse || 0)
                            }
                            onClick={() => updateBid(team._id, btn1)}
                            className="bg-blue-50 text-blue-800 font-bold rounded py-0.5 text-[10px] hover:bg-blue-100 border border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            {formatBidButton(btn1)}
                          </button>
                          <button
                            disabled={
                              currentBid + btn2 > Number(team.maxBid || 0) ||
                              currentBid + btn2 > Number(team.remainingPurse || 0)
                            }
                            onClick={() => updateBid(team._id, btn2)}
                            className="bg-blue-50 text-blue-800 font-bold rounded py-0.5 text-[10px] hover:bg-blue-100 border border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            {formatBidButton(btn2)}
                          </button>
                          <button
                            disabled={
                              currentBid + btn3 > Number(team.maxBid || 0) ||
                              currentBid + btn3 > Number(team.remainingPurse || 0)
                            }
                            onClick={() => updateBid(team._id, btn3)}
                            className="bg-blue-50 text-blue-800 font-bold rounded py-0.5 text-[10px] hover:bg-blue-100 border border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            {formatBidButton(btn3)}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredTeams.length === 0 && (
                  <div className="text-center py-6 text-xs font-semibold text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    No teams match search criteria.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 🌟 REDESIGNED AUCTION RESULTS & RECOVERY MODAL 🌟 */}
      {showResultsModal && (() => {
        const soldPlayersList = auctionResultDatabase.filter(
          (p) => p.auctionStatus?.trim().toLowerCase() === 'sold' || p.auctionStatus?.trim().toLowerCase() === 'icon'
        );
        const unsoldPlayersList = auctionResultDatabase.filter(
          (p) => p.auctionStatus?.trim().toLowerCase() === 'unsold' || p.auctionStatus?.trim().toLowerCase() === 'passed'
        );
        const totalSpent = soldPlayersList.reduce((sum, p) => sum + (Number(p.soldPrice) || 0), 0);

        const filteredList = auctionResultDatabase.filter((p) => {
          const status = p.auctionStatus?.trim().toLowerCase() || '';
          if (resultsActiveTab === 'sold' && !(status === 'sold' || status === 'icon')) return false;
          if (resultsActiveTab === 'unsold' && !(status === 'unsold' || status === 'passed')) return false;
          if (!resultsSearchQuery.trim()) return true;
          const q = resultsSearchQuery.trim().toLowerCase();
          const nameMatch = p.name?.toLowerCase().includes(q);
          const teamMatch = getTeamLabel(p.soldTo)?.toLowerCase().includes(q) || getTeamFullName(p.soldTo)?.toLowerCase().includes(q);
          const roleMatch = p.role?.toLowerCase().includes(q);
          const catMatch = p.category?.toLowerCase().includes(q);
          return nameMatch || teamMatch || roleMatch || catMatch;
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
              {/* MODAL HEADER */}
              <div className="bg-slate-800/90 px-5 py-3.5 border-b border-slate-700 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xl text-indigo-300 shrink-0">
                    ♻️
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-black text-white uppercase tracking-wider">
                        Auction Results & Recovery
                      </h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {auctionResultDatabase.length} Total
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      Restore players back to the live auction pool with automatic purse refunds
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowResultsModal(false)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-lg transition cursor-pointer"
                  title="Close"
                >
                  &times;
                </button>
              </div>

              {/* ACTION & FILTER TOOLBAR */}
              <div className="bg-slate-900/95 px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                {/* TABS */}
                <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700/60">
                  <button
                    onClick={() => setResultsActiveTab('all')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      resultsActiveTab === 'all'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>All</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30">
                      {auctionResultDatabase.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setResultsActiveTab('sold')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      resultsActiveTab === 'sold'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Sold</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30">
                      {soldPlayersList.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setResultsActiveTab('unsold')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      resultsActiveTab === 'unsold'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Unsold / Passed</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30">
                      {unsoldPlayersList.length}
                    </span>
                  </button>
                </div>

                {/* SEARCH INPUT */}
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <input
                    type="text"
                    value={resultsSearchQuery}
                    onChange={(e) => setResultsSearchQuery(e.target.value)}
                    placeholder="Search player, team, role..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                  {resultsSearchQuery && (
                    <button
                      onClick={() => setResultsSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* BULK RESTORE BUTTONS */}
                <div className="flex items-center gap-2">
                  {unsoldPlayersList.length > 0 && (
                    <button
                      onClick={bringAllBackToAuction}
                      disabled={isProcessingRecovery}
                      className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 hover:border-amber-400 font-bold px-3 py-1.5 rounded-lg text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Bring all unsold players into Round-2"
                    >
                      <span>♻️ Round-2 (All Unsold)</span>
                      <span className="bg-amber-400/20 text-amber-200 px-1.5 py-0.2 rounded text-[10px]">
                        {unsoldPlayersList.length}
                      </span>
                    </button>
                  )}

                  {auctionResultDatabase.length > 0 && (
                    <button
                      onClick={bringAllPlayersBack}
                      disabled={isProcessingRecovery}
                      className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 hover:border-indigo-400 font-bold px-3 py-1.5 rounded-lg text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Restore all players and refund team purses"
                    >
                      <span>🔄 Restore All</span>
                    </button>
                  )}
                </div>
              </div>

              {/* PLAYERS LIST (SCROLLABLE) */}
              <div className="p-4 overflow-y-auto bg-slate-950/60 flex-1 min-h-[260px] max-h-[52vh]">
                {filteredList.length === 0 ? (
                  <div className="text-center py-12 flex flex-col items-center justify-center">
                    <span className="text-4xl mb-2 opacity-40">🏏</span>
                    <p className="text-sm font-bold text-slate-400">
                      {resultsSearchQuery ? 'No players match your search filter' : 'No players in this section'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {resultsSearchQuery ? 'Try clearing or changing the search query.' : 'Sold and unsold players will appear here during the auction.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredList.map((p) => {
                      const isSold = p.auctionStatus === 'Sold' || p.auctionStatus === 'Icon';
                      const soldPrice = Number(p.soldPrice) || 0;
                      return (
                        <div
                          key={p._id}
                          className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <img
                                src={p.photoUrl || 'https://via.placeholder.com/50'}
                                alt={p.name}
                                className="w-12 h-12 rounded-full object-cover border-2 border-slate-700"
                              />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                                  isSold ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-sm text-white truncate">{p.name}</h3>
                              <p className="text-xs text-slate-400 truncate">
                                {p.role || 'Player'} • Base: ₹{Number(p.basePrice || 0).toLocaleString()}
                              </p>
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                {isSold ? (
                                  <span className="bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 text-[10px] font-black px-2 py-0.5 rounded-md truncate">
                                    Sold to {getTeamLabel(p.soldTo)} • ₹{soldPrice.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="bg-amber-950/60 text-amber-300 border border-amber-800/80 text-[10px] font-black px-2 py-0.5 rounded-md">
                                    {p.auctionStatus || 'Unsold'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => bringBackToAuction(p)}
                            disabled={isProcessingRecovery}
                            className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 hover:border-indigo-500 font-bold px-3 py-1.5 rounded-lg text-xs transition active:scale-95 shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                            title={isSold ? `Refund ₹${soldPrice.toLocaleString()} to ${getTeamLabel(p.soldTo)} & return to pool` : 'Return to live pool'}
                          >
                            <span>Bring Back</span>
                            <span>↩️</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* MODAL FOOTER */}
              <div className="bg-slate-850 px-5 py-3 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
                <div className="flex items-center gap-4 text-slate-400 font-semibold">
                  <span>Sold: <strong className="text-emerald-400">{soldPlayersList.length}</strong> (₹{totalSpent.toLocaleString()})</span>
                  <span>Unsold: <strong className="text-amber-400">{unsoldPlayersList.length}</strong></span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={resetWholeAuction}
                    disabled={isProcessingRecovery}
                    className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 hover:border-rose-700 font-bold px-3 py-1.5 rounded-lg text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    title="Reset entire auction for rehearsal/restart"
                  >
                    <span>⚠️ Reset Auction</span>
                  </button>
                  <button
                    onClick={() => setShowResultsModal(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 🌟 SETTINGS MODAL 🌟 */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50">
          <div className="w-full max-w-md h-full bg-white shadow-2xl p-5 overflow-y-auto flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">⚙️ Auction Settings</h2>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="text-2xl leading-none text-slate-400 hover:text-slate-700"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4">
                {/* PLAYER ORDER MODE */}
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 mb-1.5 block">
                    Player Order Mode
                  </span>
                  <select
                    value={playerOrderMode}
                    onChange={(e) => setPlayerOrderMode(e.target.value)}
                    className="w-full p-2 rounded-lg border border-indigo-200 font-bold text-xs text-indigo-900 outline-none"
                  >
                    <option value="all-random">All Players Random</option>
                    <option value="category-random">Category-wise Random</option>
                  </select>

                  {playerOrderMode === 'category-random' && (
                    <div className="mt-2.5">
                      <p className="text-[10px] text-indigo-700 font-bold mb-1">
                        Order: {effectiveCategoryOrder.length > 0 ? effectiveCategoryOrder.join(' → ') : '-'}
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {categoriesFromPlayers.map((category) => (
                          <button
                            key={category}
                            onClick={() =>
                              setCategoryOrder((prev) => [
                                category,
                                ...prev.filter((item) => item !== category),
                                ...categoriesFromPlayers.filter((item) => item !== category && !prev.includes(item))
                              ])
                            }
                            className="px-2 py-1 text-[10px] rounded border bg-white font-bold text-indigo-700 hover:bg-indigo-100 truncate"
                          >
                            Start with {category}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] mt-2 font-semibold text-indigo-600">
                        Active Category: {activeCategory || '-'}
                      </p>
                    </div>
                  )}
                </div>

                {/* LIVE SCREEN PRESETS */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                    Live Screen Presets
                  </span>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Display Mode</label>
                    <select
                      value={displayMode}
                      onChange={(e) => setDisplayMode(e.target.value)}
                      className="w-full p-1.5 rounded-lg border border-slate-300 font-bold text-xs text-slate-800 outline-none"
                    >
                      <option value="night">Night Mode</option>
                      <option value="day">Day Mode</option>
                      <option value="projector">Projector Mode</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Live Screen Layout</label>
                    <select
                      value={layout}
                      onChange={(e) => setLayout(e.target.value)}
                      className="w-full p-1.5 rounded-lg border border-slate-300 font-bold text-xs text-slate-800 outline-none"
                    >
                      <option value="classic">Classic (Balanced Two-Column)</option>
                      <option value="split">Split Stage (Side-by-Side Symmetrical)</option>
                      <option value="spotlight">Spotlight Hero (Centerpiece Portrait)</option>
                      <option value="broadcast">Broadcast Studio (TV Lower-Third Deck)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Photo Size</label>
                    <select
                      value={photoSize}
                      onChange={(e) => setPhotoSize(e.target.value)}
                      className="w-full p-1.5 rounded-lg border border-slate-300 font-bold text-xs text-slate-800 outline-none"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* MODAL BOTTOM BUTTONS */}
            <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-200">
              <button
                onClick={openResultsModal}
                className="bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-xl font-bold text-xs transition shadow-xs"
              >
                ♻️ Auction Results
              </button>
              <button
                onClick={resetWholeAuction}
                className="bg-rose-700 hover:bg-rose-800 text-white py-2 rounded-xl font-bold text-xs transition shadow-xs"
              >
                ⚠️ Reset Auction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ControlPanel;