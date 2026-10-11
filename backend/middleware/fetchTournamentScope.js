const { getOrganizerTournamentScope } = require('../utils/tournamentScope');

const fetchTournamentScope = async (req, res, next) => {
  try {
    const routeTournamentMatch = String(req.path || '').match(/^\/tournament\/([^/]+)$/);
    req.tournamentScope = await getOrganizerTournamentScope({
      organizerId: req.user?.id,
      requestedTournamentId: req.query?.tournament || routeTournamentMatch?.[1] || null
    });
    next();
  } catch (error) {
    const messages = {
      TOURNAMENT_ID_INVALID: 'Invalid tournament ID.',
      TOURNAMENT_NOT_FOUND: 'Tournament not found for this organizer.',
      TOURNAMENT_NOT_CONFIGURED: 'Create a tournament before managing teams or players.',
      TOURNAMENT_SELECTION_REQUIRED: 'Tournament selection is required for this organizer.'
    };
    res.status(error.statusCode || 500).json({
      message: messages[error.message] || 'Unable to resolve tournament scope.'
    });
  }
};

module.exports = fetchTournamentScope;
