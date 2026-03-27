import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

// 1. कांटेक्स्ट (ग्लोबल डब्बा) बनाओ
export const TournamentContext = createContext();

// 2. प्रोवाइडर (सप्लायर) बनाओ
export const TournamentProvider = ({ children }) => {
    const [tournament, setTournament] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchTournament = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/tournament');
            // अगर गोडाउन में डेटा है, तो डब्बे में डाल दो, नहीं तो null रहने दो
            setTournament(res.data ? res.data : null); 
        } catch (error) {
            console.error("टूर्नामेंट डेटा लाने में एरर:", error);
            setTournament(null);
        } finally {
            setLoading(false);
        }
    };

    // ऐप खुलते ही सबसे पहले टूर्नामेंट की जानकारी लाओ
    useEffect(() => {
        fetchTournament();
    }, []);

    return (
        <TournamentContext.Provider value={{ tournament, setTournament, fetchTournament, loading }}>
            {children}
        </TournamentContext.Provider>
    );
};