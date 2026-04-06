import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function SuperAdmin() {
  const [adminData, setAdminData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 🌟 SaaS Control States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState({ plan: 'Basic', isActive: true, isLifetimeFree: false, maxDevicesAllowed: 1 });

  const fetchAdminData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return navigate('/auth');
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.get('https://cricket-auction-backend-h8ud.onrender.com/api/admin/all-data', { headers });
      setAdminData(res.data);
    } catch (error) {
      alert("🔒 Access Denied!");
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [navigate]);

  // 🌟 Open Control Modal
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

  // 🌟 Update User Plan & Access
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`https://cricket-auction-backend-h8ud.onrender.com/api/admin/update-user/${selectedUser._id}`, 
        editForm, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`✅ ${selectedUser.name} का अकाउंट अपडेट हो गया!`);
      setIsEditModalOpen(false);
      fetchAdminData(); // Refresh Data
    } catch (error) {
      alert("एरर: डेटा अपडेट नहीं हो पाया।");
    }
  };

  // 🌟 Clear Stuck Devices
  const handleClearDevices = async () => {
    if(!window.confirm(`क्या आप ${selectedUser.name} के सभी लॉगिन डिवाइस क्लियर करना चाहते हैं?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`https://cricket-auction-backend-h8ud.onrender.com/api/admin/clear-devices/${selectedUser._id}`, 
        {}, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("🧹 डिवाइस क्लियर हो गए! अब यूज़र नए डिवाइस से लॉगिन कर सकता है।");
      fetchAdminData();
    } catch (error) {
      alert("एरर: डिवाइस क्लियर नहीं हुए।");
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-2xl font-bold text-yellow-400">Loading Master Data... ⏳</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
          <h1 className="text-3xl font-black text-yellow-400 flex items-center">
            <span className="text-4xl mr-3">👑</span> Developer Panel <span className="text-sm text-gray-400 ml-3 font-medium">(SaaS Control)</span>
          </h1>
          <button onClick={() => navigate('/dashboard')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition shadow-lg">
            Back to My Panel
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-800 p-6 rounded-xl border-t-4 border-blue-500 shadow-lg">
                <h3 className="text-gray-400 font-bold uppercase tracking-wider">Total Organizers</h3>
                <p className="text-4xl font-black text-white mt-2">{adminData.length}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-xl border-t-4 border-green-500 shadow-lg">
                <h3 className="text-gray-400 font-bold uppercase tracking-wider">Total Players in System</h3>
                <p className="text-4xl font-black text-white mt-2">{adminData.reduce((acc, curr) => acc + curr.totalPlayers, 0)}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-xl border-t-4 border-yellow-500 shadow-lg">
                <h3 className="text-gray-400 font-bold uppercase tracking-wider">Total Teams</h3>
                <p className="text-4xl font-black text-white mt-2">{adminData.reduce((acc, curr) => acc + curr.totalTeams, 0)}</p>
            </div>
        </div>

        <div className="bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-750 text-gray-400 text-xs uppercase tracking-widest border-b border-gray-600">
                  <th className="p-4 font-black">Organizer</th>
                  <th className="p-4 font-black">Tournament</th>
                  <th className="p-4 font-black text-center">Plan</th>
                  <th className="p-4 font-black text-center">Status</th>
                  <th className="p-4 font-black text-center">Devices</th>
                  <th className="p-4 font-black text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {adminData.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-700 transition-colors">
                    <td className="p-4">
                        <div className="font-black text-white text-lg">{user.name}</div>
                        <div className="text-blue-400 font-semibold text-sm">{user.phone}</div>
                    </td>
                    <td className="p-4">
                        <div className="text-yellow-400 font-black">{user.tournamentName}</div>
                        <div className="text-gray-500 text-xs font-bold">Teams: {user.totalTeams} | Players: {user.totalPlayers}</div>
                    </td>
                    <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded font-black text-xs uppercase ${user.plan === 'Premium' ? 'bg-purple-900 text-purple-300' : user.plan === 'Pro' ? 'bg-blue-900 text-blue-300' : 'bg-gray-600 text-gray-200'}`}>
                            {user.plan || 'Basic'}
                        </span>
                        {user.isLifetimeFree && <div className="text-[10px] text-green-400 font-bold mt-1 uppercase">Free Access</div>}
                    </td>
                    <td className="p-4 text-center">
                        {user.isActive === false ? (
                            <span className="bg-red-900 text-red-300 px-3 py-1 rounded font-bold text-xs uppercase">Blocked 🚫</span>
                        ) : (
                            <span className="bg-green-900 text-green-300 px-3 py-1 rounded font-bold text-xs uppercase">Active ✅</span>
                        )}
                    </td>
                    <td className="p-4 text-center">
                        <span className={`font-black text-sm ${user.activeDevicesCount >= user.maxDevicesAllowed ? 'text-red-400' : 'text-green-400'}`}>
                            {user.activeDevicesCount || 0} / {user.maxDevicesAllowed || 1}
                        </span>
                    </td>
                    <td className="p-4 text-center">
                        <button onClick={() => openEditModal(user)} className="bg-gray-600 hover:bg-yellow-500 hover:text-yellow-900 text-white px-4 py-2 rounded font-black transition-all shadow text-sm">
                            ⚙️ Control
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 🌟 USER CONTROL MODAL 🌟 */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md border-t-8 border-yellow-500 shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b pb-3">
                <h2 className="text-2xl font-black text-gray-800">⚙️ Client Control</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-red-500 font-black text-2xl">&times;</button>
            </div>
            
            <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p className="font-black text-xl text-blue-900">{selectedUser.name}</p>
                <p className="text-sm font-bold text-gray-500">{selectedUser.phone}</p>
            </div>
            
            <form onSubmit={handleUpdateUser} className="space-y-5">
              
              <div>
                <label className="block text-sm font-black text-gray-600 uppercase mb-1 tracking-wider">Subscription Plan</label>
                <select value={editForm.plan} onChange={(e) => setEditForm({...editForm, plan: e.target.value})} className="w-full p-3 border-2 border-gray-300 rounded-xl font-bold bg-white text-gray-800 focus:border-blue-500 outline-none">
                  <option value="Basic">Basic Plan</option>
                  <option value="Pro">Pro Plan</option>
                  <option value="Premium">Premium Plan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-600 uppercase mb-1 tracking-wider">Allowed Devices (Logins)</label>
                <input type="number" min="1" max="10" value={editForm.maxDevicesAllowed} onChange={(e) => setEditForm({...editForm, maxDevicesAllowed: e.target.value})} className="w-full p-3 border-2 border-gray-300 rounded-xl font-black text-blue-700 focus:border-blue-500 outline-none" />
              </div>

              <div className="space-y-3 pt-2">
                  <label className="flex items-center space-x-3 p-3 bg-red-50 rounded-xl border border-red-200 cursor-pointer hover:bg-red-100 transition">
                    <input type="checkbox" checked={!editForm.isActive} onChange={(e) => setEditForm({...editForm, isActive: !e.target.checked})} className="w-5 h-5 accent-red-600" />
                    <span className="font-bold text-red-900">Block this Account 🚫</span>
                  </label>

                  <label className="flex items-center space-x-3 p-3 bg-green-50 rounded-xl border border-green-200 cursor-pointer hover:bg-green-100 transition">
                    <input type="checkbox" checked={editForm.isLifetimeFree} onChange={(e) => setEditForm({...editForm, isLifetimeFree: e.target.checked})} className="w-5 h-5 accent-green-600" />
                    <span className="font-bold text-green-900">Grant Lifetime Free Access 🎁</span>
                  </label>
              </div>

              <div className="flex gap-4 pt-4 border-t mt-4">
                <button type="button" onClick={handleClearDevices} className="flex-1 bg-orange-100 text-orange-800 font-black py-3 rounded-xl border border-orange-300 hover:bg-orange-200 shadow-sm text-sm">
                  🧹 Clear Devices
                </button>
                <button type="submit" className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl hover:bg-blue-700 shadow-lg text-sm">
                  Save Changes ✔️
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default SuperAdmin;