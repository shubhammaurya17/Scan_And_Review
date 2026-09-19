import { Router } from 'express';
import { googleController } from '../controllers/google.controller';
import { requireAuth } from '../middleware/auth';
import { requireBusinessAccess } from '../middleware/businessAccess';

const router = Router();

// OAuth callback - public (Google redirects here)
router.get('/callback', googleController.handleCallback);

// All other routes require auth + business access
router.get('/:businessId/google/status', requireAuth, requireBusinessAccess(), googleController.getStatus);
router.get('/:businessId/google/auth-url', requireAuth, requireBusinessAccess(), googleController.getAuthUrl);
router.post('/:businessId/google/disconnect', requireAuth, requireBusinessAccess(), googleController.disconnect);
router.post('/:businessId/google/sync', requireAuth, requireBusinessAccess(), googleController.syncReviews);
router.get('/:businessId/google/reviews', requireAuth, requireBusinessAccess(), googleController.getReviews);
router.post('/:businessId/google/reviews/:reviewId/generate-reply', requireAuth, requireBusinessAccess(), googleController.generateReply);
router.post('/:businessId/google/reviews/:reviewId/post-reply', requireAuth, requireBusinessAccess(), googleController.postReply);
router.post('/:businessId/ai/reply', requireAuth, requireBusinessAccess(), googleController.generateAIReply);

export default router;
