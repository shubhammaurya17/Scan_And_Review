import { prisma } from '../config/database';
import { getAIService } from './ai-factory';
import { TemplateService } from './template.service';
import { AppError } from '../utils/AppError';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export class ReviewService {
  async getBusinessInfo(slug: string) {
    const business = await prisma.business.findUnique({
      where: { slug },
      include: {
        category: true,
        questions: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!business || !business.isActive) {
      throw new AppError('Business not found', 404);
    }

    return {
      business: {
        id: business.id,
        name: business.name,
        description: business.description,
        logoUrl: business.logoUrl,
        googleReviewUrl: business.googleReviewUrl,
        category: business.category?.name,
        isDemo: business.isDemo,
      },
      questions: business.questions.map(q => ({
        id: q.id,
        text: q.text,
        sortOrder: q.sortOrder,
      })),
    };
  }

  async startSession(slug: string, ipAddress?: string, userAgent?: string) {
    const business = await prisma.business.findUnique({ where: { slug } });
    if (!business || !business.isActive) {
      throw new AppError('Business not found', 404);
    }

    const ipHash = ipAddress
      ? crypto.createHash('sha256').update(ipAddress).digest('hex').substring(0, 16)
      : undefined;

    const session = await prisma.reviewSession.create({
      data: {
        businessId: business.id,
        sessionToken: uuidv4(),
        ipHash,
        userAgent: userAgent?.substring(0, 500),
      },
    });

    // Track funnel event
    await prisma.funnelEvent.create({
      data: {
        businessId: business.id,
        sessionId: session.id,
        eventType: 'SESSION_STARTED',
      },
    });

    return { sessionToken: session.sessionToken, businessId: business.id };
  }

  async submitFeedback(slug: string, data: {
    sessionToken: string;
    ratings: Array<{ questionId: string; rating: number }>;
    comment?: string;
  }) {
    const session = await prisma.reviewSession.findUnique({
      where: { sessionToken: data.sessionToken },
      include: { business: { include: { questions: { where: { isActive: true } } } } },
    });

    if (!session) throw new AppError('Session not found', 404);
    if (session.business.slug !== slug) throw new AppError('Session does not match business', 400);

    // Validate all active questions have ratings
    const activeQuestionIds = new Set(session.business.questions.map(q => q.id));
    for (const r of data.ratings) {
      if (!activeQuestionIds.has(r.questionId)) {
        throw new AppError(`Invalid question ID: ${r.questionId}`, 400);
      }
    }

    // Create responses
    await prisma.$transaction(async (tx) => {
      // Delete existing responses for this session (in case of re-submission)
      await tx.customerResponse.deleteMany({ where: { sessionId: session.id } });

      for (const r of data.ratings) {
        await tx.customerResponse.create({
          data: {
            sessionId: session.id,
            questionId: r.questionId,
            rating: r.rating,
          },
        });
      }

      if (data.comment) {
        await tx.customerFeedback.upsert({
          where: { sessionId: session.id },
          create: { sessionId: session.id, comment: data.comment },
          update: { comment: data.comment },
        });
      }

      await tx.reviewSession.update({
        where: { id: session.id },
        data: { status: data.comment ? 'COMMENT' : 'RATING' },
      });

      await tx.funnelEvent.create({
        data: {
          businessId: session.businessId,
          sessionId: session.id,
          eventType: 'RATING_COMPLETED',
        },
      });

      if (data.comment) {
        await tx.funnelEvent.create({
          data: {
            businessId: session.businessId,
            sessionId: session.id,
            eventType: 'COMMENT_SUBMITTED',
          },
        });
      }
    });

    // Non-blocking: check for alerts
    import('../services/alert.service').then(({ alertService }) => {
      alertService.checkAndCreateAlerts(session.businessId, session.id).catch(err => {
        console.error('Alert check failed:', err);
      });
    });

    return { success: true };
  }

  async generateDrafts(slug: string, sessionToken: string) {
    const session = await prisma.reviewSession.findUnique({
      where: { sessionToken },
      include: {
        responses: { include: { question: true } },
        feedback: true,
        business: { include: { category: true } },
      },
    });

    if (!session) throw new AppError('Session not found', 404);
    if (session.business.slug !== slug) throw new AppError('Session does not match business', 400);
    if (session.responses.length === 0) throw new AppError('No ratings submitted yet', 400);

    const ratings = session.responses.map(r => ({
      questionText: r.question.text,
      rating: r.rating,
    }));

    const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

    const draftInput = {
      businessName: session.business.name,
      categoryName: session.business.category?.name || 'Business',
      ratings,
      comment: session.feedback?.comment || undefined,
      averageRating,
    };

    let drafts: { style: string; content: string }[] = [];
    const aiService = getAIService();

    try {
      drafts = await aiService.generateReviewDrafts(draftInput);
      // Filter out any drafts with empty content
      drafts = drafts.filter(d => d.content && d.content.trim().length > 0);
    } catch (err) {
      console.error('AI service threw during draft generation:', err);
      // drafts stays [] — will trigger template fallback below
    }

    // If AI service returned fewer than 3 valid drafts, fall back to templates entirely
    if (drafts.length < 3) {
      if (drafts.length > 0) {
        console.warn(`AI service returned only ${drafts.length} valid drafts — falling back to template generation`);
      } else {
        console.warn('AI service returned 0 drafts — falling back to template generation');
      }
      const templateService = new TemplateService();
      drafts = await templateService.generateReviewDrafts(draftInput);
    }

    // Delete existing drafts for this session
    await prisma.reviewDraft.deleteMany({ where: { sessionId: session.id } });

    // Save drafts
    const savedDrafts = await Promise.all(
      drafts.map(d =>
        prisma.reviewDraft.create({
          data: {
            sessionId: session.id,
            style: d.style,
            content: d.content,
          },
        })
      )
    );

    await prisma.reviewSession.update({
      where: { id: session.id },
      data: { status: 'DRAFTS' },
    });

    await prisma.funnelEvent.create({
      data: {
        businessId: session.businessId,
        sessionId: session.id,
        eventType: 'DRAFTS_GENERATED',
      },
    });

    return savedDrafts.map(d => ({
      id: d.id,
      style: d.style,
      content: d.content,
    }));
  }

  async selectDraft(slug: string, data: {
    sessionToken: string;
    draftId: string;
    editedText?: string;
  }) {
    const session = await prisma.reviewSession.findUnique({
      where: { sessionToken: data.sessionToken },
      include: { business: true, drafts: true },
    });

    if (!session) throw new AppError('Session not found', 404);
    if (session.business.slug !== slug) throw new AppError('Session does not match business', 400);

    const draft = session.drafts.find(d => d.id === data.draftId);
    if (!draft) throw new AppError('Draft not found', 404);

    await prisma.$transaction(async (tx) => {
      // Deselect all drafts
      await tx.reviewDraft.updateMany({
        where: { sessionId: session.id },
        data: { isSelected: false },
      });

      // Select the chosen draft
      await tx.reviewDraft.update({
        where: { id: data.draftId },
        data: {
          isSelected: true,
          editedText: data.editedText || null,
        },
      });

      await tx.reviewSession.update({
        where: { id: session.id },
        data: { status: 'SELECTED' },
      });

      await tx.funnelEvent.create({
        data: {
          businessId: session.businessId,
          sessionId: session.id,
          eventType: 'DRAFT_SELECTED',
        },
      });

      if (data.editedText) {
        await tx.funnelEvent.create({
          data: {
            businessId: session.businessId,
            sessionId: session.id,
            eventType: 'DRAFT_EDITED',
          },
        });
      }
    });

    return { success: true };
  }

  async recordHandoff(slug: string, sessionToken: string) {
    const session = await prisma.reviewSession.findUnique({
      where: { sessionToken },
      include: { business: true },
    });

    if (!session) throw new AppError('Session not found', 404);
    if (session.business.slug !== slug) throw new AppError('Session does not match business', 400);

    await prisma.reviewSession.update({
      where: { id: session.id },
      data: { status: 'HANDED_OFF', completedAt: new Date() },
    });

    await prisma.funnelEvent.create({
      data: {
        businessId: session.businessId,
        sessionId: session.id,
        eventType: 'GOOGLE_HANDOFF',
      },
    });

    return { googleReviewUrl: session.business.googleReviewUrl };
  }
}

export const reviewService = new ReviewService();
