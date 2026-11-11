import { useState } from 'react';
import { apiRequest } from '../../utils/apiClient';

export function useAuctionHistory({
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
}) {
  const [actionHistory, setActionHistory] = useState([]);

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
      } catch {
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

  return {
    actionHistory,
    setActionHistory,
    saveStateToHistory,
    handleUndo,
  };
}
