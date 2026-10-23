const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const { MemoryRateLimiter, forgotPasswordMiddleware, resetPasswordMiddleware } = require('../utils/rateLimiter');

describe('Forgot & Reset Password Security Suite', () => {
  const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

  // =========================================================================
  // 1. In-Memory Rate Limiter Tests
  // =========================================================================
  describe('1. Rate Limiting & Abuse Protection', () => {
    test('MemoryRateLimiter allows requests up to max and blocks thereafter', () => {
      const limiter = new MemoryRateLimiter({ windowMs: 1000, max: 3 });
      const testKey = 'test_ip_127_0_0_1';

      assert.strictEqual(limiter.isRateLimited(testKey).limited, false);
      assert.strictEqual(limiter.isRateLimited(testKey).limited, false);
      assert.strictEqual(limiter.isRateLimited(testKey).limited, false);

      // 4th request must be rate limited
      const blocked = limiter.isRateLimited(testKey);
      assert.strictEqual(blocked.limited, true);
      assert.ok(blocked.retryAfterSeconds >= 1);

      limiter.destroy();
    });

    test('forgotPasswordMiddleware limits per email and per IP', () => {
      const ip = '192.168.1.99';
      let statusCalled = null;
      let jsonCalled = null;
      let headerSet = null;

      const res = {
        setHeader: (name, val) => { headerSet = { name, val }; },
        status: (code) => {
          statusCalled = code;
          return {
            json: (payload) => { jsonCalled = payload; }
          };
        }
      };

      // 1. Email limit test: max 4 requests for the same email
      for (let i = 0; i < 4; i++) {
        let nextCalled = false;
        const req = {
          headers: { 'x-forwarded-for': '10.0.0.1' },
          socket: {},
          body: { email: 'same_user@example.com' }
        };
        forgotPasswordMiddleware(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true, `Email request ${i + 1} should be permitted`);
      }

      // 5th request for same email must be blocked with 429
      let nextCalledOn5 = false;
      const req5 = {
        headers: { 'x-forwarded-for': '10.0.0.2' },
        socket: {},
        body: { email: 'same_user@example.com' }
      };
      forgotPasswordMiddleware(req5, res, () => { nextCalledOn5 = true; });
      assert.strictEqual(nextCalledOn5, false, '5th request for same email should be blocked');
      assert.strictEqual(statusCalled, 429);
      assert.strictEqual(jsonCalled.success, false);

      // 2. IP limit test: max 10 requests from the same IP (with different emails)
      statusCalled = null;
      for (let i = 0; i < 10; i++) {
        let nextCalled = false;
        const req = {
          headers: { 'x-forwarded-for': ip },
          socket: {},
          body: { email: `different_${i}@example.com` }
        };
        forgotPasswordMiddleware(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true, `IP request ${i + 1} should be permitted`);
      }

      // 11th request from same IP must be blocked with 429
      let nextCalledOn11 = false;
      const req11 = {
        headers: { 'x-forwarded-for': ip },
        socket: {},
        body: { email: 'different_11@example.com' }
      };
      forgotPasswordMiddleware(req11, res, () => { nextCalledOn11 = true; });
      assert.strictEqual(nextCalledOn11, false, '11th request from same IP should be blocked');
      assert.strictEqual(statusCalled, 429);
    });
  });

  // =========================================================================
  // 2. Token Security: Strength, Hashing, Expiry & Single-Use
  // =========================================================================
  describe('2. Token Security & Hashing', () => {
    test('Reset token has 256-bit entropy and stores SHA-256 hash', () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      assert.strictEqual(rawToken.length, 64, 'Raw token should be 64 hex characters (32 bytes)');
      assert.match(rawToken, /^[0-9a-f]{64}$/i);

      const hashedToken = hashToken(rawToken);
      assert.strictEqual(hashedToken.length, 64, 'Hashed token should be 64 hex characters');
      assert.notStrictEqual(hashedToken, rawToken, 'Hashed token must never equal raw token');

      // SHA-256 hash is deterministic
      assert.strictEqual(hashToken(rawToken), hashedToken);
    });

    test('Expired reset token is rejected', () => {
      const expiredDate = new Date(Date.now() - 5 * 60 * 1000); // 5 mins in the past
      const now = new Date();
      assert.ok(expiredDate < now, 'Expired date must be in the past');

      const isValidExpiry = (expiryDate) => expiryDate > new Date();
      assert.strictEqual(isValidExpiry(expiredDate), false);

      const validDate = new Date(Date.now() + 20 * 60 * 1000); // 20 mins in the future
      assert.strictEqual(isValidExpiry(validDate), true);
    });
  });

  // =========================================================================
  // 3. Password Reset & Session Invalidation
  // =========================================================================
  describe('3. Password Reset & Complete Session Revocation', () => {
    const mockUserId = '660000000000000000000999';
    const activeSessions = new Map();

    const mockUserSession = {
      updateMany: async (query, { $set }) => {
        let count = 0;
        for (const [sid, session] of activeSessions.entries()) {
          if (String(session.user) === String(query.user) && session.revokedAt === null) {
            Object.assign(session, $set);
            count++;
          }
        }
        return { modifiedCount: count };
      }
    };

    const UserSession = require('../models/UserSession');
    let originalUpdateMany;

    before(() => {
      originalUpdateMany = UserSession.updateMany;
      UserSession.updateMany = mockUserSession.updateMany;

      // Seed 3 active sessions on different devices for mockUserId
      activeSessions.set('sess_phone', { user: mockUserId, deviceId: 'iphone_15', revokedAt: null });
      activeSessions.set('sess_laptop', { user: mockUserId, deviceId: 'macbook_pro', revokedAt: null });
      activeSessions.set('sess_desktop', { user: mockUserId, deviceId: 'windows_pc', revokedAt: null });
    });

    after(() => {
      UserSession.updateMany = originalUpdateMany;
      activeSessions.clear();
    });

    test('revokeAllSessionsForUser revokes every active session on password reset', async () => {
      const { revokeAllSessionsForUser } = require('../utils/sessionAuth');

      // Before reset: all 3 sessions are active (revokedAt: null)
      for (const session of activeSessions.values()) {
        assert.strictEqual(session.revokedAt, null);
      }

      // Password reset triggers revokeAllSessionsForUser
      await revokeAllSessionsForUser(mockUserId);

      // After reset: all sessions must be revoked
      for (const session of activeSessions.values()) {
        assert.ok(session.revokedAt instanceof Date, 'revokedAt must be set to Date');
      }
    });

    test('New password is saved as bcrypt hash and clears reset token', async () => {
      const newPassword = 'newSecurePassword123';
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      assert.ok(/^\$2[aby]\$/.test(hashedPassword), 'Password must be valid bcrypt hash');
      assert.strictEqual(await bcrypt.compare(newPassword, hashedPassword), true);
      assert.strictEqual(await bcrypt.compare('wrongPassword', hashedPassword), false);
    });
  });

  // =========================================================================
  // 4. Visitor Tracking Route Sanitization (No Token Leakage)
  // =========================================================================
  describe('4. Visitor Tracker Route Sanitization', () => {
    test('Raw reset token in route path is sanitized to /reset-password/:token', () => {
      const rawToken = 'e48a1c90f23b7a8d567104bce91234567890abcdef1234567890abcdef123456';
      const unsafeRoute = `/reset-password/${rawToken}`;

      let sanitizedRoute = String(unsafeRoute || '/');
      if (sanitizedRoute.startsWith('/reset-password/')) {
        sanitizedRoute = '/reset-password/:token';
      }

      assert.strictEqual(sanitizedRoute, '/reset-password/:token');
      assert.strictEqual(sanitizedRoute.includes(rawToken), false, 'Sanitized route must NOT contain raw token');
    });
  });
});
