const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    logoUrl: { type: String, default: '' },
    venue: { type: String, default: '' },
    // 🌟 Custom Bid Buttons (Dynamic Pricing)
    bidButton1: { type: Number, default: 500 },
    bidButton2: { type: Number, default: 1000 },
    bidButton3: { type: Number, default: 5000 },
    // 🌟 SaaS Feature: यह टूर्नामेंट किस ऑर्गेनाइजर का है?
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Tournament', tournamentSchema);