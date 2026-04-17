const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Player = require('../models/Player'); 
const Team = require('../models/Team'); 
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const fetchOrganizer = require('../middleware/fetchOrganizer');
const { getPolicyByPlanName, resolveEffectivePlan } = require('../utils/planPolicy');

// === PUBLIC ROUTES ===
router.get('/public/:tournamentId', async (req, res) => {
    try {
        const { tournamentId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(tournamentId)) return res.status(400).json({ message: 'Invalid ID' });

        // 🌟 FIX: tournamentPoster ko select list me joda
        const tournament = await Tournament.findById(tournamentId).select('name logoUrl tournamentPoster isRegistrationOpen organizer customFields upiQrUrl upiId paymentMessage');
        if (!tournament) return res.status(404).json({ message: 'टूर्नामेंट नहीं मिला' });

        const organizer = await User.findById(tournament.organizer).select('plan role').lean();
        const organizerPlan = resolveEffectivePlan(organizer);
        const policy = getPolicyByPlanName(organizerPlan);
        if (!policy.canPublicRegistration) {
            return res.status(403).json({ message: 'यह फीचर आपके आयोजक प्लान में उपलब्ध नहीं है।' });
        }
        
        if (tournament.isRegistrationOpen === false) {
            return res.status(403).json({ message: 'आयोजक ने रजिस्ट्रेशन बंद कर दिया है।' });
        }
        res.json(tournament);
    } catch (error) { res.status(500).json({ message: 'सर्वर एरर' }); }
});

router.post('/public/:tournamentId/register', async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const tournament = await Tournament.findById(tournamentId).select('_id organizer isRegistrationOpen');
        if (!tournament) return res.status(404).json({ message: 'टूर्नामेंट नहीं मिला' });

        const organizer = await User.findById(tournament.organizer).select('plan role').lean();
        const organizerPlan = resolveEffectivePlan(organizer);
        const policy = getPolicyByPlanName(organizerPlan);
        if (!policy.canPublicRegistration) {
            return res.status(403).json({ message: 'यह फीचर आपके आयोजक प्लान में उपलब्ध नहीं है।' });
        }

        if (tournament.isRegistrationOpen === false) return res.status(403).json({ message: 'रजिस्ट्रेशन बंद है।' });

        const { name, fatherName, age, mobile, city, role, category, basePrice, photoUrl, customData } = req.body;

        const newPlayer = new Player({
            name, fatherName, age, mobile, city, role, category, basePrice, photoUrl, customData: customData || {},
            source: 'PublicRegistration',
            tournament: tournament._id, organizer: tournament.organizer
        });
        const savedPlayer = await newPlayer.save();
        res.status(201).json(savedPlayer);
    } catch (error) { res.status(500).json({ message: 'रजिस्ट्रेशन फेल हो गया' }); }
});

// === PRIVATE ROUTES ===
router.use(fetchOrganizer);

router.post('/', async (req, res) => {
    try {
        const { name, fatherName, age, mobile, city, role, category, basePrice, photoUrl, customData } = req.body;
        let tournamentId = req.body.tournament;
        if (!tournamentId) {
            const organizerTournament = await Tournament.findOne({ organizer: req.user.id }).select('_id');
            tournamentId = organizerTournament?._id;
        }
        const newPlayer = new Player({ 
            name, fatherName, age, mobile, city, role, category, basePrice, photoUrl, customData: customData || {},
            approvalStatus: 'Approved',
            auctionStatus: 'ReadyForAuction',
            source: 'Organizer',
            organizer: req.user.id, tournament: tournamentId || undefined
        });
        const savedPlayer = await newPlayer.save();
        res.json(savedPlayer);
    } catch (error) { res.status(500).json({ message: "खिलाड़ी सेव करने में खराबी आ गई है!" }); }
});

router.get('/', async (req, res) => {
    try {
        const players = await Player.find({ organizer: req.user.id });
        res.json(players);
    } catch (error) { res.status(500).json({ message: "एरर!" }); }
});

router.put('/sell/:id', async (req, res) => {
    try {
        const { teamName, soldPrice } = req.body;
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        if(!player) return res.status(404).json({ message: "Player not found" });
        const team = await Team.findOne({ teamName: teamName, organizer: req.user.id });
        if (!team) return res.status(404).json({ message: "Team not found" });

        if (player.approvalStatus !== 'Approved' || player.auctionStatus !== 'ReadyForAuction' || player.isIcon) {
            return res.status(409).json({ message: "Player is not eligible to be sold right now" });
        }

        const numericSoldPrice = Number(soldPrice);
        if (!Number.isFinite(numericSoldPrice) || numericSoldPrice <= 0) {
            return res.status(400).json({ message: "Invalid sold price" });
        }
        if (numericSoldPrice > team.remainingPurse) {
            return res.status(400).json({ message: "Insufficient team purse" });
        }

        player.soldTo = teamName;
        player.soldPrice = numericSoldPrice;
        player.auctionStatus = 'Sold';
        await player.save();

        team.remainingPurse -= numericSoldPrice;
        await team.save();
        res.json({ message: "खिलाड़ी बिक गया!", player });
    } catch (error) { res.status(500).json({ message: "एरर!" }); }
});

router.put('/unsold/:id', async (req, res) => {
    try {
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        if(!player) return res.status(404).json({ message: "Player not found" });
        player.auctionStatus = 'Unsold'; await player.save();
        res.json({ message: "खिलाड़ी अनसोल्ड हो गया!", player });
    } catch (error) { res.status(500).json({ message: "एरर!" }); }
});

router.put('/undo/:id', async (req, res) => {
    try {
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        if (!player) return res.status(404).json({ message: "खिलाड़ी नहीं मिला" });
        if (player.auctionStatus === 'Sold' && player.soldTo && player.soldTo !== 'Unsold') {
            const team = await Team.findOne({ teamName: player.soldTo, organizer: req.user.id });
            if (team) { team.remainingPurse += player.soldPrice; await team.save(); }
        }
        player.auctionStatus = 'ReadyForAuction'; player.soldTo = 'Unsold'; player.soldPrice = 0; await player.save();
        res.json({ message: "Undo Successful!", player });
    } catch (error) { res.status(500).json({ message: "एरर!" }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await Player.findOneAndDelete({ _id: req.params.id, organizer: req.user.id });
        res.json({ message: "डिलीट हो गया!" });
    } catch (error) { res.status(500).json({ message: "एरर!" }); }
});

router.put('/approval/:id', async (req, res) => {
    try {
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        if (!player) return res.status(404).json({ message: "Player not found" });
        player.approvalStatus = req.body.status;
        if (req.body.status === 'Approved') {
            player.auctionStatus = 'ReadyForAuction';
            if (!player.soldTo) player.soldTo = 'Unsold';
            player.soldPrice = 0;
        }
        await player.save();
        res.json({ message: "Status Updated", player });
    } catch (error) { res.status(500).json({ message: "Error" }); }
});

router.put('/update-price/:id', async (req, res) => {
    try {
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        if (!player) return res.status(404).json({ message: "Player not found" });
        const basePrice = Number(req.body.basePrice);
        if (!Number.isFinite(basePrice) || basePrice < 0) return res.status(400).json({ message: "Invalid base price" });
        player.basePrice = basePrice; await player.save();
        res.json({ message: "Price Updated", player });
    } catch (error) { res.status(500).json({ message: "Error" }); }
});

router.put('/update-category/:id', async (req, res) => {
    try {
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        if (!player) return res.status(404).json({ message: "Player not found" });

        const category = typeof req.body.category === 'string' ? req.body.category.trim() : '';
        player.category = category;
        await player.save();

        res.json({ message: "Category Updated", player });
    } catch (error) { res.status(500).json({ message: "Error" }); }
});

router.put('/make-icon/:id', async (req, res) => {
    try {
        const { teamName, iconPrice } = req.body;
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        if (!player) return res.status(404).json({ message: "Player not found" });
        if (player.auctionStatus === 'Sold' || player.isIcon) return res.status(409).json({ message: "Player already sold/icon" });

        const team = await Team.findOne({ teamName: teamName, organizer: req.user.id });
        if (!team) return res.status(404).json({ message: "Team not found" });
        const numericIconPrice = Number(iconPrice);
        if (!Number.isFinite(numericIconPrice) || numericIconPrice < 0) return res.status(400).json({ message: "Invalid icon price" });
        if (numericIconPrice > team.remainingPurse) return res.status(400).json({ message: "Insufficient team purse" });

        player.soldTo = teamName;
        player.soldPrice = numericIconPrice;
        player.auctionStatus = 'Icon';
        player.isIcon = true;
        player.approvalStatus = 'Approved';
        await player.save();

        team.remainingPurse -= numericIconPrice;
        await team.save();
        res.json({ message: "Icon Assigned!", player });
    } catch (error) { res.status(500).json({ message: "Error" }); }
});

router.put('/remove-icon/:id', async (req, res) => {
    try {
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        if (!player) return res.status(404).json({ message: "Player not found" });

        if (player.isIcon && player.soldTo && player.soldTo !== 'Unsold') {
            const team = await Team.findOne({ teamName: player.soldTo, organizer: req.user.id });
            if (team) {
                team.remainingPurse += Number(player.soldPrice || 0);
                await team.save();
            }
        }

        player.isIcon = false;
        player.soldTo = 'Unsold';
        player.soldPrice = 0;
        player.auctionStatus = player.approvalStatus === 'Approved' ? 'ReadyForAuction' : 'Pending';
        await player.save();

        res.json({ message: "Icon removed successfully!", player });
    } catch (error) { res.status(500).json({ message: "Error" }); }
});

module.exports = router;