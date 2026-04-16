import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function AddPlayer() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '', fatherName: '', age: '', mobile: '', city: '', role: 'Batsman', category: 'A', basePrice: 500, photoUrl: ''
  });
  const [isUploading, setIsUploading] = useState(false);

  const CLOUD_NAME = "dpg5olqt7"; 
  const UPLOAD_PRESET = "auction_preset"; 

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

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
      alert("❌ फोटो अपलोड करने में दिक्कत आई।");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isUploading) { alert("कृपया फोटो अपलोड होने का इंतज़ार करें..."); return; }

    try {
      const token = localStorage.getItem('token');
      await axios.post('https://cricket-auction-backend-h8ud.onrender.com/api/players', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`🎉 खिलाड़ी '${formData.name}' को सफलतापूर्वक ऐड कर लिया गया है!`);
      navigate('/dashboard');
    } catch (err) {
      alert("गोडाउन में सेव करने में दिक्कत आई!");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-xl border-t-8 border-blue-600">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-black text-gray-800">Organizer: Add Player</h2>
          <button onClick={() => navigate('/dashboard')} className="bg-gray-200 px-4 py-2 rounded-lg font-bold hover:bg-gray-300">⬅ Back</button>
        </div>
        
        {/* फोटो अपलोड सेक्शन */}
        <div className="mb-8 flex items-center space-x-6 p-6 bg-blue-50 rounded-2xl border-2 border-blue-100 shadow-inner">
           {formData.photoUrl ? (
              <img src={formData.photoUrl} alt="Preview" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
           ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 border-4 border-white shadow-lg flex items-center justify-center text-3xl">📷</div>
           )}
           <div>
              <p className="text-sm font-bold text-gray-600 mb-2 uppercase tracking-widest">Player Photo</p>
              <label className="cursor-pointer bg-white px-6 py-3 rounded-xl shadow-md border-2 border-blue-200 hover:bg-blue-100 transition font-black text-blue-700 text-sm inline-block active:scale-95">
                 {isUploading ? '⏳ Uploading...' : '📁 Choose Image File'}
                 <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
              </label>
           </div>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <input name="name" placeholder="Full Name *" onChange={handleChange} className="p-4 border-2 border-gray-200 rounded-xl bg-gray-50 font-bold focus:border-blue-500 outline-none" required />
          <input name="fatherName" placeholder="Father's Name" onChange={handleChange} className="p-4 border-2 border-gray-200 rounded-xl bg-gray-50 font-bold focus:border-blue-500 outline-none" />
          <input name="age" type="number" placeholder="Age" onChange={handleChange} className="p-4 border-2 border-gray-200 rounded-xl bg-gray-50 font-bold focus:border-blue-500 outline-none" />
          <input name="mobile" placeholder="Mobile Number *" onChange={handleChange} className="p-4 border-2 border-gray-200 rounded-xl bg-gray-50 font-bold focus:border-blue-500 outline-none" required />
          <input name="city" placeholder="City/Village" onChange={handleChange} className="p-4 border-2 border-gray-200 rounded-xl bg-gray-50 font-bold focus:border-blue-500 outline-none" />
          <select name="role" onChange={handleChange} className="p-4 border-2 border-gray-200 rounded-xl bg-white font-black text-blue-700 focus:border-blue-500 outline-none">
            <option value="Batsman">Batsman</option>
            <option value="Bowler">Bowler</option>
            <option value="All-Rounder">All-Rounder</option>
            <option value="Wicket Keeper">Wicket Keeper</option>
          </select>
          <select name="category" value={formData.category} onChange={handleChange} className="p-4 border-2 border-gray-200 rounded-xl bg-white font-black text-purple-700 focus:border-purple-500 outline-none">
            <option value="A">Category A</option>
            <option value="B">Category B</option>
            <option value="C">Category C</option>
            <option value="D">Category D</option>
          </select>
          <input name="basePrice" type="number" placeholder="Base Price (₹)" onChange={handleChange} className="p-4 border-2 border-gray-200 rounded-xl bg-white font-black text-green-700 focus:border-green-500 outline-none" />
          
          <button type="submit" disabled={isUploading} className={`md:col-span-2 text-white font-black py-5 rounded-2xl text-xl transition-all shadow-xl mt-4 ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-1 active:scale-95'}`}>
            SAVE PLAYER 🏏
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddPlayer;