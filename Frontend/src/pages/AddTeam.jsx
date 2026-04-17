import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TournamentContext } from '../context/TournamentContext';

const PLAN_TEAM_LIMITS = { Free: 3, Basic: 8, Pro: -1 };
const normalizePlanName = (planName = 'Free') => {
  if (['Pro', 'Pro Plan'].includes(planName)) return 'Pro';
  if (['Basic', 'Basic Plan'].includes(planName)) return 'Basic';
  return 'Free';
};

const API_BASE_URL = 'https://cricket-auction-backend-h8ud.onrender.com/api';

function AddTeam() {
  const navigate = useNavigate();
  // 🌟 FIX: Tournament data se auto budget uthane ke liye context use kiya
  const { tournament } = useContext(TournamentContext);

  const [teams, setTeams] = useState([]);
  const [organizerPlan, setOrganizerPlan] = useState('Free');
  const [organizerRole, setOrganizerRole] = useState('Organizer');

  const [isEditing, setIsEditing] = useState(false);
  const [editTeamId, setEditTeamId] = useState(null);

  const [teamName, setTeamName] = useState('');
  const [budget, setBudget] = useState(50000000); // Default
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setOrganizerPlan(localStorage.getItem('organizerPlan') || 'Free');
    setOrganizerRole(localStorage.getItem('organizerRole') || 'Organizer');
    fetchTeams();
  }, []);

  // 🌟 FIX: Automatically set budget from tournament settings
  useEffect(() => {
     if(tournament && tournament.teamBudget) {
         setBudget(tournament.teamBudget);
     }
  }, [tournament]);

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/teams`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeams(response.data);
    } catch (error) { console.error("Teams fetch error:", error); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const data = new FormData();
    data.append("file", file); data.append("upload_preset", "auction_preset"); data.append("cloud_name", "dpg5olqt7");
    try {
      const res = await axios.post(`https://api.cloudinary.com/v1_1/dpg5olqt7/image/upload`, data);
      setLogoUrl(res.data.secure_url);
    } catch (err) { alert("❌ फोटो अपलोड फेल!"); } 
    finally { setIsUploading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(isUploading) { alert('फोटो अपलोड हो रही है...'); return; }
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const payload = { teamName, totalPurse: Number(budget), ownerName, mobile, logoUrl };

      if (isEditing) {
        await axios.put(`${API_BASE_URL}/teams/${editTeamId}`, payload, { headers });
        alert('Team updated successfully! 🎉');
      } else {
        await axios.post(`${API_BASE_URL}/teams`, payload, { headers });
        alert('Team added successfully! 🎉');
      }
      
      resetForm();
      fetchTeams();
    } catch (error) { alert(error.response?.data?.message || 'Error saving team!'); }
  };

  const handleEditClick = (team) => {
    setIsEditing(true);
    setEditTeamId(team._id);
    setTeamName(team.teamName);
    setBudget(team.totalPurse);
    setOwnerName(team.ownerName || '');
    setMobile(team.mobile || '');
    setLogoUrl(team.logoUrl || team.logo || '');
    window.scrollTo(0, 0);
  };

  const handleDeleteTeam = async (team) => {
    const confirmDelete = window.confirm(`क्या आप '${team.teamName}' टीम को डिलीट करना चाहते हैं?`);
    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/teams/${team._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (isEditing && editTeamId === team._id) {
        resetForm();
      }
      fetchTeams();
      alert('Team deleted successfully! 🗑️');
    } catch (error) {
      alert(error.response?.data?.message || 'Team delete failed!');
    }
  };

  const resetForm = () => {
    setIsEditing(false); setEditTeamId(null); setTeamName(''); setOwnerName(''); setMobile(''); setLogoUrl('');
    // 🌟 Reset ke waqt bhi default budget tournament se set ho
    if(tournament && tournament.teamBudget) setBudget(tournament.teamBudget);
    else setBudget(50000000);
  };

  const normalizedPlan = organizerRole === 'SuperAdmin' ? 'Pro' : normalizePlanName(organizerPlan);
  const teamLimit = PLAN_TEAM_LIMITS[normalizedPlan];
  const isLimitReached = teamLimit !== -1 && teams.length >= teamLimit;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <button onClick={() => navigate('/dashboard')} className="text-blue-600 font-bold hover:underline">← Back to Dashboard</button>

        <div className="bg-white p-8 rounded-xl shadow-xl border-t-8 border-blue-600">
          <h2 className="text-2xl md:text-3xl font-black text-gray-800 mb-2">
            {isEditing ? '🛠️ Edit Team' : '➕ Create New Team'}
          </h2>
          <div className="flex justify-between items-center mb-6">
            <p className="text-gray-500 font-bold">Add details for the franchise.</p>
            <div className={`px-4 py-1 rounded-full font-bold text-sm ${isLimitReached ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              {teamLimit === -1 ? 'Unlimited Teams' : `Teams Added: ${teams.length} / ${teamLimit}`}
            </div>
          </div>

          {!isEditing && isLimitReached && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r">
              <p className="text-red-700 font-bold">⚠️ Team Limit Reached. Upgrade your plan to add more teams.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1">Team Name *</label>
                 <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} required disabled={!isEditing && isLimitReached} className="w-full p-4 border-2 border-gray-200 rounded-xl bg-gray-50 font-bold focus:border-blue-500 outline-none" />
              </div>
              
              {/* 🌟 FIX: Budget apne aap set hoga aur User use manually change bhi nahi karega ya auto-fill rakhega */}
              <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1">Points Balance (Purse)</label>
                 <input type="number" value={budget} disabled className="w-full p-4 border-2 border-gray-200 rounded-xl bg-gray-200 font-black text-blue-800 cursor-not-allowed" />
                 <p className="text-xs text-blue-600 mt-1 font-bold">यह बजट टूर्नामेंट सेटिंग्स से अपने आप आ रहा है।</p>
              </div>

              <div><label className="block text-sm font-bold text-gray-700 mb-1">Owner Name</label><input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} disabled={!isEditing && isLimitReached} className="w-full p-4 border-2 border-gray-200 rounded-xl bg-gray-50 font-bold outline-none" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1">Owner Mobile</label><input type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} disabled={!isEditing && isLimitReached} className="w-full p-4 border-2 border-gray-200 rounded-xl bg-gray-50 font-bold outline-none" /></div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Team Logo</label>
              <div className="flex items-center space-x-4 mt-2">
                {logoUrl ? <img src={logoUrl} alt="Logo" className="w-20 h-20 object-contain bg-gray-50 border rounded-lg" /> : <div className="w-20 h-20 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400">No Logo</div>}
                <label className={`cursor-pointer px-4 py-2 bg-white border border-gray-300 rounded-lg font-bold text-sm hover:bg-gray-50 shadow-sm ${(!isEditing && isLimitReached) || isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {isUploading ? 'Uploading...' : 'Upload Image'}
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={(!isEditing && isLimitReached) || isUploading} />
                </label>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              {isEditing && <button type="button" onClick={resetForm} className="flex-1 bg-gray-200 text-gray-800 font-bold py-4 rounded-xl hover:bg-gray-300 transition">Cancel Edit</button>}
              <button type="submit" disabled={!isEditing && isLimitReached} className={`flex-1 font-black py-4 rounded-xl text-lg text-white shadow-xl transition-all ${(!isEditing && isLimitReached) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
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
                <div className="flex gap-2">
                  <button onClick={() => handleEditClick(team)} className="bg-blue-100 text-blue-700 p-2 rounded-lg font-bold hover:bg-blue-200">Edit</button>
                  <button onClick={() => handleDeleteTeam(team)} className="bg-red-100 text-red-700 p-2 rounded-lg font-bold hover:bg-red-200">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddTeam;