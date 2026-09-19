import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics.service';

export class EventsController {
  async trackEvent(req: Request, res: Response, next: NextFunction) {
    try {
      await analyticsService.trackEvent(req.body);
      res.status(202).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

export const eventsController = new EventsController();
