import { Router } from 'express';
import {
  createProfile,
  getSingleProfile,
  getAllProfiles,
  searchProfiles,
  deleteProfile
} from '../controllers/profile.controller.js';

const router = Router();

router.post('/profiles', createProfile);
router.get('/profiles', getAllProfiles);
router.get('/profiles/search', searchProfiles);
router.get('/profiles/:id', getSingleProfile);
router.delete('/profiles/:id', deleteProfile);

export default router;
