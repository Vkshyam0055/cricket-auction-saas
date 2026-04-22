import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/apiClient';

function Teams() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs: 'summary' or 'squads'
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedTeam, setSelectedTeam] = useState('');
  const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        const [teamsRes, playersRes] = await Promise.all([
          apiRequest({ method: 'get', path: '/api/teams', headers }),
          apiRequest({ method: 'get', path: '/api/players', headers })
        ]);

        const teamsPayload = Array.isArray(teamsRes.data) ? teamsRes.data : [];
        const playersPayload = Array.isArray(playersRes.data) ? playersRes.data : [];

        setTeams(teamsPayload);
        setPlayers(playersPayload);
        
        // By default, select the first team if available
        if (teamsPayload.length > 0) {
          setSelectedTeam(teamsPayload[0].teamName);
        }
      } catch (error) {
        console.error("डेटा लाने में दिक्कत:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 📊 Calculations for Auction Summary
  const totalRegistered = players.length;
  const totalSold = players.filter((p) => ['sold', 'icon'].includes(normalizeStatus(p.auctionStatus))).length;
  const totalUnsold = players.filter((p) => normalizeStatus(p.auctionStatus) === 'unsold').length;

  // 🛡️ Calculations for Team Dashboard
  // 🌟 FIX: Icon Players हमेशा लिस्ट में सबसे ऊपर (Top) आएंगे!
  const squadPlayers = players
    .filter((p) => String(p.soldTo || '').trim() === String(selectedTeam || '').trim())
    .sort((a, b) => Number(b.isIcon || 0) - Number(a.isIcon || 0)); 

  const activeTeamData = teams.find(t => t.teamName === selectedTeam);
  const teamSpentAmount = squadPlayers.reduce((acc, p) => acc + (p.soldPrice || 0), 0);
  const teamTotalPurse = (activeTeamData?.remainingPurse || 0) + teamSpentAmount;

  if (loading) {
    return <div className="min-h-screen bg-[#0B172A] flex items-center justify-center text-yellow-400 font-black text-2xl">Loading Dashboard... ⏳</div>;
  }

  return (
    <div className="min-h-screen bg-[#0B172A] text-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-[#1E293B] p-6 rounded-2xl shadow-2xl border-b-4 border-yellow-400">
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-wider uppercase">
            <span className="text-yellow-400">🏆 Master</span> Dashboard
          </h1>
          <button onClick={() => navigate('/dashboard')} className="mt-4 md:mt-0 bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-bold transition shadow-lg border border-gray-500">
            ⬅ Back to Control Room
          </button>
        </div>

        {/* Custom Tabs */}
        <div className="flex space-x-2 md:space-x-4 mb-8">
          <button 
            onClick={() => setActiveTab('summary')} 
            className={`flex-1 py-4 text-lg font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'summary' ? 'bg-yellow-400 text-[#0B172A] shadow-[0_0_15px_rgba(250,204,21,0.5)] scale-105' : 'bg-[#1E293B] text-gray-400 hover:bg-gray-700 border border-gray-700'}`}
          >
            📊 Auction Summary
          </button>
          <button 
            onClick={() => setActiveTab('squads')} 
            className={`flex-1 py-4 text-lg font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'squads' ? 'bg-yellow-400 text-[#0B172A] shadow-[0_0_15px_rgba(250,204,21,0.5)] scale-105' : 'bg-[#1E293B] text-gray-400 hover:bg-gray-700 border border-gray-700'}`}
          >
            🛡️ Team Dashboard
          </button>
        </div>

        {/* =========================================
            TAB 1: AUCTION SUMMARY
        ========================================== */}
        {activeTab === 'summary' && (
          <div className="animate-fade-in">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-[#1E293B] p-6 rounded-2xl border-l-8 border-blue-500 shadow-xl flex flex-col items-center justify-center">
                <span className="text-gray-400 font-bold uppercase tracking-wider mb-2">Total Registered</span>
                <span className="text-5xl font-black text-blue-400">{totalRegistered}</span>
              </div>
              <div className="bg-[#1E293B] p-6 rounded-2xl border-l-8 border-green-500 shadow-xl flex flex-col items-center justify-center">
                <span className="text-gray-400 font-bold uppercase tracking-wider mb-2">Total Sold</span>
                <span className="text-5xl font-black text-green-400">{totalSold}</span>
              </div>
              <div className="bg-[#1E293B] p-6 rounded-2xl border-l-8 border-red-500 shadow-xl flex flex-col items-center justify-center">
                <span className="text-gray-400 font-bold uppercase tracking-wider mb-2">Total Unsold</span>
                <span className="text-5xl font-black text-red-400">{totalUnsold}</span>
              </div>
            </div>

            {/* Summary Table */}
            <div className="bg-[#1E293B] rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0F172A] text-yellow-400 text-sm uppercase tracking-widest border-b-2 border-gray-700">
                      <th className="p-5 font-black">Team Name</th>
                      <th className="p-5 font-black text-center">Total Purse</th>
                      <th className="p-5 font-black text-center">Spent</th>
                      <th className="p-5 font-black text-center">Remaining</th>
                      <th className="p-5 font-black text-center">Dynamic Max Bid</th>                      
                      <th className="p-5 font-black text-center">Players</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {teams.map((team) => {
                      const tPlayers = players.filter(p => p.soldTo === team.teamName);
                      const tSpent = tPlayers.reduce((acc, p) => acc + (p.soldPrice || 0), 0);
                      const tTotal = team.remainingPurse + tSpent;
                      
                      return (
                        <tr key={team._id} className="hover:bg-[#192236] transition-colors">
                          <td className="p-5 font-black text-white text-lg uppercase">{team.teamName}</td>
                          <td className="p-5 text-center font-bold text-gray-300">₹{tTotal.toLocaleString()}</td>
                          <td className="p-5 text-center font-black text-blue-400">₹{tSpent.toLocaleString()}</td>
                          <td className="p-5 text-center font-black text-green-400">₹{team.remainingPurse.toLocaleString()}</td>
                          <td className="p-5 text-center font-black text-orange-300">₹{Number(team.maxBid || 0).toLocaleString()}</td>
                          <td className="p-5 text-center font-bold text-yellow-100">{tPlayers.length}</td>
                        </tr>
                      );
                    })}
                    {teams.length === 0 && (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-gray-500 font-bold">No teams registered yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            TAB 2: TEAM DASHBOARD (SQUADS)
        ========================================== */}
        {activeTab === 'squads' && (
          <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Sidebar / Top Panel: Team Selection & Stats */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-[#1E293B] p-5 rounded-2xl shadow-xl border border-gray-700">
                <label className="block text-yellow-400 font-black uppercase tracking-widest mb-3 text-sm">Select Team</label>
                <select 
                  value={selectedTeam} 
                  onChange={(e) => setSelectedTeam(e.target.value)} 
                  className="w-full p-4 bg-[#0F172A] border-2 border-gray-600 text-white rounded-xl font-bold focus:border-yellow-400 outline-none uppercase"
                >
                  {teams.map(t => <option key={t._id} value={t.teamName}>{t.teamName}</option>)}
                </select>
              </div>

              {activeTeamData && (
                <div className="bg-[#1E293B] p-6 rounded-2xl shadow-xl border-t-8 border-yellow-400 flex flex-col space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                    <span className="text-gray-400 font-bold uppercase text-xs tracking-wider">Total Purse</span>
                    <span className="text-xl font-black text-white">₹{teamTotalPurse.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                    <span className="text-gray-400 font-bold uppercase text-xs tracking-wider">Spent Amount</span>
                    <span className="text-xl font-black text-blue-400">₹{teamSpentAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                    <span className="text-gray-400 font-bold uppercase text-xs tracking-wider">Remaining Balance</span>
                    <span className="text-2xl font-black text-green-400">₹{activeTeamData.remainingPurse.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                    <span className="text-gray-400 font-bold uppercase text-xs tracking-wider">Dynamic Max Bid</span>
                    <span className="text-2xl font-black text-orange-300">₹{Number(activeTeamData.maxBid || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                    <span className="text-gray-400 font-bold uppercase text-xs tracking-wider">Required Players Left</span>
                    <span className="text-xl font-black text-indigo-300">{Number(activeTeamData.remainingRequiredPlayers || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-gray-400 font-bold uppercase text-xs tracking-wider">Total Players</span>
                    <span className="text-2xl font-black text-yellow-400">{squadPlayers.length}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Main Panel: Squad List */}
            <div className="lg:col-span-9 bg-[#1E293B] rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
              <div className="bg-[#0F172A] p-5 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-2xl font-black text-white uppercase tracking-wider flex items-center">
                  <span className="text-yellow-400 mr-2">🛡️</span> {selectedTeam || 'Squad'} <span className="font-normal text-gray-500 ml-2">| Squad Members</span>
                </h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#192236] text-gray-400 text-xs uppercase tracking-widest border-b border-gray-700">
                      <th className="p-4 font-bold text-center w-16">S.No.</th>
                      <th className="p-4 font-bold">Player Name</th>
                      <th className="p-4 font-bold">Role</th>
                      <th className="p-4 font-bold">Village/City</th>
                      <th className="p-4 font-bold text-center">Mobile No.</th>
                      <th className="p-4 font-bold text-right">Sold Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {squadPlayers.map((player, index) => (
                      <tr key={player._id} className={`hover:bg-[#0F172A] transition-colors ${player.isIcon ? 'bg-gradient-to-r from-yellow-900/20 to-transparent' : ''}`}>
                        <td className="p-4 text-center font-bold text-gray-500">{index + 1}</td>
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <img src={player.photoUrl || 'https://via.placeholder.com/50'} alt="p" className={`w-10 h-10 rounded-full object-cover shadow-sm ${player.isIcon ? 'border-2 border-yellow-400' : 'border border-gray-600'}`} />
                            <div>
                              <p className={`font-black text-base uppercase ${player.isIcon ? 'text-yellow-400' : 'text-white'}`}>
                                {player.name} {player.isIcon && '⭐'}
                              </p>
                              {player.isIcon && <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest">Icon Player</p>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-bold text-gray-300">{player.role}</td>
                        <td className="p-4 font-semibold text-gray-400">{player.city || '-'}</td>
                        <td className="p-4 text-center font-mono text-gray-400">{player.mobile}</td>
                        <td className="p-4 text-right font-black text-green-400 text-lg">₹{player.soldPrice?.toLocaleString()}</td>
                      </tr>
                    ))}
                    {squadPlayers.length === 0 && (
                      <tr>
                        <td colSpan="6" className="p-12 text-center text-gray-500 font-bold">
                          <div className="text-4xl mb-3">🕸️</div>
                          इस टीम ने अभी तक कोई खिलाड़ी नहीं ख़रीदा है।
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default Teams;