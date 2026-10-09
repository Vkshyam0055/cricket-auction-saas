import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, FileSpreadsheet, Image as ImageIcon, CheckCircle2, ChevronRight, Save, User, Download, AlertCircle, Plus } from 'lucide-react';
import { apiRequest } from '../utils/apiClient';
import { uploadImageToCloudinary } from '../utils/cloudinaryUpload';

const normalizeString = (str) => {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
};

const TEMPLATE_HEADERS = ["Name*", "Mobile*", "Role*", "Category*", "Base Price", "Father Name", "Age", "City"];

function BulkImportWizard({ playerLimit, isLimitReached, fetchPlayers }) {
  const [step, setStep] = useState(1);
  const [parsedPlayers, setParsedPlayers] = useState([]);
  const [matchedPhotos, setMatchedPhotos] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  
  const excelInputRef = useRef(null);
  const photosInputRef = useRef(null);
  const singlePhotoInputRef = useRef(null);
  const [activePhotoRowIndex, setActivePhotoRowIndex] = useState(null);

  // --- Step 1: Data Upload ---
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ["Virat Kohli", "9876543210", "Batsman", "A", 1000, "Prem Kohli", 35, "Delhi"],
      ["Jasprit Bumrah", "9998887776", "Bowler", "A", 1500, "", 30, "Ahmedabad"]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Players");
    XLSX.writeFile(wb, "Player_Import_Template.xlsx");
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const validPlayers = data.map(row => ({
          name: row['Name*'] || row['Name'] || '',
          mobile: (row['Mobile*'] || row['Mobile'] || '').toString(),
          role: row['Role*'] || row['Role'] || 'Batsman',
          category: row['Category*'] || row['Category'] || 'A',
          basePrice: Number(row['Base Price']) || 0,
          fatherName: row['Father Name'] || '',
          age: Number(row['Age']) || '',
          city: row['City'] || ''
        })).filter(p => p.name && p.mobile);

        if (validPlayers.length === 0) {
          alert("No valid players found. Ensure your file has 'Name*' and 'Mobile*' columns.");
          return;
        }

        setParsedPlayers(validPlayers);
        setStep(2);
      } catch (err) {
        console.error("Excel Parse Error:", err);
        alert("Failed to read Excel file. Please use the provided template.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // --- Step 2: Photo Matching ---
  const handlePhotosUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newMatches = { ...matchedPhotos };
    let matchCount = 0;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const normFileName = normalizeString(fileNameWithoutExt);
      
      const pIndex = parsedPlayers.findIndex(p => {
        const normName = normalizeString(p.name);
        const normMobile = normalizeString(p.mobile);
        return normFileName === normName || normFileName === normMobile;
      });
      
      if (pIndex !== -1 && !newMatches[pIndex]) {
        newMatches[pIndex] = { file, preview: URL.createObjectURL(file) };
        matchCount++;
      }
    });
    
    setMatchedPhotos(newMatches);
    alert(`Successfully matched ${matchCount} new photos based on file names!`);
    e.target.value = '';
  };

  const handleSinglePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && activePhotoRowIndex !== null) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      setMatchedPhotos(prev => ({
        ...prev,
        [activePhotoRowIndex]: { file, preview: URL.createObjectURL(file) }
      }));
    }
    setActivePhotoRowIndex(null);
    if (singlePhotoInputRef.current) singlePhotoInputRef.current.value = '';
  };

  // --- Step 3: Submission ---
  const handleSubmitAll = async () => {
    if (parsedPlayers.length === 0) return;
    if (isLimitReached || (playerLimit !== -1 && parsedPlayers.length > playerLimit)) {
      alert(`Plan limit exceeded. You are trying to add ${parsedPlayers.length} players, which exceeds your remaining quota.`);
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload photos in chunks
      const photoEntries = Object.entries(matchedPhotos);
      const uploadedUrls = {};
      const chunkSize = 5;

      for (let i = 0; i < photoEntries.length; i += chunkSize) {
        setUploadProgress(`Uploading photos: ${Math.min(i + chunkSize, photoEntries.length)} / ${photoEntries.length}`);
        const chunk = photoEntries.slice(i, i + chunkSize);
        const promises = chunk.map(async ([pIndex, photoData]) => {
          try {
            const secureUrl = await uploadImageToCloudinary(photoData.file, 'player-photo.jpg');
            return { pIndex, secureUrl };
          } catch (err) {
            console.error('Photo upload failed for index', pIndex, err);
            return { pIndex, secureUrl: null };
          }
        });

        const results = await Promise.all(promises);
        results.forEach(res => {
          if (res.secureUrl) uploadedUrls[res.pIndex] = res.secureUrl;
        });
      }

      // 2. Prepare final payload
      setUploadProgress('Saving players to database...');
      const playersPayload = parsedPlayers.map((p, idx) => ({
        ...p,
        photoUrl: uploadedUrls[idx] || 'https://via.placeholder.com/150'
      }));

      // 3. API Call
      const token = localStorage.getItem('token');
      const res = await apiRequest({
        method: 'post',
        path: '/api/players/bulk',
        data: { players: playersPayload },
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(res.data?.message || 'Players imported successfully!');
      
      // Reset State
      setParsedPlayers([]);
      setMatchedPhotos({});
      setStep(1);
      if (fetchPlayers) fetchPlayers();
    } catch (error) {
      console.error('Bulk submission error:', error);
      alert(error?.response?.data?.message || 'Failed to submit players. Please check limits.');
    } finally {
      setIsSubmitting(false);
      setUploadProgress('');
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between sm:justify-start sm:space-x-4 mb-8">
      {[1, 2, 3].map((s) => (
        <React.Fragment key={s}>
          <div className={`flex items-center space-x-2 ${step === s ? 'opacity-100' : 'opacity-50 grayscale'}`}>
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm ${step === s ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 text-slate-500'}`}>
              {s}
            </div>
            <span className="text-xs sm:text-sm font-bold text-slate-700 hidden sm:block">
              {s === 1 ? 'Upload Data' : s === 2 ? 'Auto-Match Photos' : 'Review'}
            </span>
          </div>
          {s < 3 && <ChevronRight className="w-4 h-4 text-slate-300 mx-2" />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-200/80">
      {renderStepIndicator()}

      {/* STEP 1 */}
      {step === 1 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col sm:flex-row items-center justify-between bg-blue-50/50 border border-blue-100 rounded-2xl p-5 sm:p-6 text-center sm:text-left gap-4">
            <div>
              <h3 className="text-base font-black text-blue-950 mb-1">Download Template</h3>
              <p className="text-xs text-blue-800/70 font-medium max-w-md">Use our standard Excel template to ensure your data is formatted correctly before uploading.</p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="px-5 py-2.5 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl font-bold text-sm shadow-sm transition flex items-center gap-2 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Download .xlsx</span>
            </button>
          </div>

          <div
            onClick={() => excelInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 rounded-2xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[250px]"
          >
            <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center text-emerald-600 mb-4">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-slate-800 mb-1.5">Upload filled template</h3>
            <p className="text-xs font-medium text-slate-500 mb-4">Click to select your .xlsx or .csv file</p>
            <button className="px-6 py-2 bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm pointer-events-none">
              Browse File
            </button>
            <input type="file" accept=".xlsx, .csv" ref={excelInputRef} onChange={handleExcelUpload} className="hidden" />
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-base font-black text-emerald-950 mb-1">Data Extracted Successfully</h3>
            <p className="text-xs text-emerald-800/70 font-medium">Found {parsedPlayers.length} valid players in your file.</p>
          </div>

          <div
            onClick={() => photosInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center"
          >
            <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center text-blue-600 mb-4">
              <ImageIcon className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-slate-800 mb-1.5">Auto-Match Photos</h3>
            <p className="text-xs font-medium text-slate-500 mb-4 max-w-sm mx-auto">
              Select multiple photos at once. We will match them automatically if the filename equals the Player Name or Mobile Number.
            </p>
            <div className="flex gap-3 justify-center">
              <button className="px-6 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-sm pointer-events-none">
                Select Photos
              </button>
            </div>
            <input type="file" accept="image/*" multiple ref={photosInputRef} onChange={handlePhotosUpload} className="hidden" />
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 rounded-xl border border-slate-300 text-slate-700 bg-white font-bold text-sm transition hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-3 rounded-xl bg-slate-800 text-white font-bold text-sm shadow-md transition hover:bg-slate-900 flex items-center gap-2"
            >
              <span>Continue to Review</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">Review & Submit</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Matched {Object.keys(matchedPhotos).length} photos for {parsedPlayers.length} players.
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
               <button
                onClick={() => setStep(2)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 bg-white font-bold text-xs hover:bg-slate-50 transition flex-1 sm:flex-none"
              >
                Back
              </button>
              <button
                onClick={handleSubmitAll}
                disabled={isSubmitting || isLimitReached || parsedPlayers.length === 0}
                className="px-6 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition flex items-center justify-center gap-2 flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{uploadProgress || 'Processing...'}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Submit {parsedPlayers.length} Players</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Hidden input for single manual photo selection */}
          <input type="file" accept="image/*" ref={singlePhotoInputRef} onChange={handleSinglePhotoUpload} className="hidden" />

          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/30">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white/95 backdrop-blur z-10 border-b border-slate-200">
                  <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="p-3 pl-4">Photo</th>
                    <th className="p-3">Player Info</th>
                    <th className="p-3">Role / Cat</th>
                    <th className="p-3">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedPlayers.map((p, idx) => (
                    <tr key={idx} className="hover:bg-white transition-colors bg-white/50">
                      <td className="p-3 pl-4 w-20">
                        {matchedPhotos[idx] ? (
                           <div className="w-10 h-10 rounded-full border border-slate-300 overflow-hidden relative group">
                             <img src={matchedPhotos[idx].preview} alt="match" className="w-full h-full object-cover" />
                             <div 
                               onClick={() => { setActivePhotoRowIndex(idx); singlePhotoInputRef.current?.click(); }}
                               className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center cursor-pointer transition-opacity"
                               title="Change Photo"
                             >
                                <UploadCloud className="w-4 h-4 text-white" />
                             </div>
                           </div>
                        ) : (
                          <button
                            onClick={() => { setActivePhotoRowIndex(idx); singlePhotoInputRef.current?.click(); }}
                            disabled={isSubmitting}
                            className="w-10 h-10 rounded-full bg-slate-100 border border-slate-300 border-dashed flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 hover:border-blue-300 transition"
                            title="Upload Photo"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                      <td className="p-3">
                        <p className="text-sm font-bold text-slate-800 leading-tight">{p.name}</p>
                        <p className="text-xs text-slate-500 font-medium">{p.mobile}</p>
                      </td>
                      <td className="p-3 align-middle">
                        <span className="inline-block px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold">
                          {p.role} • Cat {p.category}
                        </span>
                      </td>
                      <td className="p-3 align-middle text-sm font-bold text-emerald-600">
                        ₹{p.basePrice}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BulkImportWizard;
