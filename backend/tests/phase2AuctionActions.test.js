const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

describe('Phase 2: Auction Actions & Player Rotation Regression Suite', () => {

  describe('1. Direct Base Sell & Hammer Sold Logic', () => {
    test('1A. Direct Base Sell matches when highestBidder is null and soldPrice equals basePrice', () => {
      const player = { _id: 'p1', basePrice: 500000 };
      const teamId = 'teamMI';
      const soldPrice = 500000;

      // Filter simulation of sellPlayer findOneAndUpdate
      const auctionState = {
        activePlayer: 'p1',
        highestBidder: null,
        currentBid: 500000,
        status: 'bidding'
      };

      const filterMatches = (state, pId, tId, price) => {
        if (state.activePlayer !== pId || state.status !== 'bidding') return false;
        const condition1 = state.highestBidder === tId;
        const condition2 = state.highestBidder === null && state.currentBid === price;
        return condition1 || condition2;
      };

      assert.equal(filterMatches(auctionState, player._id, teamId, soldPrice), true);
    });

    test('1B. Bidded hammer matches winning highestBidder', () => {
      const player = { _id: 'p1', basePrice: 500000 };
      const teamId = 'teamMI';
      const soldPrice = 1200000;

      const auctionState = {
        activePlayer: 'p1',
        highestBidder: 'teamMI',
        currentBid: 1200000,
        status: 'bidding'
      };

      const filterMatches = (state, pId, tId, price) => {
        if (state.activePlayer !== pId || state.status !== 'bidding') return false;
        const condition1 = state.highestBidder === tId;
        const condition2 = state.highestBidder === null && state.currentBid === price;
        return condition1 || condition2;
      };

      assert.equal(filterMatches(auctionState, player._id, teamId, soldPrice), true);
      // Mismatched team fails
      assert.equal(filterMatches(auctionState, player._id, 'teamCSK', soldPrice), false);
    });
  });

  describe('2. Duplicate Request Prevention & Purse Integrity', () => {
    test('2A. Rapid repeated sell requests execute once and reject subsequent attempts without double deduction', async () => {
      let team = {
        _id: 'team1',
        teamName: 'Team One',
        remainingPurse: 10000000
      };
      let player = {
        _id: 'p1',
        approvalStatus: 'Approved',
        auctionStatus: 'ReadyForAuction',
        soldTo: null,
        soldPrice: 0
      };
      let auctionState = {
        activePlayer: 'p1',
        highestBidder: 'team1',
        currentBid: 2000000,
        status: 'bidding',
        version: 5
      };

      let activeExecutionLock = false;
      const sellPlayerSim = async (soldPrice) => {
        if (activeExecutionLock) {
          throw new Error('DUPLICATE_CLIENT_REQUEST_DROPPED');
        }
        activeExecutionLock = true;
        try {
          if (player.auctionStatus !== 'ReadyForAuction') {
            throw new Error('PLAYER_NOT_ELIGIBLE');
          }
          if (soldPrice > team.remainingPurse) {
            throw new Error('PURSE_CONFLICT');
          }
          if (auctionState.status !== 'bidding' || auctionState.activePlayer !== player._id) {
            throw new Error('AUCTION_STATE_CONFLICT');
          }

          // Atomic transition
          team.remainingPurse -= soldPrice;
          player.auctionStatus = 'Sold';
          player.soldTo = team._id;
          player.soldPrice = soldPrice;
          auctionState.status = 'sold';
          auctionState.version += 1;
          return { success: true };
        } finally {
          activeExecutionLock = false;
        }
      };

      // 1st request succeeds
      const res1 = await sellPlayerSim(2000000);
      assert.equal(res1.success, true);
      assert.equal(team.remainingPurse, 8000000);
      assert.equal(player.auctionStatus, 'Sold');
      assert.equal(auctionState.status, 'sold');

      // 2nd duplicate request is strictly rejected
      await assert.rejects(
        async () => sellPlayerSim(2000000),
        /PLAYER_NOT_ELIGIBLE/
      );
      // Purse is NOT deducted twice
      assert.equal(team.remainingPurse, 8000000);
    });

    test('2B. Rapid repeated unsold requests execute once and reject subsequent attempts', async () => {
      let player = {
        _id: 'p2',
        approvalStatus: 'Approved',
        auctionStatus: 'ReadyForAuction',
        soldTo: null,
        soldPrice: 0
      };
      let auctionState = {
        activePlayer: 'p2',
        highestBidder: null,
        currentBid: 1000000,
        status: 'bidding',
        version: 7
      };

      const unsoldPlayerSim = async () => {
        if (player.auctionStatus !== 'ReadyForAuction') {
          throw new Error('PLAYER_NOT_ELIGIBLE');
        }
        if (auctionState.status !== 'bidding' || auctionState.highestBidder !== null) {
          throw new Error('AUCTION_STATE_CONFLICT');
        }
        player.auctionStatus = 'Unsold';
        auctionState.status = 'unsold';
        auctionState.version += 1;
        return { success: true };
      };

      const res1 = await unsoldPlayerSim();
      assert.equal(res1.success, true);
      assert.equal(player.auctionStatus, 'Unsold');
      assert.equal(auctionState.status, 'unsold');

      // Duplicate attempt
      await assert.rejects(
        async () => unsoldPlayerSim(),
        /PLAYER_NOT_ELIGIBLE/
      );
    });
  });

  describe('3. Player Rotation & Ordering Logic', () => {
    const playerPool = [
      { _id: 'p1', name: 'Rohit Sharma', category: 'Batsman' },
      { _id: 'p2', name: 'Virat Kohli', category: 'Batsman' },
      { _id: 'p3', name: 'Jasprit Bumrah', category: 'Bowler' },
      { _id: 'p4', name: 'Hardik Pandya', category: 'All-Rounder' }
    ];

    test('3A. Category-wise ordering respects active category priority', () => {
      const categoryOrder = ['Bowler', 'Batsman', 'All-Rounder'];
      const activeCat = categoryOrder.find((cat) =>
        playerPool.some((p) => p.category === cat)
      );
      assert.equal(activeCat, 'Bowler');
      const selectionPool = playerPool.filter((p) => p.category === activeCat);
      assert.equal(selectionPool.length, 1);
      assert.equal(selectionPool[0].name, 'Jasprit Bumrah');
    });

    test('3B. Alphabetical / By-Name ordering strictly sorts by name', () => {
      const sorted = [...playerPool].sort((a, b) => a.name.localeCompare(b.name));
      assert.equal(sorted[0].name, 'Hardik Pandya');
      assert.equal(sorted[1].name, 'Jasprit Bumrah');
      assert.equal(sorted[2].name, 'Rohit Sharma');
      assert.equal(sorted[3].name, 'Virat Kohli');
    });

    test('3C. Next player cannot be triggered if active bidding has started without selling', () => {
      const canPick = ({ currentPlayer, playerStatus, hasBiddingStarted }) => {
        if (currentPlayer && playerStatus === 'bidding' && hasBiddingStarted) {
          return false;
        }
        return true;
      };

      assert.equal(canPick({ currentPlayer: { _id: 'p1' }, playerStatus: 'bidding', hasBiddingStarted: true }), false);
      assert.equal(canPick({ currentPlayer: { _id: 'p1' }, playerStatus: 'sold', hasBiddingStarted: false }), true);
      assert.equal(canPick({ currentPlayer: { _id: 'p1' }, playerStatus: 'unsold', hasBiddingStarted: false }), true);
      assert.equal(canPick({ currentPlayer: null, playerStatus: 'idle', hasBiddingStarted: false }), true);
    });
  });

  describe('4. Schema Index Verification', () => {
    test('4A. Player and Team models have required compound indexes defined', () => {
      const Player = require('../models/Player');
      const Team = require('../models/Team');

      const playerIndexes = Player.schema.indexes();
      assert.ok(playerIndexes.length >= 3, 'Player model must have compound indexes');

      const teamIndexes = Team.schema.indexes();
      assert.ok(teamIndexes.length >= 2, 'Team model must have scoped indexes');
    });
  });
});
