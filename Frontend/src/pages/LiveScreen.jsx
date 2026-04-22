import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { TournamentContext } from '../context/TournamentContext';
import { getSocketBaseUrl } from '../utils/apiClient';

const DISPLAY_MODES = {
  day: {
    page: 'bg-slate-100 text-slate-900',
    gradient: 'from-white via-sky-100 to-slate-200 opacity-90',
    panel: 'bg-white/90 border-slate-300',
    strongPanel: 'bg-white/95 border-sky-500',
    mutedText: 'text-slate-600',
    headingText: 'text-slate-900',
    bidText: 'text-emerald-600',
    bidderText: 'text-amber-600'
  },
  night: {
    page: 'bg-black text-white',
    gradient: 'from-blue-900 via-gray-900 to-black opacity-70',
    panel: 'bg-black/40 border-gray-700',
    strongPanel: 'bg-gradient-to-r from-blue-950 via-gray-900 to-gray-900 border-purple-500',
    mutedText: 'text-gray-400',
    headingText: 'text-white',
    bidText: 'text-green-400',
    bidderText: 'text-yellow-400'
  },
  projector: {
    page: 'bg-white text-black',
    gradient: 'from-yellow-50 via-white to-blue-50 opacity-95',
    panel: 'bg-white/95 border-gray-300',
    strongPanel: 'bg-white border-indigo-600',
    mutedText: 'text-gray-700',
    headingText: 'text-black',
    bidText: 'text-green-700',
    bidderText: 'text-indigo-700'
  }
};

const PHOTO_SIZE_CLASS = {
  small: 'lg:w-[28%]',
  medium: 'lg:w-[34%]',
  large: 'lg:w-[40%]'
};

function LiveScreen() {
  const navigate = useNavigate();
  const { tournament } = useContext(TournamentContext);

  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [liveBid, setLiveBid] = useState(0);
  const [liveTeam, setLiveTeam] = useState('');
  const [playerStatus, setPlayerStatus] = useState('bidding');

  const [displayMode, setDisplayMode] = useState('night');
  const [photoSize, setPhotoSize] = useState('medium');
  const [screenView, setScreenView] = useState('live');
  const [breakView, setBreakView] = useState('teams-dashboard');
  const lastConfigVersionRef = useRef(0);

  const [teams, setTeams] = useState([]);
  const [soldPlayers, setSoldPlayers] = useState([]);
  const [squadsByTeam, setSquadsByTeam] = useState({});
  const [summary, setSummary] = useState({
    totalTeams: 0,
    soldPlayers: 0,
    unsoldPlayers: 0,
    readyForAuction: 0,
    totalSoldValue: 0
  });
  const [topBiddings, setTopBiddings] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const socket = io(getSocketBaseUrl(), {
      auth: { token }
    });

    socket.on('updateAudienceScreen', (data) => {
      setLiveBid(data.bidAmount || 0);
      setLiveTeam(data.teamName || '');
      setPlayerStatus(data.status || 'bidding');
      if (data.player !== undefined) {
        setCurrentPlayer(data.player);
      }
    });

    const applyScreenConfig = (config) => {
      if (!config) return;
      const incomingVersion = Number(config.version || 0);
      if (incomingVersion < lastConfigVersionRef.current) return;
      lastConfigVersionRef.current = incomingVersion;
      setDisplayMode(config.displayMode || 'night');
      setPhotoSize(config.photoSize || 'medium');
      setScreenView(config.screenView === 'break' ? 'break' : 'live');
      setBreakView(config.breakView || 'teams-dashboard');
    };

    socket.on('liveScreenConfigSync', applyScreenConfig);
    socket.on('liveScreenConfigUpdate', applyScreenConfig);
    socket.on('breakDataSnapshotSync', (snapshot) => {
      if (!snapshot) return;
      setTeams(Array.isArray(snapshot.teams) ? snapshot.teams : []);
      setSoldPlayers(Array.isArray(snapshot.soldPlayers) ? snapshot.soldPlayers : []);
      setSquadsByTeam(snapshot.squadsByTeam || {});
      setSummary(snapshot.summary || {});
      setTopBiddings(Array.isArray(snapshot.topBiddings) ? snapshot.topBiddings : []);
    });
    socket.on('breakDataSnapshotUpdate', (snapshot) => {
      if (!snapshot) return;
      setTeams(Array.isArray(snapshot.teams) ? snapshot.teams : []);
      setSoldPlayers(Array.isArray(snapshot.soldPlayers) ? snapshot.soldPlayers : []);
      setSquadsByTeam(snapshot.squadsByTeam || {});
      setSummary(snapshot.summary || {});
      setTopBiddings(Array.isArray(snapshot.topBiddings) ? snapshot.topBiddings : []);
    });

    return () => {
      socket.off('updateAudienceScreen');
      socket.off('liveScreenConfigSync');
      socket.off('liveScreenConfigUpdate');
      socket.off('breakDataSnapshotSync');
      socket.off('breakDataSnapshotUpdate');
      socket.disconnect();
    };
  }, []);

  const modeTheme = DISPLAY_MODES[displayMode] || DISPLAY_MODES.night;
  const photoWidthClass = PHOTO_SIZE_CLASS[photoSize] || PHOTO_SIZE_CLASS.medium;
  const effectiveScreenView = playerStatus !== 'bidding' ? 'live' : screenView;

  const renderBreakView = () => {
    if (breakView === 'squad-list') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.entries(squadsByTeam).length === 0 ? (
            <div className={`rounded-2xl border p-6 text-center font-bold ${modeTheme.panel}`}>
              Squad list will appear after players are sold.
            </div>
          ) : (
            Object.entries(squadsByTeam).map(([teamName, players]) => (
              <div key={teamName} className={`rounded-2xl border p-5 ${modeTheme.panel}`}>
                <h3 className="text-2xl font-black mb-3">{teamName}</h3>
                <div className="space-y-1 max-h-64 overflow-auto">
                  {players.map((player) => (
                    <p key={player._id} className="font-semibold text-sm">
                      {player.name} • ₹{Number(player.soldPrice || 0).toLocaleString()}
                    </p>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      );
    }

    if (breakView === 'tournament-summary') {
      return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Teams', value: summary.totalTeams || 0 },
            { label: 'Sold Players', value: summary.soldPlayers || 0 },
            { label: 'Unsold Players', value: summary.unsoldPlayers || 0 },
            { label: 'Ready For Auction', value: summary.readyForAuction || 0 },
            { label: 'Total Sold Value', value: `₹${Number(summary.totalSoldValue || 0).toLocaleString()}` }
          ].map((item) => (
            <div key={item.label} className={`rounded-2xl border p-5 ${modeTheme.panel}`}>
              <p className={`text-xs uppercase font-black tracking-widest ${modeTheme.mutedText}`}>{item.label}</p>
              <p className="text-3xl mt-2 font-black">{item.value}</p>
            </div>
          ))}
        </div>
      );
    }

    if (breakView === 'top-biddings') {
      return (
        <div className={`rounded-2xl border p-5 ${modeTheme.panel}`}>
          <h3 className="text-2xl font-black mb-3">Top Biddings</h3>
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {topBiddings.length === 0 ? (
              <p className="font-semibold">No sold players yet.</p>
            ) : (
              topBiddings.map((player, index) => (
                <div key={player._id} className="flex items-center justify-between border-b border-dashed pb-2">
                  <p className="font-bold">#{index + 1} {player.name} <span className={`text-xs ${modeTheme.mutedText}`}>({player.soldTo || '-'})</span></p>
                  <p className="text-xl font-black">₹{Number(player.soldPrice || 0).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={`rounded-2xl border p-5 ${modeTheme.panel}`}>
        <h3 className="text-2xl font-black mb-3">Teams Dashboard</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {teams.map((team) => (
            <div key={team._id} className={`rounded-xl border p-4 ${modeTheme.strongPanel}`}>
              <p className="text-lg font-black">{team.teamName}</p>
              <p className={`text-sm mt-1 ${modeTheme.mutedText}`}>Purse: ₹{Number(team.remainingPurse || 0).toLocaleString()}</p>
              <p className={`text-sm ${modeTheme.mutedText}`}>Max Bid: ₹{Number(team.maxBid || 0).toLocaleString()}</p>
              <p className={`text-sm ${modeTheme.mutedText}`}>Need Players: {team.remainingRequiredPlayers ?? '-'}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!currentPlayer && screenView === 'live') {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-8 text-center relative overflow-hidden ${modeTheme.page}`}>
        <div className={`absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] ${modeTheme.gradient} z-0`} />
        <div className="relative z-10 flex flex-col items-center">
          {tournament?.logoUrl && <img src={tournament.logoUrl} alt="Logo" className="w-40 h-40 mb-8 rounded-full bg-white object-contain border-4 border-yellow-400" />}
          <h1 className="text-5xl lg:text-6xl font-black uppercase mb-4">{tournament?.name || 'PREMIUM LEAGUE 2026'}</h1>
          <p className="text-2xl lg:text-3xl font-bold uppercase mt-6">Waiting for Auctioneer to start...</p>
        </div>
        <button onClick={() => navigate('/dashboard')} className="absolute top-6 right-6 bg-gray-800 text-white px-6 py-2 rounded-xl font-bold hover:bg-gray-700 transition z-20">Exit</button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col relative overflow-hidden font-sans transition-colors duration-500 ${modeTheme.page}`}>
      <div className={`absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] ${modeTheme.gradient} z-0`} />

      <header className={`relative z-10 p-4 px-4 lg:px-8 flex justify-between items-center shadow-2xl border-b ${modeTheme.panel}`}>
        <div className="flex items-center space-x-3 lg:space-x-4">
          {tournament?.logoUrl ? (
            <img src={tournament.logoUrl} alt="logo" className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-white object-contain border-2 border-yellow-400" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-red-600 animate-pulse" />
          )}
          <h1 className="text-xl lg:text-3xl font-extrabold tracking-wider uppercase">{tournament?.name || 'PREMIUM LEAGUE 2026'}</h1>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          <span className={`text-xs lg:text-sm font-black uppercase px-3 py-1 rounded-full border ${modeTheme.panel}`}>
            {effectiveScreenView === 'break' ? 'Break Mode' : 'Live Mode'}
          </span>
          <button onClick={() => navigate('/dashboard')} className="text-sm lg:text-lg font-bold">Exit</button>
        </div>
      </header>

      <main className="relative z-10 flex-grow p-4 lg:p-8">
        <div className={`transition-all duration-500 ${effectiveScreenView === 'break' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0 p-4 lg:p-8'}`}>
          <div className="mb-4">
            <h2 className="text-3xl lg:text-5xl font-black uppercase tracking-wider">{breakView.replace('-', ' ')}</h2>
          </div>
          {renderBreakView()}
        </div>

        <div className={`transition-all duration-500 ${effectiveScreenView === 'live' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0 p-4 lg:p-8'}`}>
          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            <div className={`${photoWidthClass} order-1 lg:order-2 p-3 rounded-3xl border shadow-2xl relative flex items-center justify-center ${modeTheme.panel}`}>
              <img
                src={currentPlayer?.photoUrl || 'https://via.placeholder.com/700x900?text=No+Player+Photo'}
                alt={currentPlayer?.name || 'Player'}
                className="w-full h-full min-h-[350px] max-h-[78vh] object-cover rounded-2xl"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/700x900?text=No+Photo'; }}
              />
            </div>

            <div className="flex-1 order-2 lg:order-1 flex flex-col gap-4 lg:gap-6 justify-center">
              <div className={`p-6 lg:p-8 rounded-3xl border-l-8 shadow-2xl ${modeTheme.strongPanel}`}>
                <h2 className={`text-xl lg:text-3xl font-bold uppercase tracking-widest mb-3 ${modeTheme.mutedText}`}>Current Player</h2>
                <h1 className={`text-4xl lg:text-7xl xl:text-8xl font-black capitalize ${modeTheme.headingText}`}>{currentPlayer?.name || 'Unknown'}</h1>
                <p className="text-2xl lg:text-3xl font-bold mt-3">📍 {currentPlayer?.city || 'Location Unknown'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-6 rounded-2xl border ${modeTheme.panel}`}>
                  <p className={`font-bold text-base uppercase tracking-wider mb-1 ${modeTheme.mutedText}`}>Role</p>
                  <p className="text-3xl lg:text-4xl font-black">{currentPlayer?.role || 'Unspecified'}</p>
                </div>
                <div className={`p-6 rounded-2xl border ${modeTheme.panel}`}>
                  <p className={`font-bold text-base uppercase tracking-wider mb-1 ${modeTheme.mutedText}`}>Base Price</p>
                  <p className="text-3xl lg:text-4xl font-black">₹ {(currentPlayer?.basePrice || 0).toLocaleString()}</p>
                </div>
              </div>

              <div className={`p-6 lg:p-8 rounded-3xl border-l-8 shadow-2xl ${liveTeam ? modeTheme.strongPanel : modeTheme.panel}`}>
                <p className={`font-bold text-xl uppercase tracking-wider mb-2 ${modeTheme.mutedText}`}>
                  {liveTeam ? 'Current Highest Bid' : 'Waiting for Opening Bid...'}
                </p>
                <p className={`text-5xl lg:text-7xl font-black ${modeTheme.bidText}`}>₹ {liveBid.toLocaleString()}</p>
                {liveTeam && (
                  <div className="mt-3 flex justify-between items-center border-t pt-3">
                    <span className={`text-base lg:text-xl font-bold uppercase ${modeTheme.mutedText}`}>Highest Bidder</span>
                    <span className={`text-3xl lg:text-4xl font-black capitalize ${modeTheme.bidderText}`}>{liveTeam}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {effectiveScreenView === 'live' && playerStatus !== 'bidding' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm">
          <div className={`transform -rotate-6 border-8 rounded-3xl p-8 lg:p-12 text-center ${playerStatus === 'sold' ? 'border-green-500 text-green-500 bg-black/50' : 'border-red-600 text-red-600 bg-black/50'}`}>
            <h1 className="text-6xl lg:text-[140px] font-black uppercase leading-none">{playerStatus}</h1>
            {playerStatus === 'sold' && liveTeam && (
              <div className="mt-4 bg-green-500 text-black px-6 py-3 rounded-xl inline-block">
                <p className="text-3xl lg:text-4xl font-black uppercase">{liveTeam}</p>
                <p className="text-4xl lg:text-5xl font-black mt-2">₹ {liveBid.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveScreen;