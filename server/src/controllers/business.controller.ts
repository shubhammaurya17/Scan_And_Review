import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { analyticsService } from '../services/analytics.service';
import { qrService } from '../services/qr.service';
import { AppError } from '../utils/AppError';

export class BusinessController {
  async getBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const business = await prisma.business.findUnique({
        where: { id: req.params.businessId },
        include: { category: true, qrConfig: true },
      });
      if (!business) throw new AppError('Business not found', 404);
      res.json({ success: true, data: business });
    } catch (err) {
      next(err);
    }
  }

  async updateBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const business = await prisma.business.update({
        where: { id: req.params.businessId },
        data: req.body,
      });
      res.json({ success: true, data: business });
    } catch (err) {
      next(err);
    }
  }

  // Questions CRUD
  async getQuestions(req: Request, res: Response, next: NextFunction) {
    try {
      const questions = await prisma.businessQuestion.findMany({
        where: { businessId: req.params.businessId },
        orderBy: { sortOrder: 'asc' },
      });
      res.json({ success: true, data: questions });
    } catch (err) {
      next(err);
    }
  }

  async createQuestion(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.params;
      const count = await prisma.businessQuestion.count({
        where: { businessId, isActive: true },
      });
      if (count >= 5) throw new AppError('Maximum 5 active questions allowed', 400);

      const maxOrder = await prisma.businessQuestion.findFirst({
        where: { businessId },
        orderBy: { sortOrder: 'desc' },
      });

      const question = await prisma.businessQuestion.create({
        data: {
          businessId,
          text: req.body.text,
          sortOrder: req.body.sortOrder ?? (maxOrder ? maxOrder.sortOrder + 1 : 0),
        },
      });
      res.status(201).json({ success: true, data: question });
    } catch (err) {
      next(err);
    }
  }

  async updateQuestion(req: Request, res: Response, next: NextFunction) {
    try {
      const question = await prisma.businessQuestion.update({
        where: { id: req.params.questionId },
        data: req.body,
      });
      res.json({ success: true, data: question });
    } catch (err) {
      next(err);
    }
  }

  async deleteQuestion(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.businessQuestion.delete({
        where: { id: req.params.questionId },
      });
      res.json({ success: true, data: { message: 'Question deleted' } });
    } catch (err) {
      next(err);
    }
  }

  async reorderQuestions(req: Request, res: Response, next: NextFunction) {
    try {
      const { questionIds } = req.body;
      await prisma.$transaction(
        questionIds.map((id: string, index: number) =>
          prisma.businessQuestion.update({
            where: { id },
            data: { sortOrder: index },
          })
        )
      );
      res.json({ success: true, data: { message: 'Questions reordered' } });
    } catch (err) {
      next(err);
    }
  }

  // Feedback
  async getFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;

      const data = await analyticsService.getRecentFeedback(businessId, page, pageSize, rating);
      res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }

  // Analytics
  async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.params;
      const period = (req.query.period as string) || '30d';

      const endDate = new Date();
      const startDate = new Date();
      if (period === '7d') startDate.setDate(endDate.getDate() - 7);
      else if (period === 'today') startDate.setHours(0, 0, 0, 0);
      else if (period === '3m') startDate.setMonth(endDate.getMonth() - 3);
      else if (period === '6m') startDate.setMonth(endDate.getMonth() - 6);
      else startDate.setDate(endDate.getDate() - 30);

      const [funnel, feedback, googleReviewTrend] = await Promise.all([
        analyticsService.getFunnelMetrics(businessId, startDate, endDate),
        analyticsService.getFeedbackStats(businessId, startDate, endDate),
        analyticsService.getGoogleReviewTrend(businessId, startDate, endDate),
      ]);

      res.json({ success: true, data: { funnel, feedback, googleReviewTrend } });
    } catch (err) {
      next(err);
    }
  }

  // QR
  async getQR(req: Request, res: Response, next: NextFunction) {
    try {
      const business = await prisma.business.findUnique({
        where: { id: req.params.businessId },
      });
      if (!business) throw new AppError('Business not found', 404);

      const format = (req.query.format as string) === 'svg' ? 'svg' : 'png';
      const qr = await qrService.generateQR(business.slug, format);
      const reviewUrl = await qrService.getReviewUrl(business.slug);

      if (format === 'svg') {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(qr);
      } else {
        res.setHeader('Content-Type', 'image/png');
        res.send(qr);
      }
    } catch (err) {
      next(err);
    }
  }

  async getQRConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const business = await prisma.business.findUnique({
        where: { id: req.params.businessId },
        include: { qrConfig: true },
      });
      if (!business) throw new AppError('Business not found', 404);

      const reviewUrl = await qrService.getReviewUrl(business.slug);
      res.json({
        success: true,
        data: {
          config: business.qrConfig || { foregroundColor: '#000000', backgroundColor: '#FFFFFF', style: 'SQUARE' },
          reviewUrl,
          slug: business.slug,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // AI Insights
  async getAIInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.params;
      const { aiAnalysisService } = await import('../services/ai-analysis.service');
      const result = await aiAnalysisService.generateInsights(businessId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Categories (for signup)
  async getCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }

  // Reset all business data
  async resetData(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await analyticsService.resetBusinessData(req.params.businessId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Insight chips CRUD
  async getInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.params;
      let insights = await prisma.businessInsight.findMany({
        where: { businessId },
        orderBy: { sortOrder: 'asc' },
      });

      // Fall back to category templates if no business-specific insights
      if (insights.length === 0) {
        const business = await prisma.business.findUnique({
          where: { id: businessId },
          select: { categoryId: true },
        });
        if (business?.categoryId) {
          const templates = await prisma.insightTemplate.findMany({
            where: { categoryId: business.categoryId, isActive: true },
            orderBy: { sortOrder: 'asc' },
          });
          res.json({
            success: true,
            data: templates.map(t => ({ ...t, isDefault: true })),
          });
          return;
        }
      }

      res.json({ success: true, data: insights });
    } catch (err) {
      next(err);
    }
  }

  async createInsight(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.params;
      const { label } = req.body;
      const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      const maxOrder = await prisma.businessInsight.findFirst({
        where: { businessId },
        orderBy: { sortOrder: 'desc' },
      });

      const insight = await prisma.businessInsight.create({
        data: {
          businessId,
          label,
          slug,
          sortOrder: maxOrder ? maxOrder.sortOrder + 1 : 0,
          isCustom: true,
        },
      });
      res.status(201).json({ success: true, data: insight });
    } catch (err) {
      next(err);
    }
  }

  async updateInsight(req: Request, res: Response, next: NextFunction) {
    try {
      const insight = await prisma.businessInsight.update({
        where: { id: req.params.insightId },
        data: req.body,
      });
      res.json({ success: true, data: insight });
    } catch (err) {
      next(err);
    }
  }

  async deleteInsight(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.businessInsight.delete({
        where: { id: req.params.insightId },
      });
      res.json({ success: true, data: { message: 'Insight deleted' } });
    } catch (err) {
      next(err);
    }
  }

  async reorderInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const { insightIds } = req.body;
      await prisma.$transaction(
        insightIds.map((id: string, index: number) =>
          prisma.businessInsight.update({
            where: { id },
            data: { sortOrder: index },
          })
        )
      );
      res.json({ success: true, data: { message: 'Insights reordered' } });
    } catch (err) {
      next(err);
    }
  }

  async resetInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessId } = req.params;
      await prisma.businessInsight.deleteMany({ where: { businessId } });
      res.json({ success: true, data: { message: 'Insights reset to category defaults' } });
    } catch (err) {
      next(err);
    }
  }
}

export const businessController = new BusinessController();
