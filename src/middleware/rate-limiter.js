import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: { status: 'error', message: 'Too many requests, please try again after a minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  keyGenerator: (req) => req.user ? req.user.id : req.ip,
  message: { status: 'error', message: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGenerator: false },
});
