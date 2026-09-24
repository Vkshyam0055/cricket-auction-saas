const express = require('express');
const Team = require('../models/Team');
const Player = require('../models/Player');
const User = require('../models/User');
const fetchOrganizer = require('../middleware/fetchOrganizer');
const { getPolicyByPlanName, getEffectivePlanPolicy, resolveEffectivePlan } = require('../utils/planPolicy');
const { getAuctionStateForOrganizer, decorateTeamsWithMaxBid } = require('../utils/maxBid');

const router = express.Router();

router.use(fetchOrganizer);

const buildTeamPayload = ({ teamName, shortName, totalPurse, ownerName, mobile, logoUrl, organizerId }) => ({
  teamName,
  shortName,
  totalPurse,
  remainingPurse: totalPurse,
  ownerName,
  mobile,
  logoUrl,
  logo: logoUrl,
  organizer: organizerId
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

    const duplicateTeam = await Team.findOne({ teamName: trimmedTeamName, organizer: req.user.id });
    if (duplicateTeam) {
      return res.status(400).json({ message: 'यह टीम पहले से मौजूद है!' });
    }
    const duplicateShortName = await Team.findOne({ shortName: normalizedShortName, organizer: req.user.id });
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
      organizerId: req.user.id
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
    const teams = await Team.find({ organizer: req.user.id }).lean();
    const auctionState = await getAuctionStateForOrganizer({ organizerId: req.user.id });
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

    const duplicateTeam = await Team.findOne({
      _id: { $ne: req.params.id },
      teamName: trimmedTeamName,
      organizer: req.user.id
    });
    if (duplicateTeam) {
      return res.status(400).json({ message: 'यह टीम नाम पहले से मौजूद है!' });
    }

    const duplicateShortName = await Team.findOne({
      _id: { $ne: req.params.id },
      shortName: normalizedShortName,
      organizer: req.user.id
    });
    if (duplicateShortName) {
      return res.status(400).json({ message: 'यह short name पहले से मौजूद है!' });
    }

    const updatedTeam = await Team.findOneAndUpdate(
      { _id: req.params.id, organizer: req.user.id },
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
    const teamToDelete = await Team.findOne({
      _id: req.params.id,
      organizer: req.user.id
    });

    if (!teamToDelete) {
      return res.status(404).json({ message: 'टीम नहीं मिली।' });
    }

    // Safety guard: check if any players reference this team
    const soldPlayerCount = await Player.countDocuments({
      organizer: req.user.id,
      auctionStatus: { $in: ['Sold', 'Icon'] },
      soldTo: req.params.id
    });

    if (soldPlayerCount > 0) {
      return res.status(400).json({
        message: `इस टीम में ${soldPlayerCount} खिलाड़ी सोल्ड/आइकन हैं। टीम डिलीट करने से पहले ऑक्शन रीसेट करें या खिलाड़ियों को अनसोल्ड करें।`
      });
    }

    await Team.deleteOne({ _id: req.params.id, organizer: req.user.id });

    return res.json({ message: 'टीम डिलीट हो गई।', team: teamToDelete });
  } catch (error) {
    console.error('Team delete error:', error.message);
    return res.status(500).json({ message: 'एरर: टीम डिलीट नहीं हो पाई।' });
  }
});

module.exports = router;