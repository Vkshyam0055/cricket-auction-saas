import React from 'react';

export default function PlayerStageCard({
  pickRandomPlayer,
  currentPlayer,
  playerStatus,
  hasBiddingStarted,
  players,
  biddingActive,
  handleToggleBidding,
  normalizeCategory,
  finalizePlayer,
  biddingTeam,
  getTeamLabel,
  currentBid,
  isActionProcessing = false,
  isAwaitingTeam = false,
}) {
  return (
            <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-3 flex flex-col justify-between overflow-hidden">
              <div>
                {/* NEXT PLAYER BUTTON */}
                <button
                  onClick={pickRandomPlayer}
                  disabled={isActionProcessing || Boolean(currentPlayer && playerStatus === 'bidding' && hasBiddingStarted && !isAwaitingTeam && Boolean(biddingTeam))}
                  className={`w-full text-white font-black text-xs lg:text-sm py-2 rounded-xl shadow-sm active:translate-y-0.5 transition-all mb-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                    playerStatus !== 'bidding' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isActionProcessing ? '⏳ Loading Next...' : playerStatus !== 'bidding' ? '📸 Next Player' : `🎲 Next Player (${players.length} Left)`}
                </button>

                {/* START / PAUSE BIDDING BUTTON */}
                {currentPlayer && playerStatus === 'bidding' && (
                  <button
                    onClick={handleToggleBidding}
                    className={`w-full text-white font-black text-xs lg:text-sm py-2.5 rounded-xl shadow-md active:translate-y-0.5 transition-all mb-2.5 flex items-center justify-center gap-2 cursor-pointer ${
                      biddingActive
                        ? 'bg-amber-600 hover:bg-amber-700 border-2 border-amber-400 text-white shadow-amber-600/30'
                        : 'bg-emerald-600 hover:bg-emerald-700 border-2 border-emerald-400 text-white ring-2 ring-emerald-500/40 shadow-emerald-600/30'
                    }`}
                  >
                    <span>{biddingActive ? '⏸️ Pause Bidding' : '▶️ Start Bidding'}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                        biddingActive ? 'bg-amber-950/50 text-amber-200' : 'bg-emerald-950/50 text-emerald-200'
                      }`}
                    >
                      {biddingActive ? 'Active' : 'Stopped'}
                    </span>
                  </button>
                )}

                {!currentPlayer ? (
                  <div className="text-center py-12 text-slate-400 font-bold text-xs border-2 border-dashed border-slate-200 rounded-xl">
                    No player on stage.<br />Click "Next Player" above to start bidding!
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-3 mb-2.5">
                      <img
                        src={currentPlayer.photoUrl || 'https://via.placeholder.com/150'}
                        alt="Player"
                        className="w-16 h-16 rounded-xl object-cover shadow-sm border-2 border-slate-100 shrink-0"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/150?text=No+Photo';
                        }}
                      />
                      <div className="min-w-0">
                        <h2 className="text-lg lg:text-xl font-black text-slate-900 capitalize truncate" title={currentPlayer.name}>
                          {currentPlayer.name}
                        </h2>
                        <p className="text-slate-500 font-semibold text-xs mt-0.5">
                          📍 {currentPlayer.city || 'Unknown'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                      <div className="flex justify-between items-center border-b border-slate-200/70 pb-1">
                        <span className="text-slate-500 font-bold uppercase text-[10px]">Role</span>
                        <span className="font-black text-blue-700 text-xs">{currentPlayer.role}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-200/70 pb-1">
                        <span className="text-slate-500 font-bold uppercase text-[10px]">Category</span>
                        <span className="font-black text-purple-700 text-xs">{normalizeCategory(currentPlayer.category)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold uppercase text-[10px]">Base Price</span>
                        <span className="font-black text-emerald-700 text-xs">₹{currentPlayer.basePrice.toLocaleString()}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* HAMMER SOLD / UNSOLD BUTTONS */}
              {currentPlayer && (
                <div className="mt-2.5">
                  {playerStatus === 'bidding' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => finalizePlayer('Sold')}
                        disabled={isActionProcessing || !biddingTeam || isAwaitingTeam}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs lg:text-sm py-2.5 rounded-xl shadow-sm active:translate-y-0.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isActionProcessing ? '⏳ Selling...' : 'SOLD 🔨'}
                      </button>
                      <button
                        onClick={() => finalizePlayer('Unsold')}
                        disabled={isActionProcessing || (hasBiddingStarted && !isAwaitingTeam && Boolean(biddingTeam))}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs lg:text-sm py-2.5 rounded-xl shadow-sm active:translate-y-0.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isActionProcessing ? '⏳ Processing...' : 'UNSOLD ❌'}
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`p-2 rounded-xl text-center border-2 ${
                        playerStatus === 'sold'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                          : 'bg-rose-50 border-rose-500 text-rose-900'
                      }`}
                    >
                      <h3 className="text-sm font-black uppercase tracking-wider">{playerStatus}</h3>
                      <p className="text-[11px] font-semibold mt-0.5 truncate">
                        {playerStatus === 'sold'
                          ? `Sold to ${getTeamLabel(biddingTeam)} for ₹${currentBid.toLocaleString()}`
                          : 'Player marked unsold'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
  );
}
