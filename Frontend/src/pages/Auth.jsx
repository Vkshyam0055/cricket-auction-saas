import React, { useState, useContext, useEffect } from 'react'; 
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { TournamentContext } from '../context/TournamentContext'; 
import { apiRequest } from '../utils/apiClient';

function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const { fetchTournament } = useContext(TournamentContext);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validation rules consistent with Reset Password guide
  const isLengthValid = password.length >= 6;
  const isMatch = Boolean(password && confirmPassword && password === confirmPassword);
  const isRegisterFormInvalid = !isLogin && (!isLengthValid || !isMatch);

  // 🌟 ब्राउज़र के लिए एक यूनीक Device ID बनाना 
  useEffect(() => {
    if (!localStorage.getItem('deviceId')) {
      const uniqueId = 'device_' + Math.random().toString(36).substr(2, 10);
      localStorage.setItem('deviceId', uniqueId);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLogin && isLoading) return;
    
    try {
      if (isLogin) {
        setIsLoading(true);
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
        localStorage.setItem('organizerPlan', res.data.user.plan || 'Free');
        localStorage.setItem('organizerRole', res.data.user.role || 'Organizer');
        localStorage.setItem('organizerEmail', res.data.user.email || '');
        if (res.data.requiresEmailUpdate) { navigate('/complete-profile-email'); return; }
        
        await fetchTournament();
        
        alert(`लॉगिन सफल! 🎉 स्वागत है ${res.data.user.name}`);
        navigate('/dashboard'); 
        
      } else {
        if (password.length < 6) {
          alert("एरर: पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।");
          return;
        }
        if (password !== confirmPassword) {
          alert("एरर: पासवर्ड और कन्फर्म पासवर्ड मेल नहीं खा रहे हैं।");
          return;
        }

        await apiRequest({ method: 'post', path: '/api/auth/register', data: { 
            name, 
            phone, 
            email, 
            password 
        }});
        
        alert("रजिस्ट्रेशन सफल रहा! ✅ कृपया अब अपने नंबर और पासवर्ड से लॉगिन करें।");
        setIsLogin(true); 
        setPassword(''); 
        setConfirmPassword('');
        setShowPassword(false); 
        setShowConfirmPassword(false);
      }
    } catch (error) {
      alert("एरर: " + (error.response?.data?.message || "सर्वर से कनेक्ट नहीं हो पाया!"));
    } finally {
      if (isLogin) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-3 sm:p-6 lg:p-8 relative overflow-hidden font-sans">
      {/* Background ambient orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-indigo-600/15 rounded-full blur-[90px] sm:blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-blue-600/15 rounded-full blur-[90px] sm:blur-[120px] pointer-events-none"></div>

      {/* Back to Home Link */}
      <div className="w-full max-w-4xl mb-3 sm:mb-4 flex items-center justify-between relative z-10 px-1 sm:px-0">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition group"
        >
          <span className="mr-1.5 transform group-hover:-translate-x-1 transition-transform">←</span>
          <span>Back to Home</span>
        </button>
        <span className="text-[11px] sm:text-xs text-slate-500 font-medium hidden sm:inline-block">Secure SSL Encrypted Session</span>
      </div>

      {/* Main Split-Screen Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row w-full max-w-4xl border border-slate-800/20 relative z-10">
        
        {/* Left Showcase Panel - Condensed on Mobile to prevent long scrolling */}
        <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 w-full md:w-5/12 p-4 sm:p-8 md:p-10 text-white flex flex-col justify-between relative overflow-hidden border-b md:border-b-0 md:border-r border-slate-800">
          {/* Subtle decorative circles */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-blue-500/20 rounded-full blur-2xl pointer-events-none"></div>

          <div className="relative z-10">
            {/* Header / Logo */}
            <div className="mb-2 md:mb-6">
              <img
                src="/branding/clm-dark-full.png"
                alt="CricLeagueManager"
                className="h-10 sm:h-12 w-auto object-contain"
              />
            </div>

            {/* Compact Mobile Tagline */}
            <p className="text-xs text-slate-300 md:hidden font-medium">
              IPL-Style Real-Time Cricket Auction Software
            </p>

            {/* Desktop-Only Expanded Features & Description */}
            <div className="hidden md:block">
              <h1 className="text-2xl sm:text-3xl font-black mb-3 tracking-tight leading-snug">
                Elevate Your League to <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-400">IPL Grandeur</span>
              </h1>
              <p className="text-sm text-slate-300 mb-8 leading-relaxed font-normal">
                भारत का सबसे आधुनिक ऑक्शन सॉफ्टवेयर। अपनी खुद की लीग बनाएं, लाइव प्रोजेक्ट स्क्रीन चलाएं और रियल-टाइम नीलामी का संचालन करें।
              </p>

              <div className="space-y-4">
                <div className="flex items-center space-x-3 text-sm font-medium text-slate-200">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 text-xs font-bold border border-indigo-500/30">
                    ✓
                  </div>
                  <span>Unlimited Teams & Custom Squads</span>
                </div>
                <div className="flex items-center space-x-3 text-sm font-medium text-slate-200">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 text-xs font-bold border border-emerald-500/30">
                    ✓
                  </div>
                  <span>Real-Time Projector & TV Display</span>
                </div>
                <div className="flex items-center space-x-3 text-sm font-medium text-slate-200">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 text-xs font-bold border border-amber-500/30">
                    ✓
                  </div>
                  <span>Auto Purse Ledger & Budget Sync</span>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop-Only Review Badge */}
          <div className="relative z-10 mt-8 pt-6 border-t border-white/10 hidden md:block">
            <div className="flex items-center space-x-1 text-amber-400 text-xs mb-1">
              <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
              <span className="text-slate-400 text-xs ml-2 font-semibold">4.9 / 5.0</span>
            </div>
            <p className="text-xs text-slate-300 font-medium">Trusted by tournament organizers across 50+ cities</p>
          </div>
        </div>

        {/* Right Form Panel - Immediately visible on mobile */}
        <div className="w-full md:w-7/12 p-5 sm:p-8 lg:p-12 bg-white flex flex-col justify-center">
          {/* Tab Switcher */}
          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 mb-5 sm:mb-6 md:mb-8">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setShowPassword(false);
                setShowConfirmPassword(false);
                setIsLoading(false);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                isLogin
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 font-semibold'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setShowPassword(false);
                setShowConfirmPassword(false);
                setIsLoading(false);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                !isLogin
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 font-semibold'
              }`}
            >
              Register
            </button>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-1">
              {isLogin ? 'Welcome Back! 👋' : 'Create Organizer Account 🚀'}
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm font-medium mb-5 sm:mb-6">
              {isLogin
                ? 'डैशबोर्ड में जाने के लिए अपना मोबाइल नंबर और पासवर्ड दर्ज करें।'
                : 'अपना नया ऑक्शन पोर्टल सेटअप करने के लिए त्वरित रजिस्ट्रेशन करें।'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
            {!isLogin && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="e.g. Vivek Meena"
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all duration-200 text-sm sm:text-base"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-phone" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Mobile Number
              </label>
              <input
                id="auth-phone"
                type="tel"
                required
                autoComplete="tel"
                placeholder="e.g. 9876543210"
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all duration-200 text-sm sm:text-base"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="auth-email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="e.g. you@example.com"
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all duration-200 text-sm sm:text-base"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="auth-password" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Password
                </label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition underline underline-offset-2 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className={`w-full pl-3.5 sm:pl-4 pr-11 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all duration-200 text-sm sm:text-base ${showPassword ? 'tracking-normal' : 'tracking-widest'}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  tabIndex={0}
                  onClick={() => setShowPassword(prev => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 focus:outline-none focus:text-indigo-600 transition cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <Eye className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="auth-confirm-password" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="auth-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={`w-full pl-3.5 sm:pl-4 pr-11 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all duration-200 text-sm sm:text-base ${showConfirmPassword ? 'tracking-normal' : 'tracking-widest'}`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={() => setShowConfirmPassword(prev => !prev)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 focus:outline-none focus:text-indigo-600 transition cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <Eye className="w-5 h-5" aria-hidden="true" />
                    )}
                  </button>
                </div>

                {confirmPassword && (
                  <p className={`mt-1.5 text-[11px] font-semibold flex items-center gap-1 ${isMatch ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isMatch ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>पासवर्ड मेल खा रहे हैं</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>पासवर्ड मेल नहीं खा रहे हैं</span>
                      </>
                    )}
                  </p>
                )}
              </div>
            )}

            {!isLogin && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px] text-slate-500 space-y-1">
                <div className={`flex items-center gap-1.5 ${isLengthValid ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>
                  <span>{isLengthValid ? '✓' : '○'}</span>
                  <span>कम से कम 6 अक्षर लंबा</span>
                </div>
                <div className={`flex items-center gap-1.5 ${isMatch ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>
                  <span>{isMatch ? '✓' : '○'}</span>
                  <span>दोनों पासवर्ड समान हों</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLogin ? isLoading : isRegisterFormInvalid}
              className="w-full py-3 sm:py-3.5 rounded-xl font-black text-sm sm:text-base text-white bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 active:scale-[0.99] transition-all duration-200 mt-2 sm:mt-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {isLogin ? (
                isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                    <span>Logging in...</span>
                  </>
                ) : (
                  <span>Login</span>
                )
              ) : (
                'Create Account ✨'
              )}
            </button>
          </form>

          {/* Toggle Login/Register footer */}
          <div className="mt-5 sm:mt-6 text-center">
            <p className="text-slate-600 text-xs sm:text-sm font-semibold">
              {isLogin ? 'खाता नहीं है?' : 'पहले से खाता है?'}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                  setIsLoading(false);
                }}
                className="ml-1.5 sm:ml-2 text-indigo-600 hover:text-indigo-800 font-black underline underline-offset-4 transition"
              >
                {isLogin ? 'नया अकाउंट बनाएं' : 'यहाँ लॉगिन करें'}
              </button>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Auth;
