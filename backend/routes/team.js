const express = require('express');
const Team = require('../models/Team');
const Player = require('../models/Player');
const User = require('../models/User');
const fetchOrganizer = require('../middleware/fetchOrganizer');
const fetchTournamentScope = require('../middleware/fetchTournamentScope');
const { getPolicyByPlanName, getEffectivePlanPolicy, resolveEffectivePlan } = require('../utils/planPolicy');
const { getAuctionStateForOrganizer, decorateTeamsWithMaxBid } = require('../utils/maxBid');
const { getOrganizerTournamentScope, mergeWithTournamentScope } = require('../utils/tournamentScope');
const { revokeTeamOwnerSessions } = require('../utils/sessionAuth');

const router = express.Router();

router.use(fetchOrganizer);
router.use(fetchTournamentScope);

const buildTeamPayload = ({ teamName, shortName, totalPurse, ownerName, mobile, logoUrl, organizerId, tournamentId }) => ({
  teamName,
  shortName,
  totalPurse,
  remainingPurse: totalPurse,
  ownerName,
  mobile,
  logoUrl,
  logo: logoUrl,
  organizer: organizerId,
  tournament: tournamentId
});

router.post('/', async (req, res) => {
  try {
    const { teamName, shortName, totalPurse, ownerName, mobile, logoUrl } = req.body;
    const trimmedTeamName = String(teamName || '').trim();
    if (!trimmedTeamName) {
      return res.status(400).json({ message: 'Team name is required.' });
    }

    const normalizedShortName = String(shortName || '').trim().toUpperCase();
    if (!normalizedShortName) {
      return res.status(400).json({ message: 'Short name is required.' });
    }
    if (!/^[A-Z0-9]{1,5}$/.test(normalizedShortName)) {
      return res.status(400).json({ message: 'Short name must be 1 to 5 alphanumeric characters (A-Z, 0-9).' });
    }

    const duplicateTeam = await Team.findOne(mergeWithTournamentScope(
      { teamName: trimmedTeamName, organizer: req.user.id },
      req.tournamentScope
    ));
    if (duplicateTeam) {
      return res.status(400).json({ message: 'यह टीम पहले से मौजूद है!' });
    }
    const duplicateShortName = await Team.findOne(mergeWithTournamentScope(
      { shortName: normalizedShortName, organizer: req.user.id },
      req.tournamentScope
    ));
    if (duplicateShortName) {
      return res.status(400).json({ message: 'यह short name पहले से मौजूद है!' });
    }

    const teamPayload = buildTeamPayload({
      teamName: trimmedTeamName,
      shortName: normalizedShortName,
      totalPurse,
      ownerName,
      mobile,
      logoUrl,
      organizerId: req.user.id,
      tournamentId: req.tournamentScope.tournamentId
    });

    if (req.user.role === 'SuperAdmin' && !req.user.isImpersonated) {
      const savedTeam = await new Team(teamPayload).save();
      return res.json(savedTeam);
    }

    const organizer = await User.findById(req.user.id).select('plan').lean();
    const organizerPlan = resolveEffectivePlan(organizer);
    const policy = await getEffectivePlanPolicy(organizerPlan);
    const teamLimit = policy.teamLimit;

    if (teamLimit !== -1) {
      const currentTeamCount = await Team.countDocuments({ organizer: req.user.id });
      if (currentTeamCount >= teamLimit) {
        return res.status(403).json({
          message: `आपके ${organizerPlan} प्लान में अधिकतम ${teamLimit} टीम्स की अनुमति है। वर्तमान में आपके पास ${currentTeamCount} टीम्स हैं। नया टीम बनाने के लिए कृपया प्लान अपग्रेड करें।`
        });
      }
    }

    const savedTeam = await new Team(teamPayload).save();
    return res.json(savedTeam);
  } catch (error) {
    console.error('Team create error:', error.message);
    return res.status(500).json({ message: 'इंजन में कोई तकनीकी खराबी आ गई है!' });
  }
});

// Remote management uses an explicit tournament ID. Legacy records are included
// only when the organizer has exactly one tournament.
router.get('/tournament/:tournamentId', async (req, res) => {
  try {
    const tournamentScope = await getOrganizerTournamentScope({
      organizerId: req.user.id,
      requestedTournamentId: req.params.tournamentId
    });
    const teams = await Team.find(mergeWithTournamentScope(
      { organizer: req.user.id },
      tournamentScope
    )).select('-remotePasswordHash').lean();
    res.json(teams);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: 'Unable to resolve tournament teams.' });
  }
});

router.get('/', async (req, res) => {
  try {
    if (req.headers['x-view-mode'] === 'teams-dashboard') {
      const organizer = await User.findById(req.user.id).select('plan role').lean();
      const organizerPlan = resolveEffectivePlan(organizer);
      const policy = await getEffectivePlanPolicy(organizerPlan);
      if (!policy.canViewTeams && (req.user.role !== 'SuperAdmin' || req.user.isImpersonated)) {
        return res.status(403).json({ 
          message: 'टीम देखने का फीचर आपके प्लान में उपलब्ध नहीं है। कृपया प्लान अपग्रेड करें।',
          upgradeRequired: true 
        });
      }
    }

    const queryBasePrice = Number(req.query.basePrice);
    const currentBasePrice = Number.isFinite(queryBasePrice) && queryBasePrice >= 0
      ? queryBasePrice
      : undefined;
    const teams = await Team.find(mergeWithTournamentScope(
      { organizer: req.user.id },
      req.tournamentScope
    )).select('-remotePasswordHash').lean();
    const auctionState = await getAuctionStateForOrganizer({
      organizerId: req.user.id,
      tournamentScope: req.tournamentScope
    });
    const teamsWithMaxBid = decorateTeamsWithMaxBid({
      teams,
      auctionState,
      currentBasePrice
    });
    return res.json(teamsWithMaxBid);
  } catch (error) {
    console.error('Team fetch error:', error.message);
    return res.status(500).json({ message: 'टीमें लाने में खराबी आ गई है!' });
  }
});

// Phase 2.4 / Phase 7: Manage Remote Access with Plan Policy Enforcement
router.put('/:id/remote-access', async (req, res) => {
  try {
    const organizer = await User.findById(req.user.id).select('plan role').lean();
    const organizerPlan = resolveEffectivePlan(organizer);
    const policy = await getEffectivePlanPolicy(organizerPlan);

    if (!policy.canRemoteBidding && (req.user.role !== 'SuperAdmin' || req.user.isImpersonated)) {
      return res.status(403).json({
        message: 'Remote bidding feature is not available in your current plan. Please upgrade to Pro plan to manage remote bidding.',
        upgradeRequired: true
      });
    }

    const { remoteAccessEnabled, remoteUsername, remotePassword } = req.body;
    
    const team = await Team.findOne(mergeWithTournamentScope(
      { _id: req.params.id, organizer: req.user.id },
      req.tournamentScope
    ));
    if (!team) return res.status(404).json({ message: 'Team not found' });

    team.remoteAccessEnabled = Boolean(remoteAccessEnabled);
    if (remoteUsername !== undefined) {
      team.remoteUsername = String(remoteUsername).trim();
    }
    
    if (remotePassword) {
      const trimmedPassword = String(remotePassword).trim();
      if (trimmedPassword.length < 4) {
        return res.status(400).json({ message: 'Password must be at least 4 characters.' });
      }
      const bcrypt = require('bcryptjs');
      team.remotePasswordHash = await bcrypt.hash(trimmedPassword, 10);
    }

    await team.save();
    const shouldRevoke = !team.remoteAccessEnabled || Boolean(remotePassword) || remoteUsername !== undefined;
    if (shouldRevoke) await revokeTeamOwnerSessions(team._id);

    const sanitizedTeam = team.toObject();
    delete sanitizedTeam.remotePasswordHash;

    res.json({ message: 'Remote access updated successfully', team: sanitizedTeam });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Username already taken in this tournament' });
    }
    console.error('Update remote access error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { teamName, shortName, totalPurse, remainingPurse, ownerName, mobile, logoUrl } = req.body;
    const trimmedTeamName = String(teamName || '').trim();
    if (!trimmedTeamName) {
      return res.status(400).json({ message: 'Team name is required.' });
    }

    const normalizedShortName = String(shortName || '').trim().toUpperCase();
    if (!normalizedShortName) {
      return res.status(400).json({ message: 'Short name is required.' });
    }
    if (!/^[A-Z0-9]{1,5}$/.test(normalizedShortName)) {
      return res.status(400).json({ message: 'Short name must be 1 to 5 alphanumeric characters (A-Z, 0-9).' });
    }

    const duplicateTeam = await Team.findOne(mergeWithTournamentScope({
      _id: { $ne: req.params.id },
      teamName: trimmedTeamName,
      organizer: req.user.id
    }, req.tournamentScope));
    if (duplicateTeam) {
      return res.status(400).json({ message: 'यह टीम नाम पहले से मौजूद है!' });
    }

    const duplicateShortName = await Team.findOne(mergeWithTournamentScope({
      _id: { $ne: req.params.id },
      shortName: normalizedShortName,
      organizer: req.user.id
    }, req.tournamentScope));
    if (duplicateShortName) {
      return res.status(400).json({ message: 'यह short name पहले से मौजूद है!' });
    }

    const updatedTeam = await Team.findOneAndUpdate(
      mergeWithTournamentScope({ _id: req.params.id, organizer: req.user.id }, req.tournamentScope),
      { teamName: trimmedTeamName, shortName: normalizedShortName, totalPurse, remainingPurse, ownerName, mobile, logoUrl, logo: logoUrl || '' },
      { new: true }
    );

    if (!updatedTeam) {
      return res.status(404).json({ message: 'टीम नहीं मिली।' });
    }

    return res.status(200).json(updatedTeam);
  } catch (error) {
    console.error('Team update error:', error.message);
    return res.status(500).json({ message: 'एरर: टीम अपडेट नहीं हो पाई।' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const teamToDelete = await Team.findOne(mergeWithTournamentScope({
      _id: req.params.id,
      organizer: req.user.id
    }, req.tournamentScope));

    if (!teamToDelete) {
      return res.status(404).json({ message: 'टीम नहीं मिली।' });
    }

    // Safety guard: check if any players reference this team
    const soldPlayerCount = await Player.countDocuments(mergeWithTournamentScope({
      organizer: req.user.id,
      auctionStatus: { $in: ['Sold', 'Icon'] },
      soldTo: req.params.id
    }, req.tournamentScope));

    if (soldPlayerCount > 0) {
      return res.status(400).json({
        message: `इस टीम में ${soldPlayerCount} खिलाड़ी सोल्ड/आइकन हैं। टीम डिलीट करने से पहले ऑक्शन रीसेट करें या खिलाड़ियों को अनसोल्ड करें।`
      });
    }

    await Team.deleteOne(mergeWithTournamentScope({ _id: req.params.id, organizer: req.user.id }, req.tournamentScope));
    await revokeTeamOwnerSessions(teamToDelete._id);

    return res.json({ message: 'टीम डिलीट हो गई।', team: teamToDelete });
  } catch (error) {
    console.error('Team delete error:', error.message);
    return res.status(500).json({ message: 'एरर: टीम डिलीट नहीं हो पाई।' });
  }
});

module.exports = router;
