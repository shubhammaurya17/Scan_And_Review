import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export class GoogleReviewsService {
  async syncReviews(businessId: string) {
    const conn = await prisma.googleConnection.findUnique({ where: { businessId } });
    if (!conn || conn.status !== 'CONNECTED' || !conn.accessToken) {
      throw new AppError('Google Business Profile is not connected', 400);
    }

    // Note: Actual Google Business Profile API calls require:
    // 1. Valid OAuth credentials
    // 2. Approved Google Business Profile API access
    // 3. The business must be verified on Google
    //
    // This implementation provides the structure. When actual API access is available,
    // uncomment the fetch calls below and adjust the response parsing.

    /*
    try {
      // First, get the account and location
      const accountsRes = await fetch('https://mybusinessbusinessinformation.googleapis.com/v1/accounts', {
        headers: { Authorization: `Bearer ${conn.accessToken}` },
      });
      // ... parse accounts, get locations, fetch reviews
    } catch (err) {
      // If token expired, mark connection
      await prisma.googleConnection.update({
        where: { businessId },
        data: { status: 'EXPIRED' },
      });
      throw new AppError('Failed to sync reviews — token may be expired', 401);
    }
    */

    // Update last sync time
    await prisma.googleConnection.update({
      where: { businessId },
      data: { lastSyncAt: new Date() },
    });

    return { message: 'Sync completed', reviewCount: 0 };
  }

  async getReviews(businessId: string, page = 1, pageSize = 20) {
    const [reviews, total] = await Promise.all([
      prisma.googleReview.findMany({
        where: { businessId },
        include: { aiReplies: { orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.googleReview.count({ where: { businessId } }),
    ]);

    return {
      data: reviews.map(r => ({
        ...r,
        latestAIReply: r.aiReplies[0] || null,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async generateAndSaveReply(reviewId: string, tone: string, businessName: string) {
    const review = await prisma.googleReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new AppError('Review not found', 404);

    const { getAIService } = await import('./ai-factory');
    const aiService = getAIService();
    const content = await aiService.generateReply(
      review.comment || `${review.rating} star review by ${review.authorName}`,
      businessName,
      tone
    );

    const aiReply = await prisma.aIReply.create({
      data: { reviewId, tone, content },
    });

    return aiReply;
  }

  async postReply(reviewId: string, replyText: string) {
    const review = await prisma.googleReview.findUnique({
      where: { id: reviewId },
      include: { business: { include: { googleConn: true } } },
    });
    if (!review) throw new AppError('Review not found', 404);

    const conn = review.business.googleConn;
    if (!conn || conn.status !== 'CONNECTED') {
      throw new AppError('Google is not connected — reply saved as draft', 400);
    }

    // Note: Actual posting requires Google Business Profile API access
    // When available, uncomment:
    /*
    await fetch(`https://mybusiness.googleapis.com/v4/accounts/.../locations/.../reviews/${review.googleId}/reply`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment: replyText }),
    });
    */

    // Update the review record
    await prisma.googleReview.update({
      where: { id: reviewId },
      data: { replyText, repliedAt: new Date() },
    });

    return { message: 'Reply saved', posted: false };
  }
}

export const googleReviewsService = new GoogleReviewsService();
