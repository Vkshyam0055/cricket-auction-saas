import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/apiClient';

function LandingPage() {
  const navigate = useNavigate();
  
  // 🌟 PLANS STATE: Local cache first to prevent first-login pricing mismatch
  const [plans, setPlans] = useState(() => {
    try {
      const cached = localStorage.getItem('cricauction_plans_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore parse errors
    }
    return [];
  });
  const [loadingPlans, setLoadingPlans] = useState(() => {
    try {
      const cached = localStorage.getItem('cricauction_plans_cache');
      if (cached && JSON.parse(cached)?.length > 0) return false;
    } catch {}
    return true;
  });

  // 🌟 डेटाबेस से लाइव प्लान्स मंगाना (Single Source of Truth)
  useEffect(() => {
    let isMounted = true;
    const fetchPlans = async () => {
      try {
        const res = await apiRequest({ method: 'get', path: '/api/plans' });
        if (isMounted && res.data && res.data.length > 0) {
          setPlans(res.data);
          localStorage.setItem('cricauction_plans_cache', JSON.stringify(res.data));
        }
      } catch (error) {
        console.warn("लाइव प्लान्स लाने में देरी हो रही है, कैशे का इस्तेमाल कर रहे हैं।");
      } finally {
        if (isMounted) setLoadingPlans(false);
      }
    };
    fetchPlans();
    return () => { isMounted = false; };
  }, []);

  const getDynamicPlanFeatures = (plan) => {
    const list = [];
    list.push(plan.teamLimit === -1 ? 'Unlimited Teams' : `Up to ${plan.teamLimit} Teams`);
    list.push(plan.playerLimit === -1 ? 'Unlimited Players Pool' : `Up to ${plan.playerLimit} Players Pool`);

    if (plan.canViewTeams) list.push('Team Rosters & Purse Tracking');
    if (plan.canPublicRegistration) list.push('Public Player Self-Registration Link');
    if (plan.canLiveScreen) list.push('Live Projector & Audience Screen');
    if (plan.canCustomFields) list.push('Custom Registration Fields & UPI QR');

    if (Array.isArray(plan.features)) {
      for (const f of plan.features) {
        const trimmed = String(f || '').trim();
        if (!trimmed) continue;
        const isDuplicate = list.some((item) => item.toLowerCase() === trimmed.toLowerCase());
        if (!isDuplicate) list.push(trimmed);
      }
    }
    return list;
  };

  const scrollToPricing = () => {
    const el = document.getElementById('pricing');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      {/* 🌟 NAVBAR 🌟 */}
      <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
          <div className="flex items-center cursor-pointer min-w-0" onClick={() => navigate('/')}>
            <img
              src="/branding/clm-header-horizontal.png"
              alt="CricLeagueManager"
              className="h-[26px] sm:h-9 md:h-10 w-auto object-contain shrink-0"
            />
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-4 shrink-0">
            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 px-2 py-1.5 sm:px-3 sm:py-2 transition"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="relative group overflow-hidden rounded-xl p-px font-bold text-xs sm:text-sm shadow-md shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:-translate-y-0.5"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 rounded-xl"></span>
              <span className="relative block px-2.5 py-1.5 sm:px-5 sm:py-2.5 rounded-[11px] bg-indigo-600 text-white transition duration-200 group-hover:bg-opacity-90 whitespace-nowrap">
                Get Started Free →
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* 🌟 HERO SECTION 🌟 */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white pt-14 pb-20 sm:pt-24 sm:pb-28 px-4 sm:px-6 lg:px-8">
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[600px] h-[250px] sm:h-[350px] bg-indigo-600/20 rounded-full blur-[100px] sm:blur-[120px] pointer-events-none"></div>
        <div className="absolute top-10 left-5 w-48 sm:w-72 h-48 sm:h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-10 right-5 w-56 sm:w-80 h-56 sm:h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs sm:text-sm font-bold mb-6 sm:mb-8 shadow-xs max-w-full text-center">
            <span>⚡ Next-Gen Multi-Tenant Cricket Auction Platform</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight sm:leading-[1.1] mb-5 sm:mb-6 text-white">
            Host Your Own{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 drop-shadow-[0_4px_20px_rgba(251,191,36,0.35)]">
              IPL-Style
            </span>{' '}
            Cricket Auction
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-slate-100 mb-8 sm:mb-10 max-w-3xl mx-auto font-medium leading-relaxed px-1 sm:px-0">
            भारत का सबसे भरोसेमंद और आधुनिक ऑक्शन प्लेटफ़ॉर्म। अपनी कस्टम लीग बनाएं, टीमों के लिए लाइव बजट सेट करें और
            रियल-टाइम टीवी स्क्रीन पर आईपीएल जैसी धमाकेदार बिडिंग का मज़ा लें।
          </p>

          {/* CTA Buttons - Stacked on Mobile */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto max-w-md mx-auto mb-12 sm:mb-16">
            <button
              onClick={() => navigate('/auth')}
              className="w-full sm:w-auto inline-flex items-center justify-center px-7 sm:px-9 py-3.5 sm:py-4 rounded-xl font-black text-base sm:text-lg bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-[0_0_30px_rgba(251,191,36,0.4)] hover:shadow-[0_0_40px_rgba(251,191,36,0.55)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              <span>Start Your Auction Now</span>
              <span className="ml-2">🚀</span>
            </button>
          </div>

          {/* SaaS Key Highlights Bar - High Contrast 2x2 on Mobile, 4-col on Desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto pt-6 sm:pt-8 border-t border-slate-800 text-left">
            <div className="p-3.5 sm:p-4 bg-slate-900/80 rounded-2xl border border-slate-700/80 shadow-xs">
              <div className="text-2xl sm:text-3xl font-black text-amber-400 mb-1">0ms</div>
              <div className="text-xs sm:text-sm text-slate-200 font-semibold leading-snug">Real-Time Socket Bidding</div>
            </div>
            <div className="p-3.5 sm:p-4 bg-slate-900/80 rounded-2xl border border-slate-700/80 shadow-xs">
              <div className="text-2xl sm:text-3xl font-black text-indigo-300 mb-1">100%</div>
              <div className="text-xs sm:text-sm text-slate-200 font-semibold leading-snug">Auto Purse Calculation</div>
            </div>
            <div className="p-3.5 sm:p-4 bg-slate-900/80 rounded-2xl border border-slate-700/80 shadow-xs">
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 mb-1">HD Screen</div>
              <div className="text-xs sm:text-sm text-slate-200 font-semibold leading-snug">Projector / TV Ready</div>
            </div>
            <div className="p-3.5 sm:p-4 bg-slate-900/80 rounded-2xl border border-slate-700/80 shadow-xs">
              <div className="text-2xl sm:text-3xl font-black text-purple-300 mb-1">Private</div>
              <div className="text-xs sm:text-sm text-slate-200 font-semibold leading-snug">Isolated Tenant Security</div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 FEATURES SECTION 🌟 */}
      <div className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3.5 py-1 rounded-full border border-indigo-200 shadow-2xs">
            ENTERPRISE-GRADE CAPABILITIES
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 mt-3 sm:mt-4 tracking-tight">
            Designed for Flawless Auction Experience
          </h2>
          <p className="mt-3 text-slate-600 text-sm sm:text-base font-medium">
            Everything you need to organize, manage, and broadcast your sports tournament auction smoothly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Card 1 */}
          <div className="group relative bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 w-full">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl sm:text-2xl mb-5 sm:mb-6 border border-blue-100 group-hover:scale-105 transition-transform shadow-xs">
              <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 sm:mb-3">Multi-Organizer Isolation</h3>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
              आपका अपना पूरी तरह सुरक्षित और प्राइवेट ऑक्शन पैनल। आपकी टीमों, बिड्स और खिलाड़ियों का डेटा किसी अन्य आयोजक को नहीं दिखता।
            </p>
          </div>

          {/* Card 2 */}
          <div className="group relative bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 w-full">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl sm:text-2xl mb-5 sm:mb-6 border border-indigo-100 group-hover:scale-105 transition-transform shadow-xs">
              <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 sm:mb-3">Real-Time Projector Display</h3>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
              खिलाड़ी की बोली लगते ही टीवी या प्रोजेक्टर स्क्रीन पर इंस्टेंट अपडेट। साउंड इफ़ेक्ट्स और सोल्ड एनिमेशन के साथ असली आईपीएल नीलामी की अनुभूति।
            </p>
          </div>

          {/* Card 3 */}
          <div className="group relative bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 w-full">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl sm:text-2xl mb-5 sm:mb-6 border border-amber-100 group-hover:scale-105 transition-transform shadow-xs">
              <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 sm:mb-3">Auto Purse Ledger</h3>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
              बिड फाइनल होते ही संबंधित टीम का पर्स अपने-आप अपडेट हो जाता है। मैन्युअल कैलकुलेशन या हिसाब में कोई गलती होने की संभावना नहीं।
            </p>
          </div>
        </div>
      </div>


      {/* 🌟 CONTACT & SUPPORT SECTION 🌟 */}
      <div className="bg-slate-900 text-white py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-5xl mx-auto text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-3.5 py-1 rounded-full border border-amber-400/20">
            DIRECT ORGANIZER SUPPORT
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-white mt-4 mb-2 tracking-tight">
            Need Help or Custom Tournament Setup?
          </h3>
          <p className="text-slate-300 text-sm sm:text-base font-medium max-w-2xl mx-auto mb-10">
            Have questions about multi-tenant leagues, offline screens, or team limits? Our dedicated team is available to assist you.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-2xl mx-auto">
            {/* Phone Support */}
            <a
              href="tel:9414900809"
              className="flex items-center space-x-4 p-5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-400/50 shadow-md hover:shadow-lg transition-all duration-200 group text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-400/15 text-amber-400 flex items-center justify-center text-2xl border border-amber-400/30 shrink-0 group-hover:scale-105 transition-transform">
                📞
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Call & WhatsApp Support</span>
                <span className="text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition">
                  +91 9414900809
                </span>
              </div>
            </a>

            {/* Email Support */}
            <a
              href="mailto:cricauction.support@gmail.com"
              className="flex items-center space-x-4 p-5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-400/50 shadow-md hover:shadow-lg transition-all duration-200 group text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-2xl border border-indigo-500/30 shrink-0 group-hover:scale-105 transition-transform">
                ✉️
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Official Email Support</span>
                <span className="text-sm sm:text-base font-black text-white group-hover:text-indigo-300 transition truncate block">
                  cricauction.support@gmail.com
                </span>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* 🌟 FOOTER 🌟 */}
      <footer className="bg-slate-950 text-slate-400 py-10 sm:py-12 px-4 border-t border-slate-800/80 text-center font-medium">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <div
            className="flex items-center justify-center mb-3.5 cursor-pointer opacity-95 hover:opacity-100 transition-opacity"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="Back to top"
          >
            <img
              src="/branding/clm-dark-full.png"
              alt="CricLeagueManager"
              className="h-12 sm:h-14 md:h-16 w-auto object-contain"
            />
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mb-1.5">© {new Date().getFullYear()} CricLeagueManager. All rights reserved.</p>
          <p className="text-xs text-slate-500">Built with precision for cricket organizers, clubs & tournaments</p>
        </div>
      </footer>

    </div>
  );
}

export default LandingPage;