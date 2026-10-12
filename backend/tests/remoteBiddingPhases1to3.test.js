const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

// Phase 1 imports
const {
  buildTournamentScopeFilter,
  mergeWithTournamentScope
} = require('../utils/tournamentScope');

// Phase 2 imports
const {
  assertExpectedVersion,
  calculateNextBid,
  configuredIncrements
} = require('../services/auctionService');

// Phase 3 imports
const { getJwtSecret } = require('../utils/sessionAuth');

// Set dummy JWT_SECRET for test environment if not present
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_for_remote_bidding_phase1_3';
}

// ==========================================
// PHASE 1: Tournament Scoping & Identity
// ==========================================

test('Phase 1: strict tournament scope filter matches only specified tournament', () => {
  const filter = buildTournamentScopeFilter('tourn-101');
  assert.deepEqual(filter, { tournament: 'tourn-101' });
});

test('Phase 1: legacy tournament scope filter includes tournament and missing fields', () => {
  const filter = buildTournamentScopeFilter('tourn-101', true);
  assert.deepEqual(filter, {
    $or: [
      { tournament: 'tourn-101' },
      { tournament: null },
      { tournament: { $exists: false } }
    ]
  });
});

test('Phase 1: mergeWithTournamentScope preserves organizer constraints', () => {
  const query = mergeWithTournamentScope(
    { organizer: 'org-1', teamName: 'Warriors' },
    { filter: buildTournamentScopeFilter('tourn-101') }
  );
  assert.deepEqual(query, {
    $and: [
      { organizer: 'org-1', teamName: 'Warriors' },
      { tournament: 'tourn-101' }
    ]
  });
});

// ==========================================
// PHASE 2: Authoritative Auction Engine
// ==========================================

const tournamentConfig = {
  bidButton1: 500,
  bidButton2: 1000,
  bidButton3: 2000,
  biddingButtonsCount: 3
};

const auctionState = {
  currentBid: 5000,
  highestBidder: null
};

test('Phase 2: extracts configured increments strictly up to biddingButtonsCount', () => {
  assert.deepEqual(configuredIncrements(tournamentConfig), [500, 1000, 2000]);
  assert.deepEqual(configuredIncrements({ ...tournamentConfig, biddingButtonsCount: 2 }), [500, 1000]);
  assert.deepEqual(configuredIncrements({ ...tournamentConfig, biddingButtonsCount: 1 }), [500]);
});

test('Phase 2: accepts valid increment for Team Owner (allowCustomBid: false)', () => {
  const nextBid = calculateNextBid({
    state: auctionState,
    tournament: tournamentConfig,
    amount: 1000,
    bidType: 'increment',
    allowCustomBid: false
  });
  assert.equal(nextBid, 6000);
});

test('Phase 2: rejects unconfigured increment for Team Owner', () => {
  assert.throws(
    () => calculateNextBid({
      state: auctionState,
      tournament: tournamentConfig,
      amount: 1500, // not in [500, 1000, 2000]
      bidType: 'increment',
      allowCustomBid: false
    }),
    /INVALID_INCREMENT/
  );
});

test('Phase 2: rejects custom bid attempt from Team Owner (allowCustomBid: false)', () => {
  assert.throws(
    () => calculateNextBid({
      state: auctionState,
      tournament: tournamentConfig,
      amount: 10000,
      bidType: 'custom',
      allowCustomBid: false
    }),
    /BID_TYPE_NOT_ALLOWED/
  );
});

test('Phase 2: allows organizer custom bid exceeding current bid (allowCustomBid: true)', () => {
  const nextBid = calculateNextBid({
    state: auctionState,
    tournament: tournamentConfig,
    amount: 15000,
    bidType: 'custom',
    allowCustomBid: true
  });
  assert.equal(nextBid, 15000);
});

test('Phase 2: rejects organizer custom bid equal to or below current bid', () => {
  assert.throws(
    () => calculateNextBid({
      state: auctionState,
      tournament: tournamentConfig,
      amount: 5000,
      bidType: 'custom',
      allowCustomBid: true
    }),
    /BID_NOT_HIGHER/
  );
});

test('Phase 2: enforces version checks and rejects stale versions', () => {
  assert.doesNotThrow(() => assertExpectedVersion({ version: 4 }, 4));
  assert.throws(() => assertExpectedVersion({ version: 4 }, 3), /STALE_AUCTION_STATE/);
  assert.throws(() => assertExpectedVersion({ version: 4 }, 5), /STALE_AUCTION_STATE/);
});

// ==========================================
// PHASE 3: Team Owner Authentication & Session
// ==========================================

test('Phase 3: Team Owner JWT encodes required session identity claims', () => {
  const teamId = '660000000000000000000001';
  const organizerId = '660000000000000000000002';
  const tournamentId = '660000000000000000000003';
  const sid = '660000000000000000000004';

  const token = jwt.sign(
    { role: 'TeamOwner', teamId, organizerId, tournamentId, sid },
    getJwtSecret(),
    { expiresIn: '12h' }
  );

  const decoded = jwt.verify(token, getJwtSecret());
  assert.equal(decoded.role, 'TeamOwner');
  assert.equal(decoded.teamId, teamId);
  assert.equal(decoded.organizerId, organizerId);
  assert.equal(decoded.tournamentId, tournamentId);
  assert.equal(decoded.sid, sid);
});

test('Phase 3: Team Owner JWT fails verification with incorrect secret', () => {
  const token = jwt.sign(
    { role: 'TeamOwner', teamId: 't1', organizerId: 'o1', tournamentId: 'tourn1', sid: 's1' },
    'wrong_secret'
  );
  assert.throws(() => jwt.verify(token, getJwtSecret()), /invalid signature/);
});

test('Phase 3: Team Owner JWT fails verification when expired', () => {
  const token = jwt.sign(
    { role: 'TeamOwner', teamId: 't1', organizerId: 'o1', tournamentId: 'tourn1', sid: 's1' },
    getJwtSecret(),
    { expiresIn: '-1s' }
  );
  assert.throws(() => jwt.verify(token, getJwtSecret()), /jwt expired/);
});
