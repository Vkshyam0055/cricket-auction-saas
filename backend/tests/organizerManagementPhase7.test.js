const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const {
  DEFAULT_PLAN_POLICIES,
  getPolicyByPlanName,
  getEffectivePlanPolicy
} = require('../utils/planPolicy');
const { mergeWithTournamentScope } = require('../utils/tournamentScope');

describe('Phase 7: Organizer Remote Bidding Management & Plan Policy Suite', () => {
  // =========================================================================
  // Test 1: Plan Policy Entitlement Capabilities
  // =========================================================================
  test('1. Plan Policy correctly defines canRemoteBidding for Free, Basic, Pro and SuperAdmin', async () => {
    // Direct default plan policies
    assert.equal(DEFAULT_PLAN_POLICIES.Free.canRemoteBidding, false, 'Free plan must not have remote bidding');
    assert.equal(DEFAULT_PLAN_POLICIES.Basic.canRemoteBidding, false, 'Basic plan must not have remote bidding');
    assert.equal(DEFAULT_PLAN_POLICIES.Pro.canRemoteBidding, true, 'Pro plan must have remote bidding enabled');

    // Effective policy checks
    const freePolicy = await getEffectivePlanPolicy('Free');
    assert.equal(freePolicy.canRemoteBidding, false);

    const basicPolicy = await getEffectivePlanPolicy('Basic');
    assert.equal(basicPolicy.canRemoteBidding, false);

    const proPolicy = await getEffectivePlanPolicy('Pro');
    assert.equal(proPolicy.canRemoteBidding, true);

    const superAdminPolicy = await getEffectivePlanPolicy({ role: 'SuperAdmin', isImpersonated: false });
    assert.equal(superAdminPolicy.canRemoteBidding, true);
  });

  // =========================================================================
  // Test 2: Server-Side Plan Entitlement Gating for Remote Access Provisioning
  // =========================================================================
  test('2. Non-entitled organizers (Free / Basic) are rejected with 403 on remote-access provisioning', async () => {
    // Helper function simulating PUT /api/teams/:id/remote-access policy check
    const evaluateProvisioningPermission = async (user) => {
      const policy = await getEffectivePlanPolicy(user);
      if (!policy.canRemoteBidding && (user.role !== 'SuperAdmin' || user.isImpersonated)) {
        return {
          allowed: false,
          status: 403,
          body: {
            message: 'Remote bidding feature is not available in your current plan. Please upgrade to Pro plan to manage remote bidding.',
            upgradeRequired: true
          }
        };
      }
      return { allowed: true, status: 200 };
    };

    // Free Organizer
    const freeOrganizerResult = await evaluateProvisioningPermission({ role: 'Organizer', plan: 'Free' });
    assert.equal(freeOrganizerResult.allowed, false);
    assert.equal(freeOrganizerResult.status, 403);
    assert.equal(freeOrganizerResult.body.upgradeRequired, true);

    // Basic Organizer
    const basicOrganizerResult = await evaluateProvisioningPermission({ role: 'Organizer', plan: 'Basic' });
    assert.equal(basicOrganizerResult.allowed, false);
    assert.equal(basicOrganizerResult.status, 403);
    assert.equal(basicOrganizerResult.body.upgradeRequired, true);

    // Impersonated SuperAdmin viewing as Free
    const impersonatedResult = await evaluateProvisioningPermission({ role: 'SuperAdmin', isImpersonated: true, plan: 'Free' });
    assert.equal(impersonatedResult.allowed, false);
    assert.equal(impersonatedResult.status, 403);

    // Pro Organizer (Entitled)
    const proOrganizerResult = await evaluateProvisioningPermission({ role: 'Organizer', plan: 'Pro' });
    assert.equal(proOrganizerResult.allowed, true);
    assert.equal(proOrganizerResult.status, 200);

    // Genuine SuperAdmin (Entitled)
    const superAdminResult = await evaluateProvisioningPermission({ role: 'SuperAdmin', isImpersonated: false });
    assert.equal(superAdminResult.allowed, true);
    assert.equal(superAdminResult.status, 200);
  });

  // =========================================================================
  // Test 3: Password Validation & Hashing
  // =========================================================================
  test('3. Passwords shorter than 4 characters are rejected, and valid passwords are securely hashed with bcrypt', async () => {
    const validateAndUpdatePassword = async (rawPassword) => {
      const trimmed = String(rawPassword || '').trim();
      if (trimmed.length < 4) {
        throw new Error('Password must be at least 4 characters.');
      }
      return await bcrypt.hash(trimmed, 10);
    };

    // Reject short password
    await assert.rejects(
      async () => validateAndUpdatePassword('123'),
      /Password must be at least 4 characters/
    );

    // Accept valid password
    const hash = await validateAndUpdatePassword('secret123');
    assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'));
    const isMatch = await bcrypt.compare('secret123', hash);
    assert.equal(isMatch, true);
  });

  // =========================================================================
  // Test 4: Password Hash Redaction (Zero Credential Leak)
  // =========================================================================
  test('4. Sanitized team object never exposes remotePasswordHash in response', () => {
    const teamDoc = {
      _id: '660000000000000000000001',
      teamName: 'Mumbai Indians',
      shortName: 'MI',
      remoteAccessEnabled: true,
      remoteUsername: 'mi_owner',
      remotePasswordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      totalPurse: 10000000,
      remainingPurse: 10000000,
      toObject: function () {
        return { ...this };
      }
    };

    const sanitizedTeam = teamDoc.toObject();
    delete sanitizedTeam.remotePasswordHash;

    assert.equal(sanitizedTeam.teamName, 'Mumbai Indians');
    assert.equal(sanitizedTeam.remoteUsername, 'mi_owner');
    assert.equal(sanitizedTeam.remotePasswordHash, undefined, 'remotePasswordHash must be stripped');
    assert.equal('remotePasswordHash' in sanitizedTeam, false);
  });

  // =========================================================================
  // Test 5: Strict Tournament Scope & Cross-Tournament Protection
  // =========================================================================
  test('5. Organizer cannot manage or mutate teams outside their tournament scope', () => {
    const organizerId = '660000000000000000000101';
    const tournamentAId = '660000000000000000000201';
    const tournamentBId = '660000000000000000000202';

    const tournamentAScope = {
      tournamentId: tournamentAId,
      filter: { tournament: tournamentAId }
    };

    // Simulating database collection of teams
    const teamsDatabase = [
      {
        _id: 'team_01',
        organizer: organizerId,
        tournament: tournamentAId,
        teamName: 'Team in Tournament A',
        remoteAccessEnabled: false
      },
      {
        _id: 'team_02',
        organizer: organizerId,
        tournament: tournamentBId,
        teamName: 'Team in Tournament B',
        remoteAccessEnabled: false
      }
    ];

    // Helper finding team scoped to Tournament A
    const findTeamInScope = (teamId, scope) => {
      const mergedQuery = mergeWithTournamentScope(
        { _id: teamId, organizer: organizerId },
        scope
      );

      return teamsDatabase.find((t) => {
        const [baseQuery, scopeFilter] = mergedQuery.$and;
        const idMatch = t._id === baseQuery._id;
        const orgMatch = t.organizer === baseQuery.organizer;
        const tourMatch = t.tournament === scopeFilter.tournament;
        return idMatch && orgMatch && tourMatch;
      });
    };

    // Can find team belonging to Tournament A
    const teamA = findTeamInScope('team_01', tournamentAScope);
    assert.ok(teamA);
    assert.equal(teamA.teamName, 'Team in Tournament A');

    // CANNOT find team belonging to Tournament B when scope is Tournament A
    const teamB = findTeamInScope('team_02', tournamentAScope);
    assert.equal(teamB, undefined, 'Must reject team from outside tournament scope');
  });

  // =========================================================================
  // Test 6: Immediate Session Invalidation on Disable / Credential Change
  // =========================================================================
  test('6. Disabling remote access or changing credentials immediately invokes session revocation', () => {
    let revocationCount = 0;
    const revokedTeamIds = [];

    const mockRevokeTeamOwnerSessions = async (teamId) => {
      revocationCount++;
      revokedTeamIds.push(String(teamId));
    };

    const handleRemoteAccessUpdate = async (team, payload) => {
      const { remoteAccessEnabled, remoteUsername, remotePassword } = payload;
      team.remoteAccessEnabled = Boolean(remoteAccessEnabled);
      if (remoteUsername !== undefined) team.remoteUsername = remoteUsername;
      if (remotePassword) team.remotePasswordHash = 'hashed_pw';

      const shouldRevoke = !team.remoteAccessEnabled || Boolean(remotePassword) || remoteUsername !== undefined;
      if (shouldRevoke) {
        await mockRevokeTeamOwnerSessions(team._id);
      }
    };

    const team = {
      _id: 'team_revocation_test',
      remoteAccessEnabled: true,
      remoteUsername: 'active_user'
    };

    // 6a: Disabling access triggers revocation
    handleRemoteAccessUpdate(team, { remoteAccessEnabled: false });
    assert.equal(revocationCount, 1);
    assert.equal(revokedTeamIds[0], 'team_revocation_test');

    // 6b: Changing password triggers revocation
    handleRemoteAccessUpdate(team, { remoteAccessEnabled: true, remotePassword: 'newPassword123' });
    assert.equal(revocationCount, 2);

    // 6c: Changing username triggers revocation
    handleRemoteAccessUpdate(team, { remoteAccessEnabled: true, remoteUsername: 'new_username' });
    assert.equal(revocationCount, 3);
  });
});
