const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { Server } = require('socket.io');
const { io: ioClient } = require('../../Frontend/node_modules/socket.io-client');
const jwt = require('jsonwebtoken');

// Import utilities
const { getJwtSecret } = require('../utils/sessionAuth');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_for_socket_phase_4';
}

describe('Phase 4: Socket.IO Server-Authoritative Direct Bidding & Authorization Suite', () => {
  let server;
  let io;
  let port;
  let serverSockets = new Map();

  const organizerId = '660000000000000000000001';
  const tournamentId = '660000000000000000000002';
  const teamOwnerTeamId = '660000000000000000000003';
  const sid = '660000000000000000000004';

  const organizerToken = jwt.sign(
    { id: organizerId, role: 'Organizer', sid },
    getJwtSecret(),
    { expiresIn: '1h' }
  );

  const teamOwnerToken = jwt.sign(
    {
      role: 'TeamOwner',
      teamId: teamOwnerTeamId,
      organizerId,
      tournamentId,
      sid
    },
    getJwtSecret(),
    { expiresIn: '1h' }
  );

  let mockPlaceBidFn = null;
  const organizerActiveBids = new Map();

  before(async () => {
    server = http.createServer();
    io = new Server(server, { cors: { origin: '*' } });

    // Authentication middleware mimicking backend/index.js
    io.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Unauthorized'));
        const decoded = jwt.verify(token, getJwtSecret());

        if (decoded.role === 'TeamOwner') {
          if (!decoded.teamId || !decoded.organizerId || !decoded.tournamentId || !decoded.sid) {
            return next(new Error('Unauthorized'));
          }
          socket.role = 'TeamOwner';
          socket.teamOwner = {
            teamId: decoded.teamId,
            organizerId: decoded.organizerId,
            tournamentId: decoded.tournamentId
          };
          socket.organizerId = decoded.organizerId;
          socket.tournamentId = decoded.tournamentId;
          socket.sessionId = decoded.sid;
          return next();
        }

        if (!decoded?.id || !decoded?.sid) return next(new Error('Unauthorized'));
        socket.role = 'Organizer';
        socket.organizerId = decoded.id;
        socket.tournamentId = socket.handshake.auth?.tournamentId || tournamentId;
        socket.sessionId = decoded.sid;
        next();
      } catch (err) {
        next(new Error('Unauthorized'));
      }
    });

    io.on('connection', (socket) => {
      serverSockets.set(socket.id, socket);

      const room = `organizer:${socket.organizerId}`;
      const organizerKey = String(socket.organizerId);
      socket.join(room);

      let tournamentRoom = socket.tournamentId ? `tournament:${socket.tournamentId}` : null;
      if (tournamentRoom) {
        socket.join(tournamentRoom);
      }

      const broadcastToTournament = (event, data) => {
        io.to(room).emit(event, data);
        if (tournamentRoom) {
          io.to(tournamentRoom).emit(event, data);
        }
      };

      // Direct server-authoritative bid handler
      socket.on('requestRemoteBid', async (payload, callback) => {
        if (socket.role !== 'TeamOwner') {
          if (typeof callback === 'function') callback({ success: false, message: 'Only Team Owners can request remote bids' });
          return;
        }

        const playerId = String(payload?.playerId || '');
        const amount = Number(payload?.amount || 0);

        if (!playerId || !amount || amount <= 0) {
          if (typeof callback === 'function') callback({ success: false, message: 'Invalid bid payload' });
          return;
        }

        try {
          if (!mockPlaceBidFn) throw new Error('Auction service not ready');
          const result = await mockPlaceBidFn({
            organizerId: socket.teamOwner.organizerId,
            tournamentScope: { tournamentId: socket.teamOwner.tournamentId },
            teamId: socket.teamOwner.teamId, // strictly enforced from session
            playerId,
            amount,
            bidType: 'increment',
            expectedVersion: payload?.expectedVersion,
            allowCustomBid: false
          });

          const acceptedBid = Number(result.state.currentBid);
          const liveBidPayload = {
            bidAmount: acceptedBid,
            currentBid: acceptedBid,
            teamId: result.team._id,
            biddingTeamId: result.team._id,
            teamName: result.team.teamName,
            biddingTeamName: result.team.teamName,
            shortName: result.team.shortName,
            status: 'bidding',
            playerStatus: 'bidding',
            version: result.state.version
          };

          const current = organizerActiveBids.get(organizerKey) || [];
          const nextList = [...current, String(result.team.teamName || result.team._id)].slice(-4);
          organizerActiveBids.set(organizerKey, nextList);

          broadcastToTournament('updateAudienceScreen', liveBidPayload);
          broadcastToTournament('activeBiddingUpdate', { lastBidActions: nextList });

          if (typeof callback === 'function') {
            callback({
              success: true,
              message: 'Bid accepted',
              newBidAmount: acceptedBid,
              teamId: result.team._id,
              version: result.state.version
            });
          }
        } catch (error) {
          const message = error.publicMessage || error.message || 'Bid rejected';
          if (typeof callback === 'function') {
            callback({ success: false, message });
          }
        }
      });

      // Role authorization guards on operator events
      socket.on('newLiveBid', (data) => {
        if (socket.role === 'TeamOwner') return;
        broadcastToTournament('updateAudienceScreen', data);
      });

      socket.on('liveScreenConfigUpdate', (payload) => {
        if (socket.role === 'TeamOwner') return;
        broadcastToTournament('liveScreenConfigUpdate', payload);
      });
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  after(async () => {
    io.close();
    server.close();
  });

  test('1. Team Owner connects and joins tournament and organizer rooms', async () => {
    const client = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: teamOwnerToken }
    });

    await new Promise((resolve, reject) => {
      client.on('connect', resolve);
      client.on('connect_error', reject);
    });

    const sSocket = Array.from(serverSockets.values()).find(s => s.role === 'TeamOwner');
    assert.ok(sSocket, 'Server-side socket should exist');
    assert.ok(sSocket.rooms.has(`tournament:${tournamentId}`), 'Should join tournament room');
    assert.ok(sSocket.rooms.has(`organizer:${organizerId}`), 'Should join organizer room');

    client.disconnect();
  });

  test('2. Missing or invalid token is rejected by socket auth', async () => {
    const client = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: 'invalid_token' }
    });

    await new Promise((resolve) => {
      client.on('connect_error', (err) => {
        assert.equal(err.message, 'Unauthorized');
        resolve();
      });
    });

    client.disconnect();
  });

  test('3. Team Owner CANNOT emit operator events (newLiveBid, liveScreenConfigUpdate)', async () => {
    const ownerClient = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: teamOwnerToken }
    });
    const orgClient = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: organizerToken }
    });

    await Promise.all([
      new Promise(r => ownerClient.on('connect', r)),
      new Promise(r => orgClient.on('connect', r))
    ]);

    let receivedScreenUpdate = false;
    orgClient.on('updateAudienceScreen', () => {
      receivedScreenUpdate = true;
    });

    // Team Owner attempts to emit operator event
    ownerClient.emit('newLiveBid', { bidAmount: 999999, teamName: 'Hacker' });
    ownerClient.emit('liveScreenConfigUpdate', { layout: 'hacked' });

    await new Promise(r => setTimeout(r, 100));

    assert.equal(receivedScreenUpdate, false, 'Team Owner must not be allowed to emit operator events');

    ownerClient.disconnect();
    orgClient.disconnect();
  });

  test('4. Direct requestRemoteBid executes placeBid directly and broadcasts to tournament', async () => {
    mockPlaceBidFn = async ({ organizerId, teamId, playerId, amount }) => {
      assert.equal(teamId, teamOwnerTeamId, 'teamId must match authenticated session, not client param');
      return {
        state: { currentBid: 12000, version: 5 },
        team: { _id: teamId, teamName: 'Mumbai Indians', shortName: 'MI' },
        player: { _id: playerId, name: 'Rohit Sharma' }
      };
    };

    const ownerClient = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: teamOwnerToken }
    });
    const liveScreenClient = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: organizerToken }
    });

    await Promise.all([
      new Promise(r => ownerClient.on('connect', r)),
      new Promise(r => liveScreenClient.on('connect', r))
    ]);

    let broadcastReceived = null;
    liveScreenClient.on('updateAudienceScreen', (data) => {
      broadcastReceived = data;
    });

    // Remote bid request with spoofed teamId attempt in payload
    const response = await new Promise((resolve) => {
      ownerClient.emit('requestRemoteBid', {
        teamId: 'attacker_team_id', // client attempt to spoof teamId
        playerId: 'player-1',
        amount: 1000
      }, resolve);
    });

    assert.equal(response.success, true);
    assert.equal(response.newBidAmount, 12000);
    assert.equal(response.teamId, teamOwnerTeamId);

    await new Promise(r => setTimeout(r, 100));

    assert.ok(broadcastReceived, 'Live screen should receive updateAudienceScreen');
    assert.equal(broadcastReceived.bidAmount, 12000);
    assert.equal(broadcastReceived.teamName, 'Mumbai Indians');
    assert.equal(broadcastReceived.version, 5);

    ownerClient.disconnect();
    liveScreenClient.disconnect();
  });

  test('5. Direct requestRemoteBid propagates backend validation failure in callback', async () => {
    mockPlaceBidFn = async () => {
      const error = new Error('BID_LIMIT_EXCEEDED');
      error.publicMessage = 'Bid exceeds the team purse or maximum permitted bid.';
      throw error;
    };

    const ownerClient = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: teamOwnerToken }
    });

    await new Promise(r => ownerClient.on('connect', r));

    const response = await new Promise((resolve) => {
      ownerClient.emit('requestRemoteBid', {
        playerId: 'player-1',
        amount: 500000000
      }, resolve);
    });

    assert.equal(response.success, false);
    assert.equal(response.message, 'Bid exceeds the team purse or maximum permitted bid.');

    ownerClient.disconnect();
  });
});
