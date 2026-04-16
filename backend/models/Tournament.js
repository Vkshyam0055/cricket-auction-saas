const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    logoUrl: { type: String, default: '' },
    
    // 🌟 NEW: Tournament Poster for Popup & Facebook Style Cover
    tournamentPoster: { type: String, default: '' },
    
    venue: { type: String, default: '' },
    
    // 🌟 NEW: Default Team Budget & Min Players
    teamBudget: { type: Number, default: 50000000 },
    minPlayersPerTeam: { type: Number, default: 15 },

    bidButton1: { type: Number, default: 500 },
    bidButton2: { type: Number, default: 1000 },
    bidButton3: { type: Number, default: 5000 },
    isRegistrationOpen: { type: Boolean, default: true },
    
    customFields: [{
        label: { type: String, required: true }, 
        type: { type: String, enum: ['text', 'number', 'dropdown', 'file', 'checkbox'], required: true },
        required: { type: Boolean, default: false },
        options: [{ type: String }] 
    }],

    upiQrUrl: { type: String, default: '' },
    upiId: { type: String, default: '' },
    paymentMessage: { type: String, default: '' },

    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Tournament', tournamentSchema);