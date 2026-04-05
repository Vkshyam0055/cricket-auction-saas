const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Player = require('../models/Player');
const fetchOrganizer = require('../middleware/fetchOrganizer');

// 🌟 सिर्फ SuperAdmin के लिए पूरा डेटा लाने वाला रास्ता 🌟
router.get('/all-data', fetchOrganizer, async (req, res) => {
    try {
        // चेक करो कि क्या रिक्वेस्ट करने वाला असली मालिक (SuperAdmin) है?
        if (req.user.role !== 'SuperAdmin') {
            return res.status(403).json({ message: "Access Denied: सिर्फ Developer ही इसे देख सकता है!" });
        }

        // सारे ऑर्गेनाइजर्स को ढूंढो (SuperAdmin को छोड़कर)
        const users = await User.find({ role: 'Organizer' }).sort({ createdAt: -1 });
        const allData = [];

        for (let user of users) {
            const tournament = await Tournament.findOne({ organizer: user._id });
            const teamCount = await Team.countDocuments({ organizer: user._id });
            const playerCount = await Player.countDocuments({ organizer: user._id });

            allData.push({
                _id: user._id,
                name: user.name,
                phone: user.phone,
                registeredAt: user.createdAt,
                tournamentName: tournament ? tournament.name : 'Not Created Yet',
                totalTeams: teamCount,
                totalPlayers: playerCount
            });
        }
        
        res.json(allData);
    } catch (error) {
        res.status(500).json({ message: "मास्टर डेटा लाने में सर्वर एरर!" });
    }
});

module.exports = router;