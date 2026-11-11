import { useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '../../utils/apiClient';

export function useAuctionDataSync({
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
}) {
  const fetchTeamsWithMaxBid = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const activeP = currentPlayerRef?.current || currentPlayer;
      const teamsRes = await apiRequest({
        method: 'get',
        path: '/api/teams',
        params: {
          activePlayerId: activeP?._id || undefined,
          basePrice: activeP?.basePrice || undefined,
        },
        headers,
      });
      const payload = Array.isArray(teamsRes.data) ? teamsRes.data : [];
      setTeams(payload.map(normalizeTeam));
    } catch (error) {
      console.error('Failed to fetch teams with max bid:', error);
    }
  }, [currentPlayer?._id, currentPlayer?.basePrice, currentPlayerRef, normalizeTeam, setTeams]);

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const playersRes = await apiRequest({ method: 'get', path: '/api/players', headers });
      const allPlayersPayload = Array.isArray(playersRes.data) ? playersRes.data : [];
      setAllPlayers(allPlayersPayload);

      const auctionRes = await apiRequest({ method: 'get', path: '/api/auction/state', headers });
      const authoritativeState = auctionRes.data;
      if (authoritativeState?.status === 'bidding' && authoritativeState?.activePlayer) {
        const activePlayer = allPlayersPayload.find((player) => String(player._id) === String(authoritativeState.activePlayer._id)) || authoritativeState.activePlayer;
        setCurrentPlayer(activePlayer);
        currentPlayerRef.current = activePlayer;
        setCurrentBid(Number(authoritativeState.currentBid || activePlayer.basePrice || 0));
        setBiddingTeam(authoritativeState.highestBidder?._id || authoritativeState.highestBidder || '');
        setHasBiddingStarted(Boolean(authoritativeState.highestBidder));
        setPlayerStatus('bidding');
        playerStatusRef.current = 'bidding';
        const sVer = Number(authoritativeState.version);
        if (auctionVersionRef && Number.isFinite(sVer) && sVer > (auctionVersionRef.current || 0)) {
          auctionVersionRef.current = sVer;
        }
        setAuctionVersion(sVer);
        setBiddingActive(Boolean(authoritativeState.biddingActive));
      }

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
      // The persisted auction state is the source of truth after a refresh. Only
      // use the legacy browser snapshot when the server has no active auction.
      if (curr && !(authoritativeState?.status === 'bidding' && authoritativeState?.activePlayer)) {
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
            if (dbPlayer.soldPrice) setCurrentBid(dbPlayer.soldPrice);
            if (dbPlayer.soldTo) setBiddingTeam(dbPlayer.soldTo?._id || dbPlayer.soldTo);
          }
        } else if (dbPlayer.auctionStatus?.trim().toLowerCase() === 'unsold') {
          if (currStatus === 'bidding') {
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
          setCurrentPlayer(dbPlayer);
        } else {
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
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [
    currentPlayerRef,
    normalizeCategory,
    playerStatusRef,
    setActiveBiddingList,
    setAllPlayers,
    setAuctionVersion,
    auctionVersionRef,
    setBiddingActive,
    setBiddingTeam,
    setCategoryOrder,
    setCurrentBid,
    setCurrentPlayer,
    setHasBiddingStarted,
    setPlayerStatus,
    setPlayers,
    setTeamBidActivity,
    socketRef
  ]);

  // 1. Fetch data ONCE on mount (Main branch parity - prevents infinite loop)
  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Fetch teams with max bid ONLY when stage player changes
  useEffect(() => {
    fetchTeamsWithMaxBid();
  }, [currentPlayer?._id, currentPlayer?.basePrice]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. Periodic 15s sync using ref to avoid recreating interval on every render
  const fetchTeamsRef = useRef(fetchTeamsWithMaxBid);
  useEffect(() => {
    fetchTeamsRef.current = fetchTeamsWithMaxBid;
  }, [fetchTeamsWithMaxBid]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchTeamsRef.current?.();
    }, 15000);
    return () => clearInterval(id);
  }, []);

  return {
    fetchData,
    fetchTeamsWithMaxBid,
  };
}
