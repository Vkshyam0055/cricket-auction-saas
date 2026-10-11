const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
    // Organizer sessions use user. Team Owner sessions are scoped to a team instead.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', default: null, index: true },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    sessionRole: { type: String, enum: ['User', 'TeamOwner'], default: 'User', index: true },
    deviceId: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null, index: true },
    lastActivityAt: { type: Date, default: Date.now },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    isImpersonated: { type: Boolean, default: false },
    impersonatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

userSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
userSessionSchema.index({ user: 1, deviceId: 1, revokedAt: 1 });

module.exports = mongoose.model('UserSession', userSessionSchema);
