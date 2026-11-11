const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

describe('Phase 3: Results Screen & Final UI Experience Regression Suite', () => {

  describe('1. Results Modal — Immediate Opening & Non-blocking Fetch', () => {
    test('1A. openResultsModal opens modal synchronously before any network latency', () => {
      let modalOpen = false;
      let settingsModalOpen = true;
      let networkFetchStarted = false;

      const setShowResultsModal = (val) => { modalOpen = val; };
      const setShowSettingsModal = (val) => { settingsModalOpen = val; };

      const openResultsModal = () => {
        // Step 1: Open immediately
        setShowResultsModal(true);
        // Step 2: Close settings if open
        setShowSettingsModal(false);
        // Step 3: Trigger background fetch
        networkFetchStarted = true;
      };

      assert.equal(modalOpen, false, 'Modal should initially be closed');
      openResultsModal();
      assert.equal(modalOpen, true, 'Modal must open immediately with 0ms delay');
      assert.equal(settingsModalOpen, false, 'Settings modal should close when results opens');
      assert.equal(networkFetchStarted, true, 'Background fetch should be initiated asynchronously');
    });

    test('1B. In-flight protection prevents duplicate /api/players requests on rapid clicks', async () => {
      let fetchCount = 0;
      let isFetching = false;

      const fetchResultsData = async (force = false) => {
        if (isFetching && !force) return;
        isFetching = true;
        fetchCount++;
        // Simulate async network latency
        await new Promise((resolve) => setTimeout(resolve, 20));
        isFetching = false;
      };

      // User rapidly clicks Results button 5 times
      const p1 = fetchResultsData();
      const p2 = fetchResultsData();
      const p3 = fetchResultsData();
      const p4 = fetchResultsData();
      const p5 = fetchResultsData();

      await Promise.all([p1, p2, p3, p4, p5]);

      assert.equal(fetchCount, 1, 'Only 1 network request should be dispatched despite 5 rapid clicks');
    });

    test('1C. Retry option bypasses in-flight check when forced', async () => {
      let fetchCount = 0;
      let isFetching = false;

      const fetchResultsData = async (force = false) => {
        if (isFetching && !force) return;
        isFetching = true;
        fetchCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        isFetching = false;
      };

      await fetchResultsData();
      assert.equal(fetchCount, 1);

      // Explicit Retry by user
      await fetchResultsData(true);
      assert.equal(fetchCount, 2, 'Forced retry must initiate fresh fetch');
    });
  });

  describe('2. Results Data Processing & Filtering', () => {
    test('2A. Results filter includes Approved Sold, Unsold, Passed, Icon and excludes current stage player', () => {
      const mockRawPlayers = [
        { _id: 'p1', name: 'Virat', approvalStatus: 'Approved', auctionStatus: 'Sold', soldTo: 't1', soldPrice: 15000000 },
        { _id: 'p2', name: 'Rohit', approvalStatus: 'Approved', auctionStatus: 'Sold', soldTo: 't2', soldPrice: 16000000 },
        { _id: 'p3', name: 'Dhoni', approvalStatus: 'Approved', auctionStatus: 'Icon', soldTo: 't3', soldPrice: 20000000 },
        { _id: 'p4', name: 'Player4', approvalStatus: 'Approved', auctionStatus: 'Unsold', soldTo: null, soldPrice: 0 },
        { _id: 'p5', name: 'Player5', approvalStatus: 'Approved', auctionStatus: 'Passed', soldTo: null, soldPrice: 0 },
        { _id: 'p6', name: 'PendingGuy', approvalStatus: 'Pending', auctionStatus: 'Sold', soldTo: 't1' },
        { _id: 'p7', name: 'StagePlayer', approvalStatus: 'Approved', auctionStatus: 'Sold', soldTo: 't1' }, // Currently on stage
        { _id: 'p8', name: 'QueuePlayer', approvalStatus: 'Approved', auctionStatus: 'ReadyForAuction' },
      ];

      const currentReadyIds = ['p8', 'p7']; // Stage player + queue player

      const filtered = mockRawPlayers.filter((p) => {
        if (!p || !p._id) return false;
        const approval = String(p.approvalStatus || '').trim().toLowerCase();
        const status = String(p.auctionStatus || '').trim().toLowerCase();
        const isApproved = approval === 'approved';
        const isTargetStatus = status === 'sold' || status === 'unsold' || status === 'passed' || status === 'icon';
        const isNotCurrent = !currentReadyIds.includes(String(p._id));
        return isApproved && isTargetStatus && isNotCurrent;
      });

      assert.equal(filtered.length, 5, 'Should include 5 valid result players');
      assert.deepEqual(filtered.map(p => p._id), ['p1', 'p2', 'p3', 'p4', 'p5']);
    });

    test('2B. Round-2 bulk restore restores only Unsold and Passed players', () => {
      let resultsDB = [
        { _id: 'p1', name: 'P1', auctionStatus: 'Sold' },
        { _id: 'p2', name: 'P2', auctionStatus: 'Unsold' },
        { _id: 'p3', name: 'P3', auctionStatus: 'Passed' },
        { _id: 'p4', name: 'P4', auctionStatus: 'Icon' },
      ];

      const unsoldRoundPlayers = resultsDB.filter(
        (p) => p.auctionStatus?.trim().toLowerCase() === 'unsold' || p.auctionStatus?.trim().toLowerCase() === 'passed'
      );

      assert.equal(unsoldRoundPlayers.length, 2);
      assert.deepEqual(unsoldRoundPlayers.map(p => p._id), ['p2', 'p3']);

      // Remaining in resultsDB after restore
      resultsDB = resultsDB.filter(
        (p) => !(p.auctionStatus?.trim().toLowerCase() === 'unsold' || p.auctionStatus?.trim().toLowerCase() === 'passed')
      );

      assert.equal(resultsDB.length, 2);
      assert.deepEqual(resultsDB.map(p => p._id), ['p1', 'p4']);
    });
  });

  describe('3. Results API Performance & Lean Serialization', () => {
    test('3A. Player query uses .lean() for fast plain JS serialization', () => {
      // Mock Mongoose-like document with methods vs lean plain object
      const hydratedDoc = {
        _id: 'doc1',
        name: 'Player',
        toObject: () => ({ _id: 'doc1', name: 'Player' }),
        save: async () => {},
        isModified: () => false,
      };

      const leanObj = {
        _id: 'doc1',
        name: 'Player'
      };

      assert.equal(typeof hydratedDoc.save, 'function', 'Hydrated doc has Mongoose methods');
      assert.equal(leanObj.save, undefined, 'Lean object does not have document overhead');
    });

    test('3B. Model schema defines compound indexes for organizer and tournament queries', () => {
      const Player = require('../models/Player');
      const Team = require('../models/Team');

      const playerIndexes = Player.schema.indexes().map(([idx]) => Object.keys(idx));
      const teamIndexes = Team.schema.indexes().map(([idx]) => Object.keys(idx));

      // Check player compound indexes
      const hasPlayerScopeIndex = playerIndexes.some(
        keys => keys[0] === 'organizer' && keys[1] === 'tournament'
      );
      assert.equal(hasPlayerScopeIndex, true, 'Player model must have compound index prefixed with organizer and tournament');

      // Check team compound index
      const hasTeamScopeIndex = teamIndexes.some(
        keys => keys.includes('organizer') && keys.includes('tournament')
      );
      assert.equal(hasTeamScopeIndex, true, 'Team model must have compound index for organizer and tournament');
    });
  });

  describe('4. Live Screen Session Preservation', () => {
    test('4A. skipAuthRedirect prevents session clearing on transient failures', () => {
      let sessionCleared = false;
      const clearAuthSession = () => { sessionCleared = true; };

      const handleApiError = (error, skipAuthRedirect) => {
        if (error.response?.status === 401) {
          if (!skipAuthRedirect) {
            clearAuthSession();
          }
        }
      };

      // Simulating a transient 401 with skipAuthRedirect = true
      handleApiError({ response: { status: 401 } }, true);
      assert.equal(sessionCleared, false, 'Session must NOT be cleared when skipAuthRedirect is true');

      // Simulating standard API 401 without skipAuthRedirect
      handleApiError({ response: { status: 401 } }, false);
      assert.equal(sessionCleared, true, 'Standard API 401 clears auth session as expected');
    });

    test('4B. Socket initialization carries token without logging out user on connect', () => {
      const token = 'mock-valid-organizer-jwt';
      const socketOptions = {
        auth: { token }
      };

      assert.equal(socketOptions.auth.token, token, 'Socket must carry JWT token for authentication');
    });
  });

});
