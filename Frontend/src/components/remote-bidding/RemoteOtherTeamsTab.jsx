export default function RemoteOtherTeamsTab({
  otherTeamsData,
  searchQuery,
  setSearchQuery,
  tabLoading,
  expandedTeamId,
  setExpandedTeamId,
  formatCurrency,
}) {
  return (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>👥</span> Other Tournament Teams
              </h2>
              <span className="text-xs font-bold text-slate-400">{otherTeamsData.length} Teams</span>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teams by name..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder-slate-500 outline-none focus:border-indigo-500"
            />

            {(tabLoading && (!otherTeamsData || otherTeamsData.length === 0)) ? (
              <div className="text-center py-8 text-xs font-bold text-slate-500">Loading other teams...</div>
            ) : (
              <div className="space-y-2">
                {otherTeamsData
                  .filter((t) => {
                    const q = searchQuery.trim().toLowerCase();
                    return !q || t.teamName?.toLowerCase().includes(q) || t.shortName?.toLowerCase().includes(q);
                  })
                  .map((team) => {
                    const isExpanded = expandedTeamId === team._id;
                    return (
                      <div
                        key={team._id}
                        className={`bg-slate-900 border rounded-xl overflow-hidden transition ${
                          team.isMyTeam ? 'border-indigo-500/50 bg-indigo-950/20' : 'border-slate-800'
                        }`}
                      >
                        <div
                          onClick={() => setExpandedTeamId(isExpanded ? null : team._id)}
                          className="p-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-850/50 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {team.logoUrl ? (
                              <img src={team.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain bg-slate-800 p-0.5 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-800 text-indigo-400 font-black text-xs flex items-center justify-center shrink-0">
                                {team.shortName || team.teamName?.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <h4 className="font-black text-xs text-white truncate">
                                {team.teamName} {team.isMyTeam && <span className="text-indigo-400 text-[10px]">(My Team)</span>}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                Purse: <b className="text-emerald-400">{formatCurrency(team.remainingPurse)}</b> • Squad: <b>{team.squadCount}</b>
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-slate-500 font-bold shrink-0">{isExpanded ? '▲' : '▼'}</span>
                        </div>

                        {/* EXPANDABLE SQUAD LIST */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 border-t border-slate-800/80 bg-slate-950/40 space-y-1.5">
                            {team.squad?.length === 0 ? (
                              <p className="text-[11px] text-slate-500 font-medium py-1">No players bought yet.</p>
                            ) : (
                              team.squad?.map((p) => (
                                <div key={p._id} className="flex justify-between items-center text-[11px] font-semibold text-slate-300 py-0.5 border-b border-slate-850">
                                  <span>{p.name} <span className="text-[10px] text-slate-500">({p.role || 'P'})</span></span>
                                  <span className="font-black text-emerald-400">{formatCurrency(p.soldPrice)}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
  );
}
