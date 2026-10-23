const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const fetchTeamOwner = require('../middleware/fetchTeamOwner');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const AuctionState = require('../models/AuctionState');
const VisitorLog = require('../models/VisitorLog');
const { resolveEffectivePlan, getDefaultRegistrationPlan } = require('../utils/planPolicy');
const { createSessionAndToken, createTeamOwnerSessionAndToken, getActiveDeviceIdsForUser, revokeSessionById, revokeAllSessionsForUser } = require('../utils/sessionAuth');
const { forgotPasswordMiddleware, resetPasswordMiddleware } = require('../utils/rateLimiter');
const { getAuctionStateForOrganizer, decorateTeamsWithMaxBid } = require('../utils/maxBid');

const createResetToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false') === 'true',
  auth: process.env.SMTP_USER && process.env.SMTP_PASS ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  connectionTimeout: 10000,
  greetingTimeout: 8000,
  socketTimeout: 15000
};

const mailer = nodemailer.createTransport(smtpConfig);
let smtpVerified = false;

const ensureSmtpReady = async () => {
  if (smtpVerified) return;
  if (!smtpConfig.host || !smtpConfig.auth?.user || !smtpConfig.auth?.pass) {
    const error = new Error('SMTP credentials are missing');
    error.code = 'SMTP_CONFIG_MISSING';
    throw error;
  }
  await mailer.verify();
  smtpVerified = true;
};

const buildResetMailHtml = ({ organizerName, resetLink }) => `
  <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0f172a;padding:32px 16px;color:#f8fafc;">
    <div style="max-width:580px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
      <div style="background:linear-gradient(135deg, #1e1b4b 0%, #1e3a8a 50%, #2563eb 100%);padding:28px 24px;text-align:center;">
        <h1 style="margin:0;font-size:24px;color:#ffffff;letter-spacing:-0.5px;">🏏 CricLeagueManager</h1>
        <p style="margin:6px 0 0 0;font-size:13px;color:#93c5fd;font-weight:500;">Auction & Tournament Management Portal</p>
      </div>
      <div style="padding:28px 24px;line-height:1.6;color:#e2e8f0;">
        <p style="margin-top:0;font-size:16px;font-weight:600;color:#ffffff;">Hello ${organizerName || 'Organizer'},</p>
        <p style="font-size:14px;color:#cbd5e1;margin-bottom:24px;">We received a request to reset your CricLeagueManager account password. Click the button below to set a new password:</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${resetLink}" style="background:linear-gradient(135deg, #4f46e5 0%, #2563eb 100%);color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:bold;font-size:15px;display:inline-block;">Reset Password</a>
        </div>
        <div style="font-size:13px;color:#f59e0b;background:#451a03;border:1px solid #78350f;padding:12px 14px;border-radius:8px;margin-bottom:16px;">
          ⏰ <strong>Security Notice:</strong> This reset link will expire in <strong>20 minutes</strong> and can only be used once.
        </div>
        <div style="font-size:12px;color:#94a3b8;background:#0f172a;border:1px solid #1e293b;padding:12px 14px;border-radius:8px;margin-bottom:20px;">
          If you did not request this reset, please ignore this email. Your password will remain unchanged.
        </div>
        <p style="font-size:11px;color:#64748b;word-break:break-all;border-top:1px solid #334155;padding-top:16px;margin-bottom:0;">
          If the button does not work, use this link:<br/>${resetLink}
        </p>
      </div>
    </div>
  </div>
`;

router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;
    if (!name || !phone || !email || !password) return res.status(400).json({ message: 'सभी फ़ील्ड आवश्यक हैं।' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) return res.status(400).json({ message: 'मान्य ईमेल दर्ज करें।' });

    let user = await User.findOne({ $or: [{ phone }, { email: normalizedEmail }] });
    if (user) return res.status(400).json({ message: 'इस मोबाइल या ईमेल से खाता पहले से मौजूद है!' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedPlan = await getDefaultRegistrationPlan();
    user = new User({ name, phone, email: normalizedEmail, password: hashedPassword, plan: assignedPlan, role: 'Organizer', maxDevicesAllowed: 15, isActive: true });
    await user.save();
    res.status(201).json({ message: 'रजिस्ट्रेशन सफल रहा!' });
  } catch (err) {
    res.status(500).json({ error: 'रजिस्ट्रेशन में एरर आया!' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password, deviceId } = req.body;
    const normalizedDeviceId = String(deviceId || '').trim();
    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ message: 'यह नंबर रजिस्टर नहीं है!' });
    if (!user.isActive) return res.status(403).json({ message: 'आपका अकाउंट सस्पेंड कर दिया गया है।' });

    const storedPassword = String(user.password || '');
    const isBcryptHash = /^\$2[aby]\$/.test(storedPassword);
    let isMatch = isBcryptHash ? await bcrypt.compare(password, storedPassword) : password === storedPassword;
    if (!isMatch) return res.status(400).json({ message: 'पासवर्ड गलत है!' });
    if (!isBcryptHash) {
      const migratedPassword = await bcrypt.hash(password, 10);
      await User.updateOne({ _id: user._id }, { $set: { password: migratedPassword } });
      user.password = migratedPassword;
    }

    let activeDeviceIds = await getActiveDeviceIdsForUser(user._id);

    const effectiveDeviceLimit = (user.maxDevicesAllowed === 1 || !user.maxDevicesAllowed) ? 15 : user.maxDevicesAllowed;

    if (normalizedDeviceId) {
      if (user.role !== 'SuperAdmin' && !activeDeviceIds.includes(normalizedDeviceId) && activeDeviceIds.length >= effectiveDeviceLimit) {
        const numDevicesToRevoke = activeDeviceIds.length - effectiveDeviceLimit + 1;
        const oldestSessions = await UserSession.aggregate([
            { $match: { user: user._id, revokedAt: null, expiresAt: { $gt: new Date() }, isImpersonated: { $ne: true }, deviceId: { $ne: 'impersonation_device' } } },
            { $sort: { lastActivityAt: 1, createdAt: 1 } },
            { $group: { _id: "$deviceId", oldestTime: { $first: "$lastActivityAt" } } },
            { $sort: { oldestTime: 1 } },
            { $limit: numDevicesToRevoke }
        ]);

        const deviceIdsToRevoke = oldestSessions.map(s => s._id);

        if (deviceIdsToRevoke.length > 0) {
            await UserSession.updateMany(
                { user: user._id, deviceId: { $in: deviceIdsToRevoke }, revokedAt: null },
                { $set: { revokedAt: new Date() } }
            );
            activeDeviceIds = await getActiveDeviceIdsForUser(user._id);
        }
      }
    }

    const { token, expiresAt } = await createSessionAndToken({ user, deviceId: normalizedDeviceId, ipAddress: req.ip, userAgent: req.get('user-agent') });
    
    if (normalizedDeviceId && !activeDeviceIds.includes(normalizedDeviceId)) {
        activeDeviceIds.push(normalizedDeviceId);
    }
    await User.updateOne({ _id: user._id }, { $set: { activeDevices: activeDeviceIds } });

    const normalizedPlan = resolveEffectivePlan(user);
    const requiresEmailUpdate = !user.email;

    res.json({ message: 'लॉगिन सफल!', token, sessionExpiresAt: expiresAt, requiresEmailUpdate, user: { name: user.name, phone: user.phone, email: user.email, role: user.role, plan: normalizedPlan } });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'सर्वर क्रैश प्रोटेक्शन: डेटा फॉर्मेट सही नहीं है!' });
  }
});

// Remote Bidding Phase 2.1: Team Owner Login
router.post('/team-login', async (req, res) => {
  try {
    const { username, password, tournamentId, deviceId } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const trimmedUsername = String(username).trim();
    let team = null;

    if (tournamentId) {
      team = await Team.findOne({ remoteUsername: trimmedUsername, tournament: tournamentId });
    } else {
      const candidates = await Team.find({ remoteUsername: trimmedUsername });
      if (candidates.length === 1) {
        team = candidates[0];
      } else if (candidates.length > 1) {
        const matchingCandidates = [];
        for (const cand of candidates) {
          if (cand.remotePasswordHash && await bcrypt.compare(password, cand.remotePasswordHash)) {
            matchingCandidates.push(cand);
          }
        }
        if (matchingCandidates.length === 1) {
          team = matchingCandidates[0];
        } else if (matchingCandidates.length > 1) {
          return res.status(409).json({ message: 'Tournament ID is required to identify your team' });
        } else {
          return res.status(400).json({ message: 'Invalid credentials' });
        }
      }
    }

    if (!team) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, team.remotePasswordHash || '');
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!team.remoteAccessEnabled) {
      return res.status(403).json({ message: 'Remote access is disabled for this team' });
    }

    const { token, expiresAt } = await createTeamOwnerSessionAndToken({ team, deviceId, ipAddress: req.ip, userAgent: req.get('user-agent') });

    res.json({ 
      message: 'Team Login Successful', 
      token, sessionExpiresAt: expiresAt,
      team: { 
        teamName: team.teamName, 
        shortName: team.shortName, 
        role: 'TeamOwner' 
      } 
    });
  } catch (err) {
    console.error('Team Login Error:', err);
    res.status(500).json({ error: 'Server error during team login' });
  }
});

router.post('/forgot-password', forgotPasswordMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'ईमेल आवश्यक है।' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) return res.status(400).json({ success: false, message: 'मान्य ईमेल दर्ज करें।' });

    const genericSuccessMessage = 'यदि यह ईमेल हमारे पास पंजीकृत है, तो पासवर्ड रीसेट लिंक भेज दिया गया है। कृपया अपना इनबॉक्स और स्पैम फ़ोल्डर जांचें।';

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Return identical structured response to prevent account enumeration
      return res.json({ success: true, message: genericSuccessMessage });
    }

    const rawToken = createResetToken();
    const hashedToken = hashToken(rawToken);
    const tokenExpiry = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes
    await User.updateOne(
      { _id: user._id },
      { $set: { resetPasswordToken: hashedToken, resetPasswordExpire: tokenExpiry } }
    );

    const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const resetLink = `${base}/reset-password/${rawToken}`;

    try {
      await ensureSmtpReady();
      await mailer.sendMail({
        from: process.env.SMTP_FROM || `"CricLeagueManager" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: 'CricLeagueManager - Password Reset Link',
        text: `Hello ${user.name || 'Organizer'},\n\nWe received a request to reset your CricLeagueManager password. Click the link below to set a new password:\n${resetLink}\n\nThis link expires in 20 minutes and can be used once.\n\nIf you did not request this, you can safely ignore this email.`,
        html: buildResetMailHtml({ organizerName: user.name, resetLink })
      });
    } catch (mailError) {
      console.error('[forgot-password] Email delivery failure:', mailError.message || mailError);
      await User.updateOne(
        { _id: user._id },
        { $set: { resetPasswordToken: null, resetPasswordExpire: null } }
      );
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[DEV NOTE] Reset link would have been: ${resetLink}`);
      }
    }

    // Always return constant, generic message to prevent account enumeration
    res.json({ success: true, message: genericSuccessMessage });
  } catch (e) {
    console.error('forgot-password error:', e);
    res.status(500).json({ success: false, message: 'Reset लिंक भेजने में दिक्कत आई। कृपया कुछ देर बाद प्रयास करें।' });
  }
});

// Pre-validate reset token on page load for better UX
router.get('/validate-reset-token/:token', async (req, res) => {
  try {
    const rawToken = String(req.params.token || '').trim();
    if (!rawToken || rawToken.length !== 64 || !/^[0-9a-f]+$/i.test(rawToken)) {
      return res.status(400).json({ valid: false, message: 'अमान्य रीसेट लिंक।' });
    }

    const hashed = hashToken(rawToken);
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpire: { $gt: new Date() }
    }).select('_id email name');

    if (!user) {
      return res.status(400).json({ valid: false, message: 'यह रीसेट लिंक अमान्य या एक्सपायर हो चुका है।' });
    }

    let maskedEmail = '';
    if (user.email && user.email.includes('@')) {
      const [localPart, domain] = user.email.split('@');
      const visible = localPart.slice(0, Math.min(2, localPart.length));
      maskedEmail = `${visible}***@${domain}`;
    }

    res.json({ valid: true, maskedEmail, organizerName: user.name || 'Organizer' });
  } catch (e) {
    console.error('validate-reset-token error:', e);
    res.status(500).json({ valid: false, message: 'टोकन जांचने में त्रुटि।' });
  }
});

router.post('/reset-password/:token', resetPasswordMiddleware, async (req, res) => {
  try {
    const rawToken = String(req.params.token || '').trim();
    const { password, confirmPassword } = req.body;

    if (!rawToken || rawToken.length !== 64 || !/^[0-9a-f]+$/i.test(rawToken)) {
      return res.status(400).json({ success: false, message: 'अमान्य रीसेट लिंक।' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, message: 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए।' });
    }
    if (password.length > 128) {
      return res.status(400).json({ success: false, message: 'पासवर्ड 128 अक्षरों से अधिक नहीं हो सकता।' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'पासवर्ड मैच नहीं कर रहे हैं।' });
    }

    const hashed = hashToken(rawToken);
    const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpire: { $gt: new Date() } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'यह रीसेट टोकन अमान्य है या एक्सपायर हो चुका है।' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Update password, invalidate token, clear active device list
    await User.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword, resetPasswordToken: null, resetPasswordExpire: null, activeDevices: [] } }
    );

    // 2. Revoke ALL active sessions for this user across all devices
    await revokeAllSessionsForUser(user._id);

    // 3. Drop active Socket.IO connections for this user so stale sessions are dropped immediately
    try {
      const io = req.app.get('io');
      if (io) {
        for (const [, socket] of io.of('/').sockets) {
          if (String(socket.organizerId) === String(user._id)) {
            socket.emit('sessionExpired', { message: 'पासवर्ड बदल दिया गया है। कृपया पुनः लॉगिन करें।' });
            socket.disconnect(true);
          }
        }
      }
    } catch (socketErr) {
      console.warn('Socket disconnect notice on password reset:', socketErr.message);
    }

    res.json({ success: true, message: 'पासवर्ड सफलतापूर्वक बदल दिया गया है! कृपया नए पासवर्ड से लॉगिन करें।' });
  } catch (e) {
    console.error('reset-password error:', e);
    res.status(500).json({ success: false, message: 'पासवर्ड रीसेट करने में समस्या आई।' });
  }
});

router.post('/complete-profile-email', async (req, res) => {
  try {
    const { phone, email } = req.body;
    if (!email) return res.status(400).json({ message: 'ईमेल आवश्यक है।' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) return res.status(400).json({ message: 'मान्य ईमेल दर्ज करें।' });

    let userQuery = null;
    if (phone) {
      userQuery = { phone };
    } else {
      const authHeader = req.header('Authorization');
      const token = authHeader && authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded?.id) userQuery = { _id: decoded.id };
        } catch (error) {
          // ignore token parse errors and fallback to validation below
        }
      }
    }

    if (!userQuery) return res.status(400).json({ message: 'यूज़र पहचान नहीं मिली। दोबारा लॉगिन करें।' });

    const duplicateQuery = { email: normalizedEmail };
    if (phone) duplicateQuery.phone = { $ne: phone };
    else if (userQuery._id) duplicateQuery._id = { $ne: userQuery._id };

    const existing = await User.findOne(duplicateQuery);
    if (existing) return res.status(400).json({ message: 'यह ईमेल पहले से उपयोग में है।' });
    const updateResult = await User.updateOne(userQuery, { $set: { email: normalizedEmail } });
    if (!updateResult.matchedCount) return res.status(404).json({ message: 'यूज़र नहीं मिला।' });
    res.json({ message: 'ईमेल अपडेट हो गया।' });
  } catch (e) {
    res.status(500).json({ message: 'ईमेल अपडेट में समस्या।' });
  }
});

router.post('/ping', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.sid) return res.status(400).json({ message: 'Invalid session' });

    await UserSession.updateOne(
      { _id: decoded.sid, revokedAt: null },
      { $set: { lastActivityAt: new Date() } }
    );
    res.json({ message: 'Ping successful' });
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized or expired' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { phone, deviceId } = req.body;
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await revokeSessionById(decoded.sid);
      } catch (error) {
        // ignore
      }
    }
    if (phone && deviceId) {
      const user = await User.findOne({ phone });
      if (user) {
        const activeDeviceIds = await getActiveDeviceIdsForUser(user._id);
        await User.updateOne({ _id: user._id }, { $set: { activeDevices: activeDeviceIds } });
      }
    }
    res.json({ message: 'लॉगआउट सफल!' });
  } catch (err) {
    res.status(500).json({ error: 'लॉगआउट में एरर!' });
  }
});

router.post('/track-visitor', async (req, res) => {
    try {
        const { visitorId, route } = req.body;
        if (!visitorId) return res.status(400).json({ error: 'visitorId required' });
        
        let sanitizedRoute = String(route || '/');
        // Prevent storing raw password reset tokens in VisitorLog
        if (sanitizedRoute.startsWith('/reset-password/')) {
            sanitizedRoute = '/reset-password/:token';
        }

        await VisitorLog.create({
            visitorId: String(visitorId),
            route: sanitizedRoute,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});


// Phase 2.4: Fetch live team state for Remote Bidding Public Screen
router.get('/team-info', fetchTeamOwner, async (req, res) => {
  try {
    const team = await Team.findById(req.teamOwner.teamId).lean();
    if (!team) return res.status(404).json({ message: 'Team not found' });
    
    const tournament = await Tournament.findById(req.teamOwner.tournamentId).lean();
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });

    let dynamicMaxBid = Number(team.remainingPurse || 0);
    try {
      const tournamentId = req.teamOwner.tournamentId;
      const tournamentObjectId = mongoose.Types.ObjectId.isValid(tournamentId)
        ? new mongoose.Types.ObjectId(String(tournamentId))
        : tournamentId;
      const tournamentScope = {
        tournamentId: tournamentObjectId,
        filter: { tournament: tournamentObjectId }
      };
      const [auctionState, liveAuctionState] = await Promise.all([
        getAuctionStateForOrganizer({
          organizerId: req.teamOwner.organizerId,
          tournamentScope
        }),
        AuctionState.findOne({
          tournament: tournamentObjectId
        }).populate('activePlayer', 'basePrice').lean()
      ]);

      const activeBasePrice = (liveAuctionState?.activePlayer?.basePrice && Number(liveAuctionState.activePlayer.basePrice) > 0)
        ? Number(liveAuctionState.activePlayer.basePrice)
        : undefined;

      const [decoratedTeam] = decorateTeamsWithMaxBid({
        teams: [team],
        auctionState,
        currentBasePrice: activeBasePrice
      });
      if (decoratedTeam && typeof decoratedTeam.maxBid === 'number') {
        dynamicMaxBid = decoratedTeam.maxBid;
      }
    } catch (e) {
      console.warn('Failed to calculate dynamic maxBid for team-info:', e.message);
    }

    res.json({
      team: {
        _id: team._id,
        teamName: team.teamName,
        shortName: team.shortName,
        logoUrl: team.logoUrl || team.logo || '',
        ownerName: team.ownerName,
        remoteUsername: team.remoteUsername,
        totalPurse: team.totalPurse,
        remainingPurse: team.remainingPurse,
        maxBid: dynamicMaxBid
      },
      tournament: {
        name: tournament.name,
        logoUrl: tournament.logoUrl || '',
        biddingButtonsCount: tournament.biddingButtonsCount || 3,
        bidButton1: tournament.bidButton1 || 500,
        bidButton2: tournament.bidButton2 || 1000,
        bidButton3: tournament.bidButton3 || 5000
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching team info' });
  }
});

module.exports = router;
