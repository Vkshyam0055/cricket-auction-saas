import React from 'react';

export const DEFAULT_AUTO_INCREMENT_SLABS = [
  { fromPercentage: 0, toPercentage: 10, incrementPercentage: 1 },
  { fromPercentage: 10, toPercentage: 25, incrementPercentage: 1.5 },
  { fromPercentage: 25, toPercentage: 50, incrementPercentage: 2 },
  { fromPercentage: 50, toPercentage: 75, incrementPercentage: 3 },
  { fromPercentage: 75, toPercentage: 100, incrementPercentage: 4 }
];

export function validateSlabsClient(slabs) {
  if (!Array.isArray(slabs) || slabs.length === 0) {
    return { isValid: false, message: 'कम से कम एक स्लैब होना आवश्यक है।' };
  }
  for (let i = 0; i < slabs.length; i++) {
    const s = slabs[i];
    if (s.fromPercentage < 0 || s.toPercentage <= s.fromPercentage) {
      return { isValid: false, message: `स्लैब ${i + 1} की रेंज अमान्य है ('To %' 'From %' से बड़ा होना चाहिए)।` };
    }
    if (s.incrementPercentage <= 0) {
      return { isValid: false, message: `स्लैब ${i + 1} का इंक्रीमेंट % 0 से अधिक होना चाहिए।` };
    }
  }
  if (slabs[0].fromPercentage !== 0) {
    return { isValid: false, message: 'पहला स्लैब 0% से शुरू होना चाहिए।' };
  }
  for (let i = 1; i < slabs.length; i++) {
    if (Math.abs(slabs[i].fromPercentage - slabs[i - 1].toPercentage) > 0.001) {
      return { isValid: false, message: `स्लैब ${i} और ${i + 1} के बीच गैप या ओवरलैप है।` };
    }
  }
  if (slabs[slabs.length - 1].toPercentage < 100) {
    return { isValid: false, message: 'अंतिम स्लैब कम से कम 100% तक पहुंचना चाहिए।' };
  }
  return { isValid: true };
}

export default function AutoIncrementSlabsConfig({
  slabs = DEFAULT_AUTO_INCREMENT_SLABS,
  onChange,
  teamBudget = 50000000
}) {
  const purse = Math.max(1, Number(teamBudget || 50000000));
  const effectiveSlabs = Array.isArray(slabs) && slabs.length > 0 ? slabs : DEFAULT_AUTO_INCREMENT_SLABS;
  const validation = validateSlabsClient(effectiveSlabs);

  const formatRupees = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(val || 0));

  const handleToChange = (index, newVal) => {
    const val = parseFloat(newVal);
    if (isNaN(val)) return;
    const updated = effectiveSlabs.map((s) => ({ ...s }));
    updated[index].toPercentage = val;
    if (index + 1 < updated.length) {
      updated[index + 1].fromPercentage = val;
    }
    onChange(updated);
  };

  const handleIncrementChange = (index, newVal) => {
    const val = parseFloat(newVal);
    if (isNaN(val)) return;
    const updated = effectiveSlabs.map((s) => ({ ...s }));
    updated[index].incrementPercentage = val;
    onChange(updated);
  };

  const handleAddSlab = () => {
    if (effectiveSlabs.length >= 8) return;
    const last = effectiveSlabs[effectiveSlabs.length - 1];
    const mid = Number(((last.fromPercentage + last.toPercentage) / 2).toFixed(1));
    if (mid <= last.fromPercentage || mid >= last.toPercentage) return;

    const updated = effectiveSlabs.slice(0, effectiveSlabs.length - 1);
    updated.push({
      fromPercentage: last.fromPercentage,
      toPercentage: mid,
      incrementPercentage: last.incrementPercentage
    });
    updated.push({
      fromPercentage: mid,
      toPercentage: last.toPercentage,
      incrementPercentage: Number((last.incrementPercentage + 0.5).toFixed(1))
    });
    onChange(updated);
  };

  const handleRemoveSlab = (index) => {
    if (effectiveSlabs.length <= 2) return;
    const updated = effectiveSlabs.map((s) => ({ ...s }));
    if (index === 0) {
      updated[1].fromPercentage = 0;
      updated.splice(0, 1);
    } else {
      updated[index - 1].toPercentage = updated[index].toPercentage;
      updated.splice(index, 1);
    }
    onChange(updated);
  };

  const handleResetDefaults = () => {
    onChange(DEFAULT_AUTO_INCREMENT_SLABS.map((s) => ({ ...s })));
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div>
          <p className="text-xs text-slate-400">
            बोली वृद्धि टीम पर्स ({formatRupees(purse)}) के अनुपात में स्वतः लागू होगी।
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold transition"
            title="डिफ़ॉल्ट स्लैब रीसेट करें"
          >
            ↺ Defaults
          </button>
          {effectiveSlabs.length < 8 && (
            <button
              type="button"
              onClick={handleAddSlab}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 font-bold transition flex items-center gap-1"
            >
              <span>+ Add Slab</span>
            </button>
          )}
        </div>
      </div>

      {/* Validation Message */}
      {!validation.isValid ? (
        <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
          ⚠️ {validation.message}
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-emerald-400 font-semibold px-1">
          <span>✓ स्लैब रेंज 0% से 100% तक मान्य व निरंतर हैं</span>
          <span className="text-slate-400">{effectiveSlabs.length} Slabs Configured</span>
        </div>
      )}

      {/* Slabs List / Editor */}
      <div className="space-y-2.5">
        {effectiveSlabs.map((slab, index) => {
          const fromRupees = Math.round((purse * slab.fromPercentage) / 100);
          const toRupees = Math.round((purse * slab.toPercentage) / 100);
          const rawIncrement = (purse * slab.incrementPercentage) / 100;
          const rupeeIncrement = Math.max(1, Math.ceil(rawIncrement));
          const isFirst = index === 0;
          const isLast = index === effectiveSlabs.length - 1;

          return (
            <div
              key={`slab-row-${index}`}
              className="p-3 bg-slate-850/80 border border-slate-800 hover:border-slate-700 rounded-xl transition space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Slab #{index + 1}
                </span>

                <div className="text-right">
                  <span className="text-xs font-black text-emerald-400">
                    +{formatRupees(rupeeIncrement)}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1 font-semibold">
                    ({slab.incrementPercentage}%)
                  </span>
                </div>
              </div>

              {/* Grid of Inputs */}
              <div className="grid grid-cols-12 gap-2 items-center">
                {/* From % */}
                <div className="col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">From %</label>
                  <div className="w-full bg-slate-800/60 border border-slate-700/80 rounded-lg px-2 py-1.5 text-center text-xs font-black text-slate-300">
                    {slab.fromPercentage}%
                  </div>
                </div>

                {/* To % */}
                <div className="col-span-4">
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">
                    To % {isLast ? '(Max)' : ''}
                  </label>
                  {isLast ? (
                    <div className="w-full bg-slate-800/60 border border-slate-700/80 rounded-lg px-2 py-1.5 text-center text-xs font-black text-slate-300">
                      {slab.toPercentage}%
                    </div>
                  ) : (
                    <input
                      type="number"
                      step="0.5"
                      min={slab.fromPercentage + 0.1}
                      max={isLast ? 1000 : (effectiveSlabs[index + 1]?.toPercentage || 100) - 0.1}
                      value={slab.toPercentage}
                      onChange={(e) => handleToChange(index, e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-xs font-black text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  )}
                </div>

                {/* Increment % */}
                <div className="col-span-4">
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Increment %</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    value={slab.incrementPercentage}
                    onChange={(e) => handleIncrementChange(index, e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-xs font-black text-amber-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Remove button */}
                <div className="col-span-1 flex justify-end">
                  {effectiveSlabs.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSlab(index)}
                      className="text-slate-500 hover:text-rose-400 p-1 font-bold text-xs transition"
                      title="स्लैब हटाएं"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Dynamic Rupee Range Preview */}
              <div className="pt-1 flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-800/60 font-medium">
                <span>
                  Bid Range: <b className="text-slate-200">{formatRupees(fromRupees)}</b> –{' '}
                  <b className="text-slate-200">{formatRupees(toRupees)}</b>
                </span>
                <span className="text-[10px] text-indigo-400 font-semibold">
                  Increment: +{formatRupees(rupeeIncrement)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Example Bid Calculator Preview */}
      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
        <span className="text-[11px] font-black uppercase text-indigo-400 tracking-wider block">
          🔍 Live Increment Preview (टीम पर्स: {formatRupees(purse)})
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {[
            { label: 'Opening (0%)', bid: 0 },
            { label: 'Early (15%)', bid: Math.round(purse * 0.15) },
            { label: 'Mid (35%)', bid: Math.round(purse * 0.35) },
            { label: 'High (60%)', bid: Math.round(purse * 0.60) },
            { label: 'Top (85%)', bid: Math.round(purse * 0.85) }
          ].map((sample, idx) => {
            const bidPct = (sample.bid / purse) * 100;
            const matched = effectiveSlabs.find((s, sIdx) => {
              const isF = sIdx === 0;
              const isL = sIdx === effectiveSlabs.length - 1;
              if (isF && bidPct <= s.toPercentage) return true;
              if (!isF && !isL && bidPct > s.fromPercentage && bidPct <= s.toPercentage) return true;
              if (isL && bidPct > s.fromPercentage) return true;
              return false;
            }) || effectiveSlabs[effectiveSlabs.length - 1];

            const incRupees = Math.max(1, Math.ceil((purse * matched.incrementPercentage) / 100));

            return (
              <div key={`sample-${idx}`} className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-semibold">{sample.label}</span>
                <span className="font-bold text-slate-200 text-[11px]">{formatRupees(sample.bid)}</span>
                <div className="text-[10px] text-emerald-400 font-black mt-0.5">
                  +{formatRupees(incRupees)} ({matched.incrementPercentage}%)
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
