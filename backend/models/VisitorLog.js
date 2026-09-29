const mongoose = require('mongoose');

const visitorLogSchema = new mongoose.Schema({
    visitorId: { type: String, required: true, index: true },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    route: { type: String, default: '/' },
    createdAt: { type: Date, default: Date.now, index: { expires: '7d' } }
});

module.exports = mongoose.model('VisitorLog', visitorLogSchema);
