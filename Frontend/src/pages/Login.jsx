import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_CANDIDATES = Array.from(new Set([
  import.meta.env.VITE_API_URL,
  'https://cricket-auction-backend-h8ud.onrender.com',
  'http://localhost:5000'
].filter(Boolean).map((url) => String(url).replace(/\/$/, ''))));

const postWithFallback = async (path, body) => {
  let lastError = null;
  for (const baseUrl of API_BASE_CANDIDATES) {
    const normalizedBase = String(baseUrl).replace(/\/$/, '');
    const normalizedPath = String(path || '').trim();
    const requestPath = normalizedBase.endsWith('/api') && normalizedPath.startsWith('/api/')
      ? normalizedPath.replace(/^\/api/, '')
      : normalizedPath;
    const requestUrl = `${normalizedBase}${requestPath}`;
    try {
      console.log('[Login] trying URL:', requestUrl);
      const response = await axios.post(requestUrl, body);
      localStorage.setItem('apiBaseUrl', normalizedBase);
      return response;
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      if (status && status < 500) {
        throw error;
      }
    }
  }
  throw lastError || new Error('No API base URL reachable');
};

function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate(); // यह हमें दूसरे पन्ने पर ले जाने का काम करेगा

  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
      // 1. डाकिया (Axios) बैकएंड के पास नंबर और पासवर्ड लेकर जा रहा है
      const response = await postWithFallback('/api/auth/login', {
        phone: phone,
        password: password
      });

      // 2. लॉगिन सफल! बैकएंड ने जो 'डिजिटल पास' (Token) दिया, उसे ब्राउज़र में सेव कर लो
      localStorage.setItem('token', response.data.token);
      
      // 3. आयोजक को सीधा डैशबोर्ड वाले कमरे (Page) में भेज दो
      navigate('/dashboard');
      
    } catch (error) {
      // अगर नंबर या पासवर्ड गलत हुआ, तो अलर्ट दिखाओ
      alert(error.response?.data?.message || 'लॉगिन में कोई दिक्कत आई है! क्या बैकएंड चालू है?');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-96 border-t-4 border-blue-800">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-blue-800">Login</h2>
          <p className="text-gray-500 text-sm mt-1">Rajasthan Cricket Auction Portal</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-gray-700 font-bold mb-1">Phone Number</label>
            <input 
              type="text" 
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-gray-700 font-bold mb-1">Password</label>
            <input 
              type="password" 
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-800 text-white font-bold py-2 rounded-lg hover:bg-blue-900 transition duration-300 shadow-md"
          >
            Login 🚀
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;