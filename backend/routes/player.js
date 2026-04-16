const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Player = require('../models/Player'); 
const Team = require('../models/Team'); 
const Tournament = require('../models/Tournament');
const fetchOrganizer = require('../middleware/fetchOrganizer');

// === PUBLIC ROUTES ===
router.get('/public/:tournamentId', async (req, res) => {
    try {
        const { tournamentId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(tournamentId)) return res.status(400).json({ message: 'Invalid ID' });

        // 🌟 FIX: tournamentPoster ko select list me joda
        const tournament = await Tournament.findById(tournamentId).select('name logoUrl tournamentPoster isRegistrationOpen organizer customFields upiQrUrl upiId paymentMessage');
        if (!tournament) return res.status(404).json({ message: 'टूर्नामेंट नहीं मिला' });
        
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
        if (tournament.isRegistrationOpen === false) return res.status(403).json({ message: 'रजिस्ट्रेशन बंद है।' });

        const { name, fatherName, age, mobile, city, role, basePrice, photoUrl, customData } = req.body;

        const newPlayer = new Player({
            name, fatherName, age, mobile, city, role, basePrice, photoUrl, customData: customData || {}, 
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
        const { name, fatherName, age, mobile, city, role, basePrice, photoUrl, customData } = req.body;
        let tournamentId = req.body.tournament;
        if (!tournamentId) {
            const organizerTournament = await Tournament.findOne({ organizer: req.user.id }).select('_id');
            tournamentId = organizerTournament?._id;
        }
        const newPlayer = new Player({ 
            name, fatherName, age, mobile, city, role, basePrice, photoUrl, customData: customData || {}, 
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
        player.soldTo = teamName; player.soldPrice = Number(soldPrice); player.auctionStatus = 'Sold';
        await player.save();
        const team = await Team.findOne({ teamName: teamName, organizer: req.user.id });
        if (team) { team.remainingPurse -= Number(soldPrice); await team.save(); }
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
        player.auctionStatus = 'Pending'; player.soldTo = ''; player.soldPrice = 0; await player.save();
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
        player.approvalStatus = req.body.status; await player.save();
        res.json({ message: "Status Updated", player });
    } catch (error) { res.status(500).json({ message: "Error" }); }
});

router.put('/update-price/:id', async (req, res) => {
    try {
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        player.basePrice = Number(req.body.basePrice); await player.save();
        res.json({ message: "Price Updated", player });
    } catch (error) { res.status(500).json({ message: "Error" }); }
});

router.put('/make-icon/:id', async (req, res) => {
    try {
        const { teamName, iconPrice } = req.body;
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        player.soldTo = teamName; player.soldPrice = Number(iconPrice); player.auctionStatus = 'Icon'; player.isIcon = true; player.approvalStatus = 'Approved'; await player.save();
        const team = await Team.findOne({ teamName: teamName, organizer: req.user.id });
        if (team) { team.remainingPurse -= Number(iconPrice); await team.save(); }
        res.json({ message: "Icon Assigned!", player });
    } catch (error) { res.status(500).json({ message: "Error" }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { auctionStatus, isIcon, soldTo, soldPrice } = req.body;
    const updatedPlayer = await Player.findOneAndUpdate(
      { _id: req.params.id, organizer: req.user.id },
      { auctionStatus, isIcon, soldTo, soldPrice }, { new: true }
    );
    res.status(200).json(updatedPlayer);
  } catch (error) { res.status(500).json({ message: "एरर!" }); }
});

module.exports = router;