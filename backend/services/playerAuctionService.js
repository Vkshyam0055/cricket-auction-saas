const mongoose = require('mongoose');
const Player = require('../models/Player');
const Team = require('../models/Team');
const AuctionState = require('../models/AuctionState');
const { getAuctionStateForOrganizer, decorateTeamsWithMaxBid } = require('../utils/maxBid');
const { mergeWithTournamentScope } = require('../utils/tournamentScope');

const getTeamWithDynamicMaxBid = async ({ organizerId, tournamentScope, teamId, teamName, currentBasePrice, session = null }) => {
    let teamDoc = null;
    if (teamId && mongoose.Types.ObjectId.isValid(teamId)) {
        teamDoc = await Team.findOne(mergeWithTournamentScope({ _id: teamId, organizer: organizerId }, tournamentScope)).session(session).lean();
    }
    if (!teamDoc && teamName) {
        teamDoc = await Team.findOne(mergeWithTournamentScope({ teamName, organizer: organizerId }, tournamentScope)).session(session).lean();
    }
    if (!teamDoc) return null;

    const auctionState = await getAuctionStateForOrganizer({ organizerId, tournamentScope, session });
    const [decoratedTeam] = decorateTeamsWithMaxBid({
        teams: [teamDoc],
        auctionState,
        currentBasePrice
    });

    return decoratedTeam;
};

const sellPlayer = async ({ organizerId, tournamentScope, playerId, teamId, teamName, soldPrice }) => {
    const session = await mongoose.startSession();
    try {
        const numericSoldPrice = Number(soldPrice);
        if (!Number.isFinite(numericSoldPrice) || numericSoldPrice < 0) {
            const err = new Error('INVALID_SOLD_PRICE');
            err.statusCode = 400;
            err.publicMessage = 'Invalid sold price';
            throw err;
        }

        let responsePayload = null;
        await session.withTransaction(async () => {
            const player = await Player.findOne(mergeWithTournamentScope({ _id: playerId, organizer: organizerId }, tournamentScope)).session(session);
            if (!player) throw new Error('PLAYER_NOT_FOUND');

            if (player.approvalStatus !== 'Approved' || player.auctionStatus !== 'ReadyForAuction' || player.isIcon) {
                throw new Error('PLAYER_NOT_ELIGIBLE');
            }

            const activeState = await AuctionState.findOne({
                organizer: organizerId,
                tournament: tournamentScope.tournamentId,
                activePlayer: player._id,
                status: 'bidding',
                isAwaitingTeam: { $ne: true },
                highestBidder: { $ne: null }
            }).session(session).lean();
            if (!activeState) throw new Error('NO_LEADING_BID');

            const authoritativePrice = Number(activeState.currentBid);
            if (!Number.isFinite(authoritativePrice) || numericSoldPrice !== authoritativePrice) {
                throw new Error('SOLD_PRICE_MISMATCH');
            }

            if (teamId && String(teamId) !== String(activeState.highestBidder)) {
                throw new Error('LEADING_TEAM_MISMATCH');
            }

            const teamWithMaxBid = await getTeamWithDynamicMaxBid({
                organizerId,
                tournamentScope,
                teamId: activeState.highestBidder,
                teamName: null,
                currentBasePrice: player.basePrice,
                session
            });
            if (!teamWithMaxBid) throw new Error('TEAM_NOT_FOUND');

            if (authoritativePrice > teamWithMaxBid.maxBid) {
                const displayName = teamWithMaxBid.teamName || teamName || 'Team';
                const err = new Error('MAX_BID_BLOCK');
                err.meta = {
                    message: `Bid blocked. Max allowed bid for ${displayName} is ₹${teamWithMaxBid.maxBid.toLocaleString()}`,
                    maxBid: teamWithMaxBid.maxBid,
                    remainingRequiredPlayers: teamWithMaxBid.remainingRequiredPlayers
                };
                throw err;
            }

            const teamUpdate = await Team.findOneAndUpdate(
                mergeWithTournamentScope({
                    _id: teamWithMaxBid._id,
                    organizer: organizerId,
                    remainingPurse: { $gte: authoritativePrice }
                }, tournamentScope),
                { $inc: { remainingPurse: -authoritativePrice } },
                { new: true, session }
            );

            if (!teamUpdate) throw new Error('PURSE_CONFLICT');

            player.soldTo = teamWithMaxBid._id;
            player.soldPrice = authoritativePrice;
            player.auctionStatus = 'Sold';
            await player.save({ session });

            const finalizedState = await AuctionState.findOneAndUpdate(
                {
                    organizer: organizerId,
                    tournament: tournamentScope.tournamentId,
                    activePlayer: player._id,
                    status: 'bidding',
                    highestBidder: teamWithMaxBid._id,
                    currentBid: authoritativePrice,
                    isAwaitingTeam: { $ne: true }
                },
                {
                    $set: {
                        status: 'sold',
                        highestBidder: teamWithMaxBid._id,
                        currentBid: authoritativePrice,
                        isAwaitingTeam: false
                    },
                    $inc: { version: 1 }
                },
                { new: true, session }
            );
            if (!finalizedState) throw new Error('AUCTION_STATE_CONFLICT');

            responsePayload = {
                message: 'खिलाड़ी बिक गया!',
                player,
                team: teamUpdate,
                state: finalizedState?.toObject ? finalizedState.toObject() : finalizedState
            };
        });

        return responsePayload;
    } finally {
        session.endSession();
    }
};

const unsoldPlayer = async ({ organizerId, tournamentScope, playerId }) => {
    const session = await mongoose.startSession();
    try {
        let responsePayload;
        await session.withTransaction(async () => {
            const player = await Player.findOne(mergeWithTournamentScope({ _id: playerId, organizer: organizerId }, tournamentScope)).session(session);
            if (!player) throw new Error('PLAYER_NOT_FOUND');
            if (player.approvalStatus !== 'Approved' || player.auctionStatus !== 'ReadyForAuction' || player.isIcon) throw new Error('PLAYER_NOT_ELIGIBLE');

            const finalizedState = await AuctionState.findOneAndUpdate(
                { organizer: organizerId, tournament: tournamentScope.tournamentId, activePlayer: player._id, highestBidder: null, status: 'bidding' },
                { $set: { status: 'unsold', isAwaitingTeam: false }, $inc: { version: 1 } },
                { new: true, session }
            );
            if (!finalizedState) throw new Error('AUCTION_STATE_CONFLICT');

            player.auctionStatus = 'Unsold';
            player.soldTo = null;
            player.soldPrice = 0;
            await player.save({ session });
            responsePayload = {
                message: "खिलाड़ी अनसोल्ड हो गया!",
                player,
                state: finalizedState?.toObject ? finalizedState.toObject() : finalizedState
            };
        });

        return responsePayload;
    } finally {
        session.endSession();
    }
};

const undoPlayerAction = async ({ organizerId, tournamentScope, playerId }) => {
    const session = await mongoose.startSession();
    try {
        let responsePayload = null;
        await session.withTransaction(async () => {
            const player = await Player.findOne(
                mergeWithTournamentScope({ _id: playerId, organizer: organizerId }, tournamentScope)
            ).session(session);

            if (!player) {
                const err = new Error('PLAYER_NOT_FOUND');
                err.statusCode = 404;
                err.publicMessage = "खिलाड़ी नहीं मिला";
                throw err;
            }

            if (player.isIcon || player.auctionStatus === 'Icon') {
                const err = new Error('ICON_PLAYER_RESTRICTED');
                err.statusCode = 400;
                err.publicMessage = "Icon players must be managed exclusively from the Player Management tab.";
                throw err;
            }

            const wasSold = (player.auctionStatus === 'Sold' || player.auctionStatus === 'Icon') &&
                            Boolean(player.soldTo) && player.soldTo !== 'Unsold';
            const refundAmount = Number(player.soldPrice) || 0;

            if (wasSold && refundAmount > 0) {
                const teamQuery = mongoose.Types.ObjectId.isValid(player.soldTo)
                    ? { _id: player.soldTo, organizer: organizerId }
                    : { teamName: player.soldTo, organizer: organizerId };

                await Team.findOneAndUpdate(
                    mergeWithTournamentScope(teamQuery, tournamentScope),
                    { $inc: { remainingPurse: refundAmount } },
                    { session }
                );
            }

            player.auctionStatus = 'ReadyForAuction';
            player.soldTo = null;
            player.soldPrice = 0;
            await player.save({ session });

            const updatedState = await AuctionState.findOneAndUpdate(
                { organizer: organizerId, tournament: tournamentScope.tournamentId, activePlayer: player._id },
                { $set: { status: 'idle', activePlayer: null, currentBid: 0, highestBidder: null, isAwaitingTeam: false }, $inc: { version: 1 } },
                { new: true, session }
            );

            responsePayload = {
                message: "Undo Successful!",
                player,
                state: updatedState ? (updatedState.toObject ? updatedState.toObject() : updatedState) : null
            };
        });

        return responsePayload;
    } finally {
        session.endSession();
    }
};

const restoreUnsoldPlayers = async ({ organizerId, tournamentScope }) => {
    const result = await Player.updateMany(
        mergeWithTournamentScope({
            organizer: organizerId,
            approvalStatus: 'Approved',
            auctionStatus: { $in: ['Unsold', 'Passed'] }
        }, tournamentScope),
        {
            $set: {
                auctionStatus: 'ReadyForAuction',
                soldTo: null,
                soldPrice: 0
            }
        }
    );
    return { message: "सभी Unsold खिलाड़ी Round-2 ऑक्शन के लिए वापस आ गए हैं!", modifiedCount: result.modifiedCount };
};

const bringAllPlayersBack = async ({ organizerId, tournamentScope }) => {
    const soldPlayers = await Player.find(mergeWithTournamentScope({
        organizer: organizerId,
        approvalStatus: 'Approved',
        auctionStatus: { $in: ['Sold'] },
        soldTo: { $ne: null },
        soldPrice: { $gt: 0 }
    }, tournamentScope)).lean();

    const refundByTeam = {};
    for (const p of soldPlayers) {
        if (p.soldTo && p.soldTo !== 'Unsold') {
            const teamKey = String(p.soldTo);
            refundByTeam[teamKey] = (refundByTeam[teamKey] || 0) + (Number(p.soldPrice) || 0);
        }
    }

    const teamUpdates = Object.entries(refundByTeam).map(([teamKey, amount]) => {
        const query = mongoose.Types.ObjectId.isValid(teamKey)
            ? { _id: teamKey, organizer: organizerId }
            : { teamName: teamKey, organizer: organizerId };

        return Team.findOneAndUpdate(
            mergeWithTournamentScope(query, tournamentScope),
            { $inc: { remainingPurse: amount } }
        );
    });
    await Promise.all(teamUpdates);

    const result = await Player.updateMany(
        mergeWithTournamentScope({
            organizer: organizerId,
            approvalStatus: 'Approved',
            auctionStatus: { $in: ['Sold', 'Unsold', 'Passed'] }
        }, tournamentScope),
        {
            $set: {
                auctionStatus: 'ReadyForAuction',
                soldTo: null,
                soldPrice: 0
            }
        }
    );

    return { message: "सभी खिलाड़ी वापस ऑक्शन में शामिल कर लिए गए हैं!", modifiedCount: result.modifiedCount };
};

const resetAuction = async ({ organizerId, tournamentScope }) => {
    const playerResult = await Player.updateMany(
        mergeWithTournamentScope({ organizer: organizerId, isIcon: { $ne: true } }, tournamentScope),
        {
            $set: {
                auctionStatus: 'ReadyForAuction',
                soldTo: null,
                soldPrice: 0
            }
        }
    );

    const teams = await Team.find(mergeWithTournamentScope({ organizer: organizerId }, tournamentScope));
    const iconPlayers = await Player.find(mergeWithTournamentScope({ organizer: organizerId, isIcon: true, soldTo: { $ne: null } }, tournamentScope));

    await Promise.all(teams.map((t) => {
        const teamIcons = iconPlayers.filter(p => String(p.soldTo) === String(t._id) || String(p.soldTo) === t.teamName);
        const iconSpent = teamIcons.reduce((sum, p) => sum + (Number(p.soldPrice) || 0), 0);
        return Team.findOneAndUpdate(
            mergeWithTournamentScope({ _id: t._id, organizer: organizerId }, tournamentScope),
            { remainingPurse: t.totalPurse - iconSpent }
        );
    }));

    const resetState = await AuctionState.findOneAndUpdate(
        { organizer: organizerId, tournament: tournamentScope.tournamentId },
        { $set: { status: 'idle', activePlayer: null, currentBid: 0, highestBidder: null, isAwaitingTeam: false }, $inc: { version: 1 } },
        { new: true }
    );

    return {
        message: "ऑक्शन 100% सफलतापूर्वक रीसेट हो गया है!",
        playersReset: playerResult.modifiedCount,
        teamsReset: teams.length,
        state: resetState ? (resetState.toObject ? resetState.toObject() : resetState) : null
    };
};

module.exports = {
    getTeamWithDynamicMaxBid,
    sellPlayer,
    unsoldPlayer,
    undoPlayerAction,
    restoreUnsoldPlayers,
    bringAllPlayersBack,
    resetAuction
};
