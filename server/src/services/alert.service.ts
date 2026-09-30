import { prisma } from '../config/database';

export class AlertService {
  async checkAndCreateAlerts(businessId: string, sessionId: string) {
    const session = await prisma.reviewSession.findUnique({
      where: { id: sessionId },
      include: { responses: { include: { question: true } }, feedback: true },
    });
    if (!session || session.responses.length === 0) return;

    const avgRating = session.responses.reduce((sum, r) => sum + r.rating, 0) / session.responses.length;

    // Alert: Low rating (1-2 stars average)
    if (avgRating <= 2) {
      const comment = session.feedback?.comment || 'No comment provided';
      await prisma.reputationAlert.create({
        data: {
          businessId,
          type: 'LOW_RATING',
          message: `New QR feedback with ${avgRating.toFixed(1)}★ average rating`,
          sourceData: JSON.stringify({
            sessionId,
            source: 'qr_feedback',
            averageRating: avgRating,
            comment: comment.substring(0, 200),
            ratings: session.responses.map(r => ({ question: r.question.text, rating: r.rating })),
          }),
        },
      });
    }

    // Alert: Check for rating drop (compare last 7 days vs previous 7 days)
    await this.checkRatingDrop(businessId);

    // Alert: Negative sentiment in comment
    if (session.feedback?.comment) {
      const comment = session.feedback.comment.toLowerCase();
      const negativeKeywords = ['terrible', 'awful', 'worst', 'horrible', 'disgusting', 'never again', 'rude', 'unacceptable'];
      const hasStrongNegative = negativeKeywords.some(kw => comment.includes(kw));

      if (hasStrongNegative) {
        await prisma.reputationAlert.create({
          data: {
            businessId,
            type: 'NEGATIVE_SENTIMENT',
            message: 'Customer left strongly negative QR feedback',
            sourceData: JSON.stringify({
              sessionId,
              source: 'qr_feedback',
              comment: session.feedback.comment.substring(0, 300),
              averageRating: avgRating,
            }),
          },
        });
      }
    }
  }

  /**
   * Check synced Google reviews for alerts.
   * Called after each Google review sync. Only creates alerts for reviews
   * that don't already have an alert and were published after the Place ID was configured.
   */
  async checkGoogleReviewAlerts(businessId: string) {
    // Get the Google connection to find when the place was configured
    const googleConnection = await prisma.googleConnection.findUnique({
      where: { businessId },
    });
    if (!googleConnection) return;

    // Use connection creation date as the onboarding date
    const onboardingDate = googleConnection.createdAt;

    // Get all synced Google reviews published after onboarding
    const reviews = await prisma.googleReview.findMany({
      where: {
        businessId,
        publishedAt: { gte: onboardingDate },
      },
    });

    for (const review of reviews) {
      // Check if we already created an alert for this Google review
      const existingAlert = await prisma.reputationAlert.findFirst({
        where: {
          businessId,
          sourceData: { contains: review.googleId },
        },
      });
      if (existingAlert) continue;

      // Alert: Low rating (1-2 stars)
      if (review.rating <= 2) {
        await prisma.reputationAlert.create({
          data: {
            businessId,
            type: 'LOW_RATING',
            message: `Google review from ${review.authorName} with ${review.rating}★ rating`,
            sourceData: JSON.stringify({
              googleReviewId: review.id,
              googleId: review.googleId,
              source: 'google_review',
              authorName: review.authorName,
              rating: review.rating,
              comment: (review.comment || '').substring(0, 300),
            }),
          },
        });
      }

      // Alert: Negative sentiment in Google review comment
      if (review.comment) {
        const comment = review.comment.toLowerCase();
        const negativeKeywords = ['terrible', 'awful', 'worst', 'horrible', 'disgusting', 'never again', 'rude', 'unacceptable'];
        const hasStrongNegative = negativeKeywords.some(kw => comment.includes(kw));

        if (hasStrongNegative) {
          await prisma.reputationAlert.create({
            data: {
              businessId,
              type: 'NEGATIVE_SENTIMENT',
              message: `Negative Google review from ${review.authorName}`,
              sourceData: JSON.stringify({
                googleReviewId: review.id,
                googleId: review.googleId,
                source: 'google_review',
                authorName: review.authorName,
                comment: review.comment.substring(0, 300),
                rating: review.rating,
              }),
            },
          });
        }
      }
    }

    // Also check for rating drop including Google reviews
    await this.checkRatingDrop(businessId);
  }

  /**
   * Check for rating drop across both QR feedback and Google reviews.
   * Compares last 7 days vs previous 7 days.
   */
  private async checkRatingDrop(businessId: string) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // QR sessions
    const [recentSessions, previousSessions] = await Promise.all([
      prisma.reviewSession.findMany({
        where: { businessId, createdAt: { gte: weekAgo }, status: { not: 'STARTED' } },
        include: { responses: true },
      }),
      prisma.reviewSession.findMany({
        where: { businessId, createdAt: { gte: twoWeeksAgo, lt: weekAgo }, status: { not: 'STARTED' } },
        include: { responses: true },
      }),
    ]);

    // Google reviews
    const [recentGoogleReviews, previousGoogleReviews] = await Promise.all([
      prisma.googleReview.findMany({
        where: { businessId, publishedAt: { gte: weekAgo } },
      }),
      prisma.googleReview.findMany({
        where: { businessId, publishedAt: { gte: twoWeeksAgo, lt: weekAgo } },
      }),
    ]);

    const recentCount = recentSessions.length + recentGoogleReviews.length;
    const previousCount = previousSessions.length + previousGoogleReviews.length;

    if (recentCount >= 3 && previousCount >= 3) {
      // Calculate combined averages
      let recentTotal = 0, recentRatingCount = 0;
      for (const s of recentSessions) {
        if (s.responses.length > 0) {
          recentTotal += s.responses.reduce((sum: number, r: any) => sum + r.rating, 0) / s.responses.length;
          recentRatingCount++;
        }
      }
      for (const r of recentGoogleReviews) {
        recentTotal += r.rating;
        recentRatingCount++;
      }

      let prevTotal = 0, prevRatingCount = 0;
      for (const s of previousSessions) {
        if (s.responses.length > 0) {
          prevTotal += s.responses.reduce((sum: number, r: any) => sum + r.rating, 0) / s.responses.length;
          prevRatingCount++;
        }
      }
      for (const r of previousGoogleReviews) {
        prevTotal += r.rating;
        prevRatingCount++;
      }

      const recentAvg = recentRatingCount > 0 ? recentTotal / recentRatingCount : 0;
      const previousAvg = prevRatingCount > 0 ? prevTotal / prevRatingCount : 0;

      if (previousAvg - recentAvg >= 0.5) {
        // Check if we already created a rating drop alert today
        const existingAlert = await prisma.reputationAlert.findFirst({
          where: {
            businessId,
            type: 'RATING_DROP',
            createdAt: { gte: new Date(now.toISOString().split('T')[0]) },
          },
        });

        if (!existingAlert) {
          await prisma.reputationAlert.create({
            data: {
              businessId,
              type: 'RATING_DROP',
              message: `Average rating dropped from ${previousAvg.toFixed(1)}★ to ${recentAvg.toFixed(1)}★ this week (QR + Google combined)`,
              sourceData: JSON.stringify({
                previousWeekAvg: previousAvg,
                currentWeekAvg: recentAvg,
                drop: previousAvg - recentAvg,
                sources: { qrSessions: recentSessions.length, googleReviews: recentGoogleReviews.length },
              }),
            },
          });
        }
      }
    }
  }

  async getAlerts(businessId: string, page = 1, pageSize = 20, type?: string, unreadOnly = false) {
    const where: any = { businessId };
    if (type) where.type = type;
    if (unreadOnly) where.isRead = false;

    const [alerts, total] = await Promise.all([
      prisma.reputationAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.reputationAlert.count({ where }),
    ]);

    const unreadCount = await prisma.reputationAlert.count({
      where: { businessId, isRead: false },
    });

    return {
      data: alerts.map(a => ({
        ...a,
        sourceData: a.sourceData ? JSON.parse(a.sourceData) : null,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      unreadCount,
    };
  }

  async markRead(alertId: string) {
    await prisma.reputationAlert.update({
      where: { id: alertId },
      data: { isRead: true },
    });
  }

  async markAllRead(businessId: string) {
    await prisma.reputationAlert.updateMany({
      where: { businessId, isRead: false },
      data: { isRead: true },
    });
  }

  async deleteAlert(alertId: string) {
    await prisma.reputationAlert.delete({ where: { id: alertId } });
  }

  async getUnreadCount(businessId: string) {
    return prisma.reputationAlert.count({ where: { businessId, isRead: false } });
  }

}

export const alertService = new AlertService();
