import React from 'react';

export default function SettingsModal({
  showSettingsModal,
  setShowSettingsModal,
  playerOrderMode,
  setPlayerOrderMode,
  effectiveCategoryOrder,
  categoriesFromPlayers,
  setCategoryOrder,
  activeCategory,
  displayMode,
  setDisplayMode,
  layout,
  setLayout,
  photoSize,
  setPhotoSize,
  openResultsModal,
  resetWholeAuction
}) {
  if (!showSettingsModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50">
      <div className="w-full max-w-md h-full bg-white shadow-2xl p-5 overflow-y-auto flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 border-b pb-3">
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">⚙️ Auction Settings</h2>
            <button
              onClick={() => setShowSettingsModal(false)}
              className="text-2xl leading-none text-slate-400 hover:text-slate-700"
            >
              &times;
            </button>
          </div>

          <div className="space-y-4">
            {/* PLAYER ORDER MODE */}
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 mb-1.5 block">
                Player Order Mode
              </span>
              <select
                value={playerOrderMode}
                onChange={(e) => setPlayerOrderMode(e.target.value)}
                className="w-full p-2 rounded-lg border border-indigo-200 font-bold text-xs text-indigo-900 outline-none"
              >
                <option value="all-random">All Players Random</option>
                <option value="category-random">Category-wise Random</option>
              </select>

              {playerOrderMode === 'category-random' && (
                <div className="mt-2.5">
                  <p className="text-[10px] text-indigo-700 font-bold mb-1">
                    Order: {effectiveCategoryOrder?.length > 0 ? effectiveCategoryOrder.join(' → ') : '-'}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {categoriesFromPlayers?.map((category) => (
                      <button
                        key={category}
                        onClick={() =>
                          setCategoryOrder((prev) => [
                            category,
                            ...prev.filter((item) => item !== category),
                            ...categoriesFromPlayers.filter((item) => item !== category && !prev.includes(item))
                          ])
                        }
                        className="px-2 py-1 text-[10px] rounded border bg-white font-bold text-indigo-700 hover:bg-indigo-100 truncate"
                      >
                        Start with {category}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] mt-2 font-semibold text-indigo-600">
                    Active Category: {activeCategory || '-'}
                  </p>
                </div>
              )}
            </div>

            {/* LIVE SCREEN PRESETS */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                Live Screen Presets
              </span>
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Display Mode</label>
                <select
                  value={displayMode}
                  onChange={(e) => setDisplayMode(e.target.value)}
                  className="w-full p-1.5 rounded-lg border border-slate-300 font-bold text-xs text-slate-800 outline-none"
                >
                  <option value="night">Night Mode</option>
                  <option value="day">Day Mode</option>
                  <option value="projector">Projector Mode</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Live Screen Layout</label>
                <select
                  value={layout}
                  onChange={(e) => setLayout(e.target.value)}
                  className="w-full p-1.5 rounded-lg border border-slate-300 font-bold text-xs text-slate-800 outline-none"
                >
                  <option value="classic">Classic (Balanced Two-Column)</option>
                  <option value="split">Split Stage (Side-by-Side Symmetrical)</option>
                  <option value="spotlight">Spotlight Hero (Centerpiece Portrait)</option>
                  <option value="broadcast">Broadcast Studio (TV Lower-Third Deck)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Photo Size</label>
                <select
                  value={photoSize}
                  onChange={(e) => setPhotoSize(e.target.value)}
                  className="w-full p-1.5 rounded-lg border border-slate-300 font-bold text-xs text-slate-800 outline-none"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL BOTTOM BUTTONS */}
        <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-200">
          <button
            onClick={openResultsModal}
            className="bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-xl font-bold text-xs transition shadow-xs"
          >
            ♻️ Auction Results
          </button>
          <button
            onClick={resetWholeAuction}
            className="bg-rose-700 hover:bg-rose-800 text-white py-2 rounded-xl font-bold text-xs transition shadow-xs"
          >
            ⚠️ Reset Auction
          </button>
        </div>
      </div>
    </div>
  );
}
