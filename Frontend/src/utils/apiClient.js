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

export const getApiBaseCandidates = () => Array.from(new Set([
  localStorage.getItem('apiBaseUrl'),
  import.meta.env.VITE_API_URL,
  'https://cricket-auction-backend-h8ud.onrender.com',
  'http://localhost:5000'
].filter(Boolean).map((url) => String(url).replace(/\/$/, ''))));

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
  for (const baseUrl of getApiBaseCandidates()) {
    const requestUrl = buildApiUrl(baseUrl, path);
    try {
      const response = await axios({ method, url: requestUrl, data, params, headers });
      localStorage.setItem('apiBaseUrl', String(baseUrl).replace(/\/$/, ''));
      return response;
    } catch (error) {
      if (error?.response?.status === 401) {
        clearAuthSession();
      }      
      lastError = error;
    }
  }
  throw lastError || new Error('No API base URL reachable');
};

export const getSocketBaseUrl = () => {
  const firstBase = getApiBaseCandidates()[0] || 'https://cricket-auction-backend-h8ud.onrender.com';
  return String(firstBase).replace(/\/api$/, '');
};