const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const fetchOrganizer = require('../middleware/fetchOrganizer');

router.use(fetchOrganizer);

router.get('/', async (req, res) => {
    try {
        const tournament = await Tournament.findOne({ organizer: req.user.id });
        res.json(tournament);
    } catch (error) {
        res.status(500).json({ message: "टूर्नामेंट लाने में दिक्कत!" });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, logoUrl, venue, bidButton1, bidButton2, bidButton3 } = req.body;
        let tournament = await Tournament.findOne({ organizer: req.user.id });
        
        if (tournament) {
            tournament.name = name;
            tournament.logoUrl = logoUrl;
            tournament.venue = venue;
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
                organizer: req.user.id
            });
            await newTournament.save();
            res.json({ message: "नया टूर्नामेंट बन गया!", tournament: newTournament });
        }
    } catch (error) {
        res.status(500).json({ message: "टूर्नामेंट सेव करने में दिक्कत!" });
    }
});

// 🌟 टॉगल (ON/OFF) करने का API 🌟
router.patch('/registration-status', async (req, res) => {
    try {
        const { isRegistrationOpen } = req.body;
        if (typeof isRegistrationOpen !== 'boolean') return res.status(400).json({ message: 'Must be boolean' });

        const tournament = await Tournament.findOneAndUpdate(
            { organizer: req.user.id },
            { isRegistrationOpen },
            { new: true }
        );
        if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
        
        res.json({ message: 'Status updated', tournament });
    } catch (error) {
        res.status(500).json({ message: 'Update failed' });
    }
});

module.exports = router;