const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 1. आयोजक का रजिस्ट्रेशन (Sign Up)
router.post('/register', async (req, res) => {
    try {
        const { name, phone, password } = req.body;

        // चेक करें कि क्या इस नंबर से पहले ही खाता है?
        let user = await User.findOne({ phone });
        if (user) return res.status(400).json({ message: "इस नंबर से खाता पहले से मौजूद है!" });

        // पासवर्ड को गुप्त कोड (Hash) में बदलना
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // नया आयोजक गोडाउन में सेव करना (Default Plan: Basic, 1 Device)
        user = new User({
            name,
            phone,
            password: hashedPassword,
            plan: 'Basic',
            role: 'Organizer',
            maxDevicesAllowed: 1,
            isActive: true
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
        const { phone, password, deviceId } = req.body;

        // यूज़र को गोडाउन में खोजना
        const user = await User.findOne({ phone });
        if (!user) return res.status(400).json({ message: "यह नंबर रजिस्टर नहीं है!" });

        // 🛑 सिक्योरिटी चेक 1: क्या एडमिन ने इसे ब्लॉक किया है?
        if (!user.isActive) {
            return res.status(403).json({ message: "आपका अकाउंट सस्पेंड कर दिया गया है। कृपया एडमिन से संपर्क करें!" });
        }

        // पासवर्ड चेक करना
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "पासवर्ड गलत है!" });

        // 🛑 सिक्योरिटी चेक 2: डिवाइस ट्रैकिंग लॉजिक (VIP Bypass for SuperAdmin)
        if (deviceId) {
            // अगर लॉगिन करने वाला SuperAdmin नहीं है, सिर्फ तभी लिमिट चेक करो
            if (user.role !== 'SuperAdmin') {
                const isAlreadyLoggedInOnThisDevice = user.activeDevices.includes(deviceId);
                
                if (!isAlreadyLoggedInOnThisDevice && user.activeDevices.length >= user.maxDevicesAllowed) {
                    return res.status(403).json({ 
                        message: `लॉगिन लिमिट पूरी हो गई है! आपका प्लान सिर्फ ${user.maxDevicesAllowed} डिवाइस की अनुमति देता है।` 
                    });
                }
            }

            // अगर नया डिवाइस है (चाहे SuperAdmin हो या Organizer), उसे लिस्ट में जोड़ लो
            if (!user.activeDevices.includes(deviceId)) {
                user.activeDevices.push(deviceId);
                await user.save();
            }
        }

        // डिजिटल आईडी कार्ड (Token) बनाना
        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '7d' } // अब 7 दिन तक लॉगिन रहेगा
        );

        res.json({ 
            message: "लॉगिन सफल!", 
            token, 
            user: { 
                name: user.name, 
                phone: user.phone, 
                role: user.role, 
                plan: user.plan 
            } 
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "सर्वर में कुछ खराबी है!" });
    }
});

// 3. आयोजक का लॉगआउट (डिवाइस को लिस्ट से हटाना)
router.post('/logout', async (req, res) => {
    try {
        const { phone, deviceId } = req.body;
        if (phone && deviceId) {
            await User.updateOne(
                { phone },
                { $pull: { activeDevices: deviceId } }
            );
        }
        res.json({ message: "लॉगआउट सफल!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;