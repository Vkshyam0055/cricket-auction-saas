const CANONICAL_PLAN_NAMES = ['Free', 'Basic', 'Pro'];

const LEGACY_TO_CANONICAL_PLAN = {
  'Free Plan': 'Free',
  'Basic Plan': 'Basic',
  Premium: 'Pro',
  'Premium Plan': 'Pro',
  'Pro Plan': 'Pro'
};

const DEFAULT_PLAN_POLICIES = {
  Free: {
    teamLimit: 3,
    playerLimit: 50,
    canPublicRegistration: false,
    canViewTeams: false,
    canLiveScreen: false,
    canCustomFields: false,
    price: 0
  },
  Basic: {
    teamLimit: 8,
    playerLimit: 150,
    canPublicRegistration: false,
    canViewTeams: true,
    canLiveScreen: true,
    canCustomFields: false,
    price: 2999
  },
  Pro: {
    teamLimit: -1,
    playerLimit: -1,
    canPublicRegistration: true,
    canViewTeams: true,
    canLiveScreen: true,
    canCustomFields: true,
    price: 7999
  }
};

const normalizePlanName = (planName = 'Free') => {
  if (!planName || typeof planName !== 'string') return 'Free';
  const trimmed = planName.trim();

  if (CANONICAL_PLAN_NAMES.includes(trimmed)) return trimmed;
  if (LEGACY_TO_CANONICAL_PLAN[trimmed]) return LEGACY_TO_CANONICAL_PLAN[trimmed];

  return 'Free';
};

// In-memory policy cache populated dynamically from MongoDB Plan collection
const policyCache = new Map();
let lastCacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 1 minute auto-refresh

const invalidatePlanCache = () => {
  policyCache.clear();
  lastCacheTimestamp = 0;
};

const getEffectivePlanPolicy = async (planNameOrUser) => {
  let planName = 'Free';
  if (planNameOrUser && typeof planNameOrUser === 'object') {
    // If genuine Super Admin (not impersonated), grant unlimited access
    if (planNameOrUser.role === 'SuperAdmin' && !planNameOrUser.isImpersonated) {
      return {
        teamLimit: -1,
        playerLimit: -1,
        canPublicRegistration: true,
        canViewTeams: true,
        canLiveScreen: true,
        canCustomFields: true,
        price: 0
      };
    }
    planName = resolveEffectivePlan(planNameOrUser);
  } else {
    planName = normalizePlanName(planNameOrUser);
  }

  const isCacheFresh = policyCache.size > 0 && (Date.now() - lastCacheTimestamp < CACHE_TTL_MS);
  if (!isCacheFresh || !policyCache.has(planName)) {
    try {
      const Plan = require('../models/Plan');
      const docs = await Plan.find({ name: { $in: CANONICAL_PLAN_NAMES } }).lean();
      for (const doc of docs) {
        const canonical = normalizePlanName(doc.name);
        const fallback = DEFAULT_PLAN_POLICIES[canonical] || DEFAULT_PLAN_POLICIES.Free;
        policyCache.set(canonical, {
          teamLimit: typeof doc.teamLimit === 'number' ? doc.teamLimit : fallback.teamLimit,
          playerLimit: typeof doc.playerLimit === 'number' ? doc.playerLimit : fallback.playerLimit,
          canPublicRegistration: typeof doc.canPublicRegistration === 'boolean' ? doc.canPublicRegistration : fallback.canPublicRegistration,
          canViewTeams: typeof doc.canViewTeams === 'boolean' ? doc.canViewTeams : fallback.canViewTeams,
          canLiveScreen: typeof doc.canLiveScreen === 'boolean' ? doc.canLiveScreen : fallback.canLiveScreen,
          canCustomFields: typeof doc.canCustomFields === 'boolean' ? doc.canCustomFields : fallback.canCustomFields,
          price: typeof doc.price === 'number' ? doc.price : fallback.price
        });
      }
      lastCacheTimestamp = Date.now();
    } catch (err) {
      // In case of DB disconnection, rely on defaults
    }
  }

  return policyCache.get(planName) || DEFAULT_PLAN_POLICIES[planName] || DEFAULT_PLAN_POLICIES.Free;
};

const getPolicyByPlanName = (planName = 'Free') => {
  const normalized = normalizePlanName(planName);
  return policyCache.get(normalized) || DEFAULT_PLAN_POLICIES[normalized] || DEFAULT_PLAN_POLICIES.Free;
};

const isSupportedPlanInput = (planName) => {
  if (!planName || typeof planName !== 'string') return false;
  const trimmed = planName.trim();
  return CANONICAL_PLAN_NAMES.includes(trimmed) || Boolean(LEGACY_TO_CANONICAL_PLAN[trimmed]);
};

const resolveEffectivePlan = (user) => {
  if (user?.role === 'SuperAdmin' && !user?.isImpersonated) return 'Pro';
  return normalizePlanName(user?.plan || 'Free');
};

module.exports = {
  CANONICAL_PLAN_NAMES,
  PLAN_POLICIES: DEFAULT_PLAN_POLICIES,
  DEFAULT_PLAN_POLICIES,
  normalizePlanName,
  isSupportedPlanInput,
  getPolicyByPlanName,
  getEffectivePlanPolicy,
  invalidatePlanCache,
  resolveEffectivePlan
};