import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { TournamentContext } from '../context/TournamentContext';
import { apiRequest } from '../utils/apiClient';
import { getEffectivePlanPolicy, fetchAndCachePlans } from '../utils/planHelper';
import ImageCropperModal from '../components/ImageCropperModal';
import { uploadImageToCloudinary } from '../utils/cloudinaryUpload';
import { suggestShortName, sanitizeShortName } from '../utils/shortNameGenerator';
import { Wand2, Trash2 } from 'lucide-react';

function AddTeam() {
  const navigate = useNavigate();
  const { tournament } = useContext(TournamentContext);

  const [teams, setTeams] = useState([]);
  const [organizerPlan, setOrganizerPlan] = useState('Free');
  const [organizerRole, setOrganizerRole] = useState('Organizer');

  const [isEditing, setIsEditing] = useState(false);
  const [editTeamId, setEditTeamId] = useState(null);

  const [teamName, setTeamName] = useState('');
  const [shortName, setShortName] = useState('');
  const [isShortNameCustom, setIsShortNameCustom] = useState(false);
  const [shortNameHint, setShortNameHint] = useState('');
  const [budget, setBudget] = useState(50000000); // Default
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [plansCacheKey, setPlansCacheKey] = useState(0);

  useEffect(() => {
    setOrganizerPlan(localStorage.getItem('organizerPlan') || 'Free');
    setOrganizerRole(localStorage.getItem('organizerRole') || 'Organizer');
    fetchTeams();
    fetchAndCachePlans().then(() => setPlansCacheKey(Date.now()));
  }, []);

  useEffect(() => {
     if(tournament && tournament.teamBudget) {
         setBudget(tournament.teamBudget);
     }
  }, [tournament]);

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiRequest({
        path: '/api/teams',
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeams(response.data);
    } catch (error) { console.error("Teams fetch error:", error); }
  };

  const handleTeamNameChange = (e) => {
    const val = e.target.value;
    setTeamName(val);
    if (!isShortNameCustom) {
      const suggestion = suggestShortName(val, teams, editTeamId);
      setShortName(suggestion.shortName);
      setShortNameHint(suggestion.message || '');
    }
  };

  const handleShortNameChange = (e) => {
    setIsShortNameCustom(true);
    const sanitized = sanitizeShortName(e.target.value);
    setShortName(sanitized);
    const collision = teams.some(t => (!editTeamId || String(t._id) !== String(editTeamId)) && String(t.shortName).toUpperCase() === sanitized);
    setShortNameHint(collision ? '⚠️ This Short Name is already taken by another team.' : '');
  };

  const handleAutoSuggest = () => {
    setIsShortNameCustom(false);
    const suggestion = suggestShortName(teamName, teams, editTeamId);
    setShortName(suggestion.shortName);
    setShortNameHint(suggestion.message || '');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("⚠️ कृपया 10MB से छोटी फोटो चुनें।");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob) => {
    setCropperOpen(false);
    setCropImageSrc(null);
    setIsUploading(true);
    try {
      const secureUrl = await uploadImageToCloudinary(croppedBlob, `${teamName.trim().toLowerCase().replace(/\s+/g, '-') || 'team'}-logo.jpg`);
      setLogoUrl(secureUrl);
    } catch (err) {
      alert("❌ फोटो अपलोड फेल! कृपया दोबारा प्रयास करें।");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(isUploading) { alert('फोटो अपलोड हो रही है...'); return; }
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const payload = { teamName: teamName.trim(), shortName: shortName.trim().toUpperCase(), totalPurse: Number(budget), ownerName, mobile, logoUrl };

      await apiRequest({
        method: isEditing ? 'put' : 'post',
        path: isEditing ? `/api/teams/${editTeamId}` : '/api/teams',
        data: payload,
        headers
      });

      alert(isEditing ? 'Team updated successfully! 🎉' : 'Team added successfully! 🎉');
      
      resetForm();
      fetchTeams();
    } catch (error) { alert(error?.response?.data?.message || 'Error saving team!'); }
  };

  const handleEditClick = (team) => {
    setIsEditing(true);
    setEditTeamId(team._id);
    setTeamName(team.teamName);
    setShortName(team.shortName || '');
    setIsShortNameCustom(true);
    setShortNameHint('');
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
      const headers = { Authorization: `Bearer ${token}` };

      await apiRequest({
        method: 'delete',
        path: `/api/teams/${team._id}`,
        headers
      });

      if (isEditing && editTeamId === team._id) {
        resetForm();
      }
      fetchTeams();
      alert('Team deleted successfully! 🗑️');
    } catch (error) {
      alert(error?.response?.data?.message || 'Team delete failed!');
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditTeamId(null);
    setTeamName('');
    setShortName('');
    setIsShortNameCustom(false);
    setShortNameHint('');
    setOwnerName('');
    setMobile('');
    setLogoUrl('');
    if(tournament && tournament.teamBudget) setBudget(tournament.teamBudget);
    else setBudget(50000000);
  };

  const activePolicy = getEffectivePlanPolicy(organizerPlan, organizerRole);
  const teamLimit = activePolicy.teamLimit;
  const isLimitReached = teamLimit !== -1 && teams.length >= teamLimit && organizerRole !== 'SuperAdmin';

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
                 <input
                   type="text"
                   value={teamName}
                   onChange={handleTeamNameChange}
                   required
                   placeholder="e.g. Chennai Super Kings"
                   disabled={!isEditing && isLimitReached}
                   className="w-full p-4 border-2 border-gray-200 rounded-xl bg-gray-50 font-bold focus:border-blue-500 outline-none"
                 />
              </div>
              <div>
                 <div className="flex items-center justify-between mb-1">
                   <label className="block text-sm font-bold text-gray-700">Short Name *</label>
                   <button
                     type="button"
                     onClick={handleAutoSuggest}
                     className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
                     title="Auto-suggest abbreviation from full team name"
                   >
                     <Wand2 className="w-3.5 h-3.5" /> Auto
                   </button>
                 </div>
                 <input
                   type="text"
                   value={shortName}
                   onChange={handleShortNameChange}
                   required
                   maxLength={5}
                   placeholder="e.g. CSK"
                   disabled={!isEditing && isLimitReached}
                   className="w-full p-4 border-2 border-gray-200 rounded-xl bg-gray-50 font-bold uppercase tracking-wider focus:border-blue-500 outline-none"
                 />
                 {shortNameHint && (
                   <p className={`text-xs font-semibold mt-1 ${shortNameHint.includes('⚠️') ? 'text-amber-600' : 'text-blue-600'}`}>
                     {shortNameHint}
                   </p>
                 )}
              </div>
              
              <div className="md:col-span-2">
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
                {logoUrl ? (
                  <div className="relative group">
                    <img src={logoUrl} alt="Logo" className="w-20 h-20 object-contain bg-white border rounded-xl shadow-sm" />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-400 font-bold text-xs">
                    No Logo
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <label className={`cursor-pointer px-4 py-2 bg-white border border-gray-300 rounded-lg font-bold text-sm hover:bg-gray-50 shadow-sm flex items-center gap-1.5 ${(!isEditing && isLimitReached) || isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {isUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <span>{logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
                    )}
                    <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" disabled={(!isEditing && isLimitReached) || isUploading} />
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      disabled={isUploading}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold text-xs flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>
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
              <div key={team._id} className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 transition bg-gray-50 flex justify-between items-center gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {team.logoUrl || team.logo ? (
                    <img
                      src={team.logoUrl || team.logo}
                      alt={team.teamName}
                      className="w-11 h-11 rounded-xl object-contain bg-white border border-gray-200 shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-xs flex items-center justify-center shadow-sm shrink-0 uppercase">
                      {team.shortName || team.teamName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-black text-base text-gray-800 truncate" title={team.teamName}>{team.teamName}</h3>
                    <p className="font-bold text-indigo-600 text-xs">Short: {team.shortName || '-'}</p>
                    <p className="font-bold text-green-600 text-xs">Purse: ₹{team.remainingPurse?.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => handleEditClick(team)} className="bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-lg font-bold text-xs hover:bg-blue-200 transition">Edit</button>
                  <button onClick={() => handleDeleteTeam(team)} className="bg-red-100 text-red-700 px-2.5 py-1.5 rounded-lg font-bold text-xs hover:bg-red-200 transition">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 1:1 Square Team Logo Cropper Modal */}
        <ImageCropperModal
          isOpen={cropperOpen}
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => { setCropperOpen(false); setCropImageSrc(null); }}
          aspectRatio={1}
          title="Crop Team Logo (1:1 Square)"
        />
      </div>
    </div>
  );
}

export default AddTeam;