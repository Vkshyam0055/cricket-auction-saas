const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Player = require('../models/Player');
const UserSession = require('../models/UserSession');
const fetchOrganizer = require('../middleware/fetchOrganizer');
const { normalizePlanName, isSupportedPlanInput } = require('../utils/planPolicy');
const { revokeAllSessionsForUser } = require('../utils/sessionAuth');

// 🌟 सिर्फ SuperAdmin के लिए पूरा डेटा लाने वाला रास्ता 🌟
router.get('/all-data', fetchOrganizer, async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin') {
            return res.status(403).json({ message: "Access Denied: सिर्फ Developer ही इसे देख सकता है!" });
        }

        const users = await User.find({ role: 'Organizer' }).sort({ createdAt: -1 });
        const now = new Date();
        const activeSessionRows = await UserSession.aggregate([
            {
                $match: {
                    revokedAt: null,
                    expiresAt: { $gt: now }
                }
            },
            {
                $group: {
                    _id: '$user',
                    count: { $sum: 1 }
                }
            }
        ]);
        const activeSessionMap = new Map(activeSessionRows.map((row) => [String(row._id), Number(row.count || 0)]));
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
                totalPlayers: playerCount,
                // 🌟 नए फीचर्स का डेटा
                plan: user.plan,
                isActive: user.isActive,
                isLifetimeFree: user.isLifetimeFree,
                maxDevicesAllowed: user.maxDevicesAllowed,
                activeDevicesCount: activeSessionMap.get(String(user._id)) || 0
            });
        }
        
        res.json(allData);
    } catch (error) {
        res.status(500).json({ message: "मास्टर डेटा लाने में सर्वर एरर!" });
    }
});

// 🌟 SUPER ADMIN POWER: यूज़र का प्लान और एक्सेस अपडेट करना
router.put('/update-user/:id', fetchOrganizer, async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin') return res.status(403).json({ message: "Access Denied!" });

        const { plan, isActive, isLifetimeFree, maxDevicesAllowed } = req.body;
        if (!isSupportedPlanInput(plan)) {
            return res.status(400).json({ message: "Invalid plan value" });
        }
        const normalizedPlan = normalizePlanName(plan);
        
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id, 
            { plan: normalizedPlan, isActive, isLifetimeFree, maxDevicesAllowed },
            { new: true }
        );

        res.json({ message: "यूज़र डेटा सफलतापूर्वक अपडेट हो गया!", user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: "यूज़र अपडेट करने में एरर!" });
    }
});

// 🌟 SUPER ADMIN POWER: यूज़र के डिवाइस रीसेट करना (अगर वो फंस जाए)
router.put('/clear-devices/:id', fetchOrganizer, async (req, res) => {
     try {
        if (req.user.role !== 'SuperAdmin') return res.status(403).json({ message: "Access Denied!" });
        
        // सभी डिवाइस क्लियर कर दिए
        await User.findByIdAndUpdate(req.params.id, { activeDevices: [] });
        await revokeAllSessionsForUser(req.params.id);        
        
        res.json({ message: "यूज़र के सभी डिवाइस सफलतापूर्क क्लियर कर दिए गए हैं!" });
     } catch (error) {
         res.status(500).json({ message: "डिवाइस क्लियर करने में एरर!" });
     }
});

router.put('/force-logout/:id', fetchOrganizer, async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin') return res.status(403).json({ message: "Access Denied!" });
        await revokeAllSessionsForUser(req.params.id);
        res.json({ message: "यूज़र के सभी लॉगिन सेशन अमान्य कर दिए गए हैं!" });
    } catch (error) {
        res.status(500).json({ message: "फोर्स लॉगआउट में एरर!" });
    }
});

module.exports = router;