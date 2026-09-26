import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { googlePlacesService } from './google-places.service';

export class GoogleReviewsService {
  async syncReviews(businessId: string) {
    // Look up business to get googlePlaceId
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      throw new AppError('Business not found', 404);
    }
    if (!business.googlePlaceId) {
      throw new AppError('Google Place ID is not configured for this business. Set it in Settings.', 400);
    }
    if (!googlePlacesService.isConfigured()) {
      throw new AppError('Google Places API key is not configured on this server', 501);
    }

    // Ensure a GoogleConnection record exists for status tracking
    await prisma.googleConnection.upsert({
      where: { businessId },
      update: { status: 'SYNCING', syncError: null },
      create: { businessId, status: 'SYNCING' },
    });

    try {
      // Fetch reviews via Places API (returns up to 5 most relevant + aggregate stats)
      console.log(`🔄 Syncing reviews for business ${businessId}, placeId: ${business.googlePlaceId}`);
      const placeData = await googlePlacesService.fetchReviews(business.googlePlaceId);
      console.log(`🔄 Places API returned ${placeData.reviews.length} reviews, rating=${placeData.rating}, totalReviews=${placeData.userRatingCount}`);

      let totalUpserted = 0;
      let newReviews = 0;

      for (const review of placeData.reviews) {
        const existing = await prisma.googleReview.findUnique({ where: { googleId: review.googleId } });

        await prisma.googleReview.upsert({
          where: { googleId: review.googleId },
          update: {
            // Update review data but preserve local reply drafts
            authorName: review.authorName,
            rating: review.rating,
            comment: review.comment,
            publishedAt: review.publishedAt,
          },
          create: {
            businessId,
            googleId: review.googleId,
            authorName: review.authorName,
            rating: review.rating,
            comment: review.comment,
            publishedAt: review.publishedAt,
            replyText: null,
            repliedAt: null,
          },
        });

        if (!existing) newReviews++;
        totalUpserted++;
      }

      // Update connection status with aggregate stats from Google
      await prisma.googleConnection.update({
        where: { businessId },
        data: {
          status: 'CONNECTED',
          lastSyncAt: new Date(),
          syncError: null,
          googleRating: placeData.rating,
          googleReviewCount: placeData.userRatingCount,
        },
      });

      return {
        message: 'Sync completed',
        reviewCount: totalUpserted,
        newReviews,
        googleRating: placeData.rating,
        googleReviewCount: placeData.userRatingCount,
        note: 'Google Places API returns up to 5 most relevant reviews per sync; aggregate stats (rating, total count) are from the full Google profile',
      };
    } catch (err: any) {
      // Update connection with error
      const syncError = err.message || 'Unknown sync error';

      await prisma.googleConnection.upsert({
        where: { businessId },
        update: { status: 'SYNC_ERROR', syncError },
        create: { businessId, status: 'SYNC_ERROR', syncError },
      }).catch(() => {}); // Don't fail if this update fails

      throw err;
    }
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
    if (!conn || conn.status === 'DISCONNECTED') {
      // Save the reply locally as a draft
      await prisma.googleReview.update({
        where: { id: reviewId },
        data: { replyText },
      });
      return { message: 'Reply saved as draft — Google is not connected', posted: false };
    }

    try {
      const { googleService } = await import('./google.service');
      const accessToken = await googleService.getValidAccessToken(review.businessId);

      // The googleId stores the full resource name (e.g., accounts/.../locations/.../reviews/...)
      const replyUrl = `https://mybusiness.googleapis.com/v4/${review.googleId}/reply`;

      const res = await fetch(replyUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment: replyText }),
      });

      if (!res.ok) {
        const errText = await res.text();
        // Save locally even if posting fails
        await prisma.googleReview.update({
          where: { id: reviewId },
          data: { replyText },
        });
        return {
          message: `Reply saved locally — posting to Google failed: ${errText}`,
          posted: false,
          error: errText,
        };
      }

      // Success: update local record
      await prisma.googleReview.update({
        where: { id: reviewId },
        data: { replyText, repliedAt: new Date() },
      });

      // Mark AI reply as posted if one exists
      await prisma.aIReply.updateMany({
        where: { reviewId, content: replyText },
        data: { isPosted: true },
      });

      return { message: 'Reply posted to Google', posted: true };
    } catch (err: any) {
      // Save locally on any error
      await prisma.googleReview.update({
        where: { id: reviewId },
        data: { replyText },
      });
      return {
        message: `Reply saved as draft — ${err.message}`,
        posted: false,
        error: err.message,
      };
    }
  }
}

export const googleReviewsService = new GoogleReviewsService();
