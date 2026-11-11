export const DISPLAY_MODES = {
  day: {
    page: 'bg-slate-100 text-slate-900',
    gradient: 'from-white via-sky-100 to-slate-200 opacity-90',
    panel: 'bg-white/90 border-slate-300 text-slate-900',
    strongPanel: 'bg-white/95 border-sky-500 text-slate-900',
    tableHeader: 'bg-slate-200 text-slate-800 border-slate-300',
    tableRowHover: 'hover:bg-slate-100',
    tableDivider: 'divide-slate-200',
    mutedText: 'text-slate-600',
    headingText: 'text-slate-900',
    bidText: 'text-emerald-600',
    bidderText: 'text-amber-600'
  },
  night: {
    page: 'bg-black text-white',
    gradient: 'from-blue-900 via-gray-900 to-black opacity-70',
    panel: 'bg-black/40 border-gray-700 text-white',
    strongPanel: 'bg-gradient-to-r from-blue-950 via-gray-900 to-gray-900 border-purple-500 text-white',
    tableHeader: 'bg-slate-900/80 text-slate-300 border-slate-700/50',
    tableRowHover: 'hover:bg-white/5',
    tableDivider: 'divide-slate-800/40',
    mutedText: 'text-gray-400',
    headingText: 'text-white',
    bidText: 'text-green-400',
    bidderText: 'text-yellow-400'
  },
  projector: {
    page: 'bg-white text-black',
    gradient: 'from-yellow-50 via-white to-blue-50 opacity-95',
    panel: 'bg-white/95 border-gray-300 text-black',
    strongPanel: 'bg-white border-indigo-600 text-black',
    tableHeader: 'bg-slate-100 text-slate-800 border-gray-300',
    tableRowHover: 'hover:bg-blue-50/40',
    tableDivider: 'divide-gray-200',
    mutedText: 'text-gray-700',
    headingText: 'text-black',
    bidText: 'text-green-700',
    bidderText: 'text-indigo-700'
  }
};

export const PHOTO_SIZE_CLASS = {
  small: 'lg:w-[26%]',
  medium: 'lg:w-[32%]',
  large: 'lg:w-[38%]'
};
