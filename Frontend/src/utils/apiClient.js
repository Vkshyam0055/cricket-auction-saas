import axios from 'axios';

const SESSION_EXPIRED_EVENT = 'session-expired';

export const isImpersonating = () => {
  return Boolean(localStorage.getItem('adminToken') || localStorage.getItem('superAdminSession'));
};

export const clearAllAuthSessions = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('organizerName');
  localStorage.removeItem('organizerPhone');
  localStorage.removeItem('organizerPlan');
  localStorage.removeItem('organizerRole');
  localStorage.removeItem('organizerEmail');
  localStorage.removeItem('superAdminSession');
  localStorage.removeItem('adminToken');
  localStorage.removeItem('impersonatingUser');
  localStorage.removeItem('impersonatedUserId');
  localStorage.removeItem('impersonationSessionId');
  localStorage.removeItem('impersonatingRole');
  localStorage.removeItem('impersonatingPlan');
};

export const restoreSuperAdminSession = () => {
  try {
    const rawSession = localStorage.getItem('superAdminSession');
    const adminSession = rawSession ? JSON.parse(rawSession) : null;
    const adminToken = adminSession?.token || localStorage.getItem('adminToken');

    if (adminToken) {
      localStorage.setItem('token', adminToken);
      if (adminSession?.organizerName) localStorage.setItem('organizerName', adminSession.organizerName);
      if (adminSession?.organizerPhone) localStorage.setItem('organizerPhone', adminSession.organizerPhone);
      if (adminSession?.organizerPlan) localStorage.setItem('organizerPlan', adminSession.organizerPlan);
      if (adminSession?.organizerRole) localStorage.setItem('organizerRole', adminSession.organizerRole);
      if (adminSession?.organizerEmail) localStorage.setItem('organizerEmail', adminSession.organizerEmail);
    } else {
      localStorage.removeItem('token');
    }
  } catch (e) {
    console.error('Failed to parse superAdminSession:', e);
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      localStorage.setItem('token', adminToken);
    } else {
      localStorage.removeItem('token');
    }
  } finally {
    localStorage.removeItem('superAdminSession');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('impersonatingUser');
    localStorage.removeItem('impersonatedUserId');
    localStorage.removeItem('impersonationSessionId');
    localStorage.removeItem('impersonatingRole');
    localStorage.removeItem('impersonatingPlan');
  }
};

export const clearAuthSession = () => {
  const adminToken = localStorage.getItem('adminToken');
  if (adminToken && !isTokenExpired(adminToken)) {
    restoreSuperAdminSession();
    window.location.href = '/super-admin';
    return;
  }
  clearAllAuthSessions();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
};

export const onSessionExpired = (callback) => {
  window.addEventListener(SESSION_EXPIRED_EVENT, callback);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, callback);
};

export const isTokenExpired = (token) => {
  try {
    if (!token) return true;
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return true;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    const payload = JSON.parse(atob(padded));
    const exp = Number(payload?.exp || 0);
    if (!exp) return true;
    return (Date.now() >= exp * 1000);
  } catch {
    return true;
  }
};

export const getApiBaseCandidates = () => {
  if (import.meta.env.DEV) {
    // In local dev, strictly prevent accidental requests to production Render backend
    const devCandidates = [
      DEFAULT_DEV_API_BASE,
      isLocalhostUrl(import.meta.env.VITE_API_URL) ? normalizeBaseUrl(import.meta.env.VITE_API_URL) : '',
      getSafeStoredBaseUrl()
    ];
    return Array.from(new Set(devCandidates.filter(Boolean).map(normalizeBaseUrl)));
  }

  // In production, strictly prevent accidental requests to localhost
  const explicitViteUrl = !isLocalhostUrl(import.meta.env.VITE_API_URL) ? normalizeBaseUrl(import.meta.env.VITE_API_URL) : '';
  const prodCandidates = [
    getSafeStoredBaseUrl(),
    explicitViteUrl,
    DEFAULT_PROD_API_BASE
  ].filter((url) => Boolean(url) && !isLocalhostUrl(url));

  return Array.from(new Set(prodCandidates.map(normalizeBaseUrl)));
};

const buildApiUrl = (baseUrl, path) => {
  const normalizedBase = String(baseUrl || '').replace(/\/$/, '');
  const normalizedPath = String(path || '').trim();
  const requestPath = normalizedBase.endsWith('/api') && normalizedPath.startsWith('/api/')
    ? normalizedPath.replace(/^\/api/, '')
    : normalizedPath;
  return `${normalizedBase}${requestPath}`;
};

export const apiRequest = async ({ method = 'get', path, data, params, headers = {} }) => {
  let lastError = null;
  const candidates = getApiBaseCandidates();
  for (let i = 0; i < candidates.length; i++) {
    const baseUrl = candidates[i];
    const requestUrl = buildApiUrl(baseUrl, path);
    try {
      const response = await axios({ method, url: requestUrl, data, params, headers });
      localStorage.setItem('apiBaseUrl', String(baseUrl).replace(/\/$/, ''));
      return response;
    } catch (error) {
      lastError = error;
      // If it's a 401 and we've exhausted all candidates, clear session.
      // But don't clear it immediately, since a token might be valid locally but invalid on PROD.
      if (error?.response?.status === 401 && i === candidates.length - 1) {
        clearAuthSession();
      }      
    }
  }
  throw lastError || new Error('No API base URL reachable');
};

export const getSocketBaseUrl = () => {
  const firstBase = getApiBaseCandidates()[0] || (import.meta.env.DEV ? DEFAULT_DEV_API_BASE : DEFAULT_PROD_API_BASE);
  return String(firstBase).replace(/\/api$/, '');
};
const DEFAULT_PROD_API_BASE = 'https://cricket-auction-backend-h8ud.onrender.com';
const DEFAULT_DEV_API_BASE = 'http://localhost:5000';

const normalizeBaseUrl = (url) => String(url || '').trim().replace(/\/$/, '');
const isLocalhostUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizeBaseUrl(url));

const getSafeStoredBaseUrl = () => {
  const stored = normalizeBaseUrl(localStorage.getItem('apiBaseUrl'));
  if (!stored) return '';

  // In production, strictly purge any localhost URL
  if (import.meta.env.PROD && isLocalhostUrl(stored)) {
    localStorage.removeItem('apiBaseUrl');
    return '';
  }

  // In development, strictly purge any remote production URL
  if (import.meta.env.DEV && !isLocalhostUrl(stored)) {
    localStorage.removeItem('apiBaseUrl');
    return '';
  }

  return stored;
};
