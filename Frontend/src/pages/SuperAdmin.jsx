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
  const [planForm, setPlanForm] = useState({ name: '', price: 0, subtitle: '', features: '' });

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

  // --- Organizer Logic ---
  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditForm({
      plan: user.plan || 'Basic',
      isActive: user.isActive !== false,
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
      alert("✅ यूज़र अपडेट हो गया!");
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) { alert("अपडेट फेल!"); }
  };

  // --- Plan Logic ---
  const openPlanModal = (plan) => {
    setSelectedPlan(plan);
    setPlanForm({
      name: plan.name,
      price: plan.price,
      subtitle: plan.subtitle,
      features: plan.features.join(', ') // Array को String में बदलो
    });
    setIsPlanModalOpen(true);
  };

  const handleUpdatePlan = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const updatedData = {
        ...planForm,
        features: planForm.features.split(',').map(f => f.trim()) // String को वापस Array बनाओ
      };
      await apiRequest({
        method: 'put',
        path: `/api/plans/${selectedPlan._id}`,
        data: updatedData,
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("💰 प्लान प्राइसिंग अपडेट हो गई!");
      setIsPlanModalOpen(false);
      fetchData();
    } catch (error) { alert("प्लान अपडेट फेल!"); }
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
          <div className="flex bg-gray-800 p-1 rounded-xl border border-gray-700">
            <button onClick={() => setActiveTab('organizers')} className={`px-6 py-2 rounded-lg font-bold transition ${activeTab === 'organizers' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>👥 Organizers</button>
            <button onClick={() => setActiveTab('plans')} className={`px-6 py-2 rounded-lg font-bold transition ${activeTab === 'plans' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>💰 Manage Plans</button>
          </div>
          <button onClick={() => navigate('/dashboard')} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition border border-gray-500">Back to Dashboard</button>
        </div>

        {/* Tab 1: Organizer List */}
        {activeTab === 'organizers' && (
          <div className="animate-in fade-in duration-500">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-800 p-6 rounded-xl border-t-4 border-blue-500 shadow-lg">
                    <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs">Total Clients</h3>
                    <p className="text-4xl font-black text-white mt-2">{adminData.length}</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl border-t-4 border-green-500 shadow-lg">
                    <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs">Total Active Devices</h3>
                    <p className="text-4xl font-black text-white mt-2">{adminData.reduce((acc, curr) => acc + (curr.activeDevicesCount || 0), 0)}</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl border-t-4 border-yellow-500 shadow-lg">
                    <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs">Total Players Registered</h3>
                    <p className="text-4xl font-black text-white mt-2">{adminData.reduce((acc, curr) => acc + (curr.totalPlayers || 0), 0)}</p>
                </div>
            </div>

            <div className="bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-750 text-gray-400 text-xs uppercase tracking-widest border-b border-gray-600">
                    <th className="p-4 font-black">Organizer / Mobile</th>
                    <th className="p-4 font-black">Tournament</th>
                    <th className="p-4 font-black text-center">Plan</th>
                    <th className="p-4 font-black text-center">Status</th>
                    <th className="p-4 font-black text-center">Devices</th>
                    <th className="p-4 font-black text-center">Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {adminData.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-700 transition-colors">
                      <td className="p-4">
                          <div className="font-black text-white">{user.name}</div>
                          <div className="text-blue-400 text-sm font-bold">{user.phone}</div>
                      </td>
                      <td className="p-4">
                          <div className="text-yellow-400 font-black text-sm">{user.tournamentName}</div>
                      </td>
                      <td className="p-4 text-center">
                          <span className={`px-3 py-1 rounded font-black text-[10px] uppercase ${user.plan === 'Premium' ? 'bg-purple-900 text-purple-300' : user.plan === 'Pro' ? 'bg-blue-900 text-blue-300' : 'bg-gray-600 text-gray-200'}`}>
                              {user.plan || 'Basic'}
                          </span>
                      </td>
                      <td className="p-4 text-center">
                          {user.isActive === false ? <span className="text-red-500 font-bold">Blocked 🚫</span> : <span className="text-green-500 font-bold">Active ✅</span>}
                      </td>
                      <td className="p-4 text-center font-mono font-bold">
                          {user.activeDevicesCount} / {user.maxDevicesAllowed}
                      </td>
                      <td className="p-4 text-center">
                          <button onClick={() => openEditModal(user)} className="bg-gray-600 hover:bg-yellow-500 hover:text-yellow-900 p-2 rounded-lg transition-all">⚙️</button>
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
                <div className="absolute top-0 right-0 bg-purple-600 text-white px-4 py-1 rounded-bl-xl font-black text-xs uppercase tracking-tighter">Live Pricing</div>
                <h3 className="text-2xl font-black text-white mb-1">{plan.name}</h3>
                <p className="text-gray-400 text-sm font-bold mb-4">{plan.subtitle}</p>
                <div className="text-5xl font-black text-yellow-400 mb-6">₹{plan.price}</div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f, i) => <li key={i} className="text-gray-300 text-sm font-medium flex items-center"><span className="text-green-500 mr-2">✔</span> {f}</li>)}
                </ul>
                <button onClick={() => openPlanModal(plan)} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg group-hover:scale-105">
                  Edit Pricing & Features ✏️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Edit User (Same as before but with UI fixes) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-md border-t-8 border-yellow-500 shadow-2xl text-gray-800">
            <h2 className="text-2xl font-black mb-6 flex justify-between items-center">⚙️ Client Settings <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400">&times;</button></h2>
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
              <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition-all">Save Client Info</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Plan (New) */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-lg border-t-8 border-purple-600 shadow-2xl text-gray-800">
            <h2 className="text-2xl font-black mb-6 flex justify-between items-center">💰 Edit {selectedPlan.name} Plan <button onClick={() => setIsPlanModalOpen(false)} className="text-gray-400">&times;</button></h2>
            <form onSubmit={handleUpdatePlan} className="space-y-4">
              <div>
                <label className="text-xs font-black text-gray-400 uppercase ml-2">Plan Price (₹)</label>
                <input type="number" value={planForm.price} onChange={(e) => setPlanForm({...planForm, price: e.target.value})} className="w-full p-4 border-2 rounded-2xl font-black text-purple-700 bg-gray-50 outline-none" />
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 uppercase ml-2">Subtitle</label>
                <input type="text" value={planForm.subtitle} onChange={(e) => setPlanForm({...planForm, subtitle: e.target.value})} className="w-full p-4 border-2 rounded-2xl font-bold bg-gray-50 outline-none" />
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 uppercase ml-2">Features (Comma separated)</label>
                <textarea rows="4" value={planForm.features} onChange={(e) => setPlanForm({...planForm, features: e.target.value})} className="w-full p-4 border-2 rounded-2xl font-medium bg-gray-50 outline-none"></textarea>
              </div>
              <button type="submit" className="w-full bg-purple-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-purple-700 transition-all">Update Live Website</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default SuperAdmin;