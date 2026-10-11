const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    teamName: { type: String, required: true },
    shortName: { type: String, default: '' },
    ownerName: { type: String, default: '' },
    mobile: { type: String, default: '' },
    // 🌟 SaaS Feature: यह टीम किस टूर्नामेंट और किस ऑर्गेनाइजर की है?
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' }, 
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    logoUrl: { type: String, default: '' },
    // backward compatibility
    logo: { type: String, default: '' }, 
    totalPurse: { type: Number, required: true },
    remainingPurse: { type: Number, required: true },
    
    // Remote Bidding Fields
    remoteAccessEnabled: { type: Boolean, default: false },
    remoteUsername: { type: String, default: '', trim: true },
    remotePasswordHash: { type: String, default: '' }
}, { timestamps: true });

// Scoped index to ensure username uniqueness per tournament, if a username is provided
teamSchema.index(
    { tournament: 1, remoteUsername: 1 }, 
    { unique: true, partialFilterExpression: { remoteUsername: { $type: "string", $gt: "" } } }
);

module.exports = mongoose.model('Team', teamSchema);