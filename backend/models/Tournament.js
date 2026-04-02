const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    logoUrl: { type: String, default: '' },
    venue: { type: String, default: '' },
    // 🌟 SaaS Feature: यह टूर्नामेंट किस ऑर्गेनाइजर का है?
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Tournament', tournamentSchema);