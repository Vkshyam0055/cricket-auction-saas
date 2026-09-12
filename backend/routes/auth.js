const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { resolveEffectivePlan } = require('../utils/planPolicy');
const { createSessionAndToken, getActiveDeviceIdsForUser, revokeSessionById } = require('../utils/sessionAuth');

const createResetToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false') === 'true',
  auth: process.env.SMTP_USER && process.env.SMTP_PASS ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
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
  <div style="font-family:Arial,sans-serif;background:#f4f7ff;padding:24px;color:#1f2937;">
    <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#1e3a8a;padding:20px 24px;color:#fff;">
        <h2 style="margin:0;font-size:22px;">🏏 CricAuction Account Security</h2>
      </div>
      <div style="padding:24px;line-height:1.6;">
        <p style="margin-top:0;">Hello ${organizerName || 'Organizer'},</p>
        <p>We received a request to reset your CricAuction account password. Click the button below to continue:</p>
        <p style="text-align:center;margin:28px 0;">
          <a href="${resetLink}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;display:inline-block;">Reset Password</a>
        </p>
        <p style="font-size:14px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;padding:10px;border-radius:8px;">
          ⏰ This link will expire in <strong>20 minutes</strong> and can be used only once.
        </p>
        <p style="font-size:13px;color:#374151;background:#f9fafb;border:1px solid #e5e7eb;padding:10px;border-radius:8px;">
          Security note: If you did not request this reset, please ignore this email. Your password will remain unchanged.
        </p>
        <p style="font-size:12px;color:#6b7280;word-break:break-all;">If the button does not work, use this link:<br/>${resetLink}</p>
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
    user = new User({ name, phone, email: normalizedEmail, password: hashedPassword, plan: 'Basic', role: 'Organizer', maxDevicesAllowed: 1, isActive: true });
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

    const activeDeviceIds = await getActiveDeviceIdsForUser(user._id);
    await User.updateOne({ _id: user._id }, { $set: { activeDevices: activeDeviceIds } });

    if (normalizedDeviceId) {
      if (user.role !== 'SuperAdmin' && !activeDeviceIds.includes(normalizedDeviceId) && activeDeviceIds.length >= user.maxDevicesAllowed) {
        return res.status(403).json({ message: `लॉगिन लिमिट पूरी हो गई है! आपका प्लान सिर्फ ${user.maxDevicesAllowed} डिवाइस की अनुमति देता है।` });
      }
    }

    const { token, expiresAt } = await createSessionAndToken({ user, deviceId: normalizedDeviceId, ipAddress: req.ip, userAgent: req.get('user-agent') });
    if (normalizedDeviceId && !activeDeviceIds.includes(normalizedDeviceId)) {
      await User.updateOne({ _id: user._id }, { $set: { activeDevices: [...activeDeviceIds, normalizedDeviceId] } });
    }
    const normalizedPlan = resolveEffectivePlan(user);
    const requiresEmailUpdate = !user.email;

    res.json({ message: 'लॉगिन सफल!', token, sessionExpiresAt: expiresAt, requiresEmailUpdate, user: { name: user.name, phone: user.phone, email: user.email, role: user.role, plan: normalizedPlan } });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'सर्वर क्रैश प्रोटेक्शन: डेटा फॉर्मेट सही नहीं है!' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'ईमेल आवश्यक है।' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) return res.status(400).json({ message: 'मान्य ईमेल दर्ज करें।' });

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.json({ message: 'यदि ईमेल मौजूद होगा तो लिंक भेज दिया जाएगा।' });

    const rawToken = createResetToken();
    const hashedToken = hashToken(rawToken);
    const tokenExpiry = new Date(Date.now() + 20 * 60 * 1000);
    await User.updateOne(
      { _id: user._id },
      { $set: { resetPasswordToken: hashedToken, resetPasswordExpire: tokenExpiry } }
    );

    const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const resetLink = `${base}/reset-password/${rawToken}`;

    try {
      await ensureSmtpReady();
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: 'CricAuction Password Reset Request',
        text: `Reset your CricAuction password: ${resetLink}\nThis link expires in 20 minutes and can be used once.`,
        html: buildResetMailHtml({ organizerName: user.name, resetLink })
      });
    } catch (mailError) {
      await User.updateOne(
        { _id: user._id },
        { $set: { resetPasswordToken: null, resetPasswordExpire: null } }
      );

      if (mailError.code === 'EAUTH') return res.status(502).json({ message: 'SMTP authentication failed. कृपया SMTP credentials जांचें।' });
      if (mailError.code === 'SMTP_CONFIG_MISSING') return res.status(500).json({ message: 'SMTP configuration missing on server.' });
      return res.status(502).json({ message: 'ईमेल डिलीवरी असफल रही। कृपया कुछ देर बाद पुनः प्रयास करें।' });
    }

    res.json({ message: 'यदि ईमेल मौजूद होगा तो लिंक भेज दिया जाएगा।' });
  } catch (e) {
    console.error('forgot-password error:', e);
    res.status(500).json({ message: 'Reset लिंक भेजने में दिक्कत।' });
  }
});

router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ message: 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए।' });
    if (password !== confirmPassword) return res.status(400).json({ message: 'पासवर्ड मैच नहीं कर रहे।' });

    const hashed = hashToken(req.params.token);
    const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpire: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: 'टोकन अमान्य या एक्सपायर हो चुका है।' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword, resetPasswordToken: null, resetPasswordExpire: null } }
    );

    res.json({ message: 'पासवर्ड सफलतापूर्वक अपडेट हो गया।' });
  } catch (e) {
    res.status(500).json({ message: 'पासवर्ड रीसेट में एरर।' });
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

module.exports = router;
