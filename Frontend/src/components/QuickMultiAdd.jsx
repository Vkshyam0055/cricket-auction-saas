import React, { useState, useRef } from 'react';
import { User, Phone, Activity, ListFilter, IndianRupee, Image as ImageIcon, Plus, Trash2, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../utils/apiClient';
import { uploadImageToCloudinary } from '../utils/cloudinaryUpload';

function QuickMultiAdd({ playerLimit, isLimitReached, fetchPlayers }) {
  const [players, setPlayers] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const defaultInput = {
    name: '',
    mobile: '',
    role: 'Batsman',
    category: 'A',
    basePrice: 500,
    photoUrl: ''
  };

  const [currentInput, setCurrentInput] = useState(defaultInput);

  const maxSetSize = 25;
  const isSetFull = players.length >= maxSetSize;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentInput((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB. Please choose a smaller image.');
      return;
    }

    setIsUploading(true);
    try {
      // Direct upload to Cloudinary (no crop for Quick Add to save time)
      const secureUrl = await uploadImageToCloudinary(file, 'player-photo.jpg');
      setCurrentInput((prev) => ({ ...prev, photoUrl: secureUrl }));
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddToList = (e) => {
    e.preventDefault();
    if (isUploading) return;
    if (isSetFull) {
      alert(`You can only add up to ${maxSetSize} players at a time.`);
      return;
    }
    if (!currentInput.name || !currentInput.mobile) {
      alert('Name and Mobile are required.');
      return;
    }

    setPlayers((prev) => [...prev, { ...currentInput }]);
    setCurrentInput(defaultInput);
  };

  const handleRemovePlayer = (index) => {
    setPlayers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitAll = async () => {
    if (players.length === 0) return;
    if (isLimitReached || (playerLimit !== -1 && players.length > playerLimit)) {
      alert(`Plan limit exceeded. You are trying to add ${players.length} players, which exceeds your remaining quota.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await apiRequest({
        method: 'post',
        path: '/api/players/bulk',
        data: { players },
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(res.data?.message || 'Players successfully added!');
      setPlayers([]);
      if (fetchPlayers) fetchPlayers();
    } catch (error) {
      console.error('Bulk submission error:', error);
      alert(error?.response?.data?.message || 'Failed to submit players. Please check your plan limit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if any mobile number is duplicated in the current set
  const hasDuplicates = () => {
    const mobiles = players.map(p => p.mobile).filter(Boolean);
    return new Set(mobiles).size !== mobiles.length;
  };

  return (
    <div className="space-y-6">
      {/* Input Form Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-200/80">
        <div className="flex items-center space-x-3 mb-5">
          <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
            +
          </span>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Quick Add Form</h2>
            <p className="text-xs text-slate-500 font-medium">Rapidly build a list of players to submit at once.</p>
          </div>
        </div>

        <form onSubmit={handleAddToList} className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 items-end">
            
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Name <span className="text-rose-500">*</span></label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"><User className="w-3.5 h-3.5" /></div>
                <input
                  type="text"
                  name="name"
                  value={currentInput.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Player Name"
                  disabled={isSetFull || isLimitReached}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition"
                />
              </div>
            </div>

            {/* Mobile */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Mobile <span className="text-rose-500">*</span></label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"><Phone className="w-3.5 h-3.5" /></div>
                <input
                  type="tel"
                  name="mobile"
                  value={currentInput.mobile}
                  onChange={handleInputChange}
                  required
                  placeholder="Mobile Number"
                  disabled={isSetFull || isLimitReached}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition"
                />
              </div>
            </div>

            {/* Role & Category (Half widths on mobile) */}
            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Role</label>
                <div className="relative">
                  <select
                    name="role"
                    value={currentInput.role}
                    onChange={handleInputChange}
                    disabled={isSetFull || isLimitReached}
                    className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:border-blue-500 outline-none text-sm appearance-none"
                  >
                    <option value="Batsman">Bat</option>
                    <option value="Bowler">Bowl</option>
                    <option value="All-Rounder">All</option>
                    <option value="Wicket Keeper">WK</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 text-xs">▼</div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Cat.</label>
                <div className="relative">
                  <select
                    name="category"
                    value={currentInput.category}
                    onChange={handleInputChange}
                    disabled={isSetFull || isLimitReached}
                    className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:border-blue-500 outline-none text-sm appearance-none"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 text-xs">▼</div>
                </div>
              </div>
            </div>

            {/* Price & Photo & Action */}
            <div className="grid grid-cols-12 gap-3 md:col-span-6 mt-1 md:mt-2">
              
              <div className="col-span-5 sm:col-span-4 md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Price (₹)</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"><IndianRupee className="w-3.5 h-3.5" /></div>
                  <input
                    type="number"
                    name="basePrice"
                    value={currentInput.basePrice}
                    onChange={handleInputChange}
                    disabled={isSetFull || isLimitReached}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-emerald-700 focus:border-blue-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="col-span-7 sm:col-span-4 md:col-span-3 flex items-end">
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoSelect} className="hidden" />
                
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isSetFull || isLimitReached}
                  className="w-full h-[42px] px-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-xs shadow-sm hover:bg-slate-50 transition flex items-center justify-center gap-2 overflow-hidden"
                >
                  {isUploading ? (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : currentInput.photoUrl ? (
                    <>
                      <img src={currentInput.photoUrl} alt="Preview" className="w-5 h-5 rounded-full object-cover border border-slate-200" />
                      <span className="text-emerald-600 text-[11px] truncate">Uploaded</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4 text-blue-500" />
                      <span className="truncate">Add Photo</span>
                    </>
                  )}
                </button>
              </div>

              <div className="col-span-12 sm:col-span-4 md:col-span-6 flex items-end justify-end mt-2 sm:mt-0">
                <button
                  type="submit"
                  disabled={isUploading || isSetFull || isLimitReached}
                  className="w-full md:w-auto h-[42px] px-6 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add to List</span>
                </button>
              </div>

            </div>
          </div>
        </form>
      </div>

      {/* Temporary Set List Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center space-x-3">
            <span className="w-7 h-7 rounded-full bg-slate-800 text-white font-black text-xs flex items-center justify-center shadow-xs">
              {players.length}
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Current Set</h2>
              <p className="text-xs text-slate-500 font-medium">Max {maxSetSize} players per batch</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-start sm:self-auto">
            {hasDuplicates() && (
              <span className="inline-flex items-center text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5 mr-1" /> Duplicates detected
              </span>
            )}
            <span className={`text-sm font-black ${isSetFull ? 'text-rose-600' : 'text-slate-700'}`}>
              {players.length} / {maxSetSize}
            </span>
          </div>
        </div>

        {/* Players Table/List */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/30">
          {players.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-medium text-sm">
              No players added to the list yet. Fill the form above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="p-3 pl-4">Player</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Base Price</th>
                    <th className="p-3 text-right pr-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {players.map((p, idx) => (
                    <tr key={idx} className="hover:bg-white transition-colors bg-white/50">
                      <td className="p-3 pl-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0 border border-slate-300 overflow-hidden flex items-center justify-center">
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt="pic" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 leading-tight">{p.name}</p>
                          <p className="text-xs text-slate-500 font-medium">{p.mobile}</p>
                        </div>
                      </td>
                      <td className="p-3 align-middle">
                        <span className="inline-block px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold">
                          {p.role} • Cat {p.category}
                        </span>
                      </td>
                      <td className="p-3 align-middle text-sm font-bold text-emerald-600">
                        ₹{p.basePrice}
                      </td>
                      <td className="p-3 pr-4 align-middle text-right">
                        <button
                          onClick={() => handleRemovePlayer(idx)}
                          disabled={isSubmitting}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                          title="Remove from list"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSubmitAll}
            disabled={players.length === 0 || isSubmitting || isLimitReached}
            className={`w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 px-8 py-3.5 rounded-2xl text-white font-black text-sm sm:text-base shadow-lg transition-all ${
              players.length === 0 || isSubmitting || isLimitReached
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 active:scale-95'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Submitting {players.length}...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Submit All {players.length} Players</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

export default QuickMultiAdd;
