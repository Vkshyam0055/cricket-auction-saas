const jwt = require('jsonwebtoken');
const UserSession = require('../models/UserSession');

const SESSION_TTL_HOURS = 12;
const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;
const IMPERSONATION_SESSION_TTL_HOURS = 2;
const IMPERSONATION_SESSION_TTL_MS = IMPERSONATION_SESSION_TTL_HOURS * 60 * 60 * 1000;

const addHours = (date, hours) => new Date(date.getTime() + (hours * 60 * 60 * 1000));
const getJwtSecret = () => {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
    return process.env.JWT_SECRET;
};

const getActiveDeviceIdsForUser = async (userId) => {
    if (!userId) return [];

    const sessions = await UserSession.find({
        user: userId,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
        isImpersonated: { $ne: true },
        deviceId: { $ne: 'impersonation_device' }
    }).select('deviceId').lean();

    return [...new Set(
        sessions
            .map((session) => String(session.deviceId || '').trim())
            .filter(Boolean)
    )];
};

const createSessionAndToken = async ({ user, deviceId = '', ipAddress = '', userAgent = '' }) => {
    const now = new Date();
    const expiresAt = addHours(now, SESSION_TTL_HOURS);

    const session = await UserSession.create({
        user: user._id,
        deviceId: String(deviceId || ''),
        expiresAt,
        ipAddress: String(ipAddress || ''),
        userAgent: String(userAgent || '')
    });

    const token = jwt.sign(
        { id: user._id, role: user.role, sid: String(session._id) },
        getJwtSecret(),
        { expiresIn: `${SESSION_TTL_HOURS}h` }
    );

    return { session, token, expiresAt };
};

const createTeamOwnerSessionAndToken = async ({ team, deviceId = '', ipAddress = '', userAgent = '' }) => {
    const now = new Date();
    const expiresAt = addHours(now, SESSION_TTL_HOURS);
    const session = await UserSession.create({
        team: team._id, tournament: team.tournament, organizer: team.organizer,
        sessionRole: 'TeamOwner', deviceId: String(deviceId || ''), expiresAt,
        ipAddress: String(ipAddress || ''), userAgent: String(userAgent || '')
    });
    const token = jwt.sign({ role: 'TeamOwner', teamId: team._id, organizerId: team.organizer, tournamentId: team.tournament, sid: String(session._id) }, getJwtSecret(), { expiresIn: `${SESSION_TTL_HOURS}h` });
    return { session, token, expiresAt };
};

const validateTeamOwnerSession = async ({ sessionId, teamId, organizerId, tournamentId }) => {
    if (!sessionId || !teamId || !organizerId || !tournamentId) return { ok: false, reason: 'SESSION_MISSING' };
    const session = await UserSession.findOne({ _id: sessionId, team: teamId, organizer: organizerId, tournament: tournamentId, sessionRole: 'TeamOwner', revokedAt: null }).lean();
    if (!session) return { ok: false, reason: 'SESSION_REVOKED_OR_NOT_FOUND' };
    if (new Date(session.expiresAt) <= new Date()) return { ok: false, reason: 'SESSION_EXPIRED' };
    return { ok: true, session };
};

const revokeTeamOwnerSessions = async (teamId) => {
    if (!teamId) return;
    await UserSession.updateMany({ team: teamId, sessionRole: 'TeamOwner', revokedAt: null }, { $set: { revokedAt: new Date() } });
};

const revokeSessionById = async (sessionId) => {
    if (!sessionId) return;
    await UserSession.updateOne(
        { _id: sessionId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
    );
};

const revokeAllSessionsForUser = async (userId) => {
    if (!userId) return;
    await UserSession.updateMany(
        { user: userId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
    );
};

const validateSessionById = async ({ sessionId, userId }) => {
    if (!sessionId || !userId) return { ok: false, reason: 'SESSION_MISSING' };
    const now = new Date();

    const session = await UserSession.findOne({
        _id: sessionId,
        user: userId,
        revokedAt: null
    }).lean();

    if (!session) return { ok: false, reason: 'SESSION_REVOKED_OR_NOT_FOUND' };
    if (new Date(session.expiresAt) <= now) return { ok: false, reason: 'SESSION_EXPIRED' };

    return { ok: true, session };
};

const createImpersonationSessionAndToken = async ({
    targetUser,
    adminUser,
    deviceId = 'impersonation_device',
    ipAddress = '',
    userAgent = '',
    ttlHours = IMPERSONATION_SESSION_TTL_HOURS
}) => {
    const now = new Date();
    const expiresAt = addHours(now, ttlHours);

    const session = await UserSession.create({
        user: targetUser._id,
        deviceId: String(deviceId || 'impersonation_device'),
        expiresAt,
        ipAddress: String(ipAddress || ''),
        userAgent: String(userAgent || ''),
        isImpersonated: true,
        impersonatedBy: adminUser.id || adminUser._id
    });

    const token = jwt.sign(
        {
            id: targetUser._id,
            role: targetUser.role,
            sid: String(session._id),
            isImpersonated: true,
            impersonatedBy: String(adminUser.id || adminUser._id)
        },
        process.env.JWT_SECRET,
        { expiresIn: `${ttlHours}h` }
    );

    return { session, token, expiresAt };
};

const revokeImpersonationSessionsForTarget = async ({ targetUserId, sessionId = null }) => {
    if (!targetUserId) return;
    const query = {
        user: targetUserId,
        isImpersonated: true,
        revokedAt: null
    };
    if (sessionId) {
        query._id = sessionId;
    }
    return await UserSession.updateMany(
        query,
        { $set: { revokedAt: new Date() } }
    );
};

module.exports = {
    SESSION_TTL_HOURS,
    SESSION_TTL_MS,
    IMPERSONATION_SESSION_TTL_HOURS,
    IMPERSONATION_SESSION_TTL_MS,
    createSessionAndToken,
    createImpersonationSessionAndToken,
    getActiveDeviceIdsForUser,
    validateSessionById,
    revokeSessionById,
    revokeAllSessionsForUser,
    revokeImpersonationSessionsForTarget,
    createTeamOwnerSessionAndToken,
    validateTeamOwnerSession,
    revokeTeamOwnerSessions,
    getJwtSecret
};
