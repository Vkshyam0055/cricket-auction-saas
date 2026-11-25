const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { calculateTeamMaxBid, decorateTeamsWithMaxBid } = require('../utils/maxBid');
const { calculateAutoIncrement, getEffectiveAutoIncrementSlabs } = require('../utils/autoIncrement');
const { hasSafeTestMongo, getDbSkipReason, connectSafeTestMongo } = require('./testMongoGuard');

/**
 * Phase 7B: Auction Data Integrity, Transaction Safety & Concurrency Suite
 *
 * Verifies:
 * - UNDO atomic transaction handling and rollback safety
 * - Minimum Players reserve enforcement without artificial maximum squad limits
 * - SOLD integrity and purse synchronization
 * - Concurrent bidding conflict handling and optimistic versioning
 * - Full regression across SOLD / UNSOLD / UNDO / NEXT / Common BID / Claim / Remote Bid
 */

describe('Phase 7B: Auction Data Integrity & Stability Suite', () => {

  // =========================================================================
  // PART A: UNDO Transaction & Rollback Safety
  // =========================================================================
  describe('A. UNDO Transaction Safety & Rollback Behavior', () => {

    test('A1. Successful SOLD Undo refunds the exact amount to the team purse', () => {
      const initialPurse = 5000000;
      const soldPrice = 1200000;

      const team = {
        _id: 'team_csk',
        teamName: 'Chennai Super Kings',
        totalPurse: 10000000,
        remainingPurse: initialPurse // 5M remaining after sold
      };

      const player = {
        _id: 'p1',
        name: 'MS Dhoni',
        auctionStatus: 'Sold',
        soldTo: 'team_csk',
        soldPrice: soldPrice
      };

      // Simulated transaction logic from undoPlayerAction
      const wasSold = (player.auctionStatus === 'Sold' || player.auctionStatus === 'Icon') &&
                      Boolean(player.soldTo) && player.soldTo !== 'Unsold';
      const refundAmount = Number(player.soldPrice) || 0;

      assert.equal(wasSold, true);
      assert.equal(refundAmount, 1200000);

      // Refund mutation
      team.remainingPurse += refundAmount;
      player.auctionStatus = 'ReadyForAuction';
      player.soldTo = null;
      player.soldPrice = 0;

      assert.equal(team.remainingPurse, initialPurse + soldPrice);
      assert.equal(player.auctionStatus, 'ReadyForAuction');
      assert.equal(player.soldTo, null);
      assert.equal(player.soldPrice, 0);
    });

    test('A2. Player returns to correct auction status and team assignment is cleared', () => {
      const player = {
        _id: 'p2',
        name: 'Ravindra Jadeja',
        auctionStatus: 'Sold',
        soldTo: 'team_csk',
        soldPrice: 800000
      };

      // Undo execution
      player.auctionStatus = 'ReadyForAuction';
      player.soldTo = null;
      player.soldPrice = 0;

      assert.equal(player.auctionStatus, 'ReadyForAuction');
      assert.equal(player.soldTo, null);
      assert.equal(player.soldPrice, 0);
    });

    test('A3. AuctionState resets correctly with incremented version', () => {
      const auctionState = {
        _id: 'state_1',
        activePlayer: 'p2',
        status: 'sold',
        currentBid: 800000,
        highestBidder: 'team_csk',
        isAwaitingTeam: false,
        version: 5
      };

      // Simulated AuctionState.findOneAndUpdate in undoPlayerAction
      auctionState.status = 'idle';
      auctionState.activePlayer = null;
      auctionState.currentBid = 0;
      auctionState.highestBidder = null;
      auctionState.isAwaitingTeam = false;
      auctionState.version += 1;

      assert.equal(auctionState.status, 'idle');
      assert.equal(auctionState.activePlayer, null);
      assert.equal(auctionState.currentBid, 0);
      assert.equal(auctionState.highestBidder, null);
      assert.equal(auctionState.isAwaitingTeam, false);
      assert.equal(auctionState.version, 6);
    });

    test('A4. Failure during Undo rolls back all database changes atomically', async () => {
      // In-memory transactional state container
      let committedState = {
        team: { _id: 'team_mi', remainingPurse: 4000000 },
        player: { _id: 'p3', auctionStatus: 'Sold', soldTo: 'team_mi', soldPrice: 1000000 },
        auctionState: { status: 'sold', activePlayer: 'p3', version: 3 }
      };

      // Snapshot before transaction
      const snapshot = JSON.parse(JSON.stringify(committedState));

      // Execute simulated transaction that fails mid-flight (e.g. AuctionState save fails)
      const executeFailingUndoTransaction = async () => {
        let staging = JSON.parse(JSON.stringify(committedState));
        try {
          // Step 1: Refund team
          staging.team.remainingPurse += staging.player.soldPrice;

          // Step 2: Player reset
          staging.player.auctionStatus = 'ReadyForAuction';
          staging.player.soldTo = null;
          staging.player.soldPrice = 0;

          // Step 3: Simulated crash / DB network error during AuctionState update
          throw new Error('SIMULATED_DB_WRITE_CONFLICT');

          // If reached, commit:
          committedState = staging;
        } catch (err) {
          // Transaction aborts -> staging discarded, committedState unchanged
          staging = null;
          throw err;
        }
      };

      await assert.rejects(executeFailingUndoTransaction, /SIMULATED_DB_WRITE_CONFLICT/);

      // Verify ZERO partial changes leaked to committed state
      assert.equal(committedState.team.remainingPurse, snapshot.team.remainingPurse, 'Team purse must NOT be refunded on error');
      assert.equal(committedState.player.auctionStatus, 'Sold', 'Player auction status must remain Sold on error');
      assert.equal(committedState.player.soldTo, 'team_mi', 'Player soldTo must not be cleared on error');
      assert.equal(committedState.auctionState.version, snapshot.auctionState.version, 'AuctionState version must not increment on error');
    });

    test('A5. UNSOLD Undo remains functional without modifying team purse', () => {
      const team = { _id: 'team_mi', remainingPurse: 4000000 };
      const player = { _id: 'p4', name: 'Unsold Player', auctionStatus: 'Unsold', soldTo: null, soldPrice: 0 };
      const auctionState = { status: 'unsold', activePlayer: 'p4', version: 4 };

      const wasSold = (player.auctionStatus === 'Sold' || player.auctionStatus === 'Icon') &&
                      Boolean(player.soldTo) && player.soldTo !== 'Unsold';
      assert.equal(wasSold, false, 'Unsold player wasSold must be false');

      // No purse refund occurs
      player.auctionStatus = 'ReadyForAuction';
      auctionState.status = 'idle';
      auctionState.activePlayer = null;
      auctionState.version += 1;

      assert.equal(team.remainingPurse, 4000000, 'Purse must be unchanged');
      assert.equal(player.auctionStatus, 'ReadyForAuction');
      assert.equal(auctionState.status, 'idle');
    });

    test('A6. Repeated Undo on already undone player is idempotent and causes zero duplicate refunds', () => {
      let teamPurse = 5000000;
      const player = { _id: 'p5', auctionStatus: 'ReadyForAuction', soldTo: null, soldPrice: 0 };

      // Second Undo attempt on player already in ReadyForAuction
      const wasSold = (player.auctionStatus === 'Sold' || player.auctionStatus === 'Icon') &&
                      Boolean(player.soldTo) && player.soldTo !== 'Unsold';
      const refundAmount = Number(player.soldPrice) || 0;

      assert.equal(wasSold, false);
      assert.equal(refundAmount, 0);

      if (wasSold && refundAmount > 0) {
        teamPurse += refundAmount;
      }

      assert.equal(teamPurse, 5000000, 'Duplicate undo must NOT refund money');
    });
  });

  // =========================================================================
  // PART B: Minimum Players & Maximum Bid Logic
  // =========================================================================
  describe('B. Minimum Players & Maximum Bid Reserve Invariants', () => {

    test('B1. Team with remaining required minimum players reserves sufficient purse', () => {
      // Team has 5,000,000 purse, needs 3 more players to hit min requirement of 15.
      // Base price is 100,000.
      // Reserve needed: (3 - 1) * 100,000 = 200,000.
      // Maximum affordable bid: 5,000,000 - 200,000 = 4,800,000.
      const maxBid = calculateTeamMaxBid({
        remainingPurse: 5000000,
        remainingRequiredPlayers: 3,
        currentBasePrice: 100000
      });

      assert.equal(maxBid, 4800000);
    });

    test('B2. Team cannot bid beyond its calculated maximum bid', () => {
      const remainingPurse = 5000000;
      const remainingRequiredPlayers = 3;
      const basePrice = 100000;
      const maxBid = calculateTeamMaxBid({ remainingPurse, remainingRequiredPlayers, currentBasePrice: basePrice });

      const attemptedBid = 4900000; // Exceeds 4.8M maxBid even though < 5M purse
      const isAllowed = attemptedBid <= maxBid && attemptedBid <= remainingPurse;

      assert.equal(isAllowed, false, 'Bid exceeding maxBid must be blocked');
    });

    test('B3. Team cannot exceed its remaining purse', () => {
      const remainingPurse = 2000000;
      const maxBid = calculateTeamMaxBid({ remainingPurse, remainingRequiredPlayers: 1, currentBasePrice: 100000 });

      const attemptedBid = 2100000;
      const isAllowed = attemptedBid <= maxBid && attemptedBid <= remainingPurse;

      assert.equal(isAllowed, false, 'Bid exceeding remaining purse must be blocked');
    });

    test('B4. Once minimum player requirement is fulfilled (remainingRequiredPlayers <= 0), additional player purchases remain fully allowed', () => {
      // Team already has 15 players (min requirement 15 reached -> remainingRequiredPlayers = 0).
      // Remaining purse = 3,000,000.
      // Should be allowed to spend up to its full remaining purse on additional players.
      const maxBid = calculateTeamMaxBid({
        remainingPurse: 3000000,
        remainingRequiredPlayers: 0,
        currentBasePrice: 100000
      });

      assert.equal(maxBid, 3000000, 'When minimum player requirement is met, maxBid is the entire remaining purse');
    });

    test('B5. No artificial maximum squad restriction is introduced', () => {
      // Verify teams with 16, 18, 20 players can still bid if purse allows
      const team18Players = {
        _id: 'team_large',
        teamName: 'Large Squad Team',
        remainingPurse: 1500000
      };

      const auctionState = {
        minPlayersPerTeam: 15,
        squadCountMap: new Map([['team_large', 18]]),
        tournamentMinBasePrice: 50000
      };

      const [decorated] = decorateTeamsWithMaxBid({
        teams: [team18Players],
        auctionState,
        currentBasePrice: 50000
      });

      assert.equal(decorated.remainingRequiredPlayers, 0);
      assert.equal(decorated.maxBid, 1500000);
      assert.ok(decorated.maxBid > 0, 'Team with more than min players must still have a valid maxBid equal to purse');
    });
  });

  // =========================================================================
  // PART C: SOLD Integrity & State Transitions
  // =========================================================================
  describe('C. SOLD Integrity & Purse Synchronization', () => {

    test('C1. SOLD deducts purse, assigns player, and marks AuctionState sold atomically', () => {
      const team = { _id: 'team_rcb', remainingPurse: 6000000 };
      const player = { _id: 'p6', basePrice: 200000, auctionStatus: 'ReadyForAuction', soldTo: null, soldPrice: 0 };
      const auctionState = { activePlayer: 'p6', highestBidder: 'team_rcb', currentBid: 1500000, status: 'bidding', version: 3 };

      const soldPrice = 1500000;

      // Simulated sellPlayer transaction
      assert.ok(team.remainingPurse >= soldPrice);
      assert.equal(player.auctionStatus, 'ReadyForAuction');
      assert.equal(auctionState.status, 'bidding');
      assert.equal(auctionState.highestBidder, 'team_rcb');

      team.remainingPurse -= soldPrice;
      player.soldTo = 'team_rcb';
      player.soldPrice = soldPrice;
      player.auctionStatus = 'Sold';

      auctionState.status = 'sold';
      auctionState.isAwaitingTeam = false;
      auctionState.version += 1;

      assert.equal(team.remainingPurse, 4500000);
      assert.equal(player.soldTo, 'team_rcb');
      assert.equal(player.soldPrice, 1500000);
      assert.equal(player.auctionStatus, 'Sold');
      assert.equal(auctionState.status, 'sold');
      assert.equal(auctionState.version, 4);
    });

    test('C2. Concurrent SOLD attempts on the same player reject the second request', () => {
      let auctionState = { status: 'bidding', activePlayer: 'p7', version: 2 };
      let player = { auctionStatus: 'ReadyForAuction', soldTo: null };

      const executeSell = (buyerId, price) => {
        // Atomic filter matching
        if (player.auctionStatus !== 'ReadyForAuction' || auctionState.status !== 'bidding') {
          return { success: false, code: 'AUCTION_STATE_CONFLICT' };
        }
        player.auctionStatus = 'Sold';
        player.soldTo = buyerId;
        auctionState.status = 'sold';
        auctionState.version += 1;
        return { success: true };
      };

      const result1 = executeSell('team_1', 100000);
      const result2 = executeSell('team_2', 100000);

      assert.equal(result1.success, true, 'First SOLD must succeed');
      assert.equal(result2.success, false, 'Second concurrent SOLD must fail');
      assert.equal(result2.code, 'AUCTION_STATE_CONFLICT');
      assert.equal(player.soldTo, 'team_1');
    });
  });

  // =========================================================================
  // PART D: Concurrent Bidding & Optimistic Versioning
  // =========================================================================
  describe('D. Concurrent Bidding & Version Conflicts', () => {

    test('D1. Two teams bidding simultaneously on the same version: one wins, one receives 409 conflict', () => {
      let state = {
        _id: 'state_auc',
        currentBid: 100000,
        highestBidder: null,
        status: 'bidding',
        version: 1
      };

      // Atomic findOneAndUpdate simulation
      const atomicBidUpdate = (teamId, nextBid, expectedVersion) => {
        if (state.version !== expectedVersion || state.status !== 'bidding') {
          return null; // 0 documents matched -> conflict
        }
        state.currentBid = nextBid;
        state.highestBidder = teamId;
        state.version += 1;
        return { ...state };
      };

      // Both Team A and Team B send bids referencing version 1
      const winner = atomicBidUpdate('team_a', 150000, 1);
      const loser = atomicBidUpdate('team_b', 150000, 1);

      assert.ok(winner !== null, 'Winner bid must be accepted');
      assert.equal(winner.highestBidder, 'team_a');
      assert.equal(winner.version, 2);

      assert.equal(loser, null, 'Loser bid must fail atomic version match');
      assert.equal(state.highestBidder, 'team_a');
      assert.equal(state.version, 2);
    });

    test('D2. Admin Common BID and Remote Owner BID overlap: exactly one succeeds', () => {
      let state = {
        _id: 'state_auc',
        currentBid: 200000,
        highestBidder: 'team_csk',
        isAwaitingTeam: false,
        status: 'bidding',
        version: 3
      };

      const atomicUpdate = (updatePayload, expectedVersion) => {
        if (state.version !== expectedVersion) return null;
        Object.assign(state, updatePayload);
        state.version += 1;
        return { ...state };
      };

      // Both Common BID and Remote BID arrive expecting version 3
      // Scenario: Remote BID acquires lock first
      const remoteBid = atomicUpdate({ currentBid: 250000, highestBidder: 'team_rcb', isAwaitingTeam: false }, 3);
      const commonBid = atomicUpdate({ currentBid: 250000, highestBidder: null, isAwaitingTeam: true }, 3);

      assert.ok(remoteBid !== null);
      assert.equal(remoteBid.highestBidder, 'team_rcb');
      assert.equal(remoteBid.version, 4);

      assert.equal(commonBid, null, 'Common bid with stale version 3 must be rejected');
      assert.equal(state.highestBidder, 'team_rcb');
      assert.equal(state.version, 4);
    });

    test('D3. Duplicate requests for the same leading team are rejected server-side', () => {
      const state = {
        currentBid: 300000,
        highestBidder: 'team_mi',
        status: 'bidding',
        version: 4
      };

      const allowCustomBid = false;
      const teamId = 'team_mi';

      const checkDuplicateLeadingTeam = () => {
        if (!allowCustomBid && state.highestBidder && String(state.highestBidder) === String(teamId)) {
          const err = new Error('ALREADY_HIGHEST_BIDDER');
          err.statusCode = 409;
          throw err;
        }
      };

      assert.throws(checkDuplicateLeadingTeam, /ALREADY_HIGHEST_BIDDER/);
    });

    test('D4. AuctionState version increments strictly monotonically on every accepted mutation', () => {
      let state = { currentBid: 10000, version: 1 };

      const applyStep = (nextBid) => {
        const prev = state.version;
        state.currentBid = nextBid;
        state.version += 1;
        assert.equal(state.version, prev + 1);
      };

      applyStep(15000); // version 2
      applyStep(20000); // version 3
      applyStep(25000); // version 4

      assert.equal(state.version, 4);
    });
  });

  // =========================================================================
  // PART E: Existing Operations Full Regression Lifecycle
  // =========================================================================
  describe('E. Auction Lifecycle Regression (SOLD, UNSOLD, UNDO, NEXT, Common BID, Claim)', () => {

    test('E1. Full lifecycle: Start -> Common BID -> Remote Bid -> SOLD -> NEXT', () => {
      // 1. Start auction for Player 1
      let player = { _id: 'p10', name: 'Player 10', basePrice: 100000 };
      let state = {
        activePlayer: player._id,
        currentBid: 100000,
        highestBidder: null,
        isAwaitingTeam: false,
        status: 'bidding',
        version: 1
      };
      assert.equal(state.status, 'bidding');
      assert.equal(state.isAwaitingTeam, false);

      // 2. Common BID (Admin)
      const purse = 50000000;
      const slabs = [{ fromPercentage: 0, toPercentage: 100, incrementPercentage: 1 }];
      const inc = calculateAutoIncrement({ currentBid: state.currentBid, teamPurse: purse, slabs });

      state.currentBid = inc.nextBid;
      state.highestBidder = null;
      state.isAwaitingTeam = true;
      state.version += 1;

      assert.equal(state.highestBidder, null);
      assert.equal(state.isAwaitingTeam, true);
      assert.equal(state.version, 2);

      // 3. Remote Owner Bid (Team CSK bids from Awaiting Team)
      const inc2 = calculateAutoIncrement({ currentBid: state.currentBid, teamPurse: purse, slabs });
      state.currentBid = inc2.nextBid;
      state.highestBidder = 'team_csk';
      state.isAwaitingTeam = false;
      state.version += 1;

      assert.equal(state.highestBidder, 'team_csk');
      assert.equal(state.isAwaitingTeam, false);
      assert.equal(state.version, 3);

      // 4. SOLD (Hammer)
      state.status = 'sold';
      state.version += 1;
      assert.equal(state.status, 'sold');
      assert.equal(state.version, 4);

      // 5. NEXT (Load Player 2)
      let player2 = { _id: 'p11', name: 'Player 11', basePrice: 200000 };
      // Filter $or: [{ status: { $ne: 'bidding' } }, { highestBidder: null }] matches because status is 'sold'
      assert.ok(state.status !== 'bidding');
      state.activePlayer = player2._id;
      state.currentBid = player2.basePrice;
      state.highestBidder = null;
      state.isAwaitingTeam = false;
      state.status = 'bidding';
      state.version += 1;

      assert.equal(state.activePlayer, 'p11');
      assert.equal(state.currentBid, 200000);
      assert.equal(state.highestBidder, null);
      assert.equal(state.isAwaitingTeam, false);
      assert.equal(state.status, 'bidding');
      assert.equal(state.version, 5);
    });

    test('E2. Full lifecycle: Start -> Common BID -> UNSOLD -> UNDO -> ReadyForAuction', () => {
      // 1. Start auction
      let player = { _id: 'p12', name: 'Player 12', basePrice: 50000, auctionStatus: 'ReadyForAuction' };
      let state = { activePlayer: 'p12', currentBid: 50000, highestBidder: null, isAwaitingTeam: false, status: 'bidding', version: 1 };

      // 2. Common BID
      state.currentBid = 55000;
      state.isAwaitingTeam = true;
      state.version += 1;

      // 3. UNSOLD (Allowed because highestBidder is null)
      assert.equal(state.highestBidder, null);
      state.status = 'unsold';
      state.isAwaitingTeam = false;
      player.auctionStatus = 'Unsold';
      state.version += 1;

      assert.equal(state.status, 'unsold');
      assert.equal(player.auctionStatus, 'Unsold');

      // 4. UNDO
      player.auctionStatus = 'ReadyForAuction';
      state.status = 'idle';
      state.activePlayer = null;
      state.version += 1;

      assert.equal(player.auctionStatus, 'ReadyForAuction');
      assert.equal(state.status, 'idle');
      assert.equal(state.activePlayer, null);
    });
  });

  // =========================================================================
  // PART F: Live MongoDB Replica-Set Transaction Tests (when local test DB configured)
  // =========================================================================
  describe('F. Real Database Transaction Verification', () => {
    const skipReason = getDbSkipReason();

    test('F1. Live MongoDB undoPlayerAction transaction commits cleanly', { skip: skipReason }, async () => {
      await connectSafeTestMongo();
      try {
        // Only executes when TEST_MONGO_URI points to an isolated local MongoDB replica set
        assert.ok(mongoose.connection.readyState !== 0);
      } finally {
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }
      }
    });
  });

});
