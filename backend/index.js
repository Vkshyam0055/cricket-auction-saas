require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const Tournament = require('./models/Tournament');
const Team = require('./models/Team');
const User = require('./models/User');
const AuctionState = require('./models/AuctionState');
const { getEffectivePlanPolicy, resolveEffectivePlan } = require('./utils/planPolicy');
const { validateSessionById, validateTeamOwnerSession, revokeSessionById, getJwtSecret } = require('./utils/sessionAuth');
const { isBiddingActive, setBiddingActive, registerOperatorSocket, removeOperatorSocket, hasActiveOperators } = require('./utils/biddingState');
const auctionService = require('./services/auctionService');

const http = require('http');
const { Server } = require('socket.io');
const { socketCorsOptions } = require('./utils/corsConfig');

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
    cors: socketCorsOptions
});
app.set('io', io);
const organizerActiveBids = new Map();
const organizerScreenConfigs = new Map();
const organizerBreakSnapshots = new Map();

app.use(cors({
    origin: socketCorsOptions.origin,
    credentials: true
}));
app.use(express.json());

io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Unauthorized'));
        const decoded = jwt.verify(token, getJwtSecret());
        
        if (decoded.role === 'TeamOwner') {
            if (!decoded.teamId || !decoded.organizerId || !decoded.tournamentId || !decoded.sid) {
                return next(new Error('Unauthorized'));
            }
            socket.role = 'TeamOwner';
            socket.teamOwner = {
                teamId: decoded.teamId,
                organizerId: decoded.organizerId,
                tournamentId: decoded.tournamentId
            };
            socket.organizerId = decoded.organizerId; // Map to organizerId for room joining
            socket.tournamentId = decoded.tournamentId; // Ensure tournament room is joined immediately
            socket.sessionId = decoded.sid;
            socket.tokenExp = decoded.exp;
            return next();
        }

        if (!decoded?.id || !decoded?.sid) return next(new Error('Unauthorized'));
        socket.role = 'Organizer';
        socket.organizerId = decoded.id;
        socket.sessionId = decoded.sid;
        socket.tokenExp = decoded.exp;
        socket.clientType = socket.handshake.auth?.clientType || null;
        next();
    } catch (error) {
        next(new Error('Unauthorized'));
    }
});

io.on('connection', async (socket) => {
    // 1. Initial Connection Validation
    if (socket.role === 'TeamOwner') {
        const sessionValidation = await validateTeamOwnerSession({ sessionId: socket.sessionId, ...socket.teamOwner });
        const team = await Team.findById(socket.teamOwner.teamId).lean();
        if (!sessionValidation.ok || !team || !team.remoteAccessEnabled ||
            String(team.organizer) !== String(socket.teamOwner.organizerId) || 
            String(team.tournament) !== String(socket.teamOwner.tournamentId)) {
            socket.emit('sessionExpired', { message: 'Remote access disabled or invalid team scope' });
            return socket.disconnect(true);
        }
    } else {
        const validation = await validateSessionById({ sessionId: socket.sessionId, userId: socket.organizerId });
        if (!validation.ok) {
            socket.emit('sessionExpired', { message: 'Session expired' });
            return socket.disconnect(true);
        }
    }

    const expiryMs = (Number(socket.tokenExp || 0) * 1000) - Date.now();
    if (expiryMs <= 0) {
        socket.emit('sessionExpired', { message: 'Session expired' });
        return socket.disconnect(true);
    }

    const expiryTimer = setTimeout(async () => {
        if (socket.role !== 'TeamOwner') {
            await revokeSessionById(socket.sessionId);
        }
        socket.emit('sessionExpired', { message: 'Session expired' });
        socket.disconnect(true);
    }, expiryMs);

    socket.use(async (_, next) => {
        const now = Date.now();
        if (socket._lastSessionCheck && (now - socket._lastSessionCheck < 5000)) {
            return next();
        }

        if (socket.role === 'TeamOwner') {
            const sessionValidation = await validateTeamOwnerSession({ sessionId: socket.sessionId, ...socket.teamOwner });
            const team = await Team.findById(socket.teamOwner.teamId).select('remoteAccessEnabled organizer tournament').lean();
            if (!sessionValidation.ok || !team || !team.remoteAccessEnabled ||
                String(team.organizer) !== String(socket.teamOwner.organizerId) || 
                String(team.tournament) !== String(socket.teamOwner.tournamentId)) {
                socket.emit('sessionExpired', { message: 'Remote access disabled' });
                socket.disconnect(true);
                return next(new Error('Unauthorized'));
            }
        } else {
            const packetValidation = await validateSessionById({ sessionId: socket.sessionId, userId: socket.organizerId });
            if (!packetValidation.ok) {
                socket.emit('sessionExpired', { message: 'Session expired' });
                socket.disconnect(true);
                return next(new Error('Unauthorized'));
            }
        }
        
        socket._lastSessionCheck = now;
        return next();
    });

    const isOperator = socket.role === 'Organizer' && socket.clientType === 'operator';
    if (isOperator) {
        registerOperatorSocket(socket.organizerId, socket.id);
    }

    socket.emit('biddingStateUpdate', {
        biddingActive: isBiddingActive(socket.organizerId)
    });

    const room = `organizer:${socket.organizerId}`;
    const organizerKey = String(socket.organizerId);
    socket.join(room);

    let tournamentRoom = socket.tournamentId ? `tournament:${socket.tournamentId}` : null;
    if (tournamentRoom) {
        socket.join(tournamentRoom);
    }

    const broadcastToTournament = (event, data) => {
        if (tournamentRoom) {
            io.to(room).to(tournamentRoom).emit(event, data);
        } else {
            io.to(room).emit(event, data);
        }
    };

    console.log(`⚡ organizer ${socket.organizerId} connected to live socket`);
    socket.emit('activeBiddingSync', {
        lastBidActions: organizerActiveBids.get(organizerKey) || []
    });
    const defaultScreenConfig = {
        displayMode: 'night',
        layout: 'classic',
        photoSize: 'medium',
        screenView: 'live',
        breakView: 'teams-dashboard',
        selectedSquadTeam: '',
        version: 0,
        updatedAtMs: 0
    };
    socket.emit('liveScreenConfigSync', organizerScreenConfigs.get(organizerKey) || defaultScreenConfig);
    socket.emit('breakDataSnapshotSync', organizerBreakSnapshots.get(organizerKey) || null);

    Tournament.findOne({ organizer: socket.organizerId })
        .select('_id liveScreenConfig')
        .lean()
        .then((tournament) => {
            if (!tournament) return;
            if (!tournamentRoom) {
                socket.tournamentId = String(tournament._id);
                tournamentRoom = `tournament:${tournament._id}`;
                socket.join(tournamentRoom);
            }
            if (tournament.liveScreenConfig) {
                const persistedConfig = { ...defaultScreenConfig, ...tournament.liveScreenConfig };
                organizerScreenConfigs.set(organizerKey, persistedConfig);
                broadcastToTournament('liveScreenConfigSync', persistedConfig);
            }
        })
        .catch((error) => {
            console.error('Failed to load liveScreenConfig:', error.message);
        });

    socket.on('requestRemoteBid', async (payload, callback) => {
        if (socket.role !== 'TeamOwner') {
            if (typeof callback === 'function') callback({ success: false, message: 'Only Team Owners can request remote bids' });
            return;
        }

        const sessionValidation = await validateTeamOwnerSession({ sessionId: socket.sessionId, ...socket.teamOwner });
        const team = await Team.findById(socket.teamOwner.teamId).select('remoteAccessEnabled organizer tournament').lean();
        if (!sessionValidation.ok || !team || !team.remoteAccessEnabled ||
            String(team.organizer) !== String(socket.teamOwner.organizerId) || 
            String(team.tournament) !== String(socket.teamOwner.tournamentId)) {
            if (typeof callback === 'function') {
                callback({ success: false, message: 'Session revoked or expired' });
            }
            socket.emit('sessionExpired', { message: 'Remote access disabled or session expired' });
            setImmediate(() => socket.disconnect(true));
            return;
        }
        socket._lastSessionCheck = Date.now();

        if (!isBiddingActive(socket.teamOwner.organizerId)) {
            if (typeof callback === 'function') {
                callback({ success: false, message: 'Bidding is currently paused by the organizer.' });
            }
            return;
        }

        const playerId = String(payload?.playerId || '');
        const amount = Number(payload?.amount || 0);

        if (!playerId || !amount || amount <= 0) {
            if (typeof callback === 'function') callback({ success: false, message: 'Invalid bid payload' });
            return;
        }

        if (socket.teamOwner?.organizerId) {
            try {
                const organizer = await User.findById(socket.teamOwner.organizerId).select('plan role').lean();
                if (organizer) {
                    const organizerPlan = resolveEffectivePlan(organizer);
                    const policy = await getEffectivePlanPolicy(organizerPlan);
                    if (!policy.canRemoteBidding && organizer.role !== 'SuperAdmin') {
                        if (typeof callback === 'function') {
                            callback({ success: false, message: 'Remote bidding is disabled for this tournament.' });
                        }
                        return;
                    }
                }
            } catch (err) {
                // Ignore DB error and let auctionService placeBid handle state
            }
        }

        try {
            // Direct server-authoritative bid execution (no browser relay)
            const result = await auctionService.placeBid({
                organizerId: socket.teamOwner.organizerId,
                tournamentScope: { tournamentId: socket.teamOwner.tournamentId },
                teamId: socket.teamOwner.teamId,
                playerId,
                amount,
                bidType: 'increment',
                expectedVersion: payload?.expectedVersion,
                allowCustomBid: false
            });

            const acceptedBid = Number(result.state.currentBid);
            const liveBidPayload = {
                bidAmount: acceptedBid,
                currentBid: acceptedBid,
                teamId: result.team._id,
                biddingTeamId: result.team._id,
                teamName: result.team.teamName,
                biddingTeamName: result.team.teamName,
                shortName: result.team.shortName,
                logoUrl: result.team.logoUrl || result.team.logo || '',
                player: result.player,
                currentPlayer: result.player,
                status: 'bidding',
                playerStatus: 'bidding',
                version: result.state.version,
                isRemote: true,
                bidSource: 'remote'
            };

            const current = organizerActiveBids.get(organizerKey) || [];
            const filteredCurrent = current.filter((id) => String(id) !== String(result.team._id) && String(id) !== String(result.team.teamName));
            const nextList = [...filteredCurrent, String(result.team._id)].slice(-4);
            organizerActiveBids.set(organizerKey, nextList);

            broadcastToTournament('updateAudienceScreen', liveBidPayload);
            broadcastToTournament('activeBiddingUpdate', { lastBidActions: nextList });

            if (typeof callback === 'function') {
                callback({
                    success: true,
                    message: 'Bid accepted',
                    newBidAmount: acceptedBid,
                    teamId: result.team._id,
                    version: result.state.version,
                    isRemote: true,
                    bidSource: 'remote'
                });
            }
        } catch (error) {
            const message = error.publicMessage || error.message || 'Bid rejected';
            if (typeof callback === 'function') {
                callback({ success: false, message });
            }
        }
    });

    socket.on('newLiveBid', async (data) => {
        if (socket.role === 'TeamOwner') return; // Only organizers can broadcast bids
        let currentVersion = data?.version;
        if (currentVersion === undefined && data?.player?._id) {
            try {
                const liveState = await AuctionState.findOne({
                    organizer: socket.organizerId,
                    activePlayer: data.player._id,
                    status: 'bidding'
                }).select('version').lean();
                if (liveState && liveState.version !== undefined) {
                    currentVersion = liveState.version;
                }
            } catch (e) {
                // Ignore DB lookup error and fallback
            }
        }
        const payload = {
            ...data,
            version: currentVersion !== undefined ? currentVersion : data?.version,
            isRemote: Boolean(data?.isRemote),
            bidSource: data?.bidSource || (data?.isRemote ? 'remote' : 'onsite'),
            biddingActive: data?.biddingActive !== undefined ? Boolean(data.biddingActive) : isBiddingActive(socket.organizerId)
        };
        broadcastToTournament('updateAudienceScreen', payload); 
    });

    socket.on('activeBiddingUpdate', (payload = {}) => {
        if (socket.role === 'TeamOwner') return;

        const current = organizerActiveBids.get(organizerKey) || [];
        let next = current;

        if (payload.type === 'replace') {
            next = Array.isArray(payload.lastBidActions)
                ? payload.lastBidActions.filter(Boolean).slice(0, 4)
                : [];
        } else if (payload.type === 'reset') {
            next = [];
        } else if (payload.type === 'append' && (payload.teamId || payload.teamName)) {
            next = [...current, payload.teamId || payload.teamName].slice(-4);
        } else {
            return;
        }

        organizerActiveBids.set(organizerKey, next);
        broadcastToTournament('activeBiddingUpdate', { lastBidActions: next });
    });

    socket.on('liveScreenConfigUpdate', async (payload = {}) => {
        if (socket.role === 'TeamOwner') return;

        const currentConfig = organizerScreenConfigs.get(organizerKey) || defaultScreenConfig;
        const incomingVersion = Number(payload.version || 0);
        if (incomingVersion < Number(currentConfig.version || 0)) {
            return;
        }
        const nextConfig = {
            displayMode: payload.displayMode || 'night',
            layout: payload.layout || 'classic',
            photoSize: payload.photoSize || 'medium',
            screenView: payload.screenView === 'break' ? 'break' : 'live',
            breakView: payload.breakView || 'teams-dashboard',
            selectedSquadTeam: payload.selectedSquadTeam !== undefined ? payload.selectedSquadTeam : '',
            version: incomingVersion,
            updatedAtMs: Number(payload.updatedAtMs || Date.now())
        };

        organizerScreenConfigs.set(organizerKey, nextConfig);
        broadcastToTournament('liveScreenConfigUpdate', nextConfig);

        if (nextConfig.screenView === 'break') {
            setBiddingActive(socket.organizerId, false);
            broadcastToTournament('biddingStateUpdate', {
                biddingActive: false,
                organizerId: socket.organizerId,
                tournamentId: socket.tournamentId
            });
        }

        Tournament.findOneAndUpdate(
            { organizer: socket.organizerId },
            { $set: { liveScreenConfig: nextConfig } },
            { returnDocument: 'after' }
        ).catch((error) => {
            console.error('Failed to persist liveScreenConfig:', error.message);
        });
    });

    socket.on('breakDataSnapshotUpdate', (payload = null) => {
        if (socket.role === 'TeamOwner') return;

        if (!payload || typeof payload !== 'object') return;
        organizerBreakSnapshots.set(organizerKey, payload);
        broadcastToTournament('breakDataSnapshotUpdate', payload);
    });

    socket.on('setBiddingActive', (payload = {}, callback) => {
        if (socket.role !== 'Organizer') {
            if (typeof callback === 'function') callback({ success: false, message: 'Unauthorized' });
            return;
        }

        const active = Boolean(payload?.active);
        const currentConfig = organizerScreenConfigs.get(organizerKey);
        if (active && currentConfig?.screenView === 'break') {
            if (typeof callback === 'function') {
                callback({ success: false, message: 'Cannot start bidding while viewing Break Content.' });
            }
            return;
        }

        setBiddingActive(socket.organizerId, active);
        broadcastToTournament('biddingStateUpdate', {
            biddingActive: active,
            organizerId: socket.organizerId,
            tournamentId: socket.tournamentId
        });

        if (typeof callback === 'function') {
            callback({ success: true, biddingActive: active });
        }
    });

    socket.on('disconnect', () => {
        clearTimeout(expiryTimer);
        if (isOperator) {
            const remaining = removeOperatorSocket(socket.organizerId, socket.id);
            if (remaining === 0) {
                setBiddingActive(socket.organizerId, false);
                broadcastToTournament('biddingStateUpdate', {
                    biddingActive: false,
                    organizerId: socket.organizerId,
                    tournamentId: socket.tournamentId
                });
            }
        }
        console.log(`❌ organizer ${socket.organizerId} disconnected from live socket`);
    });
});

// 🌟 जादू यहाँ है: कल मुझसे यह पहली लाइन (auth) छूट गई थी! 🌟
app.use('/api/auth', require('./routes/auth')); 
app.use('/api/teams', require('./routes/team'));
app.use('/api/players', require('./routes/player'));
app.use('/api/auction', require('./routes/auction'));
app.use('/api/tournament', require('./routes/tournament'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/plans', require('./routes/plan'));

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cricket_auction')
    .then(() => console.log('Database Connection Successful! (गोडाउन से जुड़ गए)'))
    .catch((err) => console.log(err));

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
