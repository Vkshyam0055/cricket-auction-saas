import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { TournamentContext } from '../context/TournamentContext';
import { apiRequest } from '../utils/apiClient';
import { getEffectivePlanPolicy } from '../utils/planHelper';

export default function RemoteBiddingManagement() {
  const { tournament } = useContext(TournamentContext);
  const navigate = useNavigate();

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal & Form State
  const [editingTeam, setEditingTeam] = useState(null);
  const [editForm, setEditForm] = useState({
    remoteAccessEnabled: false,
    remoteUsername: '',
    remotePassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Copy Feedback & Credential Share Helper
  const [copyFeedback, setCopyFeedback] = useState(null);
  const [lastSavedCredentials, setLastSavedCredentials] = useState(null);

  const organizerPlan = localStorage.getItem('organizerPlan') || 'Free';
  const organizerRole = localStorage.getItem('organizerRole') || 'Organizer';
  const policy = getEffectivePlanPolicy(organizerPlan, organizerRole);
  const isEntitled = Boolean(policy.canRemoteBidding || organizerRole === 'SuperAdmin');

  const portalUrl = `${window.location.origin}/remote-bidding`;

  useEffect(() => {
    if (!tournament) return;
    const fetchTeams = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const res = await apiRequest({
          method: 'get',
          path: `/api/teams/tournament/${tournament._id}`,
          headers
        });
        const teamList = Array.isArray(res.data) ? res.data : [];
        setTeams(teamList);
      } catch (err) {
        console.error('Failed to fetch tournament teams:', err);
        setError(err.message || 'Failed to fetch teams');
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, [tournament]);

  const copyToClipboard = async (text, message = 'Copied to clipboard!') => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopyFeedback(message);
      setTimeout(() => setCopyFeedback(null), 3000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      alert('Could not copy automatically. Please copy manually: ' + text);
    }
  };

  const handleSharePortalWhatsApp = () => {
    const text = `🏏 *${tournament?.name || 'Cricket Auction'} - Remote Bidding Portal*\n\nTeam owners can log in and place bids remotely here:\n${portalUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleOpenEdit = (team) => {
    if (!isEntitled) {
      alert(`Remote Bidding requires a Pro Plan. Your current plan is ${organizerPlan}. Please upgrade to enable remote bidding.`);
      return;
    }
    setEditingTeam(team);
    setFormError(null);
    setShowPassword(false);

    // Auto-suggest username if none exists yet
    const defaultUsername = (team.shortName || team.teamName || 'team')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 15);

    setEditForm({
      remoteAccessEnabled: team.remoteAccessEnabled || false,
      remoteUsername: team.remoteUsername || defaultUsername,
      remotePassword: ''
    });
  };

  const handleCloseEdit = () => {
    setEditingTeam(null);
    setFormError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingTeam) return;

    if (editForm.remoteAccessEnabled && !editForm.remoteUsername.trim()) {
      setFormError('Username is required when remote access is enabled.');
      return;
    }

    if (editForm.remotePassword && editForm.remotePassword.trim().length < 4) {
      setFormError('Password must be at least 4 characters.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await apiRequest({
        method: 'put',
        path: `/api/teams/${editingTeam._id}/remote-access`,
        data: {
          remoteAccessEnabled: editForm.remoteAccessEnabled,
          remoteUsername: editForm.remoteUsername.trim(),
          remotePassword: editForm.remotePassword.trim() || undefined
        },
        headers
      });

      const updatedTeam = res.data?.team || res.data;
      setTeams(teams.map((t) => (t._id === editingTeam._id ? { ...t, ...updatedTeam } : t)));

      if (editForm.remoteAccessEnabled && editForm.remotePassword.trim()) {
        setLastSavedCredentials({
          teamName: editingTeam.teamName,
          shortName: editingTeam.shortName,
          username: editForm.remoteUsername.trim(),
          password: editForm.remotePassword.trim()
        });
      } else {
        setLastSavedCredentials(null);
      }

      setEditingTeam(null);
      setCopyFeedback(`Remote access for ${editingTeam.teamName} updated successfully!`);
      setTimeout(() => setCopyFeedback(null), 4000);
    } catch (err) {
      console.error('Remote access update error:', err);
      setFormError(err.message || 'Failed to update remote access.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareCredentialsWhatsApp = (cred) => {
    if (!cred) return;
    const text = `🏏 *${tournament?.name || 'Cricket Tournament'} - Team Owner Login*\n\n` +
      `*Team:* ${cred.teamName} (${cred.shortName || ''})\n` +
      `*Portal:* ${portalUrl}\n` +
      `*Username:* ${cred.username}\n` +
      `*Password:* ${cred.password}\n\n` +
      `_Please keep these credentials secure and do not share them outside your management._`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Status Counts
  const enabledCount = teams.filter((t) => Boolean(t.remoteAccessEnabled)).length;
  const disabledCount = teams.filter((t) => !t.remoteAccessEnabled && Boolean(t.remoteUsername)).length;
  const notConfiguredCount = teams.filter((t) => !t.remoteUsername).length;

  // Filter & Search
  const filteredTeams = teams.filter((team) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = !term ||
      (team.teamName && team.teamName.toLowerCase().includes(term)) ||
      (team.shortName && team.shortName.toLowerCase().includes(term)) ||
      (team.ownerName && team.ownerName.toLowerCase().includes(term)) ||
      (team.remoteUsername && team.remoteUsername.toLowerCase().includes(term));

    if (!matchesSearch) return false;

    if (statusFilter === 'enabled') return Boolean(team.remoteAccessEnabled);
    if (statusFilter === 'disabled') return !team.remoteAccessEnabled && Boolean(team.remoteUsername);
    if (statusFilter === 'notConfigured') return !team.remoteUsername;
    return true;
  });

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
        <span className="text-4xl mb-4">🏆</span>
        <h2 className="text-xl font-bold">No Tournament Selected</h2>
        <p className="text-slate-400 text-sm mt-1 mb-6">Please select a tournament from your dashboard to manage remote bidding.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg transition-all"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-indigo-500 selection:text-white pb-16">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-20 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Back to Dashboard"
            >
              ← Back
            </button>
            <div>
              <h1 className="font-black text-lg sm:text-xl tracking-tight flex items-center gap-2">
                <span>📱 Remote Bidding Management</span>
              </h1>
              <p className="text-xs text-indigo-400 font-medium truncate max-w-xs sm:max-w-md">
                {tournament.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg font-bold transition-colors"
          >
            Dashboard
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {/* Feedback Alert */}
        {copyFeedback && (
          <div className="mb-4 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-md flex items-center justify-between text-sm font-bold animate-fadeIn">
            <span>✓ {copyFeedback}</span>
            <button onClick={() => setCopyFeedback(null)} className="text-white hover:opacity-80 text-lg">×</button>
          </div>
        )}

        {/* Plan Upgrade Warning if Not Entitled */}
        {!isEntitled && (
          <div className="mb-6 bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 border-2 border-amber-400/50 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">🔒</span>
              <div>
                <h3 className="font-extrabold text-amber-900 text-base">Remote Bidding is a Pro Plan Feature</h3>
                <p className="text-amber-800 text-xs sm:text-sm mt-0.5">
                  Your current account is on the <strong>{organizerPlan}</strong> plan. Upgrade to the Pro plan to provision team owner accounts and enable real-time remote bidding.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md whitespace-nowrap transition-all"
            >
              Upgrade to Pro ⚡
            </button>
          </div>
        )}

        {/* Public Portal Share Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="inline-block text-[10px] font-black tracking-wider uppercase bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full mb-1 border border-indigo-100">
                Team Owner Portal URL
              </span>
              <h2 className="text-lg font-black text-slate-900">Share Bidding Portal Link</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Team owners can open this link on their mobile phones and sign in with their assigned username & password.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => copyToClipboard(portalUrl, 'Portal link copied to clipboard!')}
                className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-sm"
              >
                <span>📋</span> Copy Link
              </button>
              <button
                onClick={handleSharePortalWhatsApp}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-sm"
              >
                <span>💬</span> Share via WhatsApp
              </button>
            </div>
          </div>
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-slate-600 font-mono overflow-x-auto">
            <span className="truncate">{portalUrl}</span>
            <span className="text-[11px] text-slate-400 font-sans ml-2 shrink-0">Common public login</span>
          </div>
        </div>

        {/* Last Saved Credentials Banner */}
        {lastSavedCredentials && (
          <div className="mb-6 bg-emerald-50 border border-emerald-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                <span>🔑</span>
                <span>Credentials Ready to Share for {lastSavedCredentials.teamName}:</span>
              </div>
              <div className="text-xs text-emerald-950 font-mono mt-1 space-x-3">
                <span>Username: <strong>{lastSavedCredentials.username}</strong></span>
                <span>Password: <strong>{lastSavedCredentials.password}</strong></span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleShareCredentialsWhatsApp(lastSavedCredentials)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
              >
                Send via WhatsApp 💬
              </button>
              <button
                onClick={() => setLastSavedCredentials(null)}
                className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Teams Management Table & Filter Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
                  statusFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All ({teams.length})
              </button>
              <button
                onClick={() => setStatusFilter('enabled')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
                  statusFilter === 'enabled'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                }`}
              >
                Enabled ({enabledCount})
              </button>
              <button
                onClick={() => setStatusFilter('disabled')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
                  statusFilter === 'disabled'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
                }`}
              >
                Disabled ({disabledCount})
              </button>
              <button
                onClick={() => setStatusFilter('notConfigured')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
                  statusFilter === 'notConfigured'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Not Configured ({notConfiguredCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search team, owner, user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Teams List */}
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-xs font-bold uppercase tracking-wider">Loading tournament teams...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <div className="inline-block p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-bold">
                ⚠️ {error}
              </div>
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="py-16 text-center text-slate-400 px-4">
              <span className="text-3xl block mb-2">🛡️</span>
              <p className="text-sm font-bold text-slate-700">No teams found matching criteria</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search or status filter.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTeams.map((team) => {
                const isEnabled = Boolean(team.remoteAccessEnabled);
                const hasAccount = Boolean(team.remoteUsername);

                return (
                  <div
                    key={team._id}
                    className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    {/* Left: Team Info */}
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                        {team.logoUrl || team.logo ? (
                          <img
                            src={team.logoUrl || team.logo}
                            alt={team.teamName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.innerHTML = `<span class="text-white font-black text-sm">${team.shortName || 'T'}</span>`;
                            }}
                          />
                        ) : (
                          <span className="text-white font-black text-sm">{team.shortName || team.teamName?.charAt(0) || 'T'}</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                            {team.teamName}
                          </h3>
                          {team.shortName && (
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded border border-slate-200">
                              {team.shortName}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500 mt-1">
                          {team.ownerName && (
                            <span>Owner: <strong className="text-slate-700">{team.ownerName}</strong></span>
                          )}
                          {team.mobile && (
                            <span>📱 {team.mobile}</span>
                          )}
                          <span>Purse: <strong className="text-emerald-700">₹{(team.remainingPurse ?? team.totalPurse ?? 0).toLocaleString()}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Remote Status & Manage Button */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <div>
                          {isEnabled ? (
                            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Remote Active
                            </span>
                          ) : hasAccount ? (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-xs font-bold">
                              <span>⏸</span> Disabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-medium">
                              Not Configured
                            </span>
                          )}
                        </div>
                        {hasAccount && (
                          <div className="text-[11px] text-slate-500 font-mono mt-1">
                            User: <strong className="text-slate-800">{team.remoteUsername}</strong>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleOpenEdit(team)}
                        className="bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 border border-slate-300 hover:border-slate-400 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold shadow-xs transition-all whitespace-nowrap"
                      >
                        {hasAccount ? 'Manage Access' : 'Configure Access'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Configure / Edit Remote Access */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                  Remote Access Account
                </span>
                <h3 className="text-lg font-black">{editingTeam.teamName}</h3>
              </div>
              <button
                onClick={handleCloseEdit}
                className="text-slate-400 hover:text-white text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 rounded-xl">
                  ⚠️ {formError}
                </div>
              )}

              {/* Enable / Disable Switch */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between cursor-pointer"
                onClick={() => setEditForm({ ...editForm, remoteAccessEnabled: !editForm.remoteAccessEnabled })}>
                <div>
                  <div className="font-black text-sm text-slate-900">Enable Remote Bidding</div>
                  <div className="text-xs text-slate-500">Allow team owner to log in and bid remotely</div>
                </div>
                <input
                  type="checkbox"
                  checked={editForm.remoteAccessEnabled}
                  onChange={(e) => setEditForm({ ...editForm, remoteAccessEnabled: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
              </div>

              {/* Username Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Team Owner Username <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required={editForm.remoteAccessEnabled}
                  value={editForm.remoteUsername}
                  onChange={(e) => setEditForm({ ...editForm, remoteUsername: e.target.value })}
                  placeholder="e.g. csk_owner"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Unique username for this tournament team</p>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {editingTeam.remoteUsername ? 'Set New Password' : 'Password'} {editForm.remoteAccessEnabled && !editingTeam.remoteUsername && <span className="text-rose-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={editForm.remoteAccessEnabled && !editingTeam.remoteUsername}
                    value={editForm.remotePassword}
                    onChange={(e) => setEditForm({ ...editForm, remotePassword: e.target.value })}
                    placeholder={editingTeam.remoteUsername ? 'Leave blank to keep existing password' : 'Enter password (min 4 chars)'}
                    className="w-full px-3.5 py-2.5 pr-10 bg-white border border-slate-300 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {editingTeam.remoteUsername && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Leave blank to preserve current password. Changing password resets active sessions.
                  </p>
                )}
              </div>

              {/* Security Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed">
                ℹ️ <strong>Security Notice:</strong> Disabling access or resetting credentials immediately invalidates all active Team Owner sessions for this team.
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  disabled={submitting}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save & Update</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
