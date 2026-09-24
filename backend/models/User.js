const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Organizer' }, 
    plan: { type: String, enum: ['Free', 'Basic', 'Pro'], default: 'Free' }, 
    isActive: { type: Boolean, default: true },
    isLifetimeFree: { type: Boolean, default: false },
    maxDevicesAllowed: { type: Number, default: 1 },
    // 🌟 सुरक्षा: अगर डेटाबेस में कुछ न हो, तो इसे खाली लिस्ट मानो
    activeDevices: { type: Array, default: [] },
    overrides: { type: Object, default: {} },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpire: { type: Date, default: null } 
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);