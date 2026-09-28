import React, { useState, useEffect, useRef } from 'react';

export default function PrerequisiteModal({
  open,
  onClose,
  onSave,
  title,
  description,
  fields = [],
  saveButtonText = 'Save',
  saving = false
}) {
  const [formData, setFormData] = useState({});
  const modalRef = useRef(null);

  // Initialize form data when fields change or modal opens
  useEffect(() => {
    if (open) {
      const initialData = {};
      fields.forEach(field => {
        initialData[field.name] = field.defaultValue !== undefined ? field.defaultValue : '';
      });
      setFormData(initialData);
    }
  }, [fields, open]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose, saving]);

  // Focus trap
  useEffect(() => {
    if (open && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      if (firstElement) firstElement.focus();
    }
  }, [open]);

  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !saving) {
      onClose();
    }
  };

  const handleChange = (e, fieldName) => {
    setFormData(prev => ({ ...prev, [fieldName]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm transition-opacity"
      onClick={handleOverlayClick}
      aria-modal="true"
      role="dialog"
    >
      <div 
        ref={modalRef}
        className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden transform transition-all"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">⚠️</span>
            </div>
            <h2 className="text-xl font-semibold text-white leading-tight">
              {title}
            </h2>
          </div>
          
          {description && (
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              {description}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {fields.map((field) => (
              <div key={field.name} className="space-y-1.5">
                <label 
                  htmlFor={field.name} 
                  className="block text-sm font-medium text-slate-300"
                >
                  {field.label}
                </label>
                <input
                  type={field.type || 'text'}
                  id={field.name}
                  value={formData[field.name] || ''}
                  onChange={(e) => handleChange(e, field.name)}
                  required={field.required !== false}
                  disabled={saving}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:opacity-50"
                />
              </div>
            ))}

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="w-full sm:w-1/2 px-4 py-2.5 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                बाद में
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-1/2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium rounded-lg px-4 py-2.5 shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  saveButtonText
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
