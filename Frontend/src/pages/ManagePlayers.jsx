import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function ManagePlayers() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);

  // Modal States for ICON Player
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [iconTeam, setIconTeam] = useState('');
  const [iconPrice, setIconPrice] = useState(0);

  useEffect(() => {
    fetchPlayers();
    fetchTeams();
  }, []);

  const fetchPlayers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/players', { headers: { Authorization: `Bearer ${token}` } });
      setPlayers(response.data);
    } catch (error) { console.error(error); }
  };

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/teams', { headers: { Authorization: `Bearer ${token}` } });
      setTeams(response.data);
    } catch (error) { console.error(error); }
  };

  // 1. अप्रूवल (Approve / Reject)
  const handleApproval = async (id, status) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5000/api/players/approval/${id}`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      fetchPlayers();
    } catch (error) { alert("Error changing status"); }
  };

  // 2. बेस प्राइस एडिट (Blur होने पर सेव)
  const handlePriceUpdate = async (id, newPrice) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5000/api/players/update-price/${id}`, { basePrice: newPrice }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (error) { alert("Error updating price"); }
  };

  // 3. Delete Player
  const handleDelete = async (id, name) => {
    if (window.confirm(`क्या आप सच में '${name}' को डिलीट करना चाहते हैं?`)) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`http://localhost:5000/api/players/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        fetchPlayers();
      } catch (error) { alert("Delete failed"); }
    }
  };

  // 4. ICON प्लेयर बनाना
  const openIconModal = (player) => {
    setSelectedPlayer(player);
    setIconPrice(player.basePrice);
    setIsModalOpen(true);
  };

  const handleMakeIconSubmit = async (e) => {
    e.preventDefault();
    if (!iconTeam) { alert("Please select a team!"); return; }
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5000/api/players/make-icon/${selectedPlayer._id}`, 
        { teamName: iconTeam, iconPrice: iconPrice }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert(`⭐ ${selectedPlayer.name} is now an ICON player for ${iconTeam}!`);
      setIsModalOpen(false);
      fetchPlayers();
    } catch (error) { alert("Failed to assign Icon player."); }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto bg-white p-8 rounded-2xl shadow-xl border-t-8 border-indigo-600 relative">
        <div className="flex justify-between items-center mb-8">
          <div>
             <h2 className="text-3xl font-black text-gray-800">🛠️ Player Management</h2>
             <p className="text-gray-500 font-bold mt-1">Approve players, edit prices, or assign ICONs before auction.</p>
          </div>
          <button onClick={() => navigate('/dashboard')} className="bg-gray-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-700">⬅ Back</button>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-indigo-50 text-indigo-900 border-b-2 border-indigo-200">
                <th className="p-4 font-black">Player</th>
                <th className="p-4 font-black">Role / City</th>
                <th className="p-4 font-black w-32">Base Price (₹)</th>
                <th className="p-4 font-black text-center">Eligibility</th>
                <th className="p-4 font-black text-center">Status</th>
                <th className="p-4 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player._id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-4 flex items-center space-x-3">
                    <img src={player.photoUrl || 'https://via.placeholder.com/50'} alt="img" className="w-12 h-12 rounded-full object-cover border-2 shadow-sm" />
                    <div>
                        <p className="font-bold text-gray-800 text-lg">{player.name}</p>
                        {player.isIcon && <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded border border-yellow-300">⭐ ICON</span>}
                    </div>
                  </td>
                  <td className="p-4">
                     <p className="font-bold text-blue-700">{player.role}</p>
                     <p className="text-sm text-gray-500 font-medium">📍 {player.city || 'N/A'}</p>
                  </td>
                  <td className="p-4">
                     {/* 🌟 Editable Base Price 🌟 */}
                     <input 
                        type="number" 
                        defaultValue={player.basePrice}
                        onBlur={(e) => handlePriceUpdate(player._id, e.target.value)}
                        className="w-full p-2 border-2 rounded bg-white focus:border-indigo-500 outline-none font-bold text-green-700"
                        disabled={player.isIcon || player.auctionStatus === 'Sold'}
                     />
                  </td>
                  <td className="p-4 text-center">
                     {/* 🌟 Approval Buttons 🌟 */}
                     {player.approvalStatus === 'Pending' ? (
                        <div className="flex justify-center space-x-2">
                           <button onClick={() => handleApproval(player._id, 'Approved')} className="bg-green-100 text-green-700 border border-green-400 px-3 py-1 rounded font-bold hover:bg-green-200">✔ Approve</button>
                           <button onClick={() => handleApproval(player._id, 'Rejected')} className="bg-red-100 text-red-700 border border-red-400 px-3 py-1 rounded font-bold hover:bg-red-200">✖ Reject</button>
                        </div>
                     ) : (
                        <span className={`px-3 py-1 rounded font-bold text-sm ${player.approvalStatus === 'Approved' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                           {player.approvalStatus}
                        </span>
                     )}
                  </td>
                  <td className="p-4 text-center font-bold text-gray-600">
                      {player.auctionStatus} {player.soldTo !== 'Unsold' && `(${player.soldTo})`}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button 
                       onClick={() => openIconModal(player)} 
                       disabled={player.isIcon || player.auctionStatus === 'Sold'}
                       className="bg-yellow-400 text-yellow-900 px-3 py-2 rounded font-black hover:bg-yellow-500 shadow-sm disabled:opacity-30"
                    >
                      ⭐ Make ICON
                    </button>
                    <button onClick={() => handleDelete(player._id, player.name)} className="bg-gray-200 text-gray-600 px-3 py-2 rounded font-bold hover:bg-red-500 hover:text-white transition">
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🌟 ICON Player Modal 🌟 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-[400px] border-t-8 border-yellow-400">
            <h2 className="text-2xl font-black text-gray-800 mb-2">⭐ Assign ICON Player</h2>
            <p className="text-gray-600 font-bold mb-6">Assign <span className="text-blue-600">{selectedPlayer?.name}</span> directly to a team.</p>
            
            <form onSubmit={handleMakeIconSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Select Team</label>
                <select required value={iconTeam} onChange={(e) => setIconTeam(e.target.value)} className="w-full p-3 border-2 rounded-xl font-bold bg-gray-50">
                  <option value="">-- Choose Team --</option>
                  {teams.map(t => <option key={t._id} value={t.teamName}>{t.teamName} (Purse: ₹{t.remainingPurse})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Icon Price / Deduction (₹)</label>
                <input required type="number" value={iconPrice} onChange={(e) => setIconPrice(e.target.value)} className="w-full p-3 border-2 rounded-xl font-black text-green-600 bg-gray-50" />
                <p className="text-xs text-gray-400 mt-1">आप इसे 0 भी रख सकते हैं।</p>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-yellow-400 text-yellow-900 py-3 rounded-xl font-black shadow-lg">Assign ⭐</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManagePlayers;