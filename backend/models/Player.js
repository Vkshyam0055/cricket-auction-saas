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
    
    // 🌟 नए फीचर्स 🌟
    approvalStatus: { type: String, default: 'Pending' }, // Pending, Approved, Rejected
    isIcon: { type: Boolean, default: false }, // क्या यह आइकॉन प्लेयर है?

    // ऑक्शन स्टेटस
    soldTo: { type: String, default: 'Unsold' },
    soldPrice: { type: Number, default: 0 },
    auctionStatus: { type: String, default: 'Unsold' }
});

module.exports = mongoose.model('Player', playerSchema);