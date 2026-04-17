const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    teamName: { type: String, required: true },
    ownerName: { type: String, default: '' },
    mobile: { type: String, default: '' },
    // 🌟 SaaS Feature: यह टीम किस टूर्नामेंट और किस ऑर्गेनाइजर की है?
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' }, 
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    logoUrl: { type: String, default: '' },
    // backward compatibility
    logo: { type: String, default: '' }, 
    totalPurse: { type: Number, required: true },
    remainingPurse: { type: Number, required: true } 
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);