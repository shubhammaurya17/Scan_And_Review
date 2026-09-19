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
          message: `New feedback with ${avgRating.toFixed(1)}★ average rating`,
          sourceData: JSON.stringify({
            sessionId,
            averageRating: avgRating,
            comment: comment.substring(0, 200),
            ratings: session.responses.map(r => ({ question: r.question.text, rating: r.rating })),
          }),
        },
      });
    }

    // Alert: Check for rating drop (compare last 7 days vs previous 7 days)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

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

    if (recentSessions.length >= 3 && previousSessions.length >= 3) {
      const recentAvg = this.calcAvgRating(recentSessions);
      const previousAvg = this.calcAvgRating(previousSessions);

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
              message: `Average rating dropped from ${previousAvg.toFixed(1)}★ to ${recentAvg.toFixed(1)}★ this week`,
              sourceData: JSON.stringify({
                previousWeekAvg: previousAvg,
                currentWeekAvg: recentAvg,
                drop: previousAvg - recentAvg,
              }),
            },
          });
        }
      }
    }

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
            message: 'Customer left strongly negative feedback',
            sourceData: JSON.stringify({
              sessionId,
              comment: session.feedback.comment.substring(0, 300),
              averageRating: avgRating,
            }),
          },
        });
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

  private calcAvgRating(sessions: any[]): number {
    let total = 0;
    let count = 0;
    for (const s of sessions) {
      if (s.responses.length > 0) {
        total += s.responses.reduce((sum: number, r: any) => sum + r.rating, 0) / s.responses.length;
        count++;
      }
    }
    return count > 0 ? total / count : 0;
  }
}

export const alertService = new AlertService();
