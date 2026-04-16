import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { TournamentContext } from '../context/TournamentContext';

const socket = io('https://cricket-auction-backend-h8ud.onrender.com');

function ControlPanel() {
  const navigate = useNavigate();
  const { tournament } = useContext(TournamentContext);

  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  
  const [currentPlayer, setCurrentPlayer] = useState(() => JSON.parse(localStorage.getItem('currentPlayer')) || null);
  const [currentBid, setCurrentBid] = useState(() => Number(localStorage.getItem('currentBid')) || 0);
  const [biddingTeam, setBiddingTeam] = useState(() => localStorage.getItem('biddingTeam') || '');
  const [playerStatus, setPlayerStatus] = useState(() => localStorage.getItem('playerStatus') || 'bidding');
  const [customBid, setCustomBid] = useState(''); 

  const [actionHistory, setActionHistory] = useState([]);
  const [showUnsoldModal, setShowUnsoldModal] = useState(false);
  const [unsoldDatabase, setUnsoldDatabase] = useState([]);

  // 🌟 DYNAMIC BID BUTTONS VALUES 🌟
  const btn1 = tournament?.bidButton1 || 500;
  const btn2 = tournament?.bidButton2 || 1000;
  const btn3 = tournament?.bidButton3 || 5000;

  // 🌟 स्मार्ट फॉर्मेटिंग (1000 = 1K, 100000 = 1L) 🌟
  const formatBidButton = (value) => {
    if (value >= 100000) return `+${value / 100000}L`;
    if (value >= 1000) return `+${value / 1000}K`;
    return `+${value}`;
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  useEffect(() => {
    localStorage.setItem('currentPlayer', JSON.stringify(currentPlayer));
    localStorage.setItem('currentBid', currentBid);
    localStorage.setItem('biddingTeam', biddingTeam);
    localStorage.setItem('playerStatus', playerStatus);
  }, [currentPlayer, currentBid, biddingTeam, playerStatus]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const playersRes = await axios.get('https://cricket-auction-backend-h8ud.onrender.com/api/players', { headers });
      
      const availablePlayers = playersRes.data.filter(player => 
        player.approvalStatus?.trim().toLowerCase() === 'approved' &&
        player.auctionStatus?.trim().toLowerCase() === 'readyforauction'
      );
      setPlayers(availablePlayers);

      const teamsRes = await axios.get('https://cricket-auction-backend-h8ud.onrender.com/api/teams', { headers });
      setTeams(teamsRes.data);
    } catch (error) {
      console.error("डेटा लाने में दिक्कत:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (currentPlayer) {
        socket.emit('newLiveBid', { bidAmount: currentBid, teamName: biddingTeam, player: currentPlayer, status: playerStatus });
      }
    }, 2000);
    return () => clearInterval(syncInterval);
  }, [currentPlayer, currentBid, biddingTeam, playerStatus]);

  const saveStateToHistory = (actionType, affectedPlayer = null) => {
    setActionHistory(prev => [...prev, {
      actionType,
      affectedPlayer,
      snapshot: {
        currentPlayer,
        currentBid,
        biddingTeam,
        playerStatus,
        players: [...players], 
        teams: JSON.parse(JSON.stringify(teams)) 
      }
    }]);
  };

  const pickRandomPlayer = () => {
    const availablePlayers = players.filter(p => p._id !== currentPlayer?._id);
    if (availablePlayers.length === 0) {
      alert("ऑक्शन के लिए कोई नया खिलाड़ी नहीं बचा है!");
      return;
    }
    
    saveStateToHistory('PICK_PLAYER'); 

    const randomIndex = Math.floor(Math.random() * availablePlayers.length);
    const selected = availablePlayers[randomIndex];
    
    setCurrentPlayer(selected);
    setCurrentBid(selected.basePrice);
    setBiddingTeam('');
    setCustomBid('');
    setPlayerStatus('bidding');
    
    socket.emit('newLiveBid', { bidAmount: selected.basePrice, teamName: '', player: selected, status: 'bidding' });
  };

  const handleResetBid = () => {
    if (!currentPlayer || playerStatus !== 'bidding') return;
    saveStateToHistory('RESET_BID');
    
    setCurrentBid(currentPlayer.basePrice);
    setBiddingTeam('');
    socket.emit('newLiveBid', { bidAmount: currentPlayer.basePrice, teamName: '', player: currentPlayer, status: playerStatus });
  };

  const updateBid = (teamName, amount, isJump = false) => {
    if (playerStatus !== 'bidding') return; 

    const team = teams.find(t => t.teamName === teamName);
    const newBidAmount = isJump ? amount : currentBid + amount;

    if (team && newBidAmount > team.remainingPurse) {
      alert(`⚠️ ${teamName} के पास इतने पैसे नहीं हैं!`);
      return;
    }

    saveStateToHistory('BID'); 
    
    setCurrentBid(newBidAmount);
    setBiddingTeam(teamName);
    socket.emit('newLiveBid', { bidAmount: newBidAmount, teamName: teamName, player: currentPlayer, status: playerStatus });
  };

  const handleCustomBidSubmit = () => {
    const amount = Number(customBid);
    if (!biddingTeam) { alert("पहले ग्रिड से एक टीम सेलेक्ट करें!"); return; }
    if (amount <= currentBid) { alert("Jump Bid करंट बिड से ज़्यादा होनी चाहिए!"); return; }
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
      
      await axios.put(`https://cricket-auction-backend-h8ud.onrender.com${endpoint}`, payload, { headers: { Authorization: `Bearer ${token}` } });

      const updatedPlayers = players.filter(p => p._id !== currentPlayer._id);
      setPlayers(updatedPlayers);
      
      if (status === 'Sold') {
         setTeams(teams.map(t => t.teamName === biddingTeam ? { ...t, remainingPurse: t.remainingPurse - currentBid } : t));
      }

      setPlayerStatus(status.toLowerCase());
      socket.emit('newLiveBid', { bidAmount: currentBid, teamName: biddingTeam, player: currentPlayer, status: status.toLowerCase() }); 
    } catch (error) { alert("एरर! तकनीकी खराबी आ गई है।"); }
  };

  const handleUndo = async () => {
    if (actionHistory.length === 0) return;
    const lastAction = actionHistory[actionHistory.length - 1];
    
    if (lastAction.actionType === 'SOLD' || lastAction.actionType === 'UNSOLD') {
      try {
        const token = localStorage.getItem('token');
        await axios.put(`https://cricket-auction-backend-h8ud.onrender.com/api/players/undo/${lastAction.affectedPlayer._id}`, {}, {
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
    setPlayerStatus(snap.playerStatus);
    setPlayers(snap.players);
    setTeams(snap.teams);
    
    socket.emit('newLiveBid', { 
        bidAmount: snap.currentBid || 0, 
        teamName: snap.biddingTeam || '',
        player: snap.currentPlayer,
        status: snap.playerStatus
    });
    
    setActionHistory(prev => prev.slice(0, -1));
  };

  const openUnsoldModal = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('https://cricket-auction-backend-h8ud.onrender.com/api/players', { headers: { Authorization: `Bearer ${token}` } });
      
      const currentReadyIds = players.map(p => p._id);
      if(currentPlayer) currentReadyIds.push(currentPlayer._id);

      const passedPlayers = res.data.filter(p => 
        p.approvalStatus?.trim().toLowerCase() === 'approved' &&
        (p.auctionStatus?.trim().toLowerCase() === 'unsold' || p.auctionStatus?.trim().toLowerCase() === 'passed') &&
        !currentReadyIds.includes(p._id)
      );

      setUnsoldDatabase(passedPlayers);
      setShowUnsoldModal(true);
    } catch (error) {
      console.error("Unsold प्लेयर्स लाने में दिक्कत:", error);
    }
  };

  const bringBackToAuction = async (playerToBring) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`https://cricket-auction-backend-h8ud.onrender.com/api/players/undo/${playerToBring._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setPlayers(prev => [...prev, playerToBring]); 
      setUnsoldDatabase(prev => prev.filter(p => p._id !== playerToBring._id)); 
      alert(`🔥 ${playerToBring.name} को वापस ऑक्शन पूल में शामिल कर लिया गया है!`);
    } catch (error) {
      alert("एरर: डेटाबेस अपडेट नहीं हो पाया!");
    }
  };

  const bringAllBackToAuction = async () => {
    const confirmAction = window.confirm("क्या आप सभी Unsold प्लेयर्स को एक साथ वापस ऑक्शन में लाना चाहते हैं?");
    if (confirmAction) {
      try {
        const token = localStorage.getItem('token');
        
        for (const p of unsoldDatabase) {
           await axios.put(`https://cricket-auction-backend-h8ud.onrender.com/api/players/undo/${p._id}`, {}, {
              headers: { Authorization: `Bearer ${token}` }
           });
           await delay(400); 
        }

        setPlayers(prev => [...prev, ...unsoldDatabase]);
        setUnsoldDatabase([]);
        setShowUnsoldModal(false);
        alert("✅ सभी अनसोल्ड प्लेयर्स सुरक्षित रूप से वापस आ गए हैं!");
      } catch (error) {
        console.error(error);
        alert("एरर: कुछ प्लेयर्स वापस नहीं आ पाए, इंटरनेट चेक करें।");
      }
    }
  };

  const resetWholeAuction = async () => {
    const confirmReset = window.confirm("⚠️ चेतावनी! क्या आप पूरा ऑक्शन रीसेट करना चाहते हैं?");
    if (!confirmReset) return;

    const confirmAgain = window.prompt("सुरक्षा के लिए, कृपया बॉक्स में 'RESET' टाइप करें (बिना सिंगल कोट्स के):");
    if (confirmAgain !== "RESET") {
        alert("❌ रीसेट कैंसल कर दिया गया।");
        return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('https://cricket-auction-backend-h8ud.onrender.com/api/players', { headers: { Authorization: `Bearer ${token}` } });
      
      const playersToReset = res.data.filter(p => 
        p.auctionStatus?.trim().toLowerCase() === 'sold' || 
        p.auctionStatus?.trim().toLowerCase() === 'unsold' ||
        p.auctionStatus?.trim().toLowerCase() === 'passed'
      );

      if(playersToReset.length > 0) {
          alert(`⏳ ${playersToReset.length} खिलाड़ियों का डेटा वापस लाया जा रहा है... कृपया इस पेज को बंद न करें, इसमें कुछ सेकंड लगेंगे।`);
          
          for (const p of playersToReset) {
              try {
                  await axios.put(`https://cricket-auction-backend-h8ud.onrender.com/api/players/undo/${p._id}`, {}, {
                      headers: { Authorization: `Bearer ${token}` }
                  });
                  await delay(500); 
              } catch(err) {
                  console.error(`Failed to undo player ${p.name}`, err);
              }
          }
      }

      setCurrentPlayer(null);
      setCurrentBid(0);
      setBiddingTeam('');
      setPlayerStatus('bidding');
      setActionHistory([]);
      
      localStorage.removeItem('currentPlayer');
      localStorage.removeItem('currentBid');
      localStorage.removeItem('biddingTeam');
      localStorage.removeItem('playerStatus');

      socket.emit('newLiveBid', { bidAmount: 0, teamName: '', player: null, status: 'bidding' });

      await fetchData(); 
      alert("✅ 100% UNIVERSE RESET SUCCESSFUL! \n\nसभी Approved प्लेयर अब ReadyForAuction स्टेटस में वापस आ गए हैं।");

    } catch (error) {
      console.error(error);
      alert("एरर: रीसेट करने में दिक्कत आई।");
    }
  };

  return (
    <div className="min-h-screen bg-gray-200">
      <header className="bg-blue-900 p-4 px-6 flex justify-between items-center shadow-lg text-white">
        <h1 className="text-2xl font-black">⚙️ {tournament?.name} - Master Control</h1>
        <div className="flex space-x-3">
          
          <button onClick={resetWholeAuction} className="bg-red-700 border border-red-500 px-4 py-2 rounded hover:bg-red-800 font-bold transition flex items-center shadow-lg" title="Reset for Real Auction">
              ⚠️ Reset Auction
          </button>

          <button onClick={openUnsoldModal} className="bg-orange-500 border border-orange-400 px-4 py-2 rounded hover:bg-orange-400 font-bold transition flex items-center shadow-lg">
              ♻️ View Unsold
          </button>

          <button onClick={fetchData} className="bg-blue-600 border border-blue-400 px-4 py-2 rounded hover:bg-blue-500 font-bold transition flex items-center shadow-lg" title="नया प्लेयर आने पर रिफ्रेश करें">
              🔄 Refresh List
          </button>

          <button 
            onClick={handleUndo} 
            disabled={actionHistory.length === 0}
            className={`font-black px-6 py-2 rounded shadow-lg transition-all ${actionHistory.length > 0 ? 'bg-yellow-500 hover:bg-yellow-400 text-yellow-900' : 'bg-gray-600 text-gray-400 opacity-50'}`}
          >
            ⏪ UNDO {actionHistory.length > 0 && `(${actionHistory.length})`}
          </button>
          
          <button onClick={() => navigate('/dashboard')} className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-800 font-bold transition">Exit</button>
        </div>
      </header>

      <div className="p-4 lg:p-6 max-w-[1500px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        
        <div className="lg:col-span-4 bg-white rounded-2xl shadow-xl p-5 border-t-8 border-blue-600 h-fit flex flex-col relative">
          <button onClick={pickRandomPlayer} className={`w-full text-white font-black text-lg py-3 rounded-xl shadow-[0_4px_0_0_rgba(67,56,202,1)] active:translate-y-1 transition-all mb-5 ${playerStatus !== 'bidding' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {playerStatus !== 'bidding' ? '📸 BRING NEXT PLAYER' : `🎲 NEXT RANDOM PLAYER (${players.length} Left)`}
          </button>

          {!currentPlayer ? (
            <div className="text-center py-12 text-gray-400 font-bold text-lg border-4 border-dashed rounded-xl">
                कोई खिलाड़ी स्क्रीन पर नहीं है。<br/>ऊपर से नया प्लेयर लाएं!
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-4 mb-5">
                <img src={currentPlayer.photoUrl || 'https://via.placeholder.com/150'} alt="Player" className="w-20 h-20 rounded-2xl object-cover shadow-md border-4 border-blue-100" onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=No+Photo'; }} />
                <div>
                  <h1 className="text-2xl font-black text-gray-900 capitalize">{currentPlayer.name}</h1>
                  <p className="text-gray-500 font-bold text-sm mt-1">📍 {currentPlayer.city || 'Unknown'}</p>
                </div>
              </div>
              
              <div className="space-y-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-500 font-bold text-sm uppercase">Role</span>
                  <span className="text-lg font-black text-blue-700">{currentPlayer.role}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold text-sm uppercase">Base Price</span>
                  <span className="text-lg font-black text-green-700">₹ {currentPlayer.basePrice.toLocaleString()}</span>
                </div>
              </div>

              {playerStatus === 'bidding' ? (
                 <div className="mt-6 flex gap-3">
                   <button onClick={() => finalizePlayer('Sold')} className="w-full bg-green-600 text-white font-black text-xl py-3 rounded-xl hover:bg-green-700 shadow-[0_4px_0_0_rgba(21,128,61,1)] active:translate-y-1 transition-all">SOLD 🔨</button>
                   <button onClick={() => finalizePlayer('Unsold')} className="w-full bg-red-600 text-white font-black text-lg py-3 rounded-xl hover:bg-red-700 shadow-[0_4px_0_0_rgba(185,28,28,1)] active:translate-y-1 transition-all">UNSOLD ❌</button>
                 </div>
              ) : (
                 <div className={`mt-6 p-4 rounded-xl text-center border-2 ${playerStatus === 'sold' ? 'bg-green-100 border-green-500 text-green-800' : 'bg-red-100 border-red-500 text-red-800'}`}>
                    <h2 className="text-2xl font-black uppercase tracking-widest mb-1">{playerStatus}</h2>
                    <p className="font-bold text-sm">टीवी स्क्रीन पर फोटो रुक गई है।</p>
                    <p className="text-xs mt-1">नया प्लेयर लाने के लिए ऊपर 'Bring Next Player' दबाएं।</p>
                 </div>
              )}
            </>
          )}
        </div>

        <div className={`lg:col-span-8 bg-white rounded-2xl shadow-xl p-5 border-t-8 border-green-500 transition-all ${!currentPlayer || playerStatus !== 'bidding' ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
          
          <div className="bg-gray-900 text-white rounded-2xl p-5 text-center mb-5 shadow-inner flex justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-yellow-500 to-green-500 animate-pulse"></div>
            
            <div className="text-left flex items-center space-x-4">
              <div>
                <p className="text-gray-400 font-bold uppercase text-xs mb-1 tracking-wider">Current Bid</p>
                <p className="text-5xl font-black text-green-400">₹ {currentBid.toLocaleString()}</p>
              </div>
              <button onClick={handleResetBid} className="bg-gray-700 p-2 rounded-full hover:bg-gray-600 transition shadow" title="Reset to Base Price">🔄</button>
            </div>
            
            <div className="text-right">
              <p className="text-gray-400 font-bold uppercase text-xs mb-1 tracking-wider">Highest Bidder</p>
              <p className="text-2xl font-black text-yellow-400">{biddingTeam ? biddingTeam : "Waiting..."}</p>
            </div>
          </div>

          <div className="flex justify-between items-end mb-4 border-b pb-3">
             <h2 className="text-gray-500 font-bold text-sm uppercase tracking-widest">Fast Bidding Grid</h2>
             <div className="flex space-x-2">
                <input type="number" value={customBid} onChange={(e) => setCustomBid(e.target.value)} placeholder="Custom Bid ₹" className="p-1.5 border-2 border-gray-300 rounded font-bold w-28 text-sm focus:border-blue-500 outline-none" />
                <button onClick={handleCustomBidSubmit} className="bg-blue-600 text-white font-bold px-3 py-1.5 rounded shadow hover:bg-blue-700 text-sm">Jump 🚀</button>
             </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto pr-2 pb-2">
            {teams.map((team) => {
              const isHighestBidder = biddingTeam === team.teamName;
              return (
                <div key={team._id} className={`p-3 rounded-lg border-2 transition-all ${isHighestBidder ? 'border-yellow-400 bg-yellow-50 shadow transform scale-[1.02]' : 'border-gray-200 bg-gray-50 hover:border-blue-300'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-base text-gray-800 truncate pr-1" title={team.teamName}>{team.teamName}</h3>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-gray-500 uppercase block leading-none mb-0.5">Purse Left</span>
                      <span className={`font-black text-sm ${team.remainingPurse < 50000 ? 'text-red-500' : 'text-green-600'}`}>₹{team.remainingPurse.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  {/* 🌟 FIX: यहाँ अब डायनामिक बटन्स लगा दिए गए हैं 🌟 */}
                  <div className="grid grid-cols-3 gap-1">
                    <button onClick={() => updateBid(team.teamName, btn1)} className="bg-blue-100 text-blue-800 font-black py-1 px-1 rounded hover:bg-blue-200 text-xs border border-blue-300 shadow-sm">{formatBidButton(btn1)}</button>
                    <button onClick={() => updateBid(team.teamName, btn2)} className="bg-blue-100 text-blue-800 font-black py-1 px-1 rounded hover:bg-blue-200 text-xs border border-blue-300 shadow-sm">{formatBidButton(btn2)}</button>
                    <button onClick={() => updateBid(team.teamName, btn3)} className="bg-blue-100 text-blue-800 font-black py-1 px-1 rounded hover:bg-blue-200 text-xs border border-blue-300 shadow-sm">{formatBidButton(btn3)}</button>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Unsold Modal Code Remains Same */}
      {showUnsoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
          <div className="bg-white w-11/12 max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
            
            <div className="bg-orange-600 text-white p-5 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-xl font-black uppercase tracking-wider">♻️ Unsold Players Godown</h2>
              <div className="flex items-center space-x-6">
                 {unsoldDatabase.length > 0 && (
                    <button onClick={bringAllBackToAuction} className="bg-white text-orange-600 font-black px-4 py-2 rounded-lg shadow-md hover:bg-orange-50 active:scale-95 transition">
                        Bring ALL Back ♻️
                    </button>
                 )}
                 <button onClick={() => setShowUnsoldModal(false)} className="text-white hover:text-gray-300 font-black text-4xl leading-none">&times;</button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto bg-gray-50 flex-grow">
              {unsoldDatabase.length === 0 ? (
                <div className="text-center py-12 text-gray-500 font-bold text-xl">
                  गोडाउन खाली है! अभी तक कोई भी प्लेयर Unsold नहीं हुआ है।
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {unsoldDatabase.map((p) => (
                    <div key={p._id} className="bg-white p-4 rounded-xl shadow border border-gray-200 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <img src={p.photoUrl || 'https://via.placeholder.com/50'} alt="Player" className="w-16 h-16 rounded-full object-cover shadow border border-gray-300" />
                        <div>
                          <h3 className="font-bold text-lg">{p.name}</h3>
                          <p className="text-sm text-gray-500 font-semibold">{p.role} | ₹{p.basePrice}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => bringBackToAuction(p)} 
                        className="bg-green-100 text-green-700 font-black px-4 py-2 rounded hover:bg-green-200 border border-green-300 transition-all active:scale-95"
                      >
                        Bring Back ♻️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default ControlPanel;