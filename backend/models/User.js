const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Organizer' }, // SuperAdmin या Organizer
    plan: { type: String, default: 'Silver' }, // Silver, Gold, Platinum
    activeDevices: { type: Number, default: 0 } // शानदार डिवाइस ट्रैकिंग फीचर
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);