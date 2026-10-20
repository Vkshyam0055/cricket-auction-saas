const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const {
  getJwtSecret,
  createTeamOwnerSessionAndToken,
  validateTeamOwnerSession,
  revokeTeamOwnerSessions,
  revokeOtherTeamOwnerSessions,
  revokeSessionById
} = require('../utils/sessionAuth');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_for_phase1_security';
}

describe('Phase 1: Login & Session Security Gate Suite', () => {
  const organizerId = '660000000000000000000101';
  const tournamentId = '660000000000000000000102';
  const teamId = '660000000000000000000103';

  // In-memory mock storage for UserSession
  const sessions = new Map();
  let sessionAutoInc = 1;

  // Mock UserSession model for isolated testing
  const mockUserSession = {
    create: async (doc) => {
      const _id = `mock_sid_${sessionAutoInc++}`;
      const record = { _id, ...doc, revokedAt: doc.revokedAt || null };
      sessions.set(String(_id), record);
      return record;
    },
    findOne: ({ _id, team, organizer, tournament, sessionRole, revokedAt }) => ({
      lean: async () => {
        const record = sessions.get(String(_id));
        if (!record) return null;
        if (team && String(record.team) !== String(team)) return null;
        if (organizer && String(record.organizer) !== String(organizer)) return null;
        if (tournament && String(record.tournament) !== String(tournament)) return null;
        if (sessionRole && record.sessionRole !== sessionRole) return null;
        if (revokedAt === null && record.revokedAt !== null) return null;
        return record;
      }
    }),
    updateOne: async ({ _id, revokedAt }, { $set }) => {
      const record = sessions.get(String(_id));
      if (!record) return { modifiedCount: 0 };
      if (revokedAt === null && record.revokedAt !== null) return { modifiedCount: 0 };
      Object.assign(record, $set);
      return { modifiedCount: 1 };
    },
    updateMany: async (query, { $set }) => {
      let count = 0;
      for (const [id, rec] of sessions.entries()) {
        let match = true;
        if (query.team && String(rec.team) !== String(query.team)) match = false;
        if (query.sessionRole && rec.sessionRole !== query.sessionRole) match = false;
        if (query.revokedAt === null && rec.revokedAt !== null) match = false;
        if (query._id && query._id.$ne && String(id) === String(query._id.$ne)) match = false;
        if (match) {
          Object.assign(rec, $set);
          count++;
        }
      }
      return { modifiedCount: count };
    }
  };

  // Wire mock into require cache for UserSession
  const UserSession = require('../models/UserSession');
  let originalCreate, originalFindOne, originalUpdateOne, originalUpdateMany;

  before(() => {
    originalCreate = UserSession.create;
    originalFindOne = UserSession.findOne;
    originalUpdateOne = UserSession.updateOne;
    originalUpdateMany = UserSession.updateMany;

    UserSession.create = mockUserSession.create;
    UserSession.findOne = mockUserSession.findOne;
    UserSession.updateOne = mockUserSession.updateOne;
    UserSession.updateMany = mockUserSession.updateMany;
  });

  after(() => {
    UserSession.create = originalCreate;
    UserSession.findOne = originalFindOne;
    UserSession.updateOne = originalUpdateOne;
    UserSession.updateMany = originalUpdateMany;
  });

  // =========================================================================
  // Test 1: Username Enumeration Prevention on /team-login logic
  // =========================================================================
  test('1. Username enumeration guard: Invalid password always returns 400 whether remote access is enabled or disabled', async () => {
    const rawCorrectPassword = 'superSecretPassword123';
    const passwordHash = await bcrypt.hash(rawCorrectPassword, 10);

    const teamEnabled = {
      _id: teamId,
      remoteUsername: 'csk_user',
      remotePasswordHash: passwordHash,
      remoteAccessEnabled: true
    };

    const teamDisabled = {
      _id: teamId,
      remoteUsername: 'rcb_user',
      remotePasswordHash: passwordHash,
      remoteAccessEnabled: false
    };

    // Helper simulating auth.js team-login evaluation logic
    const evaluateTeamLogin = async (targetTeam, candidatePassword) => {
      if (!targetTeam) return { status: 400, message: 'Invalid credentials' };
      const isMatch = await bcrypt.compare(candidatePassword, targetTeam.remotePasswordHash || '');
      if (!isMatch) return { status: 400, message: 'Invalid credentials' };
      if (!targetTeam.remoteAccessEnabled) return { status: 403, message: 'Remote access is disabled for this team' };
      return { status: 200, message: 'Team Login Successful' };
    };

    // Case A: Correct password + Enabled => 200 Success
    const resSuccess = await evaluateTeamLogin(teamEnabled, rawCorrectPassword);
    assert.equal(resSuccess.status, 200);

    // Case B: Correct password + Disabled => 403 (informative to legitimate owner)
    const resDisabledCorrect = await evaluateTeamLogin(teamDisabled, rawCorrectPassword);
    assert.equal(resDisabledCorrect.status, 403);
    assert.equal(resDisabledCorrect.message, 'Remote access is disabled for this team');

    // Case C: WRONG password + Enabled => 400 Invalid credentials
    const resWrongEnabled = await evaluateTeamLogin(teamEnabled, 'wrongPassword!');
    assert.equal(resWrongEnabled.status, 400);
    assert.equal(resWrongEnabled.message, 'Invalid credentials');

    // Case D: WRONG password + Disabled => 400 Invalid credentials (NOT 403! Enumeration prevented)
    const resWrongDisabled = await evaluateTeamLogin(teamDisabled, 'wrongPassword!');
    assert.equal(resWrongDisabled.status, 400);
    assert.equal(resWrongDisabled.message, 'Invalid credentials');

    // Case E: Non-existent team => 400 Invalid credentials
    const resNonExistent = await evaluateTeamLogin(null, 'anyPassword');
    assert.equal(resNonExistent.status, 400);
    assert.equal(resNonExistent.message, 'Invalid credentials');
  });

  // =========================================================================
  // Test 2: Password Change Revocation of Other Sessions
  // =========================================================================
  test('2. Changing password revokes all existing sessions except the current active session', async () => {
    sessions.clear();

    const teamObj = { _id: teamId, tournament: tournamentId, organizer: organizerId };

    // Device 1 (Current session)
    const session1 = await createTeamOwnerSessionAndToken({ team: teamObj, deviceId: 'phone_1' });
    // Device 2 (Other session on tablet)
    const session2 = await createTeamOwnerSessionAndToken({ team: teamObj, deviceId: 'tablet_2' });
    // Device 3 (Old session on laptop)
    const session3 = await createTeamOwnerSessionAndToken({ team: teamObj, deviceId: 'laptop_3' });

    // Validate all 3 are initially active
    const val1Before = await validateTeamOwnerSession({ sessionId: session1.session._id, teamId, organizerId, tournamentId });
    const val2Before = await validateTeamOwnerSession({ sessionId: session2.session._id, teamId, organizerId, tournamentId });
    const val3Before = await validateTeamOwnerSession({ sessionId: session3.session._id, teamId, organizerId, tournamentId });
    assert.equal(val1Before.ok, true);
    assert.equal(val2Before.ok, true);
    assert.equal(val3Before.ok, true);

    // Device 1 changes password -> revoke other sessions for this team
    await revokeOtherTeamOwnerSessions(teamId, session1.session._id);

    // Device 1 (current) must still be active
    const val1After = await validateTeamOwnerSession({ sessionId: session1.session._id, teamId, organizerId, tournamentId });
    assert.equal(val1After.ok, true, 'Current session must remain active after password change');

    // Devices 2 and 3 must be revoked
    const val2After = await validateTeamOwnerSession({ sessionId: session2.session._id, teamId, organizerId, tournamentId });
    const val3After = await validateTeamOwnerSession({ sessionId: session3.session._id, teamId, organizerId, tournamentId });
    assert.equal(val2After.ok, false);
    assert.equal(val2After.reason, 'SESSION_REVOKED_OR_NOT_FOUND');
    assert.equal(val3After.ok, false);
    assert.equal(val3After.reason, 'SESSION_REVOKED_OR_NOT_FOUND');
  });

  // =========================================================================
  // Test 3: Logout revokes session
  // =========================================================================
  test('3. Logout revokes the specific session via revokeSessionById', async () => {
    sessions.clear();
    const teamObj = { _id: teamId, tournament: tournamentId, organizer: organizerId };
    const session = await createTeamOwnerSessionAndToken({ team: teamObj, deviceId: 'test_phone' });

    const valActive = await validateTeamOwnerSession({ sessionId: session.session._id, teamId, organizerId, tournamentId });
    assert.equal(valActive.ok, true);

    await revokeSessionById(session.session._id);

    const valRevoked = await validateTeamOwnerSession({ sessionId: session.session._id, teamId, organizerId, tournamentId });
    assert.equal(valRevoked.ok, false);
    assert.equal(valRevoked.reason, 'SESSION_REVOKED_OR_NOT_FOUND');
  });

  // =========================================================================
  // Test 4: Organizer Disabling Remote Access Revokes ALL Sessions
  // =========================================================================
  test('4. Organizer disabling remote access revokes ALL team sessions immediately', async () => {
    sessions.clear();
    const teamObj = { _id: teamId, tournament: tournamentId, organizer: organizerId };

    const sessionA = await createTeamOwnerSessionAndToken({ team: teamObj, deviceId: 'phone_a' });
    const sessionB = await createTeamOwnerSessionAndToken({ team: teamObj, deviceId: 'phone_b' });

    await revokeTeamOwnerSessions(teamId);

    const valA = await validateTeamOwnerSession({ sessionId: sessionA.session._id, teamId, organizerId, tournamentId });
    const valB = await validateTeamOwnerSession({ sessionId: sessionB.session._id, teamId, organizerId, tournamentId });
    assert.equal(valA.ok, false);
    assert.equal(valB.ok, false);
  });

  // =========================================================================
  // Test 5: Client-side Token Expiry Logic Helper Test
  // =========================================================================
  test('5. isTokenExpired logic correctly differentiates valid vs expired JWT tokens', () => {
    const isTokenExpiredHelper = (token) => {
      try {
        if (!token) return true;
        const payloadPart = token.split('.')[1];
        if (!payloadPart) return true;
        const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
        const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
        const exp = Number(payload?.exp || 0);
        if (!exp) return true;
        return Date.now() >= exp * 1000;
      } catch {
        return true;
      }
    };

    const validToken = jwt.sign({ role: 'TeamOwner' }, getJwtSecret(), { expiresIn: '1h' });
    const expiredToken = jwt.sign({ role: 'TeamOwner' }, getJwtSecret(), { expiresIn: '-10s' });

    assert.equal(isTokenExpiredHelper(validToken), false);
    assert.equal(isTokenExpiredHelper(expiredToken), true);
    assert.equal(isTokenExpiredHelper(null), true);
    assert.equal(isTokenExpiredHelper('invalid.token'), true);
  });
});
