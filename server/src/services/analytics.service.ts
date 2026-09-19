import { prisma } from '../config/database';

export class AnalyticsService {
  async trackEvent(data: {
    businessId: string;
    sessionId?: string;
    eventType: string;
    metadata?: Record<string, unknown>;
  }) {
    await prisma.funnelEvent.create({
      data: {
        businessId: data.businessId,
        sessionId: data.sessionId,
        eventType: data.eventType,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
  }

  async getFunnelMetrics(businessId: string, startDate: Date, endDate: Date) {
    const events = await prisma.funnelEvent.groupBy({
      by: ['eventType'],
      where: {
        businessId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: true,
    });

    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.eventType] = e._count;
    }

    return {
      qrScans: counts['QR_SCANNED'] || 0,
      pageLoads: counts['PAGE_LOADED'] || 0,
      sessionsStarted: counts['SESSION_STARTED'] || 0,
      ratingsCompleted: counts['RATING_COMPLETED'] || 0,
      commentsSubmitted: counts['COMMENT_SUBMITTED'] || 0,
      draftsGenerated: counts['DRAFTS_GENERATED'] || 0,
      draftsSelected: counts['DRAFT_SELECTED'] || 0,
      googleHandoffs: counts['GOOGLE_HANDOFF'] || 0,
    };
  }

  async getFeedbackStats(businessId: string, startDate: Date, endDate: Date) {
    const sessions = await prisma.reviewSession.findMany({
      where: {
        businessId,
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'STARTED' },
      },
      include: { responses: true, feedback: true },
    });

    const totalFeedback = sessions.length;
    let totalRating = 0;
    let ratingCount = 0;
    const ratingDistribution = [0, 0, 0, 0, 0]; // index 0 = 1 star, etc.

    for (const session of sessions) {
      if (session.responses.length > 0) {
        const avg = session.responses.reduce((s, r) => s + r.rating, 0) / session.responses.length;
        totalRating += avg;
        ratingCount++;
        const rounded = Math.round(avg);
        ratingDistribution[rounded - 1]++;
      }
    }

    const avgRating = ratingCount > 0 ? totalRating / ratingCount : 0;

    // Sentiment based on average rating
    const positive = sessions.filter(s => {
      const avg = s.responses.length > 0
        ? s.responses.reduce((sum, r) => sum + r.rating, 0) / s.responses.length
        : 0;
      return avg >= 4;
    }).length;
    const negative = sessions.filter(s => {
      const avg = s.responses.length > 0
        ? s.responses.reduce((sum, r) => sum + r.rating, 0) / s.responses.length
        : 0;
      return avg <= 2;
    }).length;
    const neutral = totalFeedback - positive - negative;

    return {
      totalFeedback,
      averageRating: Math.round(avgRating * 10) / 10,
      ratingDistribution: ratingDistribution.map((count, i) => ({
        rating: i + 1,
        count,
        percentage: totalFeedback > 0 ? Math.round((count / totalFeedback) * 100) : 0,
      })),
      sentiment: {
        positive,
        neutral,
        negative,
        total: totalFeedback,
      },
    };
  }

  async getRecentFeedback(businessId: string, page = 1, pageSize = 20, ratingFilter?: number) {
    const where: any = {
      businessId,
      status: { not: 'STARTED' },
    };

    const sessions = await prisma.reviewSession.findMany({
      where,
      include: {
        responses: { include: { question: true } },
        feedback: true,
        drafts: { where: { isSelected: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const total = await prisma.reviewSession.count({ where });

    const data = sessions
      .map(session => {
        const avgRating = session.responses.length > 0
          ? session.responses.reduce((s, r) => s + r.rating, 0) / session.responses.length
          : 0;

        if (ratingFilter && Math.round(avgRating) !== ratingFilter) return null;

        return {
          id: session.id,
          sessionToken: session.sessionToken,
          status: session.status,
          averageRating: Math.round(avgRating * 10) / 10,
          ratings: session.responses.map(r => ({
            question: r.question.text,
            rating: r.rating,
          })),
          comment: session.feedback?.comment || null,
          selectedDraft: session.drafts[0]?.editedText || session.drafts[0]?.content || null,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
        };
      })
      .filter(Boolean);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getTimeSeriesData(businessId: string, startDate: Date, endDate: Date) {
    const sessions = await prisma.reviewSession.findMany({
      where: {
        businessId,
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'STARTED' },
      },
      include: { responses: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const dailyData: Record<string, { totalRating: number; count: number; feedbackCount: number }> = {};
    for (const session of sessions) {
      const date = session.createdAt.toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { totalRating: 0, count: 0, feedbackCount: 0 };
      }
      dailyData[date].feedbackCount++;
      if (session.responses.length > 0) {
        const avg = session.responses.reduce((s, r) => s + r.rating, 0) / session.responses.length;
        dailyData[date].totalRating += avg;
        dailyData[date].count++;
      }
    }

    return Object.entries(dailyData).map(([date, data]) => ({
      date,
      averageRating: data.count > 0 ? Math.round((data.totalRating / data.count) * 10) / 10 : 0,
      feedbackCount: data.feedbackCount,
    }));
  }

  async getTopicAnalysis(businessId: string) {
    try {
      const analysis = await prisma.aIAnalysis.findFirst({
        where: { businessId, type: 'TOPICS' },
        orderBy: { createdAt: 'desc' },
      });
      if (!analysis) return { topics: {}, totalComments: 0 };
      return JSON.parse(analysis.result);
    } catch {
      return { topics: {}, totalComments: 0 };
    }
  }
}

export const analyticsService = new AnalyticsService();
