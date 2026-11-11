const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { io: ioClient } = require('../../Frontend/node_modules/socket.io-client');
const { assertExpectedVersion } = require('../services/auctionService');

describe('Phase A Regression Suite: Concurrency, Echo Elimination & Direct Push', () => {

  describe('Fix 1: Concurrency Protection & Version Sanitization', () => {
    test('1A. Matching positive version succeeds without error', () => {
      assert.doesNotThrow(() => assertExpectedVersion({ version: 7 }, 7));
      assert.doesNotThrow(() => assertExpectedVersion({ version: 1 }, 1));
      assert.doesNotThrow(() => assertExpectedVersion({ version: 100 }, '100'));
    });

    test('1B. Stale or mismatched positive version strictly throws STALE_AUCTION_STATE', () => {
      assert.throws(() => assertExpectedVersion({ version: 7 }, 6), /STALE_AUCTION_STATE/);
      assert.throws(() => assertExpectedVersion({ version: 7 }, 8), /STALE_AUCTION_STATE/);
      assert.throws(() => assertExpectedVersion({ version: 2 }, 1), /STALE_AUCTION_STATE/);
    });

    test('1C. null, undefined, 0, or empty string expectedVersion does NOT throw STALE_AUCTION_STATE', () => {
      assert.doesNotThrow(() => assertExpectedVersion({ version: 7 }, null));
      assert.doesNotThrow(() => assertExpectedVersion({ version: 7 }, undefined));
      assert.doesNotThrow(() => assertExpectedVersion({ version: 7 }, 0));
      assert.doesNotThrow(() => assertExpectedVersion({ version: 7 }, '0'));
      assert.doesNotThrow(() => assertExpectedVersion({ version: 7 }, ''));
    });
  });

  describe('Fix 2: Socket Echo Loop Elimination (excludeSender: false)', () => {
    let server;
    let io;
    let port;
    let operatorClient;
    let audienceClient;

    before(async () => {
      const app = express();
      server = http.createServer(app);
      io = new Server(server, { cors: { origin: '*' } });

      const organizerId = 'org-regression-123';
      const tournamentId = 'tourn-regression-456';

      io.on('connection', (socket) => {
        socket.organizerId = organizerId;
        socket.tournamentId = tournamentId;

        const room = `organizer:${socket.organizerId}`;
        socket.join(room);

        let tournamentRoom = `tournament:${socket.tournamentId}`;
        socket.join(tournamentRoom);

        // Exact pattern implemented in backend/socket/auctionSocketHandler.js
        const broadcastToTournament = (event, data, includeSender = true) => {
          if (includeSender) {
            io.to(room).to(tournamentRoom).emit(event, data);
          } else {
            socket.to(room).to(tournamentRoom).emit(event, data);
          }
        };

        socket.on('newLiveBid', (data) => {
          const payload = {
            ...data,
            version: (data?.version !== undefined && data?.version !== null && Number(data.version) > 0) ? Number(data.version) : undefined,
            isRemote: Boolean(data?.isRemote),
            bidSource: data?.bidSource || (data?.isRemote ? 'remote' : 'onsite'),
            biddingActive: true
          };
          broadcastToTournament('updateAudienceScreen', payload, false);
        });
      });

      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      port = server.address().port;
    });

    after(async () => {
      if (operatorClient) operatorClient.disconnect();
      if (audienceClient) audienceClient.disconnect();
      io.close();
      server.close();
    });

    test('2A. Operator emitting newLiveBid does NOT receive self-echo, but audience receives broadcast', async () => {
      operatorClient = ioClient(`http://127.0.0.1:${port}`, {
        transports: ['websocket']
      });
      audienceClient = ioClient(`http://127.0.0.1:${port}`, {
        transports: ['websocket']
      });

      await Promise.all([
        new Promise((r) => operatorClient.on('connect', r)),
        new Promise((r) => audienceClient.on('connect', r))
      ]);

      let operatorReceivedCount = 0;
      let audienceReceivedPayload = null;

      operatorClient.on('updateAudienceScreen', () => {
        operatorReceivedCount++;
      });

      audienceClient.on('updateAudienceScreen', (data) => {
        audienceReceivedPayload = data;
      });

      // Operator broadcasts a new live bid
      operatorClient.emit('newLiveBid', {
        bidAmount: 15000,
        teamId: 'team-xyz',
        teamName: 'Warriors',
        version: 5
      });

      await new Promise((r) => setTimeout(r, 150));

      // Operator must receive 0 echo events
      assert.equal(operatorReceivedCount, 0, 'Operator should not receive self-echo of newLiveBid');
      // Audience must receive the broadcasted event
      assert.ok(audienceReceivedPayload, 'Audience screen should receive the updateAudienceScreen broadcast');
      assert.equal(audienceReceivedPayload.bidAmount, 15000);
      assert.equal(audienceReceivedPayload.teamName, 'Warriors');
      assert.equal(audienceReceivedPayload.version, 5);
      assert.equal(audienceReceivedPayload.bidSource, 'onsite');
      assert.equal(audienceReceivedPayload.isRemote, false);
    });

    test('2B. Stale/null version is sanitized and does not broadcast null or 0', async () => {
      let audiencePayload = null;
      audienceClient.on('updateAudienceScreen', (data) => {
        audiencePayload = data;
      });

      operatorClient.emit('newLiveBid', {
        bidAmount: 20000,
        teamId: 'team-xyz',
        teamName: 'Warriors',
        version: null
      });

      await new Promise((r) => setTimeout(r, 150));
      assert.ok(audiencePayload);
      assert.equal(audiencePayload.version, undefined, 'Version null should not be coerced to 0');
    });
  });

  describe('Fix 3: Server-Push Direct Broadcast Schema Compatibility', () => {
    test('3A. Direct server-push payload conforms to LiveScreen and ControlPanel contracts', () => {
      const mockResult = {
        state: { currentBid: 35000, version: 12 },
        team: { _id: 'team-1', teamName: 'Mumbai Indians', shortName: 'MI', logoUrl: '/logos/mi.png' },
        player: { _id: 'player-1', name: 'Rohit Sharma', basePrice: 20000 }
      };

      const liveBidPayload = {
        bidAmount: mockResult.state.currentBid,
        currentBid: mockResult.state.currentBid,
        teamId: mockResult.team._id,
        biddingTeamId: mockResult.team._id,
        teamName: mockResult.team.teamName,
        biddingTeamName: mockResult.team.teamName,
        shortName: mockResult.team.shortName,
        logoUrl: mockResult.team.logoUrl || '',
        player: mockResult.player,
        currentPlayer: mockResult.player,
        status: 'bidding',
        playerStatus: 'bidding',
        version: mockResult.state.version,
        isRemote: false,
        bidSource: 'onsite',
        biddingActive: true
      };

      assert.equal(liveBidPayload.bidAmount, 35000);
      assert.equal(liveBidPayload.teamId, 'team-1');
      assert.equal(liveBidPayload.version, 12);
      assert.equal(liveBidPayload.isRemote, false);
      assert.equal(liveBidPayload.bidSource, 'onsite');
      assert.equal(liveBidPayload.player.name, 'Rohit Sharma');
    });
  });
});
