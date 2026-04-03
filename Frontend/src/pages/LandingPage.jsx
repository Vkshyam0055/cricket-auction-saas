import React from 'react';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      
      {/* 🌟 NAVBAR 🌟 */}
      <nav className="bg-white px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <span className="text-3xl">🏏</span>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">PRO AUCTION</h1>
        </div>
        <button 
          onClick={() => navigate('/auth')} 
          className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold hover:bg-blue-700 transition shadow-md"
        >
          Login / Register
        </button>
      </nav>

      {/* 🌟 HERO SECTION 🌟 */}
      <div className="bg-gradient-to-br from-blue-900 via-indigo-900 to-gray-900 text-white py-20 px-4 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500 rounded-full opacity-20 blur-3xl -ml-20 -mt-20"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500 rounded-full opacity-20 blur-3xl -mr-20 -mb-20"></div>
        
        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="text-5xl md:text-6xl font-black mb-6 leading-tight">
            Host Your Own <span className="text-yellow-400">IPL-Style</span> Cricket Auction
          </h2>
          <p className="text-lg md:text-xl text-blue-100 mb-10 font-medium max-w-2xl mx-auto">
            भारत का सबसे एडवांस Multi-Tenant ऑक्शन प्लेटफॉर्म। अपनी क्रिकेट लीग बनाएं, टीमों का बजट सेट करें और रियल-टाइम लाइव बिडिंग का अनुभव लें।
          </p>
          <button 
            onClick={() => navigate('/auth')} 
            className="bg-yellow-400 text-blue-900 px-10 py-4 rounded-full font-black text-xl hover:bg-yellow-300 transition shadow-[0_0_20px_rgba(250,204,21,0.5)] hover:-translate-y-1"
          >
            Start Your Auction Now 🚀
          </button>
        </div>
      </div>

      {/* 🌟 FEATURES SECTION 🌟 */}
      <div className="py-20 px-4 max-w-7xl mx-auto">
        <h3 className="text-3xl font-black text-center text-gray-800 mb-12 uppercase tracking-wider">Why Choose Us?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-2xl shadow-lg border-t-4 border-blue-500 hover:-translate-y-2 transition">
            <div className="text-5xl mb-4">👥</div>
            <h4 className="text-xl font-black text-gray-800 mb-2">Multi-Organizer System</h4>
            <p className="text-gray-600 font-medium">आपका अपना प्राइवेट ऑक्शन पैनल। आपका डेटा किसी और को नहीं दिखेगा। 100% सुरक्षित।</p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-lg border-t-4 border-green-500 hover:-translate-y-2 transition">
            <div className="text-5xl mb-4">⚡</div>
            <h4 className="text-xl font-black text-gray-800 mb-2">Real-Time TV Display</h4>
            <p className="text-gray-600 font-medium">खिलाड़ी बिकते ही टीवी/प्रोजेक्टर पर लाइव अपडेट। बिल्कुल असली आईपीएल नीलामी जैसी फील।</p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-lg border-t-4 border-yellow-500 hover:-translate-y-2 transition">
            <div className="text-5xl mb-4">💰</div>
            <h4 className="text-xl font-black text-gray-800 mb-2">Auto Purse Management</h4>
            <p className="text-gray-600 font-medium">बिड लगते ही टीम का बजट अपने-आप कट जाएगा। कैलकुलेटर की कोई ज़रूरत नहीं।</p>
          </div>
        </div>
      </div>

      {/* 🌟 PRICING SECTION 🌟 */}
      <div className="bg-gray-100 py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-3xl font-black text-center text-gray-800 mb-4 uppercase tracking-wider">Simple & Transparent Pricing</h3>
          <p className="text-center text-gray-500 font-bold mb-12">अपनी ज़रूरत के हिसाब से प्लान चुनें और तुरंत शुरू करें।</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            
            {/* Basic Plan */}
            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-200 flex flex-col">
              <h4 className="text-2xl font-black text-gray-800 mb-2">Basic</h4>
              <p className="text-gray-500 font-medium mb-6">छोटी लीग और क्लब्स के लिए</p>
              <div className="text-4xl font-black text-blue-600 mb-6">₹499 <span className="text-lg text-gray-400 font-medium">/tourney</span></div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center font-bold text-gray-700"><span className="mr-2 text-green-500">✔</span> Up to 50 Players</li>
                <li className="flex items-center font-bold text-gray-700"><span className="mr-2 text-green-500">✔</span> Unlimited Teams</li>
                <li className="flex items-center font-bold text-gray-700"><span className="mr-2 text-green-500">✔</span> Live Projector Screen</li>
              </ul>
              <button onClick={() => navigate('/auth')} className="w-full py-3 rounded-xl font-black text-blue-600 bg-blue-50 border-2 border-blue-200 hover:bg-blue-100 transition">Get Started</button>
            </div>

            {/* Pro Plan (Highlighted) */}
            <div className="bg-blue-900 p-8 rounded-3xl shadow-2xl border border-blue-700 flex flex-col transform md:-translate-y-4 relative">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -mt-4 bg-yellow-400 text-blue-900 px-4 py-1 rounded-full font-black text-sm uppercase tracking-wider">Most Popular</div>
              <h4 className="text-2xl font-black text-white mb-2">Pro</h4>
              <p className="text-blue-200 font-medium mb-6">प्रोफेशनल टूर्नामेंट्स के लिए</p>
              <div className="text-4xl font-black text-yellow-400 mb-6">₹999 <span className="text-lg text-blue-300 font-medium">/tourney</span></div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center font-bold text-white"><span className="mr-2 text-yellow-400">✔</span> Up to 200 Players</li>
                <li className="flex items-center font-bold text-white"><span className="mr-2 text-yellow-400">✔</span> Unlimited Teams</li>
                <li className="flex items-center font-bold text-white"><span className="mr-2 text-yellow-400">✔</span> Live Projector Screen</li>
                <li className="flex items-center font-bold text-white"><span className="mr-2 text-yellow-400">✔</span> Public Registration Link</li>
              </ul>
              <button onClick={() => navigate('/auth')} className="w-full py-3 rounded-xl font-black text-blue-900 bg-yellow-400 hover:bg-yellow-300 shadow-lg transition">Get Started</button>
            </div>

            {/* Premium Plan */}
            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-200 flex flex-col">
              <h4 className="text-2xl font-black text-gray-800 mb-2">Premium</h4>
              <p className="text-gray-500 font-medium mb-6">बड़ी लीग और अनलिमिटेड यूज़</p>
              <div className="text-4xl font-black text-purple-600 mb-6">₹1999 <span className="text-lg text-gray-400 font-medium">/tourney</span></div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center font-bold text-gray-700"><span className="mr-2 text-green-500">✔</span> Unlimited Players</li>
                <li className="flex items-center font-bold text-gray-700"><span className="mr-2 text-green-500">✔</span> Unlimited Teams</li>
                <li className="flex items-center font-bold text-gray-700"><span className="mr-2 text-green-500">✔</span> Custom Branding & Logo</li>
                <li className="flex items-center font-bold text-gray-700"><span className="mr-2 text-green-500">✔</span> Priority Support</li>
              </ul>
              <button onClick={() => navigate('/auth')} className="w-full py-3 rounded-xl font-black text-purple-600 bg-purple-50 border-2 border-purple-200 hover:bg-purple-100 transition">Get Started</button>
            </div>

          </div>
        </div>
      </div>

      {/* 🌟 FOOTER 🌟 */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center font-medium">
        <p>© 2026 Pro Auction Portal. All rights reserved.</p>
        <p className="text-sm mt-2">Made with ❤️ for Cricket Lovers</p>
      </footer>

    </div>
  );
}

export default LandingPage;