import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { isOllamaAvailable } from '../services/ai-factory';
import { config } from '../config/env';
import { AppError } from '../utils/AppError';
import bcrypt from 'bcryptjs';

export class AdminController {
  // System health
  async getHealth(req: Request, res: Response, next: NextFunction) {
    try {
      // Test DB
      let dbHealthy = false;
      try {
        await prisma.$queryRaw`SELECT 1`;
        dbHealthy = true;
      } catch {}

      const googleConnections = await prisma.googleConnection.count({ where: { status: 'CONNECTED' } });

      res.json({
        success: true,
        data: {
          database: { status: dbHealthy ? 'healthy' : 'unhealthy' },
          ai: {
            status: isOllamaAvailable() ? 'healthy' : 'fallback',
            provider: config.AI_PROVIDER,
            model: config.AI_MODEL,
            baseUrl: config.AI_BASE_URL,
            ollamaAvailable: isOllamaAvailable(),
          },
          google: {
            configured: !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET),
            activeConnections: googleConnections,
          },
          server: {
            uptime: process.uptime(),
            nodeVersion: process.version,
            environment: config.NODE_ENV,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // AI config
  async getAIConfig(_req: Request, res: Response) {
    res.json({
      success: true,
      data: {
        provider: config.AI_PROVIDER,
        model: config.AI_MODEL,
        baseUrl: config.AI_BASE_URL,
        ollamaAvailable: isOllamaAvailable(),
      },
    });
  }

  // Business management
  async listBusinesses(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;

      const [businesses, total] = await Promise.all([
        prisma.business.findMany({
          include: { category: true, members: { include: { user: true }, take: 1 }, _count: { select: { sessions: true, questions: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.business.count(),
      ]);

      res.json({
        success: true,
        data: businesses.map(b => ({
          ...b,
          owner: b.members[0]?.user?.name || 'Unknown',
          ownerEmail: b.members[0]?.user?.email || 'Unknown',
          sessionCount: b._count.sessions,
          questionCount: b._count.questions,
        })),
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      });
    } catch (err) {
      next(err);
    }
  }

  async createBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, slug, categoryId, isDemo, description, address, phone, website, ownerEmail, ownerName, ownerPassword } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: { name, slug, categoryId, isDemo: isDemo || false, description, address, phone, website },
        });

        // If owner details provided, create user and link
        if (ownerEmail) {
          let user = await tx.user.findUnique({ where: { email: ownerEmail } });
          if (!user) {
            const passwordHash = await bcrypt.hash(ownerPassword || 'changeme123', 12);
            user = await tx.user.create({
              data: { email: ownerEmail, passwordHash, name: ownerName || name, role: 'BUSINESS_OWNER' },
            });
          }
          await tx.businessMember.create({
            data: { userId: user.id, businessId: business.id, role: 'OWNER' },
          });
        }

        // Copy question templates if category selected
        if (categoryId) {
          const templates = await tx.questionTemplate.findMany({
            where: { categoryId, isActive: true },
            orderBy: { sortOrder: 'asc' },
          });
          for (const t of templates) {
            await tx.businessQuestion.create({
              data: { businessId: business.id, text: t.text, sortOrder: t.sortOrder },
            });
          }
        }

        return business;
      });

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const business = await prisma.business.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json({ success: true, data: business });
    } catch (err) {
      next(err);
    }
  }

  async deleteBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.business.delete({ where: { id: req.params.id } });
      res.json({ success: true, data: { message: 'Business deleted' } });
    } catch (err) {
      next(err);
    }
  }

  // Categories
  async listCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await prisma.category.findMany({
        include: { _count: { select: { businesses: true, questionTemplates: true } } },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, slug } = req.body;
      const category = await prisma.category.create({ data: { name, slug } });
      res.status(201).json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
      res.json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.category.delete({ where: { id: req.params.id } });
      res.json({ success: true, data: { message: 'Category deleted' } });
    } catch (err) {
      next(err);
    }
  }

  // Question Templates
  async getTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await prisma.questionTemplate.findMany({
        where: { categoryId: req.params.categoryId },
        orderBy: { sortOrder: 'asc' },
      });
      res.json({ success: true, data: templates });
    } catch (err) {
      next(err);
    }
  }

  async createTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await prisma.questionTemplate.create({
        data: { ...req.body, categoryId: req.params.categoryId },
      });
      res.status(201).json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  }

  async updateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await prisma.questionTemplate.update({
        where: { id: req.params.templateId },
        data: req.body,
      });
      res.json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  }

  async deleteTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.questionTemplate.delete({ where: { id: req.params.templateId } });
      res.json({ success: true, data: { message: 'Template deleted' } });
    } catch (err) {
      next(err);
    }
  }

  // Users
  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, createdAt: true, memberships: { include: { business: { select: { name: true, slug: true } } } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  }

  // Stats for admin dashboard
  async getStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const [businessCount, userCount, sessionCount, categoryCount] = await Promise.all([
        prisma.business.count(),
        prisma.user.count(),
        prisma.reviewSession.count(),
        prisma.category.count(),
      ]);
      res.json({ success: true, data: { businessCount, userCount, sessionCount, categoryCount } });
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();
