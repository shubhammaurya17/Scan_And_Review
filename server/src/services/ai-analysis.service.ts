import { prisma } from '../config/database';
import { getAIService } from './ai-factory';

export class AIAnalysisService {
  async analyzeFeedbackBatch(businessId: string, startDate: Date, endDate: Date) {
    const sessions = await prisma.reviewSession.findMany({
      where: {
        businessId,
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'STARTED' },
      },
      include: { responses: { include: { question: true } }, feedback: true },
    });

    const aiService = getAIService();
    const comments = sessions
      .filter(s => s.feedback?.comment)
      .map(s => s.feedback!.comment!);

    // Also include Google review comments
    const googleReviews = await prisma.googleReview.findMany({
      where: {
        businessId,
        publishedAt: { gte: startDate, lte: endDate },
        comment: { not: null },
      },
    });
    const googleComments = googleReviews
      .filter(r => r.comment && r.comment.trim().length > 0)
      .map(r => r.comment!);

    const allComments = [...comments, ...googleComments];

    // Sentiment analysis on all comments (app + Google)
    const sentimentResults = await Promise.all(
      allComments.map(async (comment) => {
        try {
          return await aiService.analyzeSentiment(comment);
        } catch {
          return { score: 0, label: 'NEUTRAL' as const };
        }
      })
    );

    const sentimentCounts = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
    for (const r of sentimentResults) {
      sentimentCounts[r.label]++;
    }

    // Topic detection
    let topics: string[] = [];
    if (allComments.length > 0) {
      try {
        topics = await aiService.detectTopics(allComments);
      } catch {
        topics = [];
      }
    }

    // Store sentiment analysis
    await prisma.aIAnalysis.upsert({
      where: { id: `sentiment-${businessId}` },
      update: {
        result: JSON.stringify({ sentimentCounts, totalComments: allComments.length, sentimentResults: sentimentResults.map((r, i) => ({ comment: allComments[i].substring(0, 100), ...r })) }),
        periodStart: startDate,
        periodEnd: endDate,
      },
      create: {
        id: `sentiment-${businessId}`,
        businessId,
        type: 'SENTIMENT',
        result: JSON.stringify({ sentimentCounts, totalComments: allComments.length, sentimentResults: sentimentResults.map((r, i) => ({ comment: allComments[i].substring(0, 100), ...r })) }),
        periodStart: startDate,
        periodEnd: endDate,
      },
    });

    // Store topic analysis
    // Count topic frequency
    const topicFreq: Record<string, number> = {};
    for (const t of topics) {
      topicFreq[t] = (topicFreq[t] || 0) + 1;
    }

    await prisma.aIAnalysis.upsert({
      where: { id: `topics-${businessId}` },
      update: {
        result: JSON.stringify({ topics: topicFreq, totalComments: allComments.length }),
        periodStart: startDate,
        periodEnd: endDate,
      },
      create: {
        id: `topics-${businessId}`,
        businessId,
        type: 'TOPICS',
        result: JSON.stringify({ topics: topicFreq, totalComments: allComments.length }),
        periodStart: startDate,
        periodEnd: endDate,
      },
    });

    return { sentimentCounts, topics: topicFreq, totalComments: allComments.length };
  }

  async getLatestAnalysis(businessId: string, type: string) {
    const analysis = await prisma.aIAnalysis.findFirst({
      where: { businessId, type },
      orderBy: { createdAt: 'desc' },
    });
    if (!analysis) return null;
    try {
      return JSON.parse(analysis.result);
    } catch {
      return null;
    }
  }

  async generateInsights(businessId: string) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    // Run batch analysis first
    const analysis = await this.analyzeFeedbackBatch(businessId, startDate, endDate);

    const insights: string[] = [];

    // Sentiment insight
    const total = analysis.sentimentCounts.POSITIVE + analysis.sentimentCounts.NEUTRAL + analysis.sentimentCounts.NEGATIVE;
    if (total > 0) {
      const positivePct = Math.round((analysis.sentimentCounts.POSITIVE / total) * 100);
      if (positivePct >= 70) {
        insights.push(`Great news! ${positivePct}% of customer comments have positive sentiment.`);
      } else if (positivePct < 40) {
        insights.push(`Attention needed: only ${positivePct}% of comments are positive. Consider reviewing common complaints.`);
      } else {
        insights.push(`${positivePct}% of customer comments are positive — there's room to improve.`);
      }
    }

    // Topic insights
    const topTopics = Object.entries(analysis.topics)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5);
    if (topTopics.length > 0) {
      insights.push(`Top topics mentioned by customers: ${topTopics.map(([t, c]) => `${t} (${c}x)`).join(', ')}.`);
    }

    // Feedback volume (app + Google)
    const sessions2 = await prisma.reviewSession.count({
      where: { businessId, createdAt: { gte: startDate, lte: endDate }, status: { not: 'STARTED' } },
    });
    const googleCount = await prisma.googleReview.count({
      where: { businessId, publishedAt: { gte: startDate, lte: endDate } },
    });
    const totalSubmissions = sessions2 + googleCount;
    insights.push(`You received ${totalSubmissions} total feedback items in the last 30 days (${sessions2} app feedback, ${googleCount} Google reviews).`);

    // Store insights
    await prisma.aIAnalysis.upsert({
      where: { id: `insights-${businessId}` },
      update: {
        result: JSON.stringify({ insights, generatedAt: new Date().toISOString() }),
        periodStart: startDate,
        periodEnd: endDate,
      },
      create: {
        id: `insights-${businessId}`,
        businessId,
        type: 'INSIGHTS',
        result: JSON.stringify({ insights, generatedAt: new Date().toISOString() }),
        periodStart: startDate,
        periodEnd: endDate,
      },
    });

    return { insights, sentiment: analysis.sentimentCounts, topics: analysis.topics };
  }
}

export const aiAnalysisService = new AIAnalysisService();
