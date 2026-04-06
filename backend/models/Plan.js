const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    subtitle: { type: String },
    features: [{ type: String }], // खूबियों की लिस्ट
    isPopular: { type: Boolean, default: false } // 'Most Popular' बैज के लिए
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);