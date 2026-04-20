const express = require('express');
const Team = require('../models/Team');
const User = require('../models/User');
const fetchOrganizer = require('../middleware/fetchOrganizer');
const { getPolicyByPlanName, resolveEffectivePlan } = require('../utils/planPolicy');
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
    const normalizedShortName = String(shortName || '').trim().toUpperCase();
    if (!normalizedShortName) {
      return res.status(400).json({ message: 'Short name is required.' });
    }

    const duplicateTeam = await Team.findOne({ teamName, organizer: req.user.id });
    if (duplicateTeam) {
      return res.status(400).json({ message: 'यह टीम पहले से मौजूद है!' });
    }
    const duplicateShortName = await Team.findOne({ shortName: normalizedShortName, organizer: req.user.id });
    if (duplicateShortName) {
      return res.status(400).json({ message: 'यह short name पहले से मौजूद है!' });
    }

    const teamPayload = buildTeamPayload({
      teamName,
      shortName: normalizedShortName,
      totalPurse,
      ownerName,
      mobile,
      logoUrl,
      organizerId: req.user.id
    });

    if (req.user.role === 'SuperAdmin') {
      const savedTeam = await new Team(teamPayload).save();
      return res.json(savedTeam);
    }

    const organizer = await User.findById(req.user.id).select('plan').lean();
    const organizerPlan = resolveEffectivePlan(organizer);
    const teamLimit = getPolicyByPlanName(organizerPlan).teamLimit;

    if (teamLimit !== -1) {
      const currentTeamCount = await Team.countDocuments({ organizer: req.user.id });
      if (currentTeamCount >= teamLimit) {
        return res.status(403).json({
          message: `आपके ${organizerPlan} प्लान में अधिकतम ${teamLimit} टीम्स की अनुमति है।`
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
    const teams = await Team.find({ organizer: req.user.id }).lean();
    const auctionState = await getAuctionStateForOrganizer({ organizerId: req.user.id });
    const teamsWithMaxBid = decorateTeamsWithMaxBid({
      teams,
      auctionState,
      currentBasePrice: auctionState.tournamentMinBasePrice
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
    const normalizedShortName = String(shortName || '').trim().toUpperCase();
    if (!normalizedShortName) {
      return res.status(400).json({ message: 'Short name is required.' });
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
      { teamName, shortName: normalizedShortName, totalPurse, remainingPurse, ownerName, mobile, logoUrl, logo: logoUrl || '' },
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
    const deletedTeam = await Team.findOneAndDelete({
      _id: req.params.id,
      organizer: req.user.id
    });

    if (!deletedTeam) {
      return res.status(404).json({ message: 'टीम नहीं मिली।' });
    }

    return res.json({ message: 'टीम डिलीट हो गई।', team: deletedTeam });
  } catch (error) {
    console.error('Team delete error:', error.message);
    return res.status(500).json({ message: 'एरर: टीम डिलीट नहीं हो पाई।' });
  }
});

module.exports = router;