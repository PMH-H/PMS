import { Router } from 'express';
import { bootstrap, getPrescriptions, uploadPrescription } from './client.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.get('/bootstrap', authenticate, bootstrap);
router.get('/prescriptions', authenticate, getPrescriptions);
router.post('/prescriptions/upload', authenticate, uploadPrescription); // New endpoint

export default router;
