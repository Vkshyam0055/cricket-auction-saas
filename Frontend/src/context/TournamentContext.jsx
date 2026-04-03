import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

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
      
      const response = await axios.get('https://cricket-auction-backend-h8ud.onrender.com/api/tournament', { headers });
      
      setTournament(response.data || null);
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