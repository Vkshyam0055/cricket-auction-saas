import React, { useEffect, useRef } from 'react';

export default function InfoModal({ open, type, onClose }) {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open || !type) return null;

  const renderContent = () => {
    switch (type) {
      case 'pricing':
        return (
          <div className="space-y-4">
            <div className="text-center pb-2">
              <span className="text-3xl">💎</span>
              <h3 className="text-lg font-black text-slate-900 mt-1">SaaS Membership Plans</h3>
              <p className="text-xs text-slate-500 font-medium">Choose the ideal tier for your tournament scale</p>
            </div>

            <div className="space-y-3">
              {/* Free Tier */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-slate-800">FREE PLAN</span>
                  <span className="text-[10px] uppercase font-extrabold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">Active</span>
                </div>
                <ul className="text-xs text-slate-600 mt-2 space-y-1">
                  <li>• Up to 2 Team Squads</li>
                  <li>• Up to 30 Pool Players</li>
                  <li>• Core Auctioneer Console</li>
                </ul>
              </div>

              {/* Basic Tier */}
              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50">
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-blue-900">BASIC PLAN</span>
                  <span className="text-xs font-bold text-blue-700">₹999 / tournament</span>
                </div>
                <ul className="text-xs text-slate-600 mt-2 space-y-1">
                  <li>• Up to 8 Team Squads</li>
                  <li>• Up to 150 Pool Players</li>
                  <li>• Custom Bidding Increment Buttons</li>
                  <li>• Live Bidding Audio / SFX</li>
                </ul>
              </div>

              {/* Pro Tier */}
              <div className="p-3.5 rounded-xl border-2 border-indigo-500 bg-indigo-50/40 relative overflow-hidden">
                <span className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl-lg">
                  POPULAR
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-indigo-950">PRO PLAN</span>
                  <span className="text-xs font-bold text-indigo-700">₹2,499 / tournament</span>
                </div>
                <ul className="text-xs text-slate-700 mt-2 space-y-1 font-medium">
                  <li>• ⚡ Unlimited Squads & Players</li>
                  <li>• 📺 Live TV / Projector Display Broadcast</li>
                  <li>• 🔗 Public Player Self-Registration Link & QR</li>
                  <li>• 📝 Custom Dynamic Form Builder</li>
                </ul>
              </div>
            </div>

            <div className="pt-2">
              <a
                href="https://wa.me/?text=Hello%20Admin,%20I%20want%20to%20upgrade%20my%20Cricket%20Auction%20plan."
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-md transition text-sm text-center"
              >
                <span>💬</span> Contact Admin for Upgrade
              </a>
            </div>
          </div>
        );

      case 'tutorial-videos':
        return (
          <div className="space-y-4">
            <div className="text-center pb-2">
              <span className="text-3xl">🎓</span>
              <h3 className="text-lg font-black text-slate-900 mt-1">Quick Start Guide</h3>
              <p className="text-xs text-slate-500 font-medium">4 simple steps to run your live IPL-style auction</p>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5">1</span>
                <div>
                  <h4 className="text-xs font-black text-slate-800">Set Tournament Rules</h4>
                  <p className="text-[11px] text-slate-600">Enter name, purse budget per team, and bidding buttons.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5">2</span>
                <div>
                  <h4 className="text-xs font-black text-slate-800">Add Teams & Franchises</h4>
                  <p className="text-[11px] text-slate-600">Create franchises. Each team automatically gets the allotted purse balance.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5">3</span>
                <div>
                  <h4 className="text-xs font-black text-slate-800">Pool Players</h4>
                  <p className="text-[11px] text-slate-600">Add players manually, upload CSV, or share the public registration link.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5">4</span>
                <div>
                  <h4 className="text-xs font-black text-slate-800">Start Auction & Project Screen</h4>
                  <p className="text-[11px] text-slate-600">Open Auctioneer Panel to bid, and project Audience Display on TV.</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'support':
        return (
          <div className="space-y-4">
            <div className="text-center pb-2">
              <span className="text-3xl">🎧</span>
              <h3 className="text-lg font-black text-slate-900 mt-1">Help & Support</h3>
              <p className="text-xs text-slate-500 font-medium">We are here to assist with your auction setup</p>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
                <span className="text-2xl">📱</span>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase">WhatsApp Helpline</div>
                  <div className="text-sm font-black text-slate-800">+91 98765 43210</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
                <span className="text-2xl">✉️</span>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase">Email Support</div>
                  <div className="text-sm font-black text-slate-800">support@cricauction.in</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <span>⚡</span>
                  <span>Average Response Time: Under 15 Minutes</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'about':
        return (
          <div className="space-y-4">
            <div className="text-center pb-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl shadow-md">
                🏏
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-2">Cricket Auction SaaS Portal</h3>
              <p className="text-xs text-indigo-600 font-bold">IPL-Standard Digital Auction Experience</p>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p>
                Cricket Auction Portal is built specifically for local cricket clubs, village tournaments, corporate leagues, and academy organizers.
              </p>
              <p>
                Our real-time bidding engine synchronizes across devices with zero lag, ensuring transparent purse tracking, instant team squad allocation, and professional TV/projector broadcasting.
              </p>
            </div>

            <div className="text-center text-[11px] text-slate-400 font-medium">
              Version 2.4.0 • Made with ❤️ for Cricket Organizers
            </div>
          </div>
        );

      case 'policies':
        return (
          <div className="space-y-4">
            <div className="text-center pb-2">
              <span className="text-3xl">📜</span>
              <h3 className="text-lg font-black text-slate-900 mt-1">Platform Guidelines & Policies</h3>
              <p className="text-xs text-slate-500 font-medium">Fair bidding transparency & data privacy</p>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <h4 className="text-xs font-black text-slate-800 mb-0.5">🔒 Data Safety & Privacy</h4>
                <p className="text-[11px] text-slate-600">Player registrations and organizer data are encrypted. We never share phone numbers or documents with third parties.</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <h4 className="text-xs font-black text-slate-800 mb-0.5">⚖️ Fair Auction Transparency</h4>
                <p className="text-[11px] text-slate-600">Purse deductions and squad limits are automatically enforced by the engine to maintain absolute fairness.</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <h4 className="text-xs font-black text-slate-800 mb-0.5">💳 Payment Policy</h4>
                <p className="text-[11px] text-slate-600">Player registration fees collected via your UPI ID go directly to your bank account without platform commissions.</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in slide-in-from-bottom duration-200"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-slate-100">
          <div className="w-8 sm:hidden h-1 bg-slate-300 rounded-full mx-auto" />
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold ml-auto transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {renderContent()}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
