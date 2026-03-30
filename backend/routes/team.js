const express = require('express');
const router = express.Router();
const Team = require('../models/Team');

router.post('/', async (req, res) => {
    try {
        const { teamName, totalPurse } = req.body;

        let existingTeam = await Team.findOne({ teamName });
        if (existingTeam) {
            return res.status(400).json({ message: "यह टीम पहले से मौजूद है!" });
        }

        const newTeam = new Team({
            teamName: teamName,
            totalPurse: totalPurse,
            remainingPurse: totalPurse 
        });

        const savedTeam = await newTeam.save();
        res.json(savedTeam);

    } catch (error) {
        console.error("गोडाउन एरर:", error.message);
        res.status(500).json({ message: "इंजन में कोई तकनीकी खराबी आ गई है!" });
    }
});

router.get('/', async (req, res) => {
    try {
        const teams = await Team.find(); 
        res.json(teams); 
    } catch (error) {
        console.error("एरर:", error.message);
        res.status(500).json({ message: "टीमें लाने में खराबी आ गई है!" });
    }
});

// 🌟 MASTER EDIT: Update Team Details 🌟
router.put('/:id', async (req, res) => {
  try {
    const { teamName, totalPurse, remainingPurse, ownerName, mobile, logoUrl } = req.body;
    const updatedTeam = await Team.findByIdAndUpdate(
      req.params.id,
      { teamName, totalPurse, remainingPurse, ownerName, mobile, logoUrl },
      { new: true }
    );
    res.status(200).json(updatedTeam);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "एरर: टीम अपडेट नहीं हो पाई।" });
  }
});

module.exports = router;