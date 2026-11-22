const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_for_common_bid_claim_suite';
}

const { getJwtSecret } = require('../utils/sessionAuth');
const auctionService = require('../services/auctionService');
const Tournament = require('../models/Tournament');
const Player = require('../models/Player');
const Team = require('../models/Team');
const UserSession = require('../models/UserSession');
const AuctionState = require('../models/AuctionState');
const { calculateAutoIncrement, getEffectiveAutoIncrementSlabs } = require('../utils/autoIncrement');
const { isBiddingActive, setBiddingActive, clearBiddingState } = require('../utils/biddingState');

describe('Phase 3: Backend Common BID & Bid Claiming Logic Test Suite', () => {
  const organizerId = new mongoose.Types.ObjectId().toString();
  const tournamentId = new mongoose.Types.ObjectId().toString();
  const playerId = new mongoose.Types.ObjectId().toString();
  const team1Id = new mongoose.Types.ObjectId().toString();
  const team2Id = new mongoose.Types.ObjectId().toString();

  const teamPurse = 50000000; // 500 Lakhs = 5 Crores
  const basePrice = 2000000; // 20 Lakhs (4% of purse -> falls in 0%-10% slab, 1% increment = 500,000)

  // Save original model methods
  const origAuctionStateFindOne = AuctionState.findOne;
  const origAuctionStateFindOneAndUpdate = AuctionState.findOneAndUpdate;
  const origAuctionStateFindById = AuctionState.findById;
  const origTournamentFindOne = Tournament.findOne;
  const origTournamentFind = Tournament.find;
  const origTournamentCountDocuments = Tournament.countDocuments;
  const origPlayerFindOne = Player.findOne;
  const origPlayerFind = Player.find;
  const origPlayerAggregate = Player.aggregate;
  const origTeamFindOne = Team.findOne;
  const origTeamFind = Team.find;
  const origUserSessionFindOne = UserSession.findOne;

  let mockAuctionState;
  let mockTournament;
  let mockPlayer;
  let mockTeam1;
  let mockTeam2;

  beforeEach(() => {
    clearBiddingState();
    setBiddingActive(organizerId, true);

    mockTournament = {
      _id: new mongoose.Types.ObjectId(tournamentId),
      organizer: new mongoose.Types.ObjectId(organizerId),
      tournamentName: 'Test Premier League',
      teamBudget: teamPurse,
      minPlayersPerTeam: 15,
      autoIncrementSlabs: [
        { minBidPercent: 0, maxBidPercent: 10, incrementPercent: 1 },
        { minBidPercent: 10, maxBidPercent: 25, incrementPercent: 1.5 },
        { minBidPercent: 25, maxBidPercent: 50, incrementPercent: 2 },
        { minBidPercent: 50, maxBidPercent: 75, incrementPercent: 3 },
        { minBidPercent: 75, maxBidPercent: 100, incrementPercent: 4 }
      ]
    };

    mockPlayer = {
      _id: new mongoose.Types.ObjectId(playerId),
      name: 'Star Batsman',
      organizer: new mongoose.Types.ObjectId(organizerId),
      tournament: new mongoose.Types.ObjectId(tournamentId),
      basePrice: basePrice,
      approvalStatus: 'Approved',
      auctionStatus: 'ReadyForAuction'
    };

    mockTeam1 = {
      _id: new mongoose.Types.ObjectId(team1Id),
      teamName: 'Team Alpha',
      shortName: 'ALP',
      organizer: new mongoose.Types.ObjectId(organizerId),
      tournament: new mongoose.Types.ObjectId(tournamentId),
      totalPurse: teamPurse,
      remainingPurse: 45000000,
      minPlayersPerTeam: 15,
      remoteAccessEnabled: true
    };

    mockTeam2 = {
      _id: new mongoose.Types.ObjectId(team2Id),
      teamName: 'Team Beta',
      shortName: 'BET',
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
      currentBid: basePrice,
      highestBidder: null,
      isAwaitingTeam: false,
      status: 'bidding',
      version: 1
    };

    // Default mock setup for Mongoose models
    AuctionState.findOne = (query) => ({
      lean: async () => (mockAuctionState ? { ...mockAuctionState } : null)
    });

    AuctionState.findById = (id) => ({
      select: () => ({
        lean: async () => (mockAuctionState ? { ...mockAuctionState } : null)
      }),
      lean: async () => (mockAuctionState ? { ...mockAuctionState } : null)
    });

    AuctionState.findOneAndUpdate = (filter, update, options) => {
      // Check concurrency filter
      if (filter.version !== undefined && mockAuctionState.version !== filter.version) {
        return { lean: async () => null };
      }
      if (filter.currentBid !== undefined && mockAuctionState.currentBid !== filter.currentBid) {
        return { lean: async () => null };
      }
      if (filter.highestBidder === null && mockAuctionState.highestBidder !== null) {
        return { lean: async () => null };
      }
      if (filter.highestBidder && String(mockAuctionState.highestBidder) !== String(filter.highestBidder)) {
        return { lean: async () => null };
      }

      // Apply update
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
      session: async () => [] // no sold players yet
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
      const idStr = String(targetId || '');
      let found = null;
      if (idStr === String(mockTeam1._id)) found = mockTeam1;
      else if (idStr === String(mockTeam2._id)) found = mockTeam2;
      const doc = found ? { ...found } : null;
      return {
        ...doc,
        lean: async () => doc,
        then: (resolve) => resolve(doc)
      };
    };

    Team.find = () => ({
      lean: async () => [{ ...mockTeam1 }, { ...mockTeam2 }]
    });

    Tournament.find = () => ({
      select: () => ({
        limit: () => ({
          lean: async () => [{ _id: mockTournament._id }]
        }),
        lean: async () => [{ _id: mockTournament._id }]
      }),
      limit: () => ({
        lean: async () => [{ _id: mockTournament._id }]
      }),
      lean: async () => [{ _id: mockTournament._id }]
    });

    Tournament.countDocuments = async () => 1;

    UserSession.findOne = (query) => {
      const isTeam = query?.sessionRole === 'TeamOwner';
      const doc = {
        _id: query?._id || new mongoose.Types.ObjectId(),
        user: isTeam ? null : new mongoose.Types.ObjectId(organizerId),
        team: isTeam ? new mongoose.Types.ObjectId(team1Id) : null,
        organizer: new mongoose.Types.ObjectId(organizerId),
        tournament: new mongoose.Types.ObjectId(tournamentId),
        sessionRole: isTeam ? 'TeamOwner' : 'User',
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: null
      };
      return {
        lean: async () => doc,
        then: (resolve) => resolve(doc)
      };
    };
  });

  afterEach(() => {
    AuctionState.findOne = origAuctionStateFindOne;
    AuctionState.findOneAndUpdate = origAuctionStateFindOneAndUpdate;
    AuctionState.findById = origAuctionStateFindById;
    Tournament.findOne = origTournamentFindOne;
    Tournament.find = origTournamentFind;
    Tournament.countDocuments = origTournamentCountDocuments;
    Player.findOne = origPlayerFindOne;
    Player.find = origPlayerFind;
    Player.aggregate = origPlayerAggregate;
    Team.findOne = origTeamFindOne;
    Team.find = origTeamFind;
    UserSession.findOne = origUserSessionFindOne;
  });

  // =========================================================================
  // Requirement 1: Common BID Operation
  // =========================================================================
  describe('1. Common BID Operation (Organizer Only)', () => {
    test('1A. Common BID increases amount using the correct percentage slab and tournament Team Purse', async () => {
      // Current bid = 2,000,000 (4% of 50,000,000). Falls in 0-10% slab (1% increment = 500,000).
      const result = await auctionService.placeCommonBid({
        organizerId,
        tournamentScope: { tournamentId },
        playerId,
        expectedVersion: 1
      });

      assert.equal(result.state.currentBid, 2500000);
      assert.equal(result.incrementAmount, 500000);
      assert.equal(result.isAwaitingTeam, true);
    });

    test('1B. Common BID sets highestBidder: null and isAwaitingTeam: true', async () => {
      // First, suppose Team 1 was highest bidder
      mockAuctionState.highestBidder = mockTeam1._id;
      mockAuctionState.currentBid = 3000000;
      mockAuctionState.version = 2;

      const result = await auctionService.placeCommonBid({
        organizerId,
        tournamentScope: { tournamentId },
        playerId,
        expectedVersion: 2
      });

      assert.equal(result.state.highestBidder, null);
      assert.equal(result.state.isAwaitingTeam, true);
      assert.equal(result.state.version, 3);
      // Slab: 3,000,000 is 6% of 50M -> 1% increment = 500,000 -> next bid = 3,500,000
      assert.equal(result.state.currentBid, 3500000);
    });

    test('1C. Common BID advances through higher percentage slabs proportionally', async () => {
      // Set current bid to 15,000,000 (30% of 50M).
      // Falls in Slab 3 (Above 25%-50% -> 2% increment = 1,000,000)
      mockAuctionState.currentBid = 15000000;
      mockAuctionState.version = 5;

      const result = await auctionService.placeCommonBid({
        organizerId,
        tournamentScope: { tournamentId },
        playerId,
        expectedVersion: 5
      });

      assert.equal(result.incrementAmount, 1000000); // 2% of 50M
      assert.equal(result.state.currentBid, 16000000);
    });

    test('1D. Common BID rejects action if no eligible team can afford the resulting bid', async () => {
      // Set team purses below the next bid
      mockTeam1.remainingPurse = 1000000;
      mockTeam2.remainingPurse = 1000000;

      await assert.rejects(
        async () => {
          await auctionService.placeCommonBid({
            organizerId,
            tournamentScope: { tournamentId },
            playerId,
            expectedVersion: 1
          });
        },
        (err) => {
          assert.equal(err.message, 'NO_ELIGIBLE_TEAMS');
          assert.equal(err.statusCode, 409);
          assert.match(err.publicMessage, /exceeds maximum affordable bid/);
          return true;
        }
      );
      // State should not have changed
      assert.equal(mockAuctionState.currentBid, basePrice);
      assert.equal(mockAuctionState.version, 1);
    });

    test('1E. Common BID rejects action if all teams have full squads', async () => {
      // Simulate teams having full squads: owned 15 of 15 players
      Player.aggregate = () => ({
        session: async () => [
          { _id: mockTeam1._id, count: 15 },
          { _id: mockTeam2._id, count: 15 }
        ]
      });

      await assert.rejects(
        async () => {
          await auctionService.placeCommonBid({
            organizerId,
            tournamentScope: { tournamentId },
            playerId,
            expectedVersion: 1
          });
        },
        (err) => {
          assert.equal(err.message, 'NO_ELIGIBLE_TEAMS');
          return true;
        }
      );
    });

    test('1F. Common BID rejects stale expectedVersion', async () => {
      mockAuctionState.version = 3;
      await assert.rejects(
        async () => {
          await auctionService.placeCommonBid({
            organizerId,
            tournamentScope: { tournamentId },
            playerId,
            expectedVersion: 2 // stale
          });
        },
        (err) => {
          assert.equal(err.message, 'STALE_AUCTION_STATE');
          assert.equal(err.statusCode, 409);
          assert.equal(err.currentVersion, 3);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // Requirement 2: Team Bid Claiming Logic (Case A, B, C, D)
  // =========================================================================
  describe('2. Team Bid Claiming Logic', () => {
    test('2A. Case A (Awaiting Team): First eligible team claims current bid WITHOUT an extra increment', async () => {
      // Place common bid first to reach 2,500,000 awaiting team
      await auctionService.placeCommonBid({
        organizerId,
        tournamentScope: { tournamentId },
        playerId,
        expectedVersion: 1
      });

      assert.equal(mockAuctionState.currentBid, 2500000);
      assert.equal(mockAuctionState.highestBidder, null);
      assert.equal(mockAuctionState.isAwaitingTeam, true);
      assert.equal(mockAuctionState.version, 2);

      // Team 1 claims the unassigned bid
      const claimResult = await auctionService.placeBid({
        organizerId,
        tournamentScope: { tournamentId },
        teamId: team1Id,
        playerId,
        expectedVersion: 2
      });

      // Amount MUST NOT increase
      assert.equal(claimResult.state.currentBid, 2500000);
      assert.equal(String(claimResult.state.highestBidder), String(team1Id));
      assert.equal(claimResult.state.isAwaitingTeam, false);
      assert.equal(claimResult.claimed, true);
      assert.equal(claimResult.state.version, 3);
    });

    test('2B. Case B (Another Team Leading): Different eligible team advances the bid using applicable slab', async () => {
      // Suppose Team 1 currently holds the bid at 2,500,000, version 3
      mockAuctionState.currentBid = 2500000;
      mockAuctionState.highestBidder = mockTeam1._id;
      mockAuctionState.isAwaitingTeam = false;
      mockAuctionState.version = 3;

      // Team 2 bids: 2.5M is 5% of 50M -> 0-10% slab (1% increment = 500,000)
      const bidResult = await auctionService.placeBid({
        organizerId,
        tournamentScope: { tournamentId },
        teamId: team2Id,
        playerId,
        expectedVersion: 3
      });

      // Next bid advances by 500,000 -> 3,000,000
      assert.equal(bidResult.state.currentBid, 3000000);
      assert.equal(String(bidResult.state.highestBidder), String(team2Id));
      assert.equal(bidResult.state.isAwaitingTeam, false);
      assert.equal(bidResult.claimed, false);
      assert.equal(bidResult.state.version, 4);
    });

    test('2C. Case C (Same Team Bids Again): Rejects bid - team cannot bid against itself', async () => {
      // Team 1 is already highest bidder
      mockAuctionState.currentBid = 3000000;
      mockAuctionState.highestBidder = mockTeam1._id;
      mockAuctionState.isAwaitingTeam = false;
      mockAuctionState.version = 4;

      await assert.rejects(
        async () => {
          await auctionService.placeBid({
            organizerId,
            tournamentScope: { tournamentId },
            teamId: team1Id, // same team
            playerId,
            expectedVersion: 4
          });
        },
        (err) => {
          assert.equal(err.message, 'ALREADY_HIGHEST_BIDDER');
          assert.equal(err.statusCode, 409);
          return true;
        }
      );

      // State remains untouched
      assert.equal(mockAuctionState.currentBid, 3000000);
      assert.equal(String(mockAuctionState.highestBidder), String(team1Id));
      assert.equal(mockAuctionState.version, 4);
    });

    test('2D. Case D (Insufficient Max Bid): Rejects when bid exceeds maximum affordable bid', async () => {
      // Team 2 has purse 2,000,000 and needs 14 more players (reserve: 13 * 2,000,000 = 26M -> maxBid 0)
      // Or purse is lower than nextBid
      mockTeam2.remainingPurse = 2400000;
      mockAuctionState.currentBid = 2000000;
      mockAuctionState.highestBidder = mockTeam1._id;
      mockAuctionState.version = 2;

      // Next bid would be 2,500,000, which exceeds Team 2's purse 2,400,000
      await assert.rejects(
        async () => {
          await auctionService.placeBid({
            organizerId,
            tournamentScope: { tournamentId },
            teamId: team2Id,
            playerId,
            expectedVersion: 2
          });
        },
        (err) => {
          assert.equal(err.message, 'BID_LIMIT_EXCEEDED');
          assert.equal(err.statusCode, 409);
          return true;
        }
      );
    });

    test('2E. Case D (Squad Full): Rejects when team squad is full', async () => {
      // Team 2 has 15 owned players
      Player.aggregate = () => ({
        session: async () => [
          { _id: mockTeam2._id, count: 15 }
        ]
      });

      mockAuctionState.currentBid = 2000000;
      mockAuctionState.highestBidder = mockTeam1._id;
      mockAuctionState.version = 2;

      await assert.rejects(
        async () => {
          await auctionService.placeBid({
            organizerId,
            tournamentScope: { tournamentId },
            teamId: team2Id,
            playerId,
            expectedVersion: 2
          });
        },
        (err) => {
          assert.equal(err.message, 'SQUAD_FULL');
          assert.equal(err.statusCode, 409);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // Requirement 3: Concurrency and Race Condition Integrity
  // =========================================================================
  describe('3. Concurrency & Stale State Protection', () => {
    test('3A. Two simultaneous claims on unassigned bid: one wins, losing request receives BID_CONFLICT (409)', async () => {
      // Prepare state at Awaiting Team: currentBid = 2,500,000, highestBidder: null, version: 2
      mockAuctionState.currentBid = 2500000;
      mockAuctionState.highestBidder = null;
      mockAuctionState.isAwaitingTeam = true;
      mockAuctionState.version = 2;

      // Simulate atomic execution: Team 1 executes first
      const claim1 = await auctionService.placeBid({
        organizerId,
        tournamentScope: { tournamentId },
        teamId: team1Id,
        playerId,
        expectedVersion: 2
      });
      assert.equal(claim1.state.version, 3);
      assert.equal(String(claim1.state.highestBidder), String(team1Id));

      // Now Team 2's simultaneous request arrives with expectedVersion 2
      await assert.rejects(
        async () => {
          await auctionService.placeBid({
            organizerId,
            tournamentScope: { tournamentId },
            teamId: team2Id,
            playerId,
            expectedVersion: 2 // stale version from simultaneous submission
          });
        },
        (err) => {
          assert.equal(err.message, 'STALE_AUCTION_STATE');
          assert.equal(err.statusCode, 409);
          assert.equal(err.currentVersion, 3);
          return true;
        }
      );
    });

    test('3B. Simultaneous atomic findOneAndUpdate race: second update returns null filter match -> BID_CONFLICT', async () => {
      // State at version 2
      mockAuctionState.currentBid = 2500000;
      mockAuctionState.highestBidder = null;
      mockAuctionState.isAwaitingTeam = true;
      mockAuctionState.version = 2;

      // Force findOneAndUpdate to return null to simulate another transaction winning the atomic commit
      AuctionState.findOneAndUpdate = () => ({ lean: async () => null });

      await assert.rejects(
        async () => {
          await auctionService.placeBid({
            organizerId,
            tournamentScope: { tournamentId },
            teamId: team1Id,
            playerId
          });
        },
        (err) => {
          assert.equal(err.message, 'BID_CONFLICT');
          assert.equal(err.statusCode, 409);
          assert.match(err.publicMessage, /Another bid was accepted first/);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // Requirement 4: State Payload & Helper Consistency
  // =========================================================================
  describe('4. Auction State Representation & Fallbacks', () => {
    test('4A. getStatePayload reflects isAwaitingTeam: true when highestBidder is null and currentBid > basePrice', async () => {
      AuctionState.findOne = () => ({
        populate: () => ({
          populate: () => ({
            lean: async () => ({
              organizer: organizerId,
              tournament: tournamentId,
              activePlayer: { _id: playerId, basePrice: 2000000 },
              currentBid: 2500000,
              highestBidder: null,
              isAwaitingTeam: false // even if flag not yet persisted, dynamic check detects it
            })
          })
        })
      });

      const payload = await auctionService.getStatePayload({
        organizerId,
        tournamentScope: { tournamentId }
      });

      assert.equal(payload.isAwaitingTeam, true);
    });

    test('4B. getStatePayload reflects isAwaitingTeam: false when a team holds the bid', async () => {
      AuctionState.findOne = () => ({
        populate: () => ({
          populate: () => ({
            lean: async () => ({
              organizer: organizerId,
              tournament: tournamentId,
              activePlayer: { _id: playerId, basePrice: 2000000 },
              currentBid: 2500000,
              highestBidder: { _id: team1Id, teamName: 'Team Alpha' },
              isAwaitingTeam: false
            })
          })
        })
      });

      const payload = await auctionService.getStatePayload({
        organizerId,
        tournamentScope: { tournamentId }
      });

      assert.equal(payload.isAwaitingTeam, false);
    });

    test('4C. resetAuctionBid clears isAwaitingTeam and resets bid to base price', async () => {
      mockAuctionState.currentBid = 3500000;
      mockAuctionState.highestBidder = mockTeam1._id;
      mockAuctionState.isAwaitingTeam = true;
      mockAuctionState.version = 5;

      const resetResult = await auctionService.resetAuctionBid({
        organizerId,
        tournamentScope: { tournamentId },
        playerId,
        expectedVersion: 5
      });

      assert.equal(resetResult.state.currentBid, basePrice);
      assert.equal(resetResult.state.highestBidder, null);
      assert.equal(resetResult.state.isAwaitingTeam, false);
      assert.equal(resetResult.state.version, 6);
    });
  });

  // =========================================================================
  // Requirement 5: Express Route Endpoints & Socket Events
  // =========================================================================
  describe('5. Express Route Endpoints & Socket Event Payloads', () => {
    let server;
    let baseUrl;
    let emittedEvents = [];
    const organizerSid = new mongoose.Types.ObjectId().toString();
    const teamOwnerSid = new mongoose.Types.ObjectId().toString();

    const organizerToken = jwt.sign(
      { id: organizerId, role: 'Organizer', sid: organizerSid },
      getJwtSecret(),
      { expiresIn: '1h' }
    );

    const teamOwnerToken = jwt.sign(
      {
        role: 'TeamOwner',
        teamId: team1Id,
        organizerId,
        tournamentId,
        sid: teamOwnerSid
      },
      getJwtSecret(),
      { expiresIn: '1h' }
    );

    before(async () => {
      const app = express();
      app.use(express.json());

      const fakeIo = {
        to: (room1) => ({
          to: (room2) => ({
            emit: (event, payload) => emittedEvents.push({ rooms: [room1, room2], event, payload })
          }),
          emit: (event, payload) => emittedEvents.push({ rooms: [room1], event, payload })
        })
      };
      app.set('io', fakeIo);
      app.use('/api/auction', require('../routes/auction'));

      server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/auction`;
    });

    after(async () => {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    beforeEach(() => {
      emittedEvents = [];
    });

    test('5A. POST /api/auction/common-bid increases bid, sets isAwaitingTeam: true, and emits updateAudienceScreen', async () => {
      mockAuctionState.currentBid = 2000000;
      mockAuctionState.highestBidder = null;
      mockAuctionState.version = 1;

      const res = await fetch(`${baseUrl}/common-bid?tournamentId=${tournamentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${organizerToken}`
        },
        body: JSON.stringify({ playerId, expectedVersion: 1 })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.state.currentBid, 2500000);
      assert.equal(data.state.highestBidder, null);
      assert.equal(data.isAwaitingTeam, true);

      // Verify Socket emit
      const audienceEvent = emittedEvents.find((e) => e.event === 'updateAudienceScreen');
      assert.ok(audienceEvent, 'updateAudienceScreen must be emitted');
      assert.equal(audienceEvent.payload.isAwaitingTeam, true);
      assert.equal(audienceEvent.payload.currentBid, 2500000);
      assert.equal(audienceEvent.payload.teamId, '');
      assert.equal(audienceEvent.payload.teamName, '');
    });

    test('5B. POST /api/auction/common-bid rejects Team Owner caller with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/common-bid?tournamentId=${tournamentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teamOwnerToken}`
        },
        body: JSON.stringify({ playerId })
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.match(data.message, /Only organizer can trigger common bid/);
    });

    test('5C. POST /api/auction/common-bid rejects with 409 when bidding is paused', async () => {
      setBiddingActive(organizerId, false);

      const res = await fetch(`${baseUrl}/common-bid?tournamentId=${tournamentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${organizerToken}`
        },
        body: JSON.stringify({ playerId })
      });

      assert.equal(res.status, 409);
      const data = await res.json();
      assert.equal(data.code, 'BIDDING_PAUSED');
      assert.match(data.message, /currently paused/);
    });

    test('5D. POST /api/auction/bid claims unassigned bid without extra increment and emits isAwaitingTeam: false', async () => {
      // Setup state at Awaiting Team: currentBid = 2500000, highestBidder: null
      mockAuctionState.currentBid = 2500000;
      mockAuctionState.highestBidder = null;
      mockAuctionState.isAwaitingTeam = true;
      mockAuctionState.version = 2;

      const res = await fetch(`${baseUrl}/bid?tournamentId=${tournamentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${organizerToken}`
        },
        body: JSON.stringify({ teamId: team1Id, playerId, expectedVersion: 2, bidType: 'auto' })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.state.currentBid, 2500000); // no extra increment
      assert.equal(String(data.state.highestBidder), String(team1Id));
      assert.equal(data.state.isAwaitingTeam, false);

      const audienceEvent = emittedEvents.find((e) => e.event === 'updateAudienceScreen');
      assert.ok(audienceEvent, 'updateAudienceScreen must be emitted');
      assert.equal(audienceEvent.payload.isAwaitingTeam, false);
      assert.equal(String(audienceEvent.payload.teamId), String(team1Id));
    });

    test('5E. POST /api/auction/reset-bid emits isAwaitingTeam: false', async () => {
      mockAuctionState.currentBid = 2500000;
      mockAuctionState.highestBidder = null;
      mockAuctionState.isAwaitingTeam = true;
      mockAuctionState.version = 3;

      const res = await fetch(`${baseUrl}/reset-bid?tournamentId=${tournamentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${organizerToken}`
        },
        body: JSON.stringify({ playerId, expectedVersion: 3 })
      });

      assert.equal(res.status, 200);
      const audienceEvent = emittedEvents.find((e) => e.event === 'updateAudienceScreen');
      assert.ok(audienceEvent, 'updateAudienceScreen must be emitted');
      assert.equal(audienceEvent.payload.isAwaitingTeam, false);
      assert.equal(audienceEvent.payload.currentBid, basePrice);
    });
  });
});
