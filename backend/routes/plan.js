const express = require('express');
const Plan = require('../models/Plan');
const fetchOrganizer = require('../middleware/fetchOrganizer');
const { invalidatePlanCache, CANONICAL_PLAN_NAMES, DEFAULT_PLAN_POLICIES } = require('../utils/planPolicy');

const router = express.Router();

const CANONICAL_ORDER = { Free: 1, Basic: 2, Pro: 3 };

const DEFAULT_PLANS = [
  {
    name: 'Free',
    price: 0,
    subtitle: 'शुरुआती ट्रायल और छोटे ऑक्शन के लिए',
    teamLimit: 3,
    playerLimit: 50,
    canPublicRegistration: false,
    canViewTeams: false,
    canLiveScreen: false,
    canCustomFields: false,
    features: ['Up to 3 Teams', 'Up to 50 Players Pool', 'Manual Player Entry', 'Basic Auction Room'],
    isPopular: false
  },
  {
    name: 'Basic',
    price: 2999,
    subtitle: 'छोटी लीग और क्लब्स के लिए',
    teamLimit: 8,
    playerLimit: 150,
    canPublicRegistration: false,
    canViewTeams: true,
    canLiveScreen: true,
    canCustomFields: false,
    features: ['Up to 8 Teams', 'Up to 150 Players Pool', 'Live Projector Screen', 'Team Rosters & Purse Tracking'],
    isPopular: false
  },
  {
    name: 'Pro',
    price: 7999,
    subtitle: 'प्रोफेशनल टूर्नामेंट्स के लिए',
    teamLimit: -1,
    playerLimit: -1,
    canPublicRegistration: true,
    canViewTeams: true,
    canLiveScreen: true,
    canCustomFields: true,
    features: ['Unlimited Teams', 'Unlimited Players Pool', 'Public Registration Link', 'Live Projector Screen', 'Priority Feature Access'],
    isPopular: true
  }
];

const seedAndBackfillPlans = async () => {
  const existingPlans = await Plan.find({ name: { $in: CANONICAL_PLAN_NAMES } });
  const existingMap = new Map(existingPlans.map((plan) => [plan.name, plan]));

  // 1. Insert any completely missing canonical plans
  const missingPlans = DEFAULT_PLANS.filter((plan) => !existingMap.has(plan.name));
  if (missingPlans.length > 0) {
    await Plan.insertMany(missingPlans);
  }

  // 2. Backfill missing fields on existing records without overwriting configured price or custom features
  for (const existing of existingPlans) {
    const defaultData = DEFAULT_PLANS.find((p) => p.name === existing.name);
    if (!defaultData) continue;

    let needsUpdate = false;
    const updates = {};

    if (typeof existing.playerLimit !== 'number') {
      updates.playerLimit = defaultData.playerLimit;
      needsUpdate = true;
    }
    if (typeof existing.canLiveScreen !== 'boolean') {
      updates.canLiveScreen = defaultData.canLiveScreen;
      needsUpdate = true;
    }
    if (typeof existing.canCustomFields !== 'boolean') {
      updates.canCustomFields = defaultData.canCustomFields;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await Plan.updateOne({ _id: existing._id }, { $set: updates });
    }
  }
};

router.get('/', async (req, res) => {
  try {
    await seedAndBackfillPlans();
    const plans = await Plan.find({ name: { $in: CANONICAL_PLAN_NAMES } }).lean();
    const sortedPlans = plans.sort((a, b) => (CANONICAL_ORDER[a.name] || 99) - (CANONICAL_ORDER[b.name] || 99));
    return res.json(sortedPlans);
  } catch (error) {
    console.error('Plan fetch error:', error);
    return res.status(500).json({ message: 'प्लान्स लाने में एरर!' });
  }
});

router.put('/:id', fetchOrganizer, async (req, res) => {
  try {
    if (req.user?.isImpersonated) {
      return res.status(403).json({ message: 'Access Denied: Impersonated sessions cannot access admin endpoints!' });
    }
    if (req.user?.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'Access Denied!' });
    }

    const {
      price,
      subtitle,
      teamLimit,
      playerLimit,
      canPublicRegistration,
      canViewTeams,
      canLiveScreen,
      canCustomFields,
      features,
      isPopular
    } = req.body;

    const updates = {};
    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) return res.status(400).json({ message: 'Invalid price value' });
      updates.price = numPrice;
    }
    if (subtitle !== undefined) updates.subtitle = String(subtitle || '').trim();

    if (teamLimit !== undefined) {
      const numTeamLimit = Number(teamLimit);
      if (isNaN(numTeamLimit) || (numTeamLimit !== -1 && numTeamLimit < 1)) {
        return res.status(400).json({ message: 'Invalid team limit. Use -1 for unlimited, or a positive integer.' });
      }
      updates.teamLimit = numTeamLimit;
    }

    if (playerLimit !== undefined) {
      const numPlayerLimit = Number(playerLimit);
      if (isNaN(numPlayerLimit) || (numPlayerLimit !== -1 && numPlayerLimit < 1)) {
        return res.status(400).json({ message: 'Invalid player limit. Use -1 for unlimited, or a positive integer.' });
      }
      updates.playerLimit = numPlayerLimit;
    }

    if (canPublicRegistration !== undefined) updates.canPublicRegistration = Boolean(canPublicRegistration);
    if (canViewTeams !== undefined) updates.canViewTeams = Boolean(canViewTeams);
    if (canLiveScreen !== undefined) updates.canLiveScreen = Boolean(canLiveScreen);
    if (canCustomFields !== undefined) updates.canCustomFields = Boolean(canCustomFields);
    if (isPopular !== undefined) updates.isPopular = Boolean(isPopular);
    if (Array.isArray(features)) {
      updates.features = features.map((f) => String(f).trim()).filter(Boolean);
    }

    const updatedPlan = await Plan.findByIdAndUpdate(req.params.id, { $set: updates }, {
      new: true,
      runValidators: true
    });

    if (!updatedPlan) {
      return res.status(404).json({ message: 'प्लान नहीं मिला।' });
    }

    // Invalidate the cache so all subsequent requests use the newly configured policy
    invalidatePlanCache();

    return res.json({ message: 'प्लान सफलतापूर्वक अपडेट हो गया!', plan: updatedPlan });
  } catch (error) {
    console.error('Plan update error:', error);
    return res.status(500).json({ message: 'प्लान अपडेट करने में एरर!' });
  }
});

module.exports = router;
module.exports.router = router;
module.exports.seedAndBackfillPlans = seedAndBackfillPlans;