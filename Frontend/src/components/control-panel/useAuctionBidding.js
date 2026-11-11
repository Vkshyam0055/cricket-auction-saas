import { useRef } from 'react';
import { apiRequest } from '../../utils/apiClient';

export function useAuctionBidding({
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
  finalizePlayer,
  screenView,
}) {
  const activeBidPromiseRef = useRef(null);

  const updateBid = async (teamRef, amount, isJump = false, isRemote = false, callback = null, bidTypeOverride = null) => {
    if (playerStatus !== 'bidding') {
      if (isRemote && callback) callback({ success: false, message: 'Bidding is not active' });
      return false;
    }

    if (!biddingActive) {
      if (isRemote && callback) callback({ success: false, message: 'Bidding is currently paused by the organizer.' });
      else alert('⚠️ Bidding is paused. Click "Start Bidding" to resume.');
      return false;
    }

    const team = resolveTeam(teamRef);
    if (!team) return false;

    if (isRemote) {
      const validIncrements = [];
      if (biddingButtonsCount >= 1) validIncrements.push(btn1);
      if (biddingButtonsCount >= 2) validIncrements.push(btn2);
      if (biddingButtonsCount >= 3) validIncrements.push(btn3);

      if (!isJump && !validIncrements.includes(amount)) {
        if (callback) callback({ success: false, message: 'Invalid bid increment' });
        return false;
      }
    }

    const executeBid = async () => {
      const exactCurrentBid = currentBidRef?.current !== undefined ? currentBidRef.current : currentBid;
      const exactBiddingTeam = biddingTeamRef?.current !== undefined ? biddingTeamRef.current : biddingTeam;

      if (String(exactBiddingTeam) === String(team._id) && !isJump && bidTypeOverride !== 'base') {
        if (isRemote && callback) callback({ success: false, message: 'You are already the highest bidder' });
        return false;
      }

      const newBidAmount = bidTypeOverride === 'base'
        ? exactCurrentBid
        : (isJump ? amount : exactCurrentBid + amount);

      if (newBidAmount > team.remainingPurse) {
        if (isRemote && callback) return callback({ success: false, message: 'Insufficient purse' });

        alert(`⚠️ ${team.teamName} के पास इतने पैसे नहीं हैं!`);
        return false;
      }

      if (newBidAmount > Number(team.maxBid || 0)) {
        if (isRemote && callback) return callback({ success: false, message: 'Exceeds max bid' });

        alert(`🚫 ${team.teamName} का Max Bid ${formatCurrency(team.maxBid)} है। इस लिमिट से ऊपर bid नहीं कर सकते।`);
        return false;
      }

      let authoritativeBid;
      let retries = 0;
      const maxRetries = 2;

      while (retries <= maxRetries) {
        const currentExpectedVersion = (auctionVersionRef?.current && auctionVersionRef.current > 0)
          ? auctionVersionRef.current
          : ((auctionVersion !== undefined && auctionVersion !== null && Number(auctionVersion) > 0) ? Number(auctionVersion) : undefined);

        try {
          const token = localStorage.getItem('token');
          authoritativeBid = await apiRequest({
            method: 'post',
            path: '/api/auction/bid',
            data: {
              teamId: team._id,
              playerId: currentPlayerRef.current?._id,
              amount,
              bidType: bidTypeOverride || (isJump ? 'custom' : 'increment'),
              expectedVersion: currentExpectedVersion
            },
            headers: { Authorization: `Bearer ${token}` }
          });
          break;
        } catch (error) {
          const respData = error.response?.data;
          const isConflict = error.response?.status === 409 &&
            (respData?.code === 'STALE_AUCTION_STATE' || respData?.code === 'BID_CONFLICT');

          if (respData?.currentVersion) {
            const newVer = Number(respData.currentVersion);
            if (Number.isFinite(newVer) && newVer > (auctionVersionRef?.current || 0)) {
              if (auctionVersionRef) auctionVersionRef.current = newVer;
              setAuctionVersion(newVer);
            }
          }

          if (isConflict && retries < maxRetries) {
            retries++;
            continue;
          }

          // Auto-heal auction state from server so Control Panel never locks up
          try {
            const token = localStorage.getItem('token');
            const stateRes = await apiRequest({ method: 'get', path: '/api/auction/state', headers: { Authorization: `Bearer ${token}` }, skipAuthRedirect: true });
            if (stateRes.data) {
              if (stateRes.data.version) {
                const sVer = Number(stateRes.data.version);
                if (auctionVersionRef && sVer > (auctionVersionRef.current || 0)) {
                  auctionVersionRef.current = sVer;
                }
                setAuctionVersion(sVer);
              }
              if (stateRes.data.currentBid) {
                const sBid = Number(stateRes.data.currentBid);
                setCurrentBid(sBid);
                if (currentBidRef) currentBidRef.current = sBid;
              }
              if (stateRes.data.highestBidder) {
                const hbId = stateRes.data.highestBidder._id || stateRes.data.highestBidder;
                setBiddingTeam(hbId);
                if (biddingTeamRef) biddingTeamRef.current = hbId;
              }
            }
          } catch { /* non-blocking sync */ }

          const message = error.response?.data?.message || 'Bid was rejected.';
          if (isRemote && callback) callback({ success: false, message });
          else if (!isConflict) alert(`🚫 ${message}`);
          return false;
        }
      }

      const acceptedBid = Number(authoritativeBid.data.state.currentBid);
      const newVer = Number(authoritativeBid.data.state.version);
      if (auctionVersionRef && Number.isFinite(newVer) && newVer > (auctionVersionRef.current || 0)) {
        auctionVersionRef.current = newVer;
      }
      if (currentBidRef) currentBidRef.current = acceptedBid;
      if (biddingTeamRef) biddingTeamRef.current = team._id;
      setAuctionVersion(newVer);
      saveStateToHistory('BID');

      setCurrentBid(acceptedBid);
      setBiddingTeam(team._id);
      setLastBidSource('onsite');
      setHasBiddingStarted(true);

      if (isRemote && callback) {
        callback({ success: true, message: 'Bid accepted', newBidAmount: acceptedBid, teamId: team._id });
      }

      const now = Date.now();
      const nextActivity = { ...teamBidActivity, [String(team._id)]: now, [team.teamName]: now };
      let nextList = [...activeBiddingList];

      // Check if team is already in active 4 (by _id or teamName)
      const existingIdx = nextList.findIndex((item) => {
        const match = resolveTeam(item);
        return match && String(match._id) === String(team._id);
      });

      if (existingIdx !== -1) {
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
        bidAmount: acceptedBid,
        currentBid: acceptedBid,
        teamId: team._id,
        biddingTeamId: team._id,
        teamName: team.teamName,
        biddingTeamName: team.teamName,
        shortName: team.shortName,
        logoUrl: team.logoUrl || team.logo || '',
        player: currentPlayer,
        currentPlayer: currentPlayer,
        status: playerStatus,
        playerStatus: playerStatus,
        version: newVer,
        isRemote: false,
        bidSource: 'onsite'
      });
      return true;
    };

    const previousPromise = activeBidPromiseRef.current || Promise.resolve();
    const currentPromise = previousPromise.then(() => executeBid(), () => executeBid());
    activeBidPromiseRef.current = currentPromise;

    try {
      return await currentPromise;
    } finally {
      if (activeBidPromiseRef.current === currentPromise) {
        activeBidPromiseRef.current = null;
      }
    }
  };

  const handleCustomBidSubmit = async () => {
    const amount = Number(customBid);
    const targetTeamRef = jumpBidTeam || biddingTeam;
    if (!targetTeamRef) {
      alert('कृपया Jump Bid के लिए पहले एक टीम सेलेक्ट करें!');
      return;
    }
    const team = resolveTeam(targetTeamRef);
    if (!team) {
      alert('चुनी गई टीम अमान्य है!');
      return;
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      alert('कृपया एक मान्य राशि दर्ज करें!');
      return;
    }
    if (amount <= currentBid) {
      alert('Jump Bid करंट बिड से ज़्यादा होनी चाहिए!');
      return;
    }
    const success = await updateBid(team._id, amount, true);
    if (success) {
      setCustomBid('');
      setJumpBidTeam('');
    }
  };

  const handleToggleBidding = async () => {
    if (!currentPlayer || playerStatus !== 'bidding') return;
    if (screenView === 'break') {
      alert('🚫 Cannot start bidding while viewing Break Content.');
      return;
    }
    const nextActive = !biddingActive;
    try {
      const token = localStorage.getItem('token');
      await apiRequest({
        method: 'post',
        path: '/api/auction/toggle-bidding',
        data: { active: nextActive },
        headers: { Authorization: `Bearer ${token}` }
      });
      setBiddingActive(nextActive);
      socketRef.current?.emit('setBiddingActive', { active: nextActive });
    } catch (err) {
      alert(`🚫 ${err.response?.data?.message || 'Failed to update bidding state.'}`);
    }
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

    const accepted = await updateBid(selectedTeam._id, basePrice, false, false, null, 'base');
    if (!accepted) return;
    await finalizePlayer('Sold', {
      soldTeamId: selectedTeam._id,
      soldTeamName: selectedTeam.teamName,
      soldPrice: basePrice
    });
  };

  return {
    updateBid,
    handleCustomBidSubmit,
    handleToggleBidding,
    handleDirectBaseSell,
  };
}
