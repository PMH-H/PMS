import { Router } from 'express';
import { getNotifications, markRead } from './notification.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getNotifications);
router.post('/:id/read', authenticate, markRead);

export default router;
