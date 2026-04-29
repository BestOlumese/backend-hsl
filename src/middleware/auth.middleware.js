import { verifyAccessToken } from '../utils/auth.js';
import { getDb } from '../db/database.js';

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);
    
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id]);
    
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'User not found' });
    }

    if (!user.is_active) {
      return res.status(403).json({ status: 'error', message: 'Account is inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ status: 'error', message: 'Access token expired' });
    }
    return res.status(401).json({ status: 'error', message: 'Invalid access token' });
  }
};

export const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
    }

    next();
  };
};

export const versionCheck = (req, res, next) => {
  const version = req.headers['x-api-version'];
  if (version !== '1') {
    return res.status(400).json({ status: 'error', message: 'API version header required' });
  }
  next();
};
