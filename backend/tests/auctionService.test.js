const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertExpectedVersion, calculateNextBid, configuredIncrements } = require('../services/auctionService');

const tournament = { bidButton1: 500, bidButton2: 1000, bidButton3: 5000, biddingButtonsCount: 3 };
const state = { currentBid: 10000, highestBidder: null };

test('uses only configured increments for ordinary bids', () => {
  assert.deepEqual(configuredIncrements(tournament), [500, 1000, 5000]);
  assert.equal(calculateNextBid({ state, tournament, amount: 1000, bidType: 'increment', allowCustomBid: false }), 11000);
  assert.throws(() => calculateNextBid({ state, tournament, amount: 750, bidType: 'increment', allowCustomBid: false }), /INVALID_INCREMENT/);
});

test('allows organizer custom bid but rejects stale-or-lower amount rules', () => {
  assert.equal(calculateNextBid({ state, tournament, amount: 15000, bidType: 'custom', allowCustomBid: true }), 15000);
  assert.throws(() => calculateNextBid({ state, tournament, amount: 10000, bidType: 'custom', allowCustomBid: true }), /BID_NOT_HIGHER/);
  assert.throws(() => calculateNextBid({ state, tournament, amount: 15000, bidType: 'custom', allowCustomBid: false }), /BID_TYPE_NOT_ALLOWED/);
});

test('rejects stale client versions before an atomic bid update', () => {
  assert.doesNotThrow(() => assertExpectedVersion({ version: 8 }, 8));
  assert.throws(() => assertExpectedVersion({ version: 8 }, 7), /STALE_AUCTION_STATE/);
});

test('allows a zero base-price direct sale but not a zero increment', () => {
  const zeroBaseState = { currentBid: 0, highestBidder: null };
  assert.equal(calculateNextBid({ state: zeroBaseState, tournament, amount: 0, bidType: 'base', allowCustomBid: true }), 0);
  assert.throws(() => calculateNextBid({ state: zeroBaseState, tournament, amount: 0, bidType: 'increment', allowCustomBid: false }), /INVALID_BID_AMOUNT/);
});
