import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function AddTeam() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editTeamId, setEditTeamId] = useState(null);
  
  const [teamName, setTeamName] = useState('');
  const [budget, setBudget] = useState(50000000);
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('https://cricket-auction-backend-h8ud.onrender.com/api/teams', { 
          headers: { Authorization: `Bearer ${token}` } 
      });
      setTeams(response.data);
    } catch (error) { console.error(error); }
  };

  const handleSaveTeam = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
        teamName,
        totalPurse: Number(budget),
        remainingPurse: Number(budget), 
        ownerName,
        mobile,
        logoUrl
      };

      if (isEditing) {
        await axios.put(`https://cricket-auction-backend-h8ud.onrender.com/api/teams/${editTeamId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert(`✅ '${teamName}' टीम की जानकारी अपडेट हो गई!`);
      } else {
        await axios.post('https://cricket-auction-backend-h8ud.onrender.com/api/teams', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert(`🎉 '${teamName}' नई टीम सेव हो गई!`);
      }

      resetForm();
      fetchTeams();
      
    } catch (error) {
      alert('एरर: ' + (error.response?.data?.message || 'टीम सेव/अपडेट नहीं हो पाई। शायद बैकएंड में API नहीं है!'));
    }
  };

  const handleEditClick = (team) => {
    setIsEditing(true);
    setEditTeamId(team._id);
    setTeamName(team.teamName);
    setBudget(team.remainingPurse); 
    setOwnerName(team.ownerName || '');
    setMobile(team.mobile || '');
    setLogoUrl(team.logoUrl || '');
    window.scrollTo(0, 0); 
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditTeamId(null);
    setTeamName('');
    setBudget(50000000);
    setOwnerName('');
    setMobile('');
    setLogoUrl('');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="bg-white p-8 rounded-xl shadow-2xl border-t-8 border-blue-600">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-black text-gray-800">{isEditing ? '✏️ Edit Team Details' : '🆕 Create New Team'}</h2>
            <button onClick={() => navigate('/dashboard')} className="bg-gray-800 text-white px-4 py-2 rounded font-bold hover:bg-gray-700 transition">⬅ Back to Dashboard</button>
          </div>

          <form onSubmit={handleSaveTeam} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 font-bold mb-1">Team Name *</label>
              {/* 🌟 यहाँ से disabled हटा दिया गया है, अब आप नाम बदल सकते हैं 🌟 */}
              <input type="text" required className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-blue-500 font-bold bg-gray-50" placeholder="e.g. The Avengers" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            </div>
            
            <div>
              <label className="block text-gray-700 font-bold mb-1">Total Purse / Budget (₹) *</label>
              <input type="number" required className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-blue-500 font-black text-green-700 bg-gray-50" value={budget} onChange={(e) => setBudget(e.target.value)} />
              {isEditing && <p className="text-xs text-red-500 mt-1">यहाँ से आप पर्स को मैन्युअली सही कर सकते हैं।</p>}
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">Owner Name</label>
              <input type="text" className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-blue-500" placeholder="e.g. Sonu Chaudhary" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">Mobile Number</label>
              <input type="text" className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-blue-500" placeholder="e.g. 9876543210" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-700 font-bold mb-1">Team Logo (URL)</label>
              <input type="text" className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-blue-500" placeholder="https://example.com/logo.png" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            </div>

            <div className="md:col-span-2 flex gap-4 mt-2">
              {isEditing && <button type="button" onClick={resetForm} className="flex-1 bg-gray-300 text-gray-800 font-bold py-3 rounded-lg hover:bg-gray-400 transition text-lg">Cancel</button>}
              <button type="submit" className="flex-1 bg-blue-600 text-white font-black py-3 rounded-lg hover:bg-blue-700 transition shadow-lg text-lg">
                {isEditing ? 'Update Team 🛠️' : 'Save New Team 🏏'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-xl border-t-8 border-green-500">
          <h2 className="text-2xl font-black text-gray-800 mb-6">📋 Manage Existing Teams</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <div key={team._id} className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 transition bg-gray-50 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-xl text-gray-800">{team.teamName}</h3>
                  <p className="font-bold text-green-600 text-sm">Purse: ₹{team.remainingPurse?.toLocaleString()}</p>
                </div>
                <button onClick={() => handleEditClick(team)} className="bg-blue-100 text-blue-700 p-2 rounded-lg font-bold hover:bg-blue-600 hover:text-white transition shadow-sm">
                  ✏️ Edit
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default AddTeam;