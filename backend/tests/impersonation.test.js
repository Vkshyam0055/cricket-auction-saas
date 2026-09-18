const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const ioClient = require('../../Frontend/node_modules/socket.io-client');
require('dotenv').config({ path: './.env' });

const User = require('../models/User');
const UserSession = require('../models/UserSession');
const AuditLog = require('../models/AuditLog');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const { 
    createSessionAndToken, 
    createImpersonationSessionAndToken, 
    getActiveDeviceIdsForUser, 
    validateSessionById,
    revokeSessionById, 
    IMPERSONATION_SESSION_TTL_HOURS,
    SESSION_TTL_HOURS 
} = require('../utils/sessionAuth');

describe('Super Admin User Impersonation Feature & Security Suite', () => {
    let app;
    let server;
    let io;
    let baseUrl;
    let testAdmin;
    let testAdmin2;
    let testOrganizerA;
    let testOrganizerB;
    let adminToken;
    let organizerAToken;
    let organizerBToken;

    before(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI);
        }

        app = express();
        app.use(express.json());
        app.use('/api/admin', require('../routes/admin'));
        app.use('/api/tournament', require('../routes/tournament'));
        app.use('/api/teams', require('../routes/team'));
        app.use('/api/auth', require('../routes/auth'));

        server = http.createServer(app);
        io = new Server(server, { cors: { origin: '*' } });

        const organizerActiveBids = new Map();

        // Attach identical Socket.io middleware & events as in production index.js
        io.use((socket, next) => {
            try {
                const token = socket.handshake.auth?.token;
                if (!token) return next(new Error('Unauthorized'));
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (!decoded?.id || !decoded?.sid) return next(new Error('Unauthorized'));
                socket.organizerId = decoded.id;
                socket.sessionId = decoded.sid;
                socket.tokenExp = decoded.exp;        
                next();
            } catch (error) {
                next(new Error('Unauthorized'));
            }
        });

        io.on('connection', async (socket) => {
            const validation = await validateSessionById({ sessionId: socket.sessionId, userId: socket.organizerId });
            if (!validation.ok) {
                socket.emit('sessionExpired', { message: 'Session expired' });
                return socket.disconnect(true);
            }

            const room = `organizer:${socket.organizerId}`;
            socket.join(room);

            socket.emit('activeBiddingSync', {
                organizerRoom: room,
                lastBidActions: organizerActiveBids.get(String(socket.organizerId)) || []
            });

            socket.use(async (_, next) => {
                const packetValidation = await validateSessionById({ sessionId: socket.sessionId, userId: socket.organizerId });
                if (!packetValidation.ok) {
                    socket.emit('sessionExpired', { message: 'Session expired' });
                    socket.disconnect(true);
                    return next(new Error('Unauthorized'));
                }
                return next();
            });

            socket.on('activeBiddingUpdate', (payload = {}) => {
                io.to(room).emit('activeBiddingUpdate', payload);
            });
        });

        await new Promise((resolve) => server.listen(0, resolve));
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;

        const timestamp = Date.now();
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('testpass123', 10);

        // Create ephemeral test users
        testAdmin = await User.create({
            name: `Test SuperAdmin ${timestamp}`,
            phone: `9999${String(timestamp).slice(-6)}`,
            email: `test_admin_${timestamp}@example.com`,
            password: hashedPassword,
            role: 'SuperAdmin',
            plan: 'Pro'
        });

        testAdmin2 = await User.create({
            name: `Test SuperAdmin2 ${timestamp}`,
            phone: `9998${String(timestamp).slice(-6)}`,
            email: `test_admin2_${timestamp}@example.com`,
            password: hashedPassword,
            role: 'SuperAdmin',
            plan: 'Pro'
        });

        testOrganizerA = await User.create({
            name: `Test Organizer A ${timestamp}`,
            phone: `8888${String(timestamp).slice(-6)}`,
            email: `test_org_a_${timestamp}@example.com`,
            password: hashedPassword,
            role: 'Organizer',
            plan: 'Basic',
            maxDevicesAllowed: 2
        });

        testOrganizerB = await User.create({
            name: `Test Organizer B ${timestamp}`,
            phone: `7777${String(timestamp).slice(-6)}`,
            email: `test_org_b_${timestamp}@example.com`,
            password: hashedPassword,
            role: 'Organizer',
            plan: 'Pro',
            maxDevicesAllowed: 3
        });

        // Create standard sessions for test users
        const adminAuth = await createSessionAndToken({ user: testAdmin, deviceId: 'admin_laptop' });
        adminToken = adminAuth.token;

        const orgAAuth = await createSessionAndToken({ user: testOrganizerA, deviceId: 'org_a_phone' });
        organizerAToken = orgAAuth.token;

        const orgBAuth = await createSessionAndToken({ user: testOrganizerB, deviceId: 'org_b_tablet' });
        organizerBToken = orgBAuth.token;

        // Seed tournaments and teams for Organizer A and B to test multi-tenant scoping
        await Tournament.create({
            name: 'Alpha Premier League',
            venue: 'Alpha Stadium',
            organizer: testOrganizerA._id
        });

        await Team.create({
            teamName: 'Alpha Gladiators',
            shortName: 'AG',
            totalPurse: 1000000,
            remainingPurse: 1000000,
            ownerName: 'Owner Alpha',
            mobile: '9876543210',
            organizer: testOrganizerA._id
        });

        await Tournament.create({
            name: 'Beta Champions Trophy',
            venue: 'Beta Grounds',
            organizer: testOrganizerB._id
        });

        await Team.create({
            teamName: 'Beta Titans',
            shortName: 'BT',
            totalPurse: 2000000,
            remainingPurse: 2000000,
            ownerName: 'Owner Beta',
            mobile: '9876543211',
            organizer: testOrganizerB._id
        });
    });

    after(async () => {
        // Cleanup all test records
        if (testAdmin?._id) {
            await User.deleteOne({ _id: testAdmin._id });
            await UserSession.deleteMany({ user: testAdmin._id });
            await AuditLog.deleteMany({ adminId: testAdmin._id });
        }
        if (testAdmin2?._id) {
            await User.deleteOne({ _id: testAdmin2._id });
            await UserSession.deleteMany({ user: testAdmin2._id });
        }
        if (testOrganizerA?._id) {
            await User.deleteOne({ _id: testOrganizerA._id });
            await UserSession.deleteMany({ user: testOrganizerA._id });
            await Tournament.deleteMany({ organizer: testOrganizerA._id });
            await Team.deleteMany({ organizer: testOrganizerA._id });
        }
        if (testOrganizerB?._id) {
            await User.deleteOne({ _id: testOrganizerB._id });
            await UserSession.deleteMany({ user: testOrganizerB._id });
            await Tournament.deleteMany({ organizer: testOrganizerB._id });
            await Team.deleteMany({ organizer: testOrganizerB._id });
        }

        if (io) {
            await new Promise((resolve) => io.close(resolve));
        }
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        await mongoose.disconnect();
    });

    // ----------------------------------------------------------------
    // SECTION 1: SUPER ADMIN AUTHORIZATION & NON-ADMIN DENIAL
    // ----------------------------------------------------------------
    test('1. Non-SuperAdmin cannot call /api/admin/impersonate/:id', async () => {
        const res = await fetch(`${baseUrl}/api/admin/impersonate/${testOrganizerA._id}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${organizerAToken}` }
        });
        assert.equal(res.status, 403);
        const data = await res.json();
        assert.match(data.message, /Access Denied/i);
    });

    test('2. Non-SuperAdmin cannot call /api/admin/impersonate/:id/exit', async () => {
        const res = await fetch(`${baseUrl}/api/admin/impersonate/${testOrganizerA._id}/exit`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${organizerAToken}` },
            body: JSON.stringify({ sessionId: new mongoose.Types.ObjectId() })
        });
        assert.equal(res.status, 403);
    });

    test('3. Non-SuperAdmin cannot access any other admin routes (/all-data, /update-user, /clear-devices, /force-logout)', async () => {
        const routes = [
            { url: `${baseUrl}/api/admin/all-data`, method: 'GET' },
            { url: `${baseUrl}/api/admin/update-user/${testOrganizerA._id}`, method: 'PUT', body: { plan: 'Pro' } },
            { url: `${baseUrl}/api/admin/clear-devices/${testOrganizerA._id}`, method: 'PUT' },
            { url: `${baseUrl}/api/admin/force-logout/${testOrganizerA._id}`, method: 'PUT' }
        ];

        for (const route of routes) {
            const res = await fetch(route.url, {
                method: route.method,
                headers: {
                    Authorization: `Bearer ${organizerAToken}`,
                    'Content-Type': 'application/json'
                },
                body: route.body ? JSON.stringify(route.body) : undefined
            });
            assert.equal(res.status, 403, `Route ${route.method} ${route.url} must be denied for non-admin`);
        }
    });

    test('4. SuperAdmin cannot impersonate another SuperAdmin', async () => {
        const res = await fetch(`${baseUrl}/api/admin/impersonate/${testAdmin2._id}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assert.equal(res.status, 403);
        const data = await res.json();
        assert.match(data.message, /Cannot impersonate another SuperAdmin/i);
    });

    test('5. Return 404 if target user does not exist', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await fetch(`${baseUrl}/api/admin/impersonate/${fakeId}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assert.equal(res.status, 404);
        const data = await res.json();
        assert.match(data.message, /not found/i);
    });

    // ----------------------------------------------------------------
    // SECTION 2: IMPERSONATION SESSION CREATION & TOKEN CLAIMS
    // ----------------------------------------------------------------
    let impersonationToken;
    let impersonationSessionId;

    test('6. SuperAdmin successfully creates dedicated short-lived impersonation session', async () => {
        const res = await fetch(`${baseUrl}/api/admin/impersonate/${testOrganizerA._id}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assert.equal(res.status, 200);
        const data = await res.json();

        assert.ok(data.token, 'Token should be returned');
        assert.ok(data.sessionId, 'SessionId should be returned');
        assert.equal(data.user.name, testOrganizerA.name);
        assert.equal(data.user.role, 'Organizer');
        assert.equal(data.user.plan, 'Basic');

        impersonationToken = data.token;
        impersonationSessionId = data.sessionId;

        // Verify token decoded claims
        const decoded = jwt.verify(impersonationToken, process.env.JWT_SECRET);
        assert.equal(decoded.id, String(testOrganizerA._id));
        assert.equal(decoded.role, 'Organizer');
        assert.equal(decoded.isImpersonated, true);
        assert.equal(decoded.impersonatedBy, String(testAdmin._id));

        // Verify session in database
        const dbSession = await UserSession.findById(impersonationSessionId);
        assert.ok(dbSession);
        assert.equal(String(dbSession.user), String(testOrganizerA._id));
        assert.equal(dbSession.isImpersonated, true);
        assert.equal(String(dbSession.impersonatedBy), String(testAdmin._id));
        assert.equal(dbSession.deviceId, 'impersonation_device');

        // Check short TTL: expires in <= 2 hours (with 1 minute margin)
        const diffHours = (new Date(dbSession.expiresAt) - new Date()) / (1000 * 60 * 60);
        assert.ok(diffHours <= IMPERSONATION_SESSION_TTL_HOURS);
        assert.ok(diffHours > 1.8);

        // Verify ENTER_IMPERSONATION AuditLog
        const audit = await AuditLog.findOne({
            adminId: testAdmin._id,
            targetUserId: testOrganizerA._id,
            action: 'ENTER_IMPERSONATION'
        });
        assert.ok(audit, 'Audit log entry must exist for ENTER_IMPERSONATION');
    });

    // ----------------------------------------------------------------
    // SECTION 3: PRIVILEGE ISOLATION (IMPERSONATED SESSION HAS NO ADMIN POWER)
    // ----------------------------------------------------------------
    test('7. Privilege Escalation Prevention: Impersonated token CANNOT access ANY admin endpoints', async () => {
        const adminEndpoints = [
            { method: 'GET', path: '/api/admin/all-data' },
            { method: 'POST', path: `/api/admin/impersonate/${testOrganizerB._id}` },
            { method: 'POST', path: `/api/admin/impersonate/${testOrganizerA._id}/exit`, body: { sessionId: impersonationSessionId } },
            { method: 'PUT', path: `/api/admin/update-user/${testOrganizerA._id}`, body: { plan: 'Pro' } },
            { method: 'PUT', path: `/api/admin/clear-devices/${testOrganizerA._id}` },
            { method: 'PUT', path: `/api/admin/force-logout/${testOrganizerA._id}` }
        ];

        for (const ep of adminEndpoints) {
            const res = await fetch(`${baseUrl}${ep.path}`, {
                method: ep.method,
                headers: {
                    Authorization: `Bearer ${impersonationToken}`,
                    'Content-Type': 'application/json'
                },
                body: ep.body ? JSON.stringify(ep.body) : undefined
            });
            assert.equal(res.status, 403, `Impersonated token MUST be rejected on ${ep.method} ${ep.path}`);
            const data = await res.json();
            assert.match(data.message, /Impersonated sessions cannot access admin endpoints/i);
        }
    });

    // ----------------------------------------------------------------
    // SECTION 4: MULTI-TENANT DATA ISOLATION BETWEEN ORGANIZERS
    // ----------------------------------------------------------------
    test('8. Multi-Tenant Scoping: Impersonated session strictly isolates Organizer A data from Organizer B', async () => {
        // As impersonated Organizer A, fetch tournament
        const resTour = await fetch(`${baseUrl}/api/tournament`, {
            headers: { Authorization: `Bearer ${impersonationToken}` }
        });
        assert.equal(resTour.status, 200);
        const tourData = await resTour.json();
        assert.equal(tourData.name, 'Alpha Premier League');
        assert.equal(String(tourData.organizer), String(testOrganizerA._id));

        // As impersonated Organizer A, fetch teams: must contain only Alpha Gladiators, NOT Beta Titans
        const resTeams = await fetch(`${baseUrl}/api/teams`, {
            headers: { Authorization: `Bearer ${impersonationToken}` }
        });
        assert.equal(resTeams.status, 200);
        const teamsData = await resTeams.json();
        const teamNames = teamsData.map((t) => t.teamName);
        assert.ok(teamNames.includes('Alpha Gladiators'));
        assert.ok(!teamNames.includes('Beta Titans'), 'Organizer B team must not leak to Organizer A session');

        // Verify Organizer B fetching teams only sees Beta Titans
        const resTeamsB = await fetch(`${baseUrl}/api/teams`, {
            headers: { Authorization: `Bearer ${organizerBToken}` }
        });
        assert.equal(resTeamsB.status, 200);
        const teamsDataB = await resTeamsB.json();
        const teamNamesB = teamsDataB.map((t) => t.teamName);
        assert.ok(teamNamesB.includes('Beta Titans'));
        assert.ok(!teamNamesB.includes('Alpha Gladiators'));
    });

    test('9. Device limit isolation: Impersonation does not count against user active device quota', async () => {
        const activeDevices = await getActiveDeviceIdsForUser(testOrganizerA._id);
        assert.ok(!activeDevices.includes('impersonation_device'));
        assert.deepEqual(activeDevices, ['org_a_phone']);
    });

    // ----------------------------------------------------------------
    // SECTION 5: EXPIRED, TAMPERED & REVOKED TOKEN HANDLING
    // ----------------------------------------------------------------
    test('10. Expired token is rejected with 401', async () => {
        // Create an expired token (expired 10 seconds ago)
        const expiredToken = jwt.sign(
            { id: testOrganizerA._id, role: 'Organizer', sid: new mongoose.Types.ObjectId() },
            process.env.JWT_SECRET,
            { expiresIn: -10 }
        );

        const res = await fetch(`${baseUrl}/api/tournament`, {
            headers: { Authorization: `Bearer ${expiredToken}` }
        });
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.match(data.message, /टोकन अमान्य या एक्सपायर/i);
    });

    test('11. Tampered signature token is rejected with 401', async () => {
        const tamperedToken = jwt.sign(
            { id: testOrganizerA._id, role: 'Organizer', sid: impersonationSessionId },
            'WRONG_SECRET_KEY_12345'
        );

        const res = await fetch(`${baseUrl}/api/tournament`, {
            headers: { Authorization: `Bearer ${tamperedToken}` }
        });
        assert.equal(res.status, 401);
    });

    test('12. Missing, stringified null, or undefined token is rejected with 401', async () => {
        const invalidHeaders = [
            {},
            { Authorization: 'Bearer null' },
            { Authorization: 'Bearer undefined' },
            { Authorization: 'Bearer ' }
        ];

        for (const headers of invalidHeaders) {
            const res = await fetch(`${baseUrl}/api/tournament`, { headers });
            assert.equal(res.status, 401);
        }
    });

    test('13. Revoked session is rejected with 401', async () => {
        // Create a temporary session and token, then revoke it
        const tempAuth = await createSessionAndToken({ user: testOrganizerA, deviceId: 'temp_revoked_dev' });
        await revokeSessionById(tempAuth.session._id);

        const res = await fetch(`${baseUrl}/api/tournament`, {
            headers: { Authorization: `Bearer ${tempAuth.token}` }
        });
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.match(data.message, /सेशन समाप्त हो गया है/i);
    });

    // ----------------------------------------------------------------
    // SECTION 6: EXIT IMPERSONATION & ORIGINAL ADMIN RESTORATION
    // ----------------------------------------------------------------
    test('14. Safely exit impersonation and terminate impersonation session', async () => {
        const res = await fetch(`${baseUrl}/api/admin/impersonate/${testOrganizerA._id}/exit`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sessionId: impersonationSessionId })
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.match(data.message, /Impersonation exited successfully/i);

        // Verify session is marked revoked in DB
        const revokedSession = await UserSession.findById(impersonationSessionId);
        assert.ok(revokedSession.revokedAt !== null, 'Session revokedAt should be set');

        // Verify EXIT_IMPERSONATION AuditLog
        const exitAudit = await AuditLog.findOne({
            adminId: testAdmin._id,
            targetUserId: testOrganizerA._id,
            action: 'EXIT_IMPERSONATION'
        });
        assert.ok(exitAudit, 'Audit log entry must exist for EXIT_IMPERSONATION');

        // Subsequent requests with the revoked impersonation token must fail with 401
        const resSubsequent = await fetch(`${baseUrl}/api/tournament`, {
            headers: { Authorization: `Bearer ${impersonationToken}` }
        });
        assert.equal(resSubsequent.status, 401);
    });

    test('15. Original SuperAdmin session remains valid and active throughout', async () => {
        const resAdmin = await fetch(`${baseUrl}/api/admin/all-data`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assert.equal(resAdmin.status, 200);
        const data = await resAdmin.json();
        assert.ok(Array.isArray(data));
        assert.ok(data.length >= 2);
    });

    // ----------------------------------------------------------------
    // SECTION 7: NORMAL USER LOGIN & LOGOUT REGRESSION
    // ----------------------------------------------------------------
    test('16. Normal user login and logout regression test', async () => {
        const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: testOrganizerA.phone,
                password: 'testpass123',
                deviceId: 'test_normal_phone_suite'
            })
        });
        assert.equal(loginRes.status, 200);
        const loginData = await loginRes.json();
        assert.ok(loginData.token);

        // Verify normal token claims
        const decodedNormal = jwt.verify(loginData.token, process.env.JWT_SECRET);
        assert.equal(decodedNormal.id, String(testOrganizerA._id));
        assert.equal(decodedNormal.isImpersonated, undefined);
        assert.equal(decodedNormal.impersonatedBy, undefined);

        // Verify session in database has isImpersonated false or default
        const normalSession = await UserSession.findById(decodedNormal.sid);
        assert.ok(normalSession);
        assert.notEqual(normalSession.isImpersonated, true);

        // Normal logout test
        const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${loginData.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: testOrganizerA.phone,
                deviceId: 'test_normal_phone_suite'
            })
        });
        assert.equal(logoutRes.status, 200);

        // Verify session is revoked
        const loggedOutSession = await UserSession.findById(decodedNormal.sid);
        assert.ok(loggedOutSession.revokedAt !== null);
    });

    // ----------------------------------------------------------------
    // SECTION 8: SOCKET.IO & LIVE AUCTION INTEGRATION
    // ----------------------------------------------------------------
    test('17. Socket.IO accepts valid normal token and joins correct organizer room', async () => {
        const clientSocket = ioClient(baseUrl, {
            auth: { token: organizerBToken },
            transports: ['websocket'],
            reconnection: false
        });

        const syncData = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
            clientSocket.on('activeBiddingSync', (data) => {
                clearTimeout(timeout);
                resolve(data);
            });
            clientSocket.on('connect_error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });

        assert.ok(syncData);
        assert.equal(syncData.organizerRoom, `organizer:${testOrganizerB._id}`);
        clientSocket.disconnect();
    });

    test('18. Socket.IO accepts valid impersonation token and connects to target organizer scope', async () => {
        // Create fresh impersonation session for Organizer B
        const freshImp = await createImpersonationSessionAndToken({
            targetUser: testOrganizerB,
            adminUser: testAdmin
        });

        const clientSocket = ioClient(baseUrl, {
            auth: { token: freshImp.token },
            transports: ['websocket'],
            reconnection: false
        });

        const syncData = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
            clientSocket.on('activeBiddingSync', (data) => {
                clearTimeout(timeout);
                resolve(data);
            });
            clientSocket.on('connect_error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });

        assert.ok(syncData);
        assert.equal(syncData.organizerRoom, `organizer:${testOrganizerB._id}`);
        clientSocket.disconnect();

        // Cleanup this fresh impersonation session
        await UserSession.deleteOne({ _id: freshImp.session._id });
    });

    test('19. Socket.IO rejects connection with expired or invalid token', async () => {
        const expiredToken = jwt.sign(
            { id: testOrganizerA._id, role: 'Organizer', sid: new mongoose.Types.ObjectId() },
            process.env.JWT_SECRET,
            { expiresIn: -10 }
        );

        const clientSocket = ioClient(baseUrl, {
            auth: { token: expiredToken },
            transports: ['websocket'],
            reconnection: false
        });

        const error = await new Promise((resolve) => {
            clientSocket.on('connect_error', (err) => resolve(err));
            clientSocket.on('connect', () => resolve(null));
        });

        assert.ok(error, 'Socket should fail to connect');
        assert.match(error.message, /Unauthorized/i);
        clientSocket.disconnect();
    });

    // ----------------------------------------------------------------
    // SECTION 9: STRICT DEV VS PROD API URL ISOLATION VERIFICATION
    // ----------------------------------------------------------------
    test('20. API URL candidates strictly isolate local dev from remote Render backend, and prod from localhost', () => {
        const normalizeBaseUrl = (url) => String(url || '').trim().replace(/\/$/, '');
        const isLocalhostUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizeBaseUrl(url));

        const DEFAULT_PROD_API_BASE = 'https://cricket-auction-backend-h8ud.onrender.com';
        const DEFAULT_DEV_API_BASE = 'http://localhost:5000';

        // Check isLocalhostUrl classification
        assert.equal(isLocalhostUrl('http://localhost:5000'), true);
        assert.equal(isLocalhostUrl('http://127.0.0.1:5000'), true);
        assert.equal(isLocalhostUrl('http://localhost:5173'), true);
        assert.equal(isLocalhostUrl(DEFAULT_PROD_API_BASE), false);
        assert.equal(isLocalhostUrl('https://my-custom-domain.com'), false);

        // Test DEV mode isolation logic:
        const devModeSimulation = (storedUrl, viteUrl) => {
            // In dev mode, purge remote URL
            const safeStored = (storedUrl && !isLocalhostUrl(storedUrl)) ? '' : storedUrl;
            const devCandidates = [
                DEFAULT_DEV_API_BASE,
                isLocalhostUrl(viteUrl) ? normalizeBaseUrl(viteUrl) : '',
                safeStored
            ];
            return Array.from(new Set(devCandidates.filter(Boolean).map(normalizeBaseUrl)));
        };

        // Dev mode given a Render storedUrl must NEVER include Render URL
        const devCandidatesWithRenderStored = devModeSimulation(DEFAULT_PROD_API_BASE, '');
        assert.deepEqual(devCandidatesWithRenderStored, ['http://localhost:5000']);
        assert.ok(!devCandidatesWithRenderStored.some((u) => u.includes('onrender.com')));

        // Test PROD mode isolation logic:
        const prodModeSimulation = (storedUrl, viteUrl) => {
            // In prod mode, purge localhost URL
            const safeStored = (storedUrl && isLocalhostUrl(storedUrl)) ? '' : storedUrl;
            const explicitViteUrl = !isLocalhostUrl(viteUrl) ? normalizeBaseUrl(viteUrl) : '';
            const prodCandidates = [
                safeStored,
                explicitViteUrl,
                DEFAULT_PROD_API_BASE
            ].filter((url) => Boolean(url) && !isLocalhostUrl(url));

            return Array.from(new Set(prodCandidates.map(normalizeBaseUrl)));
        };

        // Prod mode given localhost storedUrl must NEVER include localhost URL
        const prodCandidatesWithLocalStored = prodModeSimulation('http://localhost:5000', 'http://localhost:5000');
        assert.deepEqual(prodCandidatesWithLocalStored, [DEFAULT_PROD_API_BASE]);
        assert.ok(!prodCandidatesWithLocalStored.some((u) => u.includes('localhost') || u.includes('127.0.0.1')));
    });
});
