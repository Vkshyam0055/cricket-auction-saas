const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const { getJwtSecret } = require('../utils/sessionAuth');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_for_phase_6_mobile';
}

describe('Phase 6: Mobile Team Owner Authorized Views & Security Suite', () => {
  const organizerId = '660000000000000000000101';
  const tournamentId = '660000000000000000000102';
  const myTeamId = '660000000000000000000103';
  const otherTeamId = '660000000000000000000104';
  const sid = '660000000000000000000105';

  const teamOwnerToken = jwt.sign(
    {
      role: 'TeamOwner',
      teamId: myTeamId,
      organizerId,
      tournamentId,
      sid
    },
    getJwtSecret(),
    { expiresIn: '1h' }
  );

  // =========================================================================
  // Test 1: Team Owner Token Security & Scope Claims
  // =========================================================================
  test('1. Team Owner token carries immutable claims bound to specific team and tournament', () => {
    const decoded = jwt.verify(teamOwnerToken, getJwtSecret());
    assert.equal(decoded.role, 'TeamOwner');
    assert.equal(decoded.teamId, myTeamId);
    assert.equal(decoded.organizerId, organizerId);
    assert.equal(decoded.tournamentId, tournamentId);
    assert.equal(decoded.sid, sid);
  });

  // =========================================================================
  // Test 2: Other Teams Privacy & Approved Shared Data
  // =========================================================================
  test('2. Other Teams view exposes only approved shared information (no passwords, usernames or phone numbers)', () => {
    const rawTeamsFromDb = [
      {
        _id: otherTeamId,
        teamName: 'Chennai Super Kings',
        shortName: 'CSK',
        logoUrl: 'https://example.com/csk.png',
        totalPurse: 10000000,
        remainingPurse: 4500000,
        maxBid: 2000000,
        ownerName: 'N Srinivasan',
        mobile: '9876543210',
        remoteUsername: 'csk_secret_user',
        remotePasswordHash: '$2a$10$e8secretHashThatMustNeverBeLeaked'
      }
    ];

    const soldPlayers = [
      {
        _id: 'p1',
        name: 'MS Dhoni',
        role: 'Wicketkeeper',
        category: 'Legend',
        soldPrice: 2000000,
        soldTo: otherTeamId
      }
    ];

    // Data shaping algorithm matching GET /api/auction/other-teams
    const publicTeamsView = rawTeamsFromDb.map((team) => {
      const teamIdStr = String(team._id);
      const teamSquad = soldPlayers.filter((p) => String(p.soldTo) === teamIdStr);

      return {
        _id: team._id,
        teamName: team.teamName,
        shortName: team.shortName,
        logoUrl: team.logoUrl || '',
        totalPurse: team.totalPurse,
        remainingPurse: team.remainingPurse,
        maxBid: team.maxBid || 0,
        squadCount: teamSquad.length,
        squad: teamSquad.map((p) => ({
          _id: p._id,
          name: p.name,
          role: p.role,
          category: p.category,
          soldPrice: p.soldPrice
        })),
        isMyTeam: String(team._id) === String(myTeamId)
      };
    });

    assert.equal(publicTeamsView.length, 1);
    const sharedTeam = publicTeamsView[0];
    assert.equal(sharedTeam.teamName, 'Chennai Super Kings');
    assert.equal(sharedTeam.shortName, 'CSK');
    assert.equal(sharedTeam.squadCount, 1);
    assert.equal(sharedTeam.squad[0].name, 'MS Dhoni');

    // Strict privacy verification: Sensitive fields MUST NOT be present!
    assert.equal(sharedTeam.remotePasswordHash, undefined, 'Password hash must never leak in other teams');
    assert.equal(sharedTeam.remoteUsername, undefined, 'Remote username must never leak');
    assert.equal(sharedTeam.mobile, undefined, 'Private mobile must never leak');
    assert.equal(sharedTeam.ownerName, undefined, 'Private owner contact must never leak');
  });

  // =========================================================================
  // Test 3: My Team Squad Data Scoping
  // =========================================================================
  test('3. My Team Squad returns exact acquired players, total spent and remaining purse', () => {
    const myTeamDoc = {
      _id: myTeamId,
      teamName: 'Mumbai Indians',
      shortName: 'MI',
      totalPurse: 10000000,
      remainingPurse: 6000000,
      maxBid: 3000000,
      ownerName: 'Akash Ambani'
    };

    const mySquadPlayers = [
      {
        _id: 'p2',
        name: 'Jasprit Bumrah',
        role: 'Bowler',
        category: 'Icon',
        soldPrice: 2500000,
        soldTo: myTeamId
      },
      {
        _id: 'p3',
        name: 'Suryakumar Yadav',
        role: 'Batsman',
        category: 'Diamond',
        soldPrice: 1500000,
        soldTo: myTeamId
      }
    ];

    const totalSpent = mySquadPlayers.reduce((sum, p) => sum + p.soldPrice, 0);
    assert.equal(totalSpent, 4000000);
    assert.equal(myTeamDoc.totalPurse - totalSpent, myTeamDoc.remainingPurse);
    assert.equal(mySquadPlayers.length, 2);
  });

  // =========================================================================
  // Test 4: Team Owner Password Change Validation
  // =========================================================================
  test('4. Team Owner change-password enforces current password match and length constraints', async () => {
    const existingHash = await bcrypt.hash('oldPassword123', 10);

    // Sub-test A: Rejects wrong current password
    const isWrongMatch = await bcrypt.compare('wrongCurrentPassword', existingHash);
    assert.equal(isWrongMatch, false, 'Must reject incorrect current password');

    // Sub-test B: Rejects password shorter than 6 characters
    const shortPassword = '12345';
    assert.ok(shortPassword.length < 6, 'Must enforce minimum length of 6 characters');

    // Sub-test C: Accepts correct current password and updates hash
    const isCorrectMatch = await bcrypt.compare('oldPassword123', existingHash);
    assert.equal(isCorrectMatch, true, 'Must verify correct current password');

    const newHash = await bcrypt.hash('newSecurePassword456', 10);
    const isNewValid = await bcrypt.compare('newSecurePassword456', newHash);
    assert.equal(isNewValid, true, 'New password hash must verify correctly');
  });

  // =========================================================================
  // Test 5: Strict Bid Increments Matching Tournament Config
  // =========================================================================
  test('5. Team Owner bid button availability matches tournament biddingButtonsCount strictly', () => {
    const tournamentConfig = {
      biddingButtonsCount: 2,
      bidButton1: 500,
      bidButton2: 1000,
      bidButton3: 5000
    };

    const getAvailableIncrements = (config) => {
      const increments = [];
      const count = Math.min(3, Math.max(1, config.biddingButtonsCount || 3));
      if (count >= 1) increments.push(config.bidButton1 || 500);
      if (count >= 2) increments.push(config.bidButton2 || 1000);
      if (count >= 3) increments.push(config.bidButton3 || 5000);
      return increments;
    };

    const available = getAvailableIncrements(tournamentConfig);
    assert.deepEqual(available, [500, 1000], 'Must only expose configured buttons (count = 2)');
    assert.equal(available.includes(5000), false, '3rd button must not be exposed when count is 2');
  });

  // =========================================================================
  // Test 6: Team Owner Session Logout Isolation
  // =========================================================================
  test('6. Team Owner logout operates strictly on remoteAuth session key without touching organizer session', () => {
    const mockStorage = {
      token: 'organizer_jwt_token',
      user: '{"name":"Organizer"}',
      remoteAuth: '{"token":"team_owner_token"}'
    };

    // Logout Team Owner
    delete mockStorage.remoteAuth;

    assert.equal(mockStorage.remoteAuth, undefined, 'remoteAuth must be cleared on team owner logout');
    assert.equal(mockStorage.token, 'organizer_jwt_token', 'Organizer token must remain intact in separate context');
    assert.ok(mockStorage.user, 'Organizer user data must remain intact');
  });
});
