const express = require('express');
const Plan = require('../models/Plan');
const fetchOrganizer = require('../middleware/fetchOrganizer');

const router = express.Router();

const DEFAULT_PLANS = [
  {
    name: 'Free',
    price: 0,
    subtitle: 'शुरुआती ट्रायल और छोटे ऑक्शन के लिए',
    teamLimit: 3,
    canPublicRegistration: false,
    canViewTeams: false,
    features: ['Up to 3 Teams', 'Manual Player Entry', 'No Public Registration Link', 'No View Teams Button'],
    isPopular: false
  },
  {
    name: 'Basic',
    price: 499,
    subtitle: 'छोटी लीग और क्लब्स के लिए',
    teamLimit: 8,
    canPublicRegistration: false,
    canViewTeams: true,
    features: ['Up to 8 Teams', 'Live Projector Screen', 'View Teams Enabled', 'No Public Registration Link'],
    isPopular: false
  },
  {
    name: 'Pro',
    price: 999,
    subtitle: 'प्रोफेशनल टूर्नामेंट्स के लिए',
    teamLimit: -1,
    canPublicRegistration: true,
    canViewTeams: true,
    features: ['Unlimited Teams', 'Live Projector Screen', 'Public Registration Link', 'Priority Feature Access'],
    isPopular: true
  }
];

const seedMissingPlans = async () => {
  const existingPlans = await Plan.find({}, { name: 1 }).lean();
  const existingNames = new Set(existingPlans.map((plan) => plan.name));
  const missingPlans = DEFAULT_PLANS.filter((plan) => !existingNames.has(plan.name));

  if (missingPlans.length > 0) {
    await Plan.insertMany(missingPlans);
  }
};

router.get('/', async (req, res) => {
  try {
    await seedMissingPlans();
    const plans = await Plan.find({ name: { $in: DEFAULT_PLANS.map((plan) => plan.name) } }).sort({ price: 1 });
    return res.json(plans);
  } catch (error) {
    console.error('Plan fetch error:', error);
    return res.status(500).json({ message: 'प्लान्स लाने में एरर!' });
  }
});

router.put('/:id', fetchOrganizer, async (req, res) => {
  try {
    if (req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'Access Denied!' });
    }

    const updatedPlan = await Plan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!updatedPlan) {
      return res.status(404).json({ message: 'प्लान नहीं मिला।' });
    }

    return res.json({ message: 'प्लान अपडेट हो गया!', plan: updatedPlan });
  } catch (error) {
    console.error('Plan update error:', error);
    return res.status(500).json({ message: 'प्लान अपडेट करने में एरर!' });
  }
});

module.exports = router;