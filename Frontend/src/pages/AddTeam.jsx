import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const PLAN_TEAM_LIMITS = {
  Free: 3,
  Basic: 8,
  Pro: -1
};

const normalizePlanName = (planName = 'Free') => {
  if (planName === 'Free Plan') return 'Free';
  if (planName === 'Basic Plan') return 'Basic';
  if (planName === 'Pro Plan') return 'Pro';
  if (planName === 'Premium') return 'Pro';
  if (planName === 'Premium Plan') return 'Pro';
  return Object.prototype.hasOwnProperty.call(PLAN_TEAM_LIMITS, planName) ? planName : 'Free';
};

const API_BASE_URL = 'https://cricket-auction-backend-h8ud.onrender.com/api';

function AddTeam() {
  const navigate = useNavigate();

  const [teams, setTeams] = useState([]);
  const [organizerPlan, setOrganizerPlan] = useState('Free');
  const [organizerRole, setOrganizerRole] = useState('Organizer');

  const [isEditing, setIsEditing] = useState(false);
  const [editTeamId, setEditTeamId] = useState(null);

  const [teamName, setTeamName] = useState('');
  const [budget, setBudget] = useState(50000000);
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    const storedPlan = localStorage.getItem('organizerPlan');
    const storedRole = localStorage.getItem('organizerRole');

    if (storedPlan) setOrganizerPlan(normalizePlanName(storedPlan));
    if (storedRole) setOrganizerRole(storedRole);
  }, []);

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get(`${API_BASE_URL}/teams`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTeams(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('टीम्स लोड एरर:', error);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const effectivePlan = organizerRole === 'SuperAdmin' ? 'Pro' : organizerPlan;
  const teamLimit = PLAN_TEAM_LIMITS[effectivePlan] ?? PLAN_TEAM_LIMITS.Free;
  const isLimitReached = useMemo(() => teamLimit !== -1 && teams.length >= teamLimit, [teams.length, teamLimit]);

  const resetForm = () => {
    setIsEditing(false);
    setEditTeamId(null);
    setTeamName('');
    setBudget(50000000);
    setOwnerName('');
    setMobile('');
    setLogoUrl('');
  };

  const handleEditClick = (team) => {
    setIsEditing(true);
    setEditTeamId(team._id);
    setTeamName(team.teamName || '');
    setBudget(team.remainingPurse || 0);
    setOwnerName(team.ownerName || '');
    setMobile(team.mobile || '');
    setLogoUrl(team.logoUrl || '');
    window.scrollTo(0, 0);
  };

  const handleSaveTeam = async (event) => {
    event.preventDefault();

    if (!isEditing && isLimitReached) {
      alert(`🔒 ${effectivePlan} प्लान में अधिकतम ${teamLimit} टीमें ही बनाई जा सकती हैं।`);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('कृपया लॉगिन करें।');
        return;
      }

      const payload = {
        teamName,
        totalPurse: Number(budget),
        remainingPurse: Number(budget),
        ownerName,
        mobile,
        logoUrl
      };

      const headers = { Authorization: `Bearer ${token}` };

      if (isEditing) {
        await axios.put(`${API_BASE_URL}/teams/${editTeamId}`, payload, { headers });
        alert(`✅ '${teamName}' टीम की जानकारी अपडेट हो गई!`);
      } else {
        await axios.post(`${API_BASE_URL}/teams`, payload, { headers });
        alert(`🎉 '${teamName}' नई टीम सेव हो गई!`);
      }

      resetForm();
      await fetchTeams();
    } catch (error) {
      alert(`एरर: ${error.response?.data?.message || 'टीम सेव/अपडेट नहीं हो पाई।'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white p-8 rounded-xl shadow-2xl border-t-8 border-blue-600">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-2">
            <h2 className="text-3xl font-black text-gray-800">{isEditing ? '✏️ Edit Team Details' : '🆕 Create New Team'}</h2>
            <button onClick={() => navigate('/dashboard')} className="bg-gray-800 text-white px-4 py-2 rounded font-bold hover:bg-gray-700 transition">
              ⬅ Back to Dashboard
            </button>
          </div>

          <p className="mb-4 text-sm font-bold text-gray-600">
            Current Plan: <span className="text-blue-700">{effectivePlan}</span> | Team Limit:{' '}
            <span className="text-blue-700">{teamLimit === -1 ? 'Unlimited' : teamLimit}</span> | Created:{' '}
            <span className="text-blue-700">{teams.length}</span>
          </p>

          {!isEditing && isLimitReached && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 font-bold">
              🔒 आपने अपने प्लान की टीम लिमिट पूरी कर ली है। नई टीम बनाने के लिए प्लान अपग्रेड करें।
            </div>
          )}

          <form onSubmit={handleSaveTeam} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 font-bold mb-1">Team Name *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-blue-500 font-bold bg-gray-50"
                placeholder="e.g. The Avengers"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                disabled={!isEditing && isLimitReached}
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">Total Purse / Budget (₹) *</label>
              <input
                type="number"
                required
                className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-blue-500 font-black text-green-700 bg-gray-50"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                disabled={!isEditing && isLimitReached}
              />
              {isEditing && <p className="text-xs text-red-500 mt-1">यहाँ से आप पर्स को मैन्युअली सही कर सकते हैं।</p>}
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">Owner Name</label>
              <input
                type="text"
                className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="e.g. Sonu Chaudhary"
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
                disabled={!isEditing && isLimitReached}
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">Mobile Number</label>
              <input
                type="text"
                className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="e.g. 9876543210"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                disabled={!isEditing && isLimitReached}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-700 font-bold mb-1">Team Logo (URL)</label>
              <input
                type="text"
                className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                disabled={!isEditing && isLimitReached}
              />
            </div>

            <div className="md:col-span-2 flex gap-4 mt-2">
              {isEditing && (
                <button type="button" onClick={resetForm} className="flex-1 bg-gray-300 text-gray-800 font-bold py-3 rounded-lg hover:bg-gray-400 transition text-lg">
                  Cancel
                </button>
              )}

              <button
                type="submit"
                disabled={!isEditing && isLimitReached}
                className={`flex-1 text-white font-black py-3 rounded-lg transition shadow-lg text-lg ${
                  !isEditing && isLimitReached ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isEditing ? 'Update Team 🛠️' : 'Save New Team 🏏'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-xl border-t-8 border-green-500">
          <h2 className="text-2xl font-black text-gray-800 mb-6">📋 Manage Existing Teams</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <div
                key={team._id}
                className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 transition bg-gray-50 flex justify-between items-center"
              >
                <div>
                  <h3 className="font-black text-xl text-gray-800">{team.teamName}</h3>
                  <p className="font-bold text-green-600 text-sm">Purse: ₹{team.remainingPurse?.toLocaleString()}</p>
                </div>
                <button
                  onClick={() => handleEditClick(team)}
                  className="bg-blue-100 text-blue-700 p-2 rounded-lg font-bold hover:bg-blue-600 hover:text-white transition shadow-sm"
                >
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