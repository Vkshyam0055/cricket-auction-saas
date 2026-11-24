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
  formatCurrency,
  biddingActive,
  isAwaitingTeam = false,
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
                    const isHighestBidder = !isAwaitingTeam && Boolean(biddingTeam) && (String(biddingTeam) === String(team._id) || biddingTeam === team.teamName);
                    const isSquadFull = team.remainingRequiredPlayers !== undefined && team.remainingRequiredPlayers <= 0;
                    const hasInsufficientPurse = currentBid > Number(team.remainingPurse || 0);
                    const exceedsMaxBid = currentBid > Number(team.maxBid || 0);
                    const canTeamBid = biddingActive && !isSquadFull && !hasInsufficientPurse && !exceedsMaxBid && !isHighestBidder;

                    return (
                      <div
                        key={team._id}
                        onClick={() => {
                          if (canTeamBid) updateBid(team._id);
                        }}
                        className={`rounded-lg border p-1.5 transition-all flex flex-col justify-between ${canTeamBid ? 'cursor-pointer hover:shadow-sm' : ''} ${
                          isHighestBidder
                            ? 'border-amber-400 bg-amber-50/80 ring-2 ring-amber-400/30 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-blue-300 shadow-2xs'
                        }`}
                      >
                        {/* Team identity and purse */}
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
                              {team.teamName}
                              {team.shortName && (
                                <span className="ml-1 text-[9px] text-slate-500 font-extrabold">({team.shortName})</span>
                              )}
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

                        <div
                          className={`h-5 rounded-md flex items-center justify-center text-[11px] font-black ${
                            canTeamBid ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                          }`}
                          title={canTeamBid ? 'Click this team card to place the server-calculated next bid.' : 'This team is not eligible for the current bid.'}
                          aria-label={canTeamBid ? `Select ${team.teamName} for the next bid` : `${team.teamName} is unavailable`}
                        >
                          {isHighestBidder ? '♛' : isAwaitingTeam ? '⚡' : '▲'}
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
