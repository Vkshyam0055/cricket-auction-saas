export default function RemoteSecurityTab({
  teamInfo,
  tournamentInfo,
  pwdStatus,
  pwdCurrent,
  setPwdCurrent,
  pwdNew,
  setPwdNew,
  pwdConfirm,
  setPwdConfirm,
  handleChangePassword,
}) {
  return (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>🔑</span> Profile & Password
              </h2>
            </div>

            {/* TEAM INFO CARD */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <h3 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider mb-2">Team Details</h3>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Team Name:</span>
                <span className="font-black text-white">{teamInfo?.teamName}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Short Code:</span>
                <span className="font-black text-white">{teamInfo?.shortName || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Owner Name:</span>
                <span className="font-black text-white">{teamInfo?.ownerName || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-400">Tournament:</span>
                <span className="font-black text-white">{tournamentInfo?.name || 'Active'}</span>
              </div>
            </div>

            {/* CHANGE PASSWORD FORM */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider mb-3">Change Password</h3>

              {pwdStatus && (
                <div
                  className={`mb-3 p-2.5 rounded-xl text-xs font-bold text-center border ${
                    pwdStatus.type === 'error'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : pwdStatus.type === 'success'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  }`}
                >
                  {pwdStatus.message}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase text-slate-400 mb-1">Current Password</label>
                  <input
                    type="password"
                    required
                    value={pwdCurrent}
                    onChange={(e) => setPwdCurrent(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase text-slate-400 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={pwdNew}
                    onChange={(e) => setPwdNew(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase text-slate-400 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={pwdConfirm}
                    onChange={(e) => setPwdConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={pwdStatus?.loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-black rounded-xl text-xs shadow-md transition disabled:opacity-50 mt-1 cursor-pointer"
                >
                  {pwdStatus?.loading ? 'Updating...' : 'Save New Password'}
                </button>
              </form>
            </div>
          </div>
  );
}
