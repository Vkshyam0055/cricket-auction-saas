import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const TournamentContext = createContext();

export const TournamentProvider = ({ children }) => {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTournament = async () => {
    try {
      // 🌟 FIX: ग्लोबल डब्बे को भी डिजिटल चाबी (टोकन) दे दी 🌟
      const token = localStorage.getItem('token');
      
      if (!token) {
        setTournament(null);
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      
      // 🌟 अब यह चाबी के साथ बैकएंड से सिर्फ लॉगिन वाले यूज़र का टूर्नामेंट लाएगा
      const response = await axios.get('https://cricket-auction-backend-h8ud.onrender.com/api/tournament', { headers });
      
      setTournament(response.data);
    } catch (error) {
      console.error("Error fetching tournament:", error);
      setTournament(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournament();
  }, []);

  return (
    <TournamentContext.Provider value={{ tournament, loading, fetchTournament }}>
      {children}
    </TournamentContext.Provider>
  );
};