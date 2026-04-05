import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function SuperAdmin() {
  const [adminData, setAdminData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return navigate('/auth');

        const headers = { Authorization: `Bearer ${token}` };
        
        // 🌟 FIX: वापस लाइव सर्वर (Render) का लिंक लगा दिया क्योंकि अब वह अपडेट हो चुका है 🌟
        const res = await axios.get('https://cricket-auction-backend-h8ud.onrender.com/api/admin/all-data', { headers });
        setAdminData(res.data);
      } catch (error) {
        console.error("Super Admin Error:", error);
        const errorMessage = error.response?.data?.message || "सर्वर से कनेक्ट नहीं हो पाया!";
        alert("🔒 Access Denied: " + errorMessage);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [navigate]);

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-2xl font-bold text-yellow-400">Loading Master Data... ⏳</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
          <h1 className="text-3xl font-black text-yellow-400 flex items-center">
            <span className="text-4xl mr-3">👑</span> Developer Dashboard
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

        <div className="bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-700 text-gray-300 text-sm uppercase tracking-wider">
                <th className="p-4 border-b border-gray-600">Organizer Name</th>
                <th className="p-4 border-b border-gray-600">Mobile No.</th>
                <th className="p-4 border-b border-gray-600">Tournament Name</th>
                <th className="p-4 border-b border-gray-600 text-center">Teams</th>
                <th className="p-4 border-b border-gray-600 text-center">Players</th>
                <th className="p-4 border-b border-gray-600">Joined On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {adminData.map((user, index) => (
                <tr key={index} className="hover:bg-gray-750 transition-colors">
                  <td className="p-4 font-bold text-white">{user.name}</td>
                  <td className="p-4 text-blue-400 font-semibold">{user.phone}</td>
                  <td className="p-4 text-yellow-300 font-bold">{user.tournamentName}</td>
                  <td className="p-4 text-center font-bold text-green-400">{user.totalTeams}</td>
                  <td className="p-4 text-center font-bold text-green-400">{user.totalPlayers}</td>
                  <td className="p-4 text-gray-400 text-sm">{new Date(user.registeredAt).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
              {adminData.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500 font-bold">No organizers found yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

export default SuperAdmin;