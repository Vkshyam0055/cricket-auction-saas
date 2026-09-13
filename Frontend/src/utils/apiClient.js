import axios from 'axios';

const SESSION_EXPIRED_EVENT = 'session-expired';

export const clearAuthSession = () => {
  localStorage.removeItem('token');
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
    const payload = JSON.parse(atob(payloadPart));
    const exp = Number(payload?.exp || 0);
    if (!exp) return true;
    return (Date.now() >= exp * 1000);
  } catch (error) {
    return true;
  }
};

export const getApiBaseCandidates = () => {
  const candidates = [
    getSafeStoredBaseUrl(),
    normalizeBaseUrl(import.meta.env.VITE_API_URL)
  ];

  if (import.meta.env.DEV) {
    // In dev, prefer localhost over prod
    candidates.push(DEFAULT_DEV_API_BASE);
    candidates.push(DEFAULT_PROD_API_BASE);
  } else {
    // In prod, just use prod
    candidates.push(DEFAULT_PROD_API_BASE);
  }

  return Array.from(new Set(candidates.filter(Boolean).map(normalizeBaseUrl)));
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
  const firstBase = getApiBaseCandidates()[0] || DEFAULT_PROD_API_BASE;
  return String(firstBase).replace(/\/api$/, '');
};
const DEFAULT_PROD_API_BASE = 'https://cricket-auction-backend-h8ud.onrender.com';
const DEFAULT_DEV_API_BASE = 'http://localhost:5000';

const normalizeBaseUrl = (url) => String(url || '').trim().replace(/\/$/, '');
const isLocalhostUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizeBaseUrl(url));

const getSafeStoredBaseUrl = () => {
  const stored = normalizeBaseUrl(localStorage.getItem('apiBaseUrl'));
  if (!stored) return '';

  if (import.meta.env.PROD && isLocalhostUrl(stored)) {
    localStorage.removeItem('apiBaseUrl');
    return '';
  }
  return stored;
};
