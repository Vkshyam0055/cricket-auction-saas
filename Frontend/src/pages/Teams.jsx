import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Teams() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]); // खिलाड़ियों को रखने का डिब्बा

  // गोडाउन से टीमें और खिलाड़ी दोनों एक साथ लाओ
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        // टीमें लाओ
        const teamsRes = await axios.get('http://localhost:5000/api/teams', { headers });
        setTeams(teamsRes.data);

        // खिलाड़ी लाओ
        const playersRes = await axios.get('http://localhost:5000/api/players', { headers });
        setPlayers(playersRes.data);

      } catch (error) {
        console.error("डेटा लाने में दिक्कत:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* हेडर */}
        <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-800">
          <h2 className="text-3xl font-black text-gray-800">🏆 Teams, Budgets & Squads</h2>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-gray-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-700 transition shadow-lg"
          >
            ⬅ Back to Dashboard
          </button>
        </div>

        {/* टीमों के कार्ड्स का ग्रिड */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {teams.map((team) => {
            
            // इस टीम ने जो खिलाड़ी खरीदे हैं, उन्हें फिल्टर करो
            const teamSquad = players.filter(player => player.soldTo === team.teamName);

            return (
              <div key={team._id} className="bg-white rounded-2xl shadow-xl border-t-8 border-blue-600 overflow-hidden hover:shadow-2xl transition-all">
                
                {/* टीम का नाम और बजट */}
                <div className="p-6 bg-gray-50 border-b-2 border-gray-200">
                  <h3 className="text-3xl font-black text-gray-800 mb-4">{team.teamName}</h3>
                  <div className="space-y-2">
                    <p className="flex justify-between text-gray-500 font-bold">
                      <span>Total Purse:</span>
                      <span className="text-gray-800">₹ {team.totalPurse.toLocaleString()}</span>
                    </p>
                    <p className="flex justify-between text-lg font-black mt-2 pt-2 border-t border-gray-300">
                      <span className="text-red-500">Remaining:</span>
                      <span className="text-green-600">₹ {team.remainingPurse.toLocaleString()}</span>
                    </p>
                  </div>
                </div>

                {/* खिलाड़ियों की लिस्ट (Squad) */}
                <div className="p-6 bg-white">
                  <h4 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2 flex justify-between">
                    <span>Squad Members</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{teamSquad.length} Players</span>
                  </h4>
                  
                  {teamSquad.length === 0 ? (
                    <p className="text-gray-400 italic text-center py-4">No players bought yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {teamSquad.map((player) => (
                        <li key={player._id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <div>
                            <p className="font-bold text-gray-800 capitalize">{player.name}</p>
                            <p className="text-xs text-gray-500 font-bold uppercase">{player.role}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600 text-sm">₹ {player.soldPrice.toLocaleString()}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

export default Teams;