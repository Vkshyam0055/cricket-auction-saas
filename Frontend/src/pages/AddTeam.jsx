import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function AddTeam() {
  const [teamName, setTeamName] = useState('');
  const [budget, setBudget] = useState(50000000); // 5 करोड़
  const navigate = useNavigate();

  const handleSaveTeam = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');

      // यहाँ हम बैकएंड को गोडाउन की भाषा (teamName और totalPurse) में डेटा भेज रहे हैं
      await axios.post('http://localhost:5000/api/teams', 
        {
          teamName: teamName,
          totalPurse: Number(budget) // इसे नंबर बनाकर भेज रहे हैं
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      alert(`बधाई हो! 🎉 '${teamName}' टीम सेव हो गई है!`);
      navigate('/dashboard'); 
      
    } catch (error) {
      alert('एरर: ' + (error.response?.data?.message || 'कोई तकनीकी खराबी आ गई है!'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-2xl border-t-4 border-blue-600">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Create New Team</h2>
          <button 
            onClick={() => navigate('/dashboard')}
            className="bg-gray-300 px-4 py-2 rounded font-bold hover:bg-gray-400 transition"
          >
            ⬅ Back
          </button>
        </div>

        <form onSubmit={handleSaveTeam} className="space-y-5">
          <div>
            <label className="block text-gray-700 font-bold mb-1">Team Name</label>
            <input 
              type="text" 
              required
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. The Avengers"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-gray-700 font-bold mb-1">Total Purse / Budget (₹)</label>
            <input 
              type="number" 
              required
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-lg text-lg"
          >
            Save Team 🏏
          </button>
        </form>

      </div>
    </div>
  );
}

export default AddTeam;