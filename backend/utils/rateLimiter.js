/**
 * In-Memory Sliding-Window Rate Limiter
 * 
 * Features:
 * - Zero external dependencies / 100% free
 * - Per-IP and per-identifier (e.g. email or token) tracking
 * - Automatic background garbage collection of expired buckets
 * - Standard HTTP 429 response with Retry-After header
 */

class MemoryRateLimiter {
  constructor({ windowMs = 15 * 60 * 1000, max = 5, message = 'Too many requests' } = {}) {
    this.windowMs = windowMs;
    this.max = max;
    this.message = message;
    this.hits = new Map(); // key -> array of timestamps

    // Periodically sweep expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref(); // Do not hold open Node process in tests
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter(t => now - t < this.windowMs);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }

  isRateLimited(key) {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];
    const valid = timestamps.filter(t => now - t < this.windowMs);

    if (valid.length >= this.max) {
      const oldestHit = valid[0];
      const resetTimeMs = oldestHit + this.windowMs - now;
      const retryAfterSeconds = Math.max(1, Math.ceil(resetTimeMs / 1000));
      return { limited: true, retryAfterSeconds };
    }

    valid.push(now);
    this.hits.set(key, valid);
    return { limited: false, remaining: this.max - valid.length };
  }

  resetKey(key) {
    this.hits.delete(key);
  }

  resetAll() {
    this.hits.clear();
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.hits.clear();
  }
}

// 1. Forgot password limits:
// IP limit: max 10 requests per 15 minutes
const forgotPasswordIpLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'बहुत अधिक अनुरोध भेजे गए हैं। कृपया 15 मिनट बाद पुनः प्रयास करें।'
});

// Email limit: max 4 requests per 15 minutes for the same email
const forgotPasswordEmailLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 4,
  message: 'इस ईमेल के लिए बहुत अधिक रीसेट अनुरोध भेजे गए हैं। कृपया कुछ समय बाद जांचें।'
});

// 2. Reset password submission limits:
// IP limit: max 15 attempts per 15 minutes
const resetPasswordIpLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'बहुत अधिक प्रयास किए गए। कृपया 15 मिनट बाद पुनः प्रयास करें।'
});

// Middleware for POST /forgot-password
const forgotPasswordMiddleware = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
  const ipKey = `fp_ip_${ip}`;

  const ipCheck = forgotPasswordIpLimiter.isRateLimited(ipKey);
  if (ipCheck.limited) {
    res.setHeader('Retry-After', ipCheck.retryAfterSeconds);
    return res.status(429).json({
      success: false,
      message: forgotPasswordIpLimiter.message,
      retryAfter: ipCheck.retryAfterSeconds
    });
  }

  const rawEmail = String(req.body?.email || '').trim().toLowerCase();
  if (rawEmail) {
    const emailKey = `fp_email_${rawEmail}`;
    const emailCheck = forgotPasswordEmailLimiter.isRateLimited(emailKey);
    if (emailCheck.limited) {
      res.setHeader('Retry-After', emailCheck.retryAfterSeconds);
      return res.status(429).json({
        success: false,
        message: forgotPasswordEmailLimiter.message,
        retryAfter: emailCheck.retryAfterSeconds
      });
    }
  }

  next();
};

// Middleware for POST /reset-password/:token
const resetPasswordMiddleware = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
  const ipKey = `rp_ip_${ip}`;

  const ipCheck = resetPasswordIpLimiter.isRateLimited(ipKey);
  if (ipCheck.limited) {
    res.setHeader('Retry-After', ipCheck.retryAfterSeconds);
    return res.status(429).json({
      success: false,
      message: resetPasswordIpLimiter.message,
      retryAfter: ipCheck.retryAfterSeconds
    });
  }

  next();
};

module.exports = {
  MemoryRateLimiter,
  forgotPasswordIpLimiter,
  forgotPasswordEmailLimiter,
  resetPasswordIpLimiter,
  forgotPasswordMiddleware,
  resetPasswordMiddleware
};
