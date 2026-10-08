import { prisma } from '../config/database';
import { getAIServiceAsync } from './ai-factory';
import { TemplateService } from './template.service';
import { ReviewValidator } from './review-validator.service';
import { CustomerAnswer, ReviewDraftInput } from './ai.service';
import { AppError } from '../utils/AppError';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Extract area/neighborhood from a freeform address string.
 * "123 Main Street, Downtown" → "Downtown"
 * "45 MG Road, Koramangala, Bangalore" → "Koramangala"
 * "XYZ Clinic, HSR Layout, Bangalore, Karnataka 560102" → "HSR Layout"
 * null or single-segment → undefined
 *
 * Strips segments that look like a state + pincode / zip (contain a 5-6 digit
 * number) so the heuristic picks the actual neighborhood, not the postal line.
 */
function extractArea(address?: string | null): string | undefined {
  if (!address) return undefined;
  const raw = address.split(',').map(p => p.trim()).filter(Boolean);
  // Drop segments that contain a postal / zip code (5-6 consecutive digits)
  const parts = raw.filter(p => !/\b\d{5,6}\b/.test(p));
  if (parts.length < 2) return undefined;
  return parts.length === 2 ? parts[1] : parts[parts.length - 2];
}

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

    // Fetch insight chips for the business
    let insights = await prisma.businessInsight.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true },
    });

    // Fall back to category templates — auto-clone into BusinessInsight (lazy cloning)
    if (insights.length === 0 && business.categoryId) {
      const templates = await prisma.insightTemplate.findMany({
        where: { categoryId: business.categoryId, isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      if (templates.length > 0) {
        for (const tpl of templates) {
          await prisma.businessInsight.create({
            data: {
              businessId: business.id,
              label: tpl.label,
              slug: tpl.slug,
              sortOrder: tpl.sortOrder,
              isCustom: false,
            },
          });
        }
        // Re-fetch the now-cloned business insights
        insights = await prisma.businessInsight.findMany({
          where: { businessId: business.id, isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, label: true },
        });
      }
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
        type: q.type,
        options: q.options ? JSON.parse(q.options) : null,
        placeholder: q.placeholder,
        sortOrder: q.sortOrder,
      })),
      insights,
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
    responses: Array<{ questionId: string; rating?: number; answer?: string }>;
    comment?: string;
    selectedInsights?: string[];
  }) {
    const session = await prisma.reviewSession.findUnique({
      where: { sessionToken: data.sessionToken },
      include: { business: { include: { questions: { where: { isActive: true } } } } },
    });

    if (!session) throw new AppError('Session not found', 404);
    if (session.business.slug !== slug) throw new AppError('Session does not match business', 400);

    // Validate all question IDs are active
    const activeQuestionIds = new Set(session.business.questions.map(q => q.id));
    for (const r of data.responses) {
      if (!activeQuestionIds.has(r.questionId)) {
        throw new AppError(`Invalid question ID: ${r.questionId}`, 400);
      }
    }

    // Create responses
    await prisma.$transaction(async (tx) => {
      // Delete existing responses for this session (in case of re-submission)
      await tx.customerResponse.deleteMany({ where: { sessionId: session.id } });

      for (const r of data.responses) {
        await tx.customerResponse.create({
          data: {
            sessionId: session.id,
            questionId: r.questionId,
            rating: r.rating ?? null,
            answer: r.answer ?? null,
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

      // Save selected insight chips
      if (data.selectedInsights && data.selectedInsights.length > 0) {
        for (const insightId of data.selectedInsights) {
          await tx.selectedInsight.create({
            data: {
              sessionId: session.id,
              insightId,
            },
          });
        }

        await tx.funnelEvent.create({
          data: {
            businessId: session.businessId,
            sessionId: session.id,
            eventType: 'INSIGHTS_SELECTED',
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
        selectedInsights: { include: { insight: true } },
      },
    });

    if (!session) throw new AppError('Session not found', 404);
    if (session.business.slug !== slug) throw new AppError('Session does not match business', 400);
    if (session.responses.length === 0) throw new AppError('No ratings submitted yet', 400);

    const answers = session.responses.map(r => {
      const q = r.question;
      const answer: CustomerAnswer = {
        questionText: q.text,
        questionType: q.type as CustomerAnswer['questionType'],
      };
      if (q.type === 'STAR_RATING') {
        answer.rating = r.rating ?? undefined;
      } else if (q.type === 'SINGLE_CHOICE') {
        answer.selectedOption = r.answer ?? undefined;
      } else if (q.type === 'MULTI_CHOICE') {
        try { answer.selectedOptions = r.answer ? JSON.parse(r.answer) : undefined; } catch { answer.selectedOptions = undefined; }
      } else if (q.type === 'TEXT') {
        answer.textAnswer = r.answer ?? undefined;
      }
      return answer;
    });

    const starRatings = answers.filter(a => a.questionType === 'STAR_RATING' && a.rating);
    const averageRating = starRatings.length > 0
      ? starRatings.reduce((sum, a) => sum + (a.rating || 0), 0) / starRatings.length
      : 3;

    const selectedInsights = session.selectedInsights?.map(
      (si: any) => si.insight.label
    ) || [];

    const draftInput: ReviewDraftInput = {
      businessName: session.business.name,
      categoryName: session.business.category?.name || 'Business',
      answers,
      comment: session.feedback?.comment || undefined,
      averageRating,
      selectedInsights,
      locationArea: extractArea(session.business.address),
      businessDescription: session.business.description || undefined,
    };

    let drafts: { style: string; content: string }[] = [];
    const aiService = await getAIServiceAsync();
    const serviceName = aiService.constructor.name;
    console.log(`📝 Generating drafts using: ${serviceName}`);

    try {
      drafts = await aiService.generateReviewDrafts(draftInput);
      // Filter out any drafts with empty or truncated content
      drafts = drafts.filter(d => d.content && d.content.trim().length >= 50);
      console.log(`✅ ${serviceName} returned ${drafts.length} valid drafts`);
    } catch (err) {
      console.error(`❌ ${serviceName} threw during draft generation:`, err);
      // drafts stays [] — will trigger template fallback below
    }

    // Validate drafts with ReviewValidator
    const validator = new ReviewValidator();
    const validatedDrafts: { style: string; content: string }[] = [];

    for (const d of drafts) {
      const result = validator.validate(d.content, draftInput);
      if (result.passed) {
        validatedDrafts.push(d);
      } else {
        // Use the draft as-is rather than making a costly full retry round-trip
        console.warn(`Draft ${d.style} soft-failed validation (${result.reasons.join(', ')}), using anyway`);
        validatedDrafts.push(d);
      }
    }

    drafts = validatedDrafts;

    // If AI returned some but fewer than 3, supplement with templates instead of discarding AI drafts
    if (drafts.length > 0 && drafts.length < 3) {
      console.warn(`${serviceName} returned only ${drafts.length} drafts — supplementing with templates`);
      const templateService = new TemplateService();
      const templateDrafts = await templateService.generateReviewDrafts(draftInput);
      const existingStyles = new Set(drafts.map(d => d.style));
      for (const td of templateDrafts) {
        if (!existingStyles.has(td.style) && drafts.length < 3) {
          drafts.push(td);
          existingStyles.add(td.style);
        }
      }
    } else if (drafts.length === 0) {
      // Only use full template fallback when AI returned nothing at all
      console.warn('AI service returned 0 drafts — falling back to template generation');
      const templateService = new TemplateService();
      drafts = await templateService.generateReviewDrafts(draftInput);
    }

    // Delete existing drafts and save new ones in a single transaction
    const savedDrafts = await prisma.$transaction(async (tx) => {
      await tx.reviewDraft.deleteMany({ where: { sessionId: session.id } });

      const created = await Promise.all(
        drafts.map(d =>
          tx.reviewDraft.create({
            data: {
              sessionId: session.id,
              style: d.style,
              content: d.content,
            },
          })
        )
      );

      await tx.reviewSession.update({
        where: { id: session.id },
        data: { status: 'DRAFTS' },
      });

      await tx.funnelEvent.create({
        data: {
          businessId: session.businessId,
          sessionId: session.id,
          eventType: 'DRAFTS_GENERATED',
        },
      });

      return created;
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
