import { Router } from 'express';
import { businessController } from '../controllers/business.controller';
import { googleController } from '../controllers/google.controller';
import { requireAuth } from '../middleware/auth';
import { requireBusinessAccess } from '../middleware/businessAccess';
import { validate } from '../middleware/validate';
import { createQuestionSchema, updateQuestionSchema, reorderQuestionsSchema, updateBusinessSchema, createInsightSchema, updateInsightSchema, reorderInsightsSchema } from '../validators/business.validators';
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

// Insight chips
router.get('/:businessId/insights', requireAuth, requireBusinessAccess(), businessController.getInsights);
router.post('/:businessId/insights', requireAuth, requireBusinessAccess(), validate(createInsightSchema), businessController.createInsight);
router.put('/:businessId/insights/reorder', requireAuth, requireBusinessAccess(), validate(reorderInsightsSchema), businessController.reorderInsights);
router.post('/:businessId/insights/reset', requireAuth, requireBusinessAccess(), businessController.resetInsights);
router.put('/:businessId/insights/:insightId', requireAuth, requireBusinessAccess(), validate(updateInsightSchema), businessController.updateInsight);
router.delete('/:businessId/insights/:insightId', requireAuth, requireBusinessAccess(), businessController.deleteInsight);

// Feedback & Analytics
router.get('/:businessId/feedback', requireAuth, requireBusinessAccess(), businessController.getFeedback);
router.get('/:businessId/analytics', requireAuth, requireBusinessAccess(), businessController.getAnalytics);

// QR
router.get('/:businessId/qr', requireAuth, requireBusinessAccess(), businessController.getQR);
router.get('/:businessId/qr/config', requireAuth, requireBusinessAccess(), businessController.getQRConfig);

// AI (with stricter rate limit)
router.get('/:businessId/ai/insights', requireAuth, requireBusinessAccess(), businessController.getAIInsights);
router.post('/:businessId/ai/reply', requireAuth, requireBusinessAccess(), aiLimiter, googleController.generateAIReply);

// Data management
router.delete('/:businessId/reset-data', requireAuth, requireBusinessAccess(), businessController.resetData);

export default router;
