const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    teamName: { type: String, required: true },
    ownerName: { type: String },
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' }, // यह टीम किस टूर्नामेंट की है
    logo: { type: String }, // लोगो की फोटो का लिंक
    totalPurse: { type: Number, required: true },
    remainingPurse: { type: Number, required: true } // लाइव ऑक्शन में यही घटेगा
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);