import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/apiClient';

function LandingPage() {
  const navigate = useNavigate();
  
  // 🌟 स्मार्ट फॉलबैक: जब तक बैकएंड से डेटा नहीं आता, तब तक डिफ़ॉल्ट दिखेगा
  const [plans, setPlans] = useState([
    { _id: '1', name: 'Free', price: 0, subtitle: 'शुरुआती ट्रायल और छोटे ऑक्शन के लिए', features: ['Up to 3 Teams', 'Manual Player Entry', 'No Public Registration Link'] },
    { _id: '2', name: 'Basic', price: 499, subtitle: 'छोटी लीग और क्लब्स के लिए', features: ['Up to 8 Teams', 'Live Projector Screen', 'View Teams Enabled'] },
    { _id: '3', name: 'Pro', price: 999, subtitle: 'प्रोफेशनल टूर्नामेंट्स के लिए', isPopular: true, features: ['Unlimited Teams', 'Live Projector Screen', 'Public Registration Link'] }
  ]);

  // 🌟 डेटाबेस से लाइव प्लान्स मंगाना
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await apiRequest({ method: 'get', path: '/api/plans' });
        if (res.data && res.data.length > 0) {
          setPlans(res.data);
        }
      } catch (error) {
        console.log("लाइव प्लान्स लाने में देरी हो रही है, फॉलबैक का इस्तेमाल कर रहे हैं।");
      }
    };
    fetchPlans();
  }, []);

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-amber-400 p-0.5 shadow-md shadow-indigo-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[9px] sm:rounded-[14px] flex items-center justify-center text-base sm:text-xl">
                🏏
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900">PRO AUCTION</span>
                <span className="text-[9px] sm:text-[10px] uppercase font-extrabold tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  SaaS 2.0
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">Real-Time Cricket Auction Portal</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              onClick={scrollToPricing}
              className="hidden sm:inline-flex text-sm font-bold text-slate-600 hover:text-indigo-600 transition px-3 py-2"
            >
              Pricing
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 px-2.5 py-1.5 sm:px-3 sm:py-2 transition"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="relative group overflow-hidden rounded-xl p-px font-bold text-xs sm:text-sm shadow-md shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:-translate-y-0.5"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 rounded-xl"></span>
              <span className="relative block px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-[11px] bg-indigo-600 text-white transition duration-200 group-hover:bg-opacity-90">
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
            <button
              onClick={scrollToPricing}
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 sm:py-4 rounded-xl font-bold text-sm sm:text-base text-white bg-slate-800/90 hover:bg-slate-800 border border-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5"
            >
              View Pricing & Plans
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

      {/* 🌟 DYNAMIC PRICING SECTION 🌟 */}
      <div id="pricing" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-slate-100/70 border-t border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3.5 py-1 rounded-full border border-indigo-200 shadow-2xs">
              TRANSPARENT PLANS
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 mt-3 sm:mt-4 tracking-tight">
              Simple & Predictable Pricing
            </h2>
            <p className="mt-3 text-slate-600 text-sm sm:text-base font-medium">
              अपनी लीग के आकार और आवश्यकताओं के अनुसार सही प्लान चुनें और तुरंत शुरू करें।
            </p>
          </div>

          {/* Pricing Grid - Single Column on Mobile */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto items-stretch">
            {plans.map((plan) =>
              plan.isPopular ? (
                /* 🌟 Pro Plan (High-Contrast Dark Spotlight) 🌟 */
                <div
                  key={plan._id}
                  className="relative rounded-2xl bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 lg:p-10 shadow-2xl border-2 border-amber-400 flex flex-col justify-between transform md:-translate-y-2 lg:-translate-y-4 hover:md:-translate-y-3 hover:lg:-translate-y-5 transition-all duration-300 w-full"
                >
                  {/* Highlight pill */}
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 px-4 py-1 rounded-full font-black text-xs uppercase tracking-wider shadow-lg flex items-center space-x-1 whitespace-nowrap">
                    <span>★</span>
                    <span>Most Popular</span>
                  </div>

                  <div>
                    <div className="flex justify-between items-baseline mb-3">
                      <h3 className="text-2xl font-black tracking-tight text-white">{plan.name}</h3>
                      <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40">
                        Recommended
                      </span>
                    </div>

                    <p className="text-slate-200 text-sm font-medium mb-6 min-h-[36px]">{plan.subtitle}</p>

                    <div className="flex items-baseline mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-white/15">
                      <span className="text-4xl sm:text-5xl font-black text-amber-400">₹{plan.price}</span>
                      <span className="text-slate-300 text-xs sm:text-sm font-medium ml-2">/ tournament</span>
                    </div>

                    <ul className="space-y-3.5 mb-8">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start text-sm font-semibold text-slate-100">
                          <svg className="w-5 h-5 text-amber-400 mr-3 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => navigate('/auth')}
                    className="w-full py-3.5 sm:py-4 rounded-xl font-black text-sm sm:text-base text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                  >
                    Get Started with Pro ⚡
                  </button>
                </div>
              ) : (
                /* 🌟 Standard Plans (High-Contrast Clean White Cards) 🌟 */
                <div
                  key={plan._id}
                  className="rounded-2xl bg-white p-6 sm:p-8 lg:p-10 shadow-sm hover:shadow-md border border-slate-200 hover:border-slate-300 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 w-full"
                >
                  <div>
                    <h3 className="text-2xl font-black tracking-tight text-slate-900 mb-2">{plan.name}</h3>
                    <p className="text-slate-600 text-sm font-medium mb-6 min-h-[36px]">{plan.subtitle}</p>

                    <div className="flex items-baseline mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-slate-100">
                      <span className="text-4xl sm:text-5xl font-black text-slate-900">₹{plan.price}</span>
                      <span className="text-slate-600 text-xs sm:text-sm font-semibold ml-2">/ tournament</span>
                    </div>

                    <ul className="space-y-3.5 mb-8">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start text-sm font-semibold text-slate-800">
                          <svg className="w-5 h-5 text-emerald-600 mr-3 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => navigate('/auth')}
                    className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-slate-900 hover:bg-slate-800 active:scale-[0.99] shadow-sm hover:shadow transition-all duration-200"
                  >
                    Choose {plan.name}
                  </button>
                </div>
              )
            )}
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
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center space-x-2 mb-3">
            <span className="text-xl sm:text-2xl">🏏</span>
            <span className="text-base sm:text-lg font-black text-white tracking-tight">PRO AUCTION</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mb-1.5">© {new Date().getFullYear()} Pro Auction Portal. All rights reserved.</p>
          <p className="text-xs text-slate-500">Built with precision for cricket organizers, clubs & tournaments</p>
        </div>
      </footer>

    </div>
  );
}

export default LandingPage;