import { apiRequest } from './apiClient';

export const DEFAULT_PLAN_POLICIES = {
  Free: {
    name: 'Free',
    teamLimit: 3,
    playerLimit: 50,
    canViewTeams: false,
    canPublicRegistration: false,
    canLiveScreen: true,
    canCustomFields: false,
  },
  Basic: {
    name: 'Basic',
    teamLimit: 8,
    playerLimit: 150,
    canViewTeams: true,
    canPublicRegistration: false,
    canLiveScreen: true,
    canCustomFields: false,
  },
  Pro: {
    name: 'Pro',
    teamLimit: -1,
    playerLimit: -1,
    canViewTeams: true,
    canPublicRegistration: true,
    canLiveScreen: true,
    canCustomFields: true,
  }
};

export const normalizePlanName = (planName = 'Free') => {
  const clean = String(planName || '').trim().toLowerCase();
  if (clean.includes('pro')) return 'Pro';
  if (clean.includes('basic')) return 'Basic';
  return 'Free';
};

export const getCachedPlans = () => {
  try {
    const cached = localStorage.getItem('cricauction_plans_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore json parse issues
  }
  return null;
};

export const fetchAndCachePlans = async () => {
  try {
    const res = await apiRequest({ method: 'get', path: '/api/plans' });
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      localStorage.setItem('cricauction_plans_cache', JSON.stringify(res.data));
      return res.data;
    }
  } catch (err) {
    console.warn('Failed to fetch live plans, falling back to cache/defaults:', err);
  }
  return getCachedPlans();
};

export const getEffectivePlanPolicy = (planName = 'Free', role = 'Organizer') => {
  if (role === 'SuperAdmin') {
    return {
      name: 'SuperAdmin',
      teamLimit: -1,
      playerLimit: -1,
      canViewTeams: true,
      canPublicRegistration: true,
      canLiveScreen: true,
      canCustomFields: true,
    };
  }

  const normalized = normalizePlanName(planName);
  const cachedPlans = getCachedPlans();

  if (cachedPlans) {
    const found = cachedPlans.find((p) => normalizePlanName(p.name) === normalized);
    if (found) {
      const fallback = DEFAULT_PLAN_POLICIES[normalized] || DEFAULT_PLAN_POLICIES.Free;
      return {
        name: found.name || normalized,
        teamLimit: typeof found.teamLimit === 'number' ? found.teamLimit : fallback.teamLimit,
        playerLimit: typeof found.playerLimit === 'number' ? found.playerLimit : fallback.playerLimit,
        canViewTeams: found.canViewTeams !== undefined ? Boolean(found.canViewTeams) : fallback.canViewTeams,
        canPublicRegistration: found.canPublicRegistration !== undefined ? Boolean(found.canPublicRegistration) : fallback.canPublicRegistration,
        canLiveScreen: found.canLiveScreen !== undefined ? Boolean(found.canLiveScreen) : fallback.canLiveScreen,
        canCustomFields: found.canCustomFields !== undefined ? Boolean(found.canCustomFields) : fallback.canCustomFields,
      };
    }
  }

  return DEFAULT_PLAN_POLICIES[normalized] || DEFAULT_PLAN_POLICIES.Free;
};
