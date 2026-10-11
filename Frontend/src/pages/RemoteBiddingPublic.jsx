import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { apiRequest, getSocketBaseUrl } from '../utils/apiClient';

export default function RemoteBiddingPublic() {
  const [tournamentId, setTournamentId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [authData, setAuthData] = useState(() => {
    try {
      const stored = localStorage.getItem('remoteAuth');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const [socket, setSocket] = useState(null);
  const [auctionState, setAuctionState] = useState({
    currentPlayer: null,
    currentBid: 0,
    biddingTeamId: '',
    biddingTeamName: '',
    playerStatus: 'pending'
  });
  const [bidStatus, setBidStatus] = useState(null); // { loading: boolean, message: string, type: 'success' | 'error' }
  const [teamInfo, setTeamInfo] = useState(null);
  const [tournamentInfo, setTournamentInfo] = useState(null);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest({
        method: 'post',
        path: '/api/auth/team-login',
        data: { username, password, tournamentId }
      });
      
      localStorage.setItem('remoteAuth', JSON.stringify(data));
      setAuthData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('remoteAuth');
    setAuthData(null);
    if (socket) socket.disconnect();
  };

  // Socket and Initial Data Fetch
  useEffect(() => {
    if (!authData?.token) return;

    // Fetch team info safely via public route or authenticated route if exists
    // Since Phase 2.1 didn't create a specific /api/teams/me, we rely on the Live Screen state sync 
    // to populate basic team data, OR we can decode it. We'll rely on the socket.

    const newSocket = io(getSocketBaseUrl(), {
      auth: { token: authData.token }
    });

    newSocket.on('connect_error', (err) => {
      if (err.message === 'Unauthorized') handleLogout();
    });

    newSocket.on('sessionExpired', () => {
      handleLogout();
    });

    newSocket.on('updateAudienceScreen', (data) => {
      setAuctionState(prev => ({
        ...prev,
        currentPlayer: data.currentPlayer,
        currentBid: data.currentBid,
        biddingTeamId: data.biddingTeamId,
        biddingTeamName: data.biddingTeamName,
        playerStatus: data.playerStatus || 'bidding'
      }));
      setBidStatus(null); // Clear errors on new bid
    });

    newSocket.on('liveScreenConfigSync', (config) => {
      // Not strictly needed for Team Owner, but good to know connection is alive
    });

    // To get purse and maxBid, we need a way. If not provided natively via updateAudienceScreen,
    // we can decode JWT or wait for an update. Actually, ControlPanel doesn't broadcast purse.
    // We will do a REST fetch to get team details.
    apiRequest({
      method: 'get',
      path: '/api/auth/team-info',
      headers: { 'Authorization': `Bearer ${authData.token}` }
    })
    .then(data => {
       if (data && data.team) setTeamInfo(data.team);
       if (data && data.tournament) setTournamentInfo(data.tournament);
    }).catch(() => {});

    setSocket(newSocket);

    return () => newSocket.disconnect();
  }, [authData]);

  const handleBid = (amount) => {
    if (!socket || !auctionState.currentPlayer || auctionState.playerStatus !== 'bidding') return;
    
    setBidStatus({ loading: true, message: 'Placing bid...', type: 'info' });
    
    socket.emit('requestRemoteBid', {
      playerId: auctionState.currentPlayer._id,
      amount
    }, (response) => {
      if (response && response.success) {
        setBidStatus({ loading: false, message: response.message || 'Bid accepted', type: 'success' });
      } else {
        setBidStatus({ loading: false, message: response?.message || 'Bid rejected', type: 'error' });
      }
    });
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  if (!authData) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm border border-slate-200">
          <h1 className="text-2xl font-black text-slate-900 mb-6 text-center">Remote Bidding</h1>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg border border-red-200 text-center">{error}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Tournament ID</label>
              <input type="text" required value={tournamentId} onChange={e => setTournamentId(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 font-medium" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Username</label>
              <input type="text" required value={username} onChange={e => setUsername(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 font-medium" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 font-medium" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 text-white font-black rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
              {loading ? 'Authenticating...' : 'Join Auction'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Mobile-first Auction Screen
  const { currentPlayer, currentBid, biddingTeamId, playerStatus } = auctionState;
  
  // Calculate dynamic buttons if tournamentInfo is loaded
  const btn1 = tournamentInfo?.bidButton1 || 500;
  const btn2 = tournamentInfo?.bidButton2 || 1000;
  const btn3 = tournamentInfo?.bidButton3 || 5000;
  const btnCount = tournamentInfo?.biddingButtonsCount || 3;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col text-white select-none">
      <header className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center shrink-0">
        <div className="font-black text-lg text-indigo-400 truncate">{authData.team?.teamName || 'My Team'}</div>
        <button onClick={handleLogout} className="text-xs font-bold text-red-400 hover:text-red-300 bg-red-400/10 px-3 py-1.5 rounded-full">Logout</button>
      </header>

      {teamInfo && (
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700/50 flex justify-between text-xs font-bold text-slate-300 shrink-0">
          <div>Purse: <span className="text-white">{formatCurrency(teamInfo.remainingPurse)}</span></div>
          <div>Max Bid: <span className="text-white">{formatCurrency(teamInfo.maxBid)}</span></div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center relative">
        {!currentPlayer ? (
          <div className="text-slate-500 font-bold text-center">Waiting for auctioneer to start...</div>
        ) : (
          <div className="w-full max-w-sm flex flex-col items-center">
            {/* Player Info */}
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-700 bg-slate-800 mb-4 shadow-xl">
              {currentPlayer.photo ? (
                 <img src={currentPlayer.photo} className="w-full h-full object-cover" alt="player" />
              ) : (
                 <div className="w-full h-full flex items-center justify-center text-4xl text-slate-600 font-black">?</div>
              )}
            </div>
            <h2 className="text-2xl font-black text-white text-center mb-1">{currentPlayer.name}</h2>
            <div className="text-sm font-bold text-indigo-400 mb-6 flex gap-2">
              <span className="px-2 py-0.5 bg-indigo-900/50 rounded">{currentPlayer.role}</span>
              <span className="px-2 py-0.5 bg-slate-800 rounded">Base: {formatCurrency(currentPlayer.basePrice)}</span>
            </div>

            {/* Current Bid */}
            <div className="w-full bg-slate-800 rounded-2xl p-6 text-center shadow-lg border border-slate-700 mb-6">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Current Bid</div>
              <div className="text-4xl font-black text-amber-400 mb-2">{formatCurrency(currentBid || currentPlayer.basePrice)}</div>
              {biddingTeamId ? (
                <div className={`text-sm font-bold px-3 py-1 inline-block rounded-full ${biddingTeamId === teamInfo?._id ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-300'}`}>
                  {biddingTeamId === teamInfo?._id ? 'You are leading!' : auctionState.biddingTeamName || 'Another Team'}
                </div>
              ) : (
                <div className="text-sm font-bold text-slate-500">No bids yet</div>
              )}
            </div>

            {/* Status Feedback */}
            {bidStatus && (
              <div className={`w-full mb-4 px-4 py-2 rounded-lg text-center text-sm font-bold ${
                bidStatus.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                bidStatus.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {bidStatus.message}
              </div>
            )}

            {/* Bidding Controls */}
            {playerStatus === 'bidding' ? (
              <div className="w-full grid gap-3 grid-cols-1">
                {btnCount >= 1 && (
                  <button onClick={() => handleBid(btn1)} disabled={bidStatus?.loading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50">
                    Bid +{formatCurrency(btn1)}
                  </button>
                )}
                {btnCount >= 2 && (
                  <button onClick={() => handleBid(btn2)} disabled={bidStatus?.loading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50">
                    Bid +{formatCurrency(btn2)}
                  </button>
                )}
                {btnCount >= 3 && (
                  <button onClick={() => handleBid(btn3)} disabled={bidStatus?.loading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50">
                    Bid +{formatCurrency(btn3)}
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full py-4 bg-slate-800 text-slate-400 font-black rounded-xl text-center uppercase tracking-widest border border-slate-700">
                {playerStatus === 'sold' ? 'Sold!' : playerStatus === 'unsold' ? 'Unsold' : 'Bidding Closed'}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
