const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');

const buildTournamentScopeFilter = (tournamentId, includeLegacy = false) => {
  if (!tournamentId) throw new Error('TOURNAMENT_SCOPE_MISSING');

  if (!includeLegacy) return { tournament: tournamentId };

  // Legacy records without a tournament can be included only when the
  // organizer has exactly one tournament, making the association unambiguous.
  return {
    $or: [
      { tournament: tournamentId },
      { tournament: null },
      { tournament: { $exists: false } }
    ]
  };
};

const mergeWithTournamentScope = (query, tournamentScope) => ({
  $and: [query, tournamentScope.filter]
});

const getOrganizerTournamentScope = async ({ organizerId, requestedTournamentId = null }) => {
  if (!organizerId) {
    const error = new Error('ORGANIZER_SCOPE_MISSING');
    error.statusCode = 401;
    throw error;
  }

  if (requestedTournamentId) {
    if (!mongoose.Types.ObjectId.isValid(requestedTournamentId)) {
      const error = new Error('TOURNAMENT_ID_INVALID');
      error.statusCode = 400;
      throw error;
    }

    const tournament = await Tournament.findOne({
      _id: requestedTournamentId,
      organizer: organizerId
    }).select('_id').lean();

    if (!tournament) {
      const error = new Error('TOURNAMENT_NOT_FOUND');
      error.statusCode = 404;
      throw error;
    }

    const tournamentCount = await Tournament.countDocuments({ organizer: organizerId });
    return {
      tournamentId: tournament._id,
      includeLegacy: tournamentCount === 1,
      filter: buildTournamentScopeFilter(tournament._id, tournamentCount === 1)
    };
  }

  const tournaments = await Tournament.find({ organizer: organizerId })
    .select('_id')
    .limit(2)
    .lean();

  if (tournaments.length === 0) {
    const error = new Error('TOURNAMENT_NOT_CONFIGURED');
    error.statusCode = 409;
    throw error;
  }

  if (tournaments.length > 1) {
    const error = new Error('TOURNAMENT_SELECTION_REQUIRED');
    error.statusCode = 409;
    throw error;
  }

  return {
    tournamentId: tournaments[0]._id,
    includeLegacy: true,
    filter: buildTournamentScopeFilter(tournaments[0]._id, true)
  };
};

module.exports = {
  buildTournamentScopeFilter,
  mergeWithTournamentScope,
  getOrganizerTournamentScope
};
