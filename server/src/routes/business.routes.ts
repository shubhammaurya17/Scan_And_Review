import { Router } from 'express';
import { businessController } from '../controllers/business.controller';
import { googleController } from '../controllers/google.controller';
import { requireAuth } from '../middleware/auth';
import { requireBusinessAccess } from '../middleware/businessAccess';
import { validate } from '../middleware/validate';
import { createQuestionSchema, updateQuestionSchema, reorderQuestionsSchema, updateBusinessSchema } from '../validators/business.validators';
import { aiLimiter } from '../middleware/rateLimit';

const router = Router();

// Public
router.get('/categories', businessController.getCategories);

// Protected
router.get('/:businessId', requireAuth, requireBusinessAccess(), businessController.getBusiness);
router.put('/:businessId', requireAuth, requireBusinessAccess(), validate(updateBusinessSchema), businessController.updateBusiness);

// Questions
router.get('/:businessId/questions', requireAuth, requireBusinessAccess(), businessController.getQuestions);
router.post('/:businessId/questions', requireAuth, requireBusinessAccess(), validate(createQuestionSchema), businessController.createQuestion);
router.put('/:businessId/questions/:questionId', requireAuth, requireBusinessAccess(), validate(updateQuestionSchema), businessController.updateQuestion);
router.delete('/:businessId/questions/:questionId', requireAuth, requireBusinessAccess(), businessController.deleteQuestion);
router.put('/:businessId/questions/reorder', requireAuth, requireBusinessAccess(), validate(reorderQuestionsSchema), businessController.reorderQuestions);

// Feedback & Analytics
router.get('/:businessId/feedback', requireAuth, requireBusinessAccess(), businessController.getFeedback);
router.get('/:businessId/analytics', requireAuth, requireBusinessAccess(), businessController.getAnalytics);

// QR
router.get('/:businessId/qr', requireAuth, requireBusinessAccess(), businessController.getQR);
router.get('/:businessId/qr/config', requireAuth, requireBusinessAccess(), businessController.getQRConfig);

// AI (with stricter rate limit)
router.get('/:businessId/ai/insights', requireAuth, requireBusinessAccess(), businessController.getAIInsights);
router.post('/:businessId/ai/reply', requireAuth, requireBusinessAccess(), aiLimiter, googleController.generateAIReply);

export default router;
