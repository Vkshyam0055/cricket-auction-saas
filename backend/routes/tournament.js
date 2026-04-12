const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const fetchOrganizer = require('../middleware/fetchOrganizer');

// इस फाइल के सभी रास्तों पर सिक्योरिटी गार्ड लगा दिया
router.use(fetchOrganizer);

router.get('/', async (req, res) => {
    try {
        // सिर्फ उसी का टूर्नामेंट लाओ जो लॉगिन है
        const tournament = await Tournament.findOne({ organizer: req.user.id });
        res.json(tournament);
    } catch (error) {
        res.status(500).json({ message: "टूर्नामेंट लाने में दिक्कत!" });
    }
});

router.post('/', async (req, res) => {
    try {
        // 🌟 FIX: नए बिड बटन्स के पैरामीटर्स भी ले लिए
        const { name, logoUrl, venue, bidButton1, bidButton2, bidButton3 } = req.body;
        
        let tournament = await Tournament.findOne({ organizer: req.user.id });
        
        if (tournament) {
            tournament.name = name;
            tournament.logoUrl = logoUrl;
            tournament.venue = venue;
            // 🌟 Update Bid Buttons
            if (bidButton1) tournament.bidButton1 = Number(bidButton1);
            if (bidButton2) tournament.bidButton2 = Number(bidButton2);
            if (bidButton3) tournament.bidButton3 = Number(bidButton3);

            await tournament.save();
            res.json({ message: "टूर्नामेंट अपडेट हो गया!", tournament });
        } else {
            const newTournament = new Tournament({ 
                name, logoUrl, venue, 
                bidButton1: bidButton1 ? Number(bidButton1) : 500,
                bidButton2: bidButton2 ? Number(bidButton2) : 1000,
                bidButton3: bidButton3 ? Number(bidButton3) : 5000,
                organizer: req.user.id // मालिक का ठप्पा
            });
            await newTournament.save();
            res.json({ message: "नया टूर्नामेंट बन गया!", tournament: newTournament });
        }
    } catch (error) {
        res.status(500).json({ message: "टूर्नामेंट सेव करने में दिक्कत!" });
    }
});

module.exports = router;