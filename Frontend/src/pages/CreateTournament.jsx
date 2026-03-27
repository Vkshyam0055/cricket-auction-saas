import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TournamentContext } from '../context/TournamentContext'; // 🌟 इम्पोर्ट

function CreateTournament() {
  const navigate = useNavigate();
  const { tournament, fetchTournament } = useContext(TournamentContext); // 🌟 ग्लोबल डब्बा

  const [formData, setFormData] = useState({
    name: '',
    logoUrl: '',
    venue: ''
  });

  // अगर पहले से बना है तो डेटा भर दो
  useEffect(() => {
    if (tournament) {
      setFormData({
        name: tournament.name || '',
        logoUrl: tournament.logoUrl || '',
        venue: tournament.venue || ''
      });
    }
  }, [tournament]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await axios.post('https://cricket-auction-backend-h8ud.onrender.com/api/tournament', formData);
      
      // 🌟 गोडाउन में सेव होते ही ग्लोबल डब्बे को रिफ्रेश करो!
      await fetchTournament(); 
      
      alert('🎉 टूर्नामेंट की जानकारी सफलतापूर्वक सेट हो गई!');
      navigate('/dashboard'); // अब डैशबोर्ड खुल जाएगा
    } catch (error) {
      alert('सेव करने में कोई दिक्कत आई!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8 flex justify-center items-center">
      <div className="max-w-xl w-full bg-white p-8 rounded-3xl shadow-2xl border-t-8 border-indigo-600">
        <h2 className="text-3xl font-black text-gray-800 mb-2">🏆 {tournament ? 'Edit' : 'Setup New'} Tournament</h2>
        <p className="text-gray-500 font-bold mb-8 border-b pb-4">
          {tournament ? 'अपने टूर्नामेंट की जानकारी अपडेट करें।' : 'सिस्टम का उपयोग शुरू करने से पहले एक टूर्नामेंट बनाएं।'}
        </p>
        
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-black text-gray-500 uppercase mb-2">Tournament Name *</label>
            <input 
              name="name" 
              value={formData.name} 
              onChange={handleChange} 
              required 
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" 
              placeholder="e.g. Rajasthan Premier League" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-black text-gray-500 uppercase mb-2">Tournament Logo (URL)</label>
            <input 
              name="logoUrl" 
              value={formData.logoUrl} 
              onChange={handleChange} 
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" 
              placeholder="Paste image link here" 
            />
          </div>

          <div>
            <label className="block text-sm font-black text-gray-500 uppercase mb-2">Venue (Ground Name)</label>
            <input 
              name="venue" 
              value={formData.venue} 
              onChange={handleChange} 
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" 
              placeholder="e.g. SMS Stadium, Jaipur" 
            />
          </div>

          <div className="flex gap-4 pt-4">
            {tournament && (
              <button type="button" onClick={() => navigate('/dashboard')} className="flex-1 bg-gray-200 text-gray-700 font-black py-4 rounded-xl hover:bg-gray-300 transition-all">
                Cancel
              </button>
            )}
            <button type="submit" className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-indigo-700 transition-all hover:-translate-y-1">
              Save & Continue 🚀
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateTournament;