import { Request, Response, NextFunction } from 'express';
import { googleService } from '../services/google.service';
import { googleReviewsService } from '../services/google-reviews.service';
import { getAIService } from '../services/ai-factory';
import { prisma } from '../config/database';

export class GoogleController {
  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await googleService.getConnectionStatus(req.params.businessId);
      const business = await prisma.business.findUnique({
        where: { id: req.params.businessId },
        select: { googlePlaceId: true },
      });
      res.json({
        success: true,
        data: { ...status, hasPlaceId: !!business?.googlePlaceId },
      });
    } catch (err) {
      next(err);
    }
  }

  async getAuthUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const url = googleService.getAuthUrl(req.params.businessId);
      res.json({ success: true, data: { url } });
    } catch (err) {
      next(err);
    }
  }

  async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, state: businessId } = req.query;
      if (!code || !businessId) {
        return res.status(400).json({ success: false, error: 'Missing code or state' });
      }
      await googleService.handleCallback(code as string, businessId as string);
      // Redirect to dashboard google connection page
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/google-connection?status=connected`);
    } catch (err) {
      next(err);
    }
  }

  async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await googleService.disconnect(req.params.businessId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async syncReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await googleReviewsService.syncReviews(req.params.businessId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const result = await googleReviewsService.getReviews(req.params.businessId, page, pageSize);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async generateReply(req: Request, res: Response, next: NextFunction) {
    try {
      const { reviewId } = req.params;
      const { tone } = req.body;
      const business = await prisma.business.findUnique({ where: { id: req.params.businessId } });
      if (!business) return res.status(404).json({ success: false, error: 'Business not found' });

      const reply = await googleReviewsService.generateAndSaveReply(reviewId, tone || 'PROFESSIONAL', business.name);
      res.json({ success: true, data: reply });
    } catch (err) {
      next(err);
    }
  }

  async postReply(req: Request, res: Response, next: NextFunction) {
    try {
      const { reviewId } = req.params;
      const { replyText } = req.body;
      const result = await googleReviewsService.postReply(reviewId, replyText);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // General AI reply generation (not tied to Google review)
  async generateAIReply(req: Request, res: Response, next: NextFunction) {
    try {
      const { reviewText, tone } = req.body;
      const business = await prisma.business.findUnique({ where: { id: req.params.businessId } });
      if (!business) return res.status(404).json({ success: false, error: 'Business not found' });

      const aiService = getAIService();
      const reply = await aiService.generateReply(reviewText, business.name, tone || 'PROFESSIONAL');
      res.json({ success: true, data: { reply } });
    } catch (err) {
      next(err);
    }
  }
}

export const googleController = new GoogleController();
