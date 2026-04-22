import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export const TournamentContext = createContext();

const API_BASE_CANDIDATES = () => Array.from(new Set([
  import.meta.env.VITE_API_URL,
  'https://cricket-auction-backend-h8ud.onrender.com',
  'http://localhost:5000'
].filter(Boolean).map((url) => String(url).replace(/\/$/, ''))));

const buildRequestUrl = (baseUrl, path) => {
  const normalizedBase = String(baseUrl || '').replace(/\/$/, '');
  const normalizedPath = String(path || '').trim();
  const requestPath = normalizedBase.endsWith('/api') && normalizedPath.startsWith('/api/')
    ? normalizedPath.replace(/^\/api/, '')
    : normalizedPath;
  return `${normalizedBase}${requestPath}`;
};

export const TournamentProvider = ({ children }) => {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🌟 FIX: useCallback जोड़ा गया ताकि इसे Auth.jsx से सुरक्षित रूप से कॉल किया जा सके 🌟
  const fetchTournament = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setTournament(null);
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      let resolvedTournament = null;
      let fetched = false;
      let lastError = null;

      for (const baseUrl of API_BASE_CANDIDATES()) {
        const requestUrl = buildRequestUrl(baseUrl, '/api/tournament');
        try {
          const response = await axios.get(requestUrl, { headers });
          localStorage.setItem('apiBaseUrl', String(baseUrl).replace(/\/$/, ''));
          resolvedTournament = response.data || null;
          fetched = true;
          break;
        } catch (error) {
          lastError = error;
          const status = error?.response?.status;
          if (status === 404) {
            resolvedTournament = null;
            fetched = true;
            break;
          }
        }
      }

      if (!fetched && lastError) throw lastError;
      setTournament(resolvedTournament);
    } catch (error) {
      console.error("Error fetching tournament:", error);
      setTournament(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTournament();
  }, [fetchTournament]);

  return (
    <TournamentContext.Provider value={{ tournament, loading, fetchTournament, setTournament }}>
      {children}
    </TournamentContext.Provider>
  );
};