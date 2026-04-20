const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const Player = require('../models/Player');

const SOLD_LIKE_STATUSES = ['Sold', 'Icon'];

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const calculateTeamMaxBid = ({ remainingPurse, remainingRequiredPlayers, currentBasePrice }) => {
  const purse = Math.max(0, safeNumber(remainingPurse, 0));
  const requiredPlayers = Math.max(0, safeNumber(remainingRequiredPlayers, 0));
  const basePrice = Math.max(0, safeNumber(currentBasePrice, 0));

  if (requiredPlayers <= 1) return purse;

  const reserveForRemainingSlots = (requiredPlayers - 1) * basePrice;
  return Math.max(0, purse - reserveForRemainingSlots);
};

const buildSquadCountMap = (squadCounts) => new Map(
  (squadCounts || [])
    .filter((row) => typeof row?._id === 'string' && row._id && row._id !== 'Unsold')
    .map((row) => [row._id, safeNumber(row.count, 0)])
);

const getAuctionStateForOrganizer = async ({ organizerId, session = null }) => {
  const organizerObjectId = new mongoose.Types.ObjectId(String(organizerId));

  const [tournament, squadCounts, readyPlayers] = await Promise.all([
    Tournament.findOne({ organizer: organizerId }).select('minPlayersPerTeam').session(session).lean(),
    Player.aggregate([
      { $match: { organizer: organizerObjectId, auctionStatus: { $in: SOLD_LIKE_STATUSES } } },
      { $group: { _id: '$soldTo', count: { $sum: 1 } } }
    ]).session(session),
    Player.find({ organizer: organizerId, approvalStatus: 'Approved', auctionStatus: 'ReadyForAuction' })
      .select('basePrice')
      .session(session)
      .lean()
  ]);

  const readyBasePrices = (readyPlayers || [])
    .map((player) => Math.max(0, safeNumber(player.basePrice, 0)))
    .filter((price) => Number.isFinite(price));

  return {
    minPlayersPerTeam: Math.max(0, safeNumber(tournament?.minPlayersPerTeam, 15)),
    squadCountMap: buildSquadCountMap(squadCounts),
    tournamentMinBasePrice: readyBasePrices.length > 0 ? Math.min(...readyBasePrices) : 0
  };
};

const decorateTeamsWithMaxBid = ({ teams, auctionState, currentBasePrice }) => {
  const effectiveBasePrice = Math.max(
    0,
    safeNumber(currentBasePrice, auctionState?.tournamentMinBasePrice || 0)
  );

  return (teams || []).map((team) => {
    const ownedPlayers = Math.max(
      0,
      safeNumber(auctionState?.squadCountMap?.get(team.teamName), 0)
    );

    const remainingRequiredPlayers = Math.max(
      0,
      safeNumber(auctionState?.minPlayersPerTeam, 0) - ownedPlayers
    );

    const maxBid = calculateTeamMaxBid({
      remainingPurse: team.remainingPurse,
      remainingRequiredPlayers,
      currentBasePrice: effectiveBasePrice
    });

    return {
      ...team,
      currentBasePriceForMaxBid: effectiveBasePrice,
      remainingRequiredPlayers,
      maxBid
    };
  });
};

module.exports = {
  calculateTeamMaxBid,
  getAuctionStateForOrganizer,
  decorateTeamsWithMaxBid
};