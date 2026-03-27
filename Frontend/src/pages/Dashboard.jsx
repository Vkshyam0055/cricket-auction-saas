import React, { useState, useEffect, useContext } from 'react'; // useContext जोड़ा
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TournamentContext } from '../context/TournamentContext'; // 🌟 कांटेक्स्ट इम्पोर्ट

function Dashboard() {
  const navigate = useNavigate();
  const [totalTeams, setTotalTeams] = useState(0); 
  const [totalPlayers, setTotalPlayers] = useState(0); 
  
  // 🌟 ग्लोबल डब्बे से जानकारी निकालो
  const { tournament, loading } = useContext(TournamentContext);

  // 🌟 GATING LOGIC: अगर टूर्नामेंट नहीं है, तो तुरंत क्रिएट पेज पर भेज दो
  useEffect(() => {
    if (!loading && !tournament) {
      navigate('/create-tournament');
    }
  }, [tournament, loading, navigate]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const headers = { Authorization: `Bearer ${token}` };
        const teamsResponse = await axios.get('https://cricket-auction-backend-h8ud.onrender.com/api/teams', { headers });
        setTotalTeams(teamsResponse.data.length);
        const playersResponse = await axios.get('https://cricket-auction-backend-h8ud.onrender.com/api/players', { headers });
        setTotalPlayers(playersResponse.data.length);
      } catch (error) {
        console.error("डेटा लाने में दिक्कत:", error);
      }
    };
    
    // सिर्फ तभी डेटा लाओ जब टूर्नामेंट बना हुआ हो
    if (tournament) {
      fetchDashboardData();
    }
  }, [tournament]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/'); 
  };

  // जब तक ग्लोबल स्टेट चेक हो रही है, लोडिंग दिखाओ
  if (loading || !tournament) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center font-bold text-xl">Loading Dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-blue-800 p-4 text-white flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-3">
          {tournament.logoUrl && <img src={tournament.logoUrl} alt="Logo" className="w-8 h-8 rounded-full bg-white" />}
          <h1 className="text-2xl font-bold">🏏 {tournament.name} - Control Room</h1>
        </div>
        <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded hover:bg-red-600 font-bold transition-all shadow">
          Logout
        </button>
      </nav>

      <div className="p-8 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Welcome, Organizer!</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border-l-8 border-blue-500">
            <h3 className="text-gray-500 text-lg font-bold">Total Teams</h3>
            <p className="text-4xl font-extrabold text-blue-600 mt-2">{totalTeams}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border-l-8 border-green-500">
            <h3 className="text-gray-500 text-lg font-bold">Total Players</h3>
            <p className="text-4xl font-extrabold text-green-600 mt-2">{totalPlayers}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border-l-8 border-yellow-500">
            <h3 className="text-gray-500 text-lg font-bold">Auction Status</h3>
            <p className="text-2xl font-bold text-yellow-600 mt-2">Ready to Start 🚀</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-blue-800 mb-8">
          <h3 className="text-2xl font-black text-gray-800 mb-6 border-b pb-2">Main Auction Controls</h3>
          <div className="flex flex-col md:flex-row gap-6 justify-center">
            <button onClick={() => navigate('/control-panel')} className="flex-1 bg-blue-900 text-white px-8 py-6 rounded-xl font-black text-xl hover:bg-blue-800 shadow-xl transition-all border-2 border-blue-700">
              ⚙️ Open Auctioneer Panel<br/><span className="text-sm font-normal text-blue-300">(For Admin Only)</span>
            </button>
            <button onClick={() => navigate('/live')} className="flex-1 bg-purple-900 text-white px-8 py-6 rounded-xl font-black text-xl hover:bg-purple-800 shadow-xl transition-all border-2 border-purple-700">
              📺 Open Audience Display<br/><span className="text-sm font-normal text-purple-300">(For Projector/TV)</span>
            </button>
          </div>
        </div>

        <div className="bg-gray-200 p-6 rounded-xl shadow-inner text-center">
          <h3 className="text-lg font-bold text-gray-700 mb-4">Data Management & Settings</h3>
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={() => navigate('/create-tournament')} className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 shadow transition">
              🏆 Edit Tournament Info
            </button>
            <button onClick={() => navigate('/add-team')} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 shadow transition">
              + Add Team
            </button>
            <button onClick={() => navigate('/add-player')} className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 shadow transition">
              + Add Player
            </button>
            <button onClick={() => navigate('/teams')} className="bg-orange-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-600 shadow transition">
              📊 View Teams & Budgets
            </button>
            <button onClick={() => navigate('/manage-players')} className="bg-red-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-600 shadow transition">
              🛠️ Manage Players
            </button>
          </div>
          
          <div className="mt-6 p-3 bg-yellow-100 rounded-lg border border-yellow-300 text-center">
            <p className="text-yellow-800 font-bold">
              Public Registration Link: <span className="text-blue-600 underline">localhost:5173/register-player</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;