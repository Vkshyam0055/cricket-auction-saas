import React, { useState, useContext } from 'react';
import axios from 'axios';
import { TournamentContext } from '../context/TournamentContext';

function PublicPlayerRegistration() {
  const { tournament, loading } = useContext(TournamentContext);

  const [formData, setFormData] = useState({
    name: '', fatherName: '', age: '', mobile: '', city: '', role: 'Batsman', basePrice: 0, photoUrl: ''
  });
  const [isSuccess, setIsSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false); 

  const CLOUD_NAME = "dpg5olqt7"; 
  const UPLOAD_PRESET = "auction_preset"; 

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // 🌟 डायरेक्ट गैलरी से फोटो अपलोड करने का फंक्शन 🌟
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", UPLOAD_PRESET);
    data.append("cloud_name", CLOUD_NAME);

    try {
      const res = await axios.post(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, data);
      setFormData({ ...formData, photoUrl: res.data.secure_url }); 
      alert("✅ फोटो सफलतापूर्वक अपलोड हो गई!");
    } catch (err) {
      console.error(err);
      alert("❌ फोटो अपलोड करने में दिक्कत आई। कृपया अपनी इंटरनेट स्पीड चेक करें।");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isUploading) { alert("कृपया फोटो अपलोड होने का इंतज़ार करें..."); return; }
    
    try {
      await axios.post('https://cricket-auction-backend-h8ud.onrender.com/api/players', formData);
      setIsSuccess(true);
    } catch (err) {
      alert("Registration failed! Please try again.");
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center font-bold">Loading...</div>;

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-black text-gray-800 mb-2">Registration Closed</h2>
          <p className="text-gray-600 font-bold">अभी कोई टूर्नामेंट शुरू नहीं हुआ है। कृपया आयोजक से संपर्क करें।</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-2xl border-t-8 border-green-500 max-w-sm">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-3xl font-black text-gray-800 mb-2">Success!</h2>
          <p className="text-gray-600 font-medium">आपका रजिस्ट्रेशन सफलतापूर्वक हो गया है। ऑक्शन के लिए तैयार रहें! 🏏</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-black p-4 md:p-10 flex flex-col items-center">
      <div className="mb-8 text-center">
        {tournament.logoUrl && <img src={tournament.logoUrl} alt="Logo" className="w-20 h-20 mx-auto mb-4 rounded-full bg-white object-contain border-4 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]" />}
        <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">{tournament.name}</h1>
        <p className="text-blue-300 font-bold uppercase tracking-widest mt-2">Player Registration</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border-t-8 border-yellow-500">
        <div className="p-6 bg-gray-50 border-b">
          <p className="text-gray-500 font-bold text-sm">कृपया अपनी सही जानकारी भरें</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* 🌟 शानदार फोटो अपलोड सेक्शन 🌟 */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col items-center justify-center text-center">
             {formData.photoUrl ? (
                <img src={formData.photoUrl} alt="Preview" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md mb-2" />
             ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 border-4 border-white shadow-md mb-2 flex items-center justify-center text-3xl">📷</div>
             )}
             <label className="block text-xs font-black text-blue-800 uppercase mb-2 cursor-pointer bg-white px-4 py-2 rounded-lg shadow-sm border border-blue-200 hover:bg-blue-100 transition">
                {isUploading ? 'Uploading to Server...' : 'Upload Photo (Optional)'}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
             </label>
             <p className="text-[10px] text-gray-400 font-bold mt-1">Select from Phone Gallery / Computer</p>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Full Name *</label>
            <input name="name" required onChange={handleChange} className="w-full p-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800" placeholder="e.g. Rahul Sharma" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase mb-1">Age</label>
              <input name="age" type="number" onChange={handleChange} className="w-full p-3 bg-gray-100 rounded-xl font-bold text-gray-800" placeholder="22" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase mb-1">Mobile *</label>
              <input name="mobile" required onChange={handleChange} className="w-full p-3 bg-gray-100 rounded-xl font-bold text-gray-800" placeholder="10 Digit Number" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Role *</label>
            <select name="role" onChange={handleChange} className="w-full p-3 bg-gray-100 rounded-xl font-bold text-blue-700">
              <option value="Batsman">Batsman</option>
              <option value="Bowler">Bowler</option>
              <option value="All-Rounder">All-Rounder</option>
              <option value="Wicket Keeper">Wicket Keeper</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase mb-1">City/Village</label>
            <input name="city" onChange={handleChange} className="w-full p-3 bg-gray-100 rounded-xl font-bold text-gray-800" placeholder="Your location" />
          </div>
          
          <button type="submit" disabled={isUploading} className={`w-full text-white font-black py-4 rounded-2xl text-lg shadow-xl transition-all ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800 active:scale-95'}`}>
            REGISTER NOW ⚡
          </button>
        </form>
      </div>
    </div>
  );
}

export default PublicPlayerRegistration;