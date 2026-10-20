const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { io: ioClient } = require('../../Frontend/node_modules/socket.io-client');
const jwt = require('jsonwebtoken');

const {
  isBiddingActive,
  setBiddingActive,
  registerOperatorSocket,
  removeOperatorSocket,
  hasActiveOperators,
  clearBiddingState
} = require('../utils/biddingState');
const { getJwtSecret } = require('../utils/sessionAuth');

const UserSession = require('../models/UserSession');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_for_bidding_pause_control';
}

describe('Organizer Start Bidding / Pause Bidding Suite', () => {
  const organizerId = '660000000000000000000301';
  const organizerId2 = '660000000000000000000399';
  const tournamentId = '660000000000000000000302';
  const teamOwnerTeamId = '660000000000000000000303';
  const sid = '660000000000000000000304';

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

  // In-memory model mocks for isolated HTTP route tests
  UserSession.findOne = (query) => {
    const doc = {
      _id: sid,
      user: organizerId,
      team: teamOwnerTeamId,
      organizer: organizerId,
      tournament: tournamentId,
      sessionRole: query?.sessionRole || 'User',
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null
    };
    return {
      lean: async () => doc,
      then: (resolve) => resolve(doc)
    };
  };

  Team.findOne = () => {
    const doc = {
      _id: teamOwnerTeamId,
      organizer: organizerId,
      tournament: tournamentId,
      remoteAccessEnabled: true
    };
    return {
      lean: async () => doc,
      then: (resolve) => resolve(doc)
    };
  };

  Tournament.find = () => {
    const list = [{ _id: tournamentId }];
    return {
      select: () => ({
        limit: () => ({
          lean: async () => list,
          then: (resolve) => resolve(list)
        }),
        lean: async () => list,
        then: (resolve) => resolve(list)
      }),
      limit: () => ({
        lean: async () => list,
        then: (resolve) => resolve(list)
      }),
      lean: async () => list,
      then: (resolve) => resolve(list)
    };
  };
  Tournament.countDocuments = async () => 1;

  beforeEach(() => {
    clearBiddingState();
  });

  describe('1. Bidding State Manager (Unit & Isolation)', () => {
    test('Defaults to inactive (false) for any organizer', () => {
      assert.equal(isBiddingActive(organizerId), false);
      assert.equal(isBiddingActive('non_existent_org'), false);
    });

    test('Toggles active state per organizer', () => {
      setBiddingActive(organizerId, true);
      assert.equal(isBiddingActive(organizerId), true);
      setBiddingActive(organizerId, false);
      assert.equal(isBiddingActive(organizerId), false);
    });

    test('Strict multi-tenant isolation between organizers', () => {
      setBiddingActive(organizerId, true);
      assert.equal(isBiddingActive(organizerId), true);
      assert.equal(isBiddingActive(organizerId2), false);

      setBiddingActive(organizerId2, true);
      setBiddingActive(organizerId, false);
      assert.equal(isBiddingActive(organizerId), false);
      assert.equal(isBiddingActive(organizerId2), true);
    });

    test('Operator socket lifecycle tracks active operators correctly', () => {
      assert.equal(hasActiveOperators(organizerId), false);

      registerOperatorSocket(organizerId, 'socket_1');
      assert.equal(hasActiveOperators(organizerId), true);

      registerOperatorSocket(organizerId, 'socket_2');
      assert.equal(hasActiveOperators(organizerId), true);

      // Remove one socket, one remains
      const remaining1 = removeOperatorSocket(organizerId, 'socket_1');
      assert.equal(remaining1, 1);
      assert.equal(hasActiveOperators(organizerId), true);

      // Remove last socket
      const remaining2 = removeOperatorSocket(organizerId, 'socket_2');
      assert.equal(remaining2, 0);
      assert.equal(hasActiveOperators(organizerId), false);
    });
  });

  describe('2. Socket.IO Start / Pause Lifecycle & Enforcement', () => {
    let server;
    let io;
    let port;
    const organizerScreenConfigs = new Map();

    before(async () => {
      const app = express();
      server = http.createServer(app);
      io = new Server(server, { cors: { origin: '*' } });
      app.set('io', io);

      app.use(express.json());
      app.use('/api/auction', require('../routes/auction'));

      io.use((socket, next) => {
        try {
          const token = socket.handshake.auth?.token;
          if (!token) return next(new Error('Unauthorized'));
          const decoded = jwt.verify(token, getJwtSecret());
          if (decoded.role === 'TeamOwner') {
            socket.role = 'TeamOwner';
            socket.teamOwner = {
              teamId: decoded.teamId,
              organizerId: decoded.organizerId,
              tournamentId: decoded.tournamentId
            };
            socket.organizerId = decoded.organizerId;
            socket.tournamentId = decoded.tournamentId;
            return next();
          }
          socket.role = 'Organizer';
          socket.organizerId = decoded.id;
          socket.clientType = socket.handshake.auth?.clientType || null;
          next();
        } catch (err) {
          next(new Error('Unauthorized'));
        }
      });

      io.on('connection', (socket) => {
        const organizerKey = String(socket.organizerId);
        const room = `organizer:${socket.organizerId}`;
        socket.join(room);
        if (socket.tournamentId) {
          socket.join(`tournament:${socket.tournamentId}`);
        }

        const isOperator = socket.role === 'Organizer' && socket.clientType === 'operator';
        if (isOperator) {
          registerOperatorSocket(socket.organizerId, socket.id);
        }

        socket.emit('biddingStateUpdate', {
          biddingActive: isBiddingActive(socket.organizerId)
        });

        const broadcastToTournament = (event, data) => {
          io.to(room).emit(event, data);
        };

        socket.on('setBiddingActive', (payload, callback) => {
          if (socket.role !== 'Organizer') {
            if (typeof callback === 'function') callback({ success: false, message: 'Unauthorized' });
            return;
          }
          const active = Boolean(payload?.active);
          const currentConfig = organizerScreenConfigs.get(organizerKey);
          if (active && currentConfig?.screenView === 'break') {
            if (typeof callback === 'function') {
              callback({ success: false, message: 'Cannot start bidding while viewing Break Content.' });
            }
            return;
          }

          setBiddingActive(socket.organizerId, active);
          broadcastToTournament('biddingStateUpdate', {
            biddingActive: active,
            organizerId: socket.organizerId
          });
          if (typeof callback === 'function') callback({ success: true, biddingActive: active });
        });

        socket.on('liveScreenConfigUpdate', (payload) => {
          if (socket.role !== 'Organizer') return;
          organizerScreenConfigs.set(organizerKey, payload);
          if (payload?.screenView === 'break') {
            setBiddingActive(socket.organizerId, false);
            broadcastToTournament('biddingStateUpdate', {
              biddingActive: false,
              organizerId: socket.organizerId
            });
          }
        });

        socket.on('requestRemoteBid', (payload, callback) => {
          if (socket.role !== 'TeamOwner') {
            if (typeof callback === 'function') callback({ success: false, message: 'Only Team Owners can bid' });
            return;
          }
          if (!isBiddingActive(socket.teamOwner.organizerId)) {
            if (typeof callback === 'function') {
              callback({ success: false, message: 'Bidding is currently paused by the organizer.' });
            }
            return;
          }
          if (typeof callback === 'function') {
            callback({ success: true, message: 'Bid accepted', amount: payload?.amount });
          }
        });

        socket.on('disconnect', () => {
          if (isOperator) {
            const remaining = removeOperatorSocket(socket.organizerId, socket.id);
            if (remaining === 0) {
              setBiddingActive(socket.organizerId, false);
              broadcastToTournament('biddingStateUpdate', {
                biddingActive: false,
                organizerId: socket.organizerId
              });
            }
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

    after(async () => {
      if (io) {
        await new Promise((resolve) => io.close(() => resolve()));
      }
      if (server && server.listening) {
        await new Promise((resolve) => server.close(() => resolve()));
      }
    });

    test('Initial connection receives biddingStateUpdate with biddingActive: false', async () => {
      const client = ioClient(`http://localhost:${port}`, {
        auth: { token: teamOwnerToken }
      });

      const initialUpdate = await new Promise((resolve) => {
        client.on('biddingStateUpdate', (data) => resolve(data));
      });

      assert.equal(initialUpdate.biddingActive, false);
      client.disconnect();
    });

    test('Team Owner requestRemoteBid while paused is authoritatively rejected', async () => {
      const client = ioClient(`http://localhost:${port}`, {
        auth: { token: teamOwnerToken }
      });

      await new Promise((resolve) => client.on('connect', resolve));

      const bidResponse = await new Promise((resolve) => {
        client.emit('requestRemoteBid', { playerId: 'p1', amount: 50000 }, (res) => resolve(res));
      });

      assert.equal(bidResponse.success, false);
      assert.equal(bidResponse.message, 'Bidding is currently paused by the organizer.');

      client.disconnect();
    });

    test('Organizer can Start Bidding, broadcasting active update to Team Owners', async () => {
      const operatorClient = ioClient(`http://localhost:${port}`, {
        auth: { token: organizerToken, clientType: 'operator' }
      });
      const teamOwnerClient = ioClient(`http://localhost:${port}`, {
        auth: { token: teamOwnerToken }
      });

      await Promise.all([
        new Promise((resolve) => operatorClient.on('connect', resolve)),
        new Promise((resolve) => teamOwnerClient.on('connect', resolve))
      ]);

      const teamOwnerUpdatePromise = new Promise((resolve) => {
        teamOwnerClient.on('biddingStateUpdate', (data) => {
          if (data.biddingActive === true) resolve(data);
        });
      });

      const startResult = await new Promise((resolve) => {
        operatorClient.emit('setBiddingActive', { active: true }, (res) => resolve(res));
      });

      assert.equal(startResult.success, true);
      assert.equal(startResult.biddingActive, true);
      assert.equal(isBiddingActive(organizerId), true);

      const teamOwnerReceived = await teamOwnerUpdatePromise;
      assert.equal(teamOwnerReceived.biddingActive, true);

      // Now remote bid succeeds while active
      const bidResponse = await new Promise((resolve) => {
        teamOwnerClient.emit('requestRemoteBid', { playerId: 'p1', amount: 50000 }, (res) => resolve(res));
      });
      assert.equal(bidResponse.success, true);

      operatorClient.disconnect();
      teamOwnerClient.disconnect();
    });

    test('A Team Owner connecting with clientType: "operator" cannot start or pause bidding', async () => {
      const spoofedClient = ioClient(`http://localhost:${port}`, {
        auth: { token: teamOwnerToken, clientType: 'operator' }
      });

      await new Promise((resolve) => spoofedClient.on('connect', resolve));

      const startResult = await new Promise((resolve) => {
        spoofedClient.emit('setBiddingActive', { active: true }, (res) => resolve(res));
      });

      assert.equal(startResult.success, false);
      assert.equal(startResult.message, 'Unauthorized');
      assert.equal(isBiddingActive(organizerId), false);
      assert.equal(hasActiveOperators(organizerId), false);

      spoofedClient.disconnect();
    });

    test('Opening Break Content automatically pauses bidding and notifies Team Owners', async () => {
      // First activate bidding
      setBiddingActive(organizerId, true);

      const operatorClient = ioClient(`http://localhost:${port}`, {
        auth: { token: organizerToken, clientType: 'operator' }
      });
      const teamOwnerClient = ioClient(`http://localhost:${port}`, {
        auth: { token: teamOwnerToken }
      });

      await Promise.all([
        new Promise((resolve) => operatorClient.on('connect', resolve)),
        new Promise((resolve) => teamOwnerClient.on('connect', resolve))
      ]);

      const teamOwnerPausedPromise = new Promise((resolve) => {
        teamOwnerClient.on('biddingStateUpdate', (data) => {
          if (data.biddingActive === false) resolve(data);
        });
      });

      operatorClient.emit('liveScreenConfigUpdate', {
        screenView: 'break',
        breakView: 'teams-dashboard'
      });

      const pausedData = await teamOwnerPausedPromise;
      assert.equal(pausedData.biddingActive, false);
      assert.equal(isBiddingActive(organizerId), false);

      // Attempting to start bidding while still in Break Content is blocked
      const attemptStartInBreak = await new Promise((resolve) => {
        operatorClient.emit('setBiddingActive', { active: true }, (res) => resolve(res));
      });
      assert.equal(attemptStartInBreak.success, false);
      assert.match(attemptStartInBreak.message, /Cannot start bidding while viewing Break Content/i);

      operatorClient.disconnect();
      teamOwnerClient.disconnect();
    });

    test('Operator socket disconnect automatically pauses bidding when no operators remain', async () => {
      setBiddingActive(organizerId, true);

      const operatorClient = ioClient(`http://localhost:${port}`, {
        auth: { token: organizerToken, clientType: 'operator' }
      });
      const teamOwnerClient = ioClient(`http://localhost:${port}`, {
        auth: { token: teamOwnerToken }
      });

      await Promise.all([
        new Promise((resolve) => operatorClient.on('connect', resolve)),
        new Promise((resolve) => teamOwnerClient.on('connect', resolve))
      ]);

      const teamOwnerAutoPausePromise = new Promise((resolve) => {
        teamOwnerClient.on('biddingStateUpdate', (data) => {
          if (data.biddingActive === false) resolve(data);
        });
      });

      // Operator leaves / closes tab
      operatorClient.disconnect();

      const autoPausedData = await teamOwnerAutoPausePromise;
      assert.equal(autoPausedData.biddingActive, false);
      assert.equal(isBiddingActive(organizerId), false);

      teamOwnerClient.disconnect();
    });

    describe('3. HTTP API Start / Pause Enforcement & Role Protection', () => {
      test('POST /api/auction/bid returns HTTP 409 with BIDDING_PAUSED when bidding is paused', async () => {
        setBiddingActive(organizerId, false);

        const res = await fetch(`http://localhost:${port}/api/auction/bid`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${organizerToken}`
          },
          body: JSON.stringify({
            playerId: '660000000000000000000305',
            amount: 1000
          })
        });

        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.code, 'BIDDING_PAUSED');
        assert.match(data.message, /Bidding is currently paused by the organizer/i);
      });

      test('POST /api/auction/toggle-bidding rejects a Team Owner with HTTP 403', async () => {
        const res = await fetch(`http://localhost:${port}/api/auction/toggle-bidding`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${teamOwnerToken}`
          },
          body: JSON.stringify({ active: true })
        });

        assert.equal(res.status, 403);
        const data = await res.json();
        assert.match(data.message, /Only organizer can toggle bidding state/i);
        assert.equal(isBiddingActive(organizerId), false);
      });

      test('POST /api/auction/toggle-bidding allows Organizer to toggle state', async () => {
        const res = await fetch(`http://localhost:${port}/api/auction/toggle-bidding`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${organizerToken}`
          },
          body: JSON.stringify({ active: true })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.biddingActive, true);
        assert.equal(isBiddingActive(organizerId), true);
      });
    });
  });
});
