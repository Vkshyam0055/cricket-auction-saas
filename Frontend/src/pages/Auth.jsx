import React, { useState, useContext, useEffect } from 'react'; 
import { useNavigate } from 'react-router-dom';
import { TournamentContext } from '../context/TournamentContext'; 
import { apiRequest } from '../utils/apiClient';

function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  
  const { fetchTournament } = useContext(TournamentContext);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  // 🌟 ब्राउज़र के लिए एक यूनीक Device ID बनाना 
  useEffect(() => {
    if (!localStorage.getItem('deviceId')) {
      const uniqueId = 'device_' + Math.random().toString(36).substr(2, 10);
      localStorage.setItem('deviceId', uniqueId);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (isLogin) {
        const deviceId = localStorage.getItem('deviceId');
        const res = await apiRequest({ method: 'post', path: '/api/auth/login', data: { 
            phone, 
            password,
            deviceId 
        }});
        
        // 🌟 FEATURE LOCK LOGIC: यूज़र का प्लान और डेटा मेमोरी में सेव करें 🌟
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('organizerName', res.data.user.name);
        localStorage.setItem('organizerPhone', phone);
        localStorage.setItem('organizerPlan', res.data.user.plan || 'Basic'); // <-- नया कोड!
        localStorage.setItem('organizerRole', res.data.user.role || 'Organizer');
        localStorage.setItem('organizerEmail', res.data.user.email || '');
        if (res.data.requiresEmailUpdate) { navigate('/complete-profile-email'); return; }
        
        await fetchTournament();
        
        alert(`लॉगिन सफल! 🎉 स्वागत है ${res.data.user.name}`);
        navigate('/dashboard'); 
        
      } else {
        await apiRequest({ method: 'post', path: '/api/auth/register', data: { 
            name, 
            phone, 
            email, 
            password 
        }});
        
        alert("रजिस्ट्रेशन सफल रहा! ✅ कृपया अब अपने नंबर और पासवर्ड से लॉगिन करें।");
        setIsLogin(true); 
        setPassword(''); 
      }
    } catch (error) {
      alert("एरर: " + (error.response?.data?.message || "सर्वर से कनेक्ट नहीं हो पाया!"));
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900 via-slate-900 to-black flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(8,_112,_184,_0.7)] overflow-hidden flex flex-col md:flex-row w-full max-w-5xl ring-1 ring-white/10">

        {/* Left Side: Information */}
        <div className="w-full md:w-[45%] bg-gradient-to-br from-blue-600 to-indigo-800 p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden min-h-[400px]">
          {/* Decorative Elements */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse"></div>
          <div className="absolute top-1/2 -right-24 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute -bottom-24 left-1/4 w-64 h-64 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse" style={{ animationDelay: '4s' }}></div>
          
          <div className="relative z-10 flex flex-col h-full justify-center">
            <div>
              <div className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-blue-50 text-xs font-bold tracking-widest mb-6 border border-white/20 uppercase">
                Cricket Auction Platform
              </div>
              <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight tracking-tight">
                PRO <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500">AUCTION</span><br/>PORTAL
              </h1>
              <p className="text-base md:text-lg font-medium text-blue-100/90 mb-10 leading-relaxed max-w-md">
                भारत का सबसे बेहतरीन 'Multi-Tenant' क्रिकेट ऑक्शन सॉफ्टवेयर। अपनी खुद की लीग बनाएं और खिलाड़ियों की नीलामी करें।
              </p>
            </div>

            <div className="space-y-5">
              <div className="flex items-center space-x-4 bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10 transition-transform hover:-translate-y-1 duration-300">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-xl">🏏</span>
                </div>
                <span className="font-semibold text-white tracking-wide">Unlimited Players & Teams</span>
              </div>
              <div className="flex items-center space-x-4 bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10 transition-transform hover:-translate-y-1 duration-300">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-xl text-white">⚡</span>
                </div>
                <span className="font-semibold text-white tracking-wide">Real-time Live Bidding Screen</span>
              </div>
              <div className="flex items-center space-x-4 bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10 transition-transform hover:-translate-y-1 duration-300">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-xl">📊</span>
                </div>
                <span className="font-semibold text-white tracking-wide">Auto Budget & Purse Management</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full md:w-[55%] p-8 md:p-12 lg:p-16 bg-[#F8FAFC]">
          <div className="max-w-md mx-auto">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
              {isLogin ? 'Welcome Back 👋' : 'Create Account 🚀'}
            </h2>
            <p className="text-slate-500 font-medium mb-8 text-lg">
              {isLogin ? 'अपने डैशबोर्ड में जाने के लिए लॉगिन करें।' : 'अपना नया ऑक्शन पोर्टल शुरू करने के लिए रजिस्टर करें।'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
                  <input
                    type="text" required
                    placeholder="e.g. Vivek Meena"
                    className="w-full px-5 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none font-medium transition-all shadow-sm"
                    value={name} onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Mobile Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-slate-500 font-bold">+91</span>
                  </div>
                  <input
                    type="tel" required
                    placeholder="9876543210"
                    className="w-full pl-12 pr-5 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-lg tracking-wide transition-all shadow-sm"
                    value={phone} onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                  <input
                    type="email" required
                    placeholder="e.g. you@example.com"
                    className="w-full px-5 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none font-medium transition-all shadow-sm"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
                <input
                  type="password" required
                  placeholder="••••••••"
                  className="w-full px-5 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-lg tracking-widest transition-all shadow-sm"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
                {isLogin && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>

              <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg py-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 transform hover:-translate-y-0.5 transition-all duration-200 shadow-[0_8px_20px_rgb(37,99,235,0.3)] hover:shadow-[0_12px_25px_rgb(37,99,235,0.4)] mt-4">
                {isLogin ? 'Secure Login 🔒' : 'Create Account ✨'}
              </button>
            </form>

            <div className="mt-10 text-center">
              <p className="text-slate-600 font-medium">
                {isLogin ? "खाता नहीं है?" : "पहले से खाता है?"}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="ml-2 text-blue-600 hover:text-blue-800 font-bold underline decoration-2 underline-offset-4 transition-colors"
                >
                  {isLogin ? "नया अकाउंट बनाएं" : "यहाँ लॉगिन करें"}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Auth;
