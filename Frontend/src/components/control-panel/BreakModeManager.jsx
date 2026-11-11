import React from 'react';

export default function BreakModeManager({
  setScreenView,
  configVersionRef,
  syncLiveScreenConfig,
  displayMode,
  layout,
  photoSize,
  breakView,
  selectedSquadTeam,
  handleSwitchBreakView,
  teams,
  handleSelectSquadTeam,
  breakDataSnapshot,
}) {
  return (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 h-full flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Break Content Control</h2>
                </div>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Select and project intermission content directly onto the Live Screen
                </p>
              </div>

              <button
                onClick={() => {
                  setScreenView('live');
                  configVersionRef.current += 1;
                  syncLiveScreenConfig({
                    displayMode,
                    layout,
                    photoSize,
                    screenView: 'live',
                    breakView,
                    selectedSquadTeam,
                    version: configVersionRef.current,
                    updatedAtMs: Date.now()
                  });
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-3.5 py-1.5 rounded-xl text-xs uppercase tracking-wider shadow active:scale-95 transition"
              >
                ▶ Return to Live Auction
              </button>
            </div>

            {/* 4 CONTENT VIEW SELECTORS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 my-3 shrink-0">
              {[
                { id: 'teams-dashboard', label: 'Teams Dashboard', icon: '📊', desc: 'Overview table of all teams with purse & max bid' },
                { id: 'squad-list', label: 'Squad View', icon: '👥', desc: 'Project a single team\'s acquired players roster' },
                { id: 'tournament-summary', label: 'Summary', icon: '📈', desc: 'Key auction finances & player statistics' },
                { id: 'top-biddings', label: 'Top Bids', icon: '🏆', desc: 'Top 10 highest player bids with photos' }
              ].map((tab) => {
                const isActive = breakView === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleSwitchBreakView(tab.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      isActive
                        ? 'border-orange-500 bg-orange-50/70 shadow-sm ring-2 ring-orange-400/20'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{tab.icon}</span>
                      <span className={`font-black text-xs lg:text-sm ${isActive ? 'text-orange-950' : 'text-slate-800'}`}>
                        {tab.label}
                      </span>
                      {isActive && (
                        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-orange-600 text-white font-black uppercase">
                          Live 📺
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium leading-snug">{tab.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* SQUAD TEAM SELECTOR (REQUIREMENT 7) */}
            {breakView === 'squad-list' ? (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-hidden">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Click a Team to Display its Squad on Live Screen:
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Showing on Screen: <span className="font-black text-indigo-700">{selectedSquadTeam || teams[0]?.teamName || 'None'}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 overflow-y-auto pr-1 pb-2">
                  {teams.map((team) => {
                    const isSelected = (selectedSquadTeam || teams[0]?.teamName) === team.teamName;
                    const squadCount = (breakDataSnapshot?.squadsByTeam?.[team.teamName] || []).length;
                    return (
                      <button
                        key={team._id}
                        onClick={() => handleSelectSquadTeam(team.teamName)}
                        className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/30'
                            : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-black text-xs truncate" title={team.teamName}>
                            {team.shortName || team.teamName}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] bg-white text-indigo-700 font-black px-1 rounded shrink-0">
                              📺 On Screen
                            </span>
                          )}
                        </div>
                        <div className={`text-[10px] flex justify-between ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                          <span>{squadCount} players</span>
                          <span>₹{Number(team.remainingPurse || 0).toLocaleString()}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* PREVIEW NOTICE FOR OTHER BREAK VIEWS */
              <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-500">
                <span className="text-4xl mb-2">
                  {breakView === 'teams-dashboard' ? '📊' : breakView === 'tournament-summary' ? '📈' : '🏆'}
                </span>
                <h3 className="font-black text-base text-slate-800 uppercase tracking-wider">
                  {breakView.replace('-', ' ')} is Broadcasting
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  The Live Screen is currently displaying the {breakView.replace('-', ' ')} in full screen for the audience.
                </p>
              </div>
            )}

            {/* BROADCAST STATUS FOOTER */}
            <div className="mt-2.5 bg-slate-900 text-white px-3 py-2 rounded-xl flex items-center justify-between shrink-0 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">● LIVE BROADCAST:</span>
                <span className="font-black text-orange-400 uppercase">{breakView.replace('-', ' ')}</span>
                {breakView === 'squad-list' && (
                  <span className="text-indigo-300 font-bold">({selectedSquadTeam || teams[0]?.teamName})</span>
                )}
              </div>
              <span className="text-slate-400 text-[11px]">Changes update audience display instantly</span>
            </div>
          </div>
  );
}
