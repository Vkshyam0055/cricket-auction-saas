const express = require('express');
const router = express.Router();
const Team = require('../models/Team');

router.post('/', async (req, res) => {
    try {
        // हम फ्रंटएंड से जो नाम भेजेंगे, वो यहाँ पकड़ेंगे
        const { teamName, totalPurse } = req.body;

        let existingTeam = await Team.findOne({ teamName });
        if (existingTeam) {
            return res.status(400).json({ message: "यह टीम पहले से मौजूद है!" });
        }

        // नई टीम बनाते वक़्त 'remainingPurse' को भी 'totalPurse' के बराबर रख देंगे
        const newTeam = new Team({
            teamName: teamName,
            totalPurse: totalPurse,
            remainingPurse: totalPurse // शुरुआत में बचा हुआ पैसा भी कुल पैसे के बराबर ही होगा
        });

        const savedTeam = await newTeam.save();
        res.json(savedTeam);

    } catch (error) {
        console.error("गोडाउन एरर:", error.message);
        res.status(500).json({ message: "इंजन में कोई तकनीकी खराबी आ गई है!" });
    }
});

// नया रास्ता: गोडाउन से सारी टीमें लाने के लिए (GET /api/teams)
router.get('/', async (req, res) => {
    try {
        const teams = await Team.find(); // गोडाउन से सारी टीमें निकाल लो
        res.json(teams); // और टीवी स्क्रीन को भेज दो
    } catch (error) {
        console.error("एरर:", error.message);
        res.status(500).json({ message: "टीमें लाने में खराबी आ गई है!" });
    }
});

module.exports = router;