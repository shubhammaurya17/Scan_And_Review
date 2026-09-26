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

    // Include Google review count (all-time, not date-filtered — these are synced from the business profile)
    const googleReviewCount = await prisma.googleReview.count({
      where: { businessId },
    });

    return {
      qrScans: counts['QR_SCANNED'] || 0,
      pageLoads: counts['PAGE_LOADED'] || 0,
      sessionsStarted: counts['SESSION_STARTED'] || 0,
      ratingsCompleted: counts['RATING_COMPLETED'] || 0,
      commentsSubmitted: counts['COMMENT_SUBMITTED'] || 0,
      draftsGenerated: counts['DRAFTS_GENERATED'] || 0,
      draftsSelected: counts['DRAFT_SELECTED'] || 0,
      googleHandoffs: counts['GOOGLE_HANDOFF'] || 0,
      googleRedirects: counts['GOOGLE_HANDOFF'] || 0,
      googleReviewCount,
    };
  }

  async getFeedbackStats(businessId: string, startDate: Date, endDate: Date) {
    // App feedback from review sessions
    const sessions = await prisma.reviewSession.findMany({
      where: {
        businessId,
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'STARTED' },
      },
      include: { responses: true, feedback: true },
    });

    const appFeedbackCount = sessions.length;
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

    // Google reviews — all-time (synced from business profile, not date-filtered)
    const googleReviews = await prisma.googleReview.findMany({
      where: { businessId },
    });

    const googleReviewCount = googleReviews.length;
    for (const review of googleReviews) {
      if (review.rating >= 1 && review.rating <= 5) {
        totalRating += review.rating;
        ratingCount++;
        ratingDistribution[review.rating - 1]++;
      }
    }

    const totalFeedback = appFeedbackCount + googleReviewCount;
    const avgRating = ratingCount > 0 ? totalRating / ratingCount : 0;

    // Sentiment: combine app feedback + Google reviews
    let positive = 0;
    let negative = 0;

    for (const session of sessions) {
      const avg = session.responses.length > 0
        ? session.responses.reduce((sum, r) => sum + r.rating, 0) / session.responses.length
        : 0;
      if (avg >= 4) positive++;
      else if (avg <= 2) negative++;
    }

    for (const review of googleReviews) {
      if (review.rating >= 4) positive++;
      else if (review.rating <= 2) negative++;
    }

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
      sources: {
        appFeedback: appFeedbackCount,
        googleReviews: googleReviewCount,
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

  async getGoogleReviewTrend(businessId: string) {
    const reviews = await prisma.googleReview.findMany({
      where: { businessId },
      orderBy: { publishedAt: 'asc' },
    });

    const dailyData: Record<string, { totalRating: number; count: number }> = {};
    for (const review of reviews) {
      const date = review.publishedAt.toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { totalRating: 0, count: 0 };
      }
      dailyData[date].totalRating += review.rating;
      dailyData[date].count++;
    }

    return Object.entries(dailyData).map(([date, data]) => ({
      date,
      averageRating: data.count > 0 ? Math.round((data.totalRating / data.count) * 10) / 10 : 0,
      feedbackCount: data.count,
      source: 'google' as const,
    }));
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

  async resetBusinessData(businessId: string) {
    await prisma.$transaction([
      // Delete AI replies (child of GoogleReview)
      prisma.aIReply.deleteMany({
        where: { review: { businessId } },
      }),
      // Delete Google reviews
      prisma.googleReview.deleteMany({ where: { businessId } }),
      // Delete review drafts (child of ReviewSession)
      prisma.reviewDraft.deleteMany({
        where: { session: { businessId } },
      }),
      // Delete customer feedback (child of ReviewSession)
      prisma.customerFeedback.deleteMany({
        where: { session: { businessId } },
      }),
      // Delete customer responses (child of ReviewSession)
      prisma.customerResponse.deleteMany({
        where: { session: { businessId } },
      }),
      // Delete review sessions
      prisma.reviewSession.deleteMany({ where: { businessId } }),
      // Delete funnel events
      prisma.funnelEvent.deleteMany({ where: { businessId } }),
      // Delete alerts
      prisma.reputationAlert.deleteMany({ where: { businessId } }),
      // Delete AI analyses
      prisma.aIAnalysis.deleteMany({ where: { businessId } }),
      // Reset Google connection (keep the record but clear sync state)
      prisma.googleConnection.updateMany({
        where: { businessId },
        data: { lastSyncAt: null, syncError: null },
      }),
    ]);

    return { message: 'All business data has been cleared successfully' };
  }
}

export const analyticsService = new AnalyticsService();
