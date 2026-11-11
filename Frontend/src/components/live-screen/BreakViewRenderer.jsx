import React from 'react';

export default function BreakViewRenderer({
  breakView,
  displayMode = 'night',
  soldPlayers = [],
  selectedSquadTeam,
  resolveTeam,
  teams,
  squadsByTeam,
  summary,
  topBiddings,
  modeTheme,
  getTeamLogo,
  getTeamFullName,
  getTeamShortName
}) {

    /* ========================================================================= */
    /* 🌟 1. SQUAD VIEW (REQUIREMENT 7) - UP TO 20 PLAYERS, NON-SCROLLABLE 🌟 */
    /* ========================================================================= */
    if (breakView === 'squad-list') {
      const currentTeamObj = resolveTeam(selectedSquadTeam) || teams[0];
      const activeTeamName = currentTeamObj?.teamName || '';
      const teamSquadPlayers = (currentTeamObj?._id && squadsByTeam[String(currentTeamObj._id)]) ||
                               squadsByTeam[activeTeamName] || [];
      const totalTeamSpent = teamSquadPlayers.reduce((sum, p) => sum + Number(p.soldPrice || 0), 0);
      const totalPurse = Number(currentTeamObj?.totalPurse || 0);
      const remainingPurse = Number(currentTeamObj?.remainingPurse || 0);
      const spentPercent = totalPurse > 0 ? Math.round((totalTeamSpent / totalPurse) * 100) : 0;
      const maxSquadSlots = Number(currentTeamObj?.remainingRequiredPlayers || 0) + teamSquadPlayers.length;

      // Role breakdown from acquired players
      const roleBreakdown = teamSquadPlayers.reduce((acc, p) => {
        const role = p.role || 'Unknown';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {});

      // Recently acquired (last 3 by list order — most recent at end)
      const recentBuys = teamSquadPlayers.slice(-3).reverse();

      if (!activeTeamName) {
        return (
          <div className={`h-full flex items-center justify-center rounded-2xl border p-8 font-bold text-base ${modeTheme.panel}`}>
            No team squad data available.
          </div>
        );
      }

      return (
        <div className="h-full flex flex-col min-h-0 overflow-hidden gap-2">
          {/* ══════ TEAM HEADER BANNER ══════ */}
          <div className={`rounded-xl border px-4 lg:px-5 py-2.5 flex items-center justify-between gap-4 shadow-lg shrink-0 ${modeTheme.strongPanel}`}>
            <div className="flex items-center gap-3 min-w-0">
              {currentTeamObj?.logoUrl ? (
                <img src={currentTeamObj.logoUrl} alt={activeTeamName} className="w-11 h-11 rounded-xl object-cover bg-white/10 border-2 border-amber-400 shadow-md shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white font-black text-lg flex items-center justify-center shadow-md shrink-0 border border-indigo-400/30">
                  {currentTeamObj?.shortName || activeTeamName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <span className={`text-[9px] uppercase font-black tracking-[0.2em] block ${modeTheme.mutedText}`}>Team Squad</span>
                <h2 className="text-lg lg:text-2xl font-black uppercase tracking-wide truncate">{activeTeamName}</h2>
              </div>
              {currentTeamObj?.shortName && (
                <span className={`text-xs font-black px-2 py-0.5 rounded-md border ml-1 shrink-0 ${modeTheme.panel}`}>{currentTeamObj.shortName}</span>
              )}
            </div>

            {/* 4 Metric Badges */}
            <div className="flex items-center gap-1 shrink-0">
              {[
                { label: 'Players', value: teamSquadPlayers.length, sub: maxSquadSlots > 0 ? `/ ${maxSquadSlots}` : '', color: 'text-blue-400' },
                { label: 'Spent', value: `₹${totalTeamSpent.toLocaleString()}`, sub: '', color: 'text-amber-400' },
                { label: 'Purse Left', value: `₹${remainingPurse.toLocaleString()}`, sub: '', color: 'text-emerald-400' },
                { label: 'Slots Left', value: Number(currentTeamObj?.remainingRequiredPlayers || 0), sub: '', color: 'text-purple-400' }
              ].map((m) => (
                <div key={m.label} className={`text-center px-3 lg:px-4 py-1 border-l first:border-l-0 border-white/10 ${displayMode === 'day' ? 'border-slate-300' : displayMode === 'projector' ? 'border-gray-300' : ''}`}>
                  <span className={`text-[9px] uppercase font-bold block tracking-wider ${modeTheme.mutedText}`}>{m.label}</span>
                  <span className={`text-base lg:text-lg font-black ${m.color}`}>{m.value}<span className={`text-[10px] font-bold ${modeTheme.mutedText}`}>{m.sub}</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* ══════ MAIN 3-COLUMN BODY ══════ */}
          <div className="flex-1 min-h-0 grid grid-cols-12 gap-2 overflow-hidden">

            {/* LEFT SIDEBAR: Role Breakdown + Purse Overview */}
            <div className="col-span-3 flex flex-col gap-2 min-h-0 overflow-hidden">
              {/* Role Breakdown */}
              <div className={`rounded-xl border p-3 shadow-sm flex-1 min-h-0 flex flex-col ${modeTheme.panel}`}>
                <span className={`text-[9px] uppercase font-black tracking-widest block mb-2 ${modeTheme.mutedText}`}>Squad Composition</span>
                <div className="flex-1 flex flex-col justify-center gap-1.5">
                  {Object.keys(roleBreakdown).length > 0 ? (
                    Object.entries(roleBreakdown).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
                      <div key={role} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-sm">
                            {role.toLowerCase().includes('bat') ? '🏏' : role.toLowerCase().includes('bowl') ? '🎯' : role.toLowerCase().includes('all') ? '⭐' : role.toLowerCase().includes('keep') || role.toLowerCase().includes('wicket') ? '🧤' : '🏃'}
                          </span>
                          <span className="font-bold text-xs truncate">{role}</span>
                        </div>
                        <span className="font-black text-sm text-indigo-400 shrink-0">{count}</span>
                      </div>
                    ))
                  ) : (
                    <p className={`text-xs font-semibold text-center ${modeTheme.mutedText}`}>No players yet</p>
                  )}
                </div>
              </div>

              {/* Purse Overview */}
              <div className={`rounded-xl border p-3 shadow-sm shrink-0 ${modeTheme.panel}`}>
                <span className={`text-[9px] uppercase font-black tracking-widest block mb-2 ${modeTheme.mutedText}`}>Purse Overview</span>
                <div className="flex items-center gap-3">
                  {/* Circular indicator */}
                  <div className="relative w-16 h-16 shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" className={displayMode === 'night' ? 'stroke-slate-700' : displayMode === 'projector' ? 'stroke-gray-200' : 'stroke-slate-200'} strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-emerald-500" strokeWidth="3" strokeDasharray={`${spentPercent} ${100 - spentPercent}`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs font-black text-emerald-400">{spentPercent}%</span>
                      <span className={`text-[7px] font-bold uppercase ${modeTheme.mutedText}`}>Spent</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1 text-[11px]">
                    <div className="flex justify-between"><span className={`font-semibold ${modeTheme.mutedText}`}>● Spent</span><span className="font-black text-amber-400">₹{totalTeamSpent.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className={`font-semibold ${modeTheme.mutedText}`}>○ Remaining</span><span className="font-black text-emerald-400">₹{remainingPurse.toLocaleString()}</span></div>
                    <div className="flex justify-between border-t border-white/10 pt-1"><span className={`font-semibold ${modeTheme.mutedText}`}>Total Purse</span><span className="font-black">₹{totalPurse.toLocaleString()}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* CENTER: Squad Roster Table */}
            <div className={`col-span-6 rounded-xl border shadow-sm flex flex-col min-h-0 overflow-hidden ${modeTheme.panel}`}>
              <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between shrink-0">
                <span className="text-xs font-black uppercase tracking-wider">Squad Players ({teamSquadPlayers.length})</span>
              </div>
              {teamSquadPlayers.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className={`text-sm font-bold ${modeTheme.mutedText}`}>No players have been acquired yet.</p>
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`border-b text-[9px] uppercase tracking-wider ${modeTheme.tableHeader}`}>
                        <th className="py-1.5 px-2 font-black w-6">#</th>
                        <th className="py-1.5 px-2 font-black">Player</th>
                        <th className="py-1.5 px-2 font-black">Role</th>
                        <th className="py-1.5 px-2 font-black">Category</th>
                        <th className="py-1.5 px-2 font-black text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y text-xs ${modeTheme.tableDivider}`}>
                      {teamSquadPlayers.slice(0, 16).map((player, pIdx) => (
                        <tr key={player._id || pIdx} className={`transition-colors ${modeTheme.tableRowHover} ${player.isIcon ? 'bg-gradient-to-r from-yellow-900/20 to-transparent' : ''}`}>
                          <td className="py-1.5 px-2 font-black opacity-50 text-[10px]">{pIdx + 1}</td>
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={player.photoUrl || 'https://via.placeholder.com/80?text=P'}
                                alt={player.name}
                                className={`w-7 h-7 rounded-md object-cover bg-slate-800 shrink-0 ${player.isIcon ? 'border-2 border-yellow-400' : 'border border-slate-600'}`}
                                onError={(e) => { e.target.src = 'https://via.placeholder.com/80?text=P'; }}
                              />
                              <div className="flex flex-col">
                                <span className={`font-bold text-xs truncate max-w-[140px] ${player.isIcon ? 'text-yellow-400' : ''}`} title={player.name}>
                                  {player.name} {player.isIcon && '⭐'}
                                </span>
                                {player.isIcon && <span className="text-[8px] text-yellow-500 font-bold uppercase tracking-widest leading-none mt-0.5">Icon Player</span>}
                              </div>
                            </div>
                          </td>
                          <td className={`py-1.5 px-2 text-[11px] font-semibold ${modeTheme.mutedText}`}>{player.role || '—'}</td>
                          <td className={`py-1.5 px-2 text-[11px] font-semibold ${modeTheme.mutedText}`}>{player.category || '—'}</td>
                          <td className="py-1.5 px-2 text-right font-black text-xs text-emerald-400">₹{Number(player.soldPrice || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR: Recent Acquisitions */}
            <div className="col-span-3 flex flex-col gap-2 min-h-0 overflow-hidden">
              <div className={`rounded-xl border p-3 shadow-sm flex-1 min-h-0 flex flex-col ${modeTheme.panel}`}>
                <span className={`text-[9px] uppercase font-black tracking-widest block mb-2 ${modeTheme.mutedText}`}>Recent Buys</span>
                {recentBuys.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {recentBuys.map((player, idx) => (
                      <div key={player._id || idx} className={`rounded-lg border p-2 flex items-center gap-2.5 ${modeTheme.panel} ${player.isIcon ? 'bg-gradient-to-r from-yellow-900/20 to-transparent' : ''}`}>
                        <div className="relative shrink-0">
                          <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-indigo-600 text-white text-[8px] font-black flex items-center justify-center border border-indigo-400 z-10">{idx + 1}</span>
                          <img
                            src={player.photoUrl || 'https://via.placeholder.com/80?text=P'}
                            alt={player.name}
                            className={`w-10 h-10 rounded-lg object-cover bg-slate-800 ${player.isIcon ? 'border-2 border-yellow-400' : 'border border-slate-600'}`}
                            onError={(e) => { e.target.src = 'https://via.placeholder.com/80?text=P'; }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className={`font-black text-xs truncate ${player.isIcon ? 'text-yellow-400' : ''}`}>
                            {player.name} {player.isIcon && '⭐'}
                          </h4>
                          <p className={`text-[10px] font-semibold ${modeTheme.mutedText}`}>
                            {player.isIcon ? <span className="text-yellow-500 uppercase tracking-widest font-bold">Icon Player</span> : player.role || 'Player'}
                          </p>
                        </div>
                        <span className="font-black text-xs text-emerald-400 shrink-0">₹{Number(player.soldPrice || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`flex-1 flex items-center justify-center text-xs font-semibold ${modeTheme.mutedText}`}>No acquisitions yet</div>
                )}
              </div>

              {/* Max Bid Info */}
              <div className={`rounded-xl border p-3 shadow-sm shrink-0 ${modeTheme.panel}`}>
                <span className={`text-[9px] uppercase font-black tracking-widest block mb-1.5 ${modeTheme.mutedText}`}>Bidding Power</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-amber-400">₹{Number(currentTeamObj?.maxBid || 0).toLocaleString()}</span>
                  <span className={`text-[10px] font-semibold ${modeTheme.mutedText}`}>max bid</span>
                </div>
                <div className="mt-1.5 w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${totalPurse > 0 ? Math.min(100, Math.round((Number(currentTeamObj?.maxBid || 0) / totalPurse) * 100)) : 0}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (breakView === 'tournament-summary') {
      const totalPlayers = (summary.soldPlayers || 0) + (summary.unsoldPlayers || 0) + (summary.readyForAuction || 0);
      const completedPercent = totalPlayers > 0 ? Math.round(((summary.soldPlayers || 0) + (summary.unsoldPlayers || 0)) / totalPlayers * 100) : 0;
      const _leagueSpentPercent = summary.totalLeaguePurse > 0 ? Math.round(((summary.totalSoldValue || 0) / summary.totalLeaguePurse) * 100) : 0;

      // Top 5 teams by spending for the bar chart
      const teamSpending = teams.map((t) => {
        const teamSold = (t._id && squadsByTeam[String(t._id)]) || squadsByTeam[t.teamName] || [];
        const spent = teamSold.reduce((s, p) => s + Number(p.soldPrice || 0), 0);
        return {
          _id: t._id,
          teamName: t.teamName,
          shortName: t.shortName,
          logoUrl: t.logoUrl || t.logo || '',
          spent
        };
      }).sort((a, b) => b.spent - a.spent).slice(0, 5);
      const maxTeamSpent = teamSpending.length > 0 ? teamSpending[0].spent : 1;

      // Recently sold (last 4)
      const recentSold = soldPlayers.slice(-4).reverse();

      return (
        <div className="h-full flex flex-col min-h-0 overflow-hidden gap-2">
          {/* ══════ ROW 1: 5 KPI STAT CARDS ══════ */}
          <div className="grid grid-cols-5 gap-2 shrink-0">
            {[
              { label: 'Total Sold Value', value: `₹${Number(summary.totalSoldValue || 0).toLocaleString()}`, sub: `Across ${summary.soldPlayers || 0} Players`, color: 'text-emerald-400', accent: 'border-emerald-500/40', icon: '💰' },
              { label: 'Players Sold', value: summary.soldPlayers || 0, sub: `Of ${totalPlayers} Players`, color: 'text-blue-400', accent: 'border-blue-500/40', icon: '🔨' },
              { label: 'Players Unsold', value: summary.unsoldPlayers || 0, sub: 'So Far', color: 'text-rose-400', accent: 'border-rose-500/40', icon: '❌' },
              { label: 'Ready for Auction', value: summary.readyForAuction || 0, sub: 'Remaining Players', color: 'text-amber-400', accent: 'border-amber-500/40', icon: '⏳' },
              { label: 'Average Price', value: `₹${Number(summary.avgPlayerPrice || 0).toLocaleString()}`, sub: 'Sold Players Only', color: 'text-purple-400', accent: 'border-purple-500/40', icon: '📊' }
            ].map((item) => (
              <div key={item.label} className={`rounded-xl border ${item.accent} p-2.5 lg:p-3 shadow-sm flex flex-col justify-between ${modeTheme.panel}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[8px] lg:text-[9px] uppercase font-black tracking-wider ${modeTheme.mutedText}`}>{item.label}</span>
                  <span className="text-base">{item.icon}</span>
                </div>
                <p className={`text-xl lg:text-2xl font-black leading-tight ${item.color}`}>{item.value}</p>
                <span className={`text-[9px] font-semibold mt-0.5 ${modeTheme.mutedText}`}>{item.sub}</span>
              </div>
            ))}
          </div>

          {/* ══════ ROW 2: HIGHEST BID + TOP FRANCHISE + AUCTION PROGRESS ══════ */}
          <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">

            {/* Highest Bid Spotlight */}
            <div className={`col-span-4 rounded-xl border border-amber-500/30 p-3 lg:p-4 shadow-md flex flex-col justify-between ${modeTheme.panel}`}>
              <span className="text-[9px] uppercase font-black text-amber-400 tracking-widest block mb-1">🏆 Highest Bid of Tournament</span>
              {summary.highestBid ? (
                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-2">
                    <img
                      src={summary.highestBid.photoUrl || 'https://via.placeholder.com/120?text=Player'}
                      alt={summary.highestBid.name}
                      className="w-16 h-16 lg:w-20 lg:h-20 rounded-xl object-cover border-2 border-amber-400 shadow-md shrink-0"
                      onError={(e) => { e.target.src = 'https://via.placeholder.com/120?text=No+Photo'; }}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg lg:text-2xl font-black capitalize truncate">{summary.highestBid.name}</h3>
                      <p className={`text-[11px] font-bold mt-0.5 ${modeTheme.mutedText}`}>{summary.highestBid.role || 'Player'} {summary.highestBid.category ? `• ${summary.highestBid.category}` : ''}</p>
                    </div>
                  </div>
                  <div className={`rounded-lg border p-2 flex items-center justify-between gap-2 ${modeTheme.panel}`}>
                    <span className="text-2xl lg:text-3xl font-black text-emerald-400">₹{Number(summary.highestBid.soldPrice || 0).toLocaleString()}</span>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 max-w-[65%]">
                      {getTeamLogo(summary.highestBid.soldTo) && (
                        <img src={getTeamLogo(summary.highestBid.soldTo)} alt="" className="w-4 h-4 rounded object-cover shrink-0" />
                      )}
                      <span className="text-[10px] font-bold truncate">Acquired by {getTeamFullName(summary.highestBid.soldTo)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`flex-1 flex items-center justify-center text-xs font-bold ${modeTheme.mutedText}`}>No players sold yet.</div>
              )}
            </div>

            {/* Top Spending Franchise */}
            <div className={`col-span-4 rounded-xl border border-indigo-500/30 p-3 lg:p-4 shadow-md flex flex-col justify-between ${modeTheme.panel}`}>
              <span className="text-[9px] uppercase font-black text-indigo-400 tracking-widest block mb-1">💼 Top Spending Franchise</span>
              {summary.topSpendingTeam ? (
                <div className="flex-1 flex flex-col justify-center items-center text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {getTeamLogo(summary.topSpendingTeam) && (
                      <img src={getTeamLogo(summary.topSpendingTeam)} alt="" className="w-6 h-6 rounded-md object-cover border border-indigo-400/50 shrink-0" />
                    )}
                    <h3 className="text-xl lg:text-2xl font-black truncate max-w-full">{getTeamFullName(summary.topSpendingTeam)}</h3>
                  </div>
                  {getTeamShortName(summary.topSpendingTeam) && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${modeTheme.panel}`}>{getTeamShortName(summary.topSpendingTeam)}</span>
                  )}
                  <p className={`text-[11px] font-bold mt-1.5 ${modeTheme.mutedText}`}><span className="text-amber-400 font-black">{summary.topSpendingTeam.playersCount}</span> Players Acquired</p>
                  <div className={`rounded-lg border p-2 mt-2 w-full ${modeTheme.panel}`}>
                    <span className="text-2xl lg:text-3xl font-black text-emerald-400">₹{Number(summary.topSpendingTeam.spent || 0).toLocaleString()}</span>
                    <span className={`text-[10px] font-semibold block mt-0.5 ${modeTheme.mutedText}`}>Total Spent</span>
                  </div>
                </div>
              ) : (
                <div className={`flex-1 flex items-center justify-center text-xs font-bold ${modeTheme.mutedText}`}>No team spending yet.</div>
              )}
            </div>

            {/* Auction Progress */}
            <div className={`col-span-4 rounded-xl border border-emerald-500/30 p-3 lg:p-4 shadow-md flex flex-col justify-between ${modeTheme.panel}`}>
              <span className="text-[9px] uppercase font-black text-emerald-400 tracking-widest block mb-1">📈 Auction Progress</span>
              <div className="flex-1 flex items-center gap-4">
                {/* Donut */}
                <div className="relative w-24 h-24 lg:w-28 lg:h-28 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" className={displayMode === 'night' ? 'stroke-slate-700' : displayMode === 'projector' ? 'stroke-gray-200' : 'stroke-slate-200'} strokeWidth="2.5" />
                    <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-emerald-500" strokeWidth="2.5" strokeDasharray={`${completedPercent} ${100 - completedPercent}`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg lg:text-xl font-black text-emerald-400">{completedPercent}%</span>
                    <span className={`text-[8px] font-bold uppercase ${modeTheme.mutedText}`}>Completed</span>
                  </div>
                </div>
                {/* Legend */}
                <div className="flex-1 space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /><span className={`${modeTheme.mutedText} font-semibold`}>Players Sold</span><span className="ml-auto font-black">{summary.soldPlayers || 0}</span></div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" /><span className={`${modeTheme.mutedText} font-semibold`}>Players Unsold</span><span className="ml-auto font-black">{summary.unsoldPlayers || 0}</span></div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" /><span className={`${modeTheme.mutedText} font-semibold`}>Ready for Auction</span><span className="ml-auto font-black">{summary.readyForAuction || 0}</span></div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-2 shrink-0">
                <div className="flex justify-between text-[9px] font-bold mb-1">
                  <span className={modeTheme.mutedText}>{(summary.soldPlayers || 0) + (summary.unsoldPlayers || 0)} / {totalPlayers} Players Completed</span>
                  <span className="text-emerald-400">{completedPercent}%</span>
                </div>
                <div className={`w-full rounded-full h-1.5 overflow-hidden ${displayMode === 'night' ? 'bg-slate-700' : 'bg-slate-200'}`}>
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${completedPercent}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* ══════ ROW 3: RECENTLY SOLD + TOP 5 TEAM SPEND ══════ */}
          <div className="grid grid-cols-2 gap-2 shrink-0">
            {/* Recently Sold Players */}
            <div className={`rounded-xl border p-2.5 lg:p-3 shadow-sm ${modeTheme.panel}`}>
              <span className={`text-[9px] uppercase font-black tracking-widest block mb-2 ${modeTheme.mutedText}`}>✅ Recently Sold Players</span>
              {recentSold.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {recentSold.map((player, idx) => (
                    <div key={player._id || idx} className={`rounded-lg border p-2 flex flex-col items-center text-center ${modeTheme.panel}`}>
                      <img
                        src={player.photoUrl || 'https://via.placeholder.com/80?text=P'}
                        alt={player.name}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-600 bg-slate-800 mb-1.5"
                        onError={(e) => { e.target.src = 'https://via.placeholder.com/80?text=P'; }}
                      />
                      <h4 className="font-black text-[11px] truncate max-w-full">{player.name}</h4>
                      <p className={`text-[9px] font-semibold ${modeTheme.mutedText}`}>{player.role || 'Player'}</p>
                      <span className="font-black text-xs text-emerald-400 mt-0.5">₹{Number(player.soldPrice || 0).toLocaleString()}</span>
                      <span className={`text-[8px] font-bold mt-0.5 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 truncate max-w-full`}>
                        {getTeamShortName(player.soldTo) || getTeamFullName(player.soldTo)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-xs font-semibold text-center py-3 ${modeTheme.mutedText}`}>No players sold yet</p>
              )}
            </div>

            {/* Top 5 Team Spend */}
            <div className={`rounded-xl border p-2.5 lg:p-3 shadow-sm ${modeTheme.panel}`}>
              <span className={`text-[9px] uppercase font-black tracking-widest block mb-2 ${modeTheme.mutedText}`}>🔥 Top Team Spend</span>
              {teamSpending.length > 0 ? (
                <div className="space-y-1.5">
                  {teamSpending.map((team, idx) => (
                    <div key={team._id || team.teamName} className="flex items-center gap-2 text-xs">
                      <span className={`w-5 text-center font-black shrink-0 ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : modeTheme.mutedText}`}>{idx + 1}</span>
                      {team.logoUrl ? (
                        <img src={team.logoUrl} alt="" className="w-4 h-4 rounded object-cover shrink-0" />
                      ) : null}
                      <span className="font-bold truncate w-24 lg:w-32 shrink-0">{team.shortName || team.teamName}</span>
                      <div className="flex-1 h-3 rounded-full overflow-hidden bg-slate-800/50">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${idx === 0 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : idx === 1 ? 'bg-gradient-to-r from-blue-500 to-blue-400' : idx === 2 ? 'bg-gradient-to-r from-purple-500 to-purple-400' : 'bg-slate-500'}`}
                          style={{ width: `${maxTeamSpent > 0 ? Math.max(2, Math.round((team.spent / maxTeamSpent) * 100)) : 0}%` }}
                        />
                      </div>
                      <span className="font-black text-xs text-emerald-400 min-w-[70px] text-right shrink-0">₹{team.spent.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-xs font-semibold text-center py-3 ${modeTheme.mutedText}`}>No team spending data</p>
              )}
            </div>
          </div>
        </div>
      );
    }

    /* ========================================================================= */
    /* 🌟 3. TOP BIDS (REQUIREMENT 8 & CORRECTION 3) - HORIZONTAL LEADERBOARD 🌟 */
    /* ========================================================================= */
    if (breakView === 'top-biddings') {
      const topList = topBiddings.slice(0, 10);
      const rows = Array.from({ length: 10 }, (_, i) => topList[i] || null);

      return (
        <div className="h-full flex flex-col min-h-0 overflow-hidden gap-2">
          {/* ══════ BROADCAST HEADER BANNER ══════ */}
          <div className={`rounded-xl border px-4 lg:px-5 py-2.5 flex items-center justify-between gap-4 shadow-lg shrink-0 ${modeTheme.strongPanel}`}>
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl lg:text-3xl shrink-0">🏆</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg lg:text-2xl font-black uppercase tracking-wider">
                    TOP BIDS <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">LEADERBOARD</span>
                  </h2>
                </div>
                <span className={`text-[9px] lg:text-[10px] uppercase font-black tracking-[0.2em] block ${modeTheme.mutedText}`}>
                  Most Valuable Player Acquisitions of the Tournament
                </span>
              </div>
            </div>

            {/* Total Sold Badge */}
            <div className={`text-center px-4 py-1.5 rounded-xl border shadow-sm shrink-0 ${modeTheme.panel}`}>
              <span className={`text-[9px] uppercase font-bold block tracking-wider ${modeTheme.mutedText}`}>Total Sold</span>
              <span className="text-lg lg:text-2xl font-black text-amber-400">{topBiddings.length}</span>
            </div>
          </div>

          {/* ══════ LEADERBOARD TABLE CONTAINER ══════ */}
          <div className={`flex-1 min-h-0 rounded-xl border shadow-md flex flex-col justify-between overflow-hidden p-2 lg:p-2.5 ${modeTheme.panel}`}>
            {/* Table Header */}
            <div className={`grid grid-cols-12 gap-2 px-3 py-1.5 rounded-lg border text-[10px] uppercase font-black tracking-wider shrink-0 ${modeTheme.tableHeader}`}>
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-4">Player</div>
              <div className="col-span-2 text-center">Role</div>
              <div className="col-span-3">Team</div>
              <div className="col-span-1 text-center">Status</div>
              <div className="col-span-1 text-right">Final Bid</div>
            </div>

            {/* Table Rows (10 fixed rows for perfect 16:9 broadcast fit) */}
            <div className="flex-1 min-h-0 flex flex-col justify-between gap-1 mt-1 overflow-hidden">
              {rows.map((player, index) => {
                const rankNum = index + 1;
                const isRank1 = index === 0;
                const isRank2 = index === 1;
                const isRank3 = index === 2;

                if (!player) {
                  // Clean placeholder row
                  return (
                    <div
                      key={`empty-rank-${index}`}
                      className={`grid grid-cols-12 gap-2 items-center px-3 py-1 rounded-lg border text-xs opacity-40 transition-colors ${
                        displayMode === 'night' ? 'border-slate-800/40 bg-slate-900/10' : 'border-slate-200/50 bg-slate-50/50'
                      }`}
                    >
                      <div className="col-span-1 text-center font-bold text-[11px] text-slate-500">
                        {rankNum}
                      </div>
                      <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-800/40 border border-slate-700/30 flex items-center justify-center text-slate-600 text-[11px] shrink-0">
                          👤
                        </div>
                        <span className="font-semibold text-slate-600">—</span>
                      </div>
                      <div className="col-span-2 text-center text-slate-600 font-semibold">—</div>
                      <div className="col-span-3 text-slate-600 font-semibold">—</div>
                      <div className="col-span-1 text-center text-slate-600 font-semibold">—</div>
                      <div className="col-span-1 text-right text-slate-600 font-semibold">—</div>
                    </div>
                  );
                }

                // Distinct styling for Top 3 vs remaining
                let rowBorderClass = 'border-slate-700/40 bg-slate-900/20';
                let rankBadge = null;
                let priceColor = 'text-emerald-400';

                if (isRank1) {
                  rowBorderClass = 'border-amber-400/80 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-400/40';
                  rankBadge = (
                    <div className="flex items-center justify-center gap-1 text-amber-400">
                      <span className="text-base">👑</span>
                      <span className="font-black text-sm">{rankNum}</span>
                    </div>
                  );
                  priceColor = 'text-amber-300 font-black';
                } else if (isRank2) {
                  rowBorderClass = 'border-cyan-400/60 bg-gradient-to-r from-cyan-500/10 via-slate-500/5 to-transparent ring-1 ring-cyan-400/30';
                  rankBadge = (
                    <div className="flex items-center justify-center gap-1 text-cyan-300">
                      <span className="text-base">🥈</span>
                      <span className="font-black text-sm">{rankNum}</span>
                    </div>
                  );
                } else if (isRank3) {
                  rowBorderClass = 'border-amber-600/60 bg-gradient-to-r from-amber-700/10 via-slate-500/5 to-transparent ring-1 ring-amber-600/30';
                  rankBadge = (
                    <div className="flex items-center justify-center gap-1 text-amber-500">
                      <span className="text-base">🥉</span>
                      <span className="font-black text-sm">{rankNum}</span>
                    </div>
                  );
                } else {
                  rankBadge = (
                    <span className="font-bold text-xs text-slate-400">
                      #{rankNum}
                    </span>
                  );
                }

                const r = String(player.role || '').toLowerCase();
                const roleIcon = r.includes('bat') ? '🏏' : r.includes('bowl') ? '🎯' : r.includes('all') ? '⭐' : r.includes('keep') || r.includes('wicket') ? '🧤' : '🏃';

                return (
                  <div
                    key={player._id || index}
                    className={`grid grid-cols-12 gap-2 items-center px-3 py-1 rounded-lg border transition-all text-xs ${rowBorderClass}`}
                  >
                    {/* # Rank */}
                    <div className="col-span-1 text-center font-black">
                      {rankBadge}
                    </div>

                    {/* Player Info */}
                    <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                      <img
                        src={player.photoUrl || 'https://via.placeholder.com/80?text=P'}
                        alt={player.name}
                        className={`w-7 h-7 rounded-lg object-cover bg-slate-800 shrink-0 border ${
                          isRank1 ? 'border-amber-400' : isRank2 ? 'border-cyan-400' : isRank3 ? 'border-amber-600' : 'border-slate-600'
                        }`}
                        onError={(e) => { e.target.src = 'https://via.placeholder.com/80?text=P'; }}
                      />
                      <span className="font-black text-xs lg:text-sm truncate" title={player.name}>
                        {player.name}
                      </span>
                    </div>

                    {/* Role */}
                    <div className="col-span-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${modeTheme.panel}`}>
                        <span>{roleIcon}</span>
                        <span className="truncate">{player.role || 'Player'}</span>
                      </span>
                    </div>

                    {/* Team */}
                    <div className="col-span-3 flex items-center gap-2 min-w-0">
                      {getTeamLogo(player.soldTo) ? (
                        <img
                          src={getTeamLogo(player.soldTo)}
                          alt={getTeamFullName(player.soldTo)}
                          className="w-5 h-5 rounded object-cover border border-amber-400/50 shadow-sm shrink-0"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-black text-[9px] shrink-0 border border-indigo-400/40">
                          {getTeamShortName(player.soldTo)}
                        </span>
                      )}
                      <span className="font-bold text-xs truncate" title={getTeamFullName(player.soldTo)}>
                        {getTeamFullName(player.soldTo)}
                      </span>
                      {getTeamLogo(player.soldTo) && getTeamShortName(player.soldTo) && (
                        <span className="text-[9px] font-black px-1 py-0.2 rounded bg-white/10 text-amber-300 border border-amber-400/20 shrink-0">
                          {getTeamShortName(player.soldTo)}
                        </span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="col-span-1 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-black tracking-wider uppercase">
                        SOLD
                      </span>
                    </div>

                    {/* Final Bid */}
                    <div className={`col-span-1 text-right font-black text-xs lg:text-sm ${priceColor}`}>
                      ₹{Number(player.soldPrice || 0).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Status Ribbon */}
            <div className={`mt-1.5 pt-1.5 border-t flex items-center justify-between text-[10px] font-bold shrink-0 ${modeTheme.mutedText} border-slate-700/40`}>
              <div className="flex items-center gap-2">
                <span className="text-amber-400 uppercase tracking-wider">TOP BIDS</span>
                <span>•</span>
                <span>{topBiddings.length} PLAYERS SOLD</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="tracking-widest uppercase">LIVE AUCTION DATA</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    /* ========================================================================= */
    /* 🌟 4. TEAMS DASHBOARD (REQUIREMENT 6 & CORRECTION 2) - UP TO 16 TEAMS 🌟 */
    /* ========================================================================= */
    const half = Math.ceil(teams.length / 2);
    const col1 = teams.slice(0, half);
    const col2 = teams.slice(half);

    const TEAM_GRADIENTS = [
      'from-blue-600 to-indigo-700',
      'from-amber-600 to-orange-700',
      'from-rose-600 to-red-700',
      'from-purple-600 to-violet-700',
      'from-emerald-600 to-teal-700',
      'from-cyan-600 to-blue-700',
      'from-fuchsia-600 to-pink-700',
      'from-yellow-600 to-amber-700'
    ];

    const renderTeamTable = (teamList, startIdx) => (
      <div className={`flex-1 min-h-0 rounded-xl border shadow-sm flex flex-col justify-between overflow-hidden p-2 ${modeTheme.panel}`}>
        {/* Table Header */}
        <div className={`grid grid-cols-12 gap-1 px-2.5 py-1.5 rounded-lg border text-[9px] lg:text-[10px] uppercase font-black tracking-wider shrink-0 ${modeTheme.tableHeader}`}>
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-3">Team</div>
          <div className="col-span-2 text-right">Purse Left</div>
          <div className="col-span-2 text-right">Max Bid</div>
          <div className="col-span-2 text-center">Squad</div>
          <div className="col-span-2 text-right">Spent</div>
        </div>

        {/* Table Rows */}
        <div className="flex-1 min-h-0 flex flex-col justify-between gap-1 mt-1 overflow-hidden">
          {teamList.map((team, idx) => {
            const teamSold = (team._id && squadsByTeam[String(team._id)]) || squadsByTeam[team.teamName] || [];
            const spent = teamSold.reduce((sum, p) => sum + Number(p.soldPrice || 0), 0);
            const boughtCount = teamSold.length;
            const maxRequired = Number(team.remainingRequiredPlayers || 0) + boughtCount;
            const rankNum = startIdx + idx + 1;
            const gradientClass = TEAM_GRADIENTS[(startIdx + idx) % TEAM_GRADIENTS.length];

            return (
              <div
                key={team._id}
                className={`grid grid-cols-12 gap-1 items-center px-2.5 py-1 rounded-lg border transition-all text-xs ${modeTheme.panel}`}
              >
                {/* # Rank */}
                <div className="col-span-1 text-center font-bold text-[10px] text-slate-400">
                  #{rankNum}
                </div>

                {/* Team Name + Badge */}
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  {team.logoUrl ? (
                    <img
                      src={team.logoUrl}
                      alt={team.teamName}
                      className="w-6 h-6 rounded-md object-cover bg-white/10 shrink-0 border border-white/20"
                    />
                  ) : (
                    <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${gradientClass} text-white font-black text-[9px] flex items-center justify-center shrink-0 shadow-xs border border-white/20`}>
                      {team.shortName || team.teamName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="font-black text-xs truncate" title={team.teamName}>
                    {team.shortName || team.teamName}
                  </span>
                </div>

                {/* Purse Left */}
                <div className="col-span-2 text-right font-black text-xs text-emerald-400">
                  ₹{Number(team.remainingPurse || 0).toLocaleString()}
                </div>

                {/* Max Bid */}
                <div className="col-span-2 text-right font-black text-xs text-amber-400">
                  ₹{Number(team.maxBid || 0).toLocaleString()}
                </div>

                {/* Squad (Acquired / Max) */}
                <div className="col-span-2 text-center">
                  <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-[10px] font-black">
                    {boughtCount} / {maxRequired > 0 ? maxRequired : '-'}
                  </span>
                </div>

                {/* Total Spent */}
                <div className="col-span-2 text-right font-bold text-xs">
                  ₹{spent.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden gap-2">
        {/* ══════ BROADCAST HEADER BANNER ══════ */}
        <div className={`rounded-xl border px-4 lg:px-5 py-2.5 flex items-center justify-between gap-4 shadow-lg shrink-0 ${modeTheme.strongPanel}`}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl lg:text-3xl shrink-0">📊</span>
            <div className="min-w-0">
              <h2 className="text-lg lg:text-2xl font-black uppercase tracking-wider">
                FRANCHISE <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">TEAMS</span>
              </h2>
              <span className={`text-[9px] lg:text-[10px] uppercase font-black tracking-[0.25em] block ${modeTheme.mutedText}`}>
                Auction Overview • Financial & Squad Status
              </span>
            </div>
          </div>

          {/* Total Teams Badge */}
          <div className={`text-center px-4 py-1.5 rounded-xl border shadow-sm shrink-0 ${modeTheme.panel}`}>
            <span className={`text-[9px] uppercase font-bold block tracking-wider ${modeTheme.mutedText}`}>Total Teams</span>
            <span className="text-lg lg:text-2xl font-black text-emerald-400">{teams.length}</span>
          </div>
        </div>

        {/* ══════ TWO-COLUMN SPREAD (UP TO 16 TEAMS STRICTLY NON-SCROLLABLE) ══════ */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {teams.length <= 8 ? (
            renderTeamTable(teams, 0)
          ) : (
            <div className="grid grid-cols-2 gap-2.5 h-full min-h-0">
              {renderTeamTable(col1, 0)}
              {renderTeamTable(col2, half)}
            </div>
          )}
        </div>

        {/* ══════ BROADCAST FOOTER LEGEND ══════ */}
        <div className={`rounded-xl border px-4 py-2 flex items-center justify-between shrink-0 text-[10px] font-bold ${modeTheme.panel}`}>
          <div className="flex items-center gap-2">
            <span className="text-amber-400">📊 TEAMS AUCTION OVERVIEW</span>
            <span className={modeTheme.mutedText}>•</span>
            <span className={modeTheme.mutedText}>{teams.length} FRANCHISE TEAMS</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className={modeTheme.mutedText}>PURSE LEFT</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className={modeTheme.mutedText}>MAX BID</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className={modeTheme.mutedText}>SQUAD (ACQUIRED / MAX)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              <span className={modeTheme.mutedText}>TOTAL SPENT</span>
            </div>
          </div>
        </div>
      </div>
    );
  
}
