import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  UserPlus,
  User,
  Phone,
  Calendar,
  MapPin,
  Activity,
  ListFilter,
  IndianRupee,
  Save,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Info,
  Lightbulb,
  Crop,
  AlertTriangle,
  RotateCw
} from 'lucide-react';
import { apiRequest } from '../utils/apiClient';
import { getEffectivePlanPolicy, fetchAndCachePlans } from '../utils/planHelper';
import ImageCropperModal from '../components/ImageCropperModal';
import { uploadImageToCloudinary } from '../utils/cloudinaryUpload';

function AddPlayer() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const uploadSequenceRef = useRef(0);

  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    age: '',
    mobile: '',
    city: '',
    role: 'Batsman',
    category: 'A',
    basePrice: 500,
    photoUrl: ''
  });

  // Upload & Cropper states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [cropperOpen, setCropperOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [lastCroppedBlob, setLastCroppedBlob] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form submit & double-submit protection
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Plan limit states
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [organizerPlan, setOrganizerPlan] = useState('Free');
  const [organizerRole, setOrganizerRole] = useState('Organizer');
  const [, setPlansCacheKey] = useState(0);

  useEffect(() => {
    setOrganizerPlan(localStorage.getItem('organizerPlan') || 'Free');
    setOrganizerRole(localStorage.getItem('organizerRole') || 'Organizer');

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
    fetchPlayers();
    fetchAndCachePlans().then(() => setPlansCacheKey(Date.now()));
  }, []);

  const activePolicy = getEffectivePlanPolicy(organizerPlan, organizerRole);
  const playerLimit = activePolicy.playerLimit;
  const isLimitReached = playerLimit !== -1 && totalPlayers >= playerLimit && organizerRole !== 'SuperAdmin';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Image Selection (via file input or drag-and-drop)
  const processSelectedFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB. Please choose a smaller image.');
      return;
    }

    setUploadError('');
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
    // reset input so selecting the same file again triggers change
    e.target.value = '';
  };

  // Drag & drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading && !isLimitReached) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isUploading || isLimitReached) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Upload cropped photo to Cloudinary
  const uploadCroppedImage = async (blob, localUrl) => {
    const sequenceId = ++uploadSequenceRef.current;
    setIsUploading(true);
    setUploadError('');
    setLastCroppedBlob(blob);
    setPreviewUrl(localUrl);

    try {
      const secureUrl = await uploadImageToCloudinary(blob, 'player-photo.jpg');
      // Verify no newer upload has started in the meantime
      if (sequenceId === uploadSequenceRef.current) {
        setFormData((prev) => ({ ...prev, photoUrl: secureUrl }));
        setPreviewUrl(secureUrl);
      }
    } catch (err) {
      console.error('Cloudinary upload error:', err);
      if (sequenceId === uploadSequenceRef.current) {
        setUploadError('Failed to upload photo to server. Please try again.');
      }
    } finally {
      if (sequenceId === uploadSequenceRef.current) {
        setIsUploading(false);
      }
    }
  };

  // Callback from ImageCropperModal
  const handleCropComplete = (croppedBlob, croppedUrl) => {
    setCropperOpen(false);
    uploadCroppedImage(croppedBlob, croppedUrl);
  };

  // Retry upload if previous attempt failed
  const handleRetryUpload = () => {
    if (lastCroppedBlob && previewUrl) {
      uploadCroppedImage(lastCroppedBlob, previewUrl);
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Save Player Form Submission with double-submit protection
  const handleSave = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (isLimitReached) {
      alert(`Player limit reached (${playerLimit} max). Upgrade your plan to add more players.`);
      return;
    }

    if (isUploading) {
      alert('Photo is still uploading. Please wait for it to complete.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      await apiRequest({
        method: 'post',
        path: '/api/players',
        data: formData,
        headers
      });

      alert(`🎉 Player '${formData.name}' successfully added!`);
      navigate('/dashboard');
    } catch (err) {
      console.error('Save player error:', err);
      alert(err?.response?.data?.message || 'Error occurred while saving player!');
    } finally {
      setIsSubmitting(false);
    }
  };

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

        {/* 2-Column Grid Layout: Left is Form, Right is Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: Main Form Section (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            <form onSubmit={handleSave} className="space-y-6">
              {/* CARD 1: Player Photo */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80">
                <div className="flex items-center space-x-3 mb-5">
                  <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    1
                  </span>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Player Photo</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                  {/* Dropzone & Upload Button Area */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`sm:col-span-7 rounded-2xl border-2 border-dashed p-6 text-center flex flex-col items-center justify-center transition-all ${
                      isDragging
                        ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-300'
                    } ${isLimitReached ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                      <UploadCloud className="w-6 h-6" />
                    </div>

                    <p className="text-sm font-bold text-slate-700">Drag & drop your image here</p>
                    <span className="text-xs text-slate-400 font-medium my-1">or</span>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileInputChange}
                      disabled={isUploading || isLimitReached}
                      className="hidden"
                    />

                    <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || isLimitReached}
                        className="px-5 py-2.5 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUploading ? 'Processing...' : 'Choose Photo'}
                      </button>

                      {rawImageSrc && !isUploading && (
                        <button
                          type="button"
                          onClick={() => setCropperOpen(true)}
                          className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs sm:text-sm transition flex items-center space-x-1.5"
                          title="Adjust Crop"
                        >
                          <Crop className="w-3.5 h-3.5" />
                          <span>Recrop</span>
                        </button>
                      )}
                    </div>

                    <div className="mt-3.5 text-[11px] text-slate-400 space-y-0.5">
                      <p>Supports: JPG, PNG, WEBP (Max 5MB)</p>
                      <p className="text-slate-500 font-medium">Recommended: Square image (1:1)</p>
                    </div>
                  </div>

                  {/* Preview Area */}
                  <div className="sm:col-span-5 flex flex-col items-center text-center p-4 border border-slate-100 rounded-2xl bg-slate-50/40">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Preview
                    </span>

                    <div className="relative mb-3">
                      {isUploading ? (
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-200 border-4 border-white shadow-md flex flex-col items-center justify-center">
                          <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-[10px] font-bold text-slate-600 mt-1.5">Uploading...</span>
                        </div>
                      ) : previewUrl || formData.photoUrl ? (
                        <div className="relative">
                          <img
                            src={previewUrl || formData.photoUrl}
                            alt="Player preview"
                            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-white shadow-md"
                          />
                          <span className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      ) : (
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-200 border-4 border-white shadow-md flex items-center justify-center text-slate-400 text-3xl">
                          👤
                        </div>
                      )}
                    </div>

                    {formData.photoUrl && !isUploading && (
                      <div className="inline-flex items-center space-x-1 text-emerald-600 font-black text-xs mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Looks good!</span>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-400 max-w-[200px] leading-tight">
                      This photo will be used on player cards and live auction screen.
                    </p>
                  </div>
                </div>

                {/* Upload Error Banner */}
                {uploadError && (
                  <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-rose-700 font-semibold">{uploadError}</span>
                    <button
                      type="button"
                      onClick={handleRetryUpload}
                      className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition"
                    >
                      Retry Upload
                    </button>
                  </div>
                )}
              </div>

              {/* CARD 2: Player Details */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80">
                <div className="flex items-center space-x-3 mb-6">
                  <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    2
                  </span>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Player Details</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Full Name <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        disabled={isLimitReached || isSubmitting}
                        placeholder="Enter full name"
                        required
                        className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition"
                      />
                    </div>
                  </div>

                  {/* Father's Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Fathers Name
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        name="fatherName"
                        value={formData.fatherName}
                        onChange={handleChange}
                        disabled={isLimitReached || isSubmitting}
                        placeholder="Enter father's name"
                        className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition"
                      />
                    </div>
                  </div>

                  {/* Age */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Age
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <input
                        type="number"
                        name="age"
                        value={formData.age}
                        onChange={handleChange}
                        disabled={isLimitReached || isSubmitting}
                        placeholder="Enter age"
                        className="w-full pl-10 pr-14 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition"
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-xs font-bold text-slate-400">
                        years
                      </div>
                    </div>
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Mobile Number <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        name="mobile"
                        value={formData.mobile}
                        onChange={handleChange}
                        disabled={isLimitReached || isSubmitting}
                        placeholder="Enter 10 digit mobile number"
                        required
                        className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition"
                      />
                    </div>
                  </div>

                  {/* City/Village */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      City/Village
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        disabled={isLimitReached || isSubmitting}
                        placeholder="Enter city or village"
                        className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition"
                      />
                    </div>
                  </div>

                  {/* Playing Role */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Playing Role <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <Activity className="w-4 h-4" />
                      </div>
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        disabled={isLimitReached || isSubmitting}
                        className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm appearance-none cursor-pointer transition"
                      >
                        <option value="Batsman">Batsman</option>
                        <option value="Bowler">Bowler</option>
                        <option value="All-Rounder">All-Rounder</option>
                        <option value="Wicket Keeper">Wicket Keeper</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 text-xs">
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Category <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <ListFilter className="w-4 h-4" />
                      </div>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        disabled={isLimitReached || isSubmitting}
                        className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm appearance-none cursor-pointer transition"
                      >
                        <option value="A">Category A</option>
                        <option value="B">Category B</option>
                        <option value="C">Category C</option>
                        <option value="D">Category D</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 text-xs">
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Base Price */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Base Price (₹)
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <IndianRupee className="w-4 h-4" />
                      </div>
                      <input
                        type="number"
                        name="basePrice"
                        value={formData.basePrice}
                        onChange={handleChange}
                        disabled={isLimitReached || isSubmitting}
                        placeholder="Enter base price"
                        className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white font-bold text-emerald-700 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions Bar */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-8 py-3 rounded-2xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 active:bg-slate-200 font-bold text-sm transition text-center"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isUploading || isSubmitting || isLimitReached}
                  className={`w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 px-10 py-3.5 rounded-2xl text-white font-black text-sm sm:text-base shadow-lg shadow-blue-500/20 transition-all ${
                    isUploading || isSubmitting || isLimitReached
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving Player...</span>
                    </>
                  ) : isUploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Photo Uploading...</span>
                    </>
                  ) : isLimitReached ? (
                    <span>Player Limit Reached 🔒</span>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Save Player</span>
                    </>
                  )}
                </button>
              </div>
            </form>
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
                  {/* Good Photo Card */}
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

                  {/* Avoid Photo Card */}
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

      {/* Image Cropper Modal */}
      <ImageCropperModal
        isOpen={cropperOpen}
        imageSrc={rawImageSrc}
        onCropComplete={handleCropComplete}
        onCancel={() => setCropperOpen(false)}
        aspectRatio={1}
        title="Crop Player Photo"
      />
    </div>
  );
}

export default AddPlayer;