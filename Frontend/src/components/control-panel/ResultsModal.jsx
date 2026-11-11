import React from 'react';

export default function ResultsModal({
  showResultsModal,
  setShowResultsModal,
  auctionResultDatabase = [],
  isLoadingResults = false,
  resultsError = null,
  retryFetchResults,
  resultsActiveTab,
  setResultsActiveTab,
  resultsSearchQuery,
  setResultsSearchQuery,
  getTeamLabel,
  getTeamFullName,
  bringAllBackToAuction,
  bringAllPlayersBack,
  bringBackToAuction,
  resetWholeAuction,
  isProcessingRecovery
}) {
  if (!showResultsModal) return null;

  const soldPlayersList = auctionResultDatabase.filter(
    (p) => p.auctionStatus?.trim().toLowerCase() === 'sold' || p.auctionStatus?.trim().toLowerCase() === 'icon'
  );
  const unsoldPlayersList = auctionResultDatabase.filter(
    (p) => p.auctionStatus?.trim().toLowerCase() === 'unsold' || p.auctionStatus?.trim().toLowerCase() === 'passed'
  );
  const totalSpent = soldPlayersList.reduce((sum, p) => sum + (Number(p.soldPrice) || 0), 0);

  const filteredList = auctionResultDatabase.filter((p) => {
    const status = p.auctionStatus?.trim().toLowerCase() || '';
    if (resultsActiveTab === 'sold' && !(status === 'sold' || status === 'icon')) return false;
    if (resultsActiveTab === 'unsold' && !(status === 'unsold' || status === 'passed')) return false;
    if (!resultsSearchQuery || !resultsSearchQuery.trim()) return true;
    const q = resultsSearchQuery.trim().toLowerCase();
    const nameMatch = p.name?.toLowerCase().includes(q);
    const teamMatch = getTeamLabel(p.soldTo)?.toLowerCase().includes(q) || getTeamFullName(p.soldTo)?.toLowerCase().includes(q);
    const roleMatch = p.role?.toLowerCase().includes(q);
    const catMatch = p.category?.toLowerCase().includes(q);
    return nameMatch || teamMatch || roleMatch || catMatch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* MODAL HEADER */}
        <div className="bg-slate-800/90 px-5 py-3.5 border-b border-slate-700 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xl text-indigo-300 shrink-0">
              ♻️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white uppercase tracking-wider">
                  Auction Results & Recovery
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {auctionResultDatabase.length} Total
                </span>
                {isLoadingResults && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                    Syncing...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Restore players back to the live auction pool with automatic purse refunds
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowResultsModal(false)}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-lg transition cursor-pointer"
            title="Close"
          >
            &times;
          </button>
        </div>

        {/* NON-BLOCKING ERROR BANNER (When cached data exists) */}
        {resultsError && auctionResultDatabase.length > 0 && (
          <div className="bg-rose-950/80 border-b border-rose-800/80 px-5 py-2 text-xs flex items-center justify-between text-rose-200 shrink-0">
            <div className="flex items-center gap-2 truncate">
              <span>⚠️</span>
              <span className="truncate">Could not refresh results: {resultsError}</span>
            </div>
            {retryFetchResults && (
              <button
                onClick={retryFetchResults}
                className="ml-3 px-2.5 py-0.5 bg-rose-800 hover:bg-rose-700 text-white font-bold rounded text-[11px] transition shrink-0 cursor-pointer"
              >
                🔄 Retry
              </button>
            )}
          </div>
        )}

        {/* ACTION & FILTER TOOLBAR */}
        <div className="bg-slate-900/95 px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* TABS */}
          <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700/60">
            <button
              onClick={() => setResultsActiveTab('all')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                resultsActiveTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>All</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30">
                {auctionResultDatabase.length}
              </span>
            </button>
            <button
              onClick={() => setResultsActiveTab('sold')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                resultsActiveTab === 'sold'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Sold</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30">
                {soldPlayersList.length}
              </span>
            </button>
            <button
              onClick={() => setResultsActiveTab('unsold')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                resultsActiveTab === 'unsold'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Unsold / Passed</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30">
                {unsoldPlayersList.length}
              </span>
            </button>
          </div>

          {/* SEARCH INPUT */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <input
              type="text"
              value={resultsSearchQuery}
              onChange={(e) => setResultsSearchQuery(e.target.value)}
              placeholder="Search player, team, role..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
            {resultsSearchQuery && (
              <button
                onClick={() => setResultsSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                &times;
              </button>
            )}
          </div>

          {/* BULK RESTORE BUTTONS */}
          <div className="flex items-center gap-2">
            {unsoldPlayersList.length > 0 && (
              <button
                onClick={bringAllBackToAuction}
                disabled={isProcessingRecovery}
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 hover:border-amber-400 font-bold px-3 py-1.5 rounded-lg text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Bring all unsold players into Round-2"
              >
                <span>♻️ Round-2 (All Unsold)</span>
                <span className="bg-amber-400/20 text-amber-200 px-1.5 py-0.2 rounded text-[10px]">
                  {unsoldPlayersList.length}
                </span>
              </button>
            )}

            {auctionResultDatabase.length > 0 && (
              <button
                onClick={bringAllPlayersBack}
                disabled={isProcessingRecovery}
                className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 hover:border-indigo-400 font-bold px-3 py-1.5 rounded-lg text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Restore all players and refund team purses"
              >
                <span>🔄 Restore All</span>
              </button>
            )}
          </div>
        </div>

        {/* PLAYERS LIST (SCROLLABLE) */}
        <div className="p-4 overflow-y-auto bg-slate-950/60 flex-1 min-h-[260px] max-h-[52vh]">
          {resultsError && auctionResultDatabase.length === 0 ? (
            /* ERROR STATE WITH RETRY (Initial fetch failed) */
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-2xl text-rose-400">
                ⚠️
              </div>
              <p className="text-sm font-bold text-rose-300">Failed to load auction results</p>
              <p className="text-xs text-slate-400 max-w-sm px-4">{resultsError}</p>
              {retryFetchResults && (
                <button
                  onClick={retryFetchResults}
                  className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <span>🔄 Try Again</span>
                </button>
              )}
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center justify-center">
              <span className="text-4xl mb-2 opacity-40">🏏</span>
              <p className="text-sm font-bold text-slate-400">
                {resultsSearchQuery ? 'No players match your search filter' : 'No players in this section'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {resultsSearchQuery ? 'Try clearing or changing the search query.' : 'Sold and unsold players will appear here during the auction.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredList.map((p) => {
                const isSold = p.auctionStatus === 'Sold' || p.auctionStatus === 'Icon';
                const soldPrice = Number(p.soldPrice) || 0;
                return (
                  <div
                    key={p._id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={p.photoUrl || 'https://via.placeholder.com/50'}
                          alt={p.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-slate-700"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                            isSold ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-white truncate">{p.name}</h3>
                        <p className="text-xs text-slate-400 truncate">
                          {p.role || 'Player'} • Base: ₹{Number(p.basePrice || 0).toLocaleString()}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          {isSold ? (
                            <span className="bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 text-[10px] font-black px-2 py-0.5 rounded-md truncate">
                              Sold to {getTeamLabel(p.soldTo)} • ₹{soldPrice.toLocaleString()}
                            </span>
                          ) : (
                            <span className="bg-amber-950/60 text-amber-300 border border-amber-800/80 text-[10px] font-black px-2 py-0.5 rounded-md">
                              {p.auctionStatus || 'Unsold'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!p.isIcon && p.auctionStatus !== 'Icon' && (
                      <button
                        onClick={() => bringBackToAuction(p)}
                        disabled={isProcessingRecovery}
                        className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 hover:border-indigo-500 font-bold px-3 py-1.5 rounded-lg text-xs transition active:scale-95 shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                        title={isSold ? `Refund ₹${soldPrice.toLocaleString()} to ${getTeamLabel(p.soldTo)} & return to pool` : 'Return to live pool'}
                      >
                        <span>Bring Back</span>
                        <span>↩️</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-850 px-5 py-3 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-4 text-slate-400 font-semibold">
            <span>Sold: <strong className="text-emerald-400">{soldPlayersList.length}</strong> (₹{totalSpent.toLocaleString()})</span>
            <span>Unsold: <strong className="text-amber-400">{unsoldPlayersList.length}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={resetWholeAuction}
              disabled={isProcessingRecovery}
              className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 hover:border-rose-700 font-bold px-3 py-1.5 rounded-lg text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              title="Reset entire auction for rehearsal/restart"
            >
              <span>⚠️ Reset Auction</span>
            </button>
            <button
              onClick={() => setShowResultsModal(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
