export default function RemoteSquadTab({
  squadData,
  teamInfo,
  tabLoading,
  formatCurrency,
}) {
  return (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>🛡️</span> My Team Squad
              </h2>
              <span className="text-xs font-bold text-slate-400">
                {squadData?.squadCount || 0} Players
              </span>
            </div>

            {/* SQUAD FINANCIAL SUMMARY */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Spent</span>
                <span className="text-sm font-black text-amber-400">{formatCurrency(squadData?.totalSpent || 0)}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Remaining Purse</span>
                <span className="text-sm font-black text-emerald-400">{formatCurrency(squadData?.team?.remainingPurse || teamInfo?.remainingPurse || 0)}</span>
              </div>
            </div>

            {(tabLoading && !squadData) ? (
              <div className="text-center py-8 text-xs font-bold text-slate-500">Loading squad players...</div>
            ) : (!squadData?.squad || squadData.squad.length === 0) ? (
              <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-bold text-slate-500">
                No players acquired yet. Place bids in live auction to build your squad!
              </div>
            ) : (
              <div className="space-y-2">
                {squadData?.squad?.map((player) => (
                  <div
                    key={player._id}
                    className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={player.photoUrl || 'https://via.placeholder.com/150'}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover bg-slate-800 border border-slate-700 shrink-0"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/150?text=Player';
                        }}
                      />
                      <div className="min-w-0">
                        <h4 className="font-black text-xs text-white truncate">{player.name}</h4>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold mt-0.5">
                          <span>{player.role || 'Player'}</span>
                          <span>•</span>
                          <span>{player.category || 'Standard'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-emerald-400 block">{formatCurrency(player.soldPrice)}</span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Acquired</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
  );
}
