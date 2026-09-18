import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/apiClient';

function SuperAdmin() {
  const [adminData, setAdminData] = useState([]);
  const [plans, setPlans] = useState([]); // 🌟 प्लान्स के लिए नया स्टेट
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('organizers'); // 🌟 Tabs: 'organizers' or 'plans'
  const navigate = useNavigate();

  // SaaS Control States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState({ plan: 'Basic', isActive: true, isLifetimeFree: false, maxDevicesAllowed: 1 });

  // Plan Edit States
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    price: 0,
    subtitle: '',
    teamLimit: 3,
    playerLimit: 50,
    canViewTeams: false,
    canPublicRegistration: false,
    canLiveScreen: true,
    canCustomFields: false,
    features: ''
  });

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return navigate('/auth');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [userRes, planRes] = await Promise.all([
        apiRequest({ method: 'get', path: '/api/admin/all-data', headers }),
        apiRequest({ method: 'get', path: '/api/plans' })
      ]);

      setAdminData(userRes.data);
      setPlans(planRes.data);
    } catch (error) {
      alert("🔒 Access Denied!");
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [navigate]);

  useEffect(() => {
    const refreshId = setInterval(() => {
      fetchData();
    }, 60000);
    return () => clearInterval(refreshId);
  }, []);

  // --- User Edit Logic ---
  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditForm({
      plan: user.plan || 'Basic',
      isActive: user.isActive !== undefined ? user.isActive : true,
      isLifetimeFree: user.isLifetimeFree || false,
      maxDevicesAllowed: user.maxDevicesAllowed || 1
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await apiRequest({
        method: 'put',
        path: `/api/admin/update-user/${selectedUser._id}`,
        data: editForm,
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("यूज़र सफलतापूर्वक अपडेट हो गया!");
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) { alert("अपडेट फेल!"); }
  };

  // --- Reset Devices Logic ---
  const handleResetDevices = async (userId) => {
    if (!window.confirm("क्या आप वाकई इस यूज़र के सभी डिवाइस क्लियर करना चाहते हैं?")) return;
    try {
      const token = localStorage.getItem('token');
      await apiRequest({
        method: 'put',
        path: `/api/admin/clear-devices/${userId}`,
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("डिवाइस क्लियर कर दिए गए!");
      fetchData();
    } catch (error) { alert("डिवाइस क्लियर करने में समस्या आई!"); }
  };

  // --- Force Logout Logic ---
  const handleForceLogout = async (userId) => {
    if (!window.confirm("क्या आप इस यूज़र को तुरंत सभी डिवाइसेस से लॉगआउट करना चाहते हैं?")) return;
    try {
      const token = localStorage.getItem('token');
      await apiRequest({
        method: 'put',
        path: `/api/admin/force-logout/${userId}`,
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("यूज़र को फोर्स-लॉगआउट कर दिया गया!");
      fetchData();
    } catch (error) { alert("फोर्स लॉगआउट फेल!"); }
  };

  // --- Impersonate Logic (Act as User) ---
  const handleImpersonate = async (user) => {
    const confirmAct = window.confirm(`⚠️ WARNING: You are about to log in as ${user.name} (${user.phone}).\n\nYou will temporarily view the system through their account. Do you wish to continue?`);
    if (!confirmAct) return;

    try {
      const currentToken = localStorage.getItem('token');
      if (!currentToken) {
        alert("Session expired. Please log in again.");
        return navigate('/auth');
      }

      // 🌟 Super Admin session backup
      const adminSessionData = {
        token: currentToken,
        organizerName: localStorage.getItem('organizerName') || 'Super Admin',
        organizerPhone: localStorage.getItem('organizerPhone') || '',
        organizerPlan: localStorage.getItem('organizerPlan') || 'Pro',
        organizerRole: localStorage.getItem('organizerRole') || 'SuperAdmin',
        organizerEmail: localStorage.getItem('organizerEmail') || ''
      };

      const res = await apiRequest({
        method: 'post',
        path: `/api/admin/impersonate/${user._id}`,
        headers: { Authorization: `Bearer ${currentToken}` }
      });

      // Store current admin session backup and target user info
      localStorage.setItem('superAdminSession', JSON.stringify(adminSessionData));
      localStorage.setItem('adminToken', currentToken);
      localStorage.setItem('impersonatingUser', res.data.user.name);
      localStorage.setItem('impersonatedUserId', user._id);
      localStorage.setItem('impersonatingRole', res.data.user.role || 'Organizer');
      localStorage.setItem('impersonatingPlan', res.data.user.plan || 'Basic');
      if (res.data.sessionId) {
        localStorage.setItem('impersonationSessionId', res.data.sessionId);
      }

      // Set the new impersonation token and target user identity
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('organizerName', res.data.user.name);
      localStorage.setItem('organizerPhone', res.data.user.phone || '');
      localStorage.setItem('organizerPlan', res.data.user.plan || 'Basic');
      localStorage.setItem('organizerRole', res.data.user.role || 'Organizer');
      localStorage.setItem('organizerEmail', res.data.user.email || '');

      // Reload and navigate to dashboard as the user
      window.location.href = '/dashboard';
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Failed to start impersonation!");
    }
  };

  // --- Plan Logic ---
  const openPlanModal = (plan) => {
    setSelectedPlan(plan);
    setPlanForm({
      name: plan.name,
      price: plan.price !== undefined ? plan.price : 0,
      subtitle: plan.subtitle || '',
      teamLimit: typeof plan.teamLimit === 'number' ? plan.teamLimit : 3,
      playerLimit: typeof plan.playerLimit === 'number' ? plan.playerLimit : 50,
      canViewTeams: Boolean(plan.canViewTeams),
      canPublicRegistration: Boolean(plan.canPublicRegistration),
      canLiveScreen: typeof plan.canLiveScreen === 'boolean' ? plan.canLiveScreen : true,
      canCustomFields: Boolean(plan.canCustomFields),
      features: Array.isArray(plan.features) ? plan.features.join(', ') : ''
    });
    setIsPlanModalOpen(true);
  };

  const handleUpdatePlan = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const updatedData = {
        price: Number(planForm.price),
        subtitle: planForm.subtitle,
        teamLimit: Number(planForm.teamLimit),
        playerLimit: Number(planForm.playerLimit),
        canViewTeams: Boolean(planForm.canViewTeams),
        canPublicRegistration: Boolean(planForm.canPublicRegistration),
        canLiveScreen: Boolean(planForm.canLiveScreen),
        canCustomFields: Boolean(planForm.canCustomFields),
        features: planForm.features.split(',').map(f => f.trim()).filter(Boolean)
      };

      await apiRequest({
        method: 'put',
        path: `/api/plans/${selectedPlan._id}`,
        data: updatedData,
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("💰 प्लान प्राइसिंग, लिमिट्स व फीचर टॉगल्स सफलतापूर्वक अपडेट हो गए!");
      setIsPlanModalOpen(false);
      fetchData();
    } catch (error) {
      alert(error?.response?.data?.message || "प्लान अपडेट फेल!");
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-2xl font-bold text-yellow-400">Loading Master Control... ⏳</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-gray-700 pb-4 gap-4">
          <h1 className="text-3xl font-black text-yellow-400 flex items-center">
            <span className="text-4xl mr-3">👑</span> Developer Panel
          </h1>
          <button onClick={() => navigate('/dashboard')} className="bg-gray-800 border border-gray-600 hover:bg-gray-700 px-5 py-2.5 rounded-xl font-bold text-sm transition">
            ⬅ Back to Dashboard
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-4 mb-8 bg-gray-800/60 p-2 rounded-2xl w-fit border border-gray-700">
          <button onClick={() => setActiveTab('organizers')} className={`px-6 py-2 rounded-lg font-bold transition ${activeTab === 'organizers' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>👥 Organizers Data</button>
          <button onClick={() => setActiveTab('plans')} className={`px-6 py-2 rounded-lg font-bold transition ${activeTab === 'plans' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>💰 Manage Plans & Features</button>
        </div>

        {/* Tab 1: User Management Table */}
        {activeTab === 'organizers' && (
          <div className="bg-gray-800 rounded-3xl shadow-2xl border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-750 border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wider font-extrabold">
                    <th className="p-4">Organizer</th>
                    <th className="p-4">Tournament</th>
                    <th className="p-4 text-center">Teams / Players</th>
                    <th className="p-4 text-center">Plan</th>
                    <th className="p-4 text-center">Devices</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700 text-sm">
                  {adminData.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-750/50 transition">
                      <td className="p-4">
                        <div className="font-bold text-white text-base">{user.name}</div>
                        <div className="text-gray-400 text-xs">{user.phone}</div>
                      </td>
                      <td className="p-4">
                        <span className="font-medium text-gray-200">{user.tournamentName}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-blue-400 font-bold">{user.totalTeams}</span> Teams / <span className="text-green-400 font-bold">{user.totalPlayers}</span> Players
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${user.plan === 'Pro' ? 'bg-purple-900/60 text-purple-300 border border-purple-500' : user.plan === 'Basic' ? 'bg-blue-900/60 text-blue-300 border border-blue-500' : 'bg-gray-700 text-gray-300'}`}>{user.plan}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-mono font-bold ${user.activeDevicesCount >= user.maxDevicesAllowed ? 'text-red-400' : 'text-green-400'}`}>{user.activeDevicesCount} / {user.maxDevicesAllowed}</span>
                      </td>
                      <td className="p-4 text-center">
                        {user.isActive ? (
                          <span className="text-xs bg-green-900/40 text-green-400 border border-green-700 px-2 py-0.5 rounded">Active</span>
                        ) : (
                          <span className="text-xs bg-red-900/40 text-red-400 border border-red-700 px-2 py-0.5 rounded">Blocked</span>
                        )}
                        {user.isLifetimeFree && <span className="ml-1 text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-700 px-2 py-0.5 rounded">Lifetime</span>}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button 
                            onClick={() => handleImpersonate(user)} 
                            title={`Act as ${user.name}`} 
                            className="bg-amber-600/30 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/50 p-2 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <span>🎭</span>
                            <span className="hidden sm:inline">Act as User</span>
                          </button>
                          <button onClick={() => openEditModal(user)} title="Edit Settings" className="bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/50 p-2 rounded-lg text-xs transition cursor-pointer">✏️</button>
                          <button onClick={() => handleResetDevices(user._id)} title="Clear Devices" className="bg-yellow-600/30 hover:bg-yellow-600 text-yellow-300 hover:text-white border border-yellow-500/50 p-2 rounded-lg text-xs transition cursor-pointer">📱</button>
                          <button onClick={() => handleForceLogout(user._id)} title="Force Logout" className="bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/50 p-2 rounded-lg text-xs transition cursor-pointer">🚪</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Plan Management */}
        {activeTab === 'plans' && (
          <div className="animate-in slide-in-from-bottom-4 duration-500 grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div key={plan._id} className="bg-gray-800 p-8 rounded-3xl border-2 border-gray-700 shadow-xl flex flex-col relative overflow-hidden group">
                <div className="absolute top-0 right-0 bg-purple-600 text-white px-4 py-1 rounded-bl-xl font-black text-xs uppercase tracking-tighter">Central Plan</div>
                <h3 className="text-2xl font-black text-white mb-1">{plan.name}</h3>
                <p className="text-gray-400 text-sm font-bold mb-4 min-h-[40px]">{plan.subtitle}</p>
                <div className="text-5xl font-black text-yellow-400 mb-6">₹{plan.price}</div>

                {/* Plan limits */}
                <div className="bg-gray-900/80 p-4 rounded-2xl border border-gray-700 mb-6 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-gray-300">
                    <span>🏏 Max Teams:</span>
                    <span className="text-yellow-400">{plan.teamLimit === -1 ? 'Unlimited (-1)' : `${plan.teamLimit} Teams`}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-gray-300">
                    <span>👥 Max Players:</span>
                    <span className="text-green-400">{plan.playerLimit === -1 ? 'Unlimited (-1)' : `${plan.playerLimit} Players`}</span>
                  </div>
                </div>

                {/* Feature Toggles Status Badges */}
                <div className="space-y-2.5 mb-8 flex-1">
                  <div className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-2">Feature Permissions:</div>
                  <div className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center justify-between ${plan.canViewTeams ? 'bg-green-900/30 text-green-300 border border-green-700/50' : 'bg-red-900/20 text-red-400 border border-red-800/40'}`}>
                    <span>📊 View Teams Dashboard</span>
                    <span>{plan.canViewTeams ? '✔ ENABLED' : '✖ DISABLED'}</span>
                  </div>
                  <div className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center justify-between ${plan.canPublicRegistration ? 'bg-green-900/30 text-green-300 border border-green-700/50' : 'bg-red-900/20 text-red-400 border border-red-800/40'}`}>
                    <span>🔗 Public Registration Link</span>
                    <span>{plan.canPublicRegistration ? '✔ ENABLED' : '✖ DISABLED'}</span>
                  </div>
                  <div className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center justify-between ${plan.canLiveScreen ? 'bg-green-900/30 text-green-300 border border-green-700/50' : 'bg-red-900/20 text-red-400 border border-red-800/40'}`}>
                    <span>📺 Live Projector / TV Screen</span>
                    <span>{plan.canLiveScreen ? '✔ ENABLED' : '✖ DISABLED'}</span>
                  </div>
                  <div className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center justify-between ${plan.canCustomFields ? 'bg-green-900/30 text-green-300 border border-green-700/50' : 'bg-red-900/20 text-red-400 border border-red-800/40'}`}>
                    <span>💳 Custom Fields & UPI QR</span>
                    <span>{plan.canCustomFields ? '✔ ENABLED' : '✖ DISABLED'}</span>
                  </div>
                </div>

                <button onClick={() => openPlanModal(plan)} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg group-hover:scale-105 cursor-pointer">
                  Edit Pricing, Limits & Toggles ✏️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Edit User */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-md border-t-8 border-yellow-500 shadow-2xl text-gray-800">
            <h2 className="text-2xl font-black mb-6 flex justify-between items-center">⚙️ Client Settings <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 cursor-pointer">&times;</button></h2>
            <form onSubmit={handleUpdateUser} className="space-y-5">
              <select value={editForm.plan} onChange={(e) => setEditForm({...editForm, plan: e.target.value})} className="w-full p-4 border-2 rounded-2xl font-bold bg-gray-50 outline-none focus:border-blue-500 transition-all">
                <option value="Free">Free Plan</option><option value="Basic">Basic Plan</option><option value="Pro">Pro Plan</option>
              </select>
              <input type="number" value={editForm.maxDevicesAllowed} onChange={(e) => setEditForm({...editForm, maxDevicesAllowed: e.target.value})} className="w-full p-4 border-2 rounded-2xl font-black text-blue-700 bg-gray-50 outline-none" placeholder="Max Devices" />
              <label className="flex items-center space-x-3 p-4 bg-red-50 rounded-2xl border-2 border-red-100 cursor-pointer">
                <input type="checkbox" checked={!editForm.isActive} onChange={(e) => setEditForm({...editForm, isActive: !e.target.checked})} className="w-5 h-5 accent-red-600" />
                <span className="font-bold text-red-900">Block Account 🚫</span>
              </label>
              <label className="flex items-center space-x-3 p-4 bg-green-50 rounded-2xl border-2 border-green-100 cursor-pointer">
                <input type="checkbox" checked={editForm.isLifetimeFree} onChange={(e) => setEditForm({...editForm, isLifetimeFree: e.target.checked})} className="w-5 h-5 accent-green-600" />
                <span className="font-bold text-green-900">Lifetime Free 🎁</span>
              </label>
              <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition-all cursor-pointer">Save Client Info</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Plan & Feature Toggles */}
      {isPlanModalOpen && selectedPlan && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md overflow-y-auto">
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] w-full max-w-xl border-t-8 border-purple-600 shadow-2xl text-gray-800 my-8">
            <h2 className="text-2xl font-black mb-4 flex justify-between items-center">
              <span>💰 Edit {selectedPlan.name} Plan</span>
              <button onClick={() => setIsPlanModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-3xl font-bold cursor-pointer">&times;</button>
            </h2>

            <form onSubmit={handleUpdatePlan} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase ml-1">Plan Price (₹)</label>
                  <input type="number" min="0" value={planForm.price} onChange={(e) => setPlanForm({...planForm, price: e.target.value})} className="w-full p-3.5 border-2 rounded-xl font-black text-purple-700 bg-gray-50 outline-none focus:border-purple-500" required />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase ml-1">Subtitle</label>
                  <input type="text" value={planForm.subtitle} onChange={(e) => setPlanForm({...planForm, subtitle: e.target.value})} className="w-full p-3.5 border-2 rounded-xl font-bold bg-gray-50 outline-none focus:border-purple-500" />
                </div>
              </div>

              {/* Limits Configuration */}
              <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200">
                <div className="text-xs font-black text-purple-900 uppercase tracking-wider mb-3">Plan Limits (-1 means Unlimited):</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700">Max Teams Allowed</label>
                    <input 
                      type="number" 
                      value={planForm.teamLimit} 
                      onChange={(e) => setPlanForm({...planForm, teamLimit: e.target.value})} 
                      className="w-full p-3 mt-1 border-2 rounded-xl font-bold bg-white outline-none focus:border-purple-500" 
                      placeholder="-1 for unlimited" 
                      required 
                    />
                    <span className="text-[10px] text-gray-500 font-medium">e.g. 3, 8, or -1 (unlimited)</span>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700">Max Players Allowed</label>
                    <input 
                      type="number" 
                      value={planForm.playerLimit} 
                      onChange={(e) => setPlanForm({...planForm, playerLimit: e.target.value})} 
                      className="w-full p-3 mt-1 border-2 rounded-xl font-bold bg-white outline-none focus:border-purple-500" 
                      placeholder="-1 for unlimited" 
                      required 
                    />
                    <span className="text-[10px] text-gray-500 font-medium">e.g. 50, 150, or -1 (unlimited)</span>
                  </div>
                </div>
              </div>

              {/* Feature-by-Feature ON/OFF Toggles */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                <div className="text-xs font-black text-gray-600 uppercase tracking-wider mb-1">Feature-by-Feature Toggles:</div>

                <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 shadow-xs cursor-pointer hover:border-purple-300 transition">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-800">📊 View Teams Dashboard</span>
                    <span className="text-xs text-gray-500">Allows viewing team rosters, purse balance & squads</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={planForm.canViewTeams} 
                    onChange={(e) => setPlanForm({...planForm, canViewTeams: e.target.checked})} 
                    className="w-5 h-5 accent-purple-600 cursor-pointer" 
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 shadow-xs cursor-pointer hover:border-purple-300 transition">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-800">🔗 Public Registration Link</span>
                    <span className="text-xs text-gray-500">Allows public players to register directly via link</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={planForm.canPublicRegistration} 
                    onChange={(e) => setPlanForm({...planForm, canPublicRegistration: e.target.checked})} 
                    className="w-5 h-5 accent-purple-600 cursor-pointer" 
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 shadow-xs cursor-pointer hover:border-purple-300 transition">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-800">📺 Live Projector / Audience Screen</span>
                    <span className="text-xs text-gray-500">Real-time TV screen sync for live bidding display</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={planForm.canLiveScreen} 
                    onChange={(e) => setPlanForm({...planForm, canLiveScreen: e.target.checked})} 
                    className="w-5 h-5 accent-purple-600 cursor-pointer" 
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 shadow-xs cursor-pointer hover:border-purple-300 transition">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-800">💳 Custom Fields & UPI QR</span>
                    <span className="text-xs text-gray-500">Enable custom tournament registration questions & fee QR</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={planForm.canCustomFields} 
                    onChange={(e) => setPlanForm({...planForm, canCustomFields: e.target.checked})} 
                    className="w-5 h-5 accent-purple-600 cursor-pointer" 
                  />
                </label>
              </div>

              <div>
                <label className="text-xs font-black text-gray-500 uppercase ml-1">Custom Bullet Features (Comma separated)</label>
                <textarea 
                  rows="2" 
                  value={planForm.features} 
                  onChange={(e) => setPlanForm({...planForm, features: e.target.value})} 
                  className="w-full p-3 border-2 rounded-xl font-medium bg-gray-50 outline-none focus:border-purple-500 text-sm"
                  placeholder="e.g. Priority Support, Offline Backups"
                ></textarea>
              </div>

              <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all cursor-pointer">
                Save & Update Live System 🚀
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default SuperAdmin;