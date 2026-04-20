import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function ManagePlayers() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);

  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [iconTeam, setIconTeam] = useState('');
  const [iconPrice, setIconPrice] = useState(0);

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

  useEffect(() => {
    const initialize = async () => {
      await Promise.all([fetchPlayers(), fetchTeams()]);
    };
    initialize();
  }, []);

  const handleApproval = async (id, status) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`https://cricket-auction-backend-h8ud.onrender.com/api/players/approval/${id}`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      fetchPlayers();
    } catch { alert('Error changing status'); }
  };

  const handlePriceUpdate = async (id, newPrice) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`https://cricket-auction-backend-h8ud.onrender.com/api/players/update-price/${id}`, { basePrice: newPrice }, { headers: { Authorization: `Bearer ${token}` } });
    } catch { alert('Error updating price'); }
  };

  const handleCategoryUpdate = async (id, newCategory) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `https://cricket-auction-backend-h8ud.onrender.com/api/players/update-category/${id}`,
        { category: newCategory },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPlayers(prev =>
        prev.map(player => (player._id === id ? { ...player, category: newCategory } : player))
      );
    } catch {
      alert('Error updating category');
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`क्या आप सच में '${name}' को डिलीट करना चाहते हैं?`)) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`https://cricket-auction-backend-h8ud.onrender.com/api/players/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        fetchPlayers();
      } catch { alert('Delete failed'); }
    }
  };

  const openIconModal = (player) => {
    setSelectedPlayer(player);
    setIconTeam('');
    setIconPrice(player.basePrice);
    setIsIconModalOpen(true);
  };

  const openDetailsModal = (player) => {
    setSelectedPlayer(player);
    setIsDetailsModalOpen(true);
  };

  const handleMakeIconSubmit = async (e) => {
    e.preventDefault();
    if (!iconTeam) { alert('Please select a team!'); return; }
    if (selectedIconTeamData && Number(iconPrice) > Number(selectedIconTeamData.maxBid || 0)) {
      alert(`🚫 Icon price blocked. ${iconTeam} max bid is ₹${Number(selectedIconTeamData.maxBid || 0).toLocaleString()}`);
      return;
    }    
    try {
      const token = localStorage.getItem('token');
      await axios.put(`https://cricket-auction-backend-h8ud.onrender.com/api/players/make-icon/${selectedPlayer._id}`,
        { teamName: iconTeam, iconPrice },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`⭐ ${selectedPlayer.name} is now an ICON player for ${iconTeam}!`);
      setIsIconModalOpen(false);
      fetchPlayers();
    } catch { alert('Failed to assign Icon player.'); }
  };

  const handleRemoveIcon = async (player) => {
    const confirmRemove = window.confirm(`क्या आप ${player.name} को ICON से हटाना चाहते हैं?`);
    if (!confirmRemove) return;

    try {
      const token = localStorage.getItem('token');
      await axios.put(`https://cricket-auction-backend-h8ud.onrender.com/api/players/remove-icon/${player._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`✅ ${player.name} अब ICON नहीं है और वापस auction pool में आ गया है।`);
      fetchPlayers();
    } catch {
      alert('ICON remove नहीं हो पाया।');
    }
  };

  const getSourceLabel = (source) => {
    if (source === 'Organizer') return 'Added by Organizer';
    return 'Public Registration';
  };

  const renderCustomData = (customData) => {
    if (!customData || Object.keys(customData).length === 0) {
      return <p className="text-sm text-gray-500">No additional custom fields.</p>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(customData).map(([key, value]) => (
          <div key={key} className="bg-gray-50 border rounded-lg p-3">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">{key}</p>
            {typeof value === 'boolean' ? (
              <p className="font-bold text-gray-800">{value ? 'Yes' : 'No'}</p>
            ) : typeof value === 'string' && value.startsWith('http') ? (
              <a href={value} target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline break-all">View File</a>
            ) : (
              <p className="font-bold text-gray-800 break-words">{value || '-'}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  const selectedIconTeamData = teams.find((team) => team.teamName === iconTeam);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto bg-white p-8 rounded-2xl shadow-xl border-t-8 border-indigo-600 relative">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-black text-gray-800">🛠️ Player Management</h2>
            <p className="text-gray-500 font-bold mt-1">Approve players, view full details, and assign ICONs.</p>
          </div>
          <button onClick={() => navigate('/dashboard')} className="bg-gray-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-700">⬅ Back</button>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-indigo-50 text-indigo-900 border-b-2 border-indigo-200">
                <th className="p-4 font-black">S. No.</th>
                <th className="p-4 font-black">Player</th>
                <th className="p-4 font-black">Role / City</th>
                <th className="p-4 font-black">Category</th>
                <th className="p-4 font-black">Source</th>
                <th className="p-4 font-black w-32">Base Price</th>
                <th className="p-4 font-black text-center">Status</th>
                <th className="p-4 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr key={player._id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-4 font-black text-gray-700">{index + 1}</td>
                  <td className="p-4">
                    <button onClick={() => openDetailsModal(player)} className="flex items-center space-x-3 text-left w-full">
                      <img src={player.photoUrl || 'https://via.placeholder.com/50'} alt="img" className="w-12 h-12 rounded-full object-cover border-2 shadow-sm" />
                      <div>
                        <p className="font-bold text-gray-800 text-lg hover:underline">{player.name}</p>
                        {player.isIcon && <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded border border-yellow-300">⭐ ICON</span>}
                      </div>
                    </button>
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-blue-700">{player.role}</p>
                    <p className="text-sm text-gray-500 font-medium">📍 {player.city || 'N/A'}</p>
                  </td>
                  <td className="p-4">
                    <input
                      type="text"
                      defaultValue={player.category || ''}
                      placeholder="Category"
                      onBlur={(e) => handleCategoryUpdate(player._id, e.target.value)}
                      className="w-full p-2 border-2 rounded bg-white focus:border-indigo-500 outline-none font-bold text-purple-700"
                      disabled={player.isIcon || player.auctionStatus === 'Sold'}
                    />
                  </td>
                  <td className="p-4 font-bold text-gray-700">{getSourceLabel(player.source)}</td>
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
                    <button onClick={() => handleRemoveIcon(player)} disabled={!player.isIcon} className="bg-orange-100 text-orange-700 border border-orange-300 px-2 py-2 rounded font-black hover:bg-orange-200 shadow-sm disabled:opacity-30" title="Remove ICON">⭐❌</button>
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
                {teams.map(t => <option key={t._id} value={t.teamName}>{t.teamName} (Max ₹{Number(t.maxBid || 0).toLocaleString()})</option>)}
              </select>
              {selectedIconTeamData && (
                <p className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg p-2">
                  Dynamic Max Bid: ₹{Number(selectedIconTeamData.maxBid || 0).toLocaleString()} • Required Players Left: {Number(selectedIconTeamData.remainingRequiredPlayers || 0)}
                </p>
              )}              
              <input required type="number" value={iconPrice} onChange={(e) => setIconPrice(e.target.value)} className="w-full p-3 border-2 rounded-xl font-black text-green-600" />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsIconModalOpen(false)} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-yellow-400 font-black py-3 rounded-xl">Assign ⭐</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDetailsModalOpen && selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border-t-8 border-indigo-600 shadow-2xl">
            <div className="flex justify-between items-start gap-4 mb-6">
              <div className="flex items-center gap-4">
                <img src={selectedPlayer.photoUrl || 'https://via.placeholder.com/80'} alt={selectedPlayer.name} className="w-20 h-20 rounded-full object-cover border-2" />
                <div>
                  <h2 className="text-2xl font-black text-gray-800">{selectedPlayer.name}</h2>
                  <p className="text-sm font-bold text-gray-500">Source: {getSourceLabel(selectedPlayer.source)}</p>
                </div>
              </div>
              <button onClick={() => setIsDetailsModalOpen(false)} className="text-gray-500 hover:text-gray-800 text-3xl leading-none">&times;</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 border rounded-lg p-3"><p className="text-xs uppercase text-gray-500 font-bold">Father Name</p><p className="font-bold">{selectedPlayer.fatherName || '-'}</p></div>
              <div className="bg-gray-50 border rounded-lg p-3"><p className="text-xs uppercase text-gray-500 font-bold">Age</p><p className="font-bold">{selectedPlayer.age || '-'}</p></div>
              <div className="bg-gray-50 border rounded-lg p-3"><p className="text-xs uppercase text-gray-500 font-bold">Mobile</p><p className="font-bold">{selectedPlayer.mobile || '-'}</p></div>
              <div className="bg-gray-50 border rounded-lg p-3"><p className="text-xs uppercase text-gray-500 font-bold">City</p><p className="font-bold">{selectedPlayer.city || '-'}</p></div>
              <div className="bg-gray-50 border rounded-lg p-3"><p className="text-xs uppercase text-gray-500 font-bold">Role</p><p className="font-bold">{selectedPlayer.role || '-'}</p></div>
              <div className="bg-gray-50 border rounded-lg p-3"><p className="text-xs uppercase text-gray-500 font-bold">Category</p><p className="font-bold">{selectedPlayer.category || '-'}</p></div>
              <div className="bg-gray-50 border rounded-lg p-3"><p className="text-xs uppercase text-gray-500 font-bold">Base Price</p><p className="font-bold">₹ {selectedPlayer.basePrice || 0}</p></div>
              <div className="bg-gray-50 border rounded-lg p-3"><p className="text-xs uppercase text-gray-500 font-bold">Approval</p><p className="font-bold">{selectedPlayer.approvalStatus || '-'}</p></div>
              <div className="bg-gray-50 border rounded-lg p-3"><p className="text-xs uppercase text-gray-500 font-bold">Auction Status</p><p className="font-bold">{selectedPlayer.auctionStatus || '-'}</p></div>
              <div className="bg-gray-50 border rounded-lg p-3"><p className="text-xs uppercase text-gray-500 font-bold">Sold To</p><p className="font-bold">{selectedPlayer.soldTo || '-'}</p></div>
              <div className="bg-gray-50 border rounded-lg p-3"><p className="text-xs uppercase text-gray-500 font-bold">Sold Price</p><p className="font-bold">₹ {selectedPlayer.soldPrice || 0}</p></div>
              <div className="bg-gray-50 border rounded-lg p-3"><p className="text-xs uppercase text-gray-500 font-bold">ICON Player</p><p className="font-bold">{selectedPlayer.isIcon ? 'Yes' : 'No'}</p></div>
            </div>

            <div>
              <h3 className="font-black text-gray-700 mb-3">Custom Registration Fields</h3>
              {renderCustomData(selectedPlayer.customData)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManagePlayers;