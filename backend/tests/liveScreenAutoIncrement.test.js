const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Phase 6: Live Screen Integration & Stability Automated Test Suite
 *
 * Verifies the Live Screen state machine, layout suppression rules, Socket.IO
 * synchronization, version protection, and transition safety across:
 * - Frontend/src/pages/LiveScreen.jsx
 * - Frontend/src/pages/ControlPanel.jsx
 */

describe('Phase 6: Live Screen Integration & Stability Suite', () => {

  // Live Screen simulated state engine reflecting LiveScreen.jsx
  const createLiveScreenEngine = () => {
    let state = {
      currentPlayer: null,
      liveBid: 0,
      liveTeam: '',
      liveTeamData: null,
      playerStatus: 'bidding',
      isAwaitingTeam: false
    };

    let lastAuctionVersionRef = { current: 0 };

    const teams = [
      { _id: 'team_csk', teamName: 'Chennai Super Kings', shortName: 'CSK', logoUrl: 'https://csk.png' },
      { _id: 'team_mi', teamName: 'Mumbai Indians', shortName: 'MI', logoUrl: 'https://mi.png' },
      { _id: 'team_rcb', teamName: 'Royal Challengers Bengaluru', shortName: 'RCB', logoUrl: 'https://rcb.png' }
    ];

    const resolveTeam = (teamRef) => {
      if (!teamRef) return null;
      if (typeof teamRef === 'object') {
        const id = teamRef._id ? String(teamRef._id) : null;
        if (id) {
          const match = teams.find(t => String(t._id) === id);
          if (match) return match;
        }
        return teamRef;
      }
      const str = String(teamRef).trim().toLowerCase();
      return teams.find(t => String(t._id) === str || t.teamName.toLowerCase() === str) || null;
    };

    const getTeamFullName = (teamRef) => {
      if (!teamRef) return '';
      const match = resolveTeam(teamRef);
      if (match?.teamName) return match.teamName;
      if (typeof teamRef === 'object' && teamRef?.teamName) return teamRef.teamName;
      if (typeof teamRef === 'string') return teamRef;
      return '';
    };

    const getTeamShortName = (teamRef) => {
      if (!teamRef) return '';
      const match = resolveTeam(teamRef);
      if (match?.shortName) return match.shortName;
      if (match?.teamName) return match.teamName.slice(0, 3).toUpperCase();
      if (typeof teamRef === 'object') return teamRef?.shortName || teamRef?.teamName?.slice(0, 3).toUpperCase() || '';
      if (typeof teamRef === 'string') return teamRef.slice(0, 3).toUpperCase();
      return '';
    };

    const getTeamLogo = (teamRef) => {
      if (!teamRef) return '';
      const match = resolveTeam(teamRef);
      return match?.logoUrl || match?.logo || (typeof teamRef === 'object' ? (teamRef?.logoUrl || teamRef?.logo || '') : '');
    };

    const getActiveBidderInfo = () => {
      const activeBidderTeam = (state.liveTeam || state.liveTeamData)
        ? (resolveTeam(state.liveTeamData) || resolveTeam(state.liveTeam) || state.liveTeamData)
        : null;
      return {
        team: activeBidderTeam,
        logo: activeBidderTeam ? getTeamLogo(activeBidderTeam) : '',
        shortName: activeBidderTeam ? getTeamShortName(activeBidderTeam) : '',
        fullName: activeBidderTeam ? (getTeamFullName(activeBidderTeam) || state.liveTeam || '') : ''
      };
    };

    // State hydrator (matches GET /api/auction/state logic in LiveScreen.jsx)
    const hydrateFromState = (data) => {
      if (!data || !data.activePlayer) return;
      const incomingVersion = Number(data.version) || 0;
      if (incomingVersion > 0 && incomingVersion < lastAuctionVersionRef.current) {
        return; // Stale state rejected
      }
      if (incomingVersion > 0) {
        lastAuctionVersionRef.current = incomingVersion;
      }
      state.currentPlayer = data.activePlayer;
      state.liveBid = Number(data.currentBid || 0);
      const isAwaiting = data.isAwaitingTeam !== undefined
        ? Boolean(data.isAwaitingTeam)
        : Boolean(!data.highestBidder && Number(data.currentBid || 0) > Number(data.activePlayer?.basePrice || 0));
      state.isAwaitingTeam = isAwaiting;

      if (data.highestBidder && !isAwaiting) {
        state.liveTeam = data.highestBidder.teamName || '';
        state.liveTeamData = {
          _id: data.highestBidder._id,
          teamName: data.highestBidder.teamName,
          shortName: data.highestBidder.shortName,
          logoUrl: data.highestBidder.logoUrl || data.highestBidder.logo || ''
        };
      } else {
        state.liveTeam = '';
        state.liveTeamData = null;
      }
      if (data.status) {
        state.playerStatus = data.status;
      }
    };

    // Socket handler (matches socket.on('updateAudienceScreen') in LiveScreen.jsx)
    const handleUpdateAudienceScreen = (data) => {
      if (!data) return;
      const incomingVersion = Number(data.version);
      if (Number.isFinite(incomingVersion) && incomingVersion > 0) {
        if (incomingVersion < lastAuctionVersionRef.current) return; // Stale event dropped
        lastAuctionVersionRef.current = incomingVersion;
      }
      const nextBidVal = Number(data.bidAmount !== undefined ? data.bidAmount : data.currentBid || 0);
      const activeBasePrice = Number(data.player?.basePrice || data.currentPlayer?.basePrice || state.currentPlayer?.basePrice || 0);
      const hasTeam = Boolean(data.teamId || data.teamName);
      const isAwaiting = data.isAwaitingTeam !== undefined
        ? Boolean(data.isAwaitingTeam)
        : Boolean(!hasTeam && nextBidVal > activeBasePrice);

      state.liveBid = nextBidVal;
      state.isAwaitingTeam = isAwaiting;
      if (hasTeam && !isAwaiting) {
        state.liveTeam = data.teamName || '';
        state.liveTeamData = (data.teamId || data.logoUrl) ? {
          _id: data.teamId,
          teamName: data.teamName,
          shortName: data.shortName,
          logoUrl: data.logoUrl
        } : null;
      } else {
        state.liveTeam = '';
        state.liveTeamData = null;
      }
      state.playerStatus = data.status || 'bidding';
      if (data.player !== undefined) {
        state.currentPlayer = data.player;
      }
    };

    // Layout render evaluators for verifying exact text output
    const evaluateLayouts = () => {
      const bidderInfo = getActiveBidderInfo();

      // 1. Classic layout
      const classic = {
        labelAboveBid: state.liveTeam ? 'Current Highest Bid' : (state.isAwaitingTeam ? '' : 'Waiting for Opening Bid...'),
        bidAmountDisplay: `₹${state.liveBid.toLocaleString()}`,
        hasHighestBidderSection: Boolean(state.liveTeam && !state.isAwaitingTeam),
        bidderName: (state.liveTeam && !state.isAwaitingTeam) ? bidderInfo.fullName : null,
        bidderLogo: (state.liveTeam && !state.isAwaitingTeam) ? bidderInfo.logo : null
      };

      // 2. Split layout
      const split = {
        statusPill: !state.isAwaitingTeam ? (state.liveTeam ? '⚡ Live Bidding In Progress' : '⏳ Awaiting First Bid') : null,
        bidLabel: 'Current Highest Bid',
        bidAmountDisplay: `₹${state.liveBid.toLocaleString()}`,
        leaderLabel: !state.isAwaitingTeam ? 'Current Leader' : null,
        leaderName: state.liveTeam ? (bidderInfo.fullName || '') : (state.isAwaitingTeam ? '' : 'No Active Bidder'),
        leaderLogo: state.liveTeam ? bidderInfo.logo : null,
        topBidderBadge: Boolean(state.liveTeam)
      };

      // 3. Spotlight layout
      const spotlight = {
        bidLabel: 'Current Highest Bid',
        bidAmountDisplay: `₹${state.liveBid.toLocaleString()}`,
        leaderLabel: !state.isAwaitingTeam ? 'Highest Bidder Team' : null,
        leaderName: state.liveTeam ? (bidderInfo.fullName || '') : (state.isAwaitingTeam ? '' : 'Waiting for Bids'),
        leaderLogo: state.liveTeam ? bidderInfo.logo : null
      };

      // 4. Broadcast layout
      const broadcast = {
        bidLabel: 'Current High Bid',
        bidAmountDisplay: `₹${state.liveBid.toLocaleString()}`,
        crownFallback: !bidderInfo.logo && !state.isAwaitingTeam,
        leaderLabel: !state.isAwaitingTeam ? 'Leading Bidder' : null,
        leaderName: state.liveTeam ? (bidderInfo.fullName || '') : (state.isAwaitingTeam ? '' : 'No Bids'),
        leaderLogo: state.liveTeam ? bidderInfo.logo : null
      };

      return { classic, split, spotlight, broadcast };
    };

    return {
      getState: () => ({ ...state }),
      getVersion: () => lastAuctionVersionRef.current,
      hydrateFromState,
      handleUpdateAudienceScreen,
      getActiveBidderInfo,
      evaluateLayouts
    };
  };

  // TEST 1
  it('1. Common BID updates the Live Screen amount', () => {
    const engine = createLiveScreenEngine();
    engine.hydrateFromState({
      activePlayer: { _id: 'p1', name: 'Virat Kohli', basePrice: 100000 },
      currentBid: 100000,
      highestBidder: null,
      isAwaitingTeam: false,
      version: 1
    });

    assert.equal(engine.getState().liveBid, 100000);
    assert.equal(engine.getState().isAwaitingTeam, false);

    // Common BID event arrives
    engine.handleUpdateAudienceScreen({
      bidAmount: 110000,
      currentBid: 110000,
      teamId: '',
      teamName: '',
      player: { _id: 'p1', name: 'Virat Kohli', basePrice: 100000 },
      status: 'bidding',
      version: 2,
      isAwaitingTeam: true
    });

    assert.equal(engine.getState().liveBid, 110000, 'Live bid amount must be updated to 110000');
    assert.equal(engine.getState().isAwaitingTeam, true, 'isAwaitingTeam must be true');
    assert.equal(engine.getVersion(), 2, 'Version must be 2');
  });

  // TEST 2
  it('2. Previous Team Name and Logo disappear after Common BID', () => {
    const engine = createLiveScreenEngine();

    // Player active with CSK leading
    engine.handleUpdateAudienceScreen({
      bidAmount: 200000,
      teamId: 'team_csk',
      teamName: 'Chennai Super Kings',
      logoUrl: 'https://csk.png',
      shortName: 'CSK',
      player: { _id: 'p1', name: 'Virat Kohli', basePrice: 100000 },
      status: 'bidding',
      version: 2,
      isAwaitingTeam: false
    });

    assert.equal(engine.getState().liveTeam, 'Chennai Super Kings');
    assert.equal(engine.getActiveBidderInfo().fullName, 'Chennai Super Kings');
    assert.equal(engine.getActiveBidderInfo().logo, 'https://csk.png');

    // Admin places Common BID -> becomes Awaiting Team
    engine.handleUpdateAudienceScreen({
      bidAmount: 220000,
      teamId: '',
      teamName: '',
      shortName: '',
      logoUrl: '',
      player: { _id: 'p1', name: 'Virat Kohli', basePrice: 100000 },
      status: 'bidding',
      version: 3,
      isAwaitingTeam: true
    });

    assert.equal(engine.getState().liveTeam, '', 'liveTeam must be cleared');
    assert.equal(engine.getState().liveTeamData, null, 'liveTeamData must be cleared');
    assert.equal(engine.getActiveBidderInfo().fullName, '', 'Bidder full name must be empty string');
    assert.equal(engine.getActiveBidderInfo().logo, '', 'Bidder logo must be empty string');
    assert.equal(engine.getActiveBidderInfo().shortName, '', 'Bidder short name must be empty string');
  });

  // TEST 3
  it('3. No Awaiting Team or Unassigned Bid or Waiting for Opening Bid text appears during Common BID', () => {
    const engine = createLiveScreenEngine();

    engine.handleUpdateAudienceScreen({
      bidAmount: 220000,
      teamId: '',
      teamName: '',
      player: { _id: 'p1', name: 'Virat Kohli', basePrice: 100000 },
      status: 'bidding',
      version: 3,
      isAwaitingTeam: true
    });

    const layouts = engine.evaluateLayouts();

    // Forbidden strings
    const forbiddenPhrases = [
      'AWAITING TEAM',
      'UNASSIGNED BID',
      'WAITING FOR OPENING BID',
      'Awaiting First Bid',
      'No Active Bidder',
      'Waiting for Bids',
      'No Bids'
    ];

    const checkNoForbidden = (text, context) => {
      if (!text) return;
      for (const phrase of forbiddenPhrases) {
        assert.ok(
          !text.toUpperCase().includes(phrase.toUpperCase()),
          `Layout (${context}) must NOT contain "${phrase}". Got: "${text}"`
        );
      }
    };

    // Check Classic
    checkNoForbidden(layouts.classic.labelAboveBid, 'Classic label');
    assert.equal(layouts.classic.hasHighestBidderSection, false, 'Classic must not render highest bidder section');
    assert.equal(layouts.classic.bidAmountDisplay, '₹2,20,000');

    // Check Split
    assert.equal(layouts.split.statusPill, null, 'Split status pill must be suppressed');
    checkNoForbidden(layouts.split.leaderName, 'Split leaderName');
    assert.equal(layouts.split.leaderName, '', 'Split leaderName must be empty');
    assert.equal(layouts.split.leaderLogo, null, 'Split leaderLogo must be null');
    assert.equal(layouts.split.topBidderBadge, false, 'Top bidder badge must be false');
    assert.equal(layouts.split.bidAmountDisplay, '₹2,20,000');

    // Check Spotlight
    assert.equal(layouts.spotlight.leaderLabel, null, 'Spotlight leaderLabel must be suppressed');
    checkNoForbidden(layouts.spotlight.leaderName, 'Spotlight leaderName');
    assert.equal(layouts.spotlight.leaderName, '', 'Spotlight leaderName must be empty');
    assert.equal(layouts.spotlight.leaderLogo, null, 'Spotlight leaderLogo must be null');
    assert.equal(layouts.spotlight.bidAmountDisplay, '₹2,20,000');

    // Check Broadcast
    assert.equal(layouts.broadcast.crownFallback, false, 'Broadcast crown fallback must be suppressed');
    assert.equal(layouts.broadcast.leaderLabel, null, 'Broadcast leaderLabel must be suppressed');
    checkNoForbidden(layouts.broadcast.leaderName, 'Broadcast leaderName');
    assert.equal(layouts.broadcast.leaderName, '', 'Broadcast leaderName must be empty');
    assert.equal(layouts.broadcast.leaderLogo, null, 'Broadcast leaderLogo must be null');
    assert.equal(layouts.broadcast.bidAmountDisplay, '₹2,20,000');
  });

  // TEST 4
  it('4. Team assignment displays the correct Team Name and Logo', () => {
    const engine = createLiveScreenEngine();

    // Initially awaiting team
    engine.handleUpdateAudienceScreen({
      bidAmount: 220000,
      teamId: '',
      teamName: '',
      player: { _id: 'p1', name: 'Virat Kohli', basePrice: 100000 },
      status: 'bidding',
      version: 3,
      isAwaitingTeam: true
    });

    // Admin claims bid for Mumbai Indians
    engine.handleUpdateAudienceScreen({
      bidAmount: 220000,
      teamId: 'team_mi',
      teamName: 'Mumbai Indians',
      shortName: 'MI',
      logoUrl: 'https://mi.png',
      player: { _id: 'p1', name: 'Virat Kohli', basePrice: 100000 },
      status: 'bidding',
      version: 4,
      isAwaitingTeam: false
    });

    assert.equal(engine.getState().isAwaitingTeam, false);
    assert.equal(engine.getState().liveTeam, 'Mumbai Indians');
    assert.equal(engine.getActiveBidderInfo().fullName, 'Mumbai Indians');
    assert.equal(engine.getActiveBidderInfo().logo, 'https://mi.png');

    const layouts = engine.evaluateLayouts();
    assert.equal(layouts.classic.labelAboveBid, 'Current Highest Bid');
    assert.equal(layouts.classic.hasHighestBidderSection, true);
    assert.equal(layouts.classic.bidderName, 'Mumbai Indians');
    assert.equal(layouts.classic.bidderLogo, 'https://mi.png');

    assert.equal(layouts.split.statusPill, '⚡ Live Bidding In Progress');
    assert.equal(layouts.split.leaderName, 'Mumbai Indians');
    assert.equal(layouts.split.leaderLogo, 'https://mi.png');
    assert.equal(layouts.split.topBidderBadge, true);

    assert.equal(layouts.spotlight.leaderName, 'Mumbai Indians');
    assert.equal(layouts.spotlight.leaderLogo, 'https://mi.png');

    assert.equal(layouts.broadcast.leaderName, 'Mumbai Indians');
    assert.equal(layouts.broadcast.leaderLogo, 'https://mi.png');
  });

  // TEST 5
  it("5. Remote Owner's first bid displays the incremented amount and assigned Team", () => {
    const engine = createLiveScreenEngine();

    // Common BID active at ₹2,400 with version 3
    engine.handleUpdateAudienceScreen({
      bidAmount: 2400,
      teamId: '',
      teamName: '',
      player: { _id: 'p1', name: 'Rishabh Pant', basePrice: 2000 },
      status: 'bidding',
      version: 3,
      isAwaitingTeam: true
    });

    assert.equal(engine.getState().liveBid, 2400);
    assert.equal(engine.getState().isAwaitingTeam, true);

    // Remote Owner clicks PLACE BID -> backend increments by ₹500 to ₹2,900
    engine.handleUpdateAudienceScreen({
      bidAmount: 2900,
      currentBid: 2900,
      teamId: 'team_rcb',
      teamName: 'Royal Challengers Bengaluru',
      shortName: 'RCB',
      logoUrl: 'https://rcb.png',
      player: { _id: 'p1', name: 'Rishabh Pant', basePrice: 2000 },
      status: 'bidding',
      version: 4,
      isRemote: true,
      bidSource: 'remote',
      isAwaitingTeam: false
    });

    assert.equal(engine.getState().liveBid, 2900, 'Bid amount must be incremented to 2900');
    assert.equal(engine.getState().isAwaitingTeam, false, 'isAwaitingTeam must be false');
    assert.equal(engine.getState().liveTeam, 'Royal Challengers Bengaluru');
    assert.equal(engine.getActiveBidderInfo().fullName, 'Royal Challengers Bengaluru');
    assert.equal(engine.getActiveBidderInfo().logo, 'https://rcb.png');
  });

  // TEST 6
  it('6. Subsequent bids update amount and bidder correctly', () => {
    const engine = createLiveScreenEngine();

    // RCB leads at 2900
    engine.handleUpdateAudienceScreen({
      bidAmount: 2900,
      teamId: 'team_rcb',
      teamName: 'Royal Challengers Bengaluru',
      logoUrl: 'https://rcb.png',
      player: { _id: 'p1', name: 'Rishabh Pant', basePrice: 2000 },
      status: 'bidding',
      version: 4,
      isAwaitingTeam: false
    });

    // CSK places next bid at 3400
    engine.handleUpdateAudienceScreen({
      bidAmount: 3400,
      teamId: 'team_csk',
      teamName: 'Chennai Super Kings',
      shortName: 'CSK',
      logoUrl: 'https://csk.png',
      player: { _id: 'p1', name: 'Rishabh Pant', basePrice: 2000 },
      status: 'bidding',
      version: 5,
      isAwaitingTeam: false
    });

    assert.equal(engine.getState().liveBid, 3400);
    assert.equal(engine.getState().liveTeam, 'Chennai Super Kings');
    assert.equal(engine.getActiveBidderInfo().fullName, 'Chennai Super Kings');
    assert.equal(engine.getActiveBidderInfo().logo, 'https://csk.png');
    assert.equal(engine.getVersion(), 5);
  });

  // TEST 7
  it('7. All four layouts follow identical state rules', () => {
    const engine = createLiveScreenEngine();

    // Verify Opening State (no bids yet)
    engine.hydrateFromState({
      activePlayer: { _id: 'p1', name: 'Jasprit Bumrah', basePrice: 200000 },
      currentBid: 200000,
      highestBidder: null,
      isAwaitingTeam: false,
      version: 1
    });

    let layouts = engine.evaluateLayouts();
    assert.equal(layouts.classic.labelAboveBid, 'Waiting for Opening Bid...');
    assert.equal(layouts.split.statusPill, '⏳ Awaiting First Bid');
    assert.equal(layouts.split.leaderName, 'No Active Bidder');
    assert.equal(layouts.spotlight.leaderName, 'Waiting for Bids');
    assert.equal(layouts.broadcast.leaderName, 'No Bids');

    // Verify Awaiting Team State (Common BID)
    engine.handleUpdateAudienceScreen({
      bidAmount: 220000,
      teamId: '',
      teamName: '',
      player: { _id: 'p1', name: 'Jasprit Bumrah', basePrice: 200000 },
      status: 'bidding',
      version: 2,
      isAwaitingTeam: true
    });

    layouts = engine.evaluateLayouts();
    // In all 4 layouts: bid amount is ₹2,20,000, and bidder info is empty/suppressed
    assert.equal(layouts.classic.labelAboveBid, '');
    assert.equal(layouts.classic.hasHighestBidderSection, false);
    assert.equal(layouts.classic.bidAmountDisplay, '₹2,20,000');

    assert.equal(layouts.split.statusPill, null);
    assert.equal(layouts.split.leaderName, '');
    assert.equal(layouts.split.leaderLogo, null);
    assert.equal(layouts.split.bidAmountDisplay, '₹2,20,000');

    assert.equal(layouts.spotlight.leaderLabel, null);
    assert.equal(layouts.spotlight.leaderName, '');
    assert.equal(layouts.spotlight.leaderLogo, null);
    assert.equal(layouts.spotlight.bidAmountDisplay, '₹2,20,000');

    assert.equal(layouts.broadcast.crownFallback, false);
    assert.equal(layouts.broadcast.leaderLabel, null);
    assert.equal(layouts.broadcast.leaderName, '');
    assert.equal(layouts.broadcast.leaderLogo, null);
    assert.equal(layouts.broadcast.bidAmountDisplay, '₹2,20,000');
  });

  // TEST 8
  it('8. Refresh restores the correct auction state', () => {
    const engine = createLiveScreenEngine();

    // Server state after a Common BID
    const serverStatePayload = {
      activePlayer: { _id: 'p1', name: 'Rohit Sharma', basePrice: 150000 },
      currentBid: 180000,
      highestBidder: null,
      isAwaitingTeam: true,
      status: 'bidding',
      version: 6
    };

    engine.hydrateFromState(serverStatePayload);

    assert.equal(engine.getState().liveBid, 180000);
    assert.equal(engine.getState().isAwaitingTeam, true);
    assert.equal(engine.getState().liveTeam, '');
    assert.equal(engine.getState().liveTeamData, null);
    assert.equal(engine.getVersion(), 6);

    const layouts = engine.evaluateLayouts();
    assert.equal(layouts.classic.labelAboveBid, '');
    assert.equal(layouts.split.leaderName, '');
    assert.equal(layouts.spotlight.leaderName, '');
    assert.equal(layouts.broadcast.leaderName, '');
  });

  // TEST 9
  it('9. Socket reconnect restores the latest state', () => {
    const engine = createLiveScreenEngine();

    // Client had version 4
    engine.handleUpdateAudienceScreen({
      bidAmount: 160000,
      teamId: 'team_rcb',
      teamName: 'Royal Challengers Bengaluru',
      logoUrl: 'https://rcb.png',
      player: { _id: 'p1', name: 'Rohit Sharma', basePrice: 150000 },
      status: 'bidding',
      version: 4,
      isAwaitingTeam: false
    });
    assert.equal(engine.getVersion(), 4);

    // Socket reconnects -> fetches /api/auction/state which is now version 5 (Common BID placed while disconnected)
    const freshReconnectedState = {
      activePlayer: { _id: 'p1', name: 'Rohit Sharma', basePrice: 150000 },
      currentBid: 180000,
      highestBidder: null,
      isAwaitingTeam: true,
      status: 'bidding',
      version: 5
    };

    engine.hydrateFromState(freshReconnectedState);

    assert.equal(engine.getState().liveBid, 180000);
    assert.equal(engine.getState().isAwaitingTeam, true);
    assert.equal(engine.getState().liveTeam, '');
    assert.equal(engine.getVersion(), 5);
  });

  // TEST 10
  it('10. Older Socket events cannot overwrite newer state', () => {
    const engine = createLiveScreenEngine();

    // Current state is version 7 (CSK bid 250000)
    engine.handleUpdateAudienceScreen({
      bidAmount: 250000,
      teamId: 'team_csk',
      teamName: 'Chennai Super Kings',
      logoUrl: 'https://csk.png',
      player: { _id: 'p1', name: 'KL Rahul', basePrice: 100000 },
      status: 'bidding',
      version: 7,
      isAwaitingTeam: false
    });

    assert.equal(engine.getState().liveBid, 250000);
    assert.equal(engine.getState().liveTeam, 'Chennai Super Kings');
    assert.equal(engine.getVersion(), 7);

    // A lagged event with version 5 arrives (e.g. earlier Common BID or MI bid)
    engine.handleUpdateAudienceScreen({
      bidAmount: 200000,
      teamId: 'team_mi',
      teamName: 'Mumbai Indians',
      logoUrl: 'https://mi.png',
      player: { _id: 'p1', name: 'KL Rahul', basePrice: 100000 },
      status: 'bidding',
      version: 5,
      isAwaitingTeam: false
    });

    // MUST NOT overwrite version 7!
    assert.equal(engine.getState().liveBid, 250000, 'Stale bid amount must not overwrite newer bid');
    assert.equal(engine.getState().liveTeam, 'Chennai Super Kings', 'Stale team must not overwrite newer team');
    assert.equal(engine.getVersion(), 7, 'Version must remain 7');

    // Similarly, a stale hydration attempt with version 6 must not overwrite version 7
    engine.hydrateFromState({
      activePlayer: { _id: 'p1', name: 'KL Rahul', basePrice: 100000 },
      currentBid: 220000,
      highestBidder: null,
      isAwaitingTeam: true,
      version: 6
    });

    assert.equal(engine.getState().liveBid, 250000);
    assert.equal(engine.getState().liveTeam, 'Chennai Super Kings');
    assert.equal(engine.getVersion(), 7);
  });

  // TEST 11
  it('11. SOLD remains functional with correct team and price', () => {
    const engine = createLiveScreenEngine();

    // Bid active with MI at 300000
    engine.handleUpdateAudienceScreen({
      bidAmount: 300000,
      teamId: 'team_mi',
      teamName: 'Mumbai Indians',
      logoUrl: 'https://mi.png',
      player: { _id: 'p1', name: 'Hardik Pandya', basePrice: 150000 },
      status: 'bidding',
      version: 8,
      isAwaitingTeam: false
    });

    // Organizer marks SOLD
    engine.handleUpdateAudienceScreen({
      bidAmount: 300000,
      teamId: 'team_mi',
      teamName: 'Mumbai Indians',
      logoUrl: 'https://mi.png',
      player: { _id: 'p1', name: 'Hardik Pandya', basePrice: 150000 },
      status: 'sold',
      version: 9,
      isAwaitingTeam: false
    });

    assert.equal(engine.getState().playerStatus, 'sold');
    assert.equal(engine.getState().liveBid, 300000);
    assert.equal(engine.getState().liveTeam, 'Mumbai Indians');
    assert.equal(engine.getActiveBidderInfo().fullName, 'Mumbai Indians');
    assert.equal(engine.getActiveBidderInfo().logo, 'https://mi.png');
  });

  // TEST 12
  it('12. UNSOLD remains functional without team leakage', () => {
    const engine = createLiveScreenEngine();

    // Common BID was placed (awaiting team at 180000), but no team claimed it
    engine.handleUpdateAudienceScreen({
      bidAmount: 180000,
      teamId: '',
      teamName: '',
      player: { _id: 'p2', name: 'Domestic Player', basePrice: 150000 },
      status: 'bidding',
      version: 4,
      isAwaitingTeam: true
    });

    // Organizer marks UNSOLD
    engine.handleUpdateAudienceScreen({
      bidAmount: 180000,
      teamId: '',
      teamName: '',
      logoUrl: '',
      player: { _id: 'p2', name: 'Domestic Player', basePrice: 150000 },
      status: 'unsold',
      version: 5,
      isAwaitingTeam: false
    });

    assert.equal(engine.getState().playerStatus, 'unsold');
    assert.equal(engine.getState().liveTeam, '', 'No team must be associated with UNSOLD');
    assert.equal(engine.getState().liveTeamData, null);
    assert.equal(engine.getActiveBidderInfo().fullName, '');
    assert.equal(engine.getActiveBidderInfo().logo, '');
  });

  // TEST 13
  it('13. NEXT correctly resets bidder and Awaiting Team state', () => {
    const engine = createLiveScreenEngine();

    // Previous player ended (sold to CSK)
    engine.handleUpdateAudienceScreen({
      bidAmount: 500000,
      teamId: 'team_csk',
      teamName: 'Chennai Super Kings',
      logoUrl: 'https://csk.png',
      player: { _id: 'p1', name: 'MS Dhoni', basePrice: 200000 },
      status: 'sold',
      version: 10,
      isAwaitingTeam: false
    });

    assert.equal(engine.getState().playerStatus, 'sold');
    assert.equal(engine.getState().liveTeam, 'Chennai Super Kings');

    // NEXT player is initiated (new player p3, base price 100000)
    engine.handleUpdateAudienceScreen({
      bidAmount: 100000,
      teamId: '',
      teamName: '',
      shortName: '',
      logoUrl: '',
      player: { _id: 'p3', name: 'Shubman Gill', basePrice: 100000 },
      status: 'bidding',
      version: 11,
      isAwaitingTeam: false
    });

    assert.equal(engine.getState().playerStatus, 'bidding');
    assert.equal(engine.getState().currentPlayer._id, 'p3');
    assert.equal(engine.getState().currentPlayer.name, 'Shubman Gill');
    assert.equal(engine.getState().liveBid, 100000);
    assert.equal(engine.getState().isAwaitingTeam, false);
    assert.equal(engine.getState().liveTeam, '', 'liveTeam must reset to empty for NEXT player');
    assert.equal(engine.getState().liveTeamData, null);
    assert.equal(engine.getActiveBidderInfo().fullName, '', 'No previous bidder info may leak');
    assert.equal(engine.getActiveBidderInfo().logo, '', 'No previous logo may leak');

    const layouts = engine.evaluateLayouts();
    assert.equal(layouts.classic.labelAboveBid, 'Waiting for Opening Bid...');
    assert.equal(layouts.classic.hasHighestBidderSection, false);
    assert.equal(layouts.split.statusPill, '⏳ Awaiting First Bid');
    assert.equal(layouts.split.leaderName, 'No Active Bidder');
  });

  // TEST 14
  it('14. ControlPanel periodic sync payload cannot restore stale bidder during Awaiting Team', () => {
    // Simulated ControlPanel interval logic
    const simulateControlPanelSyncPayload = ({
      currentPlayer,
      currentBid,
      biddingTeam,
      isAwaitingTeam,
      version,
      teams
    }) => {
      const isAwaiting = Boolean(isAwaitingTeam);
      const winningTeamObj = (!isAwaiting && biddingTeam)
        ? teams.find(t => t._id === biddingTeam || t.teamName === biddingTeam)
        : null;

      return {
        bidAmount: currentBid,
        teamId: winningTeamObj?._id || '',
        teamName: winningTeamObj?.teamName || (!isAwaiting ? biddingTeam || '' : ''),
        shortName: winningTeamObj?.shortName || '',
        logoUrl: winningTeamObj?.logoUrl || winningTeamObj?.logo || '',
        player: currentPlayer,
        status: 'bidding',
        version: version || undefined,
        isAwaitingTeam: isAwaiting
      };
    };

    const teams = [
      { _id: 'team_mi', teamName: 'Mumbai Indians', shortName: 'MI', logoUrl: 'https://mi.png' }
    ];

    // Scenario A: When isAwaitingTeam is true, payload must have empty team info
    const awaitingPayload = simulateControlPanelSyncPayload({
      currentPlayer: { _id: 'p1', name: 'Player A', basePrice: 100000 },
      currentBid: 120000,
      biddingTeam: '', // Cleared on common bid
      isAwaitingTeam: true,
      version: 4,
      teams
    });

    assert.equal(awaitingPayload.isAwaitingTeam, true);
    assert.equal(awaitingPayload.teamId, '');
    assert.equal(awaitingPayload.teamName, '');
    assert.equal(awaitingPayload.logoUrl, '');

    // Scenario B: Even if biddingTeam somehow held an old team reference, isAwaitingTeam overrides it
    const edgeCasePayload = simulateControlPanelSyncPayload({
      currentPlayer: { _id: 'p1', name: 'Player A', basePrice: 100000 },
      currentBid: 120000,
      biddingTeam: 'team_mi', // Stale team in ref
      isAwaitingTeam: true,   // But isAwaitingTeam is true
      version: 4,
      teams
    });

    assert.equal(edgeCasePayload.isAwaitingTeam, true);
    assert.equal(edgeCasePayload.teamId, '', 'Stale teamId must NOT be emitted when isAwaitingTeam is true');
    assert.equal(edgeCasePayload.teamName, '', 'Stale teamName must NOT be emitted when isAwaitingTeam is true');
    assert.equal(edgeCasePayload.logoUrl, '', 'Stale logoUrl must NOT be emitted when isAwaitingTeam is true');

    // When applied to LiveScreen engine, it preserves Awaiting Team state
    const engine = createLiveScreenEngine();
    engine.handleUpdateAudienceScreen(edgeCasePayload);
    assert.equal(engine.getState().isAwaitingTeam, true);
    assert.equal(engine.getState().liveTeam, '');
    assert.equal(engine.getActiveBidderInfo().fullName, '');
  });
});
