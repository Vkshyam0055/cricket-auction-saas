const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { io: ioClient } = require('../../Frontend/node_modules/socket.io-client');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_for_realtime_sync_regression';
}

const { getJwtSecret } = require('../utils/sessionAuth');
const { isBiddingActive, setBiddingActive, clearBiddingState } = require('../utils/biddingState');
const { initAuctionSockets } = require('../socket/auctionSocketHandler');
const auctionService = require('../services/auctionService');
const playerAuctionService = require('../services/playerAuctionService');
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Player = require('../models/Player');
const AuctionState = require('../models/AuctionState');
const { getDbSkipReason, connectSafeTestMongo } = require('./testMongoGuard');

const waitForSocketConnect = (client) => new Promise((resolve, reject) => {
  if (client.connected) return resolve();
  const timer = setTimeout(() => reject(new Error('Socket connect timeout')), 4000);
  client.once('connect', () => {
    clearTimeout(timer);
    resolve();
  });
  client.once('connect_error', (err) => {
    clearTimeout(timer);
    reject(err);
  });
});

const waitMs = (ms = 80) => new Promise((r) => setTimeout(r, ms));

const waitForEventCount = async (arr, expectedLen, timeoutMs = 2500) => {
  const start = Date.now();
  while (arr.length < expectedLen) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${expectedLen} events (got ${arr.length})`);
    }
    await waitMs(25);
  }
};

describe('Critical Real-Time Synchronization Regression Suite (HTTP + Socket.IO)', () => {
  describe('A. Express Routes + Socket.IO Room Broadcasts & Failure Guards', () => {
    const orgAId = new mongoose.Types.ObjectId().toString();
    const orgBId = new mongoose.Types.ObjectId().toString();
    const tournamentAId = new mongoose.Types.ObjectId().toString();
    const tournamentBId = new mongoose.Types.ObjectId().toString();
    const teamA1Id = new mongoose.Types.ObjectId().toString();
    const player1Id = new mongoose.Types.ObjectId().toString();
    const player2Id = new mongoose.Types.ObjectId().toString();
    const sidOrgA = new mongoose.Types.ObjectId().toString();
    const sidOrgB = new mongoose.Types.ObjectId().toString();
    const sidTeamA1 = new mongoose.Types.ObjectId().toString();

    const orgAToken = jwt.sign({ id: orgAId, role: 'Organizer', sid: sidOrgA }, getJwtSecret(), { expiresIn: '1h' });
    const orgBToken = jwt.sign({ id: orgBId, role: 'Organizer', sid: sidOrgB }, getJwtSecret(), { expiresIn: '1h' });
    const teamA1Token = jwt.sign(
      { role: 'TeamOwner', teamId: teamA1Id, organizerId: orgAId, tournamentId: tournamentAId, sid: sidTeamA1 },
      getJwtSecret(),
      { expiresIn: '1h' }
    );

    const orig = {
      UserSessionFindOne: UserSession.findOne,
      TeamFindOne: Team.findOne,
      TournamentFind: Tournament.find,
      TournamentFindOne: Tournament.findOne,
      TournamentCountDocuments: Tournament.countDocuments,
      AuctionStateFindOne: AuctionState.findOne,
      startAuction: auctionService.startAuction,
      placeBid: auctionService.placeBid,
      placeCommonBid: auctionService.placeCommonBid,
      resetAuctionBid: auctionService.resetAuctionBid,
      restoreAuctionState: auctionService.restoreAuctionState,
      sellPlayer: playerAuctionService.sellPlayer,
      unsoldPlayer: playerAuctionService.unsoldPlayer,
      undoPlayerAction: playerAuctionService.undoPlayerAction,
      resetAuction: playerAuctionService.resetAuction
    };

    let server;
    let baseUrl;
    let adminClient;
    let liveClient;
    let remoteClient;
    let tournamentBClient;

    let auctionEvents = [];
    let failNextStart = false;
    let failNextSell = false;
    let failNextUnsold = false;
    let failNextRestore = false;
    let undoReturnsNullState = false;
    let currentMockState = null;

    const player1 = { _id: player1Id, name: 'R. Sharma', role: 'Batsman', basePrice: 1000, auctionStatus: 'ReadyForAuction' };
    const player2 = { _id: player2Id, name: 'V. Kohli', role: 'Batsman', basePrice: 2000, auctionStatus: 'ReadyForAuction' };
    const teamA1 = { _id: teamA1Id, teamName: 'Mumbai Challengers', shortName: 'MC', logoUrl: 'mc.png', remainingPurse: 45000 };

    before(async () => {
      UserSession.findOne = (query) => {
        const qId = String(query?._id || '');
        let doc = null;
        if (qId === sidOrgA) {
          doc = { _id: sidOrgA, user: orgAId, sessionRole: 'User', expiresAt: new Date(Date.now() + 3600000), revokedAt: null };
        } else if (qId === sidOrgB) {
          doc = { _id: sidOrgB, user: orgBId, sessionRole: 'User', expiresAt: new Date(Date.now() + 3600000), revokedAt: null };
        } else if (qId === sidTeamA1) {
          doc = { _id: sidTeamA1, team: teamA1Id, organizer: orgAId, tournament: tournamentAId, sessionRole: 'TeamOwner', expiresAt: new Date(Date.now() + 3600000), revokedAt: null };
        }
        return {
          lean: async () => doc,
          then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject)
        };
      };

      Team.findOne = (query) => {
        const doc = String(query?._id || '') === teamA1Id
          ? { _id: teamA1Id, organizer: orgAId, tournament: tournamentAId, remoteAccessEnabled: true, teamName: teamA1.teamName, shortName: teamA1.shortName }
          : null;
        return {
          lean: async () => doc,
          then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject)
        };
      };

      const makeChain = (result) => {
        const chain = {
          select: () => chain,
          sort: () => chain,
          limit: () => chain,
          lean: async () => result,
          then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
        };
        return chain;
      };

      Tournament.find = (query) => {
        const org = String(query?.organizer || '');
        const list = org === orgBId ? [{ _id: tournamentBId }] : [{ _id: tournamentAId }];
        return makeChain(list);
      };

      Tournament.findOne = (query) => {
        const tId = String(query?._id || '');
        const org = String(query?.organizer || '');
        let doc = null;
        if (org === orgBId || tId === tournamentBId) {
          doc = { _id: tournamentBId, organizer: orgBId, name: 'Tournament B' };
        } else if (org === orgAId || tId === tournamentAId || !tId) {
          doc = { _id: tournamentAId, organizer: orgAId, name: 'Tournament A' };
        }
        return makeChain(doc);
      };

      Tournament.countDocuments = async () => 1;

      AuctionState.findOne = (query) => {
        const match = String(query?.tournament || '') === tournamentAId ? currentMockState : null;
        return {
          select: () => ({ lean: async () => match }),
          lean: async () => match,
          then: (resolve, reject) => Promise.resolve(match).then(resolve, reject)
        };
      };

      let mockVersion = 1;
      auctionService.startAuction = async ({ playerId }) => {
        if (failNextStart) {
          const err = new Error('BIDDING_IN_PROGRESS');
          err.statusCode = 409;
          err.publicMessage = 'Bidding has already started for this player.';
          throw err;
        }
        const selected = String(playerId) === player2Id ? player2 : player1;
        mockVersion += 1;
        currentMockState = {
          _id: new mongoose.Types.ObjectId(),
          organizer: orgAId,
          tournament: tournamentAId,
          activePlayer: selected._id,
          currentBid: selected.basePrice,
          highestBidder: null,
          isAwaitingTeam: false,
          status: 'bidding',
          version: mockVersion
        };
        return { player: selected, state: currentMockState };
      };

      auctionService.placeCommonBid = async () => {
        mockVersion += 1;
        currentMockState = {
          ...currentMockState,
          currentBid: Number(currentMockState.currentBid) + 500,
          highestBidder: null,
          isAwaitingTeam: true,
          status: 'bidding',
          version: mockVersion
        };
        return { state: currentMockState, player: player2 };
      };

      auctionService.placeBid = async () => {
        mockVersion += 1;
        currentMockState = {
          ...currentMockState,
          currentBid: Number(currentMockState.currentBid) + 500,
          highestBidder: teamA1._id,
          isAwaitingTeam: false,
          status: 'bidding',
          version: mockVersion
        };
        return { state: currentMockState, team: teamA1, player: player2, claimed: true };
      };

      auctionService.restoreAuctionState = async ({ playerId, bidAmount, teamId, status, isAwaitingTeam, expectedVersion }) => {
        if (failNextRestore) {
          const err = new Error('STALE_AUCTION_STATE');
          err.statusCode = 409;
          err.publicMessage = 'Auction state changed. Refresh and retry.';
          err.currentVersion = mockVersion;
          throw err;
        }
        if (expectedVersion !== undefined && Number(expectedVersion) !== Number(mockVersion)) {
          const err = new Error('STALE_AUCTION_STATE');
          err.statusCode = 409;
          err.publicMessage = 'Auction state changed. Refresh and retry.';
          err.currentVersion = mockVersion;
          throw err;
        }
        mockVersion += 1;
        if (!playerId || status === 'idle') {
          currentMockState = {
            ...currentMockState,
            activePlayer: null,
            currentBid: 0,
            highestBidder: null,
            isAwaitingTeam: false,
            status: 'idle',
            version: mockVersion
          };
          return { state: currentMockState, player: null, team: null };
        }
        const restoredPlayer = String(playerId) === player2Id ? player2 : player1;
        const restoredTeam = teamId ? teamA1 : null;
        currentMockState = {
          ...currentMockState,
          activePlayer: restoredPlayer._id,
          currentBid: Number(bidAmount ?? restoredPlayer.basePrice ?? 0),
          highestBidder: restoredTeam ? restoredTeam._id : null,
          isAwaitingTeam: Boolean(isAwaitingTeam),
          status: status || 'bidding',
          version: mockVersion
        };
        return { state: currentMockState, player: restoredPlayer, team: restoredTeam };
      };

      playerAuctionService.sellPlayer = async ({ playerId }) => {
        if (failNextSell) {
          throw new Error('AUCTION_STATE_CONFLICT');
        }
        mockVersion += 1;
        const p = String(playerId) === player2Id ? { ...player2, auctionStatus: 'Sold', soldTo: teamA1._id, soldPrice: currentMockState.currentBid } : { ...player1, auctionStatus: 'Sold', soldTo: teamA1._id, soldPrice: currentMockState.currentBid };
        currentMockState = {
          ...currentMockState,
          activePlayer: p._id,
          highestBidder: teamA1._id,
          isAwaitingTeam: false,
          status: 'sold',
          version: mockVersion
        };
        return { message: 'Sold', player: p, team: teamA1, state: currentMockState };
      };

      playerAuctionService.unsoldPlayer = async ({ playerId }) => {
        if (failNextUnsold) {
          throw new Error('AUCTION_STATE_CONFLICT');
        }
        mockVersion += 1;
        const p = String(playerId) === player2Id ? { ...player2, auctionStatus: 'Unsold', soldTo: null, soldPrice: 0 } : { ...player1, auctionStatus: 'Unsold', soldTo: null, soldPrice: 0 };
        currentMockState = {
          ...currentMockState,
          activePlayer: p._id,
          highestBidder: null,
          isAwaitingTeam: false,
          status: 'unsold',
          version: mockVersion
        };
        return { message: 'Unsold', player: p, state: currentMockState };
      };

      playerAuctionService.undoPlayerAction = async ({ playerId }) => {
        if (undoReturnsNullState) {
          return { message: 'Undo Successful!', player: { ...player1, auctionStatus: 'ReadyForAuction' }, state: null };
        }
        mockVersion += 1;
        currentMockState = {
          ...currentMockState,
          activePlayer: null,
          highestBidder: null,
          currentBid: 0,
          isAwaitingTeam: false,
          status: 'idle',
          version: mockVersion
        };
        return { message: 'Undo Successful!', player: { ...player2, _id: playerId, auctionStatus: 'ReadyForAuction' }, state: currentMockState };
      };

      playerAuctionService.resetAuction = async () => {
        mockVersion += 1;
        currentMockState = {
          ...currentMockState,
          activePlayer: null,
          highestBidder: null,
          currentBid: 0,
          isAwaitingTeam: false,
          status: 'idle',
          version: mockVersion
        };
        return { message: 'Reset Successful', playersReset: 2, teamsReset: 1, state: currentMockState };
      };

      delete require.cache[require.resolve('../routes/player')];
      delete require.cache[require.resolve('../routes/auction')];
      const auctionRoutes = require('../routes/auction');
      const playerRoutes = require('../routes/player');

      const app = express();
      app.use(express.json());
      server = http.createServer(app);
      const io = new Server(server, { cors: { origin: '*' } });
      app.set('io', io);
      initAuctionSockets(io);

      app.use('/api/auction', auctionRoutes);
      app.use('/api/players', playerRoutes);

      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;

      adminClient = ioClient(baseUrl, { auth: { token: orgAToken, tournamentId: tournamentAId }, transports: ['websocket'] });
      liveClient = ioClient(baseUrl, { auth: { token: orgAToken, tournamentId: tournamentAId }, transports: ['websocket'] });
      remoteClient = ioClient(baseUrl, { auth: { token: teamA1Token }, transports: ['websocket'] });
      tournamentBClient = ioClient(baseUrl, { auth: { token: orgBToken, tournamentId: tournamentBId }, transports: ['websocket'] });

      await Promise.all([
        waitForSocketConnect(adminClient),
        waitForSocketConnect(liveClient),
        waitForSocketConnect(remoteClient),
        waitForSocketConnect(tournamentBClient)
      ]);
      await waitMs(100);
    });

    after(async () => {
      adminClient?.disconnect();
      liveClient?.disconnect();
      remoteClient?.disconnect();
      tournamentBClient?.disconnect();
      await new Promise((resolve) => server.close(() => resolve()));

      UserSession.findOne = orig.UserSessionFindOne;
      Team.findOne = orig.TeamFindOne;
      Tournament.find = orig.TournamentFind;
      Tournament.findOne = orig.TournamentFindOne;
      Tournament.countDocuments = orig.TournamentCountDocuments;
      AuctionState.findOne = orig.AuctionStateFindOne;
      auctionService.startAuction = orig.startAuction;
      auctionService.placeBid = orig.placeBid;
      auctionService.placeCommonBid = orig.placeCommonBid;
      auctionService.resetAuctionBid = orig.resetAuctionBid;
      auctionService.restoreAuctionState = orig.restoreAuctionState;
      playerAuctionService.sellPlayer = orig.sellPlayer;
      playerAuctionService.unsoldPlayer = orig.unsoldPlayer;
      playerAuctionService.undoPlayerAction = orig.undoPlayerAction;
      playerAuctionService.resetAuction = orig.resetAuction;

      delete require.cache[require.resolve('../routes/player')];
      delete require.cache[require.resolve('../routes/auction')];
      clearBiddingState();
    });

    beforeEach(() => {
      failNextStart = false;
      failNextSell = false;
      failNextUnsold = false;
      failNextRestore = false;
      undoReturnsNullState = false;
      auctionEvents = [];
    });

    const attachRecorder = () => {
      const rec = {
        adminAud: [], liveAud: [], remoteAud: [], otherAud: [],
        adminPause: [], livePause: [], remotePause: [], otherPause: []
      };
      const handlers = [
        [adminClient, 'updateAudienceScreen', (d) => rec.adminAud.push(d)],
        [liveClient, 'updateAudienceScreen', (d) => rec.liveAud.push(d)],
        [remoteClient, 'updateAudienceScreen', (d) => rec.remoteAud.push(d)],
        [tournamentBClient, 'updateAudienceScreen', (d) => rec.otherAud.push(d)],
        [adminClient, 'biddingStateUpdate', (d) => rec.adminPause.push(d)],
        [liveClient, 'biddingStateUpdate', (d) => rec.livePause.push(d)],
        [remoteClient, 'biddingStateUpdate', (d) => rec.remotePause.push(d)],
        [tournamentBClient, 'biddingStateUpdate', (d) => rec.otherPause.push(d)]
      ];
      handlers.forEach(([sock, evt, fn]) => sock.on(evt, fn));
      const detach = () => handlers.forEach(([sock, evt, fn]) => sock.off(evt, fn));
      return { rec, detach };
    };

    const apiCall = async (method, route, body = {}, token = orgAToken) => {
      const res = await fetch(`${baseUrl}${route}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: method === 'GET' ? undefined : JSON.stringify(body)
      });
      const json = await res.json();
      return { status: res.status, data: json };
    };

    test('A1. NEXT PLAYER (start + repeated skip) broadcasts immediately to Admin, Live Screen, Remote Owner, and NOT Tournament B', async () => {
      const { rec, detach } = attachRecorder();
      try {
        const res1 = await apiCall('POST', '/api/auction/start', { playerId: player1Id });
        assert.equal(res1.status, 200);
        await Promise.all([
          waitForEventCount(rec.adminAud, 1),
          waitForEventCount(rec.liveAud, 1),
          waitForEventCount(rec.remoteAud, 1),
          waitForEventCount(rec.remotePause, 1)
        ]);
        assert.equal(rec.liveAud[0].player._id, player1Id);
        assert.equal(rec.liveAud[0].status, 'bidding');
        assert.equal(rec.liveAud[0].bidAmount, 1000);
        assert.equal(String(rec.liveAud[0].tournamentId), tournamentAId);
        assert.equal(rec.remoteAud[0].player._id, player1Id);
        assert.equal(rec.remotePause[0].biddingActive, false);

        // Repeated unbid NEXT PLAYER skip -> loads Player 2 cleanly
        const res2 = await apiCall('POST', '/api/auction/start', { playerId: player2Id });
        assert.equal(res2.status, 200);
        await Promise.all([
          waitForEventCount(rec.liveAud, 2),
          waitForEventCount(rec.remoteAud, 2),
          waitForEventCount(rec.adminAud, 2)
        ]);
        assert.equal(rec.liveAud[1].player._id, player2Id);
        assert.equal(rec.liveAud[1].bidAmount, 2000);
        assert.ok(rec.liveAud[1].version > rec.liveAud[0].version);
        assert.equal(rec.otherAud.length, 0);
        assert.equal(rec.otherPause.length, 0);

        // Failed /start after bidding starts emits ZERO broadcasts
        failNextStart = true;
        const failRes = await apiCall('POST', '/api/auction/start', { playerId: player1Id });
        assert.equal(failRes.status, 409);
        await waitMs(100);
        assert.equal(rec.liveAud.length, 2, 'Failed /start must NOT emit updateAudienceScreen');
        assert.equal(rec.remoteAud.length, 2, 'Failed /start must NOT emit updateAudienceScreen');
      } finally {
        detach();
      }
    });

    test('A2. Common BID -> Team Bid -> SOLD broadcasts authoritative updates to all Tournament A clients without duplicates', async () => {
      const { rec, detach } = attachRecorder();
      try {
        setBiddingActive(orgAId, true);

        const commonRes = await apiCall('POST', '/api/auction/common-bid', { playerId: player2Id });
        assert.equal(commonRes.status, 200);
        await Promise.all([waitForEventCount(rec.liveAud, 1), waitForEventCount(rec.remoteAud, 1)]);
        assert.equal(rec.liveAud[0].isAwaitingTeam, true);
        assert.equal(rec.liveAud[0].teamId, '');
        assert.equal(rec.liveAud[0].bidAmount, 2500);

        const bidRes = await apiCall('POST', '/api/auction/bid', { playerId: player2Id, teamId: teamA1Id });
        assert.equal(bidRes.status, 200);
        await Promise.all([waitForEventCount(rec.liveAud, 2), waitForEventCount(rec.remoteAud, 2)]);
        assert.equal(rec.liveAud[1].teamId, teamA1Id);
        assert.equal(rec.liveAud[1].teamName, 'Mumbai Challengers');
        assert.equal(rec.liveAud[1].isAwaitingTeam, false);
        assert.equal(rec.liveAud[1].bidAmount, 3000);

        // Failed sell emits ZERO broadcasts
        failNextSell = true;
        const failSellRes = await apiCall('PUT', `/api/players/sell/${player2Id}`, { teamId: teamA1Id, soldPrice: 3000 });
        assert.equal(failSellRes.status, 409);
        await waitMs(80);
        assert.equal(rec.liveAud.length, 2);

        // Successful SOLD broadcasts single authoritative sold payload
        failNextSell = false;
        const sellRes = await apiCall('PUT', `/api/players/sell/${player2Id}`, { teamId: teamA1Id, soldPrice: 3000 });
        assert.equal(sellRes.status, 200);
        await Promise.all([
          waitForEventCount(rec.adminAud, 3),
          waitForEventCount(rec.liveAud, 3),
          waitForEventCount(rec.remoteAud, 3),
          waitForEventCount(rec.remotePause, 1)
        ]);
        assert.equal(rec.liveAud[2].status, 'sold');
        assert.equal(rec.liveAud[2].teamId, teamA1Id);
        assert.equal(rec.liveAud[2].teamName, 'Mumbai Challengers');
        assert.equal(rec.liveAud[2].shortName, 'MC');
        assert.equal(rec.liveAud[2].bidAmount, 3000);
        assert.equal(rec.liveAud[2].player._id, player2Id);
        assert.ok(rec.liveAud[2].version > rec.liveAud[1].version);
        assert.equal(rec.remoteAud[2].status, 'sold');
        assert.equal(rec.remotePause[0].biddingActive, false);
        assert.equal(rec.otherAud.length, 0);
        assert.equal(rec.otherPause.length, 0);
      } finally {
        detach();
      }
    });

    test('A3. UNDO, UNSOLD, and RESET AUCTION broadcast authoritative state transitions & guard inactive undo', async () => {
      const { rec, detach } = attachRecorder();
      try {
        // Inactive undo (state: null) must NOT wipe Live Screen
        undoReturnsNullState = true;
        const noOpUndo = await apiCall('PUT', `/api/players/undo/${player1Id}`, {});
        assert.equal(noOpUndo.status, 200);
        await waitMs(80);
        assert.equal(rec.liveAud.length, 0);

        // Active undo resets Live Screen & Remote Owner to idle
        undoReturnsNullState = false;
        const undoRes = await apiCall('PUT', `/api/players/undo/${player2Id}`, {});
        assert.equal(undoRes.status, 200);
        await Promise.all([waitForEventCount(rec.liveAud, 1), waitForEventCount(rec.remoteAud, 1)]);
        assert.equal(rec.liveAud[0].status, 'idle');
        assert.equal(rec.liveAud[0].player, null);
        assert.equal(rec.liveAud[0].bidAmount, 0);
        assert.equal(rec.remoteAud[0].status, 'idle');
        assert.equal(rec.remoteAud[0].player, null);

        // Failed UNSOLD emits ZERO broadcasts
        failNextUnsold = true;
        const failUnsoldRes = await apiCall('PUT', `/api/players/unsold/${player2Id}`, {});
        assert.equal(failUnsoldRes.status, 409);
        await waitMs(80);
        assert.equal(rec.liveAud.length, 1);

        // Successful UNSOLD broadcasts unsold status cleanly
        failNextUnsold = false;
        const unsoldRes = await apiCall('PUT', `/api/players/unsold/${player2Id}`, {});
        assert.equal(unsoldRes.status, 200);
        await Promise.all([waitForEventCount(rec.liveAud, 2), waitForEventCount(rec.remoteAud, 2)]);
        assert.equal(rec.liveAud[1].status, 'unsold');
        assert.equal(rec.liveAud[1].teamId, '');
        assert.equal(rec.liveAud[1].player._id, player2Id);
        assert.equal(rec.remoteAud[1].status, 'unsold');
        assert.equal(rec.remoteAud[1].teamName, '');

        // Reset auction broadcasts idle + player: null
        const resetRes = await apiCall('POST', '/api/players/reset-auction', {});
        assert.equal(resetRes.status, 200);
        await Promise.all([waitForEventCount(rec.liveAud, 3), waitForEventCount(rec.remoteAud, 3)]);
        assert.equal(rec.liveAud[2].status, 'idle');
        assert.equal(rec.liveAud[2].player, null);
        assert.equal(rec.remoteAud[2].status, 'idle');
        assert.equal(rec.remoteAud[2].player, null);
        assert.equal(rec.otherAud.length, 0);
      } finally {
        detach();
      }
    });

    test('A4. Client version deduplication, tournament guard, and player:null clearing prevent stale state regression', () => {
      // Simulates RemoteBiddingPublic & LiveScreen guard logic verified in source
      let lastVersion = 5;
      let state = {
        tournamentId: tournamentAId,
        currentPlayer: player2,
        currentBid: 3000,
        biddingTeamId: teamA1Id,
        playerStatus: 'sold',
        version: 5
      };

      const applyEvent = (data) => {
        if (data.tournamentId && String(data.tournamentId) !== String(tournamentAId)) return false;
        const incomingVersion = Number(data.version);
        if (Number.isFinite(incomingVersion) && incomingVersion > 0) {
          if (incomingVersion <= lastVersion) return false;
          lastVersion = incomingVersion;
        }
        const nextStatus = data.status || data.playerStatus || 'bidding';
        const nextPlayer = data.player !== undefined ? data.player : (data.currentPlayer !== undefined ? data.currentPlayer : state.currentPlayer);
        state = {
          ...state,
          currentPlayer: nextPlayer,
          currentBid: nextStatus === 'idle' || !nextPlayer ? 0 : Number(data.bidAmount ?? state.currentBid),
          biddingTeamId: nextStatus === 'idle' || nextStatus === 'unsold' || !nextPlayer ? '' : (data.teamId || ''),
          playerStatus: nextStatus,
          version: incomingVersion
        };
        return true;
      };

      assert.equal(applyEvent({ tournamentId: tournamentBId, version: 6, status: 'bidding', player: player1 }), false);
      assert.equal(applyEvent({ tournamentId: tournamentAId, version: 5, status: 'bidding', player: player1 }), false, 'Equal version must be deduplicated');
      assert.equal(applyEvent({ tournamentId: tournamentAId, version: 4, status: 'bidding', player: player1 }), false, 'Lower version must be ignored');
      assert.equal(applyEvent({ tournamentId: tournamentAId, version: 6, status: 'idle', player: null, bidAmount: 0 }), true);
      assert.equal(state.currentPlayer, null, 'Explicit player: null on UNDO/RESET must clear previous player');
      assert.equal(state.playerStatus, 'idle');
      assert.equal(state.biddingTeamId, '');
    });

    test('A5. POST /api/auction/restore-state broadcasts restored Player B across all Tournament A clients & rejects unauthorized/stale calls', async () => {
      const { rec, detach } = attachRecorder();
      try {
        // Load Player B (player2) then skip to Player A (player1)
        const sB = await apiCall('POST', '/api/auction/start', { playerId: player2Id });
        assert.equal(sB.status, 200);
        const sA = await apiCall('POST', '/api/auction/start', { playerId: player1Id });
        assert.equal(sA.status, 200);
        await Promise.all([
          waitForEventCount(rec.adminAud, 2),
          waitForEventCount(rec.liveAud, 2),
          waitForEventCount(rec.remoteAud, 2)
        ]);
        const currentVer = sA.data.state.version;

        // Team Owner must be blocked (403) and emit zero broadcasts
        const forbidden = await apiCall('POST', '/api/auction/restore-state', {
          playerId: player2Id,
          bidAmount: 2000,
          status: 'bidding',
          expectedVersion: currentVer
        }, teamA1Token);
        assert.equal(forbidden.status, 403);

        // Stale expectedVersion must return 409 and emit zero broadcasts
        const stale = await apiCall('POST', '/api/auction/restore-state', {
          playerId: player2Id,
          bidAmount: 2000,
          status: 'bidding',
          expectedVersion: currentVer - 1
        });
        assert.equal(stale.status, 409);
        await waitMs(80);
        assert.equal(rec.liveAud.length, 2);

        // Valid restore-state -> restores Player B identically in API response & Socket broadcast
        const restoreRes = await apiCall('POST', '/api/auction/restore-state', {
          playerId: player2Id,
          bidAmount: 2000,
          status: 'bidding',
          isAwaitingTeam: false,
          expectedVersion: currentVer
        });
        assert.equal(restoreRes.status, 200);
        assert.equal(restoreRes.data.player._id, player2Id);
        assert.equal(restoreRes.data.state.status, 'bidding');
        assert.equal(restoreRes.data.state.version, currentVer + 1);

        await Promise.all([
          waitForEventCount(rec.adminAud, 3),
          waitForEventCount(rec.liveAud, 3),
          waitForEventCount(rec.remoteAud, 3)
        ]);
        assert.equal(rec.adminAud[2].player._id, player2Id);
        assert.equal(rec.liveAud[2].player._id, player2Id);
        assert.equal(rec.remoteAud[2].player._id, player2Id);
        assert.equal(rec.liveAud[2].version, restoreRes.data.state.version);
        assert.equal(rec.remoteAud[2].version, restoreRes.data.state.version);
        assert.equal(rec.liveAud[2].bidAmount, 2000);
        assert.equal(rec.otherAud.length, 0);
      } finally {
        detach();
      }
    });
  });

  describe('B. Live MongoDB Transaction + Socket.IO End-to-End Integration', { skip: getDbSkipReason() }, () => {
    let server;
    let baseUrl;
    let adminClient;
    let liveClient;
    let remoteClient;
    let otherClient;

    let orgUser;
    let orgBUser;
    let tournA;
    let tournB;
    let teamA1;
    let teamA2;
    let p1;
    let p2;
    let orgSession;
    let orgBSession;
    let teamSession;

    before(async () => {
      await connectSafeTestMongo();

      delete require.cache[require.resolve('../routes/player')];
      delete require.cache[require.resolve('../routes/auction')];
      const auctionRoutes = require('../routes/auction');
      const playerRoutes = require('../routes/player');

      const suffix = Date.now();
      orgUser = await User.create({
        name: `Sync Org A ${suffix}`,
        phone: `91${String(suffix).slice(-8)}`,
        email: `sync_org_a_${suffix}@test.local`,
        password: 'hashed_password_placeholder',
        role: 'SuperAdmin',
        plan: 'Pro'
      });
      orgBUser = await User.create({
        name: `Sync Org B ${suffix}`,
        phone: `92${String(suffix).slice(-8)}`,
        email: `sync_org_b_${suffix}@test.local`,
        password: 'hashed_password_placeholder',
        plan: 'Pro'
      });

      tournA = await Tournament.create({
        name: `Sync Premier League A ${suffix}`,
        organizer: orgUser._id,
        teamBudget: 100000,
        minPlayersPerTeam: 2
      });
      tournB = await Tournament.create({
        name: `Sync Premier League B ${suffix}`,
        organizer: orgBUser._id,
        teamBudget: 100000,
        minPlayersPerTeam: 2
      });

      teamA1 = await Team.create({
        teamName: 'Royal Strikers',
        shortName: 'RS',
        tournament: tournA._id,
        organizer: orgUser._id,
        totalPurse: 100000,
        remainingPurse: 100000,
        remoteAccessEnabled: true,
        remoteUsername: `rs_${suffix}`
      });
      teamA2 = await Team.create({
        teamName: 'TitanXI',
        shortName: 'TXI',
        tournament: tournA._id,
        organizer: orgUser._id,
        totalPurse: 100000,
        remainingPurse: 100000
      });

      p1 = await Player.create({
        name: 'Skip Candidate',
        mobile: '9000000001',
        role: 'Batsman',
        category: 'A',
        basePrice: 1000,
        organizer: orgUser._id,
        tournament: tournA._id,
        approvalStatus: 'Approved',
        auctionStatus: 'ReadyForAuction'
      });
      p2 = await Player.create({
        name: 'Primary Star',
        mobile: '9000000002',
        role: 'All-Rounder',
        category: 'A',
        basePrice: 2000,
        organizer: orgUser._id,
        tournament: tournA._id,
        approvalStatus: 'Approved',
        auctionStatus: 'ReadyForAuction'
      });

      orgSession = await UserSession.create({
        user: orgUser._id,
        sessionRole: 'User',
        expiresAt: new Date(Date.now() + 3600000)
      });
      orgBSession = await UserSession.create({
        user: orgBUser._id,
        sessionRole: 'User',
        expiresAt: new Date(Date.now() + 3600000)
      });
      teamSession = await UserSession.create({
        team: teamA1._id,
        tournament: tournA._id,
        organizer: orgUser._id,
        sessionRole: 'TeamOwner',
        expiresAt: new Date(Date.now() + 3600000)
      });

      const app = express();
      app.use(express.json());
      server = http.createServer(app);
      const io = new Server(server, { cors: { origin: '*' } });
      app.set('io', io);
      initAuctionSockets(io);
      app.use('/api/auction', auctionRoutes);
      app.use('/api/players', playerRoutes);

      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;

      const orgToken = jwt.sign({ id: String(orgUser._id), role: 'Organizer', sid: String(orgSession._id) }, getJwtSecret(), { expiresIn: '1h' });
      const orgBToken = jwt.sign({ id: String(orgBUser._id), role: 'Organizer', sid: String(orgBSession._id) }, getJwtSecret(), { expiresIn: '1h' });
      const teamToken = jwt.sign(
        { role: 'TeamOwner', teamId: String(teamA1._id), organizerId: String(orgUser._id), tournamentId: String(tournA._id), sid: String(teamSession._id) },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      adminClient = ioClient(baseUrl, { auth: { token: orgToken, clientType: 'operator', tournamentId: String(tournA._id) }, transports: ['websocket'] });
      liveClient = ioClient(baseUrl, { auth: { token: orgToken, tournamentId: String(tournA._id) }, transports: ['websocket'] });
      remoteClient = ioClient(baseUrl, { auth: { token: teamToken }, transports: ['websocket'] });
      otherClient = ioClient(baseUrl, { auth: { token: orgBToken, tournamentId: String(tournB._id) }, transports: ['websocket'] });

      await Promise.all([
        waitForSocketConnect(adminClient),
        waitForSocketConnect(liveClient),
        waitForSocketConnect(remoteClient),
        waitForSocketConnect(otherClient)
      ]);
      await waitMs(100);
    });

    after(async () => {
      adminClient?.disconnect();
      liveClient?.disconnect();
      remoteClient?.disconnect();
      otherClient?.disconnect();
      if (server) {
        await new Promise((resolve) => server.close(() => resolve()));
      }
      if (mongoose.connection.readyState !== 0) {
        await AuctionState.deleteMany({ tournament: { $in: [tournA?._id, tournB?._id].filter(Boolean) } });
        await Player.deleteMany({ tournament: { $in: [tournA?._id, tournB?._id].filter(Boolean) } });
        await Team.deleteMany({ tournament: { $in: [tournA?._id, tournB?._id].filter(Boolean) } });
        await Tournament.deleteMany({ _id: { $in: [tournA?._id, tournB?._id].filter(Boolean) } });
        await UserSession.deleteMany({ _id: { $in: [orgSession?._id, orgBSession?._id, teamSession?._id].filter(Boolean) } });
        await User.deleteMany({ _id: { $in: [orgUser?._id, orgBUser?._id].filter(Boolean) } });
        await mongoose.disconnect();
      }
      clearBiddingState();
    });

    test('B1. Full MongoDB transaction cycle: NEXT PLAYER skip -> remote bid -> SOLD -> UNDO -> NEXT PLAYER -> UNSOLD -> RESET', async () => {
      const orgToken = jwt.sign({ id: String(orgUser._id), role: 'Organizer', sid: String(orgSession._id) }, getJwtSecret(), { expiresIn: '1h' });
      const api = async (method, path, body = {}) => {
        const res = await fetch(`${baseUrl}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${orgToken}` },
          body: JSON.stringify(body)
        });
        return { status: res.status, data: await res.json() };
      };

      const liveEvents = [];
      const remoteEvents = [];
      const otherEvents = [];
      liveClient.on('updateAudienceScreen', (d) => liveEvents.push(d));
      remoteClient.on('updateAudienceScreen', (d) => remoteEvents.push(d));
      otherClient.on('updateAudienceScreen', (d) => otherEvents.push(d));

      // 1. Start p1, then skip unbid to p2
      const start1 = await api('POST', '/api/auction/start', { playerId: String(p1._id) });
      assert.equal(start1.status, 200);
      await waitForEventCount(liveEvents, 1);
      assert.equal(String(liveEvents[0].player._id), String(p1._id));

      const start2 = await api('POST', '/api/auction/start', { playerId: String(p2._id) });
      assert.equal(start2.status, 200);
      await waitForEventCount(liveEvents, 2);
      assert.equal(String(liveEvents[1].player._id), String(p2._id));

      // Verify p1 stayed ReadyForAuction when skipped
      const p1InDb = await Player.findById(p1._id).lean();
      assert.equal(p1InDb.auctionStatus, 'ReadyForAuction');

      // 2. Enable bidding and place remote bid via Socket.IO
      const toggleRes = await api('POST', '/api/auction/toggle-bidding', { active: true });
      assert.equal(toggleRes.status, 200);

      const remoteBidAck = await new Promise((resolve) => {
        remoteClient.emit('requestRemoteBid', { playerId: String(p2._id), expectedVersion: liveEvents[1].version }, resolve);
      });
      assert.equal(remoteBidAck.success, true, `Remote bid should succeed: ${remoteBidAck.message}`);
      assert.equal(remoteBidAck.newBidAmount, 3000);
      await Promise.all([waitForEventCount(liveEvents, 3), waitForEventCount(remoteEvents, 3)]);
      assert.equal(String(liveEvents[2].teamId), String(teamA1._id));
      assert.equal(liveEvents[2].bidAmount, 3000);

      // Verify NEXT PLAYER is blocked once bidding started
      const blockedStart = await api('POST', '/api/auction/start', { playerId: String(p1._id) });
      assert.equal(blockedStart.status, 409);

      // 3. Sell p2
      const sellRes = await api('PUT', `/api/players/sell/${p2._id}`, { teamId: String(teamA1._id), soldPrice: remoteBidAck.newBidAmount });
      assert.equal(sellRes.status, 200);
      await Promise.all([waitForEventCount(liveEvents, 4), waitForEventCount(remoteEvents, 4)]);
      assert.equal(liveEvents[3].status, 'sold');
      assert.equal(String(liveEvents[3].teamId), String(teamA1._id));
      assert.equal(remoteEvents[3].status, 'sold');

      // 4. Undo p2 -> idle broadcast + purse refund
      const undoRes = await api('PUT', `/api/players/undo/${p2._id}`, {});
      assert.equal(undoRes.status, 200);
      await Promise.all([waitForEventCount(liveEvents, 5), waitForEventCount(remoteEvents, 5)]);
      assert.equal(liveEvents[4].status, 'idle');
      assert.equal(liveEvents[4].player, null);
      const teamAfterUndo = await Team.findById(teamA1._id).lean();
      assert.equal(teamAfterUndo.remainingPurse, 100000);

      // 5. Start p1 and mark Unsold
      const startP1Again = await api('POST', '/api/auction/start', { playerId: String(p1._id) });
      assert.equal(startP1Again.status, 200);
      await waitForEventCount(liveEvents, 6);

      const unsoldRes = await api('PUT', `/api/players/unsold/${p1._id}`, {});
      assert.equal(unsoldRes.status, 200);
      await Promise.all([waitForEventCount(liveEvents, 7), waitForEventCount(remoteEvents, 7)]);
      assert.equal(liveEvents[6].status, 'unsold');
      assert.equal(liveEvents[6].teamId, '');
      assert.equal(remoteEvents[6].status, 'unsold');

      // 6. Reset Auction -> idle broadcast
      const resetRes = await api('POST', '/api/players/reset-auction', {});
      assert.equal(resetRes.status, 200);
      await Promise.all([waitForEventCount(liveEvents, 8), waitForEventCount(remoteEvents, 8)]);
      assert.equal(liveEvents[7].status, 'idle');
      assert.equal(liveEvents[7].player, null);
      assert.equal(remoteEvents[7].status, 'idle');
      assert.equal(otherEvents.length, 0, 'Tournament B must receive zero events');
    });

    test('B2. Exact User Bug Reproduction: Player B -> NEXT PLAYER (Player A) -> UNDO restores Player B across Admin, Live Screen, Remote Owner, MongoDB & Page Refreshes', async () => {
      const orgToken = jwt.sign({ id: String(orgUser._id), role: 'Organizer', sid: String(orgSession._id) }, getJwtSecret(), { expiresIn: '1h' });
      const teamToken = jwt.sign(
        { role: 'TeamOwner', teamId: String(teamA1._id), organizerId: String(orgUser._id), tournamentId: String(tournA._id), sid: String(teamSession._id) },
        getJwtSecret(),
        { expiresIn: '1h' }
      );
      const api = async (method, path, body = {}, token = orgToken) => {
        const res = await fetch(`${baseUrl}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: method === 'GET' ? undefined : JSON.stringify(body)
        });
        return { status: res.status, data: await res.json() };
      };

      const adminEvents = [];
      const liveEvents = [];
      const remoteEvents = [];
      const otherEvents = [];
      const onAdmin = (d) => adminEvents.push(d);
      const onLive = (d) => liveEvents.push(d);
      const onRemote = (d) => remoteEvents.push(d);
      const onOther = (d) => otherEvents.push(d);
      adminClient.on('updateAudienceScreen', onAdmin);
      liveClient.on('updateAudienceScreen', onLive);
      remoteClient.on('updateAudienceScreen', onRemote);
      otherClient.on('updateAudienceScreen', onOther);

      try {
        // 1. Admin loads Player B (p1: Skip Candidate, basePrice 1000)
        const startB = await api('POST', '/api/auction/start', { playerId: String(p1._id) });
        assert.equal(startB.status, 200);
        await Promise.all([
          waitForEventCount(adminEvents, 1),
          waitForEventCount(liveEvents, 1),
          waitForEventCount(remoteEvents, 1)
        ]);
        assert.equal(String(liveEvents[0].player._id), String(p1._id));

        // 2. Admin skips Player B via NEXT PLAYER -> loads Player A (p2: Primary Star, basePrice 2000)
        const startA = await api('POST', '/api/auction/start', { playerId: String(p2._id) });
        assert.equal(startA.status, 200);
        await Promise.all([
          waitForEventCount(adminEvents, 2),
          waitForEventCount(liveEvents, 2),
          waitForEventCount(remoteEvents, 2)
        ]);
        assert.equal(String(adminEvents[1].player._id), String(p2._id));
        assert.equal(String(liveEvents[1].player._id), String(p2._id));
        assert.equal(String(remoteEvents[1].player._id), String(p2._id));

        const versionBeforeUndo = Number(startA.data.state.version);

        // 3. Admin clicks UNDO (PICK_PLAYER snapshot held Player B) -> backend restores Player B authoritatively
        const undoRes = await api('POST', '/api/auction/restore-state', {
          playerId: String(p1._id),
          bidAmount: p1.basePrice,
          teamId: '',
          status: 'bidding',
          isAwaitingTeam: false,
          expectedVersion: versionBeforeUndo
        });
        assert.equal(undoRes.status, 200);
        assert.equal(String(undoRes.data.player._id), String(p1._id));
        assert.equal(undoRes.data.state.status, 'bidding');
        assert.equal(Number(undoRes.data.state.version), versionBeforeUndo + 1);

        // 4. Verify Admin, Live Screen, and Remote Owner ALL receive the exact same Player B payload immediately
        await Promise.all([
          waitForEventCount(adminEvents, 3),
          waitForEventCount(liveEvents, 3),
          waitForEventCount(remoteEvents, 3)
        ]);
        const expectedVerAfterUndo = versionBeforeUndo + 1;
        for (const [label, evt] of [['Admin', adminEvents[2]], ['LiveScreen', liveEvents[2]], ['RemoteOwner', remoteEvents[2]]]) {
          assert.equal(String(evt.player._id), String(p1._id), `${label} must immediately display restored Player B`);
          assert.equal(evt.status, 'bidding', `${label} status must be bidding`);
          assert.equal(Number(evt.bidAmount), p1.basePrice, `${label} bidAmount must match Player B basePrice`);
          assert.equal(Number(evt.version), expectedVerAfterUndo, `${label} version must equal committed version`);
          assert.equal(evt.teamId, '', `${label} teamId must be empty`);
        }

        // 5. Verify MongoDB AuctionState directly in isolated DB
        const dbState = await AuctionState.findOne({ tournament: tournA._id, organizer: orgUser._id }).lean();
        assert.equal(String(dbState.activePlayer), String(p1._id), 'Persisted AuctionState must point to Player B');
        assert.equal(dbState.status, 'bidding');
        assert.equal(Number(dbState.currentBid), p1.basePrice);
        assert.equal(dbState.highestBidder, null);
        assert.equal(Number(dbState.version), expectedVerAfterUndo);

        // 6. Simulate browser refresh on Live Screen AND Remote Owner -> BOTH hydrate Player B (never revert to Player A!)
        const liveRefresh = await api('GET', `/api/auction/state?tournamentId=${tournA._id}`, {}, orgToken);
        const remoteRefresh = await api('GET', '/api/auction/state', {}, teamToken);
        assert.equal(liveRefresh.status, 200);
        assert.equal(remoteRefresh.status, 200);
        assert.equal(String(liveRefresh.data.activePlayer._id), String(p1._id), 'Refreshed Live Screen must keep Player B');
        assert.equal(String(remoteRefresh.data.activePlayer._id), String(p1._id), 'Refreshed Remote Owner must keep Player B');
        assert.equal(Number(liveRefresh.data.version), expectedVerAfterUndo);
        assert.equal(Number(remoteRefresh.data.version), expectedVerAfterUndo);

        // 7. Duplicate/stale UNDO request with old expectedVersion must be rejected (409) & emit zero events
        const duplicateUndo = await api('POST', '/api/auction/restore-state', {
          playerId: String(p1._id),
          bidAmount: p1.basePrice,
          teamId: '',
          status: 'bidding',
          expectedVersion: versionBeforeUndo
        });
        assert.equal(duplicateUndo.status, 409);
        await waitMs(80);
        assert.equal(liveEvents.length, 3, 'Duplicate stale undo must not emit any extra broadcast');
        assert.equal(remoteEvents.length, 3);

        // 8. Also test BID Undo (Admin bids Team 1 on Player B -> Undo restores basePrice & clears team)
        await api('POST', '/api/auction/toggle-bidding', { active: true });
        const bidRes = await api('POST', '/api/auction/bid', {
          playerId: String(p1._id),
          teamId: String(teamA1._id),
          expectedVersion: expectedVerAfterUndo
        });
        assert.equal(bidRes.status, 200);
        await Promise.all([waitForEventCount(liveEvents, 4), waitForEventCount(remoteEvents, 4)]);
        const bidVer = Number(bidRes.data.state.version);

        // Attempting PICK_PLAYER restore to Player A while Player B has an active bid must be blocked (409)
        const blockedSwitchUndo = await api('POST', '/api/auction/restore-state', {
          playerId: String(p2._id),
          bidAmount: p2.basePrice,
          status: 'bidding',
          expectedVersion: bidVer
        });
        assert.equal(blockedSwitchUndo.status, 409);

        // Valid BID undo on same Player B restores unbid basePrice in DB + all 3 clients + refresh
        const undoBidRes = await api('POST', '/api/auction/restore-state', {
          playerId: String(p1._id),
          bidAmount: p1.basePrice,
          teamId: '',
          status: 'bidding',
          isAwaitingTeam: false,
          expectedVersion: bidVer
        });
        assert.equal(undoBidRes.status, 200);
        await Promise.all([waitForEventCount(adminEvents, 5), waitForEventCount(liveEvents, 5), waitForEventCount(remoteEvents, 5)]);
        assert.equal(String(liveEvents[4].player._id), String(p1._id));
        assert.equal(liveEvents[4].teamId, '');
        assert.equal(Number(liveEvents[4].bidAmount), p1.basePrice);
        const afterBidUndoRefresh = await api('GET', '/api/auction/state', {}, teamToken);
        assert.equal(String(afterBidUndoRefresh.data.activePlayer._id), String(p1._id));
        assert.equal(afterBidUndoRefresh.data.highestBidder, null);

        // 9. Verify UNSOLD + UNDO + Refresh regression on Player B
        const unsoldRes = await api('PUT', `/api/players/unsold/${p1._id}`, {});
        assert.equal(unsoldRes.status, 200);
        await Promise.all([waitForEventCount(liveEvents, 6), waitForEventCount(remoteEvents, 6)]);
        assert.equal(liveEvents[5].status, 'unsold');

        const undoUnsoldRes = await api('PUT', `/api/players/undo/${p1._id}`, {});
        assert.equal(undoUnsoldRes.status, 200);
        await Promise.all([waitForEventCount(adminEvents, 7), waitForEventCount(liveEvents, 7), waitForEventCount(remoteEvents, 7)]);
        assert.equal(adminEvents[6].status, 'idle');
        assert.equal(liveEvents[6].status, 'idle');
        assert.equal(remoteEvents[6].status, 'idle');
        assert.equal(liveEvents[6].player, null);

        const refreshAfterUnsoldUndo = await api('GET', '/api/auction/state', {}, teamToken);
        assert.equal(refreshAfterUnsoldUndo.data.status, 'idle');
        assert.equal(refreshAfterUnsoldUndo.data.activePlayer, null);
        const p1Final = await Player.findById(p1._id).lean();
        assert.equal(p1Final.auctionStatus, 'ReadyForAuction');

        // 10. Tournament B remained completely isolated
        assert.equal(otherEvents.length, 0, 'Tournament B must receive zero events throughout Undo lifecycle');
      } finally {
        adminClient.off('updateAudienceScreen', onAdmin);
        liveClient.off('updateAudienceScreen', onLive);
        remoteClient.off('updateAudienceScreen', onRemote);
        otherClient.off('updateAudienceScreen', onOther);
      }
    });
  });
});
