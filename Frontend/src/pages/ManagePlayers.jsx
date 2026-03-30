import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function ManagePlayers() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);

  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [iconTeam, setIconTeam] = useState('');
  const [iconPrice, setIconPrice] = useState(0);

  const [editFormData, setEditFormData] = useState({ auctionStatus: 'Pending', isIcon: false, soldTo: '', soldPrice: 0 });

  useEffect(() => {
    fetchPlayers();
    fetchTeams();
  }, []);

  const fetchPlayers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('https://cricket-auction-backend-h8ud.onrender.com/api/players', { headers: { Authorization: `Bearer ${token}` } });
      setPlayers(response.data);
    } catch (error) { console.error(error); }
  };

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('https://cricket-auction-backend-h8ud.onrender.com/api/teams', { headers: { Authorization: `Bearer ${token}` } });
      setTeams(response.data);
    } catch (error) { console.error(error); }
  };

  const handleApproval = async (id, status) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`https://cricket-auction-backend-h8ud.onrender.com/api/players/approval/${id}`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      fetchPlayers();
    } catch (error) { alert("Error changing status"); }
  };

  const handlePriceUpdate = async (id, newPrice) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`https://cricket-auction-backend-h8ud.onrender.com/api/players/update-price/${id}`, { basePrice: newPrice }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (error) { alert("Error updating price"); }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`क्या आप सच में '${name}' को डिलीट करना चाहते हैं?`)) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`https://cricket-auction-backend-h8ud.onrender.com/api/players/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        fetchPlayers();
      } catch (error) { alert("Delete failed"); }
    }
  };

  const openIconModal = (player) => {
    setSelectedPlayer(player);
    setIconPrice(player.basePrice);
    setIsIconModalOpen(true);
  };

  const handleMakeIconSubmit = async (e) => {
    e.preventDefault();
    if (!iconTeam) { alert("Please select a team!"); return; }
    try {
      const token = localStorage.getItem('token');
      await axios.put(`https://cricket-auction-backend-h8ud.onrender.com/api/players/make-icon/${selectedPlayer._id}`, 
        { teamName: iconTeam, iconPrice: iconPrice }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`⭐ ${selectedPlayer.name} is now an ICON player for ${iconTeam}!`);
      setIsIconModalOpen(false);
      fetchPlayers();
    } catch (error) { alert("Failed to assign Icon player."); }
  };

  const openMasterEditModal = (player) => {
    setSelectedPlayer(player);
    setEditFormData({
      auctionStatus: player.auctionStatus || 'Pending',
      isIcon: player.isIcon || false,
      soldTo: player.soldTo !== 'Unsold' ? player.soldTo : '',
      soldPrice: player.soldPrice || 0
    });
    setIsEditModalOpen(true);
  };

  const handleMasterEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`https://cricket-auction-backend-h8ud.onrender.com/api/players/${selectedPlayer._id}`, 
        editFormData, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`✅ ${selectedPlayer.name} का डेटा सफलतापूर्वक बदल गया है!`);
      setIsEditModalOpen(false);
      fetchPlayers();
    } catch (error) { 
      alert("डेटा अपडेट नहीं हुआ! (शायद बैकएंड में API नहीं है)"); 
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto bg-white p-8 rounded-2xl shadow-xl border-t-8 border-indigo-600 relative">
        <div className="flex justify-between items-center mb-8">
          <div>
             <h2 className="text-3xl font-black text-gray-800">🛠️ Player Management</h2>
             <p className="text-gray-500 font-bold mt-1">Approve players, edit status, or assign ICONs.</p>
          </div>
          <button onClick={() => navigate('/dashboard')} className="bg-gray-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-700">⬅ Back</button>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-indigo-50 text-indigo-900 border-b-2 border-indigo-200">
                <th className="p-4 font-black">Player</th>
                <th className="p-4 font-black">Role / City</th>
                <th className="p-4 font-black w-32">Base Price</th>
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
                     <input type="number" defaultValue={player.basePrice} onBlur={(e) => handlePriceUpdate(player._id, e.target.value)} className="w-full p-2 border-2 rounded bg-white focus:border-indigo-500 outline-none font-bold text-green-700" disabled={player.isIcon || player.auctionStatus === 'Sold'} />
                  </td>
                  <td className="p-4 text-center">
                     {player.approvalStatus === 'Pending' ? (
                        <div className="flex justify-center space-x-2">
                           <button onClick={() => handleApproval(player._id, 'Approved')} className="bg-green-100 text-green-700 border border-green-400 px-3 py-1 rounded font-bold hover:bg-green-200">✔</button>
                           <button onClick={() => handleApproval(player._id, 'Rejected')} className="bg-red-100 text-red-700 border border-red-400 px-3 py-1 rounded font-bold hover:bg-red-200">✖</button>
                        </div>
                     ) : (
                        <div className="flex flex-col items-center">
                           <span className={`px-3 py-1 rounded font-bold text-xs ${player.approvalStatus === 'Approved' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>{player.approvalStatus}</span>
                           <span className="font-bold text-gray-600 text-sm mt-1">{player.auctionStatus} {player.soldTo && player.soldTo !== 'Unsold' && `(${player.soldTo})`}</span>
                        </div>
                     )}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button onClick={() => openIconModal(player)} disabled={player.isIcon || player.auctionStatus === 'Sold'} className="bg-yellow-400 text-yellow-900 px-2 py-2 rounded font-black hover:bg-yellow-500 shadow-sm disabled:opacity-30" title="Make ICON">⭐</button>
                    <button onClick={() => openMasterEditModal(player)} className="bg-blue-100 text-blue-700 border border-blue-300 px-3 py-2 rounded font-bold hover:bg-blue-600 hover:text-white transition shadow-sm" title="Master Edit">✏️</button>
                    <button onClick={() => handleDelete(player._id, player.name)} className="bg-gray-200 text-gray-600 px-3 py-2 rounded font-bold hover:bg-red-500 hover:text-white transition shadow-sm" title="Delete">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isIconModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-3xl w-[400px] border-t-8 border-yellow-400">
            <h2 className="text-2xl font-black mb-2">⭐ Assign ICON</h2>
            <form onSubmit={handleMakeIconSubmit} className="space-y-4">
              <select required value={iconTeam} onChange={(e) => setIconTeam(e.target.value)} className="w-full p-3 border-2 rounded-xl font-bold">
                <option value="">-- Choose Team --</option>
                {teams.map(t => <option key={t._id} value={t.teamName}>{t.teamName}</option>)}
              </select>
              <input required type="number" value={iconPrice} onChange={(e) => setIconPrice(e.target.value)} className="w-full p-3 border-2 rounded-xl font-black text-green-600" />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsIconModalOpen(false)} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-yellow-400 font-black py-3 rounded-xl">Assign ⭐</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-3xl w-[450px] border-t-8 border-blue-600 shadow-2xl">
            <h2 className="text-2xl font-black text-gray-800 mb-4">✏️ Edit {selectedPlayer.name}</h2>
            
            <form onSubmit={handleMasterEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">Auction Status</label>
                <select value={editFormData.auctionStatus} onChange={(e) => setEditFormData({...editFormData, auctionStatus: e.target.value})} className="w-full p-3 border-2 rounded-xl font-bold bg-gray-50">
                  <option value="Pending">Pending (ऑक्शन के लिए तैयार)</option>
                  <option value="Sold">Sold (बिक गया)</option>
                  <option value="Unsold">Unsold (नहीं बिका)</option>
                </select>
              </div>

              {editFormData.auctionStatus === 'Sold' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-1">Sold To (Team)</label>
                    <select value={editFormData.soldTo} onChange={(e) => setEditFormData({...editFormData, soldTo: e.target.value})} className="w-full p-3 border-2 rounded-xl font-bold bg-gray-50">
                      <option value="">-- Select Team --</option>
                      {teams.map(t => <option key={t._id} value={t.teamName}>{t.teamName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-1">Sold Price (₹)</label>
                    <input type="number" value={editFormData.soldPrice} onChange={(e) => setEditFormData({...editFormData, soldPrice: e.target.value})} className="w-full p-3 border-2 rounded-xl font-black text-green-600 bg-gray-50" />
                  </div>
                </>
              )}

              <div className="flex items-center space-x-3 pt-2 bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                <input type="checkbox" id="iconCheck" checked={editFormData.isIcon} onChange={(e) => setEditFormData({...editFormData, isIcon: e.target.checked})} className="w-5 h-5 cursor-pointer" />
                <label htmlFor="iconCheck" className="font-bold text-yellow-900 cursor-pointer">Make/Keep as ICON Player ⭐</label>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-bold hover:bg-gray-300">Cancel</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl hover:bg-blue-700 shadow-lg">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default ManagePlayers;