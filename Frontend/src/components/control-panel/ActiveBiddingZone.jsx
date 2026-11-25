import React from 'react';

export default function ActiveBiddingZone({
  activeBiddingTeams,
  biddingTeam,
  lastBidSource,
  formatCurrency,
  biddingActive,
  currentBid,
  updateBid,
  isAwaitingTeam = false,
}) {
  return (
    <div className="py-1 shrink-0">
      <div className="flex items-center justify-between mb-0.5">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-purple-800">
          Active Bidders (Max 4)
        </h3>
        <span className="text-[10px] text-slate-400 font-semibold">
          {activeBiddingTeams.length}/4 Active
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((slotIdx) => {
          const team = activeBiddingTeams[slotIdx];
          if (!team) {
            return (
              <div
                key={`empty-slot-${slotIdx}`}
                className="rounded-lg border border-dashed border-purple-200 bg-purple-50/40 px-1.5 py-1 flex items-center justify-center text-[10px] font-semibold text-purple-400"
              >
                + Slot {slotIdx + 1}
              </div>
            );
          }

          const isHighestBidder = !isAwaitingTeam && Boolean(biddingTeam) && (String(biddingTeam) === String(team._id) || biddingTeam === team.teamName);
          const isSquadFull = team.remainingRequiredPlayers !== undefined && team.remainingRequiredPlayers <= 0;
          const hasInsufficientPurse = currentBid > Number(team.remainingPurse || 0);
          const exceedsMaxBid = currentBid > Number(team.maxBid || 0);
          const canTeamBid = biddingActive && !isSquadFull && !hasInsufficientPurse && !exceedsMaxBid && !isHighestBidder;

          return (
            <div
              key={`active-${team._id}`}
              onClick={() => {
                if (canTeamBid) updateBid(team._id);
              }}
              className={`rounded-lg border px-1.5 py-1 flex flex-col justify-between transition-all ${canTeamBid ? 'cursor-pointer hover:shadow-sm' : ''} ${
                isHighestBidder
                  ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400/30 shadow-xs'
                  : 'border-purple-300 bg-purple-50/80 hover:border-purple-400'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {team.logoUrl || team.logo ? (
                    <img src={team.logoUrl || team.logo} alt="" className="w-5 h-5 rounded object-contain bg-white border border-purple-200 shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded bg-purple-700 text-white font-black text-[9px] flex items-center justify-center shrink-0 uppercase">
                      {team.shortName || team.teamName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <h4 className="font-black text-xs text-slate-900 truncate" title={team.teamName}>
                    {team.shortName || team.teamName}
                  </h4>
                </div>
                {isHighestBidder ? (
                  <span className="text-[9px] px-1 rounded bg-amber-400 text-amber-950 font-black shrink-0">
                    {lastBidSource === 'remote' ? 'Leader 📱' : 'Leader 🏢'}
                  </span>
                ) : isAwaitingTeam ? (
                  <span className="text-[9px] px-1 rounded bg-amber-500 text-amber-950 font-black shrink-0">
                    Awaiting
                  </span>
                ) : (
                  <span className="text-[9px] px-1 rounded bg-purple-700 text-white font-black shrink-0">
                    #{slotIdx + 1}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center text-[10px] text-purple-900 font-bold mb-0.5 leading-tight">
                <span>₹{team.remainingPurse.toLocaleString()}</span>
                <span className="text-[9px] text-purple-700 font-semibold">Max {formatCurrency(team.maxBid)}</span>
              </div>

              <div
                className={`h-4 rounded-md flex items-center justify-center text-[10px] font-black ${
                  canTeamBid ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-300'
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
    </div>
  );
}
