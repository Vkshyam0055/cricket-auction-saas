const mongoose = require('mongoose');
const AuctionState = require('../models/AuctionState');
const Player = require('../models/Player');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const { getAuctionStateForOrganizer, decorateTeamsWithMaxBid } = require('../utils/maxBid');
const { mergeWithTournamentScope } = require('../utils/tournamentScope');
const { calculateAutoIncrement, getEffectiveAutoIncrementSlabs } = require('../utils/autoIncrement');

const auctionError = (code, statusCode, message) => {
  const error = new Error(code);
  error.statusCode = statusCode;
  error.publicMessage = message;
  return error;
};

const configuredIncrements = (tournament) => [
  tournament.biddingButtonsCount >= 1 ? Number(tournament.bidButton1) : null,
  tournament.biddingButtonsCount >= 2 ? Number(tournament.bidButton2) : null,
  tournament.biddingButtonsCount >= 3 ? Number(tournament.bidButton3) : null
].filter((amount) => Number.isFinite(amount) && amount > 0);

const assertExpectedVersion = (state, expectedVersion) => {
  if (expectedVersion !== undefined && expectedVersion !== null && expectedVersion !== '') {
    const numVersion = Number(expectedVersion);
    if (Number.isFinite(numVersion) && numVersion > 0) {
      if (numVersion !== Number(state.version)) {
        const err = auctionError('STALE_AUCTION_STATE', 409, 'Auction state changed. Refresh and retry.');
        err.currentVersion = state.version;
        throw err;
      }
    }
  }
};

const calculateNextBid = ({ state, tournament, amount, bidType, allowCustomBid }) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw auctionError('INVALID_BID_AMOUNT', 400, 'Invalid bid amount.');
  }

  if (bidType === 'increment') {
    if (numericAmount <= 0) {
      throw auctionError('INVALID_BID_AMOUNT', 400, 'Invalid bid amount.');
    }
    if (!configuredIncrements(tournament).includes(numericAmount)) {
      throw auctionError('INVALID_INCREMENT', 400, 'Bid must use an organizer-configured increment.');
    }
    return state.currentBid + numericAmount;
  }

  if (bidType === 'auto') {
    const slabs = getEffectiveAutoIncrementSlabs(tournament);
    const purse = Number(tournament?.teamBudget || 50000000);
    const autoInc = calculateAutoIncrement({
      currentBid: state.currentBid,
      teamPurse: purse,
      slabs
    });
    return autoInc.nextBid;
  }

  if (bidType === 'custom' && allowCustomBid) {
    if (numericAmount <= state.currentBid) {
      throw auctionError('BID_NOT_HIGHER', 409, 'Custom bid must exceed the current bid.');
    }
    return numericAmount;
  }

  if (bidType === 'base' && allowCustomBid && !state.highestBidder && numericAmount === state.currentBid) {
    return numericAmount;
  }

  throw auctionError('BID_TYPE_NOT_ALLOWED', 403, 'This bid type is not allowed.');
};

const resolveScope = (tournamentScope) => {
  if (!tournamentScope) return { filter: {} };
  if (tournamentScope.filter) return tournamentScope;
  return { ...tournamentScope, filter: { tournament: tournamentScope.tournamentId } };
};

const getStatePayload = async ({ organizerId, tournamentScope }) => {
  const scope = resolveScope(tournamentScope);
  const doc = await AuctionState.findOne(
    { organizer: organizerId, tournament: scope.tournamentId }
  ).populate('activePlayer').populate('highestBidder', 'teamName shortName logoUrl logo').lean();
  if (!doc) return null;
  const basePrice = Number(doc.activePlayer?.basePrice || 0);
  const isAwaiting = Boolean(doc.isAwaitingTeam || (!doc.highestBidder && doc.currentBid > basePrice));
  return { ...doc, isAwaitingTeam: isAwaiting };
};

const startAuction = async ({ organizerId, tournamentScope, playerId }) => {
  const scope = resolveScope(tournamentScope);
  const player = await Player.findOne(mergeWithTournamentScope({
    _id: playerId,
    organizer: organizerId,
    approvalStatus: 'Approved',
    auctionStatus: 'ReadyForAuction',
    isIcon: { $ne: true }
  }, scope)).lean();
  if (!player) throw auctionError('PLAYER_NOT_ELIGIBLE', 409, 'Player is not eligible for auction.');

  const activeState = await AuctionState.findOne({ organizer: organizerId, tournament: scope.tournamentId, status: 'bidding' }).lean();
  if (activeState && String(activeState.activePlayer) !== String(player._id)) {
    const isUnbidLoadedPlayer = !activeState.highestBidder && !activeState.isAwaitingTeam;
    if (!isUnbidLoadedPlayer) {
      throw auctionError('AUCTION_ALREADY_ACTIVE', 409, 'Another player is already active for bidding.');
    }
  }

  const state = await AuctionState.findOneAndUpdate(
    {
      organizer: organizerId,
      tournament: scope.tournamentId,
      $or: [
        { status: { $ne: 'bidding' } },
        { highestBidder: null, isAwaitingTeam: false }
      ]
    },
    {
      $set: {
        organizer: organizerId,
        tournament: scope.tournamentId,
        activePlayer: player._id,
        currentBid: Number(player.basePrice || 0),
        highestBidder: null,
        isAwaitingTeam: false,
        status: 'bidding'
      },
      $inc: { version: 1 }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  if (!state) {
    throw auctionError('AUCTION_ALREADY_ACTIVE', 409, 'Another player is already active for bidding.');
  }

  return { state, player };
};

const placeBid = async ({ organizerId, tournamentScope, teamId, playerId, amount, bidType = 'auto', expectedVersion, allowCustomBid = false, isRemote = false }) => {
  if (!mongoose.Types.ObjectId.isValid(teamId) || !mongoose.Types.ObjectId.isValid(playerId)) {
    throw auctionError('INVALID_AUCTION_REFERENCE', 400, 'Invalid team or player reference.');
  }

  const scope = resolveScope(tournamentScope);
  const state = await AuctionState.findOne({
    organizer: organizerId,
    tournament: scope.tournamentId,
    activePlayer: playerId,
    status: 'bidding'
  }).lean();
  if (!state) throw auctionError('AUCTION_NOT_ACTIVE', 409, 'This player is not the active auction player.');
  assertExpectedVersion(state, expectedVersion);
  if (!allowCustomBid && state.highestBidder && String(state.highestBidder) === String(teamId)) {
    throw auctionError('ALREADY_HIGHEST_BIDDER', 409, 'This team is already the highest bidder.');
  }

  const [tournament, player, team, auctionState] = await Promise.all([
    Tournament.findOne({ _id: scope.tournamentId, organizer: organizerId }).lean(),
    Player.findOne(mergeWithTournamentScope({ _id: playerId, organizer: organizerId, approvalStatus: 'Approved', auctionStatus: 'ReadyForAuction', isIcon: { $ne: true } }, scope)).lean(),
    Team.findOne(mergeWithTournamentScope({ _id: teamId, organizer: organizerId }, scope)).lean(),
    getAuctionStateForOrganizer({ organizerId, tournamentScope: scope })
  ]);
  if (!tournament || !player || !team) throw auctionError('AUCTION_REFERENCE_NOT_FOUND', 404, 'Auction player or team was not found.');

  const basePrice = Number(player.basePrice || 0);
  const isAwaitingTeam = !state.highestBidder && (Boolean(state.isAwaitingTeam) || state.currentBid > basePrice);

  let nextBid;
  if (isAwaitingTeam && !isRemote && !(bidType === 'custom' && allowCustomBid)) {
    // Case A (Admin): Awaiting Team -> First eligible team claims current bid without an increment
    nextBid = state.currentBid;
  } else if (bidType === 'custom' && allowCustomBid) {
    nextBid = calculateNextBid({ state, tournament, amount, bidType: 'custom', allowCustomBid: true });
  } else if (bidType === 'base' && allowCustomBid && !state.highestBidder && Number(amount) === state.currentBid) {
    nextBid = state.currentBid;
  } else if (bidType === 'increment' && amount !== undefined && configuredIncrements(tournament).includes(Number(amount)) && (!tournament.autoIncrementSlabs || tournament.autoIncrementSlabs.length === 0)) {
    // Legacy fixed button increment support
    nextBid = state.currentBid + Number(amount);
  } else {
    // Case B: Auto Increment Slab calculation
    const slabs = getEffectiveAutoIncrementSlabs(tournament);
    const purse = Number(tournament?.teamBudget || 50000000);
    const autoInc = calculateAutoIncrement({
      currentBid: state.currentBid,
      teamPurse: purse,
      slabs
    });
    nextBid = autoInc.nextBid;
  }

  const [teamWithMaxBid] = decorateTeamsWithMaxBid({ teams: [team], auctionState, currentBasePrice: player.basePrice });
  if (nextBid > Number(teamWithMaxBid.remainingPurse || 0) || nextBid > Number(teamWithMaxBid.maxBid || 0)) {
    throw auctionError('BID_LIMIT_EXCEEDED', 409, 'Bid exceeds the team purse or maximum permitted bid.');
  }

  const updateFilter = {
    _id: state._id,
    version: state.version,
    status: 'bidding',
    activePlayer: player._id,
    currentBid: state.currentBid
  };
  if (isAwaitingTeam) {
    updateFilter.highestBidder = null;
  } else {
    updateFilter.highestBidder = state.highestBidder || null;
  }

  const updated = await AuctionState.findOneAndUpdate(
    updateFilter,
    {
      $set: {
        currentBid: nextBid,
        highestBidder: team._id,
        isAwaitingTeam: false
      },
      $inc: { version: 1 }
    },
    { new: true }
  ).lean();
  if (!updated) {
    const latestState = await AuctionState.findById(state._id).select('version').lean();
    const err = auctionError('BID_CONFLICT', 409, 'Another bid was accepted first. Refresh and retry.');
    err.currentVersion = latestState?.version;
    throw err;
  }
  return {
    state: updated,
    team: teamWithMaxBid,
    player,
    isAwaitingTeam: false,
    claimed: isAwaitingTeam && !isRemote
  };
};

const placeCommonBid = async ({ organizerId, tournamentScope, playerId, expectedVersion }) => {
  const scope = resolveScope(tournamentScope);
  const stateQuery = {
    organizer: organizerId,
    tournament: scope.tournamentId,
    status: 'bidding'
  };
  if (playerId && mongoose.Types.ObjectId.isValid(playerId)) {
    stateQuery.activePlayer = playerId;
  }

  const state = await AuctionState.findOne(stateQuery).lean();
  if (!state || !state.activePlayer) {
    throw auctionError('AUCTION_NOT_ACTIVE', 409, 'No active player for bidding.');
  }
  assertExpectedVersion(state, expectedVersion);

  const [tournament, player, auctionState] = await Promise.all([
    Tournament.findOne({ _id: scope.tournamentId, organizer: organizerId }).lean(),
    Player.findOne(mergeWithTournamentScope({
      _id: state.activePlayer,
      organizer: organizerId,
      approvalStatus: 'Approved',
      auctionStatus: 'ReadyForAuction',
      isIcon: { $ne: true }
    }, scope)).lean(),
    getAuctionStateForOrganizer({ organizerId, tournamentScope: scope })
  ]);
  if (!tournament || !player) {
    throw auctionError('AUCTION_REFERENCE_NOT_FOUND', 404, 'Tournament or player not found.');
  }

  const slabs = getEffectiveAutoIncrementSlabs(tournament);
  const purse = Number(tournament?.teamBudget || 50000000);
  const autoInc = calculateAutoIncrement({
    currentBid: state.currentBid,
    teamPurse: purse,
    slabs
  });
  const nextBid = autoInc.nextBid;

  // Verify at least one eligible team can afford nextBid
  const allTeams = await Team.find(mergeWithTournamentScope({ organizer: organizerId }, scope)).lean();
  if (!allTeams || allTeams.length === 0) {
    throw auctionError('NO_ELIGIBLE_TEAMS', 409, 'No teams exist in this tournament.');
  }

  const decoratedTeams = decorateTeamsWithMaxBid({
    teams: allTeams,
    auctionState,
    currentBasePrice: player.basePrice
  });

  const affordableTeams = decoratedTeams.filter(t =>
    Number(t.remainingPurse || 0) >= nextBid &&
    Number(t.maxBid || 0) >= nextBid
  );

  if (affordableTeams.length === 0) {
    throw auctionError('NO_ELIGIBLE_TEAMS', 409, 'Bid exceeds maximum affordable bid for all eligible teams.');
  }

  const updated = await AuctionState.findOneAndUpdate(
    {
      _id: state._id,
      version: state.version,
      status: 'bidding',
      activePlayer: player._id,
      currentBid: state.currentBid
    },
    {
      $set: {
        currentBid: nextBid,
        highestBidder: null,
        isAwaitingTeam: true
      },
      $inc: { version: 1 }
    },
    { new: true }
  ).lean();

  if (!updated) {
    const latestState = await AuctionState.findById(state._id).select('version').lean();
    const err = auctionError('BID_CONFLICT', 409, 'Auction state changed. Refresh and retry.');
    err.currentVersion = latestState?.version;
    throw err;
  }

  return {
    state: updated,
    player,
    incrementAmount: autoInc.rupeeIncrement,
    isAwaitingTeam: true,
    eligibleTeamsCount: affordableTeams.length
  };
};

const resetAuctionBid = async ({ organizerId, tournamentScope, playerId, expectedVersion }) => {
  const scope = resolveScope(tournamentScope);
  const state = await AuctionState.findOne({ organizer: organizerId, tournament: scope.tournamentId, activePlayer: playerId, status: 'bidding' }).lean();
  if (!state) throw auctionError('AUCTION_NOT_ACTIVE', 409, 'This player is not the active auction player.');
  assertExpectedVersion(state, expectedVersion);
  const player = await Player.findOne(mergeWithTournamentScope({ _id: playerId, organizer: organizerId, auctionStatus: 'ReadyForAuction' }, scope)).lean();
  if (!player) throw auctionError('PLAYER_NOT_ELIGIBLE', 409, 'Player is not eligible for bid reset.');
  const updated = await AuctionState.findOneAndUpdate(
    { _id: state._id, version: state.version },
    { $set: { currentBid: Number(player.basePrice || 0), highestBidder: null, isAwaitingTeam: false }, $inc: { version: 1 } },
    { new: true }
  ).lean();
  if (!updated) {
    const latestState = await AuctionState.findById(state._id).select('version').lean();
    const err = auctionError('BID_CONFLICT', 409, 'Auction state changed. Refresh and retry.');
    err.currentVersion = latestState?.version;
    throw err;
  }
  return { state: updated, player };
};

module.exports = { auctionError, configuredIncrements, assertExpectedVersion, calculateNextBid, getStatePayload, startAuction, placeBid, placeCommonBid, resetAuctionBid };
