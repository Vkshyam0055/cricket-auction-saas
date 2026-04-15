const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    logoUrl: { type: String, default: '' },
    venue: { type: String, default: '' },
    bidButton1: { type: Number, default: 500 },
    bidButton2: { type: Number, default: 1000 },
    bidButton3: { type: Number, default: 5000 },
    isRegistrationOpen: { type: Boolean, default: true },
    
    // 🌟 NEW: Dynamic Form Builder Fields 🌟
    customFields: [{
        label: { type: String, required: true }, // जैसे: "T-Shirt Size"
        type: { type: String, enum: ['text', 'number', 'dropdown', 'file', 'checkbox'], required: true },
        required: { type: Boolean, default: false },
        options: [{ type: String }] // सिर्फ dropdown के लिए (जैसे: S, M, L, XL)
    }],

    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Tournament', tournamentSchema);