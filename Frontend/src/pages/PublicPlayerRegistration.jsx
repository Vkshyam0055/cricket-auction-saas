import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Camera,
  UploadCloud,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Phone,
  Calendar,
  MapPin,
  Activity,
  FileText,
  Lock,
  Crop,
  Copy,
  Download,
  Lightbulb,
  Check
} from 'lucide-react';
import { apiRequest } from '../utils/apiClient';
import ImageCropperModal from '../components/ImageCropperModal';
import { uploadImageToCloudinary } from '../utils/cloudinaryUpload';

function PublicPlayerRegistration() {
  const { tournamentId } = useParams();
  const fileInputRef = useRef(null);
  const uploadSequenceRef = useRef(0);

  const [tournamentDetails, setTournamentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Standard fields (EXCLUDING basePrice and category as per strict requirements)
  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    age: '',
    mobile: '',
    city: '',
    role: 'Batsman',
    photoUrl: ''
  });

  const [customData, setCustomData] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);

  // Upload and double-submit states
  const [isUploading, setIsUploading] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentActionMessage, setPaymentActionMessage] = useState('');

  // Cropper states
  const [cropperOpen, setCropperOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [lastCroppedBlob, setLastCroppedBlob] = useState(null);
  const [photoUploadError, setPhotoUploadError] = useState('');
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);

  // Poster Popup State
  const [showPosterPopup, setShowPosterPopup] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await apiRequest({ method: 'get', path: `/api/players/public/${tournamentId}` });
        setTournamentDetails(res.data);

        // Show poster popup if poster exists
        if (res.data.tournamentPoster) {
          setShowPosterPopup(true);
        }

        const initialCustomData = {};
        if (res.data.customFields) {
          res.data.customFields.forEach((field) => {
            initialCustomData[field.label] = field.type === 'checkbox' ? false : '';
          });
          setCustomData(initialCustomData);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Invalid URL or Registration Closed');
      } finally {
        setLoading(false);
      }
    };
    if (tournamentId) fetchDetails();
  }, [tournamentId]);

  const handleStandardChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCustomChange = (e, label, type) => {
    setCustomData((prev) => ({
      ...prev,
      [label]: type === 'checkbox' ? e.target.checked : e.target.value
    }));
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
      setPaymentActionMessage(
        qrWindow
          ? 'QR code opened in a new tab. Save it from there.'
          : 'Could not download the QR code. Please try again.'
      );
    }
  };

  // Process selected photo for all input avenues (file input, mobile camera/gallery, drag-and-drop)
  const processSelectedPhoto = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo size exceeds 5MB limit. Please choose a smaller photo.');
      return;
    }

    setPhotoUploadError('');
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedPhoto(file);
    }
    e.target.value = '';
  };

  const handlePhotoDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isPhotoUploading) setIsDraggingPhoto(true);
  };

  const handlePhotoDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPhoto(false);
  };

  const handlePhotoDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPhoto(false);
    if (isPhotoUploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedPhoto(file);
    }
  };

  // Upload cropped photo to Cloudinary with race-condition protection
  const uploadCroppedPhoto = async (blob, localUrl) => {
    const sequenceId = ++uploadSequenceRef.current;
    setIsPhotoUploading(true);
    setIsUploading(true);
    setPhotoUploadError('');
    setLastCroppedBlob(blob);
    setPhotoPreview(localUrl);

    try {
      const url = await uploadImageToCloudinary(blob, 'player-photo.jpg');
      if (sequenceId === uploadSequenceRef.current) {
        setFormData((prev) => ({ ...prev, photoUrl: url }));
        setPhotoPreview(url);
      }
    } catch (err) {
      console.error('Photo upload failed:', err);
      if (sequenceId === uploadSequenceRef.current) {
        setPhotoUploadError('Photo upload failed. Please try again.');
      }
    } finally {
      if (sequenceId === uploadSequenceRef.current) {
        setIsPhotoUploading(false);
        setIsUploading(false);
      }
    }
  };

  const handleCropComplete = (croppedBlob, croppedUrl) => {
    setCropperOpen(false);
    uploadCroppedPhoto(croppedBlob, croppedUrl);
  };

  const handleRetryPhotoUpload = () => {
    if (lastCroppedBlob && photoPreview) {
      uploadCroppedPhoto(lastCroppedBlob, photoPreview);
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Dynamic tournament custom file upload (e.g., Aadhaar, certificates, ID)
  const handleCustomFileUpload = async (e, label) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadImageToCloudinary(file, file.name);
      setCustomData((prev) => ({ ...prev, [label]: url }));
      alert(`✅ ${label} uploaded successfully!`);
    } catch (err) {
      console.error('Custom file upload error:', err);
      alert(`❌ Failed to upload ${label}! Please try again.`);
    } finally {
      setIsUploading(false);
    }
  };

  // Form submission with double-submit protection
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (isUploading || isPhotoUploading) {
      alert('Photo or file is still uploading. Please wait for upload to finish.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest({
        method: 'post',
        path: `/api/players/public/${tournamentId}/register`,
        data: {
          ...formData,
          customData
        }
      });
      setIsSuccess(true);
    } catch (err) {
      console.error('Registration error:', err);
      alert(err?.response?.data?.message || 'Registration failed! Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
          <p className="text-slate-600 text-sm font-medium">
            {error || 'Tournament registration link is invalid or closed.'}
          </p>
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
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight">
            Registration Successful!
          </h2>
          <p className="text-slate-600 text-sm font-medium mb-6 leading-relaxed">
            आपका रजिस्ट्रेशन सफलतापूर्वक जमा हो गया है। टूर्नामेंट आयोजक विवरण की पुष्टि करेंगे।
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left mb-6">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tournament</p>
            <p className="text-sm font-black text-slate-900 mt-0.5">{tournamentDetails.name}</p>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-3">Player Name</p>
            <p className="text-sm font-black text-slate-900 mt-0.5">{formData.name}</p>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            You may close this window or contact the tournament organizer for queries.
          </p>
        </div>
      </div>
    );
  }

  // POSTER POPUP OVERLAY
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

  const hasPhoto = Boolean(formData.photoUrl || photoPreview);
  const hasCustomFields = Boolean(tournamentDetails.customFields && tournamentDetails.customFields.length > 0);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 flex flex-col items-center pb-16 antialiased">
      {/* 🌟 TOP APP BRAND HEADER 🌟 */}
      <header className="w-full bg-[#0b192e] text-white py-3.5 px-4 shadow-md sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center space-x-2.5 max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto w-full">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-red-500 flex items-center justify-center shadow-xs text-lg shrink-0 border border-white/20">
            🏏
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight leading-none text-white">CricLeagueManager</h1>
            <p className="text-[10px] text-blue-200/80 font-medium tracking-wide mt-0.5">Play • Bid • Build Legends</p>
          </div>
        </div>
      </header>

      {/* 🌟 RESPONSIVE MAIN CONTAINER (Mobile: max-w-md, Tablet/Desktop: max-w-xl to max-w-3xl) 🌟 */}
      <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl px-3.5 sm:px-6 py-4 sm:py-7 space-y-4 sm:space-y-5">
        
        {/* 🌟 TOURNAMENT IDENTITY CARD & VISUAL FLOW GUIDE 🌟 */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-block text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">
                Official Player Registration
              </span>
              <h2 className="text-lg sm:text-2xl font-black text-slate-900 leading-snug tracking-tight">
                {tournamentDetails.name}
              </h2>
            </div>

            {tournamentDetails.logoUrl ? (
              <img
                src={tournamentDetails.logoUrl}
                alt="Logo"
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-contain border border-slate-200 p-1 shrink-0 bg-slate-50 shadow-2xs"
              />
            ) : (
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl shrink-0 border border-amber-200 shadow-2xs">
                🏆
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 font-medium mt-2.5 leading-relaxed">
            Register yourself to participate in the player auction. Complete all sections below to submit your profile.
          </p>

          {/* 🌟 REFINED REGISTRATION PROGRESS GUIDE (Clear single-page scroll tracker) 🌟 */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-100">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                <span>Single-Page Form</span>
              </span>
            </div>

            {/* Visual section checkpoints */}
            <div className="flex items-center space-x-2 text-[11px] font-bold text-slate-500">
              <span className={`inline-flex items-center gap-1 ${hasPhoto ? 'text-emerald-600' : 'text-slate-700'}`}>
                {hasPhoto ? <Check className="w-3 h-3 stroke-[3]" /> : '1.'} Photo
              </span>
              <span>•</span>
              <span className={`inline-flex items-center gap-1 ${formData.name && formData.mobile ? 'text-emerald-600' : 'text-slate-700'}`}>
                {formData.name && formData.mobile ? <Check className="w-3 h-3 stroke-[3]" /> : '2.'} Details
              </span>
              {hasCustomFields && (
                <>
                  <span>•</span>
                  <span className="text-slate-700">3. Documents</span>
                </>
              )}
              <span>•</span>
              <span className="text-slate-400 font-semibold">Submit</span>
            </div>
          </div>
        </div>

        {/* 🌟 REFINED COMPACT REGISTRATION FEE / PAYMENT SECTION 🌟 */}
        {(tournamentDetails.upiQrUrl || tournamentDetails.upiId || tournamentDetails.paymentMessage) && (
          <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-emerald-200/80 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-emerald-100/70 pb-2.5 mb-2.5">
              <div className="flex items-center space-x-2">
                <span className="text-base">💸</span>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                  Registration Fee & Payment
                </span>
              </div>
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                UPI Available
              </span>
            </div>

            {tournamentDetails.paymentMessage && (
              <p className="text-xs font-semibold text-slate-700 mb-3 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100/60 leading-relaxed text-left">
                {tournamentDetails.paymentMessage}
              </p>
            )}

            {/* Compact Horizontal / Responsive Grid for QR & UPI ID */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              {tournamentDetails.upiQrUrl && (
                <div className={`${tournamentDetails.upiId ? 'sm:col-span-5' : 'sm:col-span-12'} flex items-center space-x-3 bg-slate-50 p-2 rounded-2xl border border-slate-200/80`}>
                  <img
                    src={tournamentDetails.upiQrUrl}
                    alt="Scan to Pay"
                    className="w-16 h-16 sm:w-18 sm:h-18 object-contain rounded-xl border border-slate-200 bg-white shrink-0 p-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase leading-none">QR Code</p>
                    <button
                      type="button"
                      onClick={handleDownloadQrCode}
                      className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-[11px] font-bold shadow-2xs transition active:scale-95"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download QR</span>
                    </button>
                  </div>
                </div>
              )}

              {tournamentDetails.upiId && (
                <div className={`${tournamentDetails.upiQrUrl ? 'sm:col-span-7' : 'sm:col-span-12'} flex items-center justify-between bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80 gap-2`}>
                  <div className="min-w-0 pl-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase leading-none">Pay via UPI ID</p>
                    <p className="font-black text-xs sm:text-sm text-slate-900 tracking-wide truncate mt-0.5">
                      {tournamentDetails.upiId}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUpiId}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold transition shrink-0 active:scale-95 shadow-2xs"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{paymentActionMessage === 'UPI ID copied!' ? 'Copied! ✓' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>

            {paymentActionMessage && (
              <p className={`mt-2 text-[11px] font-bold text-center ${paymentActionMessage.startsWith('Could') ? 'text-rose-600' : 'text-emerald-700'}`}>
                {paymentActionMessage}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Hidden File Input for Profile Photo */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoInputChange}
            className="hidden"
            disabled={isPhotoUploading || isUploading}
          />

          {/* 🌟 1. PLAYER PHOTO SECTION 🌟 */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200">
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm">
                <Camera className="w-4 h-4" />
              </div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Player Photo <span className="text-rose-600">*</span>
              </h3>
            </div>

            {/* Photo State A: Uploading/Processing Loader */}
            {isPhotoUploading ? (
              <div className="p-5 sm:p-6 rounded-2xl border-2 border-blue-200 bg-blue-50/50 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-2 animate-pulse">
                  <UploadCloud className="w-6 h-6 animate-bounce" />
                </div>
                <h4 className="text-sm font-black text-blue-900">Uploading Photo...</h4>
                <p className="text-xs text-blue-600 font-medium mt-0.5">Please wait while we process and upload</p>
                <div className="w-44 bg-blue-200/70 h-1.5 rounded-full mt-2.5 overflow-hidden">
                  <div className="bg-blue-600 h-full w-2/3 rounded-full animate-pulse"></div>
                </div>
              </div>
            ) : hasPhoto ? (
              /* Photo State B: Photo Uploaded & Cropped Preview */
              <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div className="flex items-center space-x-3.5">
                  <div className="relative">
                    <img
                      src={photoPreview || formData.photoUrl}
                      alt="Uploaded Player"
                      className="w-20 h-20 sm:w-22 sm:h-22 rounded-full object-cover border-3 border-white shadow-md"
                    />
                    <span className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center border border-white shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-black text-emerald-800">Photo Uploaded Successfully!</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">1:1 square cropped for auction profile</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPhotoUploading || isUploading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs transition"
                  >
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    <span>Change</span>
                  </button>

                  {rawImageSrc && (
                    <button
                      type="button"
                      onClick={() => setCropperOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      <span>Recrop</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Photo State C: No Photo Chosen Yet */
              <div
                onDragOver={handlePhotoDragOver}
                onDragLeave={handlePhotoDragLeave}
                onDrop={handlePhotoDrop}
                className={`p-5 sm:p-6 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center ${
                  isDraggingPhoto
                    ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                    : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
                  <Camera className="w-6 h-6" />
                </div>

                <h4 className="text-sm font-black text-slate-800">Upload Your Photo</h4>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Tap to choose from gallery or take a photo</p>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPhotoUploading || isUploading}
                  className="mt-3 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition active:scale-95 flex items-center space-x-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Choose Photo</span>
                </button>

                <div className="mt-2.5 text-[10px] text-slate-400 font-medium leading-tight">
                  <p>JPG, PNG, WEBP (Max 5MB) • Recommended: Square image (1:1)</p>
                </div>
              </div>
            )}

            {/* Photo Upload Error Alert */}
            {photoUploadError && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span className="font-semibold">{photoUploadError}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRetryPhotoUpload}
                  className="ml-2 px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition"
                >
                  Retry
                </button>
              </div>
            )}

            {/* 🌟 REFINED COMPACT "TIPS FOR A GOOD PLAYER PHOTO" 🌟 */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 bg-slate-50/70 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 rounded-b-3xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wide">
                    Photo Guidelines
                  </h4>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Square (1:1) recommended</span>
              </div>

              {/* Compact 2-column bullet list */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-600 font-medium mb-2.5">
                <span className="flex items-center gap-1 truncate">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> Clear & front-facing
                </span>
                <span className="flex items-center gap-1 truncate">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> Face & shoulders only
                </span>
                <span className="flex items-center gap-1 truncate">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> Good lighting, no blur
                </span>
                <span className="flex items-center gap-1 truncate">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> Avoid group photos
                </span>
              </div>

              {/* Compact horizontal Good vs Avoid comparison chips */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                <div className="flex items-center space-x-2 bg-white px-2.5 py-1.5 rounded-xl border border-emerald-200/80 shadow-2xs">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs shrink-0 relative">
                    👨
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold">
                      ✓
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-800 leading-tight">Good Photo</p>
                    <p className="text-[9px] text-slate-400 leading-none">Clear, single portrait</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 bg-white px-2.5 py-1.5 rounded-xl border border-rose-200/80 shadow-2xs">
                  <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 text-xs shrink-0 relative blur-[1px]">
                    👥
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold">
                      ✕
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-800 leading-tight">Avoid</p>
                    <p className="text-[9px] text-slate-400 leading-none">Blur or group shot</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 🌟 2. PERSONAL INFORMATION SECTION (Responsive 2-col on Tablet/Desktop, 1-col on Mobile) 🌟 */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm">
                <User className="w-4 h-4" />
              </div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Personal Information</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
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
                    required
                    disabled={isSubmitting}
                    placeholder="Enter your full name"
                    onChange={handleStandardChange}
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Father's Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Father's Name
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    name="fatherName"
                    value={formData.fatherName}
                    disabled={isSubmitting}
                    placeholder="Enter father's name"
                    onChange={handleStandardChange}
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Age */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Age <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    disabled={isSubmitting}
                    placeholder="Enter age"
                    onChange={handleStandardChange}
                    className="w-full pl-10 pr-14 py-3 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition disabled:bg-slate-100"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-xs font-bold text-slate-400">
                    years
                  </div>
                </div>
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
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
                    required
                    disabled={isSubmitting}
                    placeholder="Enter 10 digit number"
                    onChange={handleStandardChange}
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* City / Village */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  City / Village
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    disabled={isSubmitting}
                    placeholder="Enter city or village"
                    onChange={handleStandardChange}
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Playing Role */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Playing Role <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <select
                    name="role"
                    value={formData.role}
                    disabled={isSubmitting}
                    onChange={handleStandardChange}
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm appearance-none cursor-pointer disabled:bg-slate-100"
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
            </div>

            {/* NOTE: Base Price and Category are strictly NOT rendered here as per requirements */}
          </div>

          {/* 🌟 3. DYNAMIC ORGANIZER-CONFIGURED CUSTOM FIELDS 🌟 */}
          {hasCustomFields && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">Additional Details</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Tournament specific information</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {tournamentDetails.customFields.map((field, idx) => (
                  <div
                    key={idx}
                    className={
                      field.type === 'file' || field.type === 'checkbox'
                        ? 'sm:col-span-2'
                        : 'sm:col-span-1'
                    }
                  >
                    {field.type !== 'checkbox' && (
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {field.label} {field.required && <span className="text-rose-600">*</span>}
                      </label>
                    )}

                    {/* Text Field */}
                    {field.type === 'text' && (
                      <input
                        type="text"
                        required={field.required}
                        disabled={isSubmitting}
                        placeholder={`Enter ${field.label}`}
                        onChange={(e) => handleCustomChange(e, field.label, field.type)}
                        className="w-full px-3.5 py-3 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition disabled:bg-slate-100"
                      />
                    )}

                    {/* Number Field */}
                    {field.type === 'number' && (
                      <input
                        type="number"
                        required={field.required}
                        disabled={isSubmitting}
                        placeholder={`Enter ${field.label}`}
                        onChange={(e) => handleCustomChange(e, field.label, field.type)}
                        className="w-full px-3.5 py-3 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition disabled:bg-slate-100"
                      />
                    )}

                    {/* Dropdown Field */}
                    {field.type === 'dropdown' && (
                      <div className="relative">
                        <select
                          required={field.required}
                          disabled={isSubmitting}
                          onChange={(e) => handleCustomChange(e, field.label, field.type)}
                          className="w-full px-3.5 py-3 rounded-xl border border-slate-300 bg-white font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm appearance-none cursor-pointer disabled:bg-slate-100"
                        >
                          <option value="">-- Select {field.label} --</option>
                          {field.options?.map((opt, i) => (
                            <option key={i} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 text-xs">
                          ▼
                        </div>
                      </div>
                    )}

                    {/* Dynamic Document/File Upload Field */}
                    {field.type === 'file' && (
                      <div className="p-4 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 flex flex-col items-center justify-center text-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-lg">
                          📄
                        </div>

                        {customData[field.label] && (
                          <a
                            href={customData[field.label]}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200"
                          >
                            <span>✓</span>
                            <span>{field.label} Uploaded (View)</span>
                          </a>
                        )}

                        <label className="cursor-pointer inline-flex items-center justify-center gap-2 bg-white px-4 py-2 rounded-xl font-bold text-xs shadow-xs border border-slate-300 text-slate-700 hover:bg-blue-600 hover:text-white transition-all">
                          <UploadCloud className="w-4 h-4" />
                          <span>
                            {isUploading
                              ? 'Uploading...'
                              : customData[field.label]
                              ? `Change ${field.label}`
                              : `Upload ${field.label}`}
                          </span>
                          <input
                            type="file"
                            required={field.required && !customData[field.label]}
                            onChange={(e) => handleCustomFileUpload(e, field.label)}
                            className="hidden"
                            disabled={isUploading || isSubmitting}
                          />
                        </label>
                        <p className="text-[10px] text-slate-400 font-medium">Images, PDF or documents (Max 5MB)</p>
                      </div>
                    )}

                    {/* Checkbox Field */}
                    {field.type === 'checkbox' && (
                      <label className="flex items-center space-x-3 bg-slate-50 hover:bg-slate-100 p-3.5 rounded-xl border border-slate-200 cursor-pointer transition">
                        <input
                          type="checkbox"
                          required={field.required}
                          disabled={isSubmitting}
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
            </div>
          )}

          {/* 🌟 4. SUBMIT CTA BUTTON & DOUBLE-SUBMIT PROTECTION 🌟 */}
          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={isUploading || isPhotoUploading || isSubmitting}
              className="w-full py-4 rounded-2xl font-black text-base text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-lg shadow-blue-600/20 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Registering Player... ⏳</span>
                </>
              ) : isPhotoUploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Uploading Photo... ⏳</span>
                </>
              ) : isUploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Uploading File... ⏳</span>
                </>
              ) : (
                <span>REGISTER NOW ⚡</span>
              )}
            </button>

            {/* Trust & Privacy Security Badge */}
            <div className="flex items-center justify-center space-x-1.5 text-xs text-slate-400 font-medium">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Your information is safe with us</span>
            </div>
          </div>
        </form>

        {/* 🌟 BOTTOM BRANDING FOOTER 🌟 */}
        <div className="pt-4 pb-2 text-center text-slate-400">
          <p className="text-xs font-black text-slate-500 tracking-wide uppercase">Same Passion • Bigger Opportunities</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">CricLeagueManager • Tournament Auction Platform</p>
        </div>
      </div>

      {/* 🌟 1:1 PHOTO CROP MODAL 🌟 */}
      <ImageCropperModal
        isOpen={cropperOpen}
        imageSrc={rawImageSrc}
        onCropComplete={handleCropComplete}
        onCancel={() => setCropperOpen(false)}
        aspectRatio={1}
        title="Crop Photo"
      />
    </div>
  );
}

export default PublicPlayerRegistration;
