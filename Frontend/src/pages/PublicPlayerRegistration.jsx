import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../utils/apiClient';

function PublicPlayerRegistration() {
  const { tournamentId } = useParams();
  
  const [tournamentDetails, setTournamentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '', fatherName: '', age: '', mobile: '', city: '', role: 'Batsman', basePrice: 0, photoUrl: ''
  });
  
  const [customData, setCustomData] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false); 
  const [paymentActionMessage, setPaymentActionMessage] = useState('');

  // 🌟 NEW: Poster Popup State
  const [showPosterPopup, setShowPosterPopup] = useState(false);

  const CLOUD_NAME = "dpg5olqt7"; 
  const UPLOAD_PRESET = "auction_preset"; 

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await apiRequest({ method: 'get', path: `/api/players/public/${tournamentId}` });
        setTournamentDetails(res.data);
        
        // 🌟 Fix: Show poster popup if poster exists
        if(res.data.tournamentPoster) {
            setShowPosterPopup(true);
        }
        
        const initialCustomData = {};
        if(res.data.customFields) {
            res.data.customFields.forEach(field => { initialCustomData[field.label] = field.type === 'checkbox' ? false : ''; });
            setCustomData(initialCustomData);
        }
      } catch (err) { setError(err.response?.data?.message || 'Invalid URL or Registration Closed'); } 
      finally { setLoading(false); }
    };
    if (tournamentId) fetchDetails();
  }, [tournamentId]);

  const handleStandardChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleCustomChange = (e, label, type) => {
      setCustomData({ ...customData, [label]: type === 'checkbox' ? e.target.checked : e.target.value });
  };

  const handleCopyUpiId = async () => {
    const upiId = tournamentDetails?.upiId;
    if (!upiId) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(upiId);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = upiId;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!copied) throw new Error('Clipboard copy failed');
      }
      setPaymentActionMessage('UPI ID copied!');
    } catch (err) {
      console.error('UPI ID copy failed:', err);
      setPaymentActionMessage('Could not copy the UPI ID. Please copy it manually.');
    }
  };

  const handleDownloadQrCode = async () => {
    const qrUrl = tournamentDetails?.upiQrUrl;
    if (!qrUrl) return;

    try {
      // Cloudinary QR images are cross-origin, so download a Blob to preserve browser download behavior.
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error('QR image download failed');

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'upi-qr-code';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      setPaymentActionMessage('QR code download started!');
    } catch (err) {
      console.error('QR code download failed:', err);
      const qrWindow = window.open(qrUrl, '_blank', 'noopener,noreferrer');
      setPaymentActionMessage(qrWindow ? 'QR code opened in a new tab. Save it from there.' : 'Could not download the QR code. Please try again.');
    }
  };

  const uploadToCloudinary = async (file) => {
    const data = new FormData();
    data.append("file", file); data.append("upload_preset", UPLOAD_PRESET); data.append("cloud_name", CLOUD_NAME);
    const res = await axios.post(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, data);
    return res.data.secure_url;
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setFormData({ ...formData, photoUrl: url }); 
      alert("✅ फोटो अपलोड हो गई!");
    } catch (err) { alert("❌ फोटो अपलोड फेल!"); } 
    finally { setIsUploading(false); }
  };

  const handleCustomFileUpload = async (e, label) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setCustomData({ ...customData, [label]: url }); 
      alert(`✅ ${label} अपलोड हो गया!`);
    } catch (err) { alert(`❌ ${label} अपलोड फेल!`); } 
    finally { setIsUploading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isUploading) { alert("फोटो/फाइल अपलोड हो रही है, इंतज़ार करें..."); return; }
    try {
      await apiRequest({
        method: 'post',
        path: `/api/players/public/${tournamentId}/register`,
        data: { ...formData, customData }
      });
      setIsSuccess(true);
    } catch (err) { alert("Registration failed! Please try again."); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center font-sans p-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="font-black text-lg tracking-tight">PLAYER REGISTRATION</div>
        <p className="text-xs text-slate-400 font-medium mt-1">Loading tournament information...</p>
      </div>
    );
  }

  if (error || !tournamentDetails) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 font-sans">
        <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl text-center max-w-md w-full border border-slate-200">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl mx-auto mb-4 border border-rose-100">
            ⚠️
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">Registration Unavailable</h2>
          <p className="text-slate-600 text-sm font-medium">{error || 'Tournament registration link is invalid or closed.'}</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 font-sans">
        <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl text-center max-w-md w-full border border-slate-200">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mx-auto mb-4 border border-emerald-100">
            ✓
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight">Registration Successful!</h2>
          <p className="text-slate-600 text-sm font-medium mb-6 leading-relaxed">
            आपका रजिस्ट्रेशन सफलतापूर्वक जमा हो गया है। टूर्नामेंट आयोजक विवरण की पुष्टि करेंगे।
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left mb-6">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tournament</p>
            <p className="text-sm font-black text-slate-900 mt-0.5">{tournamentDetails.name}</p>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-3">Player Name</p>
            <p className="text-sm font-black text-slate-900 mt-0.5">{formData.name}</p>
          </div>
          <p className="text-xs text-slate-400 font-medium">You may close this window or contact the tournament organizer for queries.</p>
        </div>
      </div>
    );
  }

  // 🌟 POSTER POPUP OVERLAY 🌟
  if (showPosterPopup) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="relative max-w-lg w-full flex flex-col items-center">
          <img
            src={tournamentDetails.tournamentPoster}
            alt="Tournament Poster"
            className="max-w-full max-h-[72vh] rounded-2xl shadow-2xl object-contain mb-6 border border-slate-800"
          />
          <button
            type="button"
            onClick={() => setShowPosterPopup(false)}
            className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm sm:text-base px-8 py-3.5 rounded-full shadow-lg shadow-amber-400/25 active:scale-95 transition-all"
          >
            Proceed to Registration 👉
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-900 p-3 sm:p-6 lg:p-8 flex flex-col items-center justify-center relative overflow-hidden pb-16">
      {/* Background ambient orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-indigo-600/15 rounded-full blur-[90px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-blue-600/15 rounded-full blur-[90px] pointer-events-none"></div>

      {/* Tournament Identity Header */}
      <div className="mb-6 sm:mb-8 text-center mt-4 relative z-10 max-w-xl">
        {tournamentDetails.logoUrl ? (
          <img
            src={tournamentDetails.logoUrl}
            alt="Logo"
            className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3.5 rounded-2xl bg-white p-1 object-contain border border-slate-700 shadow-xl"
          />
        ) : (
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3.5 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 p-0.5 shadow-xl flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-2xl sm:text-3xl">
              🏏
            </div>
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
          {tournamentDetails.name}
        </h1>
        <div className="mt-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-amber-400/15 text-amber-400 border border-amber-400/30">
            Player Registration Form
          </span>
        </div>
      </div>

      {/* Main Registration Form Card */}
      <div className="w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-800/20 relative z-10">
        <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-5 sm:space-y-6">
          
          {/* 🌟 Payment & Registration Fee Section 🌟 */}
          {(tournamentDetails.upiQrUrl || tournamentDetails.upiId || tournamentDetails.paymentMessage) && (
            <div className="bg-gradient-to-b from-emerald-50/80 via-slate-50/40 to-white p-5 sm:p-6 rounded-2xl border border-emerald-200/80 text-center shadow-2xs">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 mb-3">
                <span>💸</span>
                <span>Registration Fee Instructions</span>
              </div>
              
              {tournamentDetails.paymentMessage && (
                <p className="text-xs sm:text-sm font-semibold text-slate-700 mb-4 leading-relaxed">
                  {tournamentDetails.paymentMessage}
                </p>
              )}

              {tournamentDetails.upiQrUrl && (
                <div className="flex flex-col items-center mb-4">
                  <div className="bg-white p-3 rounded-2xl shadow-sm inline-block border border-slate-200">
                    <img
                      src={tournamentDetails.upiQrUrl}
                      alt="Scan to Pay"
                      className="w-36 h-36 sm:w-40 sm:h-40 object-contain rounded-xl"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadQrCode}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition"
                    title="Download QR Code"
                  >
                    <span>⬇️</span>
                    <span>Download QR</span>
                  </button>
                </div>
              )}

              {tournamentDetails.upiId && (
                <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 max-w-sm">
                  <div className="flex items-center space-x-2.5 min-w-0 text-left">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-base shrink-0 border border-emerald-100">
                      🏦
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 font-bold uppercase leading-none">UPI ID</p>
                      <p className="font-black text-sm sm:text-base text-slate-900 tracking-wide truncate">
                        {tournamentDetails.upiId}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUpiId}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 hover:bg-indigo-600 active:bg-indigo-700 text-white text-xs font-bold transition border border-slate-800 shrink-0 shadow-2xs"
                    title="Copy UPI ID"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>{paymentActionMessage === 'UPI ID copied!' ? 'Copied! ✓' : 'Copy UPI'}</span>
                  </button>
                </div>
              )}

              {paymentActionMessage && (
                <p className={`mt-3 text-xs font-bold ${paymentActionMessage.startsWith('Could') ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {paymentActionMessage}
                </p>
              )}
            </div>
          )}

          {/* 🌟 Profile Photo Upload Area 🌟 */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Player Photo
            </label>
            <div className="p-5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center text-center group">
              {formData.photoUrl ? (
                <div className="relative mb-3">
                  <img
                    src={formData.photoUrl}
                    alt="Preview"
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shadow-md border-2 border-white ring-2 ring-blue-500"
                  />
                  <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-xs">
                    ✓
                  </span>
                </div>
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center text-3xl mb-3 shadow-inner group-hover:scale-105 transition-transform">
                  📷
                </div>
              )}
              <label className="cursor-pointer inline-flex items-center gap-2 bg-white px-4 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-xs border border-slate-300 text-slate-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all">
                <span>{isUploading ? 'Uploading...' : formData.photoUrl ? 'Change Photo' : 'Upload Profile Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
              <p className="text-[11px] text-slate-400 font-medium mt-1.5">JPG, PNG or WEBP up to 5MB</p>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Full Name *
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="e.g. Virat Kohli"
              onChange={handleStandardChange}
              className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all text-sm sm:text-base"
            />
          </div>

          {/* Age & Mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Age
              </label>
              <input
                name="age"
                type="number"
                placeholder="e.g. 24"
                onChange={handleStandardChange}
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all text-sm sm:text-base"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Mobile Number *
              </label>
              <input
                name="mobile"
                type="tel"
                required
                placeholder="e.g. 9876543210"
                onChange={handleStandardChange}
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all text-sm sm:text-base"
              />
            </div>
          </div>

          {/* Playing Role */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Playing Role *
            </label>
            <div className="relative">
              <select
                name="role"
                onChange={handleStandardChange}
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all text-sm sm:text-base appearance-none cursor-pointer"
              >
                <option value="Batsman">Batsman</option>
                <option value="Bowler">Bowler</option>
                <option value="All-Rounder">All-Rounder</option>
                <option value="Wicket Keeper">Wicket Keeper</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
                ▼
              </div>
            </div>
          </div>

          {/* City / Village */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              City / Village
            </label>
            <input
              name="city"
              type="text"
              placeholder="e.g. Jaipur"
              onChange={handleStandardChange}
              className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all text-sm sm:text-base"
            />
          </div>

          {/* 🌟 Dynamic Custom Tournament Fields 🌟 */}
          {tournamentDetails.customFields && tournamentDetails.customFields.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
              <div className="text-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                  Additional Tournament Information
                </span>
              </div>
              {tournamentDetails.customFields.map((field, idx) => (
                <div key={idx} className="pt-1">
                  {field.type !== 'checkbox' && (
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      {field.label} {field.required && <span className="text-rose-600">*</span>}
                    </label>
                  )}
                  {field.type === 'text' && (
                    <input
                      type="text"
                      required={field.required}
                      placeholder={`Enter ${field.label}`}
                      onChange={(e) => handleCustomChange(e, field.label, field.type)}
                      className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all text-sm sm:text-base"
                    />
                  )}
                  {field.type === 'number' && (
                    <input
                      type="number"
                      required={field.required}
                      placeholder={`Enter ${field.label}`}
                      onChange={(e) => handleCustomChange(e, field.label, field.type)}
                      className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all text-sm sm:text-base"
                    />
                  )}
                  {field.type === 'dropdown' && (
                    <div className="relative">
                      <select
                        required={field.required}
                        onChange={(e) => handleCustomChange(e, field.label, field.type)}
                        className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all text-sm sm:text-base appearance-none cursor-pointer"
                      >
                        <option value="">-- Select {field.label} --</option>
                        {field.options?.map((opt, i) => (
                          <option key={i} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
                        ▼
                      </div>
                    </div>
                  )}
                  {field.type === 'file' && (
                    <div className="p-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center text-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl">
                        📄
                      </div>
                      {customData[field.label] ? (
                        <div className="flex items-center gap-2 flex-wrap justify-center">
                          <a
                            href={customData[field.label]}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition"
                          >
                            <span>✓</span>
                            <span>{field.label} Uploaded (Click to View)</span>
                          </a>
                        </div>
                      ) : null}
                      <label className="cursor-pointer inline-flex items-center justify-center gap-2 bg-white px-4 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-xs border border-slate-300 text-slate-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all">
                        <span>{isUploading ? 'Uploading...' : customData[field.label] ? `Change ${field.label}` : `Upload ${field.label}`}</span>
                        <input
                          type="file"
                          required={field.required && !customData[field.label]}
                          onChange={(e) => handleCustomFileUpload(e, field.label)}
                          className="hidden"
                          disabled={isUploading}
                        />
                      </label>
                      <p className="text-[11px] text-slate-400 font-medium">Images, PDF or documents up to 5MB</p>
                    </div>
                  )}
                  {field.type === 'checkbox' && (
                    <label className="flex items-center space-x-3 bg-slate-50 hover:bg-slate-100 p-3.5 rounded-xl border border-slate-200 cursor-pointer transition">
                      <input
                        type="checkbox"
                        required={field.required}
                        onChange={(e) => handleCustomChange(e, field.label, field.type)}
                        className="w-4 h-4 rounded text-blue-600 accent-blue-600 cursor-pointer"
                      />
                      <span className="font-bold text-slate-800 text-xs sm:text-sm">
                        {field.label} {field.required && <span className="text-rose-600">*</span>}
                      </span>
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Submit CTA Button */}
          <button
            type="submit"
            disabled={isUploading}
            className="w-full py-3.5 sm:py-4 rounded-xl font-black text-base sm:text-lg text-white bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {isUploading ? 'Uploading File... ⏳' : 'REGISTER NOW ⚡'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default PublicPlayerRegistration;
