import React from 'react';

export default function ControlPanelHeader({
  tournament,
  screenView,
  setScreenView,
  actionHistory,
  handleUndo,
  configVersionRef,
  syncLiveScreenConfig,
  displayMode,
  layout,
  photoSize,
  breakView,
  selectedSquadTeam,
  openResultsModal,
  setShowSettingsModal,
  navigate,
}) {
  return (
      <header className="bg-slate-900 px-4 py-2 flex items-center justify-between gap-3 shadow-md text-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm lg:text-base font-black truncate tracking-wide">
            ⚙️ {tournament?.name || 'Auction Control'}
          </h1>
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
              screenView === 'live'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
            }`}
          >
            {screenView === 'live' ? '● Live Screen' : '☕ Break Content'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* UNDO BUTTON */}
          <button
            onClick={handleUndo}
            disabled={actionHistory.length === 0}
            className={`font-black px-2.5 py-1 rounded-lg text-xs transition-all flex items-center gap-1 ${
              actionHistory.length > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 shadow cursor-pointer active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
            }`}
          >
            <span>⏪ Undo</span>
            {actionHistory.length > 0 && (
              <span className="bg-amber-950/20 px-1 rounded-full text-[10px]">({actionHistory.length})</span>
            )}
          </button>

          {/* SCREEN VIEW SWITCHER */}
          <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
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
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                screenView === 'live' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Live Auction
            </button>
            <button
              onClick={() => {
                setScreenView('break');
                configVersionRef.current += 1;
                syncLiveScreenConfig({
                  displayMode,
                  layout,
                  photoSize,
                  screenView: 'break',
                  breakView,
                  selectedSquadTeam,
                  version: configVersionRef.current,
                  updatedAtMs: Date.now()
                });
              }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                screenView === 'break' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Break Content
            </button>
          </div>

          <button
            onClick={openResultsModal}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1"
            title="Auction Results & Recovery"
          >
            <span>♻️ Results</span>
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition"
          >
            ⚙️ Settings
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 px-2.5 py-1 rounded-lg text-xs font-bold transition"
          >
            Exit
          </button>
        </div>
      </header>
  );
}
