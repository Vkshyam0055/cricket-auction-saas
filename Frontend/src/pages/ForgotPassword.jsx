import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Clock } from 'lucide-react';
import { apiRequest } from '../utils/apiClient';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer for resend link cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cooldown > 0 || isLoading) return;

    setErrorMsg('');
    setSuccessMsg('');

    const trimmed = String(email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmed || !emailRegex.test(trimmed)) {
      setErrorMsg('कृपया एक मान्य ईमेल पता दर्ज करें (उदा. organizer@gmail.com)');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRequest({
        method: 'post',
        path: '/api/auth/forgot-password',
        data: { email: trimmed }
      });

      const message = response?.data?.message || 'यदि आपका ईमेल पंजीकृत है, तो पासवर्ड रीसेट लिंक भेज दिया गया है।';
      setSuccessMsg(message);
      setSubmittedEmail(trimmed);
      setCooldown(60); // 60 seconds cooldown to protect against spam
    } catch (err) {
      console.error('Forgot password submission error:', err);
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message;

      if (status === 429) {
        const retryAfter = err?.response?.data?.retryAfter || 60;
        setCooldown(retryAfter);
        setErrorMsg(serverMsg || 'बहुत अधिक अनुरोध भेजे गए हैं। कृपया कुछ समय बाद पुनः प्रयास करें।');
      } else {
        setErrorMsg(serverMsg || 'सर्वर से कनेक्ट नहीं हो सका। कृपया अपना इंटरनेट कनेक्शन जांचें और पुनः प्रयास करें।');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans text-slate-100">
      {/* Background ambient glowing orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-indigo-600/15 rounded-full blur-[90px] sm:blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-blue-600/15 rounded-full blur-[90px] sm:blur-[120px] pointer-events-none" />

      {/* Top Header Navigation */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between relative z-10 px-1">
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="inline-flex items-center text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5 transform group-hover:-translate-x-1 transition-transform" />
          <span>Back to Sign In</span>
        </button>
        <span className="text-[11px] sm:text-xs text-slate-500 font-medium inline-flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          SSL Encrypted
        </span>
      </div>

      {/* Main Glassmorphic Card */}
      <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 md:p-9 w-full max-w-md border border-slate-800 relative z-10">
        {/* Brand Logo & Header */}
        <div className="text-center mb-6">
          <img
            src="/branding/clm-dark-full.png"
            alt="CricLeagueManager"
            className="h-9 sm:h-11 w-auto mx-auto object-contain mb-3"
            onError={(e) => {
              // Graceful text fallback if image path ever differs
              e.target.style.display = 'none';
            }}
          />
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-1">
            Forgot Password? 🔐
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            अपना पंजीकृत ईमेल पता दर्ज करें। हम आपको पासवर्ड रीसेट करने का सुरक्षित लिंक भेजेंगे।
          </p>
        </div>

        {/* Success Confirmation State */}
        {successMsg ? (
          <div className="space-y-4">
            <div className="bg-emerald-950/50 border border-emerald-500/30 rounded-xl p-4 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-emerald-300">रीसेट लिंक भेज दिया गया है</h3>
                  <p className="text-xs text-emerald-100/90 leading-relaxed">
                    यदि <span className="font-semibold text-white underline">{submittedEmail}</span> हमारे पास पंजीकृत है, तो पासवर्ड रीसेट निर्देश आपके इनबॉक्स में भेज दिए गए हैं।
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold">
                <Clock className="w-4 h-4 shrink-0" />
                <span>ज़रूरी जानकारी:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] sm:text-xs">
                <li>यह लिंक <strong>20 मिनट</strong> के लिए मान्य रहेगा।</li>
                <li>यदि ईमेल इनबॉक्स में न दिखे, तो कृपया <strong>Spam / Junk फ़ोल्डर</strong> अवश्य देखें।</li>
                <li>सुरक्षा कारणों से प्रत्येक लिंक केवल एक बार उपयोग किया जा सकता है।</li>
              </ul>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={cooldown > 0 || isLoading}
                className="w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `पुनः भेजने के लिए प्रतीक्षा करें (${cooldown}s)` : 'रीसेट लिंक दोबारा भेजें ↻'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSuccessMsg('');
                  setEmail('');
                }}
                className="w-full py-2 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition"
              >
                दूसरा ईमेल पता आज़माएं
              </button>
            </div>
          </div>
        ) : (
          /* Input Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="bg-red-950/60 border border-red-500/40 rounded-xl p-3 flex items-start gap-2.5 text-red-200 text-xs">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label htmlFor="reset-email" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Registered Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="e.g. organizer@example.com"
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-white font-medium placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none transition-all duration-150 text-sm sm:text-base"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full py-3 sm:py-3.5 rounded-xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-600/25 active:scale-[0.99] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>भेजा जा रहा है...</span>
                </>
              ) : (
                <span>Send Reset Link ➔</span>
              )}
            </button>
          </form>
        )}

        {/* Footer Navigation Link */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <p className="text-slate-400 text-xs">
            पासवर्ड याद आ गया?{' '}
            <Link
              to="/auth"
              className="text-indigo-400 hover:text-indigo-300 font-bold underline underline-offset-4 transition ml-1"
            >
              यहाँ साइन इन करें
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
