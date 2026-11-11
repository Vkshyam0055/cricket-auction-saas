const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { assertExpectedVersion, calculateNextBid } = require('../services/auctionService');

describe('Rapid Consecutive Bidding Regression Suite', () => {

  describe('1. Backend Concurrency Invariant Protection', () => {
    test('1A. Exact matching positive version passes strictly', () => {
      assert.doesNotThrow(() => assertExpectedVersion({ version: 1 }, 1));
      assert.doesNotThrow(() => assertExpectedVersion({ version: 15 }, 15));
      assert.doesNotThrow(() => assertExpectedVersion({ version: 42 }, '42'));
    });

    test('1B. Stale or lagged version throws 409 STALE_AUCTION_STATE with currentVersion attached', () => {
      try {
        assertExpectedVersion({ version: 10 }, 9);
        assert.fail('Should have thrown STALE_AUCTION_STATE');
      } catch (err) {
        assert.equal(err.message, 'STALE_AUCTION_STATE');
        assert.equal(err.statusCode, 409);
        assert.equal(err.publicMessage, 'Auction state changed. Refresh and retry.');
        assert.equal(err.currentVersion, 10);
      }
    });

    test('1C. Future / desynced higher version also throws 409 STALE_AUCTION_STATE', () => {
      try {
        assertExpectedVersion({ version: 10 }, 12);
        assert.fail('Should have thrown STALE_AUCTION_STATE');
      } catch (err) {
        assert.equal(err.message, 'STALE_AUCTION_STATE');
        assert.equal(err.statusCode, 409);
        assert.equal(err.currentVersion, 10);
      }
    });

    test('1D. Null, undefined, 0, or empty string is safely bypassed without version check error', () => {
      assert.doesNotThrow(() => assertExpectedVersion({ version: 10 }, null));
      assert.doesNotThrow(() => assertExpectedVersion({ version: 10 }, undefined));
      assert.doesNotThrow(() => assertExpectedVersion({ version: 10 }, 0));
      assert.doesNotThrow(() => assertExpectedVersion({ version: 10 }, ''));
    });
  });

  describe('2. Rapid Consecutive Bidding Simulation with Synchronous Ref & Monotonic Version Guards', () => {
    test('2A. 10 rapid concurrent bids in FIFO queue all succeed without version errors', async () => {
      let backendState = {
        version: 1,
        currentBid: 10000,
        highestBidder: null
      };

      const mockPlaceBidApi = async ({ teamId, amount, expectedVersion }) => {
        // Strict version check identical to backend auctionService
        assertExpectedVersion(backendState, expectedVersion);
        backendState.version += 1;
        backendState.currentBid += amount;
        backendState.highestBidder = teamId;
        return {
          data: {
            state: {
              version: backendState.version,
              currentBid: backendState.currentBid,
              highestBidder: backendState.highestBidder
            }
          }
        };
      };

      // Client state and refs
      const auctionVersionRef = { current: 1 };
      let auctionVersionState = null;
      const currentBidRef = { current: 10000 };
      const biddingTeamRef = { current: '' };
      const pendingEffects = [];

      function setAuctionVersion(newVer) {
        pendingEffects.push(() => {
          auctionVersionState = newVer;
          if (auctionVersionState !== null && auctionVersionState !== undefined) {
            const num = Number(auctionVersionState);
            // GUARANTEED: Only advance, NEVER regress!
            if (Number.isFinite(num) && num > auctionVersionRef.current) {
              auctionVersionRef.current = num;
            }
          }
        });
      }

      let activeBidPromiseRef = null;

      const updateBid = async (teamId, amount) => {
        const executeBid = async () => {
          let retries = 0;
          const maxRetries = 2;

          while (retries <= maxRetries) {
            const curExpectedVersion = (auctionVersionRef?.current && auctionVersionRef.current > 0)
              ? auctionVersionRef.current
              : undefined;

            try {
              const res = await mockPlaceBidApi({ teamId, amount, expectedVersion: curExpectedVersion });
              const newVer = res.data.state.version;
              const acceptedBid = res.data.state.currentBid;

              if (newVer > auctionVersionRef.current) {
                auctionVersionRef.current = newVer;
              }
              if (currentBidRef) currentBidRef.current = acceptedBid;
              if (biddingTeamRef) biddingTeamRef.current = teamId;
              setAuctionVersion(newVer);
              return true;
            } catch (err) {
              const isConflict = err.statusCode === 409 &&
                (err.message === 'STALE_AUCTION_STATE' || err.message === 'BID_CONFLICT');

              if (err.currentVersion && err.currentVersion > auctionVersionRef.current) {
                auctionVersionRef.current = err.currentVersion;
                setAuctionVersion(err.currentVersion);
              }

              if (isConflict && retries < maxRetries) {
                retries++;
                continue;
              }
              throw err;
            }
          }
        };

        const prev = activeBidPromiseRef || Promise.resolve();
        const curr = prev.then(() => executeBid(), () => executeBid());
        activeBidPromiseRef = curr;
        try {
          return await curr;
        } finally {
          if (activeBidPromiseRef === curr) {
            activeBidPromiseRef = null;
          }
        }
      };

      // Dispatch 10 rapid concurrent bids across 4 teams
      const teams = ['teamA', 'teamB', 'teamC', 'teamD'];
      const bidPromises = [];
      for (let i = 0; i < 10; i++) {
        bidPromises.push(updateBid(teams[i % teams.length], 500));
      }

      const results = await Promise.all(bidPromises);
      assert.equal(results.length, 10);
      results.forEach((r) => assert.equal(r, true));

      // Flush any queued React effects (simulating delayed component renders)
      while (pendingEffects.length > 0) {
        pendingEffects.shift()();
      }

      // Assert version progressed strictly monotonically: initial 1 + 10 = 11
      assert.equal(backendState.version, 11);
      assert.equal(auctionVersionRef.current, 11);
      assert.equal(backendState.currentBid, 10000 + (10 * 500));
      assert.equal(currentBidRef.current, backendState.currentBid);
      assert.equal(backendState.highestBidder, 'teamB'); // 10th bid: 9 % 4 = 1 ('teamB')
      assert.equal(biddingTeamRef.current, 'teamB');
    });

    test('2B. Simulated out-of-band conflict is automatically resolved by 1 retry without alert', async () => {
      let backendState = {
        version: 5,
        currentBid: 20000,
        highestBidder: 'teamA'
      };

      const mockPlaceBidApi = async ({ teamId, amount, expectedVersion }) => {
        assertExpectedVersion(backendState, expectedVersion);
        backendState.version += 1;
        backendState.currentBid += amount;
        backendState.highestBidder = teamId;
        return {
          data: {
            state: {
              version: backendState.version,
              currentBid: backendState.currentBid,
              highestBidder: backendState.highestBidder
            }
          }
        };
      };

      // Client starts with version 5
      const auctionVersionRef = { current: 5 };
      let auctionVersionState = 5;
      const currentBidRef = { current: 20000 };
      const biddingTeamRef = { current: 'teamA' };

      // In the background, a remote bid executes directly on the server, incrementing version to 6
      backendState.version = 6;
      backendState.currentBid = 21000;
      backendState.highestBidder = 'teamRemote';

      // Operator clicks bid with expectedVersion 5 (stale by 1)
      let activeBidPromiseRef = null;
      let retryCount = 0;

      const updateBid = async (teamId, amount) => {
        const executeBid = async () => {
          let retries = 0;
          const maxRetries = 2;

          while (retries <= maxRetries) {
            const curExpectedVersion = auctionVersionRef.current;
            try {
              const res = await mockPlaceBidApi({ teamId, amount, expectedVersion: curExpectedVersion });
              const newVer = res.data.state.version;
              const acceptedBid = res.data.state.currentBid;

              if (newVer > auctionVersionRef.current) {
                auctionVersionRef.current = newVer;
              }
              currentBidRef.current = acceptedBid;
              biddingTeamRef.current = teamId;
              return true;
            } catch (err) {
              const isConflict = err.statusCode === 409 &&
                (err.message === 'STALE_AUCTION_STATE' || err.message === 'BID_CONFLICT');

              if (err.currentVersion && err.currentVersion > auctionVersionRef.current) {
                auctionVersionRef.current = err.currentVersion;
              }

              if (isConflict && retries < maxRetries) {
                retries++;
                retryCount++;
                continue;
              }
              throw err;
            }
          }
        };

        const prev = activeBidPromiseRef || Promise.resolve();
        const curr = prev.then(() => executeBid(), () => executeBid());
        activeBidPromiseRef = curr;
        return curr;
      };

      const success = await updateBid('teamB', 1000);
      assert.equal(success, true);
      assert.equal(retryCount, 1, 'Conflict was cleanly retried exactly once');
      assert.equal(backendState.version, 7, 'Final server version is 7');
      assert.equal(backendState.currentBid, 22000, 'Final bid is 22000');
      assert.equal(backendState.highestBidder, 'teamB');
      assert.equal(auctionVersionRef.current, 7);
    });
  });
});
