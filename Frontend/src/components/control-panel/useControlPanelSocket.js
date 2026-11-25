import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { clearAuthSession, getSocketBaseUrl } from '../../utils/apiClient';

export function useControlPanelSocket({
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
  setCurrentPlayer,
  setPlayerStatus,
  playerStatusRef,
  tournamentId,
}) {
  const internalVersionRef = useRef(0);
  const versionRef = auctionVersionRef || internalVersionRef;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !tournamentId) return;
    const socket = io(getSocketBaseUrl(), {
      auth: { token, clientType: 'operator', tournamentId }
    });
    socketRef.current = socket;

    socket.on('biddingStateUpdate', (data) => {
      if (data?.tournamentId && String(data.tournamentId) !== String(tournamentId)) return;
      if (data && typeof data.biddingActive === 'boolean') {
        setBiddingActive(data.biddingActive);
      }
    });

    socket.on('updateAudienceScreen', (data) => {
      if (!data) return;
      if (data.tournamentId && String(data.tournamentId) !== String(tournamentId)) return;

      const incomingVersion = Number(data.version);
      const hasValidVersion = data.version !== undefined && data.version !== null && Number.isFinite(incomingVersion) && incomingVersion > 0;

      // Prevent stale echo packets, duplicates, or delayed broadcasts from regressing newer state
      if (hasValidVersion && incomingVersion <= versionRef.current) {
        return;
      }

      if (hasValidVersion && incomingVersion > versionRef.current) {
        versionRef.current = incomingVersion;
        setAuctionVersion(incomingVersion);
      }

      const incomingStatus = data.status || data.playerStatus;
      if (incomingStatus && incomingStatus !== 'bidding') {
        setHasBiddingStarted(false);
        if (setIsAwaitingTeam) setIsAwaitingTeam(false);
        if (isAwaitingTeamRef) isAwaitingTeamRef.current = false;
        if (incomingStatus === 'idle') {
          if (setCurrentPlayer) setCurrentPlayer(null);
          if (currentPlayerRef) currentPlayerRef.current = null;
          if (setPlayerStatus) setPlayerStatus('bidding');
          if (playerStatusRef) playerStatusRef.current = 'bidding';
          setCurrentBid(0);
          if (currentBidRef) currentBidRef.current = 0;
          setBiddingTeam('');
          if (biddingTeamRef) biddingTeamRef.current = '';
        } else {
          if (data.player !== undefined && setCurrentPlayer) setCurrentPlayer(data.player);
          if (data.player !== undefined && currentPlayerRef) currentPlayerRef.current = data.player;
          if (setPlayerStatus) setPlayerStatus(incomingStatus);
          if (playerStatusRef) playerStatusRef.current = incomingStatus;
        }
        return;
      }

      if (data.player !== undefined) {
        if (setCurrentPlayer) setCurrentPlayer(data.player);
        if (currentPlayerRef) currentPlayerRef.current = data.player;
      }
      if (setPlayerStatus) setPlayerStatus('bidding');
      if (playerStatusRef) playerStatusRef.current = 'bidding';

      if (data.bidAmount !== undefined) {
        const nextBidVal = Number(data.bidAmount);
        setCurrentBid(nextBidVal);
        if (currentBidRef) currentBidRef.current = nextBidVal;

        const activeBasePrice = Number(data.player?.basePrice ?? currentPlayerRef.current?.basePrice ?? 0);
        const hasTeamBid = Boolean(data.teamId || data.teamName || data.biddingTeam);
        const isAwaiting = Boolean(data.isAwaitingTeam || (!hasTeamBid && nextBidVal > activeBasePrice));

        if (setIsAwaitingTeam) {
          setIsAwaitingTeam(isAwaiting);
        }
        if (isAwaitingTeamRef) {
          isAwaitingTeamRef.current = isAwaiting;
        }

        if (data.teamId && !isAwaiting) {
          setBiddingTeam(data.teamId);
          if (biddingTeamRef) biddingTeamRef.current = data.teamId;
        } else {
          setBiddingTeam('');
          if (biddingTeamRef) biddingTeamRef.current = '';
        }

        // Only mark bidding started when an actual team has claimed the bid
        const actualTeamClaimed = Boolean(hasTeamBid && !isAwaiting);
        setHasBiddingStarted(actualTeamClaimed);

        if (actualTeamClaimed) {
          const source = data.bidSource || (data.isRemote ? 'remote' : 'onsite');
          setLastBidSource(source);
          if (source === 'remote') {
            const tName = data.teamName || data.biddingTeamName || 'Remote Bidder';
            setLatestRemoteToast({
              teamName: tName,
              shortName: data.shortName || '',
              amount: Number(data.bidAmount),
              time: Date.now()
            });
          }
        }
      }
    });

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
      socket.off('updateAudienceScreen');
      socket.off('activeBiddingSync');
      socket.off('activeBiddingUpdate');
      socket.off('liveScreenConfigSync');
      socket.off('biddingStateUpdate');
      socket.off('sessionExpired');
      socket.off('connect_error');
      socket.emit('setBiddingActive', { active: false });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    navigate,
    socketRef,
    setBiddingActive,
    setCurrentBid,
    currentPlayerRef,
    setBiddingTeam,
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
    lastSyncedConfigRef
    , tournamentId
  ]);

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
  }, [
    displayMode,
    layout,
    photoSize,
    screenView,
    breakView,
    selectedSquadTeam,
    syncLiveScreenConfig,
    socketRef,
    configDebounceRef,
    configVersionRef
  ]);
}
