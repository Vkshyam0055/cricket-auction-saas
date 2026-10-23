import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Lock, Key, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowLeft, ShieldAlert, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../utils/apiClient';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  // State management
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenError, setTokenError] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [organizerName, setOrganizerName] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // 1. Pre-validate token on mount
  useEffect(() => {
    let isMounted = true;

    const validateToken = async () => {
      const rawToken = String(token || '').trim();
      if (!rawToken || rawToken.length !== 64 || !/^[0-9a-f]+$/i.test(rawToken)) {
        if (isMounted) {
          setTokenError('यह पासवर्ड रीसेट लिंक अमान्य है या विकृत (corrupted) हो गया है।');
          setIsValidatingToken(false);
        }
        return;
      }

      try {
        const res = await apiRequest({
          method: 'get',
          path: `/api/auth/validate-reset-token/${rawToken}`
        });

        if (isMounted) {
          if (res.data?.valid) {
            setMaskedEmail(res.data.maskedEmail || '');
            setOrganizerName(res.data.organizerName || 'Organizer');
          } else {
            setTokenError(res.data?.message || 'यह रीसेट लिंक एक्सपायर या पहले ही उपयोग हो चुका है।');
          }
        }
      } catch (err) {
        if (isMounted) {
          const status = err?.response?.status;
          // If pre-validation endpoint is not available on the server (404),
          // do not block the user with a false "expired" error; allow them to submit the form
          if (status === 404) {
            console.warn('Pre-validation endpoint returned 404. Proceeding to password reset form.');
            setIsValidatingToken(false);
            return;
          }
          const msg = err?.response?.data?.message || 'यह रीसेट लिंक अमान्य है या इसकी 20 मिनट की समय सीमा समाप्त हो चुकी है।';
          setTokenError(msg);
        }
      } finally {
        if (isMounted) {
          setIsValidatingToken(false);
        }
      }
    };

    validateToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // 2. Countdown redirect after successful reset
  useEffect(() => {
    if (!isSuccess) return;
    if (countdown <= 0) {
      navigate('/auth');
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isSuccess, countdown, navigate]);

  // Dynamic Password Strength Meter
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[a-zA-Z]/.test(pwd) && /[^a-zA-Z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500 text-red-400' };
    if (score === 2) return { score: 2, label: 'Fair', color: 'bg-amber-500 text-amber-400' };
    if (score === 3) return { score: 3, label: 'Good', color: 'bg-blue-500 text-blue-400' };
    return { score: 4, label: 'Strong', color: 'bg-emerald-500 text-emerald-400' };
  };

  const strength = getPasswordStrength(password);
  const isMatch = password && confirmPassword && password === confirmPassword;
  const isLengthValid = password.length >= 6;

  // 3. Handle submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!isLengthValid) {
      setFormError('पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('पासवर्ड और कन्फर्म पासवर्ड मेल नहीं खा रहे हैं।');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest({
        method: 'post',
        path: `/api/auth/reset-password/${token}`,
        data: { password, confirmPassword }
      });

      setIsSuccess(true);
    } catch (err) {
      console.error('Password reset error:', err);
      const msg = err?.response?.data?.message || 'पासवर्ड रीसेट करने में समस्या आई। कृपया पुनः प्रयास करें।';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans text-slate-100">
      {/* Background ambient glowing orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-indigo-600/15 rounded-full blur-[90px] sm:blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-blue-600/15 rounded-full blur-[90px] sm:blur-[120px] pointer-events-none" />

      {/* Top Header Navigation */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between relative z-10 px-1">
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="inline-flex items-center text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5 transform group-hover:-translate-x-1 transition-transform" />
          <span>Back to Sign In</span>
        </button>
        <span className="text-[11px] sm:text-xs text-slate-500 font-medium inline-flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          Secure SSL
        </span>
      </div>

      {/* Main Glassmorphic Card */}
      <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 md:p-9 w-full max-w-md border border-slate-800 relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <img
            src="/branding/clm-dark-full.png"
            alt="CricLeagueManager"
            className="h-9 sm:h-11 w-auto mx-auto object-contain mb-3"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-1">
            Reset Password 🔑
          </h1>
          {organizerName && !tokenError && !isSuccess && (
            <p className="text-slate-400 text-xs sm:text-sm">
              Hello <span className="text-indigo-300 font-semibold">{organizerName}</span>
              {maskedEmail ? ` (${maskedEmail})` : ''}, कृपया अपना नया पासवर्ड दर्ज करें।
            </p>
          )}
        </div>

        {/* 1. Loading Token Validation State */}
        {isValidatingToken && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-xs sm:text-sm text-slate-400 font-medium">रीसेट लिंक की पुष्टि की जा रही है...</p>
          </div>
        )}

        {/* 2. Token Error / Expired State */}
        {!isValidatingToken && tokenError && (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto mb-2">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-red-300">लिंक अमान्य या समाप्त (Expired)</h2>
            <p className="text-xs text-slate-300 leading-relaxed px-2">
              {tokenError}
            </p>
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-[11px] text-slate-400 text-left space-y-1">
              <p>• पासवर्ड रीसेट लिंक केवल <strong>20 मिनट</strong> के लिए वैध होते हैं।</p>
              <p>• लिंक एक बार उपयोग होने के बाद स्वतः निष्क्रिय हो जाता है।</p>
            </div>
            <div className="pt-2 space-y-2">
              <Link
                to="/forgot-password"
                className="w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-indigo-600 hover:bg-indigo-500 transition duration-150 flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30"
              >
                नया रीसेट लिंक प्राप्त करें ➔
              </Link>
              <Link
                to="/auth"
                className="block text-xs text-slate-400 hover:text-slate-200 py-1 transition"
              >
                लॉगिन पेज पर वापस जाएं
              </Link>
            </div>
          </div>
        )}

        {/* 3. Success State */}
        {!isValidatingToken && !tokenError && isSuccess && (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-emerald-300">पासवर्ड अपडेट सफल! 🎉</h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              आपका पासवर्ड सफलतापूर्वक बदल दिया गया है। सभी पुराने सेशन्स सुरक्षा कारणों से लॉगआउट कर दिए गए हैं।
            </p>
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-xs text-indigo-300 font-semibold">
              <span>{countdown} सेकंड में लॉगिन पेज पर रीडायरेक्ट किया जा रहा है...</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 transition shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              अभी लॉगिन करें ➔
            </button>
          </div>
        )}

        {/* 4. Active Reset Form */}
        {!isValidatingToken && !tokenError && !isSuccess && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="bg-red-950/60 border border-red-500/40 rounded-xl p-3 flex items-start gap-2.5 text-red-200 text-xs">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* New Password Input */}
            <div>
              <label htmlFor="new-password" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-white font-medium placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none transition-all duration-150 text-sm sm:text-base tracking-wider"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formError) setFormError('');
                  }}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Strength:</span>
                    <span className={`font-bold ${strength.color.split(' ')[1]}`}>{strength.label}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strength.color.split(' ')[0]}`}
                      style={{ width: `${(strength.score / 4) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-white font-medium placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none transition-all duration-150 text-sm sm:text-base tracking-wider"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (formError) setFormError('');
                  }}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {confirmPassword && (
                <p className={`mt-1.5 text-[11px] font-semibold flex items-center gap-1 ${isMatch ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isMatch ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>पासवर्ड मेल खा रहे हैं</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>पासवर्ड मेल नहीं खा रहे हैं</span>
                    </>
                  )}
                </p>
              )}
            </div>

            {/* Validation Checklist */}
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-2.5 text-[11px] text-slate-400 space-y-1">
              <div className={`flex items-center gap-1.5 ${isLengthValid ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                <span>{isLengthValid ? '✓' : '○'}</span>
                <span>कम से कम 6 अक्षर लंबा</span>
              </div>
              <div className={`flex items-center gap-1.5 ${isMatch ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                <span>{isMatch ? '✓' : '○'}</span>
                <span>दोनों पासवर्ड समान हों</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !isLengthValid || !isMatch}
              className="w-full py-3 sm:py-3.5 rounded-xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-600/25 active:scale-[0.99] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>अपडेट किया जा रहा है...</span>
                </>
              ) : (
                <span>Update Password ➔</span>
              )}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <Link
            to="/auth"
            className="text-xs text-slate-400 hover:text-white transition font-medium"
          >
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
