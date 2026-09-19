import { Router } from 'express';
import { alertController } from '../controllers/alert.controller';
import { requireAuth } from '../middleware/auth';
import { requireBusinessAccess } from '../middleware/businessAccess';

const router = Router();

router.get('/:businessId/alerts', requireAuth, requireBusinessAccess(), alertController.getAlerts);
router.get('/:businessId/alerts/unread-count', requireAuth, requireBusinessAccess(), alertController.getUnreadCount);
router.put('/:businessId/alerts/read-all', requireAuth, requireBusinessAccess(), alertController.markAllRead);
router.put('/:businessId/alerts/:alertId/read', requireAuth, requireBusinessAccess(), alertController.markRead);
router.delete('/:businessId/alerts/:alertId', requireAuth, requireBusinessAccess(), alertController.deleteAlert);

export default router;
