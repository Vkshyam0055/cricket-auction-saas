import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TournamentContext } from '../context/TournamentContext';

function CreateTournament() {
  const navigate = useNavigate();
  const { tournament, fetchTournament } = useContext(TournamentContext);

  const [formData, setFormData] = useState({
    name: '', logoUrl: '', venue: '', bidButton1: 500, bidButton2: 1000, bidButton3: 5000,
    upiQrUrl: '', upiId: '', paymentMessage: '' // 🌟 NEW
  });

  const [customFields, setCustomFields] = useState([]);
  const [isUploadingQr, setIsUploadingQr] = useState(false);

  useEffect(() => {
    if (tournament) {
      setFormData({
        name: tournament.name || '', logoUrl: tournament.logoUrl || '', venue: tournament.venue || '',
        bidButton1: tournament.bidButton1 || 500, bidButton2: tournament.bidButton2 || 1000, bidButton3: tournament.bidButton3 || 5000,
        upiQrUrl: tournament.upiQrUrl || '', upiId: tournament.upiId || '', paymentMessage: tournament.paymentMessage || '' // 🌟 NEW
      });
      setCustomFields(tournament.customFields || []); 
    }
  }, [tournament]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // 🌟 QR Code Upload Logic 🌟
  const handleQrUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingQr(true);
    const data = new FormData();
    data.append("file", file); data.append("upload_preset", "auction_preset"); data.append("cloud_name", "dpg5olqt7");
    try {
      const res = await axios.post(`https://api.cloudinary.com/v1_1/dpg5olqt7/image/upload`, data);
      setFormData({ ...formData, upiQrUrl: res.data.secure_url });
      alert("✅ QR Code सफलतापूर्वक अपलोड हो गया!");
    } catch (err) { alert("❌ QR अपलोड फेल!"); }
    finally { setIsUploadingQr(false); }
  };

  const addField = () => setCustomFields([...customFields, { label: '', type: 'text', required: false, options: [] }]);
  const removeField = (index) => setCustomFields(customFields.filter((_, i) => i !== index));
  const updateField = (index, key, value) => {
    const updated = [...customFields];
    if (key === 'options') updated[index][key] = value.split(',').map(s => s.trim());
    else updated[index][key] = value;
    setCustomFields(updated);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if(isUploadingQr) { alert("QR Code अपलोड हो रहा है, रुकिए..."); return; }
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post('https://cricket-auction-backend-h8ud.onrender.com/api/tournament', { ...formData, customFields }, { headers });
      await fetchTournament(); 
      alert('🎉 टूर्नामेंट और रजिस्ट्रेशन फॉर्म सफलतापूर्वक सेट हो गया!');
      navigate('/dashboard'); 
    } catch (error) { alert('सेव करने में कोई दिक्कत आई!'); }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8 flex justify-center items-start">
      <div className="max-w-2xl w-full bg-white p-8 rounded-3xl shadow-2xl border-t-8 border-indigo-600 my-10">
        <h2 className="text-3xl font-black text-gray-800 mb-2">🏆 {tournament ? 'Edit' : 'Setup New'} Tournament</h2>
        <p className="text-gray-500 font-bold mb-8 border-b pb-4">अपने टूर्नामेंट और रजिस्ट्रेशन फॉर्म को कस्टमाइज़ करें।</p>
        
        <form onSubmit={handleSave} className="space-y-6">
          <div><label className="block text-sm font-black text-gray-500 uppercase mb-2">Tournament Name *</label><input name="name" value={formData.name} onChange={handleChange} required className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-indigo-500 outline-none" /></div>
          <div><label className="block text-sm font-black text-gray-500 uppercase mb-2">Logo (URL)</label><input name="logoUrl" value={formData.logoUrl} onChange={handleChange} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-indigo-500 outline-none" /></div>
          <div><label className="block text-sm font-black text-gray-500 uppercase mb-2">Venue</label><input name="venue" value={formData.venue} onChange={handleChange} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-indigo-500 outline-none" /></div>

          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
            <label className="block text-sm font-black text-indigo-800 uppercase mb-3">Bidding Buttons (₹)</label>
            <div className="grid grid-cols-3 gap-4">
              <div><span className="text-xs font-bold text-gray-500">Btn 1</span><input name="bidButton1" type="number" value={formData.bidButton1} onChange={handleChange} className="w-full p-2 mt-1 border rounded-lg font-bold text-center" /></div>
              <div><span className="text-xs font-bold text-gray-500">Btn 2</span><input name="bidButton2" type="number" value={formData.bidButton2} onChange={handleChange} className="w-full p-2 mt-1 border rounded-lg font-bold text-center" /></div>
              <div><span className="text-xs font-bold text-gray-500">Btn 3</span><input name="bidButton3" type="number" value={formData.bidButton3} onChange={handleChange} className="w-full p-2 mt-1 border rounded-lg font-bold text-center" /></div>
            </div>
          </div>

          {/* 🌟 PAYMENT COLLECTION SETTINGS 🌟 */}
          <div className="bg-green-50 p-6 rounded-xl border border-green-200 shadow-sm">
             <h3 className="font-black text-green-800 uppercase tracking-widest mb-4">💸 Registration Fee Settings (Optional)</h3>
             <p className="text-xs font-bold text-gray-500 mb-4">अगर आप रजिस्ट्रेशन के लिए पैसे लेना चाहते हैं, तो अपना UPI और मैसेज डालें।</p>
             
             <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-1">Payment Instruction / Message</label>
                  <input name="paymentMessage" value={formData.paymentMessage} onChange={handleChange} placeholder="e.g. Entry Fee ₹500. Pay below to register." className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold focus:border-green-500 outline-none text-sm" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">Your UPI ID</label>
                    <input name="upiId" value={formData.upiId} onChange={handleChange} placeholder="e.g. 9876543210@ybl" className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold focus:border-green-500 outline-none text-sm" />
                  </div>
                  <div>
                     <label className="block text-xs font-black text-gray-500 uppercase mb-1">Upload PhonePe/Paytm QR Code</label>
                     <label className="cursor-pointer bg-white px-4 py-3 rounded-xl border border-gray-200 w-full flex items-center justify-center font-bold text-sm hover:bg-gray-50">
                        {isUploadingQr ? 'Uploading...' : formData.upiQrUrl ? '✅ QR Uploaded (Click to Change)' : '📁 Select QR Image'}
                        <input type="file" accept="image/*" onChange={handleQrUpload} className="hidden" disabled={isUploadingQr} />
                     </label>
                  </div>
                </div>
             </div>
          </div>

          {/* DYNAMIC FORM BUILDER */}
          <div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-300">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-gray-700 uppercase tracking-widest">📝 Form Builder</h3>
                <button type="button" onClick={addField} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 shadow-md">+ Add Custom Field</button>
             </div>
             {customFields.length === 0 ? (
                <p className="text-gray-400 font-medium text-sm">💡 <strong>Pro Tip:</strong> अगर आपने ऊपर पेमेंट QR लगाया है, तो खिलाड़ियों से पेमेंट का स्क्रीनशॉट मांगने के लिए यहाँ "Payment Screenshot" नाम का File Upload फील्ड बना दें!</p>
             ) : (
                <div className="space-y-4">
                   {customFields.map((field, index) => (
                      <div key={index} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative">
                         <button type="button" onClick={() => removeField(index)} className="absolute top-2 right-2 text-red-500 font-bold hover:bg-red-50 px-2 py-1 rounded">✖</button>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2 pr-8">
                            <input type="text" placeholder="Field Label (e.g. T-Shirt Size)" value={field.label} onChange={(e) => updateField(index, 'label', e.target.value)} required className="p-2 border rounded font-bold text-sm bg-gray-50" />
                            <select value={field.type} onChange={(e) => updateField(index, 'type', e.target.value)} className="p-2 border rounded font-bold text-sm bg-gray-50 text-blue-700">
                               <option value="text">Text (Short Answer)</option>
                               <option value="number">Number</option>
                               <option value="dropdown">Dropdown</option>
                               <option value="file">File Upload (Image/PDF)</option>
                               <option value="checkbox">Checkbox (Yes/No)</option>
                            </select>
                         </div>
                         {field.type === 'dropdown' && <input type="text" placeholder="Options (comma separated: S, M, L, XL)" value={field.options?.join(', ')} onChange={(e) => updateField(index, 'options', e.target.value)} required className="w-full p-2 border rounded font-medium text-xs bg-gray-50 mb-2" />}
                         <label className="flex items-center space-x-2 text-sm font-bold text-gray-600"><input type="checkbox" checked={field.required} onChange={(e) => updateField(index, 'required', e.target.checked)} className="w-4 h-4 accent-blue-600" /><span>Is Required? (ज़रूरी है)</span></label>
                      </div>
                   ))}
                </div>
             )}
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={() => navigate('/dashboard')} className="flex-1 bg-gray-200 text-gray-700 font-black py-4 rounded-xl hover:bg-gray-300">Cancel</button>
            <button type="submit" disabled={isUploadingQr} className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-indigo-700 disabled:bg-gray-400">Save System 🚀</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateTournament;