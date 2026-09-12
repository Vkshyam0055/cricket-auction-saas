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

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-200 selection:text-blue-900 overflow-x-hidden">
      
      {/* 🌟 NAVBAR 🌟 */}
      <nav className="fixed w-full top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm transition-all duration-300 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg transform hover:rotate-12 transition-transform duration-300">
            <span className="text-2xl">🏏</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            PRO<span className="text-blue-600 ml-1">AUCTION</span>
          </h1>
        </div>
        <button 
          onClick={() => navigate('/auth')} 
          className="bg-slate-900 text-white px-6 py-2.5 rounded-full font-bold text-sm tracking-wide hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/30 transform hover:-translate-y-0.5 transition-all duration-200"
        >
          Login / Register
        </button>
      </nav>

      {/* 🌟 HERO SECTION 🌟 */}
      <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900 via-slate-900 to-black text-white">
        {/* Animated Background Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-50 animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/20 rounded-full blur-[120px] opacity-30 pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-4 relative z-10 text-center">
          <div className="inline-block px-4 py-1.5 bg-blue-500/20 backdrop-blur-md rounded-full text-blue-200 font-semibold text-sm mb-8 border border-blue-400/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            🌟 India's #1 Multi-Tenant Auction Platform
          </div>

          <h2 className="text-5xl md:text-7xl font-black mb-8 leading-tight tracking-tight max-w-4xl mx-auto">
            Host Your Own <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-sm">IPL-Style</span> Cricket Auction
          </h2>

          <p className="text-lg md:text-xl text-blue-100/90 mb-12 font-medium max-w-2xl mx-auto leading-relaxed">
            भारत का सबसे एडवांस ऑक्शन प्लेटफॉर्म। अपनी क्रिकेट लीग बनाएं, टीमों का बजट सेट करें और रियल-टाइम लाइव बिडिंग का अनुभव लें।
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/auth')}
              className="w-full sm:w-auto bg-gradient-to-r from-yellow-400 to-yellow-500 text-slate-900 px-10 py-4 rounded-2xl font-black text-lg hover:from-yellow-300 hover:to-yellow-400 transition-all duration-300 shadow-[0_0_30px_rgba(250,204,21,0.4)] hover:shadow-[0_0_40px_rgba(250,204,21,0.6)] hover:-translate-y-1 flex items-center justify-center group"
            >
              Start Your Auction Now
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
            <button
              onClick={() => document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto bg-white/10 backdrop-blur-md text-white px-10 py-4 rounded-2xl font-bold text-lg hover:bg-white/20 transition-all duration-300 border border-white/20"
            >
              View Pricing
            </button>
          </div>
        </div>

        {/* Curved separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" className="w-full h-auto text-slate-50 fill-current preserve-3d" preserveAspectRatio="none">
            <path d="M0,60 C480,140 960,-20 1440,60 L1440,120 L0,120 Z"></path>
          </svg>
        </div>
      </div>

      {/* 🌟 FEATURES SECTION 🌟 */}
      <div className="py-24 px-4 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-3">Core Features</h3>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Why Choose Us?</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
          {/* Feature 1 */}
          <div className="bg-white p-10 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 hover:shadow-2xl hover:shadow-blue-900/10 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-[100px] -z-10 group-hover:bg-blue-100 transition-colors"></div>
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mb-8 shadow-inner">👥</div>
            <h4 className="text-2xl font-black text-slate-900 mb-4">Multi-Organizer System</h4>
            <p className="text-slate-600 font-medium leading-relaxed">आपका अपना प्राइवेट ऑक्शन पैनल। आपका डेटा किसी और को नहीं दिखेगा। 100% सुरक्षित और रिलायबल सिस्टम।</p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white p-10 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 hover:shadow-2xl hover:shadow-green-900/10 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-[100px] -z-10 group-hover:bg-emerald-100 transition-colors"></div>
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mb-8 shadow-inner">⚡</div>
            <h4 className="text-2xl font-black text-slate-900 mb-4">Real-Time TV Display</h4>
            <p className="text-slate-600 font-medium leading-relaxed">खिलाड़ी बिकते ही टीवी या प्रोजेक्टर पर लाइव अपडेट। बिल्कुल असली आईपीएल नीलामी जैसी प्रीमियम फील।</p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white p-10 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 hover:shadow-2xl hover:shadow-yellow-900/10 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-50 rounded-bl-[100px] -z-10 group-hover:bg-yellow-100 transition-colors"></div>
            <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-2xl flex items-center justify-center text-3xl mb-8 shadow-inner">💰</div>
            <h4 className="text-2xl font-black text-slate-900 mb-4">Auto Purse Management</h4>
            <p className="text-slate-600 font-medium leading-relaxed">बिड लगते ही टीम का बजट अपने-आप कट जाएगा। कैलकुलेटर की कोई ज़रूरत नहीं, सब कुछ ऑटोमैटिक।</p>
          </div>
        </div>
      </div>

      {/* 🌟 DYNAMIC PRICING SECTION 🌟 */}
      <div id="pricing" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-slate-900 transform -skew-y-3 origin-top-left z-0"></div>
        <div className="absolute inset-0 bg-slate-900 z-0"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-3">Pricing</h3>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">Simple & Transparent</h2>
            <p className="text-slate-400 font-medium text-lg max-w-2xl mx-auto">अपनी ज़रूरत के हिसाब से प्लान चुनें और तुरंत शुरू करें।</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
            {plans.map((plan) => (
              plan.isPopular ? (
                /* 🌟 Pro Plan (Highlighted) 🌟 */
                <div key={plan._id} className="bg-gradient-to-b from-blue-600 to-indigo-800 p-10 rounded-[2.5rem] shadow-2xl border border-blue-400/30 flex flex-col transform md:-translate-y-6 relative overflow-hidden ring-4 ring-blue-500/20">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl"></div>

                  <div className="absolute top-6 right-6">
                    <span className="bg-yellow-400 text-slate-900 text-xs font-black uppercase tracking-widest py-1.5 px-4 rounded-full shadow-lg">Most Popular</span>
                  </div>

                  <h4 className="text-3xl font-black text-white mb-2 mt-4">{plan.name}</h4>
                  <p className="text-blue-200 font-medium mb-8 min-h-[48px]">{plan.subtitle}</p>

                  <div className="flex items-baseline mb-8">
                    <span className="text-5xl font-black text-yellow-400">₹{plan.price}</span>
                    <span className="text-xl text-blue-200 font-medium ml-2">/tourney</span>
                  </div>

                  <div className="flex-1 bg-white/10 rounded-2xl p-6 mb-8 backdrop-blur-sm border border-white/10">
                    <ul className="space-y-4">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start text-white font-medium">
                          <svg className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button onClick={() => navigate('/auth')} className="w-full py-4 rounded-xl font-black text-slate-900 bg-yellow-400 hover:bg-yellow-300 shadow-[0_8px_20px_rgba(250,204,21,0.3)] hover:shadow-[0_12px_25px_rgba(250,204,21,0.5)] transition-all duration-300 hover:-translate-y-1 text-lg">
                    Get Started Now
                  </button>
                </div>
              ) : (
                /* 🌟 Free & Basic Plans 🌟 */
                <div key={plan._id} className="bg-white p-10 rounded-[2rem] shadow-xl border border-slate-100 flex flex-col h-full hover:shadow-2xl transition-shadow duration-300">
                  <h4 className="text-3xl font-black text-slate-900 mb-2">{plan.name}</h4>
                  <p className="text-slate-500 font-medium mb-8 min-h-[48px]">{plan.subtitle}</p>

                  <div className="flex items-baseline mb-8">
                    <span className="text-5xl font-black text-slate-900">₹{plan.price}</span>
                    <span className="text-xl text-slate-500 font-medium ml-2">/tourney</span>
                  </div>

                  <div className="flex-1 bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
                    <ul className="space-y-4">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start text-slate-700 font-medium">
                          <svg className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button onClick={() => navigate('/auth')} className="w-full py-4 rounded-xl font-bold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 transition-all duration-300 hover:-translate-y-1 text-lg">
                    Get Started
                  </button>
                </div>
              )
            ))}
          </div>
        </div>
      </div>

      {/* 🌟 CTA SECTION 🌟 */}
      <div className="py-20 px-4 bg-white border-t border-slate-100 text-center">
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-6">Ready to host your next big auction?</h2>
        <p className="text-slate-600 font-medium mb-8 max-w-2xl mx-auto text-lg">Join hundreds of organizers who are already using Pro Auction Portal to manage their cricket leagues.</p>
        <button onClick={() => navigate('/auth')} className="bg-slate-900 text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-blue-600 hover:shadow-xl hover:shadow-blue-500/20 transform hover:-translate-y-1 transition-all duration-300">
          Create Free Account Today
        </button>
      </div>

      {/* 🌟 FOOTER 🌟 */}
      <footer className="bg-slate-950 text-slate-400 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <span className="text-2xl opacity-80">🏏</span>
            <span className="font-black text-white text-xl tracking-tight">PRO AUCTION</span>
          </div>
          <div className="text-center md:text-right font-medium">
            <p>© {new Date().getFullYear()} Pro Auction Portal. All rights reserved.</p>
            <p className="text-sm mt-2 flex items-center justify-center md:justify-end">
              Made with <span className="text-red-500 mx-1 animate-pulse">❤️</span> for Cricket Lovers
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default LandingPage;