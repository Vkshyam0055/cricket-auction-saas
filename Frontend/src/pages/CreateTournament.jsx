import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TournamentContext } from '../context/TournamentContext';

function CreateTournament() {
  const navigate = useNavigate();
  const { tournament, fetchTournament } = useContext(TournamentContext);

  const [formData, setFormData] = useState({
    name: '', logoUrl: '', tournamentPoster: '', venue: '', 
    teamBudget: 50000000, minPlayersPerTeam: 15,
    bidButton1: 500, bidButton2: 1000, bidButton3: 5000,
    upiQrUrl: '', upiId: '', paymentMessage: '' 
  });

  const [customFields, setCustomFields] = useState([]);
  
  // Upload States
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingQr, setIsUploadingQr] = useState(false);

  useEffect(() => {
    if (tournament) {
      setFormData({
        name: tournament.name || '', 
        logoUrl: tournament.logoUrl || '', 
        tournamentPoster: tournament.tournamentPoster || '', 
        venue: tournament.venue || '',
        teamBudget: tournament.teamBudget || 50000000,
        minPlayersPerTeam: tournament.minPlayersPerTeam || 15,
        bidButton1: tournament.bidButton1 || 500, bidButton2: tournament.bidButton2 || 1000, bidButton3: tournament.bidButton3 || 5000,
        upiQrUrl: tournament.upiQrUrl || '', upiId: tournament.upiId || '', paymentMessage: tournament.paymentMessage || ''
      });
      setCustomFields(tournament.customFields || []); 
    }
  }, [tournament]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // 🌟 Universal Cloudinary Upload Function 🌟
  const handleUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    if (fieldName === 'tournamentPoster') setIsUploadingPoster(true);
    if (fieldName === 'logoUrl') setIsUploadingLogo(true);
    if (fieldName === 'upiQrUrl') setIsUploadingQr(true);

    const data = new FormData();
    data.append("file", file); 
    data.append("upload_preset", "auction_preset"); 
    data.append("cloud_name", "dpg5olqt7");

    try {
      const res = await axios.post(`https://api.cloudinary.com/v1_1/dpg5olqt7/image/upload`, data);
      setFormData(prev => ({ ...prev, [fieldName]: res.data.secure_url }));
    } catch (err) { 
      alert("❌ फोटो अपलोड फेल!"); 
    } finally { 
      if (fieldName === 'tournamentPoster') setIsUploadingPoster(false);
      if (fieldName === 'logoUrl') setIsUploadingLogo(false);
      if (fieldName === 'upiQrUrl') setIsUploadingQr(false);
    }
  };

  const addField = () => setCustomFields([...customFields, { label: '', type: 'text', required: false, options: [] }]);
  const removeField = (index) => setCustomFields(customFields.filter((_, i) => i !== index));
  const updateField = (index, key, value) => {
    const updated = [...customFields];
    if (key === 'options') updated[index][key] = value.split(',').map(s => s.trim());
    else updated[index][key] = value;
    setCustomFields(updated);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if(isUploadingPoster || isUploadingLogo || isUploadingQr) { alert("फोटो अपलोड हो रही है, रुकिए..."); return; }
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post('https://cricket-auction-backend-h8ud.onrender.com/api/tournament', { ...formData, customFields }, { headers });
      await fetchTournament(); 
      alert('🎉 टूर्नामेंट सफलतापूर्वक सेट हो गया!');
      navigate('/dashboard'); 
    } catch (error) { alert('सेव करने में दिक्कत आई!'); }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 flex justify-center items-start">
      <div className="max-w-3xl w-full">
        
        {/* 🌟 FACEBOOK STYLE PROFILE HEADER 🌟 */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-6 border-b-8 border-indigo-600">
           {/* Cover Photo / Poster */}
           <div className="relative h-48 md:h-64 bg-gray-200 group">
              {formData.tournamentPoster ? (
                 <img src={formData.tournamentPoster} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                 <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gradient-to-r from-gray-100 to-gray-200">
                    <span className="text-4xl">🖼️</span>
                    <span className="font-bold mt-2 text-sm">Upload Tournament Poster</span>
                 </div>
              )}
              <label className="absolute bottom-4 right-4 cursor-pointer bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-opacity-80 transition backdrop-blur-sm shadow-md">
                 {isUploadingPoster ? 'Uploading...' : '📷 Edit Poster'}
                 <input type="file" accept="image/*" onChange={(e) => handleUpload(e, 'tournamentPoster')} className="hidden" disabled={isUploadingPoster} />
              </label>
           </div>

           {/* Profile Photo / Logo */}
           <div className="absolute top-44 md:top-60 left-8 md:left-12 transform -translate-y-1/2">
              <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-white bg-white shadow-xl group">
                 {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="Logo" className="w-full h-full rounded-full object-cover" />
                 ) : (
                    <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-3xl">🏆</div>
                 )}
                 <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition">
                    <span className="text-sm font-bold">{isUploadingLogo ? '...' : '📷 Logo'}</span>
                    <input type="file" accept="image/*" onChange={(e) => handleUpload(e, 'logoUrl')} className="hidden" disabled={isUploadingLogo} />
                 </label>
              </div>
           </div>

           <div className="pt-16 md:pt-20 px-8 md:px-12 pb-8">
              <h2 className="text-2xl md:text-4xl font-black text-gray-800 tracking-tight">{formData.name || 'Tournament Name'}</h2>
              <p className="text-gray-500 font-bold mt-1 text-sm md:text-base">📍 {formData.venue || 'Venue not set'}</p>
           </div>
        </div>

        {/* 🌟 SETTINGS FORM 🌟 */}
        <div className="bg-white p-8 rounded-3xl shadow-2xl">
          <form onSubmit={handleSave} className="space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div><label className="block text-xs font-black text-gray-500 uppercase mb-2">Tournament Name *</label><input name="name" value={formData.name} onChange={handleChange} required className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-indigo-500 outline-none" /></div>
               <div><label className="block text-xs font-black text-gray-500 uppercase mb-2">Venue</label><input name="venue" value={formData.venue} onChange={handleChange} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-indigo-500 outline-none" /></div>
            </div>

            {/* 🌟 NEW: TEAM BUDGET & PLAYERS PER TEAM 🌟 */}
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
               <h3 className="font-black text-blue-900 uppercase tracking-widest mb-4">⚙️ Team Rules & Budget Settings</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black text-blue-700 uppercase mb-2">Points Balance / Purse per Team (₹)</label>
                    <input name="teamBudget" type="number" value={formData.teamBudget} onChange={handleChange} className="w-full p-4 bg-white border border-blue-200 rounded-xl font-black text-blue-900 focus:border-blue-500 outline-none" />
                    <p className="text-[10px] text-blue-600 mt-1 font-bold">यह बजट हर नई टीम पर अपने आप लागू हो जाएगा।</p>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-blue-700 uppercase mb-2">Min Players Per Team</label>
                    <input name="minPlayersPerTeam" type="number" value={formData.minPlayersPerTeam} onChange={handleChange} className="w-full p-4 bg-white border border-blue-200 rounded-xl font-black text-blue-900 focus:border-blue-500 outline-none" />
                    <p className="text-[10px] text-blue-600 mt-1 font-bold">कम से कम कितने खिलाड़ी टीम में होने चाहिए।</p>
                  </div>
               </div>
            </div>

            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
              <label className="block text-sm font-black text-indigo-800 uppercase mb-4">Bidding Buttons (₹)</label>
              <div className="grid grid-cols-3 gap-4">
                <div><span className="text-xs font-bold text-gray-500">Btn 1</span><input name="bidButton1" type="number" value={formData.bidButton1} onChange={handleChange} className="w-full p-3 mt-1 bg-white border rounded-lg font-bold text-center" /></div>
                <div><span className="text-xs font-bold text-gray-500">Btn 2</span><input name="bidButton2" type="number" value={formData.bidButton2} onChange={handleChange} className="w-full p-3 mt-1 bg-white border rounded-lg font-bold text-center" /></div>
                <div><span className="text-xs font-bold text-gray-500">Btn 3</span><input name="bidButton3" type="number" value={formData.bidButton3} onChange={handleChange} className="w-full p-3 mt-1 bg-white border rounded-lg font-bold text-center" /></div>
              </div>
            </div>

            <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
               <h3 className="font-black text-green-800 uppercase tracking-widest mb-4">💸 Registration Fee Settings</h3>
               <div className="space-y-4">
                  <div><label className="block text-xs font-black text-gray-500 uppercase mb-1">Payment Instruction / Message</label><input name="paymentMessage" value={formData.paymentMessage} onChange={handleChange} placeholder="e.g. Entry Fee ₹500. Pay below." className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold focus:border-green-500 outline-none text-sm" /></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-xs font-black text-gray-500 uppercase mb-1">Your UPI ID</label><input name="upiId" value={formData.upiId} onChange={handleChange} placeholder="e.g. 9876543210@ybl" className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold focus:border-green-500 outline-none text-sm" /></div>
                    <div>
                       <label className="block text-xs font-black text-gray-500 uppercase mb-1">Upload QR Code</label>
                       <label className="cursor-pointer bg-white px-4 py-3 rounded-xl border border-gray-200 w-full flex items-center justify-center font-bold text-sm hover:bg-gray-50">
                          {isUploadingQr ? 'Uploading...' : formData.upiQrUrl ? '✅ QR Uploaded (Click to Change)' : '📁 Select QR Image'}
                          <input type="file" accept="image/*" onChange={(e) => handleUpload(e, 'upiQrUrl')} className="hidden" disabled={isUploadingQr} />
                       </label>
                    </div>
                  </div>
               </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-300">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-gray-700 uppercase tracking-widest">📝 Form Builder</h3>
                  <button type="button" onClick={addField} className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-black shadow-md">+ Add Custom Field</button>
               </div>
               {customFields.length === 0 ? (
                  <p className="text-gray-400 font-medium text-sm text-center py-4">अतिरिक्त जानकारी (जैसे Payment Screenshot) मांगने के लिए नई फील्ड जोड़ें।</p>
               ) : (
                  <div className="space-y-4">
                     {customFields.map((field, index) => (
                        <div key={index} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative">
                           <button type="button" onClick={() => removeField(index)} className="absolute top-2 right-2 text-red-500 font-bold hover:bg-red-50 px-2 py-1 rounded">✖</button>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2 pr-8">
                              <input type="text" placeholder="Field Label (e.g. T-Shirt Size)" value={field.label} onChange={(e) => updateField(index, 'label', e.target.value)} required className="p-2 border rounded font-bold text-sm bg-gray-50" />
                              <select value={field.type} onChange={(e) => updateField(index, 'type', e.target.value)} className="p-2 border rounded font-bold text-sm bg-gray-50 text-blue-700">
                                 <option value="text">Text (Short Answer)</option><option value="number">Number</option><option value="dropdown">Dropdown</option><option value="file">File Upload (Image/PDF)</option><option value="checkbox">Checkbox (Yes/No)</option>
                              </select>
                           </div>
                           {field.type === 'dropdown' && <input type="text" placeholder="Options (comma separated: S, M, L, XL)" value={field.options?.join(', ')} onChange={(e) => updateField(index, 'options', e.target.value)} required className="w-full p-2 border rounded font-medium text-xs bg-gray-50 mb-2" />}
                           <label className="flex items-center space-x-2 text-sm font-bold text-gray-600"><input type="checkbox" checked={field.required} onChange={(e) => updateField(index, 'required', e.target.checked)} className="w-4 h-4 accent-indigo-600" /><span>Is Required?</span></label>
                        </div>
                     ))}
                  </div>
               )}
            </div>

            <div className="flex gap-4 pt-6">
              <button type="button" onClick={() => navigate('/dashboard')} className="flex-1 bg-gray-200 text-gray-700 font-black py-4 rounded-xl hover:bg-gray-300 transition">Cancel</button>
              <button type="submit" disabled={isUploadingPoster || isUploadingLogo || isUploadingQr} className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-indigo-700 disabled:bg-gray-400 transition">Save Tournament 🚀</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateTournament;