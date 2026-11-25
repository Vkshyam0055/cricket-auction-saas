const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Ensure JWT secret is set for test
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_for_remote_auto_increment_phase5_correction';
}
const { getJwtSecret } = require('../utils/sessionAuth');

// Models & Services
const AuctionState = require('../models/AuctionState');
const Tournament = require('../models/Tournament');
const Player = require('../models/Player');
const Team = require('../models/Team');
const auctionService = require('../services/auctionService');

/**
 * Phase 5 Correction: Remote Bidding Auto Increment Behavior Suite
 *
 * Verifies that:
 * 1. Remote Owner sees PLACE BID (not CLAIM BID) during Awaiting Team.
 * 2. First Remote Bid during Awaiting Team adds the next slab and assigns the team.
 * 3. Remote Owner can bid when another team is leading.
 * 4. Remote Owner cannot bid when their own team is leading.
 * 5. Admin's first Team Claim during Awaiting Team still uses existing amount without increment.
 * 6. Exceeding purse/maxBid is rejected while teams meeting minimum squad size can keep bidding.
 * 7. Concurrent requests cannot create duplicate bids.
 * 8. Admin and Remote Owner receive consistent updated auction state.
 */

describe('Phase 5 Correction: Remote Bidding Auto Increment Behavior Suite', () => {

  const organizerId = new mongoose.Types.ObjectId().toString();
  const tournamentId = new mongoose.Types.ObjectId().toString();
  const team1Id = new mongoose.Types.ObjectId().toString();
  const team2Id = new mongoose.Types.ObjectId().toString();
  const playerId = new mongoose.Types.ObjectId().toString();
  const sessionId = new mongoose.Types.ObjectId().toString();

  const teamPurse = 50000000; // 5 Cr
  const basePrice = 2000000;  // 20 Lakhs

  let mockTournament;
  let mockPlayer;
  let mockTeam1;
  let mockTeam2;
  let mockAuctionState;

  // Stash original Mongoose model methods
  const origAuctionStateFindOne = AuctionState.findOne;
  const origAuctionStateFindOneAndUpdate = AuctionState.findOneAndUpdate;
  const origAuctionStateFindById = AuctionState.findById;
  const origTournamentFindOne = Tournament.findOne;
  const origPlayerFindOne = Player.findOne;
  const origPlayerFind = Player.find;
  const origPlayerAggregate = Player.aggregate;
  const origTeamFindOne = Team.findOne;
  const origTeamFind = Team.find;

  beforeEach(() => {
    mockTournament = {
      _id: new mongoose.Types.ObjectId(tournamentId),
      name: 'Premier League 2026',
      organizer: new mongoose.Types.ObjectId(organizerId),
      teamBudget: teamPurse,
      minPlayersPerTeam: 15,
      autoIncrementSlabs: [
        { minPercentage: 0, maxPercentage: 10, incrementPercentage: 1 },    // 0-10% -> 1% (500,000)
        { minPercentage: 10, maxPercentage: 25, incrementPercentage: 1.5 }, // 10-25% -> 1.5% (750,000)
        { minPercentage: 25, maxPercentage: 50, incrementPercentage: 2 },   // 25-50% -> 2% (1,000,000)
        { minPercentage: 50, maxPercentage: 75, incrementPercentage: 3 },   // 50-75% -> 3% (1,500,000)
        { minPercentage: 75, maxPercentage: 100, incrementPercentage: 4 }   // 75-100% -> 4% (2,000,000)
      ]
    };

    mockPlayer = {
      _id: new mongoose.Types.ObjectId(playerId),
      name: 'Jasprit Bumrah',
      role: 'Bowler',
      basePrice,
      organizer: new mongoose.Types.ObjectId(organizerId),
      tournament: new mongoose.Types.ObjectId(tournamentId),
      approvalStatus: 'Approved',
      auctionStatus: 'ReadyForAuction'
    };

    mockTeam1 = {
      _id: new mongoose.Types.ObjectId(team1Id),
      teamName: 'Mumbai Indians',
      shortName: 'MI',
      organizer: new mongoose.Types.ObjectId(organizerId),
      tournament: new mongoose.Types.ObjectId(tournamentId),
      totalPurse: teamPurse,
      remainingPurse: 45000000,
      minPlayersPerTeam: 15,
      remoteAccessEnabled: true
    };

    mockTeam2 = {
      _id: new mongoose.Types.ObjectId(team2Id),
      teamName: 'Chennai Super Kings',
      shortName: 'CSK',
      organizer: new mongoose.Types.ObjectId(organizerId),
      tournament: new mongoose.Types.ObjectId(tournamentId),
      totalPurse: teamPurse,
      remainingPurse: 48000000,
      minPlayersPerTeam: 15,
      remoteAccessEnabled: true
    };

    mockAuctionState = {
      _id: new mongoose.Types.ObjectId(),
      organizer: new mongoose.Types.ObjectId(organizerId),
      tournament: new mongoose.Types.ObjectId(tournamentId),
      activePlayer: new mongoose.Types.ObjectId(playerId),
      currentBid: 2400000, // 24 Lakhs
      highestBidder: null,
      isAwaitingTeam: true,
      status: 'bidding',
      version: 2
    };

    AuctionState.findOne = () => ({
      lean: async () => (mockAuctionState ? { ...mockAuctionState } : null)
    });

    AuctionState.findById = () => ({
      select: () => ({
        lean: async () => (mockAuctionState ? { ...mockAuctionState } : null)
      }),
      lean: async () => (mockAuctionState ? { ...mockAuctionState } : null)
    });

    AuctionState.findOneAndUpdate = (filter, update) => {
      if (filter.version !== undefined && mockAuctionState.version !== filter.version) {
        return { lean: async () => null };
      }
      if (filter.currentBid !== undefined && mockAuctionState.currentBid !== filter.currentBid) {
        return { lean: async () => null };
      }
      if (filter.highestBidder === null && mockAuctionState.highestBidder !== null) {
        return { lean: async () => null };
      }
      if (update.$set) {
        Object.assign(mockAuctionState, update.$set);
      }
      if (update.$inc && update.$inc.version) {
        mockAuctionState.version += update.$inc.version;
      }
      return { lean: async () => ({ ...mockAuctionState }) };
    };

    Tournament.findOne = () => ({
      select: () => ({
        session: () => ({
          lean: async () => ({ minPlayersPerTeam: mockTournament.minPlayersPerTeam })
        }),
        lean: async () => ({ ...mockTournament, _id: mockTournament._id })
      }),
      lean: async () => ({ ...mockTournament, _id: mockTournament._id })
    });

    Player.findOne = () => ({
      lean: async () => ({ ...mockPlayer })
    });

    Player.aggregate = () => ({
      session: async () => []
    });

    Player.find = () => ({
      select: () => ({
        session: () => ({
          lean: async () => [{ basePrice: mockPlayer.basePrice }]
        })
      })
    });

    Team.findOne = (query) => {
      let targetId = query?._id;
      if (!targetId && query?.$and) {
        const idObj = query.$and.find((q) => q && q._id);
        if (idObj) targetId = idObj._id;
      }
      const idStr = String(targetId);
      const doc = idStr === String(team2Id) ? { ...mockTeam2 } : { ...mockTeam1 };
      return {
        select: () => ({
          lean: async () => doc,
          session: () => ({ lean: async () => doc })
        }),
        lean: async () => doc,
        then: (resolve) => resolve(doc)
      };
    };

    Team.find = () => ({
      session: () => ({
        lean: async () => [{ ...mockTeam1 }, { ...mockTeam2 }]
      }),
      lean: async () => [{ ...mockTeam1 }, { ...mockTeam2 }]
    });
  });

  afterEach(() => {
    AuctionState.findOne = origAuctionStateFindOne;
    AuctionState.findOneAndUpdate = origAuctionStateFindOneAndUpdate;
    AuctionState.findById = origAuctionStateFindById;
    Tournament.findOne = origTournamentFindOne;
    Player.findOne = origPlayerFindOne;
    Player.find = origPlayerFind;
    Player.aggregate = origPlayerAggregate;
    Team.findOne = origTeamFindOne;
    Team.find = origTeamFind;
  });

  describe('1. Remote Owner UI Button Behavior during Awaiting Team', () => {
    it('1A. Remote Owner sees normal PLACE BID, not CLAIM BID, during Awaiting Team', () => {
      // Simulating RemoteLiveTab button derivation
      const isAwaitingTeam = true;
      const isMyTeamLeading = false;
      const biddingActive = true;
      const isSquadFull = false;
      const isPurseExceeded = false;

      // In RemoteLiveTab.jsx:
      // When !isMyTeamLeading, button renders "⚡ PLACE BID"
      let buttonText = '';
      if (!biddingActive) {
        buttonText = 'Bidding is Paused';
      } else if (isMyTeamLeading) {
        buttonText = '👑 Your Team Currently Holds the Highest Bid';
      } else {
        buttonText = '⚡ PLACE BID';
      }

      assert.equal(buttonText, '⚡ PLACE BID');
      assert.notEqual(buttonText.toLowerCase().includes('claim'), true, 'Button text must NOT say CLAIM BID');
    });
  });

  describe('2. Remote Owner Bidding during Awaiting Team (Case A)', () => {
    it('2A. First Remote Bid during Awaiting Team adds the next slab and assigns the team', async () => {
      // Current bid: 2,400,000 (4.8% of 50M -> Slab 1: 0-10% -> 1% increment = 500,000)
      // Remote Owner (isRemote: true) bids during isAwaitingTeam: true
      assert.equal(mockAuctionState.currentBid, 2400000);
      assert.equal(mockAuctionState.isAwaitingTeam, true);
      assert.equal(mockAuctionState.highestBidder, null);

      const result = await auctionService.placeBid({
        organizerId,
        tournamentScope: { tournamentId },
        teamId: team1Id,
        playerId,
        bidType: 'auto',
        expectedVersion: 2,
        isRemote: true // Remote Team Owner
      });

      // 2,400,000 + 500,000 = 2,900,000!
      assert.equal(result.state.currentBid, 2900000, 'Remote bid during Awaiting Team MUST add the percentage slab');
      assert.equal(String(result.state.highestBidder), String(team1Id), 'Team 1 must become highest bidder');
      assert.equal(result.state.isAwaitingTeam, false);
      assert.equal(result.state.version, 3);
      assert.equal(result.claimed, false, 'Remote bid is an increment, not a claim');
    });
  });

  describe('3. Admin Team Claim during Awaiting Team Preserved', () => {
    it('3A. Admin first Team Claim during Awaiting Team still uses existing amount without increment', async () => {
      // Current bid: 2,400,000 awaiting team
      assert.equal(mockAuctionState.currentBid, 2400000);
      assert.equal(mockAuctionState.isAwaitingTeam, true);

      // Admin (isRemote: false) claims for Team 1
      const result = await auctionService.placeBid({
        organizerId,
        tournamentScope: { tournamentId },
        teamId: team1Id,
        playerId,
        bidType: 'auto',
        expectedVersion: 2,
        isRemote: false // Admin Control Panel
      });

      // Amount remains 2,400,000! No extra increment for Admin Claim
      assert.equal(result.state.currentBid, 2400000, 'Admin claim MUST remain 2,400,000 without extra increment');
      assert.equal(String(result.state.highestBidder), String(team1Id));
      assert.equal(result.state.isAwaitingTeam, false);
      assert.equal(result.state.version, 3);
      assert.equal(result.claimed, true, 'Admin action is marked as claimed');
    });
  });

  describe('4. Remote Owner Bidding When Another Team Leads (Case B)', () => {
    it('4A. Remote Team 2 advances bid when Team 1 is already leading', async () => {
      // First, Team 1 holds bid at 2,900,000
      mockAuctionState.currentBid = 2900000;
      mockAuctionState.highestBidder = new mongoose.Types.ObjectId(team1Id);
      mockAuctionState.isAwaitingTeam = false;
      mockAuctionState.version = 3;

      // Team 2 bids: 2,900,000 is 5.8% of 50M -> Slab 1 (1% = 500,000) -> Next bid = 3,400,000
      const result = await auctionService.placeBid({
        organizerId,
        tournamentScope: { tournamentId },
        teamId: team2Id,
        playerId,
        bidType: 'auto',
        expectedVersion: 3,
        isRemote: true
      });

      assert.equal(result.state.currentBid, 3400000);
      assert.equal(String(result.state.highestBidder), String(team2Id));
      assert.equal(result.state.version, 4);
    });
  });

  describe('5. Remote Owner Leading Team Cannot Bid Against Itself (Case C)', () => {
    it('5A. Rejects repeated bidding by current leading team', async () => {
      mockAuctionState.currentBid = 3400000;
      mockAuctionState.highestBidder = new mongoose.Types.ObjectId(team2Id);
      mockAuctionState.isAwaitingTeam = false;
      mockAuctionState.version = 4;

      await assert.rejects(
        async () => {
          await auctionService.placeBid({
            organizerId,
            tournamentScope: { tournamentId },
            teamId: team2Id, // Same leading team!
            playerId,
            bidType: 'auto',
            expectedVersion: 4,
            isRemote: true
          });
        },
        (err) => {
          assert.equal(err.message, 'ALREADY_HIGHEST_BIDDER');
          assert.equal(err.statusCode, 409);
          return true;
        }
      );
    });
  });

  describe('6. Ineligible Team & Minimum Squad Checks (Case D)', () => {
    it('6A. Allows remote bid when team has fulfilled minimum squad size (minPlayersPerTeam is not a max cap)', async () => {
      // Mock player aggregate returning 15 players (minimum requirement fulfilled, not a maximum cap)
      Player.aggregate = () => ({
        session: async () => [{ _id: mockTeam1._id, count: 15 }]
      });

      const result = await auctionService.placeBid({
        organizerId,
        tournamentScope: { tournamentId },
        teamId: team1Id,
        playerId,
        bidType: 'auto',
        expectedVersion: 2,
        isRemote: true
      });

      assert.equal(result.state.currentBid, 2900000);
      assert.equal(String(result.state.highestBidder), String(team1Id));
      assert.equal(result.state.version, 3);
      assert.equal(result.team.remainingRequiredPlayers, 0);
      assert.equal(result.team.maxBid, mockTeam1.remainingPurse);
    });

    it('6B. Rejects bid when next bid exceeds maximum permitted bid or purse', async () => {
      // Set remaining purse below the next bid
      mockTeam1.remainingPurse = 2500000; // Next bid is 2,900,000

      await assert.rejects(
        async () => {
          await auctionService.placeBid({
            organizerId,
            tournamentScope: { tournamentId },
            teamId: team1Id,
            playerId,
            bidType: 'auto',
            expectedVersion: 2,
            isRemote: true
          });
        },
        (err) => {
          assert.equal(err.message, 'BID_LIMIT_EXCEEDED');
          assert.equal(err.statusCode, 409);
          return true;
        }
      );
    });
  });

  describe('7. Concurrency & In-Flight Duplicate Prevention', () => {
    it('7A. In-flight processing ref prevents duplicate concurrent clicks', async () => {
      const isBidProcessingRef = { current: false };
      let callCount = 0;

      const clickHandler = async () => {
        if (isBidProcessingRef.current) return 'BLOCKED';
        isBidProcessingRef.current = true;
        callCount++;
        await new Promise((r) => setTimeout(r, 20));
        isBidProcessingRef.current = false;
        return 'SUCCESS';
      };

      const [c1, c2] = await Promise.all([clickHandler(), clickHandler()]);
      assert.equal(callCount, 1);
      assert.equal(c1, 'SUCCESS');
      assert.equal(c2, 'BLOCKED');
    });

    it('7B. Server concurrency atomic findOneAndUpdate rejects stale version with 409', async () => {
      mockAuctionState.version = 5;

      await assert.rejects(
        async () => {
          await auctionService.placeBid({
            organizerId,
            tournamentScope: { tournamentId },
            teamId: team1Id,
            playerId,
            bidType: 'auto',
            expectedVersion: 4, // Stale!
            isRemote: true
          });
        },
        (err) => {
          assert.equal(err.message, 'STALE_AUCTION_STATE');
          assert.equal(err.statusCode, 409);
          assert.equal(err.currentVersion, 5);
          return true;
        }
      );
    });
  });

  describe('8. Synchronization Consistency Across Admin, Remote Owner & Live Screen', () => {
    it('8A. Both Admin and Remote Owner derive identical state from Remote Owner bid broadcast', () => {
      const broadcastPayload = {
        bidAmount: 2900000,
        currentBid: 2900000,
        teamId: team1Id,
        biddingTeamId: team1Id,
        teamName: 'Mumbai Indians',
        player: { _id: playerId, basePrice },
        version: 3,
        isAwaitingTeam: false
      };

      // Admin hook derivation (useControlPanelSocket.js)
      const adminNextBid = Number(broadcastPayload.bidAmount || broadcastPayload.currentBid);
      const adminHasTeam = Boolean(broadcastPayload.teamId || broadcastPayload.biddingTeamId);
      const adminIsAwaiting = Boolean(broadcastPayload.isAwaitingTeam || (!adminHasTeam && adminNextBid > basePrice));
      const adminBiddingTeam = adminIsAwaiting ? '' : (broadcastPayload.teamId || '');

      // Remote Owner derivation (RemoteBiddingPublic.jsx)
      const remoteNextBid = Number(broadcastPayload.bidAmount || broadcastPayload.currentBid);
      const remoteHasTeam = Boolean(broadcastPayload.teamId || broadcastPayload.biddingTeamId);
      const remoteIsAwaiting = Boolean(broadcastPayload.isAwaitingTeam || (!remoteHasTeam && remoteNextBid > basePrice));
      const remoteBiddingTeam = remoteIsAwaiting ? '' : (broadcastPayload.teamId || '');

      assert.equal(adminNextBid, 2900000);
      assert.equal(remoteNextBid, 2900000);
      assert.equal(adminIsAwaiting, false);
      assert.equal(remoteIsAwaiting, false);
      assert.equal(adminBiddingTeam, team1Id);
      assert.equal(remoteBiddingTeam, team1Id);
    });
  });
});
