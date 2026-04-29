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
  
  const [currentPlayer, setCurrentPlayer] = useState(() => JSON.parse(localStorage.getItem('currentPlayer')) || null);
  const [currentBid, setCurrentBid] = useState(() => Number(localStorage.getItem('currentBid')) || 0);
  const [biddingTeam, setBiddingTeam] = useState(() => localStorage.getItem('biddingTeam') || '');
  const [playerStatus, setPlayerStatus] = useState(() => localStorage.getItem('playerStatus') || 'bidding');
  const [customBid, setCustomBid] = useState('');
  const [hasBiddingStarted, setHasBiddingStarted] = useState(() => localStorage.getItem('hasBiddingStarted') === 'true');
  const [playerOrderMode, setPlayerOrderMode] = useState(() => localStorage.getItem('playerOrderMode') || 'all-random');
  const [categoryOrder, setCategoryOrder] = useState(() => JSON.parse(localStorage.getItem('categoryOrder') || '[]'));   
  const [lastBidActions, setLastBidActions] = useState(() => JSON.parse(localStorage.getItem('lastBidActions') || '[]'));  
  const [displayMode, setDisplayMode] = useState('night');
  const [photoSize, setPhotoSize] = useState('medium');
  const [screenView, setScreenView] = useState('live');
  const [breakView, setBreakView] = useState('teams-dashboard');
  const [allPlayers, setAllPlayers] = useState([]);
  const configVersionRef = useRef(0);
  const configDebounceRef = useRef(null);

  const [actionHistory, setActionHistory] = useState([]);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [auctionResultDatabase, setAuctionResultDatabase] = useState([]);
  const [directSellTeam, setDirectSellTeam] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [ultraCompact, setUltraCompact] = useState(false);

  // 🌟 DYNAMIC BID BUTTONS VALUES 🌟
  const btn1 = tournament?.bidButton1 || 500;
  const btn2 = tournament?.bidButton2 || 1000;
  const btn3 = tournament?.bidButton3 || 5000;

  // 🌟 स्मार्ट फॉर्मेटिंग (1000 = 1K, 100000 = 1L) 🌟
  const formatBidButton = (value) => {
    if (value >= 100000) return `+${value / 100000}L`;
    if (value >= 1000) return `+${value / 1000}K`;
    return `+${value}`;
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString()}`;  
  const getTeamLabel = useCallback((teamName) => {
    const match = teams.find((team) => team.teamName === teamName);
    return match?.shortName || teamName || '';
  }, [teams]);

  useEffect(() => {
    localStorage.setItem('currentPlayer', JSON.stringify(currentPlayer));
    localStorage.setItem('currentBid', currentBid);
    localStorage.setItem('biddingTeam', biddingTeam);
    localStorage.setItem('playerStatus', playerStatus);
    localStorage.setItem('hasBiddingStarted', String(hasBiddingStarted));
    localStorage.setItem('playerOrderMode', playerOrderMode);
    localStorage.setItem('categoryOrder', JSON.stringify(categoryOrder));
    localStorage.setItem('lastBidActions', JSON.stringify(lastBidActions));
  }, [currentPlayer, currentBid, biddingTeam, playerStatus, hasBiddingStarted, playerOrderMode, categoryOrder, lastBidActions]);

  const registerBidActivity = useCallback((teamName) => {
    if (!teamName) return;
    setLastBidActions((prev) => [...prev, teamName].slice(-4));
  }, []);

  const syncActiveBiddingState = useCallback((type, payload = {}) => {
    if (!socketRef.current?.connected) return false;
    socketRef.current.emit('activeBiddingUpdate', { type, ...payload });
    return true;
  }, []);

  const syncLiveScreenConfig = useCallback((nextConfig) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('liveScreenConfigUpdate', nextConfig);
  }, []);

  const syncBreakSnapshot = useCallback((snapshot) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('breakDataSnapshotUpdate', snapshot);
  }, []);

  const activeBiddingTeams = useMemo(() => {
    const ordered = [];
    const seen = new Set();
    for (let i = lastBidActions.length - 1; i >= 0; i -= 1) {
      const teamName = lastBidActions[i];
      if (!teamName || seen.has(teamName)) continue;
      seen.add(teamName);
      ordered.push(teamName);
      if (ordered.length === 4) break;
    }
    return ordered
      .map((teamName) => teams.find((team) => team.teamName === teamName))
      .filter(Boolean);
  }, [lastBidActions, teams]);

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
      console.error('टीम डेटा लाने में दिक्कत:', error);
    }
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const playersRes = await apiRequest({ method: 'get', path: '/api/players', headers });
      const allPlayersPayload = Array.isArray(playersRes.data) ? playersRes.data : [];
      setAllPlayers(allPlayersPayload);
      
      const availablePlayers = allPlayersPayload.filter(player =>
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

      await fetchTeamsWithMaxBid();
    } catch (error) {
      console.error("डेटा लाने में दिक्कत:", error);
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
        setLastBidActions(data.lastBidActions.slice(-4));
      }
    });

    socket.on('activeBiddingUpdate', (data) => {
      if (Array.isArray(data?.lastBidActions)) {
        setLastBidActions(data.lastBidActions.slice(-4));
      }
    });

    socket.on('liveScreenConfigSync', (data) => {
      if (!data) return;
      setDisplayMode(data.displayMode || 'night');
      setPhotoSize(data.photoSize || 'medium');
      setScreenView(data.screenView === 'break' ? 'break' : 'live');
      setBreakView(data.breakView || 'teams-dashboard');
      configVersionRef.current = Number(data.version || 0);
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
        photoSize,
        screenView,
        breakView,
        version: configVersionRef.current,
        updatedAtMs: Date.now()
      });
    }, 180);
    return () => {
      if (configDebounceRef.current) {
        clearTimeout(configDebounceRef.current);
      }
    };
  }, [displayMode, photoSize, screenView, breakView, syncLiveScreenConfig]);

  const breakDataSnapshot = useMemo(() => {
    const soldPlayers = allPlayers
      .filter((player) => String(player.auctionStatus || '').toLowerCase() === 'sold')
      .map((player) => ({
        _id: player._id,
        name: player.name,
        soldTo: player.soldTo,
        soldPrice: player.soldPrice
      }));
    const squadsByTeam = soldPlayers.reduce((acc, player) => {
      const teamName = player.soldTo || 'Unknown Team';
      if (!acc[teamName]) acc[teamName] = [];
      acc[teamName].push(player);
      return acc;
    }, {});
    const unsoldCount = allPlayers.filter((player) => String(player.auctionStatus || '').toLowerCase() === 'unsold').length;
    const readyCount = allPlayers.filter((player) => String(player.auctionStatus || '').toLowerCase() === 'readyforauction').length;
    const topBiddings = [...soldPlayers]
      .sort((a, b) => Number(b.soldPrice || 0) - Number(a.soldPrice || 0))
      .slice(0, 10);

    return {
      teams: teams.map((team) => ({
        _id: team._id,
        teamName: team.teamName,
        remainingPurse: team.remainingPurse,
        maxBid: team.maxBid,
        remainingRequiredPlayers: team.remainingRequiredPlayers
      })),
      soldPlayers,
      squadsByTeam,
      summary: {
        totalTeams: teams.length,
        soldPlayers: soldPlayers.length,
        unsoldPlayers: unsoldCount,
        readyForAuction: readyCount,
        totalSoldValue: soldPlayers.reduce((sum, player) => sum + Number(player.soldPrice || 0), 0)
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
        socketRef.current.emit('newLiveBid', { bidAmount: currentBid, teamName: biddingTeam, player: currentPlayer, status: playerStatus });
      }
    }, 2000);
    return () => clearInterval(syncInterval);
  }, [currentPlayer, currentBid, biddingTeam, playerStatus]);

  const saveStateToHistory = (actionType, affectedPlayer = null) => {
    setActionHistory(prev => [...prev, {
      actionType,
      affectedPlayer,
      snapshot: {
        currentPlayer,
        currentBid,
        biddingTeam,
        playerStatus,
        players: [...players], 
        teams: JSON.parse(JSON.stringify(teams)),
        lastBidActions: [...lastBidActions]
      }
    }]);
  };

  const pickRandomPlayer = () => {
    if (currentPlayer && playerStatus === 'bidding' && hasBiddingStarted) {
      alert("बिडिंग शुरू होने के बाद खिलाड़ी बदला नहीं जा सकता। पहले SOLD करें।");
      return;
    }

    const availablePlayers = players.filter(p => p._id !== currentPlayer?._id);
    if (availablePlayers.length === 0) {
      alert("ऑक्शन के लिए कोई नया खिलाड़ी नहीं बचा है!");
      return;
    }
    
    saveStateToHistory('PICK_PLAYER'); 

    let selectionPool = availablePlayers;
    if (playerOrderMode === 'category-random') {
      const fallbackOrder = Array.from(new Set(availablePlayers.map((player) => normalizeCategory(player.category))));
      const effectiveOrder = categoryOrder.length > 0 ? categoryOrder : fallbackOrder;
      const activeCategory = effectiveOrder.find((category) =>
        availablePlayers.some((player) => normalizeCategory(player.category) === category)
      );
      if (!activeCategory) {
        alert("चुनी गई कैटेगरी में कोई खिलाड़ी उपलब्ध नहीं है।");
        return;
      }
      selectionPool = availablePlayers.filter((player) => normalizeCategory(player.category) === activeCategory);
    }

    const randomIndex = Math.floor(Math.random() * selectionPool.length);
    const selected = selectionPool[randomIndex];      
    
    setCurrentPlayer(selected);
    setCurrentBid(selected.basePrice);
    setBiddingTeam('');
    setDirectSellTeam('');    
    setCustomBid('');
    setHasBiddingStarted(false);    
    setPlayerStatus('bidding');
    setLastBidActions([]);
    syncActiveBiddingState('reset');

    socketRef.current?.emit('newLiveBid', { bidAmount: selected.basePrice, teamName: '', player: selected, status: 'bidding' });
  };

  const handleResetBid = () => {
    if (!currentPlayer || playerStatus !== 'bidding') return;
    saveStateToHistory('RESET_BID');
    
    setCurrentBid(currentPlayer.basePrice);
    setBiddingTeam('');
    socketRef.current?.emit('newLiveBid', { bidAmount: currentPlayer.basePrice, teamName: '', player: currentPlayer, status: playerStatus });
  };

  const updateBid = async (teamName, amount, isJump = false) => {
    if (playerStatus !== 'bidding') return;

    const team = teams.find((t) => t.teamName === teamName);
    const newBidAmount = isJump ? amount : currentBid + amount;

    if (team && newBidAmount > team.remainingPurse) {
      alert(`⚠️ ${teamName} के पास इतने पैसे नहीं हैं!`);
      return;
    }

    if (team && newBidAmount > Number(team.maxBid || 0)) {
      alert(`🚫 ${teamName} का Dynamic Max Bid ${formatCurrency(team.maxBid)} है। इस लिमिट से ऊपर bid नहीं कर सकते।`);
      return;
    }

    saveStateToHistory('BID');
    
    setCurrentBid(newBidAmount);
    setBiddingTeam(teamName);
    setHasBiddingStarted(true);
    if (!syncActiveBiddingState('append', { teamName })) {
      registerBidActivity(teamName);
    }
    socketRef.current?.emit('newLiveBid', { bidAmount: newBidAmount, teamName: teamName, player: currentPlayer, status: playerStatus });
  };

  const handleCustomBidSubmit = async () => {
    const amount = Number(customBid);
    if (!biddingTeam) { alert("पहले ग्रिड से एक टीम सेलेक्ट करें!"); return; }
    if (amount <= currentBid) { alert("Jump Bid करंट बिड से ज़्यादा होनी चाहिए!"); return; }
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
    const selectedTeam = teams.find((team) => team.teamName === directSellTeam);
    if (!selectedTeam) {
      alert('टीम नहीं मिली।');
      return;
    }
    if (basePrice > Number(selectedTeam.maxBid || 0)) {
      alert(`🚫 ${getTeamLabel(directSellTeam)} का Dynamic Max Bid ${formatCurrency(selectedTeam.maxBid)} है।`);
      return;
    }

    setBiddingTeam(directSellTeam);
    setCurrentBid(basePrice);
    await finalizePlayer('Sold', {
      soldTeamName: directSellTeam,
      soldPrice: basePrice
    });
  };

  const finalizePlayer = async (status, options = {}) => {
    const soldTeamName = options.soldTeamName || biddingTeam;
    const soldPrice = Number(options.soldPrice || currentBid);
    if (status === 'Sold' && !soldTeamName) { alert("टीम सेलेक्ट करें!"); return; }
    if (status === 'Unsold' && hasBiddingStarted) { alert("बिडिंग शुरू होने के बाद खिलाड़ी को Unsold नहीं कर सकते।"); return; }    
    
    saveStateToHistory(status.toUpperCase(), currentPlayer); 

    try {
      const token = localStorage.getItem('token');
      const endpoint = status === 'Sold' ? `/api/players/sell/${currentPlayer._id}` : `/api/players/unsold/${currentPlayer._id}`;
      const payload = status === 'Sold' ? { teamName: soldTeamName, soldPrice } : {};
      
      await apiRequest({
        method: 'put',
        path: endpoint,
        data: payload,
        headers: { Authorization: `Bearer ${token}` }
      });

      const updatedPlayers = players.filter(p => p._id !== currentPlayer._id);
      setPlayers(updatedPlayers);
      
      await fetchTeamsWithMaxBid();
      await fetchData();      

      setPlayerStatus(status.toLowerCase());
      setHasBiddingStarted(false);      
      setDirectSellTeam('');
      setLastBidActions([]);
      syncActiveBiddingState('reset');      
      socketRef.current?.emit('newLiveBid', { bidAmount: soldPrice, teamName: soldTeamName, player: currentPlayer, status: status.toLowerCase() });
    } catch (error) {
      const backendMessage = error.response?.data?.message;
      if (backendMessage) {
        alert(`🚫 ${backendMessage}`);
      } else {
        alert("एरर! तकनीकी खराबी आ गई है।");
      }
      await fetchTeamsWithMaxBid();
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
        setScreenView((prev) => (prev === 'live' ? 'break' : 'live'));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pickRandomPlayer, finalizePlayer, handleResetBid]);

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
        alert("Database Revert Failed!");
        return; 
      }
    }
    
    const snap = lastAction.snapshot;
    setCurrentPlayer(snap.currentPlayer);
    setCurrentBid(snap.currentBid);
    setBiddingTeam(snap.biddingTeam);
    setPlayerStatus(snap.playerStatus);
    setHasBiddingStarted(Boolean(snap.biddingTeam));     
    setPlayers(snap.players);
    setTeams(snap.teams);
    setLastBidActions(snap.lastBidActions || []);
    syncActiveBiddingState('replace', { lastBidActions: snap.lastBidActions || [] });    
    await fetchTeamsWithMaxBid();
    await fetchData();

    socketRef.current?.emit('newLiveBid', { 
        bidAmount: snap.currentBid || 0, 
        teamName: snap.biddingTeam || '',
        player: snap.currentPlayer,
        status: snap.playerStatus
    });
    
    setActionHistory(prev => prev.slice(0, -1));
  };

  const openResultsModal = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await apiRequest({ method: 'get', path: '/api/players', headers: { Authorization: `Bearer ${token}` } });
      
      const currentReadyIds = players.map(p => p._id);
      if(currentPlayer) currentReadyIds.push(currentPlayer._id);

      const resultPlayers = res.data.filter(p => 
        p.approvalStatus?.trim().toLowerCase() === 'approved' &&
        (p.auctionStatus?.trim().toLowerCase() === 'sold' || p.auctionStatus?.trim().toLowerCase() === 'unsold' || p.auctionStatus?.trim().toLowerCase() === 'passed' || p.auctionStatus?.trim().toLowerCase() === 'icon') &&
        !currentReadyIds.includes(p._id)
      );

      setAuctionResultDatabase(resultPlayers);
      setShowResultsModal(true);
    } catch (error) {
      console.error("Auction result प्लेयर्स लाने में दिक्कत:", error);
    }
  };

  const bringBackToAuction = async (playerToBring) => {
    try {
      const token = localStorage.getItem('token');
      await apiRequest({
        method: 'put',
        path: `/api/players/undo/${playerToBring._id}`,
        data: {},
        headers: { Authorization: `Bearer ${token}` }
      });

      setPlayers(prev => [...prev, { ...playerToBring, auctionStatus: 'ReadyForAuction', soldTo: 'Unsold', soldPrice: 0 }]); 
      setAuctionResultDatabase(prev => prev.filter(p => p._id !== playerToBring._id)); 
      await fetchData();      
      alert(`🔥 ${playerToBring.name} को वापस ऑक्शन पूल में शामिल कर लिया गया है!`);
    } catch (error) {
      alert("एरर: डेटाबेस अपडेट नहीं हो पाया!");
    }
  };

  const bringAllBackToAuction = async () => {
    const unsoldRoundPlayers = auctionResultDatabase.filter(
      (p) => p.auctionStatus?.trim().toLowerCase() === 'unsold' || p.auctionStatus?.trim().toLowerCase() === 'passed'
    );

    if (unsoldRoundPlayers.length === 0) {
      alert("Round-2 के लिए कोई Unsold player उपलब्ध नहीं है।");
      return;
    }

    const confirmAction = window.confirm("क्या आप सभी Unsold players को Round-2 auction के लिए वापस लाना चाहते हैं?");
    if (confirmAction) {
      try {
        const token = localStorage.getItem('token');
        
        for (const p of unsoldRoundPlayers) {
           await apiRequest({
              method: 'put',
              path: `/api/players/undo/${p._id}`,
              data: {},
              headers: { Authorization: `Bearer ${token}` }
           });
           await delay(400); 
        }

        setPlayers(prev => [
          ...prev,
          ...unsoldRoundPlayers.map(p => ({ ...p, auctionStatus: 'ReadyForAuction', soldTo: 'Unsold', soldPrice: 0 }))
        ]);
        setAuctionResultDatabase(prev => prev.filter(
          (p) => !(p.auctionStatus?.trim().toLowerCase() === 'unsold' || p.auctionStatus?.trim().toLowerCase() === 'passed')
        ));
        setShowResultsModal(false);
        await fetchData();        
        alert("✅ सभी Unsold players Round-2 auction के लिए वापस आ गए हैं!");
      } catch (error) {
        console.error(error);
        alert("एरर: कुछ प्लेयर्स वापस नहीं आ पाए, इंटरनेट चेक करें।");
      }
    }
  };

  const resetWholeAuction = async () => {
    const confirmReset = window.confirm("⚠️ चेतावनी! क्या आप पूरा ऑक्शन रीसेट करना चाहते हैं?");
    if (!confirmReset) return;

    const confirmAgain = window.prompt("सुरक्षा के लिए, कृपया बॉक्स में 'RESET' टाइप करें (बिना सिंगल कोट्स के):");
    if (confirmAgain !== "RESET") {
        alert("❌ रीसेट कैंसल कर दिया गया।");
        return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await apiRequest({ method: 'get', path: '/api/players', headers: { Authorization: `Bearer ${token}` } });
      
      const playersToReset = res.data.filter(p => 
        p.auctionStatus?.trim().toLowerCase() === 'sold' || 
        p.auctionStatus?.trim().toLowerCase() === 'unsold' ||
        p.auctionStatus?.trim().toLowerCase() === 'passed'
      );

      if(playersToReset.length > 0) {
          alert(`⏳ ${playersToReset.length} खिलाड़ियों का डेटा वापस लाया जा रहा है... कृपया इस पेज को बंद न करें, इसमें कुछ सेकंड लगेंगे।`);
          
          for (const p of playersToReset) {
              try {
                  await apiRequest({
                      method: 'put',
                      path: `/api/players/undo/${p._id}`,
                      data: {},
                      headers: { Authorization: `Bearer ${token}` }
                  });
                  await delay(500); 
              } catch(err) {
                  console.error(`Failed to undo player ${p.name}`, err);
              }
          }
      }

      setCurrentPlayer(null);
      setCurrentBid(0);
      setBiddingTeam('');
      setPlayerStatus('bidding');
      setHasBiddingStarted(false);      
      setActionHistory([]);
      setLastBidActions([]);
      syncActiveBiddingState('reset');      
      
      localStorage.removeItem('currentPlayer');
      localStorage.removeItem('currentBid');
      localStorage.removeItem('biddingTeam');
      localStorage.removeItem('playerStatus');
      localStorage.removeItem('hasBiddingStarted');  
      localStorage.removeItem('lastBidActions');          

      socketRef.current?.emit('newLiveBid', { bidAmount: 0, teamName: '', player: null, status: 'bidding' });

      await fetchData(); 
      alert("✅ 100% UNIVERSE RESET SUCCESSFUL! \n\nसभी Approved प्लेयर अब ReadyForAuction स्टेटस में वापस आ गए हैं।");

    } catch (error) {
      console.error(error);
      alert("एरर: रीसेट करने में दिक्कत आई।");
    }
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
        return activeBiddingTeams.some((activeTeam) => activeTeam._id === team._id);
      }
      return true;
    });
  }, [teams, teamSearch, teamFilter, currentBid, btn1, activeBiddingTeams]);

  return (
    <div className="h-screen bg-gray-200 overflow-hidden">
      <header className="bg-blue-900 p-3 px-4 lg:px-5 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-2 shadow-lg text-white">
        <h1 className="text-xl lg:text-2xl font-black truncate">⚙️ {tournament?.name} - Master Control</h1>
        <div className="flex flex-wrap justify-end gap-2 items-center">
          <button 
            onClick={handleUndo} 
            disabled={actionHistory.length === 0}
            className={`font-black px-3 py-2 rounded shadow-lg transition-all text-xs lg:text-sm ${actionHistory.length > 0 ? 'bg-yellow-500 hover:bg-yellow-400 text-yellow-900' : 'bg-gray-600 text-gray-400 opacity-50'}`}
          >
            ⏪ <span className="hidden sm:inline">UNDO</span> {actionHistory.length > 0 && `(${actionHistory.length})`}
          </button>
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-600">
            <button
              onClick={() => setScreenView('live')}
              className={`px-2.5 py-1 rounded text-[11px] lg:text-xs font-black ${screenView === 'live' ? 'bg-green-600 text-white' : 'text-slate-200'}`}
            >
              Live Auction
            </button>
            <button
              onClick={() => setScreenView('break')}
              className={`px-2.5 py-1 rounded text-[11px] lg:text-xs font-black ${screenView === 'break' ? 'bg-orange-500 text-white' : 'text-slate-200'}`}
            >
              Break Content
            </button>
          </div>
          {screenView === 'break' && (
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-600 rounded-lg p-1">
              <select
                value={breakView}
                onChange={(e) => setBreakView(e.target.value)}
                className="md:hidden bg-slate-900 text-white text-[11px] font-black px-2 py-1 rounded border border-slate-500 outline-none"
              >
                <option value="teams-dashboard">Teams Dashboard</option>
                <option value="squad-list">Squad List</option>
                <option value="tournament-summary">Summary</option>
                <option value="top-biddings">Top Bids</option>
              </select>
              <div className="hidden md:flex items-center gap-1.5">
                <button
                  onClick={() => setBreakView('teams-dashboard')}
                  className={`px-2 py-1 rounded text-[11px] font-black whitespace-nowrap ${breakView === 'teams-dashboard' ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-700'}`}
                >
                  Teams
                </button>
                <button
                  onClick={() => setBreakView('squad-list')}
                  className={`px-2 py-1 rounded text-[11px] font-black whitespace-nowrap ${breakView === 'squad-list' ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-700'}`}
                >
                  Squad
                </button>
                <button
                  onClick={() => setBreakView('tournament-summary')}
                  className={`px-2 py-1 rounded text-[11px] font-black whitespace-nowrap ${breakView === 'tournament-summary' ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-700'}`}
                >
                  Summary
                </button>
                <button
                  onClick={() => setBreakView('top-biddings')}
                  className={`px-2 py-1 rounded text-[11px] font-black whitespace-nowrap ${breakView === 'top-biddings' ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-700'}`}
                >
                  Top Bids
                </button>
              </div>
            </div>
          )}
          <button onClick={() => setShowSettingsModal(true)} className="bg-slate-100 text-slate-800 border border-slate-300 px-3 py-2 rounded font-bold hover:bg-white transition text-xs lg:text-sm">⚙️ Settings</button>
          
          <button onClick={() => navigate('/dashboard')} className="bg-gray-700 px-3 py-2 rounded hover:bg-gray-800 font-bold transition text-xs lg:text-sm">Exit</button>
        </div>
      </header>

      <div className="p-3 lg:p-4 max-w-[1500px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-3 h-[calc(100vh-76px)]">
        
        <div className="lg:col-span-4 bg-white rounded-2xl shadow-xl p-4 border-t-8 border-blue-600 h-full flex flex-col relative">

          <button
            onClick={pickRandomPlayer}
            disabled={Boolean(currentPlayer && playerStatus === 'bidding' && hasBiddingStarted)}
            className={`w-full text-white font-black text-base py-2.5 rounded-xl shadow-[0_4px_0_0_rgba(67,56,202,1)] active:translate-y-1 transition-all mb-3 disabled:opacity-40 disabled:cursor-not-allowed ${playerStatus !== 'bidding' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {playerStatus !== 'bidding' ? '📸 BRING NEXT PLAYER' : `🎲 NEXT RANDOM PLAYER (${players.length} Left)`}
          </button>

          {!currentPlayer ? (
            <div className="text-center py-12 text-gray-400 font-bold text-lg border-4 border-dashed rounded-xl">
                कोई खिलाड़ी स्क्रीन पर नहीं है。<br/>ऊपर से नया प्लेयर लाएं!
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-4 mb-5">
                <img src={currentPlayer.photoUrl || 'https://via.placeholder.com/150'} alt="Player" className="w-20 h-20 rounded-2xl object-cover shadow-md border-4 border-blue-100" onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=No+Photo'; }} />
                <div>
                  <h1 className="text-2xl font-black text-gray-900 capitalize">{currentPlayer.name}</h1>
                  <p className="text-gray-500 font-bold text-sm mt-1">📍 {currentPlayer.city || 'Unknown'}</p>
                </div>
              </div>
              
              <div className="space-y-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-500 font-bold text-sm uppercase">Role</span>
                  <span className="text-lg font-black text-blue-700">{currentPlayer.role}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-500 font-bold text-sm uppercase">Category</span>
                  <span className="text-lg font-black text-purple-700">{normalizeCategory(currentPlayer.category)}</span>
                </div>                
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold text-sm uppercase">Base Price</span>
                  <span className="text-lg font-black text-green-700">₹ {currentPlayer.basePrice.toLocaleString()}</span>
                </div>
              </div>

              {playerStatus === 'bidding' ? (
                 <div className="mt-6 flex gap-3">
                   <button onClick={() => finalizePlayer('Sold')} className="w-full bg-green-600 text-white font-black text-xl py-3 rounded-xl hover:bg-green-700 shadow-[0_4px_0_0_rgba(21,128,61,1)] active:translate-y-1 transition-all">SOLD 🔨</button>
                   <button
                     onClick={() => finalizePlayer('Unsold')}
                     disabled={hasBiddingStarted}
                     className="w-full bg-red-600 text-white font-black text-lg py-3 rounded-xl hover:bg-red-700 shadow-[0_4px_0_0_rgba(185,28,28,1)] active:translate-y-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                   >
                    UNSOLD ❌
                   </button>
                 </div>
              ) : (
                 <div className={`mt-6 p-4 rounded-xl text-center border-2 ${playerStatus === 'sold' ? 'bg-green-100 border-green-500 text-green-800' : 'bg-red-100 border-red-500 text-red-800'}`}>
                    <h2 className="text-2xl font-black uppercase tracking-widest mb-1">{playerStatus}</h2>
                    <p className="font-bold text-sm">टीवी स्क्रीन पर फोटो रुक गई है।</p>
                    <p className="text-xs mt-1">नया प्लेयर लाने के लिए ऊपर 'Bring Next Player' दबाएं।</p>
                 </div>
              )}
            </>
          )}
        </div>

        <div className={`lg:col-span-8 bg-white rounded-2xl shadow-xl p-4 border-t-8 border-green-500 transition-all h-full flex flex-col overflow-hidden ${!currentPlayer || playerStatus !== 'bidding' ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
          
          <div className="flex items-start justify-between mb-4">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-yellow-500 to-green-500 animate-pulse"></div>
            
            <div className="text-left flex items-center space-x-4">
              <div>
                <p className="text-gray-400 font-bold uppercase text-xs mb-1 tracking-wider">Current Bid</p>
                <p className="text-4xl font-black text-green-400">₹ {currentBid.toLocaleString()}</p>
              </div>
              <button onClick={handleResetBid} className="bg-gray-700 p-2 rounded-full hover:bg-gray-600 transition shadow" title="Reset to Base Price">🔄</button>
            </div>
            
            <div className="text-right">
              <p className="text-gray-400 font-bold uppercase text-xs mb-1 tracking-wider">Highest Bidder</p>
              <p className="text-2xl font-black text-yellow-400">{biddingTeam ? getTeamLabel(biddingTeam) : "Waiting..."}</p>
              {activeBiddingTeamData && (
                <p className="text-xs text-orange-300 font-bold mt-1">
                  Max Bid: {formatCurrency(activeBiddingTeamData.maxBid)}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-between items-end mb-3 border-b pb-2">
             <h2 className="text-gray-500 font-bold text-sm uppercase tracking-widest">Fast Bidding Grid</h2>
             <div className="flex space-x-2">
                <input type="number" value={customBid} onChange={(e) => setCustomBid(e.target.value)} placeholder="Custom Bid ₹" className="p-1.5 border-2 border-gray-300 rounded font-bold w-28 text-sm focus:border-blue-500 outline-none" />
                <button onClick={handleCustomBidSubmit} className="bg-blue-600 text-white font-bold px-3 py-1.5 rounded shadow hover:bg-blue-700 text-sm">Jump 🚀</button>
                <select
                  value={directSellTeam}
                  onChange={(e) => setDirectSellTeam(e.target.value)}
                  className="p-1.5 border-2 border-gray-300 rounded font-bold w-32 text-sm focus:border-emerald-500 outline-none"
                >
                  <option value="">Base Sell Team</option>
                  {teams.map((team) => (
                    <option key={`base-sell-${team._id}`} value={team.teamName}>{team.shortName || team.teamName}</option>
                  ))}
                </select>
                <button onClick={handleDirectBaseSell} className="bg-emerald-600 text-white font-bold px-3 py-1.5 rounded shadow hover:bg-emerald-700 text-sm">Base Sell ✅</button>
             </div>
          </div>

          <div className="mb-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-purple-700 mb-1.5">Active Bidding Teams Zone (Max 4)</h3>
            {activeBiddingTeams.length === 0 ? (
              <div className="border border-dashed border-purple-300 bg-purple-50 rounded-lg p-2.5 text-xs font-bold text-purple-700">
                No active bidding teams yet. As soon as any team bids, it will appear here automatically.
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1 mb-1">
                {activeBiddingTeams.map((team, index) => {
                  const isHighestBidder = biddingTeam === team.teamName;
                  return (
                    <div key={`active-${team._id}`} className={`flex-1 rounded-lg border transition-all ${ultraCompact ? 'min-w-[190px] max-w-[220px] p-1' : 'min-w-[220px] max-w-[260px] p-1.5'} ${isHighestBidder ? 'border-yellow-400 bg-yellow-50 shadow' : 'border-purple-300 bg-purple-50 hover:border-purple-400'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className={`font-bold text-gray-800 truncate ${ultraCompact ? 'text-[11px]' : 'text-xs'}`} title={team.teamName}>{team.shortName || team.teamName}</h3>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-700 text-white font-black shrink-0">#{index + 1}</span>
                          </div>
                          <p className={`font-black text-purple-900 leading-tight ${ultraCompact ? 'text-[9px]' : 'text-[10px]'}`}>Purse: ₹{team.remainingPurse.toLocaleString()}</p>
                          <p className="text-[9px] text-purple-700 font-semibold leading-tight">Max: {formatCurrency(team.maxBid)}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-1 shrink-0">
                          <button disabled={currentBid + btn1 > Number(team.maxBid || 0)} onClick={() => updateBid(team.teamName, btn1)} className={`bg-blue-100 text-blue-800 font-black rounded hover:bg-blue-200 border border-blue-300 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${ultraCompact ? 'py-0.5 px-0.5 text-[9px]' : 'py-1 px-1 text-[10px]'}`}>{formatBidButton(btn1)}</button>
                          <button disabled={currentBid + btn2 > Number(team.maxBid || 0)} onClick={() => updateBid(team.teamName, btn2)} className={`bg-blue-100 text-blue-800 font-black rounded hover:bg-blue-200 border border-blue-300 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${ultraCompact ? 'py-0.5 px-0.5 text-[9px]' : 'py-1 px-1 text-[10px]'}`}>{formatBidButton(btn2)}</button>
                          <button disabled={currentBid + btn3 > Number(team.maxBid || 0)} onClick={() => updateBid(team.teamName, btn3)} className={`bg-blue-100 text-blue-800 font-black rounded hover:bg-blue-200 border border-blue-300 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${ultraCompact ? 'py-0.5 px-0.5 text-[9px]' : 'py-1 px-1 text-[10px]'}`}>{formatBidButton(btn3)}</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-600">All Teams</h3>
            <p className="text-[11px] font-bold text-gray-500">Visible {filteredTeams.length}/{teams.length} • Only this list scrolls.</p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border border-gray-200 rounded-md p-2 mb-2 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Search team / short name"
                  className="flex-1 min-w-[180px] p-1.5 border border-gray-300 rounded text-xs font-bold outline-none focus:border-blue-500"
                />
                <div className="flex items-center gap-1">
                  <button onClick={() => setTeamFilter('all')} className={`px-2 py-1 rounded text-[11px] font-black border ${teamFilter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}>All</button>
                  <button onClick={() => setTeamFilter('can-bid')} className={`px-2 py-1 rounded text-[11px] font-black border ${teamFilter === 'can-bid' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'}`}>Can Bid</button>
                  <button onClick={() => setTeamFilter('low-purse')} className={`px-2 py-1 rounded text-[11px] font-black border ${teamFilter === 'low-purse' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'}`}>Low Purse</button>
                  <button onClick={() => setTeamFilter('active-zone')} className={`px-2 py-1 rounded text-[11px] font-black border ${teamFilter === 'active-zone' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'}`}>Active 4</button>
                </div>
                <button
                  onClick={() => setUltraCompact((prev) => !prev)}
                  className={`px-2 py-1 rounded text-[11px] font-black border ${ultraCompact ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                >
                  {ultraCompact ? 'Ultra On' : 'Ultra Off'}
                </button>
                {(teamSearch || teamFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setTeamSearch('');
                      setTeamFilter('all');
                    }}
                    className="px-2 py-1 rounded text-[11px] font-black border border-red-300 text-red-700 bg-red-50 hover:bg-red-100"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-1.5 pb-2 auto-rows-fr">
              {filteredTeams.map((team) => {
                const isHighestBidder = biddingTeam === team.teamName;
                return (
                  <div key={team._id} className={`rounded-md border transition-all ${ultraCompact ? 'p-1.5' : 'p-2'} ${isHighestBidder ? 'border-yellow-400 bg-yellow-50 shadow' : 'border-gray-200 bg-gray-50 hover:border-blue-300'}`}>
                    <div className={`flex justify-between items-center ${ultraCompact ? 'mb-0.5' : 'mb-1'}`}>
                      <h3 className={`font-bold text-gray-800 truncate pr-1 ${ultraCompact ? 'text-xs' : 'text-sm'}`} title={team.teamName}>{team.shortName || team.teamName}</h3>
                      <div className="text-right shrink-0">
                        <span className="text-[9px] font-bold text-gray-500 uppercase block leading-none mb-0.5">Purse</span>
                        <span className={`font-black text-[11px] ${Number(team.remainingPurse || 0) < 50000 ? 'text-red-500' : 'text-green-600'}`}>₹{Number(team.remainingPurse || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className={`bg-orange-50 border border-orange-200 rounded ${ultraCompact ? 'mb-0.5 p-0.5' : 'mb-1 p-1'}`}>
                      <p className="text-[9px] uppercase font-black text-orange-700 tracking-wider">Dynamic Max Bid</p>
                      <p className="text-[11px] font-black text-orange-900">{formatCurrency(team.maxBid)}</p>
                      <p className="text-[9px] text-gray-500 font-semibold">Need {team.remainingRequiredPlayers} players</p>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      <button onClick={() => updateBid(team.teamName, btn1)} className={`bg-blue-100 text-blue-800 font-black rounded hover:bg-blue-200 border border-blue-300 shadow-sm ${ultraCompact ? 'py-0.5 px-0.5 text-[10px]' : 'py-1 px-0.5 text-[11px]'}`}>{formatBidButton(btn1)}</button>
                      <button onClick={() => updateBid(team.teamName, btn2)} className={`bg-blue-100 text-blue-800 font-black rounded hover:bg-blue-200 border border-blue-300 shadow-sm ${ultraCompact ? 'py-0.5 px-0.5 text-[10px]' : 'py-1 px-0.5 text-[11px]'}`}>{formatBidButton(btn2)}</button>
                      <button onClick={() => updateBid(team.teamName, btn3)} className={`bg-blue-100 text-blue-800 font-black rounded hover:bg-blue-200 border border-blue-300 shadow-sm ${ultraCompact ? 'py-0.5 px-0.5 text-[10px]' : 'py-1 px-0.5 text-[11px]'}`}>{formatBidButton(btn3)}</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredTeams.length === 0 && (
              <div className="text-center py-6 text-xs font-bold text-gray-500 border border-dashed border-gray-300 rounded-md">
                No teams found for current search/filter.
              </div>
            )}
          </div>

        </div>
      </div>

      {showResultsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
          <div className="bg-white w-11/12 max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
            
            <div className="bg-orange-600 text-white p-5 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-xl font-black uppercase tracking-wider">♻️ Sold / Unsold Players</h2>
              <div className="flex items-center space-x-6">
                 {auctionResultDatabase.some((p) => p.auctionStatus?.trim().toLowerCase() === 'unsold' || p.auctionStatus?.trim().toLowerCase() === 'passed') && (
                    <button onClick={bringAllBackToAuction} className="bg-white text-orange-600 font-black px-4 py-2 rounded-lg shadow-md hover:bg-orange-50 active:scale-95 transition">
                        Bring ALL Unsold Back ♻️
                    </button>
                 )}
                 <button onClick={() => setShowResultsModal(false)} className="text-white hover:text-gray-300 font-black text-4xl leading-none">&times;</button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto bg-gray-50 flex-grow">
              {auctionResultDatabase.length === 0 ? (
                <div className="text-center py-12 text-gray-500 font-bold text-xl">
                  अभी कोई Sold/Unsold प्लेयर नहीं है।
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {auctionResultDatabase.map((p) => (
                    <div key={p._id} className="bg-white p-4 rounded-xl shadow border border-gray-200 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <img src={p.photoUrl || 'https://via.placeholder.com/50'} alt="Player" className="w-16 h-16 rounded-full object-cover shadow border border-gray-300" />
                        <div>
                          <h3 className="font-bold text-lg">{p.name}</h3>
                          <p className="text-sm text-gray-500 font-semibold">{p.role} | ₹{p.basePrice}</p>
                          <p className={`text-xs font-black mt-1 ${p.auctionStatus === 'Sold' || p.auctionStatus === 'Icon' ? 'text-green-700' : 'text-red-600'}`}>
                            {p.auctionStatus} {p.soldTo && p.soldTo !== 'Unsold' ? `• ${getTeamLabel(p.soldTo)} (₹${p.soldPrice || 0})` : ''}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => bringBackToAuction(p)} 
                        className="bg-green-100 text-green-700 font-black px-4 py-2 rounded hover:bg-green-200 border border-green-300 transition-all active:scale-95"
                      >
                        Bring Back ♻️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/45">
          <div className="w-full max-w-xl h-full bg-white shadow-2xl p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-slate-800">⚙️ Control Settings</h2>
              <button onClick={() => setShowSettingsModal(false)} className="text-3xl leading-none text-slate-500 hover:text-slate-700">&times;</button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <p className="text-xs font-black uppercase tracking-wider text-indigo-700 mb-2">Player Order</p>
                <select
                  value={playerOrderMode}
                  onChange={(e) => setPlayerOrderMode(e.target.value)}
                  className="w-full p-2 rounded-lg border-2 border-indigo-200 font-bold text-indigo-800 outline-none focus:border-indigo-400"
                >
                  <option value="all-random">All Players Random</option>
                  <option value="category-random">Category-wise Random</option>
                </select>
                {playerOrderMode === 'category-random' && (
                  <>
                    <p className="text-xs text-indigo-700 font-bold mt-3 mb-1">Order: {effectiveCategoryOrder.length > 0 ? effectiveCategoryOrder.join(' → ') : '-'}</p>
                    <div className="grid grid-cols-2 gap-2">
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
                          className="px-2 py-1 text-xs rounded border bg-white font-bold text-indigo-700 hover:bg-indigo-100"
                        >
                          Start with {category}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] mt-2 font-semibold text-indigo-600">Active Category: {activeCategory || '-'}</p>
                  </>
                )}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <p className="text-xs font-black uppercase tracking-wider text-slate-700">Live Screen Display</p>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Display Mode</label>
                  <select value={displayMode} onChange={(e) => setDisplayMode(e.target.value)} className="w-full p-2 rounded-lg border-2 border-slate-200 font-bold text-slate-800 outline-none focus:border-slate-400 mt-1">
                    <option value="day">Day Mode</option>
                    <option value="night">Night Mode</option>
                    <option value="projector">Projector / Presentation</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Player Photo Size</label>
                  <select value={photoSize} onChange={(e) => setPhotoSize(e.target.value)} className="w-full p-2 rounded-lg border-2 border-slate-200 font-bold text-slate-800 outline-none focus:border-slate-400 mt-1">
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={openResultsModal} className="bg-orange-500 border border-orange-400 px-4 py-2 rounded hover:bg-orange-400 font-bold transition">♻️ Auction Results</button>
                <button onClick={resetWholeAuction} className="bg-red-700 text-white border border-red-500 px-4 py-2 rounded hover:bg-red-800 font-bold transition">⚠️ Reset Auction</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default ControlPanel;