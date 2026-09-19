import { Request, Response, NextFunction } from 'express';
import { reviewService } from '../services/review.service';

export class ReviewController {
  async getBusinessInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const data = await reviewService.getBusinessInfo(slug);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async startSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const data = await reviewService.startSession(slug, ip, userAgent);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async submitFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const data = await reviewService.submitFeedback(slug, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async generateDrafts(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const { sessionToken } = req.body;
      const data = await reviewService.generateDrafts(slug, sessionToken);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async selectDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const data = await reviewService.selectDraft(slug, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async recordHandoff(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const { sessionToken } = req.body;
      const data = await reviewService.recordHandoff(slug, sessionToken);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const reviewController = new ReviewController();
