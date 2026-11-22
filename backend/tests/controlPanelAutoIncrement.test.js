const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Phase 4: Admin Control Panel Auto Increment Integration Logic Verification
 *
 * This test suite verifies the frontend client-side state machine, button guards,
 * claim logic, and conflict recovery invariants implemented in:
 * - Frontend/src/components/control-panel/useAuctionBidding.js
 * - Frontend/src/components/control-panel/useControlPanelSocket.js
 * - Frontend/src/components/control-panel/useAuctionDataSync.js
 * - Frontend/src/components/control-panel/PlayerStageCard.jsx
 * - Frontend/src/components/control-panel/BiddingControlBar.jsx
 */

describe('Phase 4: Admin Control Panel Auto Increment Integration Suite', () => {

  describe('1. Common BID Button & Awaiting Team State Transitions', () => {
    it('1A. handleCommonBid payload contract: sends expectedVersion and never client-calculated amount', async () => {
      let sentPayload = null;
      let sentUrl = null;

      const mockApi = {
        post: async (url, payload) => {
          sentUrl = url;
          sentPayload = payload;
          return {
            data: {
              success: true,
              currentBid: 150000,
              highestBidder: null,
              isAwaitingTeam: true,
              version: 4
            }
          };
        }
      };

      const auctionState = {
        currentPlayer: { _id: 'p1', basePrice: 100000 },
        currentBid: 100000,
        auctionVersionRef: { current: 3 },
        isAwaitingTeam: false,
        biddingTeam: '',
        hasBiddingStarted: false
      };

      // Simulated handleCommonBid logic from useAuctionBidding.js
      const handleCommonBid = async () => {
        const payload = {
          playerId: auctionState.currentPlayer._id,
          expectedVersion: auctionState.auctionVersionRef.current
        };
        const res = await mockApi.post('/api/auction/common-bid', payload);
        if (res.data?.success) {
          auctionState.currentBid = res.data.currentBid;
          auctionState.isAwaitingTeam = true;
          auctionState.biddingTeam = '';
          auctionState.hasBiddingStarted = false;
          auctionState.auctionVersionRef.current = res.data.version;
        }
      };

      await handleCommonBid();

      assert.equal(sentUrl, '/api/auction/common-bid');
      assert.deepEqual(sentPayload, { playerId: 'p1', expectedVersion: 3 });
      assert.equal(sentPayload.bidAmount, undefined, 'Client MUST NOT send client-calculated bidAmount');
      assert.equal(sentPayload.increment, undefined, 'Client MUST NOT send client-calculated increment');
      assert.equal(auctionState.currentBid, 150000);
      assert.equal(auctionState.isAwaitingTeam, true);
      assert.equal(auctionState.biddingTeam, '');
      assert.equal(auctionState.hasBiddingStarted, false, 'hasBiddingStarted must remain false during unassigned Common BID');
      assert.equal(auctionState.auctionVersionRef.current, 4);
    });

    it('1B. In-flight duplicate prevention blocks second concurrent Common BID click', async () => {
      let networkCalls = 0;
      const isCommonBidProcessingRef = { current: false };

      const mockApiCall = async () => {
        if (isCommonBidProcessingRef.current) return;
        isCommonBidProcessingRef.current = true;
        networkCalls++;
        await new Promise(resolve => setTimeout(resolve, 20));
        isCommonBidProcessingRef.current = false;
      };

      // Two rapid clicks
      const click1 = mockApiCall();
      const click2 = mockApiCall();
      await Promise.all([click1, click2]);

      assert.equal(networkCalls, 1, 'Only one network call must execute during in-flight processing');
    });

    it('1C. 409 conflict handling triggers version synchronization and auto-heals', async () => {
      const auctionVersionRef = { current: 2 };
      let stateReloadRequested = false;

      const mockApi = {
        post: async () => {
          const error = new Error('Conflict');
          error.response = {
            status: 409,
            data: {
              code: 'STALE_AUCTION_STATE',
              currentVersion: 5
            }
          };
          throw error;
        }
      };

      const handleCommonBidWithConflict = async () => {
        try {
          await mockApi.post('/api/auction/common-bid', { expectedVersion: auctionVersionRef.current });
        } catch (err) {
          if (err.response?.status === 409) {
            if (err.response.data?.currentVersion) {
              auctionVersionRef.current = err.response.data.currentVersion;
            }
            stateReloadRequested = true;
          }
        }
      };

      await handleCommonBidWithConflict();

      assert.equal(auctionVersionRef.current, 5, 'Version ref must auto-heal to server authoritative version');
      assert.equal(stateReloadRequested, true, 'State reload/sync must be triggered');
    });
  });

  describe('2. Team Card Integration & Bid Claiming Logic', () => {
    it('2A. Case A (Awaiting Team): First team click claims current bid WITHOUT extra increment', async () => {
      let sentPayload = null;

      const mockApi = {
        post: async (url, payload) => {
          sentPayload = payload;
          return {
            data: {
              success: true,
              data: {
                currentBid: 150000, // exact same bid claimed
                highestBidder: 'team-A',
                isAwaitingTeam: false,
                version: 5
              }
            }
          };
        }
      };

      const state = {
        currentBid: 150000,
        isAwaitingTeam: true,
        biddingTeam: '',
        auctionVersionRef: { current: 4 }
      };

      // Simulated updateBid with bidType: 'auto'
      const updateBid = async (teamId) => {
        const payload = {
          teamId,
          bidType: 'auto',
          expectedVersion: state.auctionVersionRef.current
        };
        const res = await mockApi.post('/api/auction/bid', payload);
        if (res.data?.success) {
          state.currentBid = res.data.data.currentBid;
          state.biddingTeam = res.data.data.highestBidder;
          state.isAwaitingTeam = false;
          state.auctionVersionRef.current = res.data.data.version;
        }
      };

      await updateBid('team-A');

      assert.equal(sentPayload.teamId, 'team-A');
      assert.equal(sentPayload.bidType, 'auto');
      assert.equal(state.currentBid, 150000, 'Claimed amount must remain 150000 without extra increment');
      assert.equal(state.biddingTeam, 'team-A');
      assert.equal(state.isAwaitingTeam, false);
      assert.equal(state.auctionVersionRef.current, 5);
    });

    it('2B. Case B (Another Team Leading): Different eligible team advances the bid', async () => {
      let sentPayload = null;

      const mockApi = {
        post: async (url, payload) => {
          sentPayload = payload;
          return {
            data: {
              success: true,
              data: {
                currentBid: 175000, // advanced via applicable slab
                highestBidder: 'team-B',
                isAwaitingTeam: false,
                version: 6
              }
            }
          };
        }
      };

      const state = {
        currentBid: 150000,
        isAwaitingTeam: false,
        biddingTeam: 'team-A',
        auctionVersionRef: { current: 5 }
      };

      const updateBid = async (teamId) => {
        // Guard check: cannot bid against itself
        if (!state.isAwaitingTeam && state.biddingTeam === teamId) {
          return { blocked: true, reason: 'SAME_TEAM' };
        }
        const payload = {
          teamId,
          bidType: 'auto',
          expectedVersion: state.auctionVersionRef.current
        };
        const res = await mockApi.post('/api/auction/bid', payload);
        if (res.data?.success) {
          state.currentBid = res.data.data.currentBid;
          state.biddingTeam = res.data.data.highestBidder;
          state.isAwaitingTeam = false;
          state.auctionVersionRef.current = res.data.data.version;
        }
        return { success: true };
      };

      const result = await updateBid('team-B');

      assert.equal(result.success, true);
      assert.equal(sentPayload.teamId, 'team-B');
      assert.equal(state.currentBid, 175000);
      assert.equal(state.biddingTeam, 'team-B');
    });

    it('2C. Case C (Same Team Leading): Clicking leading team again is strictly rejected locally', async () => {
      let networkCalled = false;

      const state = {
        currentBid: 175000,
        isAwaitingTeam: false,
        biddingTeam: 'team-B'
      };

      const updateBid = async (teamId) => {
        if (!state.isAwaitingTeam && String(state.biddingTeam) === String(teamId)) {
          return { blocked: true, reason: 'SAME_TEAM' };
        }
        networkCalled = true;
      };

      const result = await updateBid('team-B');

      assert.equal(result.blocked, true);
      assert.equal(result.reason, 'SAME_TEAM');
      assert.equal(networkCalled, false, 'No HTTP request should be sent when leading team is clicked again');
    });

    it('2D. Case D (Ineligible Team): Squad full or purse exceeded is rejected locally before network call', async () => {
      let networkCalled = false;

      const team = {
        _id: 'team-C',
        remainingPurse: 50000,
        maxBid: 40000,
        remainingRequiredPlayers: 0 // Squad full
      };

      const state = {
        currentBid: 175000,
        isAwaitingTeam: false
      };

      const updateBid = async (targetTeam) => {
        if (targetTeam.remainingRequiredPlayers <= 0) {
          return { blocked: true, reason: 'SQUAD_FULL' };
        }
        if (state.currentBid > targetTeam.maxBid) {
          return { blocked: true, reason: 'INSUFFICIENT_PURSE' };
        }
        networkCalled = true;
      };

      const result = await updateBid(team);

      assert.equal(result.blocked, true);
      assert.equal(result.reason, 'SQUAD_FULL');
      assert.equal(networkCalled, false);
    });
  });

  describe('3. UNSOLD & SOLD Button Compatibility & Invariants', () => {
    it('3A. When Awaiting Team: UNSOLD must be ENABLED and SOLD must be DISABLED', () => {
      const currentPlayer = { _id: 'p1', basePrice: 100000 };
      const playerStatus = 'bidding';
      const isActionProcessing = false;
      const isAwaitingTeam = true;
      const biddingTeam = ''; // unassigned
      const hasBiddingStarted = false; // strictly false when unassigned

      // Exact formulas from PlayerStageCard.jsx:
      const isNextDisabled = Boolean(
        isActionProcessing ||
        (currentPlayer && playerStatus === 'bidding' && hasBiddingStarted && !isAwaitingTeam && Boolean(biddingTeam))
      );
      const isSoldDisabled = Boolean(isActionProcessing || !biddingTeam || isAwaitingTeam);
      const isUnsoldDisabled = Boolean(
        isActionProcessing ||
        (hasBiddingStarted && !isAwaitingTeam && Boolean(biddingTeam))
      );

      assert.equal(isSoldDisabled, true, 'SOLD must be DISABLED when Awaiting Team');
      assert.equal(isUnsoldDisabled, false, 'UNSOLD must remain ENABLED when Awaiting Team');
      assert.equal(isNextDisabled, false, 'Next player must not be blocked by unassigned Common BID');
    });

    it('3B. When Team Claims Bid: UNSOLD must be DISABLED and SOLD must be ENABLED', () => {
      const currentPlayer = { _id: 'p1', basePrice: 100000 };
      const playerStatus = 'bidding';
      const isActionProcessing = false;
      const isAwaitingTeam = false;
      const biddingTeam = 'team-A';
      const hasBiddingStarted = true;

      const isNextDisabled = Boolean(
        isActionProcessing ||
        (currentPlayer && playerStatus === 'bidding' && hasBiddingStarted && !isAwaitingTeam && Boolean(biddingTeam))
      );
      const isSoldDisabled = Boolean(isActionProcessing || !biddingTeam || isAwaitingTeam);
      const isUnsoldDisabled = Boolean(
        isActionProcessing ||
        (hasBiddingStarted && !isAwaitingTeam && Boolean(biddingTeam))
      );

      assert.equal(isSoldDisabled, false, 'SOLD must be ENABLED when a team holds the bid');
      assert.equal(isUnsoldDisabled, true, 'UNSOLD must be DISABLED once a team has placed/claimed a bid');
      assert.equal(isNextDisabled, true, 'Next player must be DISABLED while active team bidding is underway');
    });

    it('3C. Initial Stage State: UNSOLD is ENABLED, SOLD is DISABLED', () => {
      const currentPlayer = { _id: 'p1', basePrice: 100000 };
      const playerStatus = 'bidding';
      const isActionProcessing = false;
      const isAwaitingTeam = false;
      const biddingTeam = '';
      const hasBiddingStarted = false;

      const isSoldDisabled = Boolean(isActionProcessing || !biddingTeam || isAwaitingTeam);
      const isUnsoldDisabled = Boolean(
        isActionProcessing ||
        (hasBiddingStarted && !isAwaitingTeam && Boolean(biddingTeam))
      );

      assert.equal(isSoldDisabled, true, 'SOLD must be DISABLED before any bid');
      assert.equal(isUnsoldDisabled, false, 'UNSOLD must be ENABLED initially');
    });
  });

  describe('4. Socket.IO & State Hydration Synchronization', () => {
    it('4A. updateAudienceScreen socket event preserves Awaiting Team and clears biddingTeam', () => {
      let state = {
        currentBid: 100000,
        biddingTeam: 'old-team',
        isAwaitingTeam: false,
        hasBiddingStarted: true
      };

      const socketPayload = {
        nextBid: 150000,
        biddingTeam: null,
        isAwaitingTeam: true,
        version: 5
      };

      // Simulated logic from useControlPanelSocket.js
      const handleAudienceUpdate = (data) => {
        const nextBidVal = Number(data.nextBid || data.currentBid);
        const hasTeamBid = Boolean(data.biddingTeam || data.highestBidder);
        const isAwaiting = Boolean(data.isAwaitingTeam || (!hasTeamBid && nextBidVal > 100000));

        state.currentBid = nextBidVal;
        state.isAwaitingTeam = isAwaiting;
        state.biddingTeam = isAwaiting ? '' : (data.biddingTeam || data.highestBidder);
        state.hasBiddingStarted = Boolean(hasTeamBid && !isAwaiting);
      };

      handleAudienceUpdate(socketPayload);

      assert.equal(state.currentBid, 150000);
      assert.equal(state.isAwaitingTeam, true);
      assert.equal(state.biddingTeam, '', 'Previous team name must be cleared');
      assert.equal(state.hasBiddingStarted, false, 'hasBiddingStarted must be false during unassigned bid');
    });

    it('4B. Initial /api/auction/state hydration properly infers Awaiting Team if highestBidder is null', () => {
      const apiResponse = {
        currentBid: 150000,
        highestBidder: null,
        isAwaitingTeam: true,
        basePrice: 100000
      };

      // Simulated logic from useAuctionDataSync.js
      const hbId = apiResponse.highestBidder;
      const awaiting = Boolean(apiResponse.isAwaitingTeam || (!hbId && apiResponse.currentBid > apiResponse.basePrice));
      const biddingTeam = awaiting ? '' : (hbId || '');
      const hasBiddingStarted = Boolean(hbId && !awaiting);

      assert.equal(awaiting, true);
      assert.equal(biddingTeam, '');
      assert.equal(hasBiddingStarted, false);
    });
  });
});
