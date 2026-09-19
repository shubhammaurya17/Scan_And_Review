import { Router } from 'express';
import { reviewController } from '../controllers/review.controller';
import { validate } from '../middleware/validate';
import { submitFeedbackSchema, generateDraftsSchema, selectDraftSchema, handoffSchema } from '../validators/review.validators';

const router = Router();

// All public — no auth required
router.get('/:slug', reviewController.getBusinessInfo);
router.post('/:slug/session', reviewController.startSession);
router.post('/:slug/feedback', validate(submitFeedbackSchema), reviewController.submitFeedback);
router.post('/:slug/drafts', validate(generateDraftsSchema), reviewController.generateDrafts);
router.post('/:slug/select', validate(selectDraftSchema), reviewController.selectDraft);
router.post('/:slug/handoff', validate(handoffSchema), reviewController.recordHandoff);

export default router;
