import React from 'react';

export default function TeamAuctionGrid({
  teamSearch,
  setTeamSearch,
  teamFilter,
  setTeamFilter,
  filteredTeams,
  teams,
  biddingTeam,
  currentBid,
  lastBidSource,
  activeBiddingTeams,
  updateBid,
  btn1,
  btn2,
  btn3,
  biddingButtonsCount,
  formatCurrency,
  biddingActive,
}) {
  return (
    <>
              <div className="flex items-center justify-between gap-2 py-1.5 shrink-0">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <input
                    type="text"
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    placeholder="Search by name, code, owner..."
                    className="p-1 border border-slate-300 rounded-lg text-xs font-semibold w-48 outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center gap-1 text-[10px] font-bold">
                    <button
                      onClick={() => setTeamFilter('all')}
                      className={`px-2 py-0.5 rounded-md border ${
                        teamFilter === 'all'
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setTeamFilter('active-zone')}
                      className={`px-2 py-0.5 rounded-md border ${
                        teamFilter === 'active-zone'
                          ? 'bg-purple-700 text-white border-purple-700'
                          : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      Active ({activeBiddingTeams.length})
                    </button>
                    <button
                      onClick={() => setTeamFilter('can-bid')}
                      className={`px-2 py-0.5 rounded-md border ${
                        teamFilter === 'can-bid'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      Can Bid
                    </button>
                    <button
                      onClick={() => setTeamFilter('low-purse')}
                      className={`px-2 py-0.5 rounded-md border ${
                        teamFilter === 'low-purse'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                      }`}
                    >
                      Low Purse
                    </button>
                    {(teamSearch || teamFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setTeamSearch('');
                          setTeamFilter('all');
                        }}
                        className="px-1.5 py-0.5 rounded-md text-rose-600 bg-rose-50 border border-rose-200"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                  {filteredTeams.length}/{teams.length} Teams
                </span>
              </div>

              {/* 🌟 20–50+ TEAMS COMPACT GRID (REQUIREMENTS 2 & 4, PHASE 5) 🌟 */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 auto-rows-fr">
                  {filteredTeams.map((team) => {
                    const isHighestBidder = Boolean(biddingTeam) && (String(biddingTeam) === String(team._id) || biddingTeam === team.teamName);
                    return (
                      <div
                        key={team._id}
                        className={`rounded-lg border p-1.5 transition-all flex flex-col justify-between ${
                          isHighestBidder
                            ? 'border-amber-400 bg-amber-50/80 ring-2 ring-amber-400/30 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-blue-300 shadow-2xs'
                        }`}
                      >
                        {/* ROW 1: TEAM NAME & PURSE */}
                        <div className="flex justify-between items-center mb-0.5 gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {team.logoUrl || team.logo ? (
                              <img src={team.logoUrl || team.logo} alt="" className="w-5 h-5 rounded object-contain bg-white border border-slate-200 shrink-0" />
                            ) : (
                              <div className="w-5 h-5 rounded bg-gradient-to-br from-slate-700 to-slate-900 text-white font-black text-[9px] flex items-center justify-center shrink-0 uppercase">
                                {team.shortName || team.teamName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <h4 className="font-bold text-xs text-slate-900 truncate" title={team.teamName}>
                              {team.shortName || team.teamName}
                              {isHighestBidder && (
                                <span className="ml-1 text-[9px] text-amber-900 bg-amber-200/90 px-1 py-0.2 rounded font-black shrink-0">
                                  {lastBidSource === 'remote' ? '★ Leader (📱 Remote)' : '★ Leader (🏢 Onsite)'}
                                </span>
                              )}
                            </h4>
                          </div>
                          <span
                            className={`font-black text-xs shrink-0 ${
                              Number(team.remainingPurse || 0) < 50000 ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            ₹{Number(team.remainingPurse || 0).toLocaleString()}
                          </span>
                        </div>

                        {/* ROW 2: MAX BID & NEED */}
                        <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1 leading-tight">
                          <span className="font-semibold text-amber-700">Max: {formatCurrency(team.maxBid)}</span>
                          <span>Need {team.remainingRequiredPlayers}</span>
                        </div>

                        {/* ROW 3: 3 INCREMENT BUTTONS */}
                        <div className={`grid ${biddingButtonsCount === 1 ? 'grid-cols-1' : biddingButtonsCount === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-1`}>
                          {biddingButtonsCount >= 1 && (
                            <button
                              disabled={
                                !biddingActive ||
                                currentBid + btn1 > Number(team.maxBid || 0) ||
                                currentBid + btn1 > Number(team.remainingPurse || 0)
                              }
                              onClick={() => updateBid(team._id, btn1)}
                              className="bg-blue-50 text-blue-800 font-bold rounded py-0.5 text-[10px] hover:bg-blue-100 border border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
                            >
                              {formatCurrency(currentBid + btn1)}
                            </button>
                          )}
                          {biddingButtonsCount >= 2 && (
                            <button
                              disabled={
                                !biddingActive ||
                                currentBid + btn2 > Number(team.maxBid || 0) ||
                                currentBid + btn2 > Number(team.remainingPurse || 0)
                              }
                              onClick={() => updateBid(team._id, btn2)}
                              className="bg-blue-50 text-blue-800 font-bold rounded py-0.5 text-[10px] hover:bg-blue-100 border border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
                            >
                              {formatCurrency(currentBid + btn2)}
                            </button>
                          )}
                          {biddingButtonsCount >= 3 && (
                            <button
                              disabled={
                                !biddingActive ||
                                currentBid + btn3 > Number(team.maxBid || 0) ||
                                currentBid + btn3 > Number(team.remainingPurse || 0)
                              }
                              onClick={() => updateBid(team._id, btn3)}
                              className="bg-blue-50 text-blue-800 font-bold rounded py-0.5 text-[10px] hover:bg-blue-100 border border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
                            >
                              {formatCurrency(currentBid + btn3)}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredTeams.length === 0 && (
                  <div className="text-center py-6 text-xs font-semibold text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    No teams match search criteria.
                  </div>
                )}
              </div>
    </>
  );
}
