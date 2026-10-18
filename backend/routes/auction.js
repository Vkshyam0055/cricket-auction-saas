const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validateSessionById, validateTeamOwnerSession, getJwtSecret } = require('../utils/sessionAuth');
const { getOrganizerTournamentScope } = require('../utils/tournamentScope');
const Team = require('../models/Team');
const Player = require('../models/Player');
const Tournament = require('../models/Tournament');
const AuctionState = require('../models/AuctionState');
const auctionService = require('../services/auctionService');
const { getAuctionStateForOrganizer, decorateTeamsWithMaxBid } = require('../utils/maxBid');

const router = express.Router();

const authenticateAuctionParticipant = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1];

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ message: 'Authentication token required.' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (decoded.role === 'TeamOwner') {
      const validation = await validateTeamOwnerSession({
        sessionId: decoded.sid,
        teamId: decoded.teamId,
        organizerId: decoded.organizerId,
        tournamentId: decoded.tournamentId
      });
      if (!validation.ok) {
        return res.status(401).json({ message: 'Session expired or revoked.' });
      }

      const team = await Team.findOne({
        _id: decoded.teamId,
        organizer: decoded.organizerId,
        tournament: decoded.tournamentId
      });
      if (!team) {
        return res.status(401).json({ message: 'Team no longer exists.' });
      }
      if (!team.remoteAccessEnabled) {
        return res.status(403).json({ message: 'Remote access is currently disabled for this team.' });
      }

      const tournamentObjectId = mongoose.Types.ObjectId.isValid(decoded.tournamentId)
        ? new mongoose.Types.ObjectId(String(decoded.tournamentId))
        : decoded.tournamentId;

      req.teamOwner = {
        teamId: decoded.teamId,
        organizerId: decoded.organizerId,
        tournamentId: decoded.tournamentId,
        role: decoded.role
      };
      req.team = team;
      req.tournamentScope = {
        tournamentId: tournamentObjectId,
        filter: { tournament: tournamentObjectId }
      };
      return next();
    }

    // Default: Organizer
    const validation = await validateSessionById({ sessionId: decoded.sid, userId: decoded.id });
    if (!validation.ok) {
      return res.status(401).json({ message: 'Session expired or revoked.' });
    }
    req.user = decoded;
    req.session = validation.session;

    const routeTournamentMatch = String(req.path || '').match(/^\/tournament\/([^/]+)$/);
    const requestedTournamentId =
      req.query?.tournament ||
      req.query?.tournamentId ||
      req.headers?.['x-tournament-id'] ||
      req.headers?.['tournament-id'] ||
      req.body?.tournamentId ||
      req.body?.tournament ||
      routeTournamentMatch?.[1] ||
      null;

    req.tournamentScope = await getOrganizerTournamentScope({
      organizerId: req.user.id,
      requestedTournamentId
    });
    next();
  } catch (error) {
    console.warn('[auctionAuth] Token verification failed:', error?.message);
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

router.use(authenticateAuctionParticipant);

const sendAuctionError = (res, error) => res.status(error.statusCode || 500).json({ message: error.publicMessage || 'Auction operation failed.', code: error.message });

router.get('/state', async (req, res) => {
  try {
    const organizerId = req.user?.id || req.teamOwner?.organizerId;
    res.json(await auctionService.getStatePayload({ organizerId, tournamentScope: req.tournamentScope }));
  } catch (error) { sendAuctionError(res, error); }
});

router.post('/start', async (req, res) => {
  if (req.teamOwner) return res.status(403).json({ message: 'Only organizer can start auction.' });
  try { res.json(await auctionService.startAuction({ organizerId: req.user.id, tournamentScope: req.tournamentScope, playerId: req.body.playerId })); }
  catch (error) { sendAuctionError(res, error); }
});

router.post('/bid', async (req, res) => {
  try {
    const isOrganizer = Boolean(req.user);
    const organizerId = isOrganizer ? req.user.id : req.teamOwner.organizerId;
    // Team Owner teamId is derived STRICTLY from authenticated session, never request body!
    const teamId = isOrganizer ? req.body.teamId : req.teamOwner.teamId;
    // Team Owner can ONLY use organizer-configured increments, no custom or base bids
    const allowCustomBid = isOrganizer;
    const bidType = isOrganizer ? (req.body.bidType || 'increment') : 'increment';

    res.json(await auctionService.placeBid({
      organizerId,
      tournamentScope: req.tournamentScope,
      teamId,
      playerId: req.body.playerId,
      amount: req.body.amount,
      bidType,
      expectedVersion: req.body.expectedVersion,
      allowCustomBid
    }));
  } catch (error) { sendAuctionError(res, error); }
});

router.post('/reset-bid', async (req, res) => {
  if (req.teamOwner) return res.status(403).json({ message: 'Only organizer can reset bid.' });
  try { res.json(await auctionService.resetAuctionBid({ organizerId: req.user.id, tournamentScope: req.tournamentScope, playerId: req.body.playerId, expectedVersion: req.body.expectedVersion })); }
  catch (error) { sendAuctionError(res, error); }
});

// =========================================================================
// Phase 6: Team Owner Authorized Data Views
// =========================================================================

// 1. My Team Squad
router.get('/team-squad', async (req, res) => {
  try {
    const isOrganizer = Boolean(req.user);
    const organizerId = isOrganizer ? req.user.id : req.teamOwner.organizerId;
    const tournamentId = req.tournamentScope?.tournamentId;
    const targetTeamId = isOrganizer ? (req.query.teamId || req.user.teamId) : req.teamOwner.teamId;

    if (!targetTeamId) {
      return res.status(400).json({ message: 'Target teamId is required.' });
    }

    const team = await Team.findOne({ _id: targetTeamId, organizer: organizerId }).lean();
    if (!team) return res.status(404).json({ message: 'Team not found.' });

    const squadPlayers = await Player.find({
      organizer: organizerId,
      tournament: tournamentId,
      soldTo: team._id,
      auctionStatus: { $in: ['Sold', 'sold', 'Icon', 'icon'] }
    }).select('name photoUrl role category basePrice soldPrice isIcon auctionStatus').lean();

    const totalSpent = squadPlayers.reduce((acc, p) => acc + Number(p.soldPrice || 0), 0);

    let dynamicMaxBid = Number(team.remainingPurse || 0);
    try {
      const [auctionState, liveAuctionState] = await Promise.all([
        getAuctionStateForOrganizer({
          organizerId,
          tournamentScope: req.tournamentScope
        }),
        AuctionState.findOne({
          tournament: tournamentId
        }).populate('activePlayer', 'basePrice').lean()
      ]);
      const activeBasePrice = (liveAuctionState?.activePlayer?.basePrice && Number(liveAuctionState.activePlayer.basePrice) > 0)
        ? Number(liveAuctionState.activePlayer.basePrice)
        : undefined;

      const [decoratedTeam] = decorateTeamsWithMaxBid({
        teams: [team],
        auctionState,
        currentBasePrice: activeBasePrice
      });
      if (decoratedTeam && typeof decoratedTeam.maxBid === 'number') {
        dynamicMaxBid = decoratedTeam.maxBid;
      }
    } catch (e) {
      console.warn('Failed to calculate dynamic maxBid for team-squad:', e.message);
    }

    res.json({
      team: {
        _id: team._id,
        teamName: team.teamName,
        shortName: team.shortName,
        logoUrl: team.logoUrl || team.logo || '',
        totalPurse: team.totalPurse,
        remainingPurse: team.remainingPurse,
        maxBid: dynamicMaxBid,
        ownerName: team.ownerName
      },
      squad: squadPlayers,
      squadCount: squadPlayers.length,
      totalSpent
    });
  } catch (error) {
    sendAuctionError(res, error);
  }
});

// 2. Other Teams / Squads (Approved Shared Information)
router.get('/other-teams', async (req, res) => {
  try {
    const isOrganizer = Boolean(req.user);
    const organizerId = isOrganizer ? req.user.id : req.teamOwner.organizerId;
    const tournamentId = req.tournamentScope?.tournamentId;
    const myTeamId = req.teamOwner ? String(req.teamOwner.teamId) : null;

    const allTeams = await Team.find({
      organizer: organizerId,
      tournament: tournamentId
    }).select('_id teamName shortName logoUrl logo totalPurse remainingPurse maxBid').lean();

    let decoratedTeams = allTeams;
    try {
      const [auctionState, liveAuctionState] = await Promise.all([
        getAuctionStateForOrganizer({
          organizerId,
          tournamentScope: req.tournamentScope
        }),
        AuctionState.findOne({
          tournament: tournamentId
        }).populate('activePlayer', 'basePrice').lean()
      ]);
      const activeBasePrice = (liveAuctionState?.activePlayer?.basePrice && Number(liveAuctionState.activePlayer.basePrice) > 0)
        ? Number(liveAuctionState.activePlayer.basePrice)
        : undefined;

      decoratedTeams = decorateTeamsWithMaxBid({
        teams: allTeams,
        auctionState,
        currentBasePrice: activeBasePrice
      });
    } catch (e) {
      console.warn('Failed to decorate other-teams with maxBid:', e.message);
    }

    const soldPlayers = await Player.find({
      organizer: organizerId,
      tournament: tournamentId,
      auctionStatus: { $in: ['Sold', 'sold', 'Icon', 'icon'] }
    }).select('_id name photoUrl role category soldPrice soldTo').lean();

    const teamsData = decoratedTeams.map((team) => {
      const teamIdStr = String(team._id);
      const teamSquad = soldPlayers.filter((p) => {
        const soldRef = String(p.soldTo?._id || p.soldTo || '');
        return soldRef === teamIdStr;
      });

      return {
        _id: team._id,
        teamName: team.teamName,
        shortName: team.shortName,
        logoUrl: team.logoUrl || team.logo || '',
        totalPurse: team.totalPurse,
        remainingPurse: team.remainingPurse,
        maxBid: team.maxBid !== undefined ? team.maxBid : team.remainingPurse,
        squadCount: teamSquad.length,
        squad: teamSquad.map((p) => ({
          _id: p._id,
          name: p.name,
          role: p.role,
          category: p.category,
          soldPrice: p.soldPrice
        })),
        isMyTeam: myTeamId ? myTeamId === teamIdStr : false
      };
    });

    res.json(teamsData);
  } catch (error) {
    sendAuctionError(res, error);
  }
});

// 3. Sold Players
router.get('/sold-players', async (req, res) => {
  try {
    const organizerId = req.user?.id || req.teamOwner?.organizerId;
    const tournamentId = req.tournamentScope?.tournamentId;

    const teams = await Team.find({ organizer: organizerId, tournament: tournamentId }).select('_id teamName shortName logoUrl logo').lean();
    const teamMap = new Map();
    teams.forEach(t => {
      teamMap.set(String(t._id), t);
      teamMap.set(t.teamName.toLowerCase(), t);
    });

    const soldPlayers = await Player.find({
      organizer: organizerId,
      tournament: tournamentId,
      auctionStatus: { $in: ['Sold', 'sold', 'Icon', 'icon'] }
    }).select('name photoUrl role category basePrice soldPrice soldTo auctionStatus updatedAt').sort({ updatedAt: -1 }).lean();

    const enriched = soldPlayers.map(p => {
      const soldRef = String(p.soldTo?._id || p.soldTo || '');
      const team = teamMap.get(soldRef) || teamMap.get(soldRef.toLowerCase()) || null;
      return {
        _id: p._id,
        name: p.name,
        photoUrl: p.photoUrl,
        role: p.role,
        category: p.category,
        basePrice: p.basePrice,
        soldPrice: p.soldPrice,
        auctionStatus: p.auctionStatus,
        soldToTeam: team ? {
          _id: team._id,
          teamName: team.teamName,
          shortName: team.shortName,
          logoUrl: team.logoUrl || team.logo || ''
        } : { teamName: typeof p.soldTo === 'string' ? p.soldTo : 'Unknown' }
      };
    });

    res.json(enriched);
  } catch (error) {
    sendAuctionError(res, error);
  }
});

// 4. Unsold Players
router.get('/unsold-players', async (req, res) => {
  try {
    const organizerId = req.user?.id || req.teamOwner?.organizerId;
    const tournamentId = req.tournamentScope?.tournamentId;

    const unsoldPlayers = await Player.find({
      organizer: organizerId,
      tournament: tournamentId,
      auctionStatus: { $in: ['Unsold', 'unsold', 'Passed', 'passed'] }
    }).select('name photoUrl role category basePrice auctionStatus').sort({ name: 1 }).lean();

    res.json(unsoldPlayers);
  } catch (error) {
    sendAuctionError(res, error);
  }
});

// 5. Auction Summary
router.get('/summary', async (req, res) => {
  try {
    const organizerId = req.user?.id || req.teamOwner?.organizerId;
    const tournamentId = req.tournamentScope?.tournamentId;

    const [allPlayers, allTeams, tournament] = await Promise.all([
      Player.find({ organizer: organizerId, tournament: tournamentId, approvalStatus: 'Approved' }).select('name photoUrl role category basePrice soldPrice soldTo auctionStatus').lean(),
      Team.find({ organizer: organizerId, tournament: tournamentId }).select('_id teamName shortName totalPurse remainingPurse').lean(),
      Tournament.findById(tournamentId).select('name bannerUrl logoUrl').lean()
    ]);

    const sold = allPlayers.filter(p => ['sold', 'icon'].includes(String(p.auctionStatus || '').toLowerCase()));
    const unsold = allPlayers.filter(p => ['unsold', 'passed'].includes(String(p.auctionStatus || '').toLowerCase()));
    const ready = allPlayers.filter(p => ['readyforauction', 'ready'].includes(String(p.auctionStatus || '').toLowerCase()));

    const totalSoldValue = sold.reduce((acc, p) => acc + Number(p.soldPrice || 0), 0);
    const totalLeaguePurse = allTeams.reduce((acc, t) => acc + Number(t.totalPurse || 0), 0);
    const totalRemainingPurse = allTeams.reduce((acc, t) => acc + Number(t.remainingPurse || 0), 0);

    const teamMap = new Map();
    allTeams.forEach(t => teamMap.set(String(t._id), t.shortName || t.teamName));

    const topBiddings = [...sold]
      .sort((a, b) => Number(b.soldPrice || 0) - Number(a.soldPrice || 0))
      .slice(0, 10)
      .map(p => ({
        _id: p._id,
        name: p.name,
        photoUrl: p.photoUrl,
        role: p.role,
        category: p.category,
        soldPrice: p.soldPrice,
        teamName: teamMap.get(String(p.soldTo?._id || p.soldTo || '')) || p.soldTo?.teamName || p.soldTo || 'Sold'
      }));

    res.json({
      tournamentName: tournament?.name || 'Tournament Auction',
      totalPlayers: allPlayers.length,
      soldCount: sold.length,
      unsoldCount: unsold.length,
      readyCount: ready.length,
      totalTeams: allTeams.length,
      totalSoldValue,
      totalLeaguePurse,
      totalRemainingPurse,
      topBiddings
    });
  } catch (error) {
    sendAuctionError(res, error);
  }
});

// 6. Profile / Change Password (Team Owner)
router.post('/change-password', async (req, res) => {
  if (!req.teamOwner) {
    return res.status(403).json({ message: 'Only Team Owners can change password through this endpoint.' });
  }

  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    const team = await Team.findById(req.teamOwner.teamId);
    if (!team) return res.status(404).json({ message: 'Team not found.' });

    const isMatch = await bcrypt.compare(currentPassword, team.remotePasswordHash || '');
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    team.remotePasswordHash = await bcrypt.hash(newPassword, 10);
    await team.save();

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    sendAuctionError(res, error);
  }
});

module.exports = router;
