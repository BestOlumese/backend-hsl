import express from 'express';
import { githubAuth, githubCallback, refresh, logout, getMe } from '../controllers/auth.controller.js';
import { authRateLimiter } from '../middleware/rate-limiter.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/github', githubAuth);
router.get('/github/callback', githubCallback);
router.post('/github/callback', githubCallback); // For CLI
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.get('/me/profile', authenticate, getMe); // Extra alias

export default router;
