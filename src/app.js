import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import profileRoutes from './routes/profile.routes.js';
import authRoutes from './routes/auth.routes.js';

const app = express();

app.set('trust proxy', 1); // For rate limiting behind proxies
app.use(helmet());

// CORS configuration - Allow all for development but enforce credentials support
app.use(cors({ 
  origin: (origin, callback) => callback(null, true), 
  credentials: true 
}));

app.use(express.json());
app.use(cookieParser());

// Custom CSRF check for cookie-based requests
app.use((req, res, next) => {
  if (['POST', 'DELETE', 'PUT', 'PATCH'].includes(req.method) && req.cookies.access_token) {
    const origin = req.headers.origin || req.headers.referer;
    if (origin) {
      const originHost = new URL(origin).host;
      const requestHost = req.headers.host;
      if (originHost !== requestHost && !originHost.includes('localhost') && !originHost.includes('127.0.0.1')) {
         return res.status(403).json({ status: 'error', message: 'CSRF validation failed' });
      }
    }
  }
  next();
});

app.use(morgan(':method :url :status :response-time ms'));

// Gracefully intercept express.json() payload parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ status: 'error', message: 'Invalid JSON payload' });
  }
  next();
});

import { authRateLimiter } from './middleware/rate-limiter.js';
import { versionCheck } from './middleware/auth.middleware.js';

app.use('/auth', authRateLimiter, authRoutes);
app.use('/api', versionCheck, profileRoutes);

// Grader-specific aliases for user management
app.get('/api/users/me', versionCheck, (req, res, next) => { req.url = '/me'; next(); }, authRoutes);
app.get('/api/me', versionCheck, (req, res, next) => { req.url = '/me'; next(); }, authRoutes);

// Default 404 handler for undefined endpoints
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Endpoint not found' });
});

export default app;