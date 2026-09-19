import { Router } from 'express';
import reviewRoutes from './review.routes';
import authRoutes from './auth.routes';
import businessRoutes from './business.routes';
import eventsRoutes from './events.routes';

const router = Router();

router.use('/review', reviewRoutes);
router.use('/auth', authRoutes);
router.use('/business', businessRoutes);
router.use('/events', eventsRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

export default router;
