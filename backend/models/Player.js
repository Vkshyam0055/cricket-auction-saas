const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    fatherName: { type: String },
    age: { type: Number },
    mobile: { type: String, required: true },
    city: { type: String },
    role: { type: String, required: true },
    basePrice: { type: Number, default: 0 },
    photoUrl: { type: String, default: 'https://via.placeholder.com/150' },
    
    // 🌟 SaaS Feature: यह खिलाड़ी किस ऑर्गेनाइजर के पास रजिस्टर हुआ है?
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    approvalStatus: { type: String, default: 'Pending' }, 
    isIcon: { type: Boolean, default: false }, 

    soldTo: { type: String, default: 'Unsold' },
    soldPrice: { type: Number, default: 0 },
    auctionStatus: { type: String, default: 'Unsold' } // Pending, Sold, Unsold
}, { timestamps: true });

module.exports = mongoose.model('Player', playerSchema);