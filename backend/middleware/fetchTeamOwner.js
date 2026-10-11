const jwt = require('jsonwebtoken');
const Team = require('../models/Team');
const { validateTeamOwnerSession, getJwtSecret } = require('../utils/sessionAuth');

/**
 * Middleware to verify a Team Owner's remote access token.
 * 
 * Token Revocation Strategy:
 * Because Team Owner tokens are stateless (unlike Organizer tokens which use UserSession),
 * we validate `team.remoteAccessEnabled` on every secured API request.
 * If an organizer toggles remote access OFF, any existing JWT immediately fails this check.
 */
const fetchTeamOwner = async (req, res, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || token === 'null' || token === 'undefined') {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        
        if (decoded.role !== 'TeamOwner' || !decoded.teamId) {
            return res.status(403).json({ message: "Invalid token role or scope." });
        }

        // Live check against the database to ensure remote access wasn't revoked
        const validation = await validateTeamOwnerSession({ sessionId: decoded.sid, teamId: decoded.teamId, organizerId: decoded.organizerId, tournamentId: decoded.tournamentId });
        if (!validation.ok) return res.status(401).json({ message: 'Session expired or revoked.' });
        const team = await Team.findOne({ _id: decoded.teamId, organizer: decoded.organizerId, tournament: decoded.tournamentId });
        
        if (!team) {
            return res.status(401).json({ message: "Team no longer exists." });
        }

        if (!team.remoteAccessEnabled) {
            return res.status(403).json({ message: "Remote access is currently disabled for this team." });
        }

        // Expose identity to downstream controllers
        req.teamOwner = {
            teamId: decoded.teamId,
            organizerId: decoded.organizerId,
            tournamentId: decoded.tournamentId,
            role: decoded.role
        };
        
        req.team = team;

        next();
    } catch (error) {
        console.warn('[fetchTeamOwner] Token verification failed:', error?.message);
        res.status(401).json({ message: "Invalid or expired token." });
    }
};

module.exports = fetchTeamOwner;
