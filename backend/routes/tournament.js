const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');

// टूर्नामेंट की जानकारी लाने का रास्ता
router.get('/', async (req, res) => {
    try {
        // चूँकि अभी एक ही टूर्नामेंट का सेटअप है, हम पहला टूर्नामेंट ले आएंगे
        const tournament = await Tournament.findOne();
        res.json(tournament);
    } catch (error) {
        res.status(500).json({ message: "टूर्नामेंट लाने में दिक्कत!" });
    }
});

// टूर्नामेंट बनाने या अपडेट करने का रास्ता
router.post('/', async (req, res) => {
    try {
        const { name, logoUrl, venue } = req.body;
        
        let tournament = await Tournament.findOne();
        
        if (tournament) {
            // अगर पहले से है, तो अपडेट कर दो (Editing Feature)
            tournament.name = name;
            tournament.logoUrl = logoUrl;
            tournament.venue = venue;
            await tournament.save();
            res.json({ message: "टूर्नामेंट अपडेट हो गया!", tournament });
        } else {
            // नहीं है, तो नया बना दो
            const newTournament = new Tournament({ name, logoUrl, venue });
            await newTournament.save();
            res.json({ message: "नया टूर्नामेंट बन गया!", tournament: newTournament });
        }
    } catch (error) {
        res.status(500).json({ message: "टूर्नामेंट सेव करने में दिक्कत!" });
    }
});

module.exports = router;