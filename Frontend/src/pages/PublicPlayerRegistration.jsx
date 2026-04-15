import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const API_BASE_URL = 'https://cricket-auction-backend-h8ud.onrender.com/api';

function PublicPlayerRegistration() {
  const { tournamentId } = useParams();
  
  const [tournamentDetails, setTournamentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '', fatherName: '', age: '', mobile: '', city: '', role: 'Batsman', basePrice: 0, photoUrl: ''
  });
  
  // 🌟 NEW: Custom Data State 🌟
  const [customData, setCustomData] = useState({});
  
  const [isSuccess, setIsSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false); 

  const CLOUD_NAME = "dpg5olqt7"; 
  const UPLOAD_PRESET = "auction_preset"; 

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/players/public/${tournamentId}`);
        setTournamentDetails(res.data);
        
        // Initialize customData state with default values based on custom fields
        const initialCustomData = {};
        if(res.data.customFields) {
            res.data.customFields.forEach(field => {
                initialCustomData[field.label] = field.type === 'checkbox' ? false : '';
            });
            setCustomData(initialCustomData);
        }

      } catch (err) { setError(err.response?.data?.message || 'Invalid URL or Registration Closed'); } 
      finally { setLoading(false); }
    };
    if (tournamentId) fetchDetails();
  }, [tournamentId]);

  const handleStandardChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleCustomChange = (e, label, type) => {
      setCustomData({ ...customData, [label]: type === 'checkbox' ? e.target.checked : e.target.value });
  };

  const uploadToCloudinary = async (file) => {
    const data = new FormData();
    data.append("file", file); data.append("upload_preset", UPLOAD_PRESET); data.append("cloud_name", CLOUD_NAME);
    const res = await axios.post(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, data);
    return res.data.secure_url;
  };

  // Main Photo Upload
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setFormData({ ...formData, photoUrl: url }); 
      alert("✅ फोटो अपलोड हो गई!");
    } catch (err) { alert("❌ फोटो अपलोड फेल!"); } 
    finally { setIsUploading(false); }
  };

  // 🌟 Dynamic Custom File Upload 🌟
  const handleCustomFileUpload = async (e, label) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setCustomData({ ...customData, [label]: url }); 
      alert(`✅ ${label} अपलोड हो गया!`);
    } catch (err) { alert(`❌ ${label} अपलोड फेल!`); } 
    finally { setIsUploading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isUploading) { alert("फोटो/फाइल अपलोड हो रही है, इंतज़ार करें..."); return; }
    
    try {
      // 🌟 Send both standard and custom data
      await axios.post(`${API_BASE_URL}/players/public/${tournamentId}/register`, {
          ...formData,
          customData
      });
      setIsSuccess(true);
    } catch (err) { alert("Registration failed! Please try again."); }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center font-bold">Loading...</div>;
  if (error || !tournamentDetails) return <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 text-center"><div className="bg-white p-10 rounded-3xl shadow-2xl"><h2 className="text-2xl font-black text-gray-800">{error}</h2></div></div>;
  if (isSuccess) return <div className="min-h-screen bg-green-50 flex items-center justify-center p-6 text-center"><div className="bg-white p-8 rounded-3xl shadow-2xl border-t-8 border-green-500"><div className="text-6xl mb-4">✅</div><h2 className="text-3xl font-black text-gray-800 mb-2">Success!</h2><p className="text-gray-600 font-medium">आपका रजिस्ट्रेशन सफलतापूर्वक हो गया है।</p></div></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-black p-4 flex flex-col items-center pb-20">
      <div className="mb-8 text-center mt-6">
        {tournamentDetails.logoUrl && <img src={tournamentDetails.logoUrl} alt="Logo" className="w-24 h-24 mx-auto mb-4 rounded-full bg-white object-contain border-4 border-yellow-400" />}
        <h1 className="text-4xl font-black text-white italic uppercase">{tournamentDetails.name}</h1>
        <p className="text-yellow-300 font-bold uppercase tracking-widest mt-2">Player Registration</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border-t-8 border-yellow-500">
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col items-center">
             {formData.photoUrl ? <img src={formData.photoUrl} alt="Preview" className="w-24 h-24 rounded-full object-cover shadow-md mb-2" /> : <div className="w-24 h-24 rounded-full bg-gray-200 shadow-md mb-2 flex items-center justify-center text-3xl">📷</div>}
             <label className="cursor-pointer bg-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm border border-blue-200">
                {isUploading ? 'Uploading...' : 'Upload Profile Photo'}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
             </label>
          </div>

          {/* Standard Fields */}
          <div><label className="block text-xs font-black text-gray-500 uppercase mb-1">Full Name *</label><input name="name" required onChange={handleStandardChange} className="w-full p-3 bg-gray-100 rounded-xl font-bold" placeholder="e.g. Rahul" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-black text-gray-500 uppercase mb-1">Age</label><input name="age" type="number" onChange={handleStandardChange} className="w-full p-3 bg-gray-100 rounded-xl font-bold" /></div>
            <div><label className="block text-xs font-black text-gray-500 uppercase mb-1">Mobile *</label><input name="mobile" required onChange={handleStandardChange} className="w-full p-3 bg-gray-100 rounded-xl font-bold" /></div>
          </div>
          <div>
             <label className="block text-xs font-black text-gray-500 uppercase mb-1">Role *</label>
             <select name="role" onChange={handleStandardChange} className="w-full p-3 bg-gray-100 rounded-xl font-bold text-blue-700">
               <option value="Batsman">Batsman</option><option value="Bowler">Bowler</option><option value="All-Rounder">All-Rounder</option><option value="Wicket Keeper">Wicket Keeper</option>
             </select>
          </div>
          <div><label className="block text-xs font-black text-gray-500 uppercase mb-1">City/Village</label><input name="city" onChange={handleStandardChange} className="w-full p-3 bg-gray-100 rounded-xl font-bold" /></div>

          {/* 🌟 DYNAMIC CUSTOM FIELDS RENDERER 🌟 */}
          {tournamentDetails.customFields && tournamentDetails.customFields.length > 0 && (
             <div className="mt-6 pt-6 border-t-2 border-dashed border-gray-200 space-y-5">
                <h3 className="font-black text-gray-400 uppercase tracking-widest text-center text-xs mb-4">Additional Information</h3>
                
                {tournamentDetails.customFields.map((field, idx) => (
                   <div key={idx}>
                      {field.type !== 'checkbox' && <label className="block text-xs font-black text-gray-500 uppercase mb-1">{field.label} {field.required && '*'}</label>}
                      
                      {field.type === 'text' && <input type="text" required={field.required} onChange={(e) => handleCustomChange(e, field.label, field.type)} className="w-full p-3 bg-indigo-50 border border-indigo-100 rounded-xl font-bold text-indigo-900" />}
                      
                      {field.type === 'number' && <input type="number" required={field.required} onChange={(e) => handleCustomChange(e, field.label, field.type)} className="w-full p-3 bg-indigo-50 border border-indigo-100 rounded-xl font-bold text-indigo-900" />}
                      
                      {field.type === 'dropdown' && (
                         <select required={field.required} onChange={(e) => handleCustomChange(e, field.label, field.type)} className="w-full p-3 bg-indigo-50 border border-indigo-100 rounded-xl font-bold text-indigo-900">
                            <option value="">-- Select --</option>
                            {field.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                         </select>
                      )}
                      
                      {field.type === 'file' && (
                         <div className="flex flex-col items-start space-y-2">
                            {customData[field.label] ? (
                               <a href={customData[field.label]} target="_blank" rel="noreferrer" className="text-green-600 font-bold text-sm bg-green-50 px-3 py-1 rounded border border-green-200">✅ File Uploaded (Click to view)</a>
                            ) : null}
                            <label className="cursor-pointer bg-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm border border-indigo-200 text-indigo-700 w-full text-center">
                               {isUploading ? 'Uploading...' : `Upload ${field.label}`}
                               <input type="file" required={field.required && !customData[field.label]} onChange={(e) => handleCustomFileUpload(e, field.label)} className="hidden" disabled={isUploading} />
                            </label>
                         </div>
                      )}
                      
                      {field.type === 'checkbox' && (
                         <label className="flex items-center space-x-3 bg-indigo-50 p-3 rounded-xl border border-indigo-100 cursor-pointer">
                            <input type="checkbox" required={field.required} onChange={(e) => handleCustomChange(e, field.label, field.type)} className="w-5 h-5 accent-indigo-600" />
                            <span className="font-bold text-indigo-900 text-sm">{field.label} {field.required && '*'}</span>
                         </label>
                      )}
                   </div>
                ))}
             </div>
          )}
          
          <button type="submit" disabled={isUploading} className="w-full mt-4 text-white font-black py-4 rounded-2xl text-lg bg-blue-700 hover:bg-blue-800 shadow-xl active:scale-95 transition">
            REGISTER NOW ⚡
          </button>
        </form>
      </div>
    </div>
  );
}

export default PublicPlayerRegistration;