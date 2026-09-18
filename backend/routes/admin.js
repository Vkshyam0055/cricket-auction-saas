const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Player = require('../models/Player');
const UserSession = require('../models/UserSession');
const fetchOrganizer = require('../middleware/fetchOrganizer');
const { normalizePlanName, isSupportedPlanInput } = require('../utils/planPolicy');
const AuditLog = require('../models/AuditLog');
const { 
    revokeAllSessionsForUser, 
    createSessionAndToken, 
    createImpersonationSessionAndToken, 
    revokeImpersonationSessionsForTarget 
} = require('../utils/sessionAuth');

// 🔒 Guard: Ensure caller is genuine SuperAdmin and NOT an impersonated session
const requireSuperAdmin = (req, res, next) => {
    if (req.user?.isImpersonated) {
        return res.status(403).json({ message: "Access Denied: Impersonated sessions cannot access admin endpoints!" });
    }
    if (req.user?.role !== 'SuperAdmin') {
        return res.status(403).json({ message: "Access Denied!" });
    }
    next();
};

// 🌟 IMPERSONATION ROUTES 🌟
router.post('/impersonate/:id', fetchOrganizer, requireSuperAdmin, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const targetUser = await User.findById(targetUserId);

        if (!targetUser) {
            return res.status(404).json({ message: "Target user not found!" });
        }

        if (targetUser.role === 'SuperAdmin') {
            return res.status(403).json({ message: "Cannot impersonate another SuperAdmin!" });
        }

        // Create a dedicated, short-lived session for impersonation
        const { session, token, expiresAt } = await createImpersonationSessionAndToken({
            targetUser,
            adminUser: req.user,
            deviceId: 'impersonation_device',
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        // Log the audit event
        await AuditLog.create({
            adminId: req.user.id,
            targetUserId: targetUserId,
            action: 'ENTER_IMPERSONATION'
        });

        res.json({
            message: `Impersonating ${targetUser.name}`,
            token,
            sessionId: session._id,
            sessionExpiresAt: expiresAt,
            user: {
                _id: targetUser._id,
                name: targetUser.name,
                phone: targetUser.phone,
                email: targetUser.email,
                role: targetUser.role,
                plan: targetUser.plan
            }
        });

    } catch (error) {
        console.error('Impersonate error:', error);
        res.status(500).json({ message: "Error starting impersonation session!" });
    }
});

router.post('/impersonate/:id/exit', fetchOrganizer, requireSuperAdmin, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const { sessionId } = req.body || {};

        // Safely revoke the impersonation session(s)
        await revokeImpersonationSessionsForTarget({
            targetUserId,
            sessionId: sessionId || null
        });

        // Log the audit event
        await AuditLog.create({
            adminId: req.user.id,
            targetUserId: targetUserId,
            action: 'EXIT_IMPERSONATION'
        });

        res.json({ message: "Impersonation exited successfully" });

    } catch (error) {
        console.error('Exit impersonate error:', error);
        res.status(500).json({ message: "Error exiting impersonation session!" });
    }
});


// 🌟 सिर्फ SuperAdmin के लिए पूरा डेटा लाने वाला रास्ता 🌟
router.get('/all-data', fetchOrganizer, requireSuperAdmin, async (req, res) => {
    try {

        const users = await User.find({ role: 'Organizer' }).sort({ createdAt: -1 });
        const now = new Date();
        const activeSessionRows = await UserSession.aggregate([
            {
                $match: {
                    revokedAt: null,
                    expiresAt: { $gt: now },
                    isImpersonated: { $ne: true }
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
router.put('/update-user/:id', fetchOrganizer, requireSuperAdmin, async (req, res) => {
    try {
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
router.put('/clear-devices/:id', fetchOrganizer, requireSuperAdmin, async (req, res) => {
     try {
        // सभी डिवाइस क्लियर कर दिए
        await User.findByIdAndUpdate(req.params.id, { activeDevices: [] });
        await revokeAllSessionsForUser(req.params.id);        
        
        res.json({ message: "यूज़र के सभी डिवाइस सफलतापूर्क क्लियर कर दिए गए हैं!" });
     } catch (error) {
         res.status(500).json({ message: "डिवाइस क्लियर करने में एरर!" });
     }
});

router.put('/force-logout/:id', fetchOrganizer, requireSuperAdmin, async (req, res) => {
    try {
        await revokeAllSessionsForUser(req.params.id);
        res.json({ message: "यूज़र के सभी लॉगिन सेशन अमान्य कर दिए गए हैं!" });
    } catch (error) {
        res.status(500).json({ message: "फोर्स लॉगआउट में एरर!" });
    }
});

module.exports = router;