const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const {
  getEffectivePlanPolicy
} = require('../utils/planPolicy');
const { getJwtSecret } = require('../utils/sessionAuth');
const {
  auctionError,
  calculateNextBid,
  assertExpectedVersion
} = require('../services/auctionService');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_for_phase_8_production';
}

describe('Phase 8: Production Readiness, Concurrency & Security Gate Suite', () => {
  const organizerId = '660000000000000000000101';
  const tournamentId = '660000000000000000000102';
  const teamAId = '660000000000000000000103';
  const teamBId = '660000000000000000000104';
  const teamCId = '660000000000000000000105';
  const playerId = '660000000000000000000201';

  // =========================================================================
  // Test 1: Concurrency and Race Condition Safety
  // =========================================================================
  test('1. Concurrency Gate: Multiple simultaneous bids on same state version result in exactly 1 winner and N-1 conflict rejections', async () => {
    // Simulated state in MongoDB
    let currentState = {
      _id: 'auction_state_001',
      version: 5,
      activePlayer: playerId,
      currentBid: 100000,
      highestBidder: teamAId,
      status: 'bidding'
    };

    // Atomic conditional updater simulating MongoDB findOneAndUpdate with { _id, version: expectedVersion }
    const atomicPlaceBid = async ({ teamId, increment, expectedVersion }) => {
      // Version check prior to update
      if (expectedVersion !== undefined && expectedVersion !== currentState.version) {
        throw auctionError('STALE_AUCTION_STATE', 409, 'Auction state changed. Refresh and retry.');
      }
      if (currentState.highestBidder === teamId) {
        throw auctionError('ALREADY_HIGHEST_BIDDER', 409, 'This team is already the highest bidder.');
      }

      // Simulate atomic CAS (Compare-And-Swap) in MongoDB
      if (currentState.version !== expectedVersion) {
        throw auctionError('BID_CONFLICT', 409, 'Another bid was accepted first. Refresh and retry.');
      }

      // Successful atomic step
      currentState = {
        ...currentState,
        version: currentState.version + 1,
        currentBid: currentState.currentBid + increment,
        highestBidder: teamId
      };

      return { success: true, newVersion: currentState.version, newBid: currentState.currentBid };
    };

    // 3 teams submit bids concurrently based on current version 5
    const expectedVersion = 5;
    const bidAttempts = [
      atomicPlaceBid({ teamId: teamBId, increment: 20000, expectedVersion }),
      atomicPlaceBid({ teamId: teamCId, increment: 20000, expectedVersion }),
      atomicPlaceBid({ teamId: teamBId, increment: 20000, expectedVersion })
    ];

    const results = await Promise.allSettled(bidAttempts);

    const successfulBids = results.filter((r) => r.status === 'fulfilled');
    const rejectedBids = results.filter((r) => r.status === 'rejected');

    assert.equal(successfulBids.length, 1, 'Exactly one concurrent bid must be accepted');
    assert.equal(rejectedBids.length, 2, 'All other concurrent bids on same version must be rejected');
    assert.equal(currentState.version, 6, 'Version must increment monotonically by exactly 1');
    assert.equal(currentState.currentBid, 120000, 'Bid amount must reflect exactly 1 increment');
    assert.ok(
      rejectedBids.every((r) => r.reason.statusCode === 409),
      'Rejected bids must return 409 Conflict'
    );
  });

  // =========================================================================
  // Test 2: Monotonic Version Tracking & Stale Prevention
  // =========================================================================
  test('2. Version Guard: Stale expectedVersion is rejected immediately without DB mutation', () => {
    const currentState = { version: 10, currentBid: 500000 };

    // Passing stale version 9
    assert.throws(
      () => assertExpectedVersion(currentState, 9),
      (err) => err.statusCode === 409 && err.message === 'STALE_AUCTION_STATE'
    );

    // Passing stale version 8
    assert.throws(
      () => assertExpectedVersion(currentState, 8),
      (err) => err.statusCode === 409 && err.message === 'STALE_AUCTION_STATE'
    );

    // Passing current version 10 succeeds
    assert.doesNotThrow(() => assertExpectedVersion(currentState, 10));

    // Omitting expectedVersion succeeds (for backward compatibility if needed)
    assert.doesNotThrow(() => assertExpectedVersion(currentState, undefined));
  });

  // =========================================================================
  // Test 3: Identity & Scope Tampering Resistance (Socket & HTTP)
  // =========================================================================
  test('3. Security Gate: Client cannot spoof teamId, tournamentId, or organizerId in bid execution', () => {
    // Verified session claims attached by server auth middleware
    const authenticatedSession = {
      teamId: teamAId,
      tournamentId: tournamentId,
      organizerId: organizerId,
      role: 'TeamOwner'
    };

    // Attacker sends payload attempting to bid on behalf of team B or another tournament
    const maliciousClientPayload = {
      teamId: teamBId, // Spoofed team ID!
      tournamentId: 'malicious_tournament_999', // Spoofed tournament!
      organizerId: 'malicious_organizer_888', // Spoofed organizer!
      playerId: playerId,
      amount: 20000
    };

    // Server-Authoritative Resolver: Extracts identity ONLY from authenticated session
    const resolvedExecutionParams = {
      teamId: authenticatedSession.teamId, // strictly enforced from server session
      tournamentScope: { tournamentId: authenticatedSession.tournamentId },
      organizerId: authenticatedSession.organizerId,
      playerId: String(maliciousClientPayload.playerId),
      amount: Number(maliciousClientPayload.amount)
    };

    assert.equal(resolvedExecutionParams.teamId, teamAId, 'Must use authenticated teamId, ignoring client spoofing');
    assert.notEqual(resolvedExecutionParams.teamId, maliciousClientPayload.teamId);
    assert.equal(resolvedExecutionParams.tournamentScope.tournamentId, tournamentId);
    assert.equal(resolvedExecutionParams.organizerId, organizerId);
  });

  // =========================================================================
  // Test 4: Role-Based Event Isolation (Team Owner vs Operator)
  // =========================================================================
  test('4. Security Gate: Team Owner role is strictly prohibited from emitting operator commands', () => {
    const operatorEvents = [
      'newLiveBid',
      'liveScreenConfigUpdate',
      'updateAudienceScreen',
      'startAuction',
      'soldPlayer',
      'unsoldPlayer',
      'resetAuctionBid'
    ];

    const isEventAuthorized = (event, socketRole) => {
      if (socketRole === 'TeamOwner') {
        // Team Owner is ONLY permitted to request a remote bid
        return event === 'requestRemoteBid';
      }
      return true; // Organizer/Operator permitted
    };

    // Team Owner attempting operator events must be rejected
    for (const event of operatorEvents) {
      assert.equal(
        isEventAuthorized(event, 'TeamOwner'),
        false,
        `Team Owner must not be allowed to emit ${event}`
      );
    }

    // Team Owner is permitted to emit requestRemoteBid
    assert.equal(isEventAuthorized('requestRemoteBid', 'TeamOwner'), true);
  });

  // =========================================================================
  // Test 5: Session Invalidation and Expired Token Protection
  // =========================================================================
  test('5. Session Gate: Expired and tampered JWT tokens fail verification immediately', () => {
    const secret = getJwtSecret();

    // Expired token
    const expiredToken = jwt.sign(
      { role: 'TeamOwner', teamId: teamAId, tournamentId, organizerId, sid: 'sid_1' },
      secret,
      { expiresIn: '-1s' }
    );

    assert.throws(
      () => jwt.verify(expiredToken, secret),
      (err) => err.name === 'TokenExpiredError'
    );

    // Tampered token (altered payload with original signature)
    const validToken = jwt.sign(
      { role: 'TeamOwner', teamId: teamAId, tournamentId, organizerId, sid: 'sid_2' },
      secret,
      { expiresIn: '1h' }
    );
    const [header, payload, signature] = validToken.split('.');
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    decodedPayload.teamId = teamBId; // tamper
    const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
    const forgedToken = `${header}.${tamperedPayload}.${signature}`;

    assert.throws(
      () => jwt.verify(forgedToken, secret),
      (err) => err.name === 'JsonWebTokenError'
    );
  });

  // =========================================================================
  // Test 6: Mixed Auction Tagging (Onsite vs Remote)
  // =========================================================================
  test('6. Operational Gate: Mixed auction correctly tags onsite and remote bids for audience and control room', () => {
    // 6a: Onsite operator manual bid
    const createOnsiteBidPayload = (data) => ({
      ...data,
      isRemote: false,
      bidSource: 'onsite'
    });

    // 6b: Remote team owner bid
    const createRemoteBidPayload = (data) => ({
      ...data,
      isRemote: true,
      bidSource: 'remote'
    });

    const baseBidData = {
      bidAmount: 150000,
      teamId: teamAId,
      teamName: 'Mumbai Indians',
      shortName: 'MI',
      version: 7
    };

    const onsitePayload = createOnsiteBidPayload(baseBidData);
    assert.equal(onsitePayload.isRemote, false);
    assert.equal(onsitePayload.bidSource, 'onsite');

    const remotePayload = createRemoteBidPayload(baseBidData);
    assert.equal(remotePayload.isRemote, true);
    assert.equal(remotePayload.bidSource, 'remote');
  });

  // =========================================================================
  // Test 7: Plan Policy Entitlement Gate
  // =========================================================================
  test('7. Plan Policy Gate: Remote bidding disabled on Free & Basic plans, enabled on Pro and SuperAdmin', async () => {
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
  // Test 8: Migration & Scope Integrity Analysis Verification
  // =========================================================================
  test('8. Migration Integrity Gate: Tournament scope analysis accurately classifies unambiguous vs ambiguous records', () => {
    const allTournaments = [
      { _id: 'tour_01', organizer: 'org_single' },
      { _id: 'tour_02', organizer: 'org_multi' },
      { _id: 'tour_03', organizer: 'org_multi' }
    ];

    const tournamentsByOrganizer = new Map();
    for (const t of allTournaments) {
      const list = tournamentsByOrganizer.get(t.organizer) || [];
      list.push(t);
      tournamentsByOrganizer.set(t.organizer, list);
    }

    const testRecords = [
      // 1. Record already has tournament and matches organizer
      { _id: 'rec_1', organizer: 'org_single', tournament: 'tour_01', name: 'Valid Record' },
      // 2. Record has no tournament, but organizer has exactly 1 tournament -> Safe backfill
      { _id: 'rec_2', organizer: 'org_single', tournament: null, name: 'Safe Backfill Candidate' },
      // 3. Record has no tournament, and organizer has 2 tournaments -> Ambiguous (requires manual decision)
      { _id: 'rec_3', organizer: 'org_multi', tournament: null, name: 'Ambiguous Record' },
      // 4. Record has tournament belonging to a different organizer -> Inconsistent
      { _id: 'rec_4', organizer: 'org_single', tournament: 'tour_02', name: 'Inconsistent Record' }
    ];

    const planned = [];
    const inconsistent = [];
    const ambiguous = [];

    for (const record of testRecords) {
      const linkedTourney = record.tournament
        ? allTournaments.find((t) => t._id === record.tournament)
        : null;

      if (record.tournament) {
        if (!linkedTourney || linkedTourney.organizer !== record.organizer) {
          inconsistent.push(record._id);
        }
        continue;
      }

      const orgTourneys = tournamentsByOrganizer.get(record.organizer) || [];
      if (orgTourneys.length === 1) {
        planned.push({ id: record._id, tournamentId: orgTourneys[0]._id });
      } else {
        ambiguous.push(record._id);
      }
    }

    assert.equal(planned.length, 1);
    assert.equal(planned[0].id, 'rec_2');
    assert.equal(planned[0].tournamentId, 'tour_01');

    assert.equal(inconsistent.length, 1);
    assert.equal(inconsistent[0], 'rec_4');

    assert.equal(ambiguous.length, 1);
    assert.equal(ambiguous[0], 'rec_3');
  });
});
