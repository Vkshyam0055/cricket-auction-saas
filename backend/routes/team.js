const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const fetchOrganizer = require('../middleware/fetchOrganizer');

router.use(fetchOrganizer);

router.post('/', async (req, res) => {
    try {
        const { teamName, totalPurse, ownerName, mobile, logoUrl } = req.body;

        // चेक करें कि क्या इसी मालिक की कोई और टीम इस नाम से है?
        let existingTeam = await Team.findOne({ teamName, organizer: req.user.id });
        if (existingTeam) {
            return res.status(400).json({ message: "यह टीम पहले से मौजूद है!" });
        }

        const newTeam = new Team({
            teamName,
            totalPurse,
            remainingPurse: totalPurse,
            ownerName, mobile, logoUrl,
            organizer: req.user.id // मालिक का ठप्पा
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
        // सिर्फ उसी मालिक की टीमें लाओ
        const teams = await Team.find({ organizer: req.user.id }); 
        res.json(teams); 
    } catch (error) {
        console.error("एरर:", error.message);
        res.status(500).json({ message: "टीमें लाने में खराबी आ गई है!" });
    }
});

router.put('/:id', async (req, res) => {
  try {
    const { teamName, totalPurse, remainingPurse, ownerName, mobile, logoUrl } = req.body;
    const updatedTeam = await Team.findOneAndUpdate(
      { _id: req.params.id, organizer: req.user.id }, // सुरक्षा: सिर्फ अपना ही एडिट कर सके
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