const express = require('express');
const Team = require('../models/Team');
const User = require('../models/User');
const fetchOrganizer = require('../middleware/fetchOrganizer');

const router = express.Router();

router.use(fetchOrganizer);

const PLAN_TEAM_LIMITS = {
  Free: 3,
  Basic: 8,
  Pro: -1
};

const normalizePlanName = (planName = 'Free') => {
  if (planName === 'Free Plan') return 'Free';
  if (planName === 'Basic Plan') return 'Basic';
  if (planName === 'Pro Plan') return 'Pro';
  if (planName === 'Premium') return 'Pro';
  if (planName === 'Premium Plan') return 'Pro';
  return Object.prototype.hasOwnProperty.call(PLAN_TEAM_LIMITS, planName) ? planName : 'Free';
};

const getTeamLimitByPlan = (planName = 'Free') => PLAN_TEAM_LIMITS[normalizePlanName(planName)];

const buildTeamPayload = ({ teamName, totalPurse, ownerName, mobile, logoUrl, organizerId }) => ({
  teamName,
  totalPurse,
  remainingPurse: totalPurse,
  ownerName,
  mobile,
  logoUrl,
  organizer: organizerId
});

router.post('/', async (req, res) => {
  try {
    const { teamName, totalPurse, ownerName, mobile, logoUrl } = req.body;

    const duplicateTeam = await Team.findOne({ teamName, organizer: req.user.id });
    if (duplicateTeam) {
      return res.status(400).json({ message: 'यह टीम पहले से मौजूद है!' });
    }

    const teamPayload = buildTeamPayload({
      teamName,
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
    const organizerPlan = normalizePlanName(organizer?.plan);
    const teamLimit = getTeamLimitByPlan(organizerPlan);

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
    const teams = await Team.find({ organizer: req.user.id });
    return res.json(teams);
  } catch (error) {
    console.error('Team fetch error:', error.message);
    return res.status(500).json({ message: 'टीमें लाने में खराबी आ गई है!' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { teamName, totalPurse, remainingPurse, ownerName, mobile, logoUrl } = req.body;

    const updatedTeam = await Team.findOneAndUpdate(
      { _id: req.params.id, organizer: req.user.id },
      { teamName, totalPurse, remainingPurse, ownerName, mobile, logoUrl },
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

module.exports = router;