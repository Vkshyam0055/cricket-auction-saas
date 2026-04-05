import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TournamentContext } from '../context/TournamentContext';

function CreateTournament() {
  const navigate = useNavigate();
  const { tournament, fetchTournament } = useContext(TournamentContext);

  const [formData, setFormData] = useState({
    name: '',
    logoUrl: '',
    venue: '',
    bidButton1: 500,
    bidButton2: 1000,
    bidButton3: 5000
  });

  useEffect(() => {
    if (tournament) {
      setFormData({
        name: tournament.name || '',
        logoUrl: tournament.logoUrl || '',
        venue: tournament.venue || '',
        bidButton1: tournament.bidButton1 || 500,
        bidButton2: tournament.bidButton2 || 1000,
        bidButton3: tournament.bidButton3 || 5000
      });
    }
  }, [tournament]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.post('https://cricket-auction-backend-h8ud.onrender.com/api/tournament', formData, { headers });
      
      await fetchTournament(); 
      
      alert('🎉 टूर्नामेंट की जानकारी सफलतापूर्वक सेट हो गई!');
      navigate('/dashboard'); 
    } catch (error) {
      console.error(error);
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
              name="name" value={formData.name} onChange={handleChange} required 
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" 
              placeholder="e.g. Rajasthan Premier League" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-black text-gray-500 uppercase mb-2">Tournament Logo (URL)</label>
            <input 
              name="logoUrl" value={formData.logoUrl} onChange={handleChange} 
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" 
              placeholder="Paste image link here" 
            />
          </div>

          <div>
            <label className="block text-sm font-black text-gray-500 uppercase mb-2">Venue (Ground Name)</label>
            <input 
              name="venue" value={formData.venue} onChange={handleChange} 
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" 
              placeholder="e.g. SMS Stadium, Jaipur" 
            />
          </div>

          {/* 🌟 DYNAMIC BID BUTTONS SETUP 🌟 */}
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
            <label className="block text-sm font-black text-indigo-800 uppercase mb-3">Custom Bidding Buttons (₹)</label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-xs font-bold text-gray-500">Button 1</span>
                <input name="bidButton1" type="number" value={formData.bidButton1} onChange={handleChange} className="w-full p-2 mt-1 bg-white border border-gray-300 rounded-lg font-bold text-center" />
              </div>
              <div>
                <span className="text-xs font-bold text-gray-500">Button 2</span>
                <input name="bidButton2" type="number" value={formData.bidButton2} onChange={handleChange} className="w-full p-2 mt-1 bg-white border border-gray-300 rounded-lg font-bold text-center" />
              </div>
              <div>
                <span className="text-xs font-bold text-gray-500">Button 3</span>
                <input name="bidButton3" type="number" value={formData.bidButton3} onChange={handleChange} className="w-full p-2 mt-1 bg-white border border-gray-300 rounded-lg font-bold text-center" />
              </div>
            </div>
            <p className="text-xs text-indigo-500 font-bold mt-3 text-center">These values will be used on the Master Control Panel during live auction.</p>
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