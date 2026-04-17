const CANONICAL_PLAN_NAMES = ['Free', 'Basic', 'Pro'];

const LEGACY_TO_CANONICAL_PLAN = {
  'Free Plan': 'Free',
  'Basic Plan': 'Basic',
  Premium: 'Pro',
  'Premium Plan': 'Pro',
  'Pro Plan': 'Pro'
};

const PLAN_POLICIES = {
  Free: { teamLimit: 3, canPublicRegistration: false, canViewTeams: false },
  Basic: { teamLimit: 8, canPublicRegistration: false, canViewTeams: true },
  Pro: { teamLimit: -1, canPublicRegistration: true, canViewTeams: true }
};

const normalizePlanName = (planName = 'Free') => {
  if (!planName || typeof planName !== 'string') return 'Free';
  const trimmed = planName.trim();

  if (CANONICAL_PLAN_NAMES.includes(trimmed)) return trimmed;
  if (LEGACY_TO_CANONICAL_PLAN[trimmed]) return LEGACY_TO_CANONICAL_PLAN[trimmed];

  return 'Free';
};

const getPolicyByPlanName = (planName = 'Free') => PLAN_POLICIES[normalizePlanName(planName)];

const isSupportedPlanInput = (planName) => {
  if (typeof planName !== 'string') return false;
  const trimmed = planName.trim();
  return CANONICAL_PLAN_NAMES.includes(trimmed) || Boolean(LEGACY_TO_CANONICAL_PLAN[trimmed]);
};

const resolveEffectivePlan = (user) => {
  if (user?.role === 'SuperAdmin') return 'Pro';
  return normalizePlanName(user?.plan || 'Free');
};

module.exports = {
  CANONICAL_PLAN_NAMES,
  PLAN_POLICIES,
  normalizePlanName,
  isSupportedPlanInput,
  getPolicyByPlanName,
  resolveEffectivePlan
};