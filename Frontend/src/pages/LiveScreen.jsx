import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client'; 
import { TournamentContext } from '../context/TournamentContext'; 

const socket = io('http://localhost:5000'); 

function LiveScreen() {
  const navigate = useNavigate();
  const { tournament } = useContext(TournamentContext);
  
  // 🌟 अब स्क्रीन पूरी तरह से सॉकेट के कंट्रोल में है 🌟
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [liveBid, setLiveBid] = useState(0);
  const [liveTeam, setLiveTeam] = useState('');

  useEffect(() => {
    socket.on('updateAudienceScreen', (data) => {
      setLiveBid(data.bidAmount);
      setLiveTeam(data.teamName);
      // कंट्रोल पैनल से जो प्लेयर आएगा, वही स्क्रीन पर दिखेगा!
      if (data.player !== undefined) {
        setCurrentPlayer(data.player);
      }
    });

    return () => {
      socket.off('updateAudienceScreen');
    };
  }, []);

  if (!currentPlayer) {
    return (
       <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900 via-gray-900 to-black opacity-70 z-0"></div>
         
         <div className="relative z-10 flex flex-col items-center">
            {tournament?.logoUrl && <img src={tournament.logoUrl} alt="Logo" className="w-40 h-40 mb-8 rounded-full bg-white object-contain border-4 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.5)] animate-pulse" />}
            <h1 className="text-6xl font-black text-white tracking-[0.3em] uppercase italic mb-4">
                {tournament?.name || 'PREMIUM LEAGUE 2026'}
            </h1>
            <p className="text-3xl text-yellow-400 font-bold uppercase tracking-widest mt-6">Waiting for Auctioneer to start...</p>
         </div>
         
         <button onClick={() => navigate('/dashboard')} className="absolute top-6 right-6 bg-gray-800 px-6 py-2 rounded-xl font-bold hover:bg-gray-700 transition z-20 border border-gray-600">
           Exit
         </button>
       </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900 via-gray-900 to-black opacity-70 z-0"></div>

      <header className="relative z-10 p-4 px-8 flex justify-between items-center shadow-2xl bg-black bg-opacity-80 border-b-2 border-gray-700">
        <div className="flex items-center space-x-4">
            {tournament?.logoUrl ? (
                <img src={tournament.logoUrl} alt="logo" className="w-12 h-12 rounded-full bg-white object-contain border-2 border-yellow-400" />
            ) : (
                <div className="w-4 h-4 rounded-full bg-red-600 animate-pulse"></div>
            )}
            <h1 className="text-3xl font-extrabold text-white tracking-[0.3em] uppercase italic">
                {tournament?.name || 'PREMIUM LEAGUE 2026'}
            </h1>
        </div>
        
        {tournament?.venue && (
            <div className="text-gray-400 font-bold tracking-widest uppercase text-sm border border-gray-600 px-4 py-2 rounded-full">
                📍 {tournament.venue}
            </div>
        )}
        <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-white font-bold transition text-lg">Exit</button>
      </header>

      <main className="relative z-10 flex-grow flex p-8 gap-8 items-stretch">
         <div className="w-2/3 flex flex-col gap-6 justify-center">
            <div className="p-8 px-12 rounded-3xl bg-gradient-to-r from-blue-950 via-gray-900 to-gray-900 shadow-2xl border-l-8 border-purple-500">
               <h2 className="text-4xl font-bold text-gray-400 uppercase tracking-[0.4em] mb-4">Current Player</h2>
               <h1 className="text-9xl font-black text-white tracking-tighter capitalize drop-shadow-[0_0_20px_rgba(139,92,246,0.6)]">
                 {currentPlayer.name || 'Unknown'}
               </h1>
               <p className="text-4xl text-yellow-400 font-bold uppercase tracking-[0.3em] mt-3">
                 📍 {currentPlayer.city || 'Location Unknown'}
               </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
               <div className="bg-black bg-opacity-40 p-8 rounded-3xl border border-gray-700 shadow-inner flex flex-col justify-center">
                 <p className="text-gray-400 font-bold text-2xl uppercase tracking-wider mb-2">Role</p>
                 <p className="text-6xl font-black text-blue-400 drop-shadow-md">{currentPlayer.role || 'Unspecified'}</p>
               </div>
               <div className="bg-black bg-opacity-40 p-8 rounded-3xl border border-gray-700 shadow-inner flex flex-col justify-center">
                 <p className="text-gray-400 font-bold text-2xl uppercase tracking-wider mb-2">Base Price</p>
                 <p className="text-6xl font-black text-green-400 drop-shadow-md">₹ {(currentPlayer.basePrice || 0).toLocaleString()}</p>
               </div>
            </div>
            <div className={`p-10 rounded-3xl border-l-8 shadow-2xl transition-all duration-300 ${liveTeam ? 'border-yellow-500 bg-gradient-to-r from-yellow-950 via-gray-900 to-gray-900 shadow-[0_0_50px_rgba(234,179,8,0.2)]' : 'border-gray-600 bg-gray-900'}`}>
               <p className="text-gray-300 font-bold text-3xl uppercase tracking-wider mb-2">
                 {liveTeam ? 'Current Highest Bid' : 'Waiting for Opening Bid...'}
               </p>
               <p className="text-8xl font-black text-green-400 drop-shadow-md transition-all">
                 ₹ {liveBid.toLocaleString()}
               </p>
               {liveTeam && (
                 <div className="mt-4 flex justify-between items-center border-t border-yellow-800 pt-4">
                    <span className="text-gray-400 text-2xl font-bold uppercase tracking-widest">Highest Bidder</span>
                    <span className="text-5xl font-black text-yellow-400 animate-pulse tracking-tight capitalize">
                        {liveTeam}
                    </span>
                 </div>
               )}
            </div>
         </div>
         <div className="w-1/3 p-4 rounded-3xl bg-black bg-opacity-40 border border-gray-700 shadow-2xl relative flex items-center justify-center">
            <img 
               src={currentPlayer.photoUrl || 'https://via.placeholder.com/600x800?text=No+Player+Photo'} 
               alt={currentPlayer.name || 'Player'} 
               className="w-full h-full object-cover rounded-2xl shadow-[0_0_50px_rgba(59,130,246,0.3)] bg-gray-900"
               onError={(e) => { e.target.src = 'https://via.placeholder.com/600x800?text=No+Photo'; }}
            />
            <div className="absolute top-0 left-0 w-full h-full rounded-2xl bg-gradient-to-b from-transparent via-transparent to-black opacity-30"></div>
         </div>
      </main>
    </div>
  );
}

export default LiveScreen;