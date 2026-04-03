import React, { useState, useContext } from 'react'; // 🌟 useContext जोड़ा गया
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TournamentContext } from '../context/TournamentContext'; // 🌟 ग्लोबल डब्बा इम्पोर्ट किया

function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  
  // 🌟 डब्बे में से fetchTournament फंक्शन निकाला 🌟
  const { fetchTournament } = useContext(TournamentContext);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (isLogin) {
        const res = await axios.post('https://cricket-auction-backend-h8ud.onrender.com/api/auth/login', { 
            phone, 
            password 
        });
        
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('organizerName', res.data.user.name);
        
        // 🌟 FIX: लॉगिन होते ही बैकएंड से तुरंत टूर्नामेंट का डेटा मंगाओ 🌟
        await fetchTournament();
        
        alert(`लॉगिन सफल! 🎉 स्वागत है ${res.data.user.name}`);
        navigate('/dashboard'); 
        
      } else {
        await axios.post('https://cricket-auction-backend-h8ud.onrender.com/api/auth/register', { 
            name, 
            phone, 
            password 
        });
        
        alert("रजिस्ट्रेशन सफल रहा! ✅ कृपया अब अपने नंबर और पासवर्ड से लॉगिन करें।");
        setIsLogin(true); 
        setPassword(''); 
      }
    } catch (error) {
      alert("एरर: " + (error.response?.data?.message || "सर्वर से कनेक्ट नहीं हो पाया!"));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row w-full max-w-4xl">
        
        <div className="bg-blue-600 w-full md:w-1/2 p-10 text-white flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-blue-500 rounded-full opacity-50 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-indigo-500 rounded-full opacity-50 blur-2xl"></div>
          
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
              PRO AUCTION <span className="text-yellow-400">PORTAL</span>
            </h1>
            <p className="text-lg md:text-xl font-medium text-blue-100 mb-8">
              भारत का सबसे बेहतरीन 'Multi-Tenant' क्रिकेट ऑक्शन सॉफ्टवेयर। अपनी खुद की लीग बनाएं और खिलाड़ियों की नीलामी करें।
            </p>
            <div className="space-y-4">
               <div className="flex items-center space-x-3">
                  <span className="bg-blue-500 p-2 rounded-full">✅</span>
                  <span className="font-bold">Unlimited Players & Teams</span>
               </div>
               <div className="flex items-center space-x-3">
                  <span className="bg-blue-500 p-2 rounded-full">⚡</span>
                  <span className="font-bold">Real-time Live Bidding Screen</span>
               </div>
               <div className="flex items-center space-x-3">
                  <span className="bg-blue-500 p-2 rounded-full">📊</span>
                  <span className="font-bold">Auto Budget & Purse Management</span>
               </div>
            </div>
          </div>
        </div>

        <div className="w-full md:w-1/2 p-10 md:p-12 bg-white">
          <h2 className="text-3xl font-black text-gray-800 mb-2">
            {isLogin ? 'Welcome Back! 👋' : 'Create Organizer Account 🚀'}
          </h2>
          <p className="text-gray-500 font-bold mb-8">
            {isLogin ? 'अपने डैशबोर्ड में जाने के लिए लॉगिन करें।' : 'अपना नया ऑक्शन पोर्टल शुरू करने के लिए रजिस्टर करें।'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label>
                <input 
                  type="text" required 
                  placeholder="e.g. Vivek Meena"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-0 outline-none font-semibold transition"
                  value={name} onChange={(e) => setName(e.target.value)} 
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Mobile Number</label>
              <input 
                type="tel" required 
                placeholder="e.g. 9876543210"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-0 outline-none font-bold text-lg tracking-wider transition"
                value={phone} onChange={(e) => setPhone(e.target.value)} 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
              <input 
                type="password" required 
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-0 outline-none font-bold text-lg tracking-widest transition"
                value={password} onChange={(e) => setPassword(e.target.value)} 
              />
            </div>

            <button type="submit" className="w-full bg-blue-600 text-white font-black text-lg py-4 rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg hover:shadow-xl mt-4">
              {isLogin ? 'Secure Login 🔒' : 'Create Account ✨'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-600 font-bold">
              {isLogin ? "खाता नहीं है?" : "पहले से खाता है?"}
              <button 
                onClick={() => setIsLogin(!isLogin)} 
                className="ml-2 text-blue-600 hover:text-blue-800 font-black underline decoration-2 underline-offset-4 transition"
              >
                {isLogin ? "नया अकाउंट बनाएं" : "यहाँ लॉगिन करें"}
              </button>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Auth;