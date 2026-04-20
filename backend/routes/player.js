const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Player = require('../models/Player'); 
const Team = require('../models/Team'); 
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const fetchOrganizer = require('../middleware/fetchOrganizer');
const { getPolicyByPlanName, resolveEffectivePlan } = require('../utils/planPolicy');
const { getAuctionStateForOrganizer, decorateTeamsWithMaxBid } = require('../utils/maxBid');

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

const getTeamWithDynamicMaxBid = async ({ organizerId, teamName, currentBasePrice, session = null }) => {
    const teamDoc = await Team.findOne({ teamName, organizer: organizerId }).session(session).lean();
    if (!teamDoc) return null;

    const auctionState = await getAuctionStateForOrganizer({ organizerId, session });
    const [decoratedTeam] = decorateTeamsWithMaxBid({
        teams: [teamDoc],
        auctionState,
        currentBasePrice
    });

    return decoratedTeam;
};


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


router.post('/validate-bid', async (req, res) => {
    try {
        const { teamName, bidAmount, playerId } = req.body;
        if (!teamName) return res.status(400).json({ message: 'Team is required' });

        const numericBidAmount = Number(bidAmount);
        if (!Number.isFinite(numericBidAmount) || numericBidAmount <= 0) {
            return res.status(400).json({ message: 'Invalid bid amount' });
        }

        let currentBasePrice = 0;
        if (playerId) {
            const player = await Player.findOne({ _id: playerId, organizer: req.user.id }).select('basePrice').lean();
            if (!player) return res.status(404).json({ message: 'Player not found' });
            currentBasePrice = Number(player.basePrice || 0);
        }

        const team = await getTeamWithDynamicMaxBid({
            organizerId: req.user.id,
            teamName,
            currentBasePrice
        });

        if (!team) return res.status(404).json({ message: 'Team not found' });

        if (numericBidAmount > team.maxBid) {
            return res.status(400).json({
                message: `Bid blocked. Max allowed bid for ${teamName} is ₹${team.maxBid.toLocaleString()}`,
                maxBid: team.maxBid,
                remainingRequiredPlayers: team.remainingRequiredPlayers,
                remainingPurse: team.remainingPurse
            });
        }

        return res.json({
            ok: true,
            maxBid: team.maxBid,
            remainingRequiredPlayers: team.remainingRequiredPlayers,
            remainingPurse: team.remainingPurse
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error validating bid' });
    }
});

router.put('/sell/:id', async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { teamName, soldPrice } = req.body;
        const numericSoldPrice = Number(soldPrice);

        if (!Number.isFinite(numericSoldPrice) || numericSoldPrice <= 0) {
            return res.status(400).json({ message: 'Invalid sold price' });
        }

        let responsePayload = null;

        await session.withTransaction(async () => {
            const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id }).session(session);
            if (!player) throw new Error('PLAYER_NOT_FOUND');

            if (player.approvalStatus !== 'Approved' || player.auctionStatus !== 'ReadyForAuction' || player.isIcon) {
                throw new Error('PLAYER_NOT_ELIGIBLE');
            }

            const teamWithMaxBid = await getTeamWithDynamicMaxBid({
                organizerId: req.user.id,
                teamName,
                currentBasePrice: player.basePrice,
                session
            });
            if (!teamWithMaxBid) throw new Error('TEAM_NOT_FOUND');

            if (numericSoldPrice > teamWithMaxBid.maxBid) {
                const err = new Error('MAX_BID_BLOCK');
                err.meta = {
                    message: `Bid blocked. Max allowed bid for ${teamName} is ₹${teamWithMaxBid.maxBid.toLocaleString()}`,
                    maxBid: teamWithMaxBid.maxBid,
                    remainingRequiredPlayers: teamWithMaxBid.remainingRequiredPlayers
                };
                throw err;
            }

            const teamUpdate = await Team.findOneAndUpdate(
                {
                    teamName,
                    organizer: req.user.id,
                    remainingPurse: { $gte: numericSoldPrice }
                },
                { $inc: { remainingPurse: -numericSoldPrice } },
                { new: true, session }
            );

            if (!teamUpdate) throw new Error('PURSE_CONFLICT');

            player.soldTo = teamName;
            player.soldPrice = numericSoldPrice;
            player.auctionStatus = 'Sold';
            await player.save({ session });

            responsePayload = { message: 'खिलाड़ी बिक गया!', player };
        });

        return res.json(responsePayload);
    } catch (error) {
        if (error.message === 'PLAYER_NOT_FOUND') return res.status(404).json({ message: 'Player not found' });
        if (error.message === 'TEAM_NOT_FOUND') return res.status(404).json({ message: 'Team not found' });
        if (error.message === 'PLAYER_NOT_ELIGIBLE') return res.status(409).json({ message: 'Player is not eligible to be sold right now' });
        if (error.message === 'PURSE_CONFLICT') return res.status(409).json({ message: 'Bid conflict detected. Team purse changed, please retry.' });
        if (error.message === 'MAX_BID_BLOCK') return res.status(400).json(error.meta);
        return res.status(500).json({ message: 'एरर!' });
    } finally {
        session.endSession();
    }
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
    const session = await mongoose.startSession();

    try {
        const { teamName, iconPrice } = req.body;
        const numericIconPrice = Number(iconPrice);

        if (!Number.isFinite(numericIconPrice) || numericIconPrice < 0) {
            return res.status(400).json({ message: 'Invalid icon price' });
        }

        let responsePayload = null;

        await session.withTransaction(async () => {
            const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id }).session(session);
            if (!player) throw new Error('PLAYER_NOT_FOUND');
            if (player.auctionStatus === 'Sold' || player.isIcon) throw new Error('PLAYER_NOT_ELIGIBLE');

            const teamWithMaxBid = await getTeamWithDynamicMaxBid({
                organizerId: req.user.id,
                teamName,
                currentBasePrice: player.basePrice,
                session
            });
            if (!teamWithMaxBid) throw new Error('TEAM_NOT_FOUND');

            if (numericIconPrice > teamWithMaxBid.maxBid) {
                const err = new Error('MAX_BID_BLOCK');
                err.meta = {
                    message: `Icon price blocked. Max allowed bid for ${teamName} is ₹${teamWithMaxBid.maxBid.toLocaleString()}`,
                    maxBid: teamWithMaxBid.maxBid,
                    remainingRequiredPlayers: teamWithMaxBid.remainingRequiredPlayers
                };
                throw err;
            }

            const teamUpdate = await Team.findOneAndUpdate(
                {
                    teamName,
                    organizer: req.user.id,
                    remainingPurse: { $gte: numericIconPrice }
                },
                { $inc: { remainingPurse: -numericIconPrice } },
                { new: true, session }
            );

            if (!teamUpdate) throw new Error('PURSE_CONFLICT');

            player.soldTo = teamName;
            player.soldPrice = numericIconPrice;
            player.auctionStatus = 'Icon';
            player.isIcon = true;
            player.approvalStatus = 'Approved';
            await player.save({ session });

            responsePayload = { message: 'Icon Assigned!', player };
        });

        return res.json(responsePayload);
    } catch (error) {
        if (error.message === 'PLAYER_NOT_FOUND') return res.status(404).json({ message: 'Player not found' });
        if (error.message === 'TEAM_NOT_FOUND') return res.status(404).json({ message: 'Team not found' });
        if (error.message === 'PLAYER_NOT_ELIGIBLE') return res.status(409).json({ message: 'Player already sold/icon' });
        if (error.message === 'PURSE_CONFLICT') return res.status(409).json({ message: 'Icon assignment conflict detected. Team purse changed, please retry.' });
        if (error.message === 'MAX_BID_BLOCK') return res.status(400).json(error.meta);
        return res.status(500).json({ message: 'Error' });
    } finally {
        session.endSession();
    }
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