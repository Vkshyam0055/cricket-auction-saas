import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { TournamentContext } from '../context/TournamentContext';
import { apiRequest } from '../utils/apiClient';
import axios from 'axios';

export default function TournamentSettings() {
  const navigate = useNavigate();
  const { tournament, fetchTournament } = useContext(TournamentContext);
  
  const [openSection1, setOpenSection1] = useState(true);
  const [openSection2, setOpenSection2] = useState(true);
  const [openSection3, setOpenSection3] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    venue: '',
    logoUrl: '',
    tournamentPoster: '',
    teamBudget: 50000000,
    minPlayersPerTeam: 15,
    bidButton1: 500,
    bidButton2: 1000,
    bidButton3: 5000,
    biddingButtonsCount: 3,
  });

  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (tournament) {
      setFormData({
        name: tournament.name || '',
        venue: tournament.venue || '',
        logoUrl: tournament.logoUrl || '',
        tournamentPoster: tournament.tournamentPoster || '',
        teamBudget: tournament.teamBudget || 50000000,
        minPlayersPerTeam: tournament.minPlayersPerTeam || 15,
        bidButton1: tournament.bidButton1 || 500,
        bidButton2: tournament.bidButton2 || 1000,
        bidButton3: tournament.bidButton3 || 5000,
        biddingButtonsCount: tournament.biddingButtonsCount || 3,
      });
    }
  }, [tournament]);

  const handleUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const fieldName = type === 'logoUrl' ? 'logoUrl' : 'tournamentPoster';
    if (type === 'logoUrl') setUploadingLogo(true);
    else setUploadingPoster(true);

    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', 'auction_preset');
    data.append('cloud_name', 'dpg5olqt7');

    try {
      const res = await axios.post('https://api.cloudinary.com/v1_1/dpg5olqt7/image/upload', data);
      setFormData(prev => ({ ...prev, [fieldName]: res.data.secure_url }));
    } catch (err) {
      console.error('Upload failed', err);
      showToast('Image upload failed');
    } finally {
      if (type === 'logoUrl') setUploadingLogo(false);
      else setUploadingPoster(false);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleSave = async () => {
    if (!formData.name) {
      showToast('Tournament Name is required');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      // Merge with existing tournament data to preserve customFields, UPI settings etc.
      const payload = {
        name: formData.name,
        venue: formData.venue,
        logoUrl: formData.logoUrl,
        tournamentPoster: formData.tournamentPoster,
        teamBudget: formData.teamBudget,
        minPlayersPerTeam: formData.minPlayersPerTeam,
        bidButton1: formData.bidButton1,
        bidButton2: formData.bidButton2,
        bidButton3: formData.bidButton3,
        biddingButtonsCount: formData.biddingButtonsCount,
        // Preserve existing fields from tournament
        customFields: tournament?.customFields || [],
        upiQrUrl: tournament?.upiQrUrl || '',
        upiId: tournament?.upiId || '',
        paymentMessage: tournament?.paymentMessage || '',
      };
      
      await apiRequest({ method: 'post', path: '/api/tournament', data: payload, headers });
      await fetchTournament();
      showToast('Settings saved successfully!');
    } catch (err) {
      console.error(err);
      showToast('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const budgetChanged = formData.teamBudget !== 50000000 || formData.minPlayersPerTeam !== 15;
  const bidChanged = formData.bidButton1 !== 500 || formData.bidButton2 !== 1000 || formData.bidButton3 !== 5000;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-24">
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="flex items-center px-4 h-14">
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-indigo-400 hover:text-indigo-300 font-medium"
          >
            <span className="mr-1 text-xl">←</span> Dashboard
          </button>
          <h1 className="flex-1 text-center text-lg font-bold text-slate-100 pr-24">
            ⚙️ Tournament Settings
          </h1>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        {/* Section 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <button 
            onClick={() => setOpenSection1(!openSection1)}
            className="w-full flex justify-between items-center p-4 bg-slate-800/50 hover:bg-slate-800 transition-colors"
          >
            <h2 className="text-base font-bold text-slate-100">📝 Basic Info (बुनियादी जानकारी)</h2>
            <span className="text-slate-400">{openSection1 ? '▼' : '▶'}</span>
          </button>
          
          {openSection1 && (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Tournament Name *</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  placeholder="Enter tournament name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Venue</label>
                <input 
                  type="text" 
                  value={formData.venue}
                  onChange={(e) => setFormData({...formData, venue: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  placeholder="Enter venue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Logo Upload</label>
                <div className="flex items-center gap-4">
                  {formData.logoUrl && <img src={formData.logoUrl} alt="Logo" className="w-12 h-12 object-contain bg-slate-800 rounded" />}
                  <label className="relative flex-1 cursor-pointer bg-slate-800 border border-slate-700 border-dashed rounded-lg px-4 py-3 text-center hover:border-indigo-500 transition-colors">
                    <span className="text-sm text-indigo-400 font-medium">{uploadingLogo ? 'Uploading...' : 'Choose File'}</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUpload(e, 'logoUrl')} disabled={uploadingLogo} />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Tournament Poster Upload</label>
                <div className="flex items-center gap-4">
                  {formData.tournamentPoster && <img src={formData.tournamentPoster} alt="Poster" className="w-16 h-12 object-cover bg-slate-800 rounded" />}
                  <label className="relative flex-1 cursor-pointer bg-slate-800 border border-slate-700 border-dashed rounded-lg px-4 py-3 text-center hover:border-indigo-500 transition-colors">
                    <span className="text-sm text-indigo-400 font-medium">{uploadingPoster ? 'Uploading...' : 'Choose File'}</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUpload(e, 'tournamentPoster')} disabled={uploadingPoster} />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <button 
            onClick={() => setOpenSection2(!openSection2)}
            className="w-full flex justify-between items-center p-4 bg-slate-800/50 hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">💰 Team Budget & Rules (टीम बजट और नियम)</h2>
              {budgetChanged && <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30 uppercase">✅ Set</span>}
            </div>
            <span className="text-slate-400">{openSection2 ? '▼' : '▶'}</span>
          </button>
          
          {openSection2 && (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Points Balance / Purse per Team ₹</label>
                <input 
                  type="number" 
                  value={formData.teamBudget}
                  onChange={(e) => setFormData({...formData, teamBudget: Number(e.target.value)})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Min Players per Team</label>
                <input 
                  type="number" 
                  value={formData.minPlayersPerTeam}
                  onChange={(e) => setFormData({...formData, minPlayersPerTeam: Number(e.target.value)})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <button 
            onClick={() => setOpenSection3(!openSection3)}
            className="w-full flex justify-between items-center p-4 bg-slate-800/50 hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">🔨 Auction Bidding Config (नीलामी बोली कॉन्फिग)</h2>
              {bidChanged && <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30 uppercase">✅ Set</span>}
            </div>
            <span className="text-slate-400">{openSection3 ? '▼' : '▶'}</span>
          </button>
          
          {openSection3 && (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Number of Bidding Buttons</label>
                <select 
                  value={formData.biddingButtonsCount}
                  onChange={(e) => setFormData({...formData, biddingButtonsCount: Number(e.target.value)})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                >
                  <option value={1}>1 Button</option>
                  <option value={2}>2 Buttons</option>
                  <option value={3}>3 Buttons</option>
                </select>
              </div>
              <div className={`grid ${formData.biddingButtonsCount === 1 ? 'grid-cols-1' : formData.biddingButtonsCount === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-3`}>
                {formData.biddingButtonsCount >= 1 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Button 1</label>
                    <input 
                      type="number" 
                      value={formData.bidButton1}
                      onChange={(e) => setFormData({...formData, bidButton1: Number(e.target.value)})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2.5 text-center text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                )}
                {formData.biddingButtonsCount >= 2 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Button 2</label>
                    <input 
                      type="number" 
                      value={formData.bidButton2}
                      onChange={(e) => setFormData({...formData, bidButton2: Number(e.target.value)})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2.5 text-center text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                )}
                {formData.biddingButtonsCount >= 3 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Button 3</label>
                    <input 
                      type="number" 
                      value={formData.bidButton3}
                      onChange={(e) => setFormData({...formData, bidButton3: Number(e.target.value)})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2.5 text-center text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-900/20 active:scale-[0.98] transition-all disabled:opacity-70 flex justify-center items-center gap-2"
        >
          {loading ? 'Saving...' : 'Save Changes ✓'}
        </button>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-800 text-slate-100 px-4 py-3 rounded-lg shadow-xl border border-slate-700 z-50 text-sm font-medium animate-bounce text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
