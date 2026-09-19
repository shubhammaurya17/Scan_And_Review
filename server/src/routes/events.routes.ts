import { Router } from 'express';
import { eventsController } from '../controllers/events.controller';
import { validate } from '../middleware/validate';
import { trackEventSchema } from '../validators/review.validators';

const router = Router();

router.post('/', validate(trackEventSchema), eventsController.trackEvent);

export default router;
