require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const Tournament = require('./models/Tournament');
const Team = require('./models/Team');
const { validateSessionById, revokeSessionById } = require('./utils/sessionAuth');

const http = require('http');
const { Server } = require('socket.io');

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});
const organizerActiveBids = new Map();
const organizerScreenConfigs = new Map();
const organizerBreakSnapshots = new Map();

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());

io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Unauthorized'));
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        
        if (decoded.role === 'TeamOwner') {
            if (!decoded.teamId || !decoded.organizerId || !decoded.tournamentId) {
                return next(new Error('Unauthorized'));
            }
            socket.role = 'TeamOwner';
            socket.teamOwner = {
                teamId: decoded.teamId,
                organizerId: decoded.organizerId,
                tournamentId: decoded.tournamentId
            };
            socket.organizerId = decoded.organizerId; // Map to organizerId for room joining
            socket.tokenExp = decoded.exp;
            return next();
        }

        if (!decoded?.id || !decoded?.sid) return next(new Error('Unauthorized'));
        socket.role = 'Organizer';
        socket.organizerId = decoded.id;
        socket.sessionId = decoded.sid;
        socket.tokenExp = decoded.exp;        
        next();
    } catch (error) {
        next(new Error('Unauthorized'));
    }
});

io.on('connection', async (socket) => {
    // 1. Initial Connection Validation
    if (socket.role === 'TeamOwner') {
        const team = await Team.findById(socket.teamOwner.teamId).lean();
        if (!team || !team.remoteAccessEnabled || 
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
            const team = await Team.findById(socket.teamOwner.teamId).select('remoteAccessEnabled organizer tournament').lean();
            if (!team || !team.remoteAccessEnabled || 
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

    const room = `organizer:${socket.organizerId}`;
    const organizerKey = String(socket.organizerId);
    socket.join(room);
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
        .select('liveScreenConfig')
        .lean()
        .then((tournament) => {
            if (!tournament?.liveScreenConfig) return;
            const persistedConfig = { ...defaultScreenConfig, ...tournament.liveScreenConfig };
            organizerScreenConfigs.set(organizerKey, persistedConfig);
            io.to(room).emit('liveScreenConfigSync', persistedConfig);
        })
        .catch((error) => {
            console.error('Failed to load liveScreenConfig:', error.message);
        });

    socket.on('requestRemoteBid', async (payload, callback) => {
        if (socket.role !== 'TeamOwner') {
            if (typeof callback === 'function') callback({ success: false, message: 'Only Team Owners can request remote bids' });
            return;
        }

        const requestData = {
            teamId: socket.teamOwner.teamId,
            playerId: String(payload?.playerId || ''),
            amount: Number(payload?.amount || 0)
        };

        if (!requestData.playerId || !requestData.amount || requestData.amount <= 0) {
            if (typeof callback === 'function') callback({ success: false, message: 'Invalid bid payload' });
            return;
        }

        try {
            const responses = await io.to(room).timeout(2000).emitWithAck('remoteBidRequest', requestData);
            
            let successRes = null;
            let failRes = null;

            for (const res of responses) {
                if (res && res.success) {
                    successRes = res;
                    break;
                }
                if (res && !res.success && !failRes) {
                    failRes = res;
                }
            }

            if (typeof callback === 'function') {
                if (successRes) callback(successRes);
                else if (failRes) callback(failRes);
                else callback({ success: false, message: 'Organizer control panel not active' });
            }
        } catch (error) {
            if (typeof callback === 'function') {
                callback({ success: false, message: 'Timeout reaching organizer' });
            }
        }
    });

    socket.on('newLiveBid', (data) => {
        if (socket.role === 'TeamOwner') return; // Only organizers can broadcast bids currently
        io.to(room).emit('updateAudienceScreen', data); 
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
        io.to(room).emit('activeBiddingUpdate', { lastBidActions: next });
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
        io.to(room).emit('liveScreenConfigUpdate', nextConfig);

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
        io.to(room).emit('breakDataSnapshotUpdate', payload);
    });

    socket.on('disconnect', () => {
        clearTimeout(expiryTimer);        
        console.log(`❌ organizer ${socket.organizerId} disconnected from live socket`);
    });
});

// 🌟 जादू यहाँ है: कल मुझसे यह पहली लाइन (auth) छूट गई थी! 🌟
app.use('/api/auth', require('./routes/auth')); 
app.use('/api/teams', require('./routes/team'));
app.use('/api/players', require('./routes/player'));
app.use('/api/tournament', require('./routes/tournament'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/plans', require('./routes/plan'));

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cricket_auction')
    .then(() => console.log('Database Connection Successful! (गोडाउन से जुड़ गए)'))
    .catch((err) => console.log(err));

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));