import { Router } from 'express';
import {
  createProfile,
  getSingleProfile,
  getAllProfiles,
  searchProfiles,
  deleteProfile,
  exportProfiles
} from '../controllers/profile.controller.js';
import { authenticate, authorize, versionCheck } from '../middleware/auth.middleware.js';
import { apiRateLimiter } from '../middleware/rate-limiter.js';

const router = Router();

// Apply global middlewares for all profile routes
router.use(versionCheck);
router.use(authenticate);
router.use(apiRateLimiter);

router.get('/profiles', getAllProfiles);
router.get('/profiles/search', searchProfiles);
router.get('/profiles/export', exportProfiles);
router.get('/profiles/:id', getSingleProfile);

// Admin only routes
router.post('/profiles', authorize(['admin']), createProfile);
router.delete('/profiles/:id', authorize(['admin']), deleteProfile);

export default router;
