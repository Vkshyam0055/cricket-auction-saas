const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 1. आयोजक का रजिस्ट्रेशन (Sign Up)
router.post('/register', async (req, res) => {
    try {
        const { name, phone, password } = req.body;

        let user = await User.findOne({ phone });
        if (user) return res.status(400).json({ message: "इस नंबर से खाता पहले से मौजूद है!" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // नया आयोजक गोडाउन में सेव करना (Default Plan: Basic, 1 Device)
        user = new User({
            name,
            phone,
            password: hashedPassword,
            plan: 'Basic',
            maxDevicesAllowed: 1
        });
        await user.save();

        res.status(201).json({ message: "रजिस्ट्रेशन सफल रहा! अब आप लॉगिन कर सकते हैं।" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. आयोजक का लॉगिन (Sign In)
router.post('/login', async (req, res) => {
    try {
        const { phone, password, deviceId } = req.body; // 🌟 फ्रंटएंड से डिवाइस आईडी भी आएगी

        const user = await User.findOne({ phone });
        if (!user) return res.status(400).json({ message: "यह नंबर रजिस्टर नहीं है!" });

        // 🛑 सिक्योरिटी चेक 1: क्या एडमिन ने इसे ब्लॉक किया है?
        if (!user.isActive) {
            return res.status(403).json({ message: "आपका अकाउंट सस्पेंड कर दिया गया है। कृपया एडमिन से संपर्क करें!" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "पासवर्ड गलत है!" });

        // 🛑 सिक्योरिटी चेक 2: डिवाइस ट्रैकिंग लॉजिक
        if (deviceId) {
            // अगर यह नया डिवाइस है और लिमिट पूरी हो चुकी है
            if (!user.activeDevices.includes(deviceId) && user.activeDevices.length >= user.maxDevicesAllowed) {
                return res.status(403).json({ 
                    message: `लॉगिन लिमिट पूरी हो गई है! आपका प्लान सिर्फ ${user.maxDevicesAllowed} डिवाइस(s) की अनुमति देता है। कृपया पहले दूसरे डिवाइस से लॉगआउट करें।` 
                });
            }
            // अगर नया डिवाइस है और लिमिट बची है, तो गोडाउन में सेव कर लो
            if (!user.activeDevices.includes(deviceId)) {
                user.activeDevices.push(deviceId);
                await user.save();
            }
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({ message: "लॉगिन सफल!", token, user: { name: user.name, phone: user.phone, role: user.role, plan: user.plan } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. आयोजक का लॉगआउट (डिवाइस को लिस्ट से हटाना)
router.post('/logout', async (req, res) => {
    try {
        const { phone, deviceId } = req.body;
        if (phone && deviceId) {
            await User.updateOne(
                { phone },
                { $pull: { activeDevices: deviceId } } // गोडाउन से इस डिवाइस को हटा दो
            );
        }
        res.json({ message: "लॉगआउट सफल!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;