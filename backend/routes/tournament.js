const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const fetchOrganizer = require('../middleware/fetchOrganizer');
const {
    validateAutoIncrementSlabs,
    getEffectiveAutoIncrementSlabs,
    calculateSlabPreviews
} = require('../utils/autoIncrement');

router.use(fetchOrganizer);

router.get('/', async (req, res) => {
    try {
        const tournament = await Tournament.findOne({ organizer: req.user.id });
        if (!tournament) return res.json(null);
        const data = tournament.toObject();
        data.autoIncrementSlabs = getEffectiveAutoIncrementSlabs(tournament);
        res.json(data);
    } catch (error) { res.status(500).json({ message: "टूर्नामेंट लाने में दिक्कत!" }); }
});

router.post('/', async (req, res) => {
    try {
        const { 
            name, logoUrl, tournamentPoster, venue, teamBudget, minPlayersPerTeam, 
            bidButton1, bidButton2, bidButton3, biddingButtonsCount, customFields, upiQrUrl, upiId, paymentMessage,
            autoIncrementSlabs
        } = req.body;

        let validatedSlabs = undefined;
        if (autoIncrementSlabs !== undefined) {
            const validation = validateAutoIncrementSlabs(autoIncrementSlabs);
            if (!validation.isValid) {
                return res.status(400).json({ message: validation.message, code: 'INVALID_SLABS' });
            }
            validatedSlabs = validation.slabs;
        }

        let tournament = await Tournament.findOne({ organizer: req.user.id });
        
        if (tournament) {
            tournament.name = name;
            tournament.logoUrl = logoUrl;
            tournament.tournamentPoster = tournamentPoster || '';
            tournament.venue = venue;
            
            if (teamBudget) tournament.teamBudget = Number(teamBudget);
            if (minPlayersPerTeam) tournament.minPlayersPerTeam = Number(minPlayersPerTeam);
            
            if (bidButton1) tournament.bidButton1 = Number(bidButton1);
            if (bidButton2) tournament.bidButton2 = Number(bidButton2);
            if (bidButton3) tournament.bidButton3 = Number(bidButton3);
            if (biddingButtonsCount) tournament.biddingButtonsCount = Number(biddingButtonsCount);
            if (validatedSlabs !== undefined) tournament.autoIncrementSlabs = validatedSlabs;
            if (customFields) tournament.customFields = customFields; 
            
            tournament.upiQrUrl = upiQrUrl || '';
            tournament.upiId = upiId || '';
            tournament.paymentMessage = paymentMessage || '';

            await tournament.save();
            const resObj = tournament.toObject();
            resObj.autoIncrementSlabs = getEffectiveAutoIncrementSlabs(tournament);
            res.json({ message: "टूर्नामेंट अपडेट हो गया!", tournament: resObj });
        } else {
            const newTournament = new Tournament({ 
                name, logoUrl, tournamentPoster: tournamentPoster || '', venue, 
                teamBudget: teamBudget ? Number(teamBudget) : 50000000,
                minPlayersPerTeam: minPlayersPerTeam ? Number(minPlayersPerTeam) : 15,
                bidButton1: bidButton1 ? Number(bidButton1) : 500,
                bidButton2: bidButton2 ? Number(bidButton2) : 1000,
                bidButton3: bidButton3 ? Number(bidButton3) : 5000,
                biddingButtonsCount: biddingButtonsCount ? Number(biddingButtonsCount) : 3,
                autoIncrementSlabs: validatedSlabs,
                customFields: customFields || [], 
                upiQrUrl: upiQrUrl || '',
                upiId: upiId || '',
                paymentMessage: paymentMessage || '',
                organizer: req.user.id
            });
            await newTournament.save();
            const resObj = newTournament.toObject();
            resObj.autoIncrementSlabs = getEffectiveAutoIncrementSlabs(newTournament);
            res.json({ message: "नया टूर्नामेंट बन गया!", tournament: resObj });
        }
    } catch (error) { res.status(500).json({ message: "टूर्नामेंट सेव करने में दिक्कत!" }); }
});

router.post('/preview-slabs', async (req, res) => {
    try {
        const { teamBudget, slabs } = req.body;
        let purse = Number(teamBudget);
        if (!Number.isFinite(purse) || purse <= 0) {
            const tournament = await Tournament.findOne({ organizer: req.user.id });
            purse = Number(tournament?.teamBudget || 50000000);
        }

        let effectiveSlabs = slabs;
        if (effectiveSlabs !== undefined) {
            const validation = validateAutoIncrementSlabs(effectiveSlabs);
            if (!validation.isValid) {
                return res.status(400).json({ message: validation.message, code: 'INVALID_SLABS' });
            }
            effectiveSlabs = validation.slabs;
        }

        const previews = calculateSlabPreviews({ teamPurse: purse, slabs: effectiveSlabs });
        res.json({ teamPurse: purse, slabs: previews });
    } catch (error) {
        res.status(500).json({ message: "स्लैब प्रीव्यू तैयार करने में समस्या आई।" });
    }
});

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
    } catch (error) { res.status(500).json({ message: 'Update failed' }); }
});

module.exports = router;