import React, { createContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../utils/apiClient';

export const TournamentContext = createContext();

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

      try {
        const response = await apiRequest({ path: '/api/tournament', headers });
        resolvedTournament = response.data || null;
      } catch (error) {
        if (error?.response?.status === 404) {
          resolvedTournament = null;
        } else {
          throw error;
        }
      }

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