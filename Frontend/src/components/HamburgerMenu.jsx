import React from 'react';

export default function HamburgerMenu({ open, onClose, profile, onNavigate, onLogout }) {
  const groups = [
    {
      label: 'TOURNAMENT',
      items: [
        { key: 'dashboard', icon: '📊', text: 'Dashboard' },
        { key: 'tournament-settings', icon: '⚙️', text: 'Tournament Settings' },
        { key: 'view-auction', icon: '📺', text: 'View Auction Live' },
      ],
    },
    {
      label: 'MANAGE',
      items: [
        { key: 'teams', icon: '🛡️', text: 'Teams' },
        { key: 'players', icon: '🏏', text: 'Players' },
        { key: 'registration-form', icon: '📝', text: 'Registration Form' },
      ],
    },
    {
      label: 'ACCOUNT',
      items: [
        { key: 'pricing', icon: '💳', text: 'Plans & Pricing' },
        { key: 'change-password', icon: '🔑', text: 'Change Password' },
        { key: 'tutorial-videos', icon: '▶️', text: 'Tutorial Videos' },
      ],
    },
    {
      label: 'INFO',
      items: [
        { key: 'support', icon: '🎧', text: 'Support' },
        { key: 'about', icon: 'ℹ️', text: 'About Us' },
        { key: 'policies', icon: '📜', text: 'Policies' },
      ],
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 transition-opacity z-40 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
      />
      
      {/* Sidebar */}
      <aside 
        className={`fixed top-0 left-0 h-full w-72 sm:w-80 bg-slate-900 text-slate-100 z-50 shadow-2xl transform transition-transform duration-300 flex flex-col ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Profile Header */}
        <div className="flex-none p-4 border-b border-slate-700 relative bg-slate-800">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white"
          >
            ✕
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-bold text-white shrink-0">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden pr-6">
              <div className="font-bold text-slate-100 truncate">{profile?.name || 'User'}</div>
              <div className="text-sm text-slate-400 truncate">{profile?.email || profile?.phone || 'No email provided'}</div>
              {profile?.plan && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs rounded-full border border-indigo-500/30 font-medium">
                  {profile.plan} Plan
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-2">
          {groups.map((group, idx) => (
            <div key={idx} className="mb-2 sm:mb-3">
              <div className="px-4 py-1 text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      onNavigate(item.key);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 sm:px-5 sm:py-2.5 text-left text-xs sm:text-sm text-slate-300 hover:bg-slate-800 hover:text-indigo-400 transition-colors"
                  >
                    <span className="text-base sm:text-lg">{item.icon}</span>
                    <span className="font-semibold">{item.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {/* Logout Footer */}
        <div className="flex-none p-4 border-t border-slate-700 bg-slate-800">
          <button 
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white py-2.5 rounded-lg transition-colors font-bold"
          >
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>
    </>
  );
}