const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './.env' });

const User = require('../models/User');
const UserSession = require('../models/UserSession');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Player = require('../models/Player');
const Plan = require('../models/Plan');
const { 
    createSessionAndToken, 
    createImpersonationSessionAndToken 
} = require('../utils/sessionAuth');
const { 
    getEffectivePlanPolicy, 
    invalidatePlanCache 
} = require('../utils/planPolicy');
const { seedAndBackfillPlans } = require('../routes/plan');

describe('Super Admin Dynamic Plan Management & Limit Enforcement Suite', () => {
    let app;
    let server;
    let baseUrl;
    let superAdminUser;
    let organizerFree;
    let organizerPro;
    let superAdminToken;
    let organizerFreeToken;
    let organizerProToken;
    let impersonatedToken;
    let freePlanDoc;
    let proPlanDoc;
    let freeTournament;
    let proTournament;

    before(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI);
        }

        app = express();
        app.use(express.json());
        app.use('/api/plans', require('../routes/plan').router);
        app.use('/api/teams', require('../routes/team'));
        app.use('/api/players', require('../routes/player'));
        app.use('/api/tournament', require('../routes/tournament'));
        app.use('/api/admin', require('../routes/admin'));
        app.use('/api/auth', require('../routes/auth'));

        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, resolve));
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;

        // Ensure database has canonical plans
        await seedAndBackfillPlans();
        freePlanDoc = await Plan.findOne({ name: 'Free' });
        proPlanDoc = await Plan.findOne({ name: 'Pro' });
        assert.ok(freePlanDoc, 'Free plan should exist in database');
        assert.ok(proPlanDoc, 'Pro plan should exist in database');

        const timestamp = Date.now();
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('secretPass123', 10);

        // Create test users
        superAdminUser = await User.create({
            name: `PlanAdmin_${timestamp}`,
            phone: `9111${String(timestamp).slice(-6)}`,
            email: `plan_admin_${timestamp}@example.com`,
            password: hashedPassword,
            role: 'SuperAdmin',
            plan: 'Pro'
        });

        organizerFree = await User.create({
            name: `OrgFree_${timestamp}`,
            phone: `8222${String(timestamp).slice(-6)}`,
            email: `org_free_${timestamp}@example.com`,
            password: hashedPassword,
            role: 'Organizer',
            plan: 'Free'
        });

        organizerPro = await User.create({
            name: `OrgPro_${timestamp}`,
            phone: `7333${String(timestamp).slice(-6)}`,
            email: `org_pro_${timestamp}@example.com`,
            password: hashedPassword,
            role: 'Organizer',
            plan: 'Pro'
        });

        const adminAuth = await createSessionAndToken({ user: superAdminUser, deviceId: 'admin_test_dev' });
        superAdminToken = adminAuth.token;

        const orgFreeAuth = await createSessionAndToken({ user: organizerFree, deviceId: 'org_free_dev' });
        organizerFreeToken = orgFreeAuth.token;

        const orgProAuth = await createSessionAndToken({ user: organizerPro, deviceId: 'org_pro_dev' });
        organizerProToken = orgProAuth.token;

        const impAuth = await createImpersonationSessionAndToken({
            adminUser: superAdminUser,
            targetUser: organizerFree,
            deviceId: 'admin_test_dev',
            adminSessionId: adminAuth.session._id
        });
        impersonatedToken = impAuth.token;

        // Create tournaments
        freeTournament = await Tournament.create({
            name: 'Free Cup',
            venue: 'Free Ground',
            organizer: organizerFree._id,
            isRegistrationOpen: true
        });

        proTournament = await Tournament.create({
            name: 'Pro Premier League',
            venue: 'Pro Arena',
            organizer: organizerPro._id,
            isRegistrationOpen: true
        });
    });

    after(async () => {
        // Restore default Free plan in DB
        if (freePlanDoc) {
            await Plan.findByIdAndUpdate(freePlanDoc._id, {
                price: 0,
                teamLimit: 3,
                playerLimit: 50,
                canViewTeams: false,
                canPublicRegistration: false,
                canLiveScreen: true,
                canCustomFields: false
            });
            invalidatePlanCache();
        }

        // Cleanup test data
        await User.deleteMany({ _id: { $in: [superAdminUser._id, organizerFree._id, organizerPro._id] } });
        await UserSession.deleteMany({ userId: { $in: [superAdminUser._id, organizerFree._id, organizerPro._id] } });
        await Tournament.deleteMany({ _id: { $in: [freeTournament._id, proTournament._id] } });
        await Team.deleteMany({ organizer: { $in: [superAdminUser._id, organizerFree._id, organizerPro._id] } });
        await Player.deleteMany({ organizer: { $in: [superAdminUser._id, organizerFree._id, organizerPro._id] } });

        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    test('1. GET /api/plans returns canonical Free -> Basic -> Pro order with policy fields', async () => {
        const res = await fetch(`${baseUrl}/api/plans`);
        assert.equal(res.status, 200);
        const plans = await res.json();
        assert.ok(Array.isArray(plans));
        assert.ok(plans.length >= 3);

        const names = plans.map(p => p.name);
        assert.equal(names[0], 'Free');
        assert.equal(names[1], 'Basic');
        assert.equal(names[2], 'Pro');

        // Check fields are present
        const free = plans.find(p => p.name === 'Free');
        assert.equal(typeof free.teamLimit, 'number');
        assert.equal(typeof free.playerLimit, 'number');
        assert.equal(typeof free.canViewTeams, 'boolean');
        assert.equal(typeof free.canPublicRegistration, 'boolean');
        assert.equal(typeof free.canLiveScreen, 'boolean');
        assert.equal(typeof free.canCustomFields, 'boolean');
    });

    test('2. Super Admin can update plan price, limits, and toggles via PUT /api/plans/:id', async () => {
        const updatePayload = {
            price: 0,
            teamLimit: 2,
            playerLimit: 3,
            canViewTeams: false,
            canPublicRegistration: false,
            canLiveScreen: true,
            canCustomFields: false,
            features: ['2 Teams Max', '3 Players Max', 'Basic Auctioneer Panel']
        };

        const res = await fetch(`${baseUrl}/api/plans/${freePlanDoc._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${superAdminToken}`
            },
            body: JSON.stringify(updatePayload)
        });

        assert.equal(res.status, 200);
        const updated = await res.json();
        assert.equal(updated.plan.teamLimit, 2);
        assert.equal(updated.plan.playerLimit, 3);
        assert.equal(updated.plan.canPublicRegistration, false);

        // Verify dynamic cache invalidation
        const effectivePolicy = await getEffectivePlanPolicy('Free');
        assert.equal(effectivePolicy.teamLimit, 2);
        assert.equal(effectivePolicy.playerLimit, 3);
    });

    test('3. Regular organizer is blocked with 403 from updating plans', async () => {
        const res = await fetch(`${baseUrl}/api/plans/${freePlanDoc._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${organizerFreeToken}`
            },
            body: JSON.stringify({ teamLimit: 100 })
        });

        assert.equal(res.status, 403);
    });

    test('4. Impersonated session is blocked with 403 from updating plans', async () => {
        const res = await fetch(`${baseUrl}/api/plans/${freePlanDoc._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${impersonatedToken}`
            },
            body: JSON.stringify({ teamLimit: 100 })
        });

        assert.equal(res.status, 403);
        const data = await res.json();
        assert.match(data.message, /Impersonated sessions cannot access|Access Denied/i);
    });

    test('5. Team creation limit enforcement on Free plan (teamLimit: 2)', async () => {
        // Team 1 - Success
        const res1 = await fetch(`${baseUrl}/api/teams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${organizerFreeToken}`
            },
            body: JSON.stringify({
                teamName: 'Free Team Alpha',
                shortName: 'FTA',
                totalPurse: 100000
            })
        });
        assert.equal(res1.status, 200);

        // Team 2 - Success (reaches limit of 2)
        const res2 = await fetch(`${baseUrl}/api/teams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${organizerFreeToken}`
            },
            body: JSON.stringify({
                teamName: 'Free Team Beta',
                shortName: 'FTB',
                totalPurse: 100000
            })
        });
        assert.equal(res2.status, 200);

        // Team 3 - Blocked with 403
        const res3 = await fetch(`${baseUrl}/api/teams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${organizerFreeToken}`
            },
            body: JSON.stringify({
                teamName: 'Free Team Gamma',
                shortName: 'FTG',
                totalPurse: 100000
            })
        });
        assert.equal(res3.status, 403);
        const data3 = await res3.json();
        assert.match(data3.message, /अधिकतम 2 टीम्स/);
    });

    test('6. Super Admin bypasses team limit', async () => {
        const res = await fetch(`${baseUrl}/api/teams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${superAdminToken}`
            },
            body: JSON.stringify({
                teamName: 'Admin Team',
                shortName: 'ADM',
                totalPurse: 100000
            })
        });
        assert.equal(res.status, 200);
    });

    test('7. Direct player creation limit enforcement on Free plan (playerLimit: 3)', async () => {
        // Player 1, 2, 3 - Success
        for (let i = 1; i <= 3; i++) {
            const res = await fetch(`${baseUrl}/api/players`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${organizerFreeToken}`
                },
                body: JSON.stringify({
                    name: `Free Player ${i}`,
                    mobile: `987654321${i}`,
                    role: 'Batsman',
                    basePrice: 100,
                    tournament: freeTournament._id
                })
            });
            assert.equal(res.status, 200, `Player ${i} should be created`);
        }

        // Player 4 - Blocked with 403
        const res4 = await fetch(`${baseUrl}/api/players`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${organizerFreeToken}`
            },
            body: JSON.stringify({
                name: 'Free Player 4',
                mobile: '9876543214',
                role: 'Bowler',
                basePrice: 100,
                tournament: freeTournament._id
            })
        });
        assert.equal(res4.status, 403);
        const data4 = await res4.json();
        assert.match(data4.message, /अधिकतम 3 प्लेयर्स/);
    });

    test('8. Feature toggle: canPublicRegistration: false blocks public registration', async () => {
        // GET details
        const getRes = await fetch(`${baseUrl}/api/players/public/${freeTournament._id}`);
        assert.equal(getRes.status, 403);
        const getData = await getRes.json();
        assert.match(getData.message, /यह फीचर आपके आयोजक प्लान में उपलब्ध नहीं है/);

        // POST register
        const postRes = await fetch(`${baseUrl}/api/players/public/${freeTournament._id}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Public Player',
                mobile: '9876543299',
                role: 'All-Rounder',
                basePrice: 200
            })
        });
        assert.equal(postRes.status, 403);
    });

    test('9. Feature toggle: Pro plan allows public registration', async () => {
        const getRes = await fetch(`${baseUrl}/api/players/public/${proTournament._id}`);
        assert.equal(getRes.status, 200);
        const tournamentData = await getRes.json();
        assert.equal(tournamentData.name, 'Pro Premier League');

        const postRes = await fetch(`${baseUrl}/api/players/public/${proTournament._id}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Pro Public Player',
                mobile: '9876543290',
                role: 'Batsman',
                basePrice: 500
            })
        });
        assert.equal(postRes.status, 201);
    });

    test('10. Feature toggle: canViewTeams: false gates teams dashboard mode but preserves normal list', async () => {
        // Teams dashboard mode (x-view-mode: teams-dashboard) -> 403
        const dashboardRes = await fetch(`${baseUrl}/api/teams`, {
            headers: {
                'Authorization': `Bearer ${organizerFreeToken}`,
                'x-view-mode': 'teams-dashboard'
            }
        });
        assert.equal(dashboardRes.status, 403);
        const data = await dashboardRes.json();
        assert.equal(data.upgradeRequired, true);

        // Normal teams fetch (without x-view-mode, e.g. for auction operation) -> 200
        const normalRes = await fetch(`${baseUrl}/api/teams`, {
            headers: {
                'Authorization': `Bearer ${organizerFreeToken}`
            }
        });
        assert.equal(normalRes.status, 200);
        const teams = await normalRes.json();
        assert.equal(teams.length, 2);
    });

    test('11. Lowering limits preserves existing data (no deletion or corruption)', async () => {
        // Lower Free plan limit to 1 team and 1 player
        const res = await fetch(`${baseUrl}/api/plans/${freePlanDoc._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${superAdminToken}`
            },
            body: JSON.stringify({
                price: 0,
                teamLimit: 1,
                playerLimit: 1
            })
        });
        assert.equal(res.status, 200);

        // Existing 2 teams still exist
        const teamsRes = await fetch(`${baseUrl}/api/teams`, {
            headers: { 'Authorization': `Bearer ${organizerFreeToken}` }
        });
        assert.equal(teamsRes.status, 200);
        const teams = await teamsRes.json();
        assert.equal(teams.length, 2, 'Existing teams must not be deleted when limit is lowered');

        // Existing 3 players still exist
        const playersRes = await fetch(`${baseUrl}/api/players`, {
            headers: { 'Authorization': `Bearer ${organizerFreeToken}` }
        });
        assert.equal(playersRes.status, 200);
        const players = await playersRes.json();
        assert.equal(players.length, 3, 'Existing players must not be deleted when limit is lowered');
    });
});
