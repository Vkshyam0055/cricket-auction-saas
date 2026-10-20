const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { Server } = require('socket.io');
const { io: ioClient } = require('../../Frontend/node_modules/socket.io-client');
const jwt = require('jsonwebtoken');

const { isAllowedOrigin, socketCorsOptions } = require('../utils/corsConfig');
const { getJwtSecret } = require('../utils/sessionAuth');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_for_phase2_socket_security';
}

describe('Phase 2: Socket.IO Security & Event Delivery Suite', () => {
  let server;
  let io;
  let port;
  let serverSockets = new Map();

  const organizerId = '660000000000000000000201';
  const tournamentId = '660000000000000000000202';
  const otherTournamentId = '660000000000000000000299';
  const teamOwnerTeamId = '660000000000000000000203';
  const sid = '660000000000000000000204';

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

  const teamOwnerOtherTournamentToken = jwt.sign(
    {
      role: 'TeamOwner',
      teamId: '660000000000000000000298',
      organizerId: '660000000000000000000297',
      tournamentId: otherTournamentId,
      sid: '660000000000000000000296'
    },
    getJwtSecret(),
    { expiresIn: '1h' }
  );

  const expiredToken = jwt.sign(
    { id: organizerId, role: 'Organizer', sid: 'expired_sid' },
    getJwtSecret(),
    { expiresIn: '-10s' }
  );

  let mockPlaceBidCall = null;
  let revokedSessions = new Set();

  before(async () => {
    server = http.createServer();
    io = new Server(server, { cors: socketCorsOptions });

    // Authentication middleware identical to backend/index.js
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
      socket.join(room);

      let tournamentRoom = socket.tournamentId ? `tournament:${socket.tournamentId}` : null;
      if (tournamentRoom) {
        socket.join(tournamentRoom);
      }

      // Deduplicated broadcast implementation
      const broadcastToTournament = (event, data) => {
        if (tournamentRoom) {
          io.to(room).to(tournamentRoom).emit(event, data);
        } else {
          io.to(room).emit(event, data);
        }
      };

      // Privileged organizer events (blocked for TeamOwner)
      socket.on('newLiveBid', (data) => {
        if (socket.role === 'TeamOwner') return;
        broadcastToTournament('updateAudienceScreen', data);
      });

      socket.on('activeBiddingUpdate', (payload) => {
        if (socket.role === 'TeamOwner') return;
        broadcastToTournament('activeBiddingUpdate', payload);
      });

      socket.on('liveScreenConfigUpdate', (payload) => {
        if (socket.role === 'TeamOwner') return;
        broadcastToTournament('liveScreenConfigUpdate', payload);
      });

      socket.on('breakDataSnapshotUpdate', (payload) => {
        if (socket.role === 'TeamOwner') return;
        broadcastToTournament('breakDataSnapshotUpdate', payload);
      });

      // Direct remote bid execution (only TeamOwner, strictly uses authenticated claims)
      socket.on('requestRemoteBid', (payload, callback) => {
        if (socket.role !== 'TeamOwner') {
          if (typeof callback === 'function') callback({ success: false, message: 'Only Team Owners can request remote bids' });
          return;
        }

        if (revokedSessions.has(socket.sessionId)) {
          if (typeof callback === 'function') {
            callback({ success: false, message: 'Session revoked or expired' });
          }
          socket.emit('sessionExpired', { message: 'Remote access disabled or session expired' });
          setImmediate(() => socket.disconnect(true));
          return;
        }

        const playerId = String(payload?.playerId || '');
        const amount = Number(payload?.amount || 0);

        if (!playerId || !amount || amount <= 0) {
          if (typeof callback === 'function') callback({ success: false, message: 'Invalid bid payload' });
          return;
        }

        mockPlaceBidCall = {
          organizerId: socket.teamOwner.organizerId,
          tournamentId: socket.teamOwner.tournamentId,
          teamId: socket.teamOwner.teamId,
          playerId,
          amount
        };

        const liveBidPayload = {
          bidAmount: amount,
          teamId: socket.teamOwner.teamId,
          status: 'bidding',
          isRemote: true,
          bidSource: 'remote'
        };

        broadcastToTournament('updateAudienceScreen', liveBidPayload);

        if (typeof callback === 'function') {
          callback({ success: true, newBidAmount: amount, teamId: socket.teamOwner.teamId });
        }
      });
    });

    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(() => {
    io.close();
    server.close();
  });

  // =========================================================================
  // Test 1: CORS Allowlist Validation
  // =========================================================================
  test('1. Socket.IO CORS allowlist permits production and local dev origins while rejecting unauthorized origins', () => {
    assert.equal(isAllowedOrigin('https://cricleaguemanager.in'), true);
    assert.equal(isAllowedOrigin('https://www.cricleaguemanager.in'), true);
    assert.equal(isAllowedOrigin('http://localhost:5173'), true);
    assert.equal(isAllowedOrigin('http://127.0.0.1:3000'), true);
    assert.equal(isAllowedOrigin('http://localhost:5000'), true);
    assert.equal(isAllowedOrigin(undefined), true, 'Non-browser client without origin must be allowed');
    assert.equal(isAllowedOrigin(null), true);
    assert.equal(isAllowedOrigin(''), true);

    // Malicious or unauthorized origins must be rejected
    assert.equal(isAllowedOrigin('https://malicious-auction.com'), false);
    assert.equal(isAllowedOrigin('http://attacker.org:5173'), false);
    assert.equal(isAllowedOrigin('https://phishing-cricleaguemanager.in'), false);
  });

  // =========================================================================
  // Test 2: Authentication & Rejection of Invalid/Expired Tokens
  // =========================================================================
  test('2. Missing or expired token is rejected with Unauthorized error during handshake', async () => {
    await new Promise((resolve) => {
      const client = ioClient(`http://localhost:${port}`, {
        auth: {},
        transports: ['websocket'],
        reconnection: false
      });
      client.on('connect_error', (err) => {
        assert.equal(err.message, 'Unauthorized');
        client.disconnect();
        resolve();
      });
    });

    await new Promise((resolve) => {
      const client = ioClient(`http://localhost:${port}`, {
        auth: { token: expiredToken },
        transports: ['websocket'],
        reconnection: false
      });
      client.on('connect_error', (err) => {
        assert.equal(err.message, 'Unauthorized');
        client.disconnect();
        resolve();
      });
    });

    await new Promise((resolve) => {
      const client = ioClient(`http://localhost:${port}`, {
        auth: { token: 'tampered.token.signature' },
        transports: ['websocket'],
        reconnection: false
      });
      client.on('connect_error', (err) => {
        assert.equal(err.message, 'Unauthorized');
        client.disconnect();
        resolve();
      });
    });
  });

  // =========================================================================
  // Test 3: Privileged Event Blocking for Team Owners
  // =========================================================================
  test('3. Team Owner role CANNOT emit privileged Organizer events (newLiveBid, activeBiddingUpdate, etc.)', async () => {
    const teamClient = ioClient(`http://localhost:${port}`, {
      auth: { token: teamOwnerToken },
      transports: ['websocket'],
      reconnection: false
    });

    const organizerClient = ioClient(`http://localhost:${port}`, {
      auth: { token: organizerToken },
      transports: ['websocket'],
      reconnection: false
    });

    await Promise.all([
      new Promise((res) => teamClient.on('connect', res)),
      new Promise((res) => organizerClient.on('connect', res))
    ]);

    let spoofedBidReceived = false;
    organizerClient.on('updateAudienceScreen', () => {
      spoofedBidReceived = true;
    });

    // Team owner attempts to broadcast an unauthorized newLiveBid
    teamClient.emit('newLiveBid', {
      bidAmount: 999999,
      teamName: 'Hacker Team',
      status: 'sold'
    });

    await new Promise((res) => setTimeout(res, 100));
    assert.equal(spoofedBidReceived, false, 'Spoofed newLiveBid from Team Owner must NOT be broadcast');

    teamClient.disconnect();
    organizerClient.disconnect();
  });

  // =========================================================================
  // Test 4: Cross-Tournament Room Isolation
  // =========================================================================
  test('4. Cross-tournament isolation: Events broadcast in Tournament 1 are NOT received by clients in Tournament 2', async () => {
    const clientTournament1 = ioClient(`http://localhost:${port}`, {
      auth: { token: teamOwnerToken }, // in tournamentId
      transports: ['websocket'],
      reconnection: false
    });

    const clientTournament2 = ioClient(`http://localhost:${port}`, {
      auth: { token: teamOwnerOtherTournamentToken }, // in otherTournamentId
      transports: ['websocket'],
      reconnection: false
    });

    const organizerClient = ioClient(`http://localhost:${port}`, {
      auth: { token: organizerToken },
      transports: ['websocket'],
      reconnection: false
    });

    await Promise.all([
      new Promise((res) => clientTournament1.on('connect', res)),
      new Promise((res) => clientTournament2.on('connect', res)),
      new Promise((res) => organizerClient.on('connect', res))
    ]);

    let receivedInT1 = false;
    let receivedInT2 = false;

    clientTournament1.on('updateAudienceScreen', () => { receivedInT1 = true; });
    clientTournament2.on('updateAudienceScreen', () => { receivedInT2 = true; });

    // Organizer of Tournament 1 broadcasts a bid
    organizerClient.emit('newLiveBid', { bidAmount: 1500, tournamentId });

    await new Promise((res) => setTimeout(res, 100));

    assert.equal(receivedInT1, true, 'Client in Tournament 1 must receive the event');
    assert.equal(receivedInT2, false, 'Client in Tournament 2 must NOT receive the event');

    clientTournament1.disconnect();
    clientTournament2.disconnect();
    organizerClient.disconnect();
  });

  // =========================================================================
  // Test 5: Bid Anti-Spoofing & Authenticated Claim Enforcement
  // =========================================================================
  test('5. Remote bid strictly uses authenticated token claims, preventing teamId or tournamentId spoofing in payload', async () => {
    mockPlaceBidCall = null;

    const teamClient = ioClient(`http://localhost:${port}`, {
      auth: { token: teamOwnerToken },
      transports: ['websocket'],
      reconnection: false
    });

    await new Promise((res) => teamClient.on('connect', res));

    // Client attempts to spoof teamId and tournamentId in request payload
    const spoofPayload = {
      playerId: '660000000000000000000555',
      amount: 2500,
      teamId: 'spoofed_team_id_999',
      tournamentId: 'spoofed_tournament_id_999'
    };

    const ack = await new Promise((res) => {
      teamClient.emit('requestRemoteBid', spoofPayload, res);
    });

    assert.equal(ack.success, true);
    assert.equal(mockPlaceBidCall.teamId, teamOwnerTeamId, 'Must use authenticated teamId from token');
    assert.equal(mockPlaceBidCall.tournamentId, tournamentId, 'Must use authenticated tournamentId from token');
    assert.equal(mockPlaceBidCall.organizerId, organizerId, 'Must use authenticated organizerId from token');

    teamClient.disconnect();
  });

  // =========================================================================
  // Test 6: Deduplicated Event Delivery (No Duplicate Broadcasts)
  // =========================================================================
  test('6. Sockets belonging to both organizer room and tournament room receive broadcasted events exactly ONCE', async () => {
    // Organizer client joins both room (`organizer:${id}`) and `tournament:${id}`
    const organizerClient = ioClient(`http://localhost:${port}`, {
      auth: { token: organizerToken },
      transports: ['websocket'],
      reconnection: false
    });

    // Team Owner client also joins both room (`organizer:${id}`) and `tournament:${id}`
    const teamClient = ioClient(`http://localhost:${port}`, {
      auth: { token: teamOwnerToken },
      transports: ['websocket'],
      reconnection: false
    });

    await Promise.all([
      new Promise((res) => organizerClient.on('connect', res)),
      new Promise((res) => teamClient.on('connect', res))
    ]);

    let organizerEventCount = 0;
    let teamEventCount = 0;

    organizerClient.on('updateAudienceScreen', () => { organizerEventCount++; });
    teamClient.on('updateAudienceScreen', () => { teamEventCount++; });

    // Emit single event from organizer
    organizerClient.emit('newLiveBid', { bidAmount: 5000, teamId: teamOwnerTeamId });

    await new Promise((res) => setTimeout(res, 120));

    // Both clients must receive the event exactly ONCE, NOT twice!
    assert.equal(organizerEventCount, 1, `Organizer socket must receive exactly 1 event (received: ${organizerEventCount})`);
    assert.equal(teamEventCount, 1, `Team Owner socket must receive exactly 1 event (received: ${teamEventCount})`);

    organizerClient.disconnect();
    teamClient.disconnect();
  });

  // =========================================================================
  // Test 7: Disallowed browser Origin connection rejection
  // =========================================================================
  test('7. Disallowed browser origin connecting via Socket.IO is rejected during handshake', async () => {
    await new Promise((resolve) => {
      const client = ioClient(`http://localhost:${port}`, {
        extraHeaders: { Origin: 'https://malicious-auction.com' },
        auth: { token: teamOwnerToken },
        transports: ['polling'],
        reconnection: false
      });
      client.on('connect_error', (err) => {
        assert.ok(err, 'Connection must produce an error for disallowed origin');
        client.disconnect();
        resolve();
      });
      client.on('connect', () => {
        client.disconnect();
        assert.fail('Disallowed origin must NOT be permitted to connect');
      });
    });
  });

  // =========================================================================
  // Test 8: Revoked session mid-connection cannot submit bids
  // =========================================================================
  test('8. Revoked Team Owner session cannot submit bids, even through an already-connected socket', async () => {
    mockPlaceBidCall = null;
    revokedSessions.clear();

    const teamClient = ioClient(`http://localhost:${port}`, {
      auth: { token: teamOwnerToken },
      transports: ['websocket'],
      reconnection: false
    });

    await new Promise((res) => teamClient.on('connect', res));

    let sessionExpiredReceived = false;
    teamClient.on('sessionExpired', (data) => {
      sessionExpiredReceived = true;
    });

    // Revoke the session after connection
    revokedSessions.add(sid);

    const ack = await new Promise((res) => {
      teamClient.emit('requestRemoteBid', {
        playerId: '660000000000000000000555',
        amount: 3000
      }, res);
    });

    assert.equal(ack.success, false);
    assert.match(ack.message, /Session revoked or expired/i);
    assert.equal(mockPlaceBidCall, null, 'Bid must NOT be executed for revoked session');

    await new Promise((res) => setTimeout(res, 50));
    assert.equal(sessionExpiredReceived, true, 'sessionExpired event must be received');
    assert.equal(teamClient.connected, false, 'Socket must be disconnected');

    revokedSessions.clear();
  });
});
