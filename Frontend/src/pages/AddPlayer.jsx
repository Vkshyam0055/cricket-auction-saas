import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  UserPlus,
  CheckCircle2,
  XCircle,
  Info,
  Lightbulb,
  AlertTriangle
} from 'lucide-react';
import { apiRequest } from '../utils/apiClient';
import { getEffectivePlanPolicy, fetchAndCachePlans } from '../utils/planHelper';
import SinglePlayerForm from '../components/SinglePlayerForm';
import QuickMultiAdd from '../components/QuickMultiAdd';
import BulkImportWizard from '../components/BulkImportWizard';

function AddPlayer() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('single');

  // Plan limit states
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [organizerPlan, setOrganizerPlan] = useState('Free');
  const [organizerRole, setOrganizerRole] = useState('Organizer');
  const [, setPlansCacheKey] = useState(0);

  const fetchPlayers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await apiRequest({
        method: 'get',
        path: '/api/players',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (Array.isArray(res.data)) {
        setTotalPlayers(res.data.length);
      }
    } catch (e) {
      console.error('Error fetching player count:', e);
    }
  };

  useEffect(() => {
    setOrganizerPlan(localStorage.getItem('organizerPlan') || 'Free');
    setOrganizerRole(localStorage.getItem('organizerRole') || 'Organizer');
    fetchPlayers();
    fetchAndCachePlans().then(() => setPlansCacheKey(Date.now()));
  }, []);

  const activePolicy = getEffectivePlanPolicy(organizerPlan, organizerRole);
  const playerLimit = activePolicy.playerLimit;
  const isLimitReached = playerLimit !== -1 && totalPlayers >= playerLimit && organizerRole !== 'SuperAdmin';

  const tabs = [
    { id: 'single', label: 'Single Player' },
    { id: 'quick', label: 'Quick Multi-Add' },
    { id: 'bulk', label: 'Bulk Import (Excel)' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* Top Navigation & Breadcrumbs Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center space-x-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition active:scale-95 self-start"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Players</span>
          </button>

          <nav className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5 self-start sm:self-auto">
            <span className="hover:text-slate-600 transition">Tournament</span>
            <span>&gt;</span>
            <span className="hover:text-slate-600 transition">Players</span>
            <span>&gt;</span>
            <span className="text-blue-600 font-bold">Add Player</span>
          </nav>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Title & Plan Quota */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs border border-blue-200 shrink-0">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                Add New Player
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                Add player details for your tournament
              </p>
            </div>
          </div>

          <div
            className={`self-start sm:self-auto px-4 py-1.5 rounded-full font-bold text-xs sm:text-sm border ${
              isLimitReached
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {playerLimit === -1 ? 'Unlimited Players' : `Players Added: ${totalPlayers} / ${playerLimit}`}
          </div>
        </div>

        {/* Plan Limit Warning Banner */}
        {isLimitReached && (
          <div className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-rose-800">
                Player Limit Reached ({playerLimit} players maximum)
              </p>
              <p className="text-xs text-rose-600 mt-0.5">
                Your current {organizerPlan} plan has reached its quota. Upgrade your plan to add more players.
              </p>
            </div>
          </div>
        )}

        {/* Segmented Control / Tabs */}
        <div className="mb-8 w-full">
          <div className="inline-flex flex-wrap p-1.5 bg-slate-200/60 rounded-xl sm:rounded-full shadow-sm w-full sm:w-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold rounded-lg sm:rounded-full transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: Dynamic Tab Content Section (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            {activeTab === 'single' && (
              <SinglePlayerForm 
                playerLimit={playerLimit} 
                isLimitReached={isLimitReached} 
                fetchPlayers={fetchPlayers} 
              />
            )}
            {activeTab === 'quick' && (
              <QuickMultiAdd 
                playerLimit={playerLimit} 
                isLimitReached={isLimitReached} 
                fetchPlayers={fetchPlayers} 
              />
            )}
            {activeTab === 'bulk' && (
              <BulkImportWizard 
                playerLimit={playerLimit} 
                isLimitReached={isLimitReached} 
                fetchPlayers={fetchPlayers} 
              />
            )}
          </div>

          {/* RIGHT: Sidebar Section (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Card: Tips for a good player photo */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80">
              <div className="flex items-center space-x-2.5 mb-5">
                <Lightbulb className="w-5 h-5 text-amber-500 shrink-0" />
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Tips for a good player photo
                </h3>
              </div>

              <ul className="space-y-3 mb-6">
                {[
                  'Use a clear, front-facing photo',
                  'Crop to show only the face and shoulders',
                  'Good lighting, no blur',
                  'Avoid group photos',
                  'Square image works best'
                ].map((tip, idx) => (
                  <li key={idx} className="flex items-start space-x-2.5 text-xs sm:text-sm text-slate-600 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>

              {/* Visual Example Comparison */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Example
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-slate-200 rounded-2xl p-3 text-center bg-slate-50/50 flex flex-col items-center">
                    <div className="relative mb-2">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 overflow-hidden flex items-center justify-center text-white text-2xl shadow-sm">
                        👨
                      </div>
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <p className="text-xs font-black text-slate-900 leading-tight">Good Photo</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-none">
                      Clear, front-facing
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-2xl p-3 text-center bg-slate-50/50 flex flex-col items-center">
                    <div className="relative mb-2">
                      <div className="w-16 h-16 rounded-xl bg-slate-300 overflow-hidden flex items-center justify-center text-slate-500 text-2xl blur-[1.5px] opacity-70">
                        👥
                      </div>
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-xs">
                        <XCircle className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <p className="text-xs font-black text-slate-900 leading-tight">Avoid</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-none">
                      Blurred or distant
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Callout Card */}
            <div className="bg-blue-50/80 rounded-2xl p-4 sm:p-5 border border-blue-100 flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm font-medium text-blue-950 leading-relaxed">
                Player photos will be visible to team owners and on the live auction screen.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddPlayer;