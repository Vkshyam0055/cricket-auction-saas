const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    logoUrl: { type: String, default: '' },
    venue: { type: String, default: '' },
    bidButton1: { type: Number, default: 500 },
    bidButton2: { type: Number, default: 1000 },
    bidButton3: { type: Number, default: 5000 },
    
    // 🌟 FIX: यह लाइन मिसिंग थी! इसी वजह से डेटाबेस टॉगल को सेव नहीं कर रहा था 🌟
    isRegistrationOpen: { type: Boolean, default: true },
    
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Tournament', tournamentSchema);