const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Organizer' }, // SuperAdmin या Organizer
    
    // 🌟 SaaS & Plan Management
    plan: { type: String, default: 'Basic' }, // Basic, Pro, Premium
    isActive: { type: Boolean, default: true }, // User को ब्लॉक/अनब्लॉक करने के लिए
    isLifetimeFree: { type: Boolean, default: false }, // मैन्युअल फ्री एक्सेस देने के लिए
    
    // 🌟 Device Login Tracking 
    maxDevicesAllowed: { type: Number, default: 1 }, // प्लान के हिसाब से डिवाइस लिमिट
    activeDevices: [{ type: String }], // कौन-कौनसे डिवाइस (Device IDs) में लॉगिन है
    
    // 🌟 Override System (भविष्य के लिए)
    overrides: { type: Object, default: {} } 
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);