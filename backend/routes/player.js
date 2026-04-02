const express = require('express');
const router = express.Router();
const Player = require('../models/Player'); 
const Team = require('../models/Team'); 
const fetchOrganizer = require('../middleware/fetchOrganizer');

router.use(fetchOrganizer);

router.post('/', async (req, res) => {
    try {
        const { name, fatherName, age, mobile, city, role, basePrice, photoUrl } = req.body;
        const newPlayer = new Player({ 
            name, fatherName, age, mobile, city, role, basePrice, photoUrl,
            organizer: req.user.id // मालिक का ठप्पा
        });
        const savedPlayer = await newPlayer.save();
        res.json(savedPlayer);
    } catch (error) {
        res.status(500).json({ message: "खिलाड़ी सेव करने में खराबी आ गई है!" });
    }
});

router.get('/', async (req, res) => {
    try {
        // सिर्फ अपने ही खिलाड़ियों को लाओ
        const players = await Player.find({ organizer: req.user.id });
        res.json(players);
    } catch (error) {
        res.status(500).json({ message: "खिलाड़ियों को लाने में खराबी आ गई है!" });
    }
});

router.put('/sell/:id', async (req, res) => {
    try {
        const { teamName, soldPrice } = req.body;
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        if(!player) return res.status(404).json({ message: "Player not found" });
        
        player.soldTo = teamName;
        player.soldPrice = Number(soldPrice);
        player.auctionStatus = 'Sold';
        await player.save();

        const team = await Team.findOne({ teamName: teamName, organizer: req.user.id });
        if (team) {
            team.remainingPurse -= Number(soldPrice);
            await team.save();
        }
        res.json({ message: "खिलाड़ी बिक गया!", player });
    } catch (error) {
        res.status(500).json({ message: "खिलाड़ी बेचने में खराबी आ गई है!" });
    }
});

router.put('/unsold/:id', async (req, res) => {
    try {
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        if(!player) return res.status(404).json({ message: "Player not found" });
        
        player.auctionStatus = 'Unsold'; 
        await player.save();
        res.json({ message: "खिलाड़ी अनसोल्ड हो गया!", player });
    } catch (error) {
        res.status(500).json({ message: "अनसोल्ड करने में खराबी आ गई!" });
    }
});

router.put('/undo/:id', async (req, res) => {
    try {
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        if (!player) return res.status(404).json({ message: "खिलाड़ी नहीं मिला" });

        if (player.auctionStatus === 'Sold' && player.soldTo && player.soldTo !== 'Unsold') {
            const team = await Team.findOne({ teamName: player.soldTo, organizer: req.user.id });
            if (team) {
                team.remainingPurse += player.soldPrice;
                await team.save();
            }
        }

        player.auctionStatus = 'Pending';
        player.soldTo = '';
        player.soldPrice = 0;
        await player.save();

        res.json({ message: "Undo Successful!", player });
    } catch (error) {
        res.status(500).json({ message: "Undo करने में एरर!" });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await Player.findOneAndDelete({ _id: req.params.id, organizer: req.user.id });
        res.json({ message: "खिलाड़ी सफलतापूर्वक डिलीट हो गया!" });
    } catch (error) {
        res.status(500).json({ message: "डिलीट करने में एरर!" });
    }
});

router.put('/approval/:id', async (req, res) => {
    try {
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        player.approvalStatus = req.body.status;
        await player.save();
        res.json({ message: "Status Updated", player });
    } catch (error) {
        res.status(500).json({ message: "Error updating status" });
    }
});

router.put('/update-price/:id', async (req, res) => {
    try {
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        player.basePrice = Number(req.body.basePrice);
        await player.save();
        res.json({ message: "Price Updated", player });
    } catch (error) {
        res.status(500).json({ message: "Error updating price" });
    }
});

router.put('/make-icon/:id', async (req, res) => {
    try {
        const { teamName, iconPrice } = req.body;
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });

        player.soldTo = teamName;
        player.soldPrice = Number(iconPrice);
        player.auctionStatus = 'Icon'; 
        player.isIcon = true;
        player.approvalStatus = 'Approved'; 
        await player.save();

        const team = await Team.findOne({ teamName: teamName, organizer: req.user.id });
        if (team) {
            team.remainingPurse -= Number(iconPrice);
            await team.save();
        }

        res.json({ message: "⭐ Icon Player Assigned Successfully!", player });
    } catch (error) {
        res.status(500).json({ message: "Error making Icon Player" });
    }
});

router.put('/:id', async (req, res) => {
  try {
    const { auctionStatus, isIcon, soldTo, soldPrice } = req.body;
    
    const updatedPlayer = await Player.findOneAndUpdate(
      { _id: req.params.id, organizer: req.user.id },
      { auctionStatus, isIcon, soldTo, soldPrice },
      { new: true }
    );
    res.status(200).json(updatedPlayer);
  } catch (error) {
    res.status(500).json({ message: "एरर: प्लेयर अपडेट नहीं हो पाया।" });
  }
});

module.exports = router;