import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { TournamentContext } from '../context/TournamentContext';

const socket = io('http://localhost:5000');

function ControlPanel() {
  const navigate = useNavigate();
  const { tournament } = useContext(TournamentContext);

  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [biddingTeam, setBiddingTeam] = useState('');
  const [customBid, setCustomBid] = useState(''); 

  const [actionHistory, setActionHistory] = useState([]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const playersRes = await axios.get('http://localhost:5000/api/players', { headers });
      const unsoldPlayers = playersRes.data.filter(player => 
        player.auctionStatus?.trim().toLowerCase() === 'unsold' && 
        player.approvalStatus?.trim().toLowerCase() === 'approved'
      );
      setPlayers(unsoldPlayers);

      const teamsRes = await axios.get('http://localhost:5000/api/teams', { headers });
      setTeams(teamsRes.data);
    } catch (error) {
      console.error("डेटा लाने में दिक्कत:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 🌟 नया: AUTO-SYNC (Heartbeat) 🌟
  // अगर टीवी बीच में बंद हो जाए या रिफ्रेश हो जाए, तो यह हर 2 सेकंड में टीवी को करंट डेटा भेजता रहेगा।
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (currentPlayer) {
        socket.emit('newLiveBid', { bidAmount: currentBid, teamName: biddingTeam, player: currentPlayer });
      }
    }, 2000);
    
    return () => clearInterval(syncInterval);
  }, [currentPlayer, currentBid, biddingTeam]);


  const saveStateToHistory = (actionType, affectedPlayer = null) => {
    setActionHistory(prev => [...prev, {
      actionType,
      affectedPlayer,
      snapshot: {
        currentPlayer,
        currentBid,
        biddingTeam,
        players: [...players], 
        teams: JSON.parse(JSON.stringify(teams)) 
      }
    }]);
  };

  const pickRandomPlayer = () => {
    const availablePlayers = players.filter(p => p._id !== currentPlayer?._id);
    if (availablePlayers.length === 0) {
      alert("ऑक्शन के लिए कोई नया खिलाड़ी नहीं बचा है! (अगर आपने अभी किसी को Approve किया है, तो ऊपर 'Refresh List' बटन दबाएं)");
      return;
    }
    
    saveStateToHistory('PICK_PLAYER'); 

    const randomIndex = Math.floor(Math.random() * availablePlayers.length);
    const selected = availablePlayers[randomIndex];
    
    setCurrentPlayer(selected);
    setCurrentBid(selected.basePrice);
    setBiddingTeam('');
    setCustomBid('');
    
    socket.emit('newLiveBid', { bidAmount: selected.basePrice, teamName: '', player: selected });
  };

  const handleResetBid = () => {
    if (!currentPlayer) return;
    saveStateToHistory('RESET_BID');
    
    setCurrentBid(currentPlayer.basePrice);
    setBiddingTeam('');
    socket.emit('newLiveBid', { bidAmount: currentPlayer.basePrice, teamName: '', player: currentPlayer });
  };

  const updateBid = (teamName, amount, isJump = false) => {
    const team = teams.find(t => t.teamName === teamName);
    const newBidAmount = isJump ? amount : currentBid + amount;

    if (team && newBidAmount > team.remainingPurse) {
      alert(`⚠️ ${teamName} के पास इतने पैसे नहीं हैं!`);
      return;
    }

    saveStateToHistory('BID'); 
    
    setCurrentBid(newBidAmount);
    setBiddingTeam(teamName);
    socket.emit('newLiveBid', { bidAmount: newBidAmount, teamName: teamName, player: currentPlayer });
  };

  const handleCustomBidSubmit = () => {
    const amount = Number(customBid);
    if (!biddingTeam) { alert("पहले ग्रिड से एक टीम सेलेक्ट करें!"); return; }
    if (amount <= currentBid) { alert("Jump Bid करंट बिड से ज़्यादा होनी चाहिए!"); return; }
    updateBid(biddingTeam, amount, true);
    setCustomBid('');
  };

  const finalizePlayer = async (status) => {
    if (status === 'Sold' && !biddingTeam) { alert("टीम सेलेक्ट करें!"); return; }
    
    saveStateToHistory(status.toUpperCase(), currentPlayer); 

    try {
      const token = localStorage.getItem('token');
      const endpoint = status === 'Sold' ? `/api/players/sell/${currentPlayer._id}` : `/api/players/unsold/${currentPlayer._id}`;
      const payload = status === 'Sold' ? { teamName: biddingTeam, soldPrice: currentBid } : {};
      
      await axios.put(`http://localhost:5000${endpoint}`, payload, { headers: { Authorization: `Bearer ${token}` } });

      const updatedPlayers = players.filter(p => p._id !== currentPlayer._id);
      setPlayers(updatedPlayers);
      
      if (status === 'Sold') {
         setTeams(teams.map(t => t.teamName === biddingTeam ? { ...t, remainingPurse: t.remainingPurse - currentBid } : t));
      }

      setCurrentPlayer(null);
      socket.emit('newLiveBid', { bidAmount: 0, teamName: '', player: null }); 
    } catch (error) { alert("एरर! तकनीकी खराबी आ गई है।"); }
  };

  const handleUndo = async () => {
    if (actionHistory.length === 0) return;
    const lastAction = actionHistory[actionHistory.length - 1];
    
    if (lastAction.actionType === 'SOLD' || lastAction.actionType === 'UNSOLD') {
      try {
        const token = localStorage.getItem('token');
        await axios.put(`http://localhost:5000/api/players/undo/${lastAction.affectedPlayer._id}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        alert("Database Revert Failed!");
        return; 
      }
    }
    
    const snap = lastAction.snapshot;
    setCurrentPlayer(snap.currentPlayer);
    setCurrentBid(snap.currentBid);
    setBiddingTeam(snap.biddingTeam);
    setPlayers(snap.players);
    setTeams(snap.teams);
    
    socket.emit('newLiveBid', { 
        bidAmount: snap.currentBid || 0, 
        teamName: snap.biddingTeam || '',
        player: snap.currentPlayer
    });
    
    setActionHistory(prev => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-gray-200">
      <header className="bg-blue-900 p-4 px-6 flex justify-between items-center shadow-lg text-white">
        <h1 className="text-2xl font-black">⚙️ {tournament?.name} - Master Control</h1>
        <div className="flex space-x-4">
          
          <button onClick={fetchData} className="bg-blue-600 border border-blue-400 px-4 py-2 rounded hover:bg-blue-500 font-bold transition flex items-center shadow-lg active:scale-95">
             🔄 Refresh List
          </button>

          <button 
            onClick={handleUndo} 
            disabled={actionHistory.length === 0}
            className={`font-black px-6 py-2 rounded shadow-lg transition-all ${actionHistory.length > 0 ? 'bg-yellow-500 hover:bg-yellow-400 text-yellow-900 active:scale-95' : 'bg-gray-600 text-gray-400 opacity-50 cursor-not-allowed'}`}
          >
            ⏪ UNDO {actionHistory.length > 0 && `(${actionHistory.length})`}
          </button>
          
          <button onClick={() => navigate('/dashboard')} className="bg-red-500 px-4 py-2 rounded hover:bg-red-600 font-bold transition">Exit</button>
        </div>
      </header>

      <div className="p-6 max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-4 bg-white rounded-2xl shadow-xl p-6 border-t-8 border-blue-600 h-fit flex flex-col relative">
          
          <button onClick={pickRandomPlayer} className="w-full bg-indigo-600 text-white font-black text-xl py-4 rounded-xl hover:bg-indigo-700 shadow-[0_4px_0_0_rgba(67,56,202,1)] active:translate-y-1 transition-all mb-6">
            🎲 NEXT RANDOM PLAYER ({players.length} Left)
          </button>

          {!currentPlayer ? (
            <div className="text-center py-12 text-gray-400 font-bold text-xl border-4 border-dashed rounded-xl">
               कोई खिलाड़ी स्क्रीन पर नहीं है।<br/>ऊपर से नया प्लेयर लाएं!
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-6 mb-6">
                <img src={currentPlayer.photoUrl || 'https://via.placeholder.com/150'} alt="Player" className="w-24 h-24 rounded-2xl object-cover shadow-md border-4 border-blue-100" onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=No+Photo'; }} />
                <div>
                  <h1 className="text-3xl font-black text-gray-900 capitalize">{currentPlayer.name}</h1>
                  <p className="text-gray-500 font-bold mt-1">📍 {currentPlayer.city || 'Unknown'}</p>
                </div>
              </div>
              
              <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-500 font-bold uppercase">Role</span>
                  <span className="text-xl font-black text-blue-700">{currentPlayer.role}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold uppercase">Base Price</span>
                  <span className="text-xl font-black text-green-700">₹ {currentPlayer.basePrice.toLocaleString()}</span>
                </div>
              </div>

              <div className="mt-8 flex flex-col space-y-4">
                <button onClick={() => finalizePlayer('Sold')} className="w-full bg-green-600 text-white font-black text-2xl py-4 rounded-xl hover:bg-green-700 shadow-[0_6px_0_0_rgba(21,128,61,1)] active:translate-y-1 transition-all">SOLD 🔨</button>
                <button onClick={() => finalizePlayer('Unsold')} className="w-full bg-red-600 text-white font-black text-xl py-3 rounded-xl hover:bg-red-700 shadow-[0_4px_0_0_rgba(185,28,28,1)] active:translate-y-1 transition-all">UNSOLD ❌</button>
              </div>
            </>
          )}
        </div>

        <div className={`lg:col-span-8 bg-white rounded-2xl shadow-xl p-6 border-t-8 border-green-500 transition-all ${!currentPlayer ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
          
          <div className="bg-gray-900 text-white rounded-2xl p-6 text-center mb-6 shadow-inner flex justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-yellow-500 to-green-500 animate-pulse"></div>
            
            <div className="text-left flex items-center space-x-4">
              <div>
                <p className="text-gray-400 font-bold uppercase text-sm mb-1 tracking-wider">Current Bid</p>
                <p className="text-6xl font-black text-green-400">₹ {currentBid.toLocaleString()}</p>
              </div>
              <button onClick={handleResetBid} className="bg-gray-700 p-3 rounded-full hover:bg-gray-600 transition shadow" title="Reset to Base Price">🔄</button>
            </div>
            
            <div className="text-right">
              <p className="text-gray-400 font-bold uppercase text-sm mb-1 tracking-wider">Highest Bidder</p>
              <p className="text-3xl font-black text-yellow-400">{biddingTeam ? biddingTeam : "Waiting..."}</p>
            </div>
          </div>

          <div className="flex justify-between items-end mb-4 border-b pb-4">
             <h2 className="text-gray-500 font-bold uppercase tracking-widest">Fast Bidding Grid</h2>
             <div className="flex space-x-2">
                <input type="number" value={customBid} onChange={(e) => setCustomBid(e.target.value)} placeholder="Custom Bid ₹" className="p-2 border-2 border-gray-300 rounded-lg font-bold w-32 focus:border-blue-500 outline-none" />
                <button onClick={handleCustomBidSubmit} className="bg-blue-600 text-white font-bold px-4 rounded-lg shadow hover:bg-blue-700">Jump 🚀</button>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 pb-4">
            {teams.map((team) => {
              const isHighestBidder = biddingTeam === team.teamName;
              return (
                <div key={team._id} className={`p-4 rounded-xl border-2 transition-all ${isHighestBidder ? 'border-yellow-400 bg-yellow-50 shadow-md transform scale-[1.02]' : 'border-gray-200 bg-gray-50 hover:border-blue-300'}`}>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-xl text-gray-800">{team.teamName}</h3>
                    <div className="text-right">
                      <span className="text-xs font-bold text-gray-500 uppercase block">Purse Left</span>
                      <span className={`font-black ${team.remainingPurse < 50000 ? 'text-red-500' : 'text-green-600'}`}>₹{team.remainingPurse.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <button onClick={() => { updateBid(team.teamName, currentPlayer.basePrice, true) }} className="bg-gray-200 text-gray-700 font-bold py-2 rounded hover:bg-gray-300 text-sm border border-gray-300">Base</button>
                    <button onClick={() => updateBid(team.teamName, 500)} className="bg-blue-100 text-blue-800 font-black py-2 rounded hover:bg-blue-200 text-sm border border-blue-300 shadow-sm">+ 500</button>
                    <button onClick={() => updateBid(team.teamName, 1000)} className="bg-blue-100 text-blue-800 font-black py-2 rounded hover:bg-blue-200 text-sm border border-blue-300 shadow-sm">+ 1K</button>
                    <button onClick={() => updateBid(team.teamName, 5000)} className="bg-blue-100 text-blue-800 font-black py-2 rounded hover:bg-blue-200 text-sm border border-blue-300 shadow-sm">+ 5K</button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}

export default ControlPanel;