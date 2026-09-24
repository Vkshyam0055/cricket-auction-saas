const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './.env' });

const User = require('../models/User');
const UserSession = require('../models/UserSession');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Player = require('../models/Player');
const { createSessionAndToken } = require('../utils/sessionAuth');

describe('Team Identity & Normalization Test Suite', () => {
    let app;
    let server;
    let baseUrl;
    let organizer;
    let organizerToken;
    let tournament;

    const request = async (method, path, body = null, token = organizerToken) => {
        const url = `${baseUrl}${path}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            }
        };
        if (body) {
            options.body = JSON.stringify(body);
        }
        const res = await fetch(url, options);
        let data = null;
        const text = await res.text();
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
        return { status: res.status, ok: res.ok, data };
    };

    before(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI);
        }

        app = express();
        app.use(express.json());
        app.use('/api/tournament', require('../routes/tournament'));
        app.use('/api/teams', require('../routes/team'));
        app.use('/api/players', require('../routes/player'));

        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, resolve));
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;

        const timestamp = Date.now();
        const hashedPassword = await bcrypt.hash('Secret123!', 8);
        organizer = await User.create({
            name: `Test Organizer Identity ${timestamp}`,
            phone: `9111${String(timestamp).slice(-6)}`,
            email: `org_identity_${timestamp}@example.com`,
            password: hashedPassword,
            role: 'Organizer',
            plan: 'Pro'
        });

        const auth = await createSessionAndToken({ user: organizer, deviceId: 'test_rig' });
        organizerToken = auth.token;

        tournament = await Tournament.create({
            name: `Identity Cup ${timestamp}`,
            venue: 'Eden Gardens',
            organizer: organizer._id
        });
    });

    after(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        if (organizer) {
            await User.deleteOne({ _id: organizer._id });
            await UserSession.deleteMany({ user: organizer._id });
            await Tournament.deleteMany({ organizer: organizer._id });
            await Team.deleteMany({ organizer: organizer._id });
            await Player.deleteMany({ organizer: organizer._id });
        }
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });

    test('1. Short Name validation & duplicate rejection on POST', async () => {
        // Test invalid short names (too long, non-alphanumeric, lowercase)
        const resTooLong = await request('POST', '/api/teams', {
            teamName: 'Super Strikers',
            shortName: 'TOOLONG123',
            totalPurse: 1000000
        });
        assert.equal(resTooLong.status, 400);

        const resInvalidChar = await request('POST', '/api/teams', {
            teamName: 'Super Strikers',
            shortName: 'SS-1',
            totalPurse: 1000000
        });
        assert.equal(resInvalidChar.status, 400);

        // Valid creation
        const resCreate = await request('POST', '/api/teams', {
            teamName: 'Super Strikers',
            shortName: 'SS',
            totalPurse: 1000000,
            remainingPurse: 1000000,
            minPlayersPerTeam: 11,
            maxPlayersPerTeam: 15
        });
        assert.equal(resCreate.status, 200);
        assert.equal(resCreate.data.shortName, 'SS');

        // Duplicate shortName for same organizer should be rejected
        const resDupShort = await request('POST', '/api/teams', {
            teamName: 'Southern Stars',
            shortName: 'SS',
            totalPurse: 1000000
        });
        assert.equal(resDupShort.status, 400);
        assert.match(resDupShort.data.message, /short name/i);

        // Duplicate teamName for same organizer should be rejected
        const resDupName = await request('POST', '/api/teams', {
            teamName: 'Super Strikers',
            shortName: 'SST',
            totalPurse: 1000000
        });
        assert.equal(resDupName.status, 400);
        assert.match(resDupName.data.message, /टीम|team/i);
    });

    test('2. Duplicate check on PUT (Full Team Name & Short Name)', async () => {
        // Create second team
        const resTeam2 = await request('POST', '/api/teams', {
            teamName: 'Royal Challengers',
            shortName: 'RC',
            totalPurse: 1000000,
            remainingPurse: 1000000
        });
        assert.equal(resTeam2.status, 200);
        const team2Id = resTeam2.data._id;

        // Try updating team 2 to have team 1's teamName ("Super Strikers") -> should fail
        const resConflictName = await request('PUT', `/api/teams/${team2Id}`, {
            teamName: 'Super Strikers',
            shortName: 'RC'
        });
        assert.equal(resConflictName.status, 400);
        assert.match(resConflictName.data.message, /टीम नाम|team name/i);

        // Try updating team 2 to have team 1's shortName ("SS") -> should fail
        const resConflictShort = await request('PUT', `/api/teams/${team2Id}`, {
            teamName: 'Royal Challengers',
            shortName: 'SS'
        });
        assert.equal(resConflictShort.status, 400);
        assert.match(resConflictShort.data.message, /short name/i);

        // Updating self with same name and new shortName should succeed
        const resUpdateSelf = await request('PUT', `/api/teams/${team2Id}`, {
            teamName: 'Royal Challengers',
            shortName: 'RC2'
        });
        assert.equal(resUpdateSelf.status, 200);
        assert.equal(resUpdateSelf.data.shortName, 'RC2');
    });

    test('3. Full Team Name rename safety: sold player reference, purse & undo remain intact', async () => {
        // 1. Get Team 1 ("Super Strikers", "SS")
        const team1 = await Team.findOne({ organizer: organizer._id, teamName: 'Super Strikers' });
        assert.ok(team1, 'Team 1 should exist');

        // 2. Create a test player
        const player = await Player.create({
            name: 'Rohit Sharma Test',
            mobile: '9876543210',
            category: 'Platinum',
            role: 'Batsman',
            basePrice: 20000,
            approvalStatus: 'Approved',
            auctionStatus: 'ReadyForAuction',
            organizer: organizer._id,
            tournament: tournament._id
        });

        // 3. Sell player to Team 1 via teamId
        const resSell = await request('PUT', `/api/players/sell/${player._id}`, {
            teamId: String(team1._id),
            teamName: team1.teamName,
            soldPrice: 75000
        });
        assert.equal(resSell.status, 200);

        // Verify player in DB has soldTo pointing to team1._id (ObjectId)
        const soldPlayerDb = await Player.findById(player._id);
        assert.equal(String(soldPlayerDb.soldTo), String(team1._id));
        assert.equal(soldPlayerDb.auctionStatus, 'Sold');
        assert.equal(soldPlayerDb.soldPrice, 75000);

        // Verify team1 remainingPurse is deducted
        const team1AfterSell = await Team.findById(team1._id);
        assert.equal(team1AfterSell.remainingPurse, 1000000 - 75000);

        // 4. RENAME Team 1's Full Name and Short Name
        const resRename = await request('PUT', `/api/teams/${team1._id}`, {
            teamName: 'Mumbai Maestros',
            shortName: 'MM'
        });
        assert.equal(resRename.status, 200);
        assert.equal(resRename.data.teamName, 'Mumbai Maestros');
        assert.equal(resRename.data.shortName, 'MM');

        // 5. Verify Player soldTo reference is still stable Team ObjectId
        const playerAfterRename = await Player.findById(player._id);
        assert.equal(String(playerAfterRename.soldTo), String(team1._id));

        // 6. Verify GET /api/players populates new teamName and shortName seamlessly
        const resGetPlayers = await request('GET', '/api/players');
        assert.equal(resGetPlayers.status, 200);
        const fetchedPlayer = resGetPlayers.data.find((p) => String(p._id) === String(player._id));
        assert.ok(fetchedPlayer);
        assert.equal(fetchedPlayer.soldTo?.teamName, 'Mumbai Maestros');
        assert.equal(fetchedPlayer.soldTo?.shortName, 'MM');

        // 7. Verify GET /api/teams calculates maxBid squad counts correctly for renamed team
        const resGetTeams = await request('GET', '/api/teams');
        assert.equal(resGetTeams.status, 200);
        const fetchedTeam = resGetTeams.data.find((t) => String(t._id) === String(team1._id));
        assert.ok(fetchedTeam);
        assert.equal(fetchedTeam.teamName, 'Mumbai Maestros');
        assert.equal(fetchedTeam.remainingPurse, 1000000 - 75000);

        // 8. Test Undo on renamed team: refund must go to Mumbai Maestros (by _id)
        const resUndo = await request('PUT', `/api/players/undo/${player._id}`);
        assert.equal(resUndo.status, 200);

        // Verify team purse is fully refunded
        const team1AfterUndo = await Team.findById(team1._id);
        assert.equal(team1AfterUndo.remainingPurse, 1000000);

        // Verify player is reset to ReadyForAuction and soldTo is null
        const playerAfterUndo = await Player.findById(player._id);
        assert.equal(playerAfterUndo.soldTo, null);
        assert.equal(playerAfterUndo.auctionStatus, 'ReadyForAuction');
    });

    test('4. Team Deletion Guard blocks deleting teams with sold players', async () => {
        // Re-sell player to team1 ("Mumbai Maestros")
        const team1 = await Team.findOne({ organizer: organizer._id, teamName: 'Mumbai Maestros' });
        const player = await Player.findOne({ organizer: organizer._id, name: 'Rohit Sharma Test' });

        const resSell = await request('PUT', `/api/players/sell/${player._id}`, {
            teamId: String(team1._id),
            teamName: team1.teamName,
            soldPrice: 50000
        });
        assert.equal(resSell.status, 200);

        // Try to delete team1 while player is sold to it -> MUST BE REJECTED with 400
        const resDeleteBlocked = await request('DELETE', `/api/teams/${team1._id}`);
        assert.equal(resDeleteBlocked.status, 400);
        assert.match(resDeleteBlocked.data.message, /सोल्ड\/आइकन|खिलाड़ी/i);

        // Undo auction so player is no longer sold
        await request('PUT', `/api/players/undo/${player._id}`);

        // Now deletion should succeed
        const resDeleteAllowed = await request('DELETE', `/api/teams/${team1._id}`);
        assert.equal(resDeleteAllowed.status, 200);

        // Verify team is deleted
        const teamCheck = await Team.findById(team1._id);
        assert.equal(teamCheck, null);
    });

    test('5. Icon Player assignment and removal via teamId', async () => {
        // Team 2 ("Royal Challengers", "RC2")
        const team2 = await Team.findOne({ organizer: organizer._id, teamName: 'Royal Challengers' });
        assert.ok(team2);

        const iconPlayer = await Player.create({
            name: 'Virat Kohli Test',
            mobile: '9876543211',
            category: 'Platinum',
            role: 'Batsman',
            basePrice: 50000,
            approvalStatus: 'Approved',
            auctionStatus: 'ReadyForAuction',
            organizer: organizer._id,
            tournament: tournament._id
        });

        // Assign as Icon player to team2 via teamId
        const resMakeIcon = await request('PUT', `/api/players/make-icon/${iconPlayer._id}`, {
            teamId: String(team2._id),
            teamName: team2.teamName,
            iconPrice: 150000
        });
        assert.equal(resMakeIcon.status, 200);

        const iconDb = await Player.findById(iconPlayer._id);
        assert.equal(String(iconDb.soldTo), String(team2._id));
        assert.equal(iconDb.isIcon, true);
        assert.equal(iconDb.soldPrice, 150000);
        assert.equal(iconDb.auctionStatus, 'Icon');

        const team2AfterIcon = await Team.findById(team2._id);
        assert.equal(team2AfterIcon.remainingPurse, 1000000 - 150000);

        // Remove Icon status
        const resRemoveIcon = await request('PUT', `/api/players/remove-icon/${iconPlayer._id}`, {
            teamId: String(team2._id),
            teamName: team2.teamName
        });
        assert.equal(resRemoveIcon.status, 200);

        const iconRemovedDb = await Player.findById(iconPlayer._id);
        assert.equal(iconRemovedDb.soldTo, null);
        assert.equal(iconRemovedDb.isIcon, false);
        assert.equal(iconRemovedDb.auctionStatus, 'ReadyForAuction');

        const team2AfterRemove = await Team.findById(team2._id);
        assert.equal(team2AfterRemove.remainingPurse, 1000000);
    });
});
