const mongoose = require('mongoose');
const AuctionState = require('../models/AuctionState');
const Player = require('../models/Player');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const { getAuctionStateForOrganizer, decorateTeamsWithMaxBid } = require('../utils/maxBid');
const { mergeWithTournamentScope } = require('../utils/tournamentScope');

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
  if (expectedVersion !== undefined && Number(expectedVersion) !== Number(state.version)) {
    throw auctionError('STALE_AUCTION_STATE', 409, 'Auction state changed. Refresh and retry.');
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
  return AuctionState.findOne(
    { organizer: organizerId, tournament: scope.tournamentId }
  ).populate('activePlayer').populate('highestBidder', 'teamName shortName logoUrl logo').lean();
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

  const activeState = await AuctionState.findOne({ organizer: organizerId, tournament: tournamentScope.tournamentId, status: 'bidding' }).lean();
  if (activeState && String(activeState.activePlayer) !== String(player._id)) {
    throw auctionError('AUCTION_ALREADY_ACTIVE', 409, 'Another player is already active for bidding.');
  }

  const state = await AuctionState.findOneAndUpdate(
    {
      organizer: organizerId,
      tournament: tournamentScope.tournamentId,
      status: { $ne: 'bidding' }
    },
    {
      $set: {
        organizer: organizerId,
        tournament: tournamentScope.tournamentId,
        activePlayer: player._id,
        currentBid: Number(player.basePrice || 0),
        highestBidder: null,
        status: 'bidding'
      },
      $inc: { version: 1 }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return { state, player };
};

const placeBid = async ({ organizerId, tournamentScope, teamId, playerId, amount, bidType = 'increment', expectedVersion, allowCustomBid = false }) => {
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
  if (state.highestBidder && String(state.highestBidder) === String(teamId)) {
    throw auctionError('ALREADY_HIGHEST_BIDDER', 409, 'This team is already the highest bidder.');
  }

  const [tournament, player, team, auctionState] = await Promise.all([
    Tournament.findOne({ _id: scope.tournamentId, organizer: organizerId }).lean(),
    Player.findOne(mergeWithTournamentScope({ _id: playerId, organizer: organizerId, approvalStatus: 'Approved', auctionStatus: 'ReadyForAuction', isIcon: { $ne: true } }, scope)).lean(),
    Team.findOne(mergeWithTournamentScope({ _id: teamId, organizer: organizerId }, scope)).lean(),
    getAuctionStateForOrganizer({ organizerId, tournamentScope: scope })
  ]);
  if (!tournament || !player || !team) throw auctionError('AUCTION_REFERENCE_NOT_FOUND', 404, 'Auction player or team was not found.');

  const nextBid = calculateNextBid({ state, tournament, amount, bidType, allowCustomBid });
  const [teamWithMaxBid] = decorateTeamsWithMaxBid({ teams: [team], auctionState, currentBasePrice: player.basePrice });
  if (nextBid > Number(teamWithMaxBid.remainingPurse || 0) || nextBid > Number(teamWithMaxBid.maxBid || 0)) {
    throw auctionError('BID_LIMIT_EXCEEDED', 409, 'Bid exceeds the team purse or maximum permitted bid.');
  }

  const updated = await AuctionState.findOneAndUpdate(
    {
      _id: state._id,
      version: state.version,
      status: 'bidding',
      activePlayer: player._id,
      currentBid: state.currentBid,
      highestBidder: state.highestBidder || null
    },
    { $set: { currentBid: nextBid, highestBidder: team._id }, $inc: { version: 1 } },
    { new: true }
  ).lean();
  if (!updated) throw auctionError('BID_CONFLICT', 409, 'Another bid was accepted first. Refresh and retry.');
  return { state: updated, team: teamWithMaxBid, player };
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
    { $set: { currentBid: Number(player.basePrice || 0), highestBidder: null }, $inc: { version: 1 } },
    { new: true }
  ).lean();
  if (!updated) throw auctionError('BID_CONFLICT', 409, 'Auction state changed. Refresh and retry.');
  return { state: updated, player };
};

module.exports = { auctionError, configuredIncrements, assertExpectedVersion, calculateNextBid, getStatePayload, startAuction, placeBid, resetAuctionBid };
