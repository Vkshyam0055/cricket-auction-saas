const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    fatherName: { type: String },
    age: { type: Number },
    mobile: { type: String, required: true },
    city: { type: String },
    role: { type: String, required: true },
    category: { type: String, default: '' },
    basePrice: { type: Number, default: 0 },
    photoUrl: { type: String, default: 'https://via.placeholder.com/150' },
    
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' }, 

    approvalStatus: { type: String, default: 'Pending' }, 
    source: { type: String, enum: ['Organizer', 'PublicRegistration'], default: 'PublicRegistration' },
    isIcon: { type: Boolean, default: false }, 

    soldTo: { type: String, default: 'Unsold' },
    soldPrice: { type: Number, default: 0 },
    auctionStatus: { type: String, default: 'Pending' },

    // 🌟 NEW: Dynamic Data Storage (यह ऑब्जेक्ट के रूप में सेव होगा) 🌟
    customData: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }

}, { timestamps: true });

module.exports = mongoose.model('Player', playerSchema);