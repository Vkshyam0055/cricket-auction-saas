const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // अपना यूज़र रजिस्टर मंगवाना

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

        // नया आयोजक गोडाउन में सेव करना
        user = new User({
            name,
            phone,
            password: hashedPassword
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
        const { phone, password } = req.body;

        // यूज़र को गोडाउन में खोजना
        const user = await User.findOne({ phone });
        if (!user) return res.status(400).json({ message: "यह नंबर रजिस्टर नहीं है!" });

        // पासवर्ड चेक करना (असली पासवर्ड और गुप्त कोड का मिलान)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "पासवर्ड गलत है!" });

        // डिजिटल आईडी कार्ड (Token) बनाना
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({ message: "लॉगिन सफल!", token, user: { name: user.name, phone: user.phone, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;