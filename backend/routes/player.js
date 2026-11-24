const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Player = require('../models/Player'); 
const Team = require('../models/Team'); 
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const fetchOrganizer = require('../middleware/fetchOrganizer');
const fetchTournamentScope = require('../middleware/fetchTournamentScope');
const { getPolicyByPlanName, getEffectivePlanPolicy, resolveEffectivePlan } = require('../utils/planPolicy');
const { getAuctionStateForOrganizer, decorateTeamsWithMaxBid } = require('../utils/maxBid');
const { mergeWithTournamentScope } = require('../utils/tournamentScope');
const { setBiddingActive } = require('../utils/biddingState');
const AuctionState = require('../models/AuctionState');
const {
    getTeamWithDynamicMaxBid,
    sellPlayer,
    unsoldPlayer,
    undoPlayerAction,
    restoreUnsoldPlayers,
    bringAllPlayersBack,
    resetAuction
} = require('../services/playerAuctionService');

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
router.use(fetchTournamentScope);

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
        if (req.body.tournament && String(req.body.tournament) !== String(req.tournamentScope.tournamentId)) {
            return res.status(403).json({ message: 'Players must belong to the active organizer tournament.' });
        }
        const newPlayer = new Player({ 
            name, fatherName, age, mobile, city, role, category, basePrice, photoUrl, customData: customData || {},
            approvalStatus: 'Approved',
            auctionStatus: 'ReadyForAuction',
            source: 'Organizer',
            soldTo: null,
            organizer: req.user.id, tournament: req.tournamentScope.tournamentId
        });
        const savedPlayer = await newPlayer.save();
        res.json(savedPlayer);
    } catch (error) { res.status(500).json({ message: "खिलाड़ी सेव करने में खराबी आ गई है!" }); }
});

router.post('/bulk', async (req, res) => {
    const session = await mongoose.startSession();
    try {
        let responsePayload = null;
        await session.withTransaction(async () => {
            if (req.user.role !== 'SuperAdmin' || req.user.isImpersonated) {
                const organizer = await User.findById(req.user.id).select('plan role').session(session).lean();
                const organizerPlan = resolveEffectivePlan(organizer);
                const policy = await getEffectivePlanPolicy(organizerPlan);

                if (policy.playerLimit !== -1) {
                    const currentPlayerCount = await Player.countDocuments({ organizer: req.user.id }).session(session);
                    const incomingCount = req.body.players?.length || 0;
                    if (currentPlayerCount + incomingCount > policy.playerLimit) {
                        const err = new Error('LIMIT_REACHED');
                        err.meta = {
                            message: `आपके ${organizerPlan} प्लान में अधिकतम ${policy.playerLimit} प्लेयर्स की अनुमति है। वर्तमान में आपके पास ${currentPlayerCount} प्लेयर्स हैं। आप ${incomingCount} नए प्लेयर्स जोड़ रहे हैं। कृपया प्लान अपग्रेड करें या प्लेयर्स कम करें।`
                        };
                        throw err;
                    }
                }
            }

            if (!req.body.players || !Array.isArray(req.body.players) || req.body.players.length === 0) {
                const err = new Error('INVALID_DATA');
                err.meta = { message: 'No players provided for bulk upload.' };
                throw err;
            }

            if (req.body.tournament && String(req.body.tournament) !== String(req.tournamentScope.tournamentId)) {
                const err = new Error('TOURNAMENT_SCOPE_MISMATCH');
                err.meta = { message: 'Players must belong to the active organizer tournament.' };
                throw err;
            }

            const playersToInsert = req.body.players.map(p => ({
                name: p.name,
                fatherName: p.fatherName,
                age: p.age,
                mobile: p.mobile,
                city: p.city,
                role: p.role,
                category: p.category,
                basePrice: p.basePrice || 0,
                photoUrl: p.photoUrl || 'https://via.placeholder.com/150',
                customData: p.customData || {},
                approvalStatus: 'Approved',
                auctionStatus: 'ReadyForAuction',
                source: 'Organizer',
                soldTo: null,
                organizer: req.user.id,
                tournament: req.tournamentScope.tournamentId
            }));

            const insertedPlayers = await Player.insertMany(playersToInsert, { session });
            responsePayload = { 
                message: `${insertedPlayers.length} प्लेयर्स सफलतापूर्वक जोड़े गए!`, 
                insertedCount: insertedPlayers.length 
            };
        });
        
        return res.json(responsePayload);
    } catch (error) {
        console.error("Bulk upload error:", error);
        if (error.message === 'LIMIT_REACHED' || error.message === 'INVALID_DATA' || error.message === 'TOURNAMENT_SCOPE_MISMATCH') {
            return res.status(400).json(error.meta);
        }
        res.status(500).json({ message: "प्लेयर्स सेव करने में खराबी आ गई है!" });
    } finally {
        session.endSession();
    }
});

router.get('/', async (req, res) => {
    try {
        const players = await Player.find(mergeWithTournamentScope({ organizer: req.user.id }, req.tournamentScope)).populate('soldTo', 'teamName shortName logoUrl logo').lean();
        res.json(players);
    } catch (error) { res.status(500).json({ message: "एरर!" }); }
});

router.post('/validate-bid', async (req, res) => {
    try {
        const { teamId, teamName, bidAmount, playerId } = req.body;
        if (!teamId && !teamName) return res.status(400).json({ message: 'Team is required' });

        const numericBidAmount = Number(bidAmount);
        if (!Number.isFinite(numericBidAmount) || numericBidAmount <= 0) {
            return res.status(400).json({ message: 'Invalid bid amount' });
        }

        let currentBasePrice = 0;
        if (playerId) {
            const player = await Player.findOne(mergeWithTournamentScope({ _id: playerId, organizer: req.user.id }, req.tournamentScope)).select('basePrice').lean();
            if (!player) return res.status(404).json({ message: 'Player not found' });
            currentBasePrice = Number(player.basePrice || 0);
        }

        const team = await getTeamWithDynamicMaxBid({
            organizerId: req.user.id,
            tournamentScope: req.tournamentScope,
            teamId,
            teamName,
            currentBasePrice
        });

        if (!team) return res.status(404).json({ message: 'Team not found' });

        if (numericBidAmount > team.maxBid) {
            const displayName = team.teamName || teamName || 'Team';
            return res.status(400).json({
                message: `Bid blocked. Max allowed bid for ${displayName} is ₹${team.maxBid.toLocaleString()}`,
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
    try {
        const { teamId, teamName, soldPrice } = req.body;
        const responsePayload = await sellPlayer({
            organizerId: req.user.id,
            tournamentScope: req.tournamentScope,
            playerId: req.params.id,
            teamId,
            teamName,
            soldPrice
        });

        setBiddingActive(req.user.id, false);
        const io = req.app.get('io');
        if (io) {
            io.to(`organizer:${req.user.id}`).emit('biddingStateUpdate', {
                biddingActive: false,
                organizerId: req.user.id,
                tournamentId: req.tournamentScope?.tournamentId
            });
            if (req.tournamentScope?.tournamentId) {
                io.to(`tournament:${req.tournamentScope.tournamentId}`).emit('biddingStateUpdate', {
                    biddingActive: false,
                    organizerId: req.user.id,
                    tournamentId: req.tournamentScope.tournamentId
                });
            }
        }

        return res.json(responsePayload);
    } catch (error) {
        if (error.statusCode === 400 && error.publicMessage) return res.status(400).json({ message: error.publicMessage });
        if (error.message === 'PLAYER_NOT_FOUND') return res.status(404).json({ message: 'Player not found' });
        if (error.message === 'TEAM_NOT_FOUND') return res.status(404).json({ message: 'Team not found' });
        if (error.message === 'PLAYER_NOT_ELIGIBLE') return res.status(409).json({ message: 'Player is not eligible to be sold right now' });
        if (['PURSE_CONFLICT', 'AUCTION_STATE_CONFLICT', 'NO_LEADING_BID', 'LEADING_TEAM_MISMATCH', 'SOLD_PRICE_MISMATCH'].includes(error.message)) return res.status(409).json({ message: 'Auction state changed, please refresh and retry.' });
        if (error.message === 'MAX_BID_BLOCK') return res.status(400).json(error.meta);
        return res.status(500).json({ message: 'एरर!' });
    }
});

router.put('/unsold/:id', async (req, res) => {
    try {
        const responsePayload = await unsoldPlayer({
            organizerId: req.user.id,
            tournamentScope: req.tournamentScope,
            playerId: req.params.id
        });

        setBiddingActive(req.user.id, false);
        const io = req.app.get('io');
        if (io) {
            io.to(`organizer:${req.user.id}`).emit('biddingStateUpdate', {
                biddingActive: false,
                organizerId: req.user.id,
                tournamentId: req.tournamentScope?.tournamentId
            });
            if (req.tournamentScope?.tournamentId) {
                io.to(`tournament:${req.tournamentScope.tournamentId}`).emit('biddingStateUpdate', {
                    biddingActive: false,
                    organizerId: req.user.id,
                    tournamentId: req.tournamentScope.tournamentId
                });
            }
        }

        res.json(responsePayload);
    } catch (error) {
        if (error.message === 'PLAYER_NOT_FOUND') return res.status(404).json({ message: 'Player not found' });
        if (error.message === 'PLAYER_NOT_ELIGIBLE' || error.message === 'AUCTION_STATE_CONFLICT') return res.status(409).json({ message: 'Auction state changed, please refresh and retry.' });
        res.status(500).json({ message: "एरर!" });
    }
});

router.put('/undo/:id', async (req, res) => {
    try {
        const responsePayload = await undoPlayerAction({
            organizerId: req.user.id,
            tournamentScope: req.tournamentScope,
            playerId: req.params.id
        });
        res.json(responsePayload);
    } catch (error) {
        if (error.statusCode && error.publicMessage) return res.status(error.statusCode).json({ message: error.publicMessage });
        if (error.message === 'PLAYER_NOT_FOUND') return res.status(404).json({ message: 'खिलाड़ी नहीं मिला' });
        if (error.message === 'ICON_PLAYER_RESTRICTED') return res.status(400).json({ message: 'Icon players must be managed exclusively from the Player Management tab.' });
        console.error("Undo player error:", error);
        res.status(500).json({ message: "एरर!" });
    }
});

router.post('/restore-unsold', async (req, res) => {
    try {
        const responsePayload = await restoreUnsoldPlayers({
            organizerId: req.user.id,
            tournamentScope: req.tournamentScope
        });
        res.json(responsePayload);
    } catch (error) {
        console.error("Restore unsold error:", error);
        res.status(500).json({ message: "अनसोल्ड प्लेयर्स को वापस लाने में समस्या आई।" });
    }
});

router.post('/bring-all-back', async (req, res) => {
    try {
        const responsePayload = await bringAllPlayersBack({
            organizerId: req.user.id,
            tournamentScope: req.tournamentScope
        });
        res.json(responsePayload);
    } catch (error) {
        console.error("Bring all back error:", error);
        res.status(500).json({ message: "सभी प्लेयर्स को वापस लाने में समस्या आई।" });
    }
});

router.post('/reset-auction', async (req, res) => {
    try {
        const responsePayload = await resetAuction({
            organizerId: req.user.id,
            tournamentScope: req.tournamentScope
        });
        res.json(responsePayload);
    } catch (error) {
        console.error("Reset auction error:", error);
        res.status(500).json({ message: "ऑक्शन रीसेट करने में समस्या आई।" });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await Player.findOneAndDelete(mergeWithTournamentScope({ _id: req.params.id, organizer: req.user.id }, req.tournamentScope));
        res.json({ message: "डिलीट हो गया!" });
    } catch (error) { res.status(500).json({ message: "एरर!" }); }
});

router.put('/approval/:id', async (req, res) => {
    try {
        const player = await Player.findOne(mergeWithTournamentScope({ _id: req.params.id, organizer: req.user.id }, req.tournamentScope));
        if (!player) return res.status(404).json({ message: "Player not found" });
        player.approvalStatus = req.body.status;
        if (req.body.status === 'Approved') {
            player.auctionStatus = 'ReadyForAuction';
            player.soldTo = null;
            player.soldPrice = 0;
        }
        await player.save();
        res.json({ message: "Status Updated", player });
    } catch (error) { res.status(500).json({ message: "Error" }); }
});

router.put('/update-price/:id', async (req, res) => {
    try {
        const player = await Player.findOne(mergeWithTournamentScope({ _id: req.params.id, organizer: req.user.id }, req.tournamentScope));
        if (!player) return res.status(404).json({ message: "Player not found" });
        const basePrice = Number(req.body.basePrice);
        if (!Number.isFinite(basePrice) || basePrice < 0) return res.status(400).json({ message: "Invalid base price" });
        player.basePrice = basePrice; await player.save();
        res.json({ message: "Price Updated", player });
    } catch (error) { res.status(500).json({ message: "Error" }); }
});

router.put('/update-photo/:id', async (req, res) => {
    try {
        const player = await Player.findOne(mergeWithTournamentScope({ _id: req.params.id, organizer: req.user.id }, req.tournamentScope));
        if (!player) return res.status(404).json({ success: false, message: "Player not found" });
        const photoUrl = req.body.photoUrl;
        if (!photoUrl || typeof photoUrl !== 'string') return res.status(400).json({ success: false, message: "Invalid photo URL" });
        player.photoUrl = photoUrl;
        await player.save();
        res.json({ success: true, message: "Photo Updated", player });
    } catch (error) { res.status(500).json({ success: false, message: "Error updating photo" }); }
});

router.put('/update-category/:id', async (req, res) => {
    try {
        const player = await Player.findOne(mergeWithTournamentScope({ _id: req.params.id, organizer: req.user.id }, req.tournamentScope));
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
        const { teamId, teamName, iconPrice } = req.body;
        const numericIconPrice = Number(iconPrice);

        if (!Number.isFinite(numericIconPrice) || numericIconPrice < 0) {
            return res.status(400).json({ message: 'Invalid icon price' });
        }

        let responsePayload = null;

        await session.withTransaction(async () => {
            const player = await Player.findOne(mergeWithTournamentScope({ _id: req.params.id, organizer: req.user.id }, req.tournamentScope)).session(session);
            if (!player) throw new Error('PLAYER_NOT_FOUND');
            if (player.auctionStatus === 'Sold' || player.isIcon) throw new Error('PLAYER_NOT_ELIGIBLE');

            const teamWithMaxBid = await getTeamWithDynamicMaxBid({
                organizerId: req.user.id,
                tournamentScope: req.tournamentScope,
                teamId,
                teamName,
                currentBasePrice: player.basePrice,
                session
            });
            if (!teamWithMaxBid) throw new Error('TEAM_NOT_FOUND');

            if (numericIconPrice > teamWithMaxBid.maxBid) {
                const displayName = teamWithMaxBid.teamName || teamName || 'Team';
                const err = new Error('MAX_BID_BLOCK');
                err.meta = {
                    message: `Icon price blocked. Max allowed bid for ${displayName} is ₹${teamWithMaxBid.maxBid.toLocaleString()}`,
                    maxBid: teamWithMaxBid.maxBid,
                    remainingRequiredPlayers: teamWithMaxBid.remainingRequiredPlayers
                };
                throw err;
            }

            const teamUpdate = await Team.findOneAndUpdate(
                mergeWithTournamentScope({
                    _id: teamWithMaxBid._id,
                    organizer: req.user.id,
                    remainingPurse: { $gte: numericIconPrice }
                }, req.tournamentScope),
                { $inc: { remainingPurse: -numericIconPrice } },
                { new: true, session }
            );

            if (!teamUpdate) throw new Error('PURSE_CONFLICT');

            player.soldTo = teamWithMaxBid._id;
            player.soldPrice = numericIconPrice;
            player.auctionStatus = 'Icon';
            player.isIcon = true;
            player.approvalStatus = 'Approved';
            await player.save({ session });

            responsePayload = { message: 'Icon Assigned!', player, team: teamUpdate };
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
            const player = await Player.findOne(mergeWithTournamentScope({ _id: req.params.id, organizer: req.user.id }, req.tournamentScope)).session(session);
            if (!player) throw new Error('PLAYER_NOT_FOUND');
            if (!player.isIcon) throw new Error('PLAYER_NOT_ICON');

            const refundAmount = Number(player.soldPrice);
            let team = null;
            if (player.soldTo && refundAmount > 0) {
                const teamQuery = mongoose.Types.ObjectId.isValid(player.soldTo)
                    ? { _id: player.soldTo, organizer: req.user.id }
                    : { teamName: player.soldTo, organizer: req.user.id };

                team = await Team.findOneAndUpdate(
                    mergeWithTournamentScope(teamQuery, req.tournamentScope),
                    { $inc: { remainingPurse: refundAmount } },
                    { new: true, session }
                );
            }

            player.isIcon = false;
            player.soldTo = null;
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
