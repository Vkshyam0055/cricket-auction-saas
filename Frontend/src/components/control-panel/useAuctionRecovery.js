import { useState, useRef, useCallback } from 'react';
import { apiRequest } from '../../utils/apiClient';

export function useAuctionRecovery({
  allPlayers = [],
  players,
  setPlayers,
  currentPlayer,
  setCurrentPlayer,
  setCurrentBid,
  setBiddingTeam,
  setPlayerStatus,
  setHasBiddingStarted,
  setIsAwaitingTeam,
  isAwaitingTeamRef,
  setBiddingActive,
  auctionVersionRef,
  setAuctionVersion,
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
}) {
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState(null);
  const isFetchingResultsRef = useRef(false);

  const fetchResultsData = useCallback(async (force = false) => {
    if (isFetchingResultsRef.current && !force) return;
    isFetchingResultsRef.current = true;
    setIsLoadingResults(true);
    setResultsError(null);

    try {
      const token = localStorage.getItem('token');
      const res = await apiRequest({
        method: 'get',
        path: '/api/players',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        skipAuthRedirect: true
      });

      const currentReadyIds = (players || []).map((p) => String(p._id));
      const activeP = currentPlayerRef?.current || currentPlayer;
      if (activeP?._id) {
        currentReadyIds.push(String(activeP._id));
      }

      const rawList = Array.isArray(res.data) ? res.data : [];
      const resultPlayers = rawList.filter((p) => {
        if (!p || !p._id) return false;
        const approval = String(p.approvalStatus || '').trim().toLowerCase();
        const status = String(p.auctionStatus || '').trim().toLowerCase();
        const isApproved = approval === 'approved';
        const isTargetStatus = status === 'sold' || status === 'unsold' || status === 'passed' || status === 'icon';
        const isNotCurrent = !currentReadyIds.includes(String(p._id));
        return isApproved && isTargetStatus && isNotCurrent;
      });

      setAuctionResultDatabase(resultPlayers);
      setResultsError(null);
    } catch (error) {
      console.error('Auction result fetch error:', error);
      const msg = error.response?.data?.message || error.message || 'Error loading auction results. Please try again.';
      setResultsError(msg);
    } finally {
      setIsLoadingResults(false);
      isFetchingResultsRef.current = false;
    }
  }, [players, currentPlayer, currentPlayerRef, setAuctionResultDatabase]);

  const openResultsModal = useCallback(() => {
    // 1. Extract results from allPlayers in memory immediately (Main branch parity - 0ms instant display!)
    const currentReadyIds = (players || []).map((p) => String(p._id));
    const activeP = currentPlayerRef?.current || currentPlayer;
    if (activeP?._id) {
      currentReadyIds.push(String(activeP._id));
    }

    const rawList = Array.isArray(allPlayers) && allPlayers.length > 0 ? allPlayers : [];
    const instantResultPlayers = rawList.filter((p) => {
      if (!p || !p._id) return false;
      const approval = String(p.approvalStatus || '').trim().toLowerCase();
      const status = String(p.auctionStatus || '').trim().toLowerCase();
      const isApproved = approval === 'approved';
      const isTargetStatus = status === 'sold' || status === 'unsold' || status === 'passed' || status === 'icon';
      const isNotCurrent = !currentReadyIds.includes(String(p._id));
      return isApproved && isTargetStatus && isNotCurrent;
    });

    if (instantResultPlayers.length > 0 || (auctionResultDatabase || []).length === 0) {
      setAuctionResultDatabase(instantResultPlayers);
    }

    // 2. Instantly open modal
    setShowResultsModal(true);
    if (typeof setShowSettingsModal === 'function') {
      setShowSettingsModal(false);
    }

    // 3. Silently re-sync with backend in background without any blocking spinner
    fetchResultsData();
  }, [allPlayers, players, currentPlayer, currentPlayerRef, (auctionResultDatabase || []).length, setAuctionResultDatabase, setShowResultsModal, setShowSettingsModal, fetchResultsData]);

  const retryFetchResults = useCallback(() => {
    fetchResultsData(true);
  }, [fetchResultsData]);

  const bringBackToAuction = async (playerToBring) => {
    if (isProcessingRecovery) return;
    setIsProcessingRecovery(true);
    try {
      const token = localStorage.getItem('token');
      // Optimistic update so UI reflects immediately
      setPlayers((prev) => [...prev, { ...playerToBring, auctionStatus: 'ReadyForAuction', soldTo: 'Unsold', soldPrice: 0 }]);
      setAuctionResultDatabase((prev) => prev.filter((p) => p._id !== playerToBring._id));

      await apiRequest({
        method: 'put',
        path: `/api/players/undo/${playerToBring._id}`,
        data: {},
        headers: { Authorization: `Bearer ${token}` }
      });

      await Promise.all([fetchTeamsWithMaxBid(), fetchData()]);
      alert(`🔥 ${playerToBring.name} को वापस ऑक्शन पूल में शामिल कर लिया गया है!`);
    } catch (error) {
      console.error('Bring back error:', error);
      alert('एरर: डेटाबेस अपडेट नहीं हो पाया!');
      await Promise.all([fetchTeamsWithMaxBid(), fetchData()]);
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
      await Promise.all([fetchTeamsWithMaxBid(), fetchData()]);
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
      await Promise.all([fetchTeamsWithMaxBid(), fetchData()]);
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
      const resetRes = await apiRequest({
        method: 'post',
        path: '/api/players/reset-auction',
        data: {},
        headers: { Authorization: `Bearer ${token}` }
      });

      const resetVer = Number(resetRes?.data?.state?.version);
      if (auctionVersionRef && Number.isFinite(resetVer) && resetVer > (auctionVersionRef.current || 0)) {
        auctionVersionRef.current = resetVer;
      }
      if (setAuctionVersion && Number.isFinite(resetVer) && resetVer > 0) {
        setAuctionVersion(resetVer);
      }

      setCurrentPlayer(null);
      currentPlayerRef.current = null;
      setCurrentBid(0);
      setBiddingTeam('');
      setPlayerStatus('bidding');
      playerStatusRef.current = 'bidding';
      setHasBiddingStarted(false);
      if (setIsAwaitingTeam) setIsAwaitingTeam(false);
      if (isAwaitingTeamRef) isAwaitingTeamRef.current = false;
      if (setBiddingActive) setBiddingActive(false);
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

      setAuctionResultDatabase([]);
      setShowResultsModal(false);
      setShowSettingsModal(false);
      await Promise.all([fetchTeamsWithMaxBid(), fetchData()]);
      alert('✅ 100% ऑक्शन रीसेट सफल रहा! सभी खिलाड़ी और टीमें अपनी मूल स्थिति में आ चुके हैं।');
    } catch (error) {
      console.error(error);
      alert('एरर: रीसेट करने में दिक्कत आई।');
    } finally {
      setIsProcessingRecovery(false);
    }
  };

  return {
    openResultsModal,
    bringBackToAuction,
    bringAllBackToAuction,
    bringAllPlayersBack,
    resetWholeAuction,
    isLoadingResults,
    resultsError,
    retryFetchResults,
    fetchResultsData,
  };
}
