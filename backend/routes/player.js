const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Player = require('../models/Player'); 
const Team = require('../models/Team'); 
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const fetchOrganizer = require('../middleware/fetchOrganizer');
const { getPolicyByPlanName, getEffectivePlanPolicy, resolveEffectivePlan } = require('../utils/planPolicy');
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
        const policy = await getEffectivePlanPolicy(organizerPlan);
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
        const policy = await getEffectivePlanPolicy(organizerPlan);
        if (!policy.canPublicRegistration) {
            return res.status(403).json({ message: 'यह फीचर आपके आयोजक प्लान में उपलब्ध नहीं है।' });
        }

        if (tournament.isRegistrationOpen === false) return res.status(403).json({ message: 'रजिस्ट्रेशन बंद है।' });

        if (policy.playerLimit !== -1) {
            const currentPlayerCount = await Player.countDocuments({ organizer: tournament.organizer });
            if (currentPlayerCount >= policy.playerLimit) {
                return res.status(403).json({
                    message: `आयोजक के ${organizerPlan} प्लान में अधिकतम ${policy.playerLimit} प्लेयर्स की अनुमति है। रजिस्ट्रेशन लिमिट पूरी हो चुकी है।`
                });
            }
        }

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
        if (req.user.role !== 'SuperAdmin' || req.user.isImpersonated) {
            const organizer = await User.findById(req.user.id).select('plan role').lean();
            const organizerPlan = resolveEffectivePlan(organizer);
            const policy = await getEffectivePlanPolicy(organizerPlan);

            if (policy.playerLimit !== -1) {
                const currentPlayerCount = await Player.countDocuments({ organizer: req.user.id });
                if (currentPlayerCount >= policy.playerLimit) {
                    return res.status(403).json({
                        message: `आपके ${organizerPlan} प्लान में अधिकतम ${policy.playerLimit} प्लेयर्स की अनुमति है। वर्तमान में आपके पास ${currentPlayerCount} प्लेयर्स हैं। नया प्लेयर जोड़ने के लिए कृपया प्लान अपग्रेड करें।`
                    });
                }
            }
        }

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
        if (player.approvalStatus !== 'Approved' || player.auctionStatus !== 'ReadyForAuction' || player.isIcon) {
            return res.status(409).json({ message: 'Player is not eligible to be marked unsold right now' });
        }
        player.auctionStatus = 'Unsold'; await player.save();
        res.json({ message: "खिलाड़ी अनसोल्ड हो गया!", player });
    } catch (error) { res.status(500).json({ message: "एरर!" }); }
});

router.put('/undo/:id', async (req, res) => {
    try {
        const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id });
        if (!player) return res.status(404).json({ message: "खिलाड़ी नहीं मिला" });

        const wasSold = (player.auctionStatus === 'Sold' || player.auctionStatus === 'Icon') &&
                        player.soldTo && player.soldTo !== 'Unsold';
        const refundAmount = Number(player.soldPrice) || 0;

        if (wasSold && refundAmount > 0) {
            await Team.findOneAndUpdate(
                { teamName: player.soldTo, organizer: req.user.id },
                { $inc: { remainingPurse: refundAmount } }
            );
        }

        player.auctionStatus = 'ReadyForAuction';
        player.soldTo = 'Unsold';
        player.soldPrice = 0;
        await player.save();

        res.json({ message: "Undo Successful!", player });
    } catch (error) {
        console.error("Undo player error:", error);
        res.status(500).json({ message: "एरर!" });
    }
});

router.post('/restore-unsold', async (req, res) => {
    try {
        const result = await Player.updateMany(
            {
                organizer: req.user.id,
                approvalStatus: 'Approved',
                auctionStatus: { $in: ['Unsold', 'Passed'] }
            },
            {
                $set: {
                    auctionStatus: 'ReadyForAuction',
                    soldTo: 'Unsold',
                    soldPrice: 0
                }
            }
        );
        res.json({ message: "सभी Unsold खिलाड़ी Round-2 ऑक्शन के लिए वापस आ गए हैं!", modifiedCount: result.modifiedCount });
    } catch (error) {
        console.error("Restore unsold error:", error);
        res.status(500).json({ message: "अनसोल्ड प्लेयर्स को वापस लाने में समस्या आई।" });
    }
});

router.post('/bring-all-back', async (req, res) => {
    try {
        const soldPlayers = await Player.find({
            organizer: req.user.id,
            approvalStatus: 'Approved',
            auctionStatus: { $in: ['Sold', 'Icon'] },
            soldTo: { $ne: 'Unsold' },
            soldPrice: { $gt: 0 }
        }).lean();

        const refundByTeam = {};
        for (const p of soldPlayers) {
            if (p.soldTo) {
                refundByTeam[p.soldTo] = (refundByTeam[p.soldTo] || 0) + (Number(p.soldPrice) || 0);
            }
        }

        const teamUpdates = Object.entries(refundByTeam).map(([teamName, amount]) => {
            return Team.findOneAndUpdate(
                { teamName, organizer: req.user.id },
                { $inc: { remainingPurse: amount } }
            );
        });
        await Promise.all(teamUpdates);

        const result = await Player.updateMany(
            {
                organizer: req.user.id,
                approvalStatus: 'Approved',
                auctionStatus: { $in: ['Sold', 'Unsold', 'Passed', 'Icon'] }
            },
            {
                $set: {
                    auctionStatus: 'ReadyForAuction',
                    soldTo: 'Unsold',
                    soldPrice: 0
                }
            }
        );

        res.json({ message: "सभी खिलाड़ी वापस ऑक्शन में शामिल कर लिए गए हैं!", modifiedCount: result.modifiedCount });
    } catch (error) {
        console.error("Bring all back error:", error);
        res.status(500).json({ message: "सभी प्लेयर्स को वापस लाने में समस्या आई।" });
    }
});

router.post('/reset-auction', async (req, res) => {
    try {
        const playerResult = await Player.updateMany(
            { organizer: req.user.id },
            {
                $set: {
                    auctionStatus: 'ReadyForAuction',
                    soldTo: 'Unsold',
                    soldPrice: 0
                }
            }
        );

        const teams = await Team.find({ organizer: req.user.id });
        await Promise.all(teams.map((t) => {
            return Team.findByIdAndUpdate(t._id, { remainingPurse: t.totalPurse });
        }));

        res.json({
            message: "ऑक्शन 100% सफलतापूर्वक रीसेट हो गया है!",
            playersReset: playerResult.modifiedCount,
            teamsReset: teams.length
        });
    } catch (error) {
        console.error("Reset auction error:", error);
        res.status(500).json({ message: "ऑक्शन रीसेट करने में समस्या आई।" });
    }
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
    const session = await mongoose.startSession();

    try {
        let responsePayload = null;

        await session.withTransaction(async () => {
            const player = await Player.findOne({ _id: req.params.id, organizer: req.user.id }).session(session);
            if (!player) throw new Error('PLAYER_NOT_FOUND');
            if (!player.isIcon) throw new Error('PLAYER_NOT_ICON');

            const refundAmount = Number(player.soldPrice);
            if (!Number.isFinite(refundAmount) || refundAmount < 0) throw new Error('INVALID_ICON_PRICE');

            const team = await Team.findOneAndUpdate(
                { teamName: player.soldTo, organizer: req.user.id },
                { $inc: { remainingPurse: refundAmount } },
                { new: true, session }
            );
            if (!team) throw new Error('TEAM_NOT_FOUND');

            player.isIcon = false;
            player.soldTo = 'Unsold';
            player.soldPrice = 0;
            player.auctionStatus = 'ReadyForAuction';
            await player.save({ session });

            responsePayload = {
                success: true,
                message: 'Icon removed successfully!',
                data: { player, team }
            };
        });

        return res.json(responsePayload);
    } catch (error) {
        if (error.message === 'PLAYER_NOT_FOUND') return res.status(404).json({ success: false, message: 'Player not found' });
        if (error.message === 'PLAYER_NOT_ICON') return res.status(409).json({ success: false, message: 'Player is not an icon player' });
        if (error.message === 'TEAM_NOT_FOUND') return res.status(404).json({ success: false, message: 'Team not found for this icon player' });
        if (error.message === 'INVALID_ICON_PRICE') return res.status(409).json({ success: false, message: 'Invalid icon price' });
        return res.status(500).json({ success: false, message: 'Error removing icon player' });
    } finally {
        session.endSession();
    }
});

module.exports = router;
