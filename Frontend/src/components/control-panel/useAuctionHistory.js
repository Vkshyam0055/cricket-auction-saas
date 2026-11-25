import { useState, useRef } from 'react';
import { apiRequest } from '../../utils/apiClient';

export function useAuctionHistory({
  currentPlayer,
  currentBid,
  biddingTeam,
  playerStatus,
  isAwaitingTeam = false,
  players,
  teams,
  activeBiddingList,
  teamBidActivity,
  setCurrentPlayer,
  setCurrentBid,
  currentBidRef,
  setBiddingTeam,
  biddingTeamRef,
  setPlayerStatus,
  setHasBiddingStarted,
  setIsAwaitingTeam,
  isAwaitingTeamRef,
  setBiddingActive,
  auctionVersion,
  auctionVersionRef,
  setAuctionVersion,
  setPlayers,
  setActiveBiddingList,
  setTeamBidActivity,
  syncActiveBiddingState,
  fetchTeamsWithMaxBid,
  fetchData,
  currentPlayerRef,
  playerStatusRef,
}) {
  const [actionHistory, setActionHistory] = useState([]);
  const isUndoingRef = useRef(false);

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
          isAwaitingTeam: Boolean(isAwaitingTeam),
          players: [...players],
          teams: JSON.parse(JSON.stringify(teams)),
          activeBiddingList: [...activeBiddingList],
          teamBidActivity: { ...teamBidActivity }
        }
      }
    ]);
  };

  const handleUndo = async () => {
    if (isUndoingRef.current || actionHistory.length === 0) return;
    isUndoingRef.current = true;
    const lastAction = actionHistory[actionHistory.length - 1];

    try {
      const token = localStorage.getItem('token');

      if (lastAction.actionType === 'SOLD' || lastAction.actionType === 'UNSOLD') {
        let undoRes;
        try {
          undoRes = await apiRequest({
            method: 'put',
            path: `/api/players/undo/${lastAction.affectedPlayer._id}`,
            data: {},
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (error) {
          alert(error.response?.data?.message || 'Database Revert Failed!');
          return;
        }

        const undoState = undoRes?.data?.state;
        if (undoState) {
          const undoVer = Number(undoState.version);
          if (auctionVersionRef && Number.isFinite(undoVer) && undoVer > (auctionVersionRef.current || 0)) {
            auctionVersionRef.current = undoVer;
          }
          if (setAuctionVersion && Number.isFinite(undoVer) && undoVer > 0) {
            setAuctionVersion(undoVer);
          }

          setCurrentPlayer(null);
          if (currentPlayerRef) currentPlayerRef.current = null;
          setCurrentBid(0);
          if (currentBidRef) currentBidRef.current = 0;
          setBiddingTeam('');
          if (biddingTeamRef) biddingTeamRef.current = '';
          setPlayerStatus('bidding');
          if (playerStatusRef) playerStatusRef.current = 'bidding';
          setHasBiddingStarted(false);
          if (setIsAwaitingTeam) setIsAwaitingTeam(false);
          if (isAwaitingTeamRef) isAwaitingTeamRef.current = false;
          if (setBiddingActive) setBiddingActive(false);
          setActiveBiddingList([]);
          setTeamBidActivity({});
          syncActiveBiddingState('reset');
        }

        setActionHistory((prev) => prev.slice(0, -1));
        await Promise.all([fetchTeamsWithMaxBid(), fetchData()]);
        return;
      }

      // Restore previous snapshot authoritatively via backend persistence & broadcast
      const snap = lastAction.snapshot;
      const candidateTeams = snap.teams || teams || [];
      const restoredTeam = snap.biddingTeam
        ? candidateTeams.find((t) => String(t._id) === String(snap.biddingTeam) || t.teamName === snap.biddingTeam)
        : null;
      const curExpectedVersion = auctionVersionRef?.current > 0
        ? auctionVersionRef.current
        : (auctionVersion !== undefined && auctionVersion !== null && Number(auctionVersion) > 0 ? Number(auctionVersion) : undefined);

      const requestPayload = snap.currentPlayer
        ? {
            playerId: snap.currentPlayer._id,
            bidAmount: Number(snap.currentBid ?? snap.currentPlayer.basePrice ?? 0),
            teamId: restoredTeam?._id || '',
            status: snap.playerStatus || 'bidding',
            isAwaitingTeam: Boolean(snap.isAwaitingTeam),
            expectedVersion: curExpectedVersion
          }
        : {
            playerId: null,
            bidAmount: 0,
            teamId: '',
            status: 'idle',
            isAwaitingTeam: false,
            expectedVersion: curExpectedVersion
          };

      let restoreRes;
      try {
        restoreRes = await apiRequest({
          method: 'post',
          path: '/api/auction/restore-state',
          data: requestPayload,
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        alert(`🚫 ${error.response?.data?.message || 'Undo could not be completed.'}`);
        await Promise.all([fetchTeamsWithMaxBid(), fetchData()]);
        return;
      }

      const committedState = restoreRes?.data?.state;
      const committedPlayer = restoreRes?.data?.player || null;
      const committedTeam = restoreRes?.data?.team || null;

      const restoredVer = Number(committedState?.version);
      if (auctionVersionRef && Number.isFinite(restoredVer) && restoredVer > (auctionVersionRef.current || 0)) {
        auctionVersionRef.current = restoredVer;
      }
      if (setAuctionVersion && Number.isFinite(restoredVer) && restoredVer > 0) {
        setAuctionVersion(restoredVer);
      }

      const committedStatus = committedState?.status || 'idle';
      const uiStatus = committedPlayer ? (committedStatus === 'idle' ? 'bidding' : committedStatus) : 'bidding';
      const committedBid = committedPlayer ? Number(committedState?.currentBid ?? committedPlayer?.basePrice ?? 0) : 0;
      const committedAwaiting = Boolean(committedState?.isAwaitingTeam);
      const committedTeamId = (!committedAwaiting && committedStatus !== 'unsold' && committedStatus !== 'idle')
        ? String(committedTeam?._id || committedState?.highestBidder || '')
        : '';

      setCurrentPlayer(committedPlayer);
      if (currentPlayerRef) currentPlayerRef.current = committedPlayer;
      setCurrentBid(committedBid);
      if (currentBidRef) currentBidRef.current = committedBid;
      setBiddingTeam(committedTeamId);
      if (biddingTeamRef) biddingTeamRef.current = committedTeamId;
      setPlayerStatus(uiStatus);
      if (playerStatusRef) playerStatusRef.current = uiStatus;
      if (setIsAwaitingTeam) setIsAwaitingTeam(committedAwaiting);
      if (isAwaitingTeamRef) isAwaitingTeamRef.current = committedAwaiting;
      setHasBiddingStarted(Boolean(committedTeamId && !committedAwaiting && uiStatus === 'bidding'));
      if (setBiddingActive) setBiddingActive(Boolean(restoreRes?.data?.biddingActive));

      if (Array.isArray(snap.players)) {
        setPlayers(snap.players);
      }
      const restoredActive = committedPlayer ? (snap.activeBiddingList || []) : [];
      setActiveBiddingList(restoredActive);
      const restoredActivity = committedPlayer ? (snap.teamBidActivity || {}) : {};
      setTeamBidActivity(restoredActivity);
      syncActiveBiddingState(committedPlayer ? 'replace' : 'reset', committedPlayer ? { lastBidActions: restoredActive } : undefined);

      setActionHistory((prev) => prev.slice(0, -1));
      await Promise.all([fetchTeamsWithMaxBid(), fetchData()]);
    } finally {
      isUndoingRef.current = false;
    }
  };

  return {
    actionHistory,
    setActionHistory,
    saveStateToHistory,
    handleUndo,
  };
}
