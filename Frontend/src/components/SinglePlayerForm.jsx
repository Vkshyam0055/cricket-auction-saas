import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
  Crop
} from 'lucide-react';
import { apiRequest } from '../utils/apiClient';
import ImageCropperModal from './ImageCropperModal';
import { uploadImageToCloudinary } from '../utils/cloudinaryUpload';

function SinglePlayerForm({ playerLimit, isLimitReached, fetchPlayers }) {
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

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [cropperOpen, setCropperOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [lastCroppedBlob, setLastCroppedBlob] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

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
    e.target.value = '';
  };

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

  const uploadCroppedImage = async (blob, localUrl) => {
    const sequenceId = ++uploadSequenceRef.current;
    setIsUploading(true);
    setUploadError('');
    setLastCroppedBlob(blob);
    setPreviewUrl(localUrl);

    try {
      const secureUrl = await uploadImageToCloudinary(blob, 'player-photo.jpg');
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

  const handleCropComplete = (croppedBlob, croppedUrl) => {
    setCropperOpen(false);
    uploadCroppedImage(croppedBlob, croppedUrl);
  };

  const handleRetryUpload = () => {
    if (lastCroppedBlob && previewUrl) {
      uploadCroppedImage(lastCroppedBlob, previewUrl);
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

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
      if (fetchPlayers) fetchPlayers();
      navigate('/dashboard');
    } catch (err) {
      console.error('Save player error:', err);
      alert(err?.response?.data?.message || 'Error occurred while saving player!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80">
          <div className="flex items-center space-x-3 mb-5">
            <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
              1
            </span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Player Photo</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
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

            <div className="sm:col-span-5 flex flex-col items-center text-center p-4 border border-slate-100 rounded-2xl bg-slate-50/40">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Preview</span>
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

        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80">
          <div className="flex items-center space-x-3 mb-6">
            <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
              2
            </span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Player Details</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Fathers Name</label>
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

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Age</label>
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

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">City/Village</label>
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
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 text-xs">▼</div>
              </div>
            </div>

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
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 text-xs">▼</div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Base Price (₹)</label>
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

      <ImageCropperModal
        isOpen={cropperOpen}
        imageSrc={rawImageSrc}
        onCropComplete={handleCropComplete}
        onCancel={() => setCropperOpen(false)}
        aspectRatio={1}
        title="Crop Player Photo"
      />
    </>
  );
}

export default SinglePlayerForm;
