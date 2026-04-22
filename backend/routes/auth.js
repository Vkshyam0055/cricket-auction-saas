const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { resolveEffectivePlan } = require('../utils/planPolicy');

// 1. आयोजक का रजिस्ट्रेशन
router.post('/register', async (req, res) => {
    try {
        const { name, phone, password } = req.body;
        let user = await User.findOne({ phone });
        if (user) return res.status(400).json({ message: "इस नंबर से खाता पहले से मौजूद है!" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            name, phone, password: hashedPassword,
            plan: 'Basic', role: 'Organizer', maxDevicesAllowed: 1, isActive: true
        });
        await user.save();
        res.status(201).json({ message: "रजिस्ट्रेशन सफल रहा!" });
    } catch (err) {
        res.status(500).json({ error: "रजिस्ट्रेशन में एरर आया!" });
    }
});

// 2. आयोजक का लॉगिन (SuperAdmin Bypass + Safety Guard)
router.post('/login', async (req, res) => {
    try {
        const { phone, password, deviceId } = req.body;
        console.log('[AUTH] POST /api/auth/login', {
            phone,
            hasPassword: Boolean(password),
            hasDeviceId: Boolean(deviceId)
        });
        const user = await User.findOne({ phone });
        if (!user) return res.status(400).json({ message: "यह नंबर रजिस्टर नहीं है!" });
        console.log('[AUTH] login user found', { userId: String(user._id), role: user.role });

        if (!user.isActive) {
            return res.status(403).json({ message: "आपका अकाउंट सस्पेंड कर दिया गया है।" });
        }

        const storedPassword = String(user.password || '');
        let isMatch = false;
        const isBcryptHash = storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$');

        if (isBcryptHash) {
            isMatch = await bcrypt.compare(password, storedPassword);
        } else {
            // Legacy support: plain text password stored in old DB entries.
            isMatch = password === storedPassword;
            if (isMatch) {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);
                await User.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });
                user.password = hashedPassword;
            }
        }
        if (!isMatch) return res.status(400).json({ message: "पासवर्ड गलत है!" });

        // 🌟 SAFETY GUARD: अगर डेटाबेस में activeDevices एरे नहीं है, तो इसे अभी बना दो
        if (!Array.isArray(user.activeDevices)) {
            user.activeDevices = [];
            await User.updateOne({ _id: user._id }, { $set: { activeDevices: [] } });
        }

        if (deviceId) {
            // VIP Bypass: SuperAdmin के लिए लिमिट चेक मत करो
            if (user.role !== 'SuperAdmin') {
                if (!user.activeDevices.includes(deviceId) && user.activeDevices.length >= user.maxDevicesAllowed) {
                    return res.status(403).json({ 
                        message: `लॉगिन लिमिट पूरी हो गई है! आपका प्लान सिर्फ ${user.maxDevicesAllowed} डिवाइस की अनुमति देता है।` 
                    });
                }
            }

            // डिवाइस जोड़ें (अगर नया है)
            if (!user.activeDevices.includes(deviceId)) {
                user.activeDevices.push(deviceId);
                await User.updateOne(
                    { _id: user._id },
                    { $addToSet: { activeDevices: deviceId } }
                );
            }
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

        const normalizedPlan = resolveEffectivePlan(user);

        res.json({ 
            message: "लॉगिन सफल!", token, 
            user: { name: user.name, phone: user.phone, role: user.role, plan: normalizedPlan } 
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "सर्वर क्रैश प्रोटेक्शन: डेटा फॉर्मेट सही नहीं है!" });
    }
});

// 3. आयोजक का लॉगआउट
router.post('/logout', async (req, res) => {
    try {
        const { phone, deviceId } = req.body;
        if (phone && deviceId) {
            const user = await User.findOne({ phone });
            if (user && Array.isArray(user.activeDevices)) {
                await User.updateOne({ phone }, { $pull: { activeDevices: deviceId } });
            }
        }
        res.json({ message: "लॉगआउट सफल!" });
    } catch (err) {
        res.status(500).json({ error: "लॉगआउट में एरर!" });
    }
});

module.exports = router;