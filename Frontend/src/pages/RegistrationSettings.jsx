import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TournamentContext } from '../context/TournamentContext';
import { apiRequest } from '../utils/apiClient';

export default function RegistrationSettings() {
  const navigate = useNavigate();
  const { tournament, fetchTournament, setTournament } = useContext(TournamentContext);

  const [paymentMessage, setPaymentMessage] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiQrUrl, setUpiQrUrl] = useState('');
  const [customFields, setCustomFields] = useState([]);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [isUpdatingRegistration, setIsUpdatingRegistration] = useState(false);

  const publicRegistrationUrl = useMemo(() => {
    if (!tournament?._id) return '';
    return `${window.location.origin}/register/${tournament._id}`;
  }, [tournament?._id]);

  useEffect(() => {
    if (tournament) {
      setPaymentMessage(tournament.paymentMessage || '');
      setUpiId(tournament.upiId || '');
      setUpiQrUrl(tournament.upiQrUrl || '');
      setCustomFields(tournament.customFields || []);
    }
  }, [tournament]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleUploadQr = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingQr(true);
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', 'auction_preset');
    data.append('cloud_name', 'dpg5olqt7');
    try {
      const res = await axios.post('https://api.cloudinary.com/v1_1/dpg5olqt7/image/upload', data);
      setUpiQrUrl(res.data.secure_url);
    } catch (err) {
      showToast('❌ QR upload failed!');
    } finally {
      setIsUploadingQr(false);
    }
  };

  // Form Builder handlers
  const addField = () => setCustomFields([...customFields, { label: '', type: 'text', required: false, options: [] }]);
  const removeField = (index) => setCustomFields(customFields.filter((_, i) => i !== index));
  const updateField = (index, key, value) => {
    const updated = [...customFields];
    if (key === 'options') updated[index][key] = value.split(',').map(s => s.trim());
    else updated[index][key] = value;
    setCustomFields(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        name: tournament.name,
        venue: tournament.venue,
        logoUrl: tournament.logoUrl || '',
        tournamentPoster: tournament.tournamentPoster || '',
        teamBudget: tournament.teamBudget,
        minPlayersPerTeam: tournament.minPlayersPerTeam,
        bidButton1: tournament.bidButton1,
        bidButton2: tournament.bidButton2,
        bidButton3: tournament.bidButton3,
        customFields,
        upiQrUrl,
        upiId,
        paymentMessage,
      };
      await apiRequest({ method: 'post', path: '/api/tournament', data: payload, headers });
      await fetchTournament();
      showToast('✅ Registration settings saved!');
    } catch (err) {
      console.error(err);
      showToast('❌ Save failed!');
    } finally {
      setSaving(false);
    }
  };

  const handleRegistrationToggle = async () => {
    if (!tournament?._id || isUpdatingRegistration) return;
    try {
      setIsUpdatingRegistration(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const isCurrentlyOpen = tournament.isRegistrationOpen !== false;
      const newStatus = !isCurrentlyOpen;
      const res = await apiRequest({
        method: 'patch',
        path: '/api/tournament/registration-status',
        data: { isRegistrationOpen: newStatus },
        headers
      });
      if (res.data?.tournament) {
        setTournament(res.data.tournament);
      } else {
        await fetchTournament();
      }
    } catch (error) {
      console.error(error);
      showToast('Toggle failed!');
    } finally {
      setIsUpdatingRegistration(false);
    }
  };

  const copyLink = async () => {
    if (!publicRegistrationUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicRegistrationUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = publicRegistrationUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast('🔗 Link copied!');
    } catch {
      showToast('Copy failed — manually copy करें');
    }
  };

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="flex items-center px-4 h-14">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-indigo-400 hover:text-indigo-300 font-medium"
          >
            <span className="mr-1 text-xl">←</span> Dashboard
          </button>
          <h1 className="flex-1 text-center text-base font-bold text-slate-100 pr-20">
            📋 Registration Settings
          </h1>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4">

        {/* Registration Toggle + Link */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-100">Public Registration</h2>
              <p className="text-xs text-slate-400 mt-0.5">Players को direct register करने दें</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRegistrationToggle}
                disabled={isUpdatingRegistration}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                  tournament?.isRegistrationOpen !== false ? 'bg-emerald-500' : 'bg-slate-600'
                } ${isUpdatingRegistration ? 'opacity-50' : ''}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    tournament?.isRegistrationOpen !== false ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-xs font-black uppercase ${
                tournament?.isRegistrationOpen !== false ? 'text-emerald-400' : 'text-slate-500'
              }`}>
                {tournament?.isRegistrationOpen !== false ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
          </div>

          {/* Public Link */}
          {publicRegistrationUrl && (
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <a
                  href={publicRegistrationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-400 font-medium truncate flex-1 underline underline-offset-2"
                >
                  {publicRegistrationUrl}
                </a>
                <button
                  onClick={copyLink}
                  className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition"
                >
                  Copy 📋
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Payment / UPI Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            💳 Payment & UPI Settings
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Payment Instruction / Message</label>
              <input
                type="text"
                value={paymentMessage}
                onChange={(e) => setPaymentMessage(e.target.value)}
                placeholder="e.g. Entry Fee ₹500. Pay below."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">UPI ID</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. 9876543210@ybl"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">UPI QR Code</label>
              <div className="flex items-center gap-3">
                {upiQrUrl && <img src={upiQrUrl} alt="QR" className="w-14 h-14 object-contain bg-white rounded-lg p-1" />}
                <label className="flex-1 cursor-pointer bg-slate-800 border border-slate-700 border-dashed rounded-lg px-4 py-3 text-center hover:border-indigo-500 transition">
                  <span className="text-sm text-indigo-400 font-medium">
                    {isUploadingQr ? 'Uploading...' : upiQrUrl ? '✅ Change QR' : '📁 Upload QR Image'}
                  </span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleUploadQr} disabled={isUploadingQr} />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Form Builder */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              📝 Registration Form Builder
            </h2>
            <button
              type="button"
              onClick={addField}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition"
            >
              + Add Field
            </button>
          </div>

          {customFields.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <p className="text-2xl mb-2">📝</p>
              <p className="text-sm font-medium">कोई custom field नहीं है</p>
              <p className="text-xs mt-1">अतिरिक्त जानकारी (जैसे T-shirt Size, Payment Screenshot) मांगने के लिए field जोड़ें</p>
            </div>
          ) : (
            <div className="space-y-3">
              {customFields.map((field, index) => (
                <div key={index} className="bg-slate-800 p-3 rounded-lg border border-slate-700 relative">
                  <button
                    type="button"
                    onClick={() => removeField(index)}
                    className="absolute top-2 right-2 text-red-400 hover:text-red-300 font-bold text-sm px-1.5 py-0.5 rounded hover:bg-red-500/10"
                  >
                    ✖
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 pr-8">
                    <input
                      type="text"
                      placeholder="Field Label (e.g. T-Shirt Size)"
                      value={field.label}
                      onChange={(e) => updateField(index, 'label', e.target.value)}
                      required
                      className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <select
                      value={field.type}
                      onChange={(e) => updateField(index, 'type', e.target.value)}
                      className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-indigo-400 font-medium focus:outline-none focus:border-indigo-500"
                    >
                      <option value="text">Text (Short Answer)</option>
                      <option value="number">Number</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="file">File Upload (Image/PDF)</option>
                      <option value="checkbox">Checkbox (Yes/No)</option>
                    </select>
                  </div>

                  {field.type === 'dropdown' && (
                    <input
                      type="text"
                      placeholder="Options (comma separated: S, M, L, XL)"
                      value={field.options?.join(', ')}
                      onChange={(e) => updateField(index, 'options', e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 mb-2"
                    />
                  )}

                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(index, 'required', e.target.checked)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className="font-medium">Required?</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || isUploadingQr}
          className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all disabled:opacity-70 flex justify-center items-center gap-2"
        >
          {saving ? 'Saving...' : 'Save Registration Settings ✓'}
        </button>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-800 text-slate-100 px-4 py-3 rounded-lg shadow-xl border border-slate-700 z-50 text-sm font-medium text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
