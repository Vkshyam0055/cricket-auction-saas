export default function RemoteLiveTab({
  currentPlayer,
  currentBid,
  biddingTeamId,
  isMyTeamLeading,
  auctionState,
  bidStatus,
  playerStatus,
  biddingActive,
  btnCount,
  btn1,
  btn2,
  btn3,
  handleBid,
  effectiveMaxBid,
  teamInfo,
  formatCurrency,
}) {
  return (
          <div className="flex-1 flex flex-col justify-between">
            {!currentPlayer ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <span className="text-4xl mb-3">⏳</span>
                <h3 className="text-base font-black text-slate-400">Waiting for Auctioneer</h3>
                <p className="text-xs font-medium text-slate-500 mt-1 max-w-xs">
                  The auction operator has not placed a player on the bidding stage yet. Please wait...
                </p>
              </div>
            ) : (
              <div className="flex flex-col flex-1">
                {/* ACTIVE PLAYER STAGE CARD */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg mb-3">
                  <div className="flex items-center gap-3.5 mb-3">
                    <img
                      src={currentPlayer.photoUrl || currentPlayer.photo || 'https://via.placeholder.com/150?text=Player'}
                      alt={currentPlayer.name}
                      className="w-20 h-20 rounded-2xl object-cover bg-slate-800 border-2 border-indigo-500/40 shadow-md shrink-0"
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/150?text=Player';
                      }}
                    />
                    <div className="min-w-0">
                      <h2 className="text-xl font-black text-white capitalize truncate" title={currentPlayer.name}>
                        {currentPlayer.name}
                      </h2>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {currentPlayer.role || 'Player'}
                        </span>
                        {currentPlayer.category && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {currentPlayer.category}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-slate-400 mt-1.5">
                        Base Price: <span className="text-emerald-400 font-extrabold">{formatCurrency(currentPlayer.basePrice)}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* CURRENT BID & HIGHEST BIDDER CARD */}
                <div className="bg-gradient-to-b from-slate-900 to-slate-900/90 border border-slate-800 rounded-2xl p-4 text-center shadow-lg mb-3">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest block mb-1">
                    Current Highest Bid
                  </span>
                  <div className="text-3xl font-black text-amber-400 mb-2">
                    {formatCurrency(currentBid || currentPlayer.basePrice)}
                  </div>

                  {biddingTeamId ? (
                    <div
                      className={`text-xs font-black px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 border ${
                        isMyTeamLeading
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {isMyTeamLeading ? (
                        <>
                          <span>🎉</span>
                          <span>Your Team is Leading!</span>
                        </>
                      ) : (
                        <>
                          <span>Leading:</span>
                          <span className="text-white">{auctionState.biddingTeamName || 'Opponent Team'}</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-slate-500">No bids placed yet</div>
                  )}
                </div>

                {/* STATUS / ERROR NOTIFICATION */}
                {bidStatus && (
                  <div
                    className={`mb-3 px-3.5 py-2 rounded-xl text-center text-xs font-black border transition ${
                      bidStatus.type === 'error'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : bidStatus.type === 'success'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    }`}
                  >
                    {bidStatus.message}
                  </div>
                )}

                {/* BIDDING BUTTONS ROW (PHASE 6: EXACT INCREMENTS ONLY, NO CUSTOM BIDS) */}
                <div className="mt-auto">
                  {playerStatus === 'bidding' ? (
                    <div className="space-y-2">
                      {!biddingActive && (
                        <div className="w-full py-4 px-4 rounded-xl text-center font-bold border bg-amber-500/20 text-amber-200 border-amber-500/40">
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="text-base">⏸️</span>
                            <span className="font-black text-xs sm:text-sm uppercase tracking-wide">Bidding is Paused</span>
                          </div>
                          <p className="text-[11px] text-amber-300/80">
                            The organizer has paused bidding for this player. Bids are temporarily disabled.
                          </p>
                        </div>
                      )}

                      {isMyTeamLeading && biddingActive && (
                        <p className="text-[11px] font-bold text-emerald-400 text-center mb-1">
                          ✓ You currently hold the highest bid
                        </p>
                      )}

                      <div className="grid grid-cols-1 gap-2">
                        {btnCount >= 1 && (
                          <button
                            onClick={() => handleBid(btn1)}
                            disabled={
                              !biddingActive ||
                              bidStatus?.loading ||
                              isMyTeamLeading ||
                              currentBid + btn1 > effectiveMaxBid ||
                              currentBid + btn1 > Number(teamInfo?.remainingPurse || 0)
                            }
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-98 text-white font-black rounded-xl shadow-lg shadow-indigo-600/30 transition disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm flex items-center justify-between px-4 cursor-pointer"
                          >
                            <span>Bid +{formatCurrency(btn1)}</span>
                            <span className="text-indigo-200 text-xs">Next: {formatCurrency(currentBid + btn1)}</span>
                          </button>
                        )}

                        {btnCount >= 2 && (
                          <button
                            onClick={() => handleBid(btn2)}
                            disabled={
                              !biddingActive ||
                              bidStatus?.loading ||
                              isMyTeamLeading ||
                              currentBid + btn2 > effectiveMaxBid ||
                              currentBid + btn2 > Number(teamInfo?.remainingPurse || 0)
                            }
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-98 text-white font-black rounded-xl shadow-lg shadow-indigo-600/30 transition disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm flex items-center justify-between px-4 cursor-pointer"
                          >
                            <span>Bid +{formatCurrency(btn2)}</span>
                            <span className="text-indigo-200 text-xs">Next: {formatCurrency(currentBid + btn2)}</span>
                          </button>
                        )}

                        {btnCount >= 3 && (
                          <button
                            onClick={() => handleBid(btn3)}
                            disabled={
                              !biddingActive ||
                              bidStatus?.loading ||
                              isMyTeamLeading ||
                              currentBid + btn3 > effectiveMaxBid ||
                              currentBid + btn3 > Number(teamInfo?.remainingPurse || 0)
                            }
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-98 text-white font-black rounded-xl shadow-lg shadow-indigo-600/30 transition disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm flex items-center justify-between px-4 cursor-pointer"
                          >
                            <span>Bid +{formatCurrency(btn3)}</span>
                            <span className="text-indigo-200 text-xs">Next: {formatCurrency(currentBid + btn3)}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`w-full py-4 rounded-xl text-center font-black uppercase tracking-wider text-sm border ${
                        playerStatus === 'sold'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {playerStatus === 'sold' ? 'Player Sold!' : 'Player Marked Unsold'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
  );
}
