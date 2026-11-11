import React from 'react';

export default function BiddingControlBar({
  currentPlayer,
  currentBid,
  handleResetBid,
  activeBiddingTeamData,
  lastBidSource,
  latestRemoteToast,
  setLatestRemoteToast,
  jumpBidTeam,
  setJumpBidTeam,
  biddingTeam,
  resolveTeam,
  teams,
  formatCurrency,
  customBid,
  setCustomBid,
  handleCustomBidSubmit,
  biddingActive,
  directSellTeam,
  setDirectSellTeam,
  handleDirectBaseSell,
  isActionProcessing = false,
}) {
  return (
    <>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 pb-2 shrink-0 mb-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* CURRENT BID AMOUNT */}
                  <div className="flex items-center gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider block leading-none">
                        Current Highest Bid
                      </span>
                      <span className="text-2xl lg:text-3xl font-black text-emerald-600 leading-tight">
                        ₹{currentBid.toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={handleResetBid}
                      className="bg-white hover:bg-slate-100 p-1.5 rounded-lg border border-slate-300 transition text-xs shadow-xs"
                      title="Reset to Base Price"
                    >
                      🔄
                    </button>
                  </div>

                  {/* PROMINENT LEADING BIDDER BADGE & DETAILS */}
                  <div className="flex items-center gap-2 max-w-full">
                    {activeBiddingTeamData ? (
                      <div className="flex items-center gap-2 bg-white border border-amber-300 rounded-lg p-1.5 shadow-xs">
                        {activeBiddingTeamData.logoUrl || activeBiddingTeamData.logo ? (
                          <img
                            src={activeBiddingTeamData.logoUrl || activeBiddingTeamData.logo}
                            alt=""
                            className="w-8 h-8 rounded-md object-contain bg-slate-50 border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-amber-500 text-amber-950 font-black text-xs flex items-center justify-center shrink-0 uppercase">
                            {activeBiddingTeamData.shortName || activeBiddingTeamData.teamName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 pr-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-black text-slate-900 truncate max-w-[200px]" title={activeBiddingTeamData.teamName}>
                              {activeBiddingTeamData.teamName}
                            </span>
                            {activeBiddingTeamData.shortName && (
                              <span className="text-[10px] font-extrabold bg-slate-100 text-slate-600 px-1 py-0.2 rounded border border-slate-200">
                                {activeBiddingTeamData.shortName}
                              </span>
                            )}
                            {lastBidSource === 'remote' ? (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300 flex items-center gap-0.5 shadow-2xs">
                                📱 Remote
                              </span>
                            ) : (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5 shadow-2xs">
                                🏢 Onsite
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-600 font-semibold mt-0.5">
                            <span>Purse: <b className="text-emerald-700">₹{Number(activeBiddingTeamData.remainingPurse || 0).toLocaleString()}</b></span>
                            <span>Max Bid: <b className="text-amber-700">{formatCurrency(activeBiddingTeamData.maxBid)}</b></span>
                            <span>Need: <b>{activeBiddingTeamData.remainingRequiredPlayers}</b></span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 rounded-lg border border-dashed border-slate-300 bg-white text-slate-400 font-bold text-xs flex items-center gap-1.5">
                        <span>⏳ Waiting for opening bid...</span>
                        <span className="text-[10px] text-slate-500 font-normal">(Base: ₹{Number(currentPlayer?.basePrice || 0).toLocaleString()})</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 🌟 NON-BLOCKING REMOTE BID FEEDBACK TOAST 🌟 */}
              {latestRemoteToast && (
                <div className="bg-sky-50 border border-sky-300 text-sky-950 px-3 py-1.5 rounded-xl text-xs flex items-center justify-between shadow-xs mb-1 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📱</span>
                    <span className="font-semibold">
                      Remote Bid Placed: <span className="font-black text-sky-900">{latestRemoteToast.teamName} {latestRemoteToast.shortName ? `(${latestRemoteToast.shortName})` : ''}</span> bid <span className="font-black text-emerald-700">₹{latestRemoteToast.amount.toLocaleString()}</span>
                    </span>
                  </div>
                  <button
                    onClick={() => setLatestRemoteToast(null)}
                    className="text-sky-500 hover:text-sky-900 font-bold ml-2 text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* QUICK BIDS: JUMP BID & BASE SELL ROW */}
              <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <select
                    value={jumpBidTeam || (biddingTeam ? (resolveTeam(biddingTeam)?._id || '') : '')}
                    onChange={(e) => setJumpBidTeam(e.target.value)}
                    className="p-1 border border-slate-300 rounded-lg font-bold text-xs max-w-[150px] sm:max-w-[200px] truncate focus:border-blue-500 outline-none bg-white"
                    title="Select team for Jump Bid"
                  >
                    <option value="">{biddingTeam ? `-- Current: ${resolveTeam(biddingTeam)?.shortName || resolveTeam(biddingTeam)?.teamName} --` : '-- Select Team --'}</option>
                    {teams.map((team) => (
                      <option key={`jump-team-${team._id}`} value={team._id}>
                        {team.shortName ? `${team.shortName} - ` : ''}{team.teamName} (Max: {formatCurrency(team.maxBid || team.remainingPurse)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={customBid}
                    onChange={(e) => setCustomBid(e.target.value)}
                    placeholder="Custom ₹"
                    className="p-1 border border-slate-300 rounded-lg font-bold w-24 text-xs focus:border-blue-500 outline-none"
                  />
                  <button
                    onClick={handleCustomBidSubmit}
                    disabled={isActionProcessing || !biddingActive}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded-lg shadow-xs text-xs shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Jump
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={directSellTeam}
                    onChange={(e) => setDirectSellTeam(e.target.value)}
                    className="p-1 border border-slate-300 rounded-lg font-bold w-28 text-xs focus:border-emerald-500 outline-none"
                  >
                    <option value="">Team</option>
                    {teams.map((team) => (
                      <option key={`base-sell-${team._id}`} value={team._id}>
                        {team.shortName || team.teamName}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleDirectBaseSell}
                    disabled={isActionProcessing || !directSellTeam || !currentPlayer}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg shadow-xs text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isActionProcessing ? '⏳ Selling...' : 'Base Sell'}
                  </button>
                </div>
              </div>

    </>
  );
}
