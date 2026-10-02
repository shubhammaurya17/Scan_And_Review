import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { googlePlacesService } from './google-places.service';
import { alertService } from './alert.service';

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
      // Fetch reviews via Places API (New) — returns up to 5 most relevant reviews
      console.log(`🔄 Syncing reviews for business ${businessId}, placeId: ${business.googlePlaceId}`);
      const placeData = await googlePlacesService.fetchReviews(business.googlePlaceId);
      console.log(`🔄 Places API returned ${placeData.reviews.length} reviews, rating=${placeData.rating}, totalReviews=${placeData.userRatingCount}`);

      // Check if Place ID changed — if so, clear old reviews first
      const existingReview = await prisma.googleReview.findFirst({
        where: { businessId },
        select: { googleId: true },
      });
      if (existingReview) {
        // Check if any of the new reviews match existing ones (same place = some overlap expected)
        const newGoogleIds = placeData.reviews.map(r => r.googleId);
        const matchCount = await prisma.googleReview.count({
          where: { businessId, googleId: { in: newGoogleIds } },
        });
        // If zero overlap and we have existing reviews, the Place ID likely changed
        if (matchCount === 0 && placeData.reviews.length > 0) {
          console.log(`🔄 No overlap with existing reviews — Place ID likely changed, clearing old data`);
          await prisma.aIReply.deleteMany({ where: { review: { businessId } } });
          await prisma.googleReview.deleteMany({ where: { businessId } });
        }
      }

      // ACCUMULATE: Upsert reviews — keep existing ones, add/update new ones
      let newReviews = 0;
      let updatedReviews = 0;

      for (const review of placeData.reviews) {
        const existing = await prisma.googleReview.findUnique({
          where: { googleId: review.googleId },
        });

        if (existing) {
          // Update existing review data but preserve local reply drafts
          await prisma.googleReview.update({
            where: { googleId: review.googleId },
            data: {
              authorName: review.authorName,
              rating: review.rating,
              comment: review.comment,
              publishedAt: review.publishedAt,
            },
          });
          updatedReviews++;
        } else {
          // Insert new review
          await prisma.googleReview.create({
            data: {
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
          newReviews++;
        }
      }

      const totalStored = await prisma.googleReview.count({ where: { businessId } });

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

      // Check Google reviews for alerts (low ratings, negative sentiment)
      try {
        await alertService.checkGoogleReviewAlerts(businessId);
      } catch (alertErr) {
        console.warn('Alert check after sync failed:', alertErr);
      }

      return {
        message: 'Sync completed',
        newReviews,
        updatedReviews,
        totalStored,
        googleRating: placeData.rating,
        googleReviewCount: placeData.userRatingCount,
        note: `${newReviews} new reviews added, ${updatedReviews} updated. Total stored: ${totalStored}. Google shows ${placeData.userRatingCount || 'N/A'} total reviews. Sync regularly to accumulate more reviews.`,
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

    const { getAIServiceAsync } = await import('./ai-factory');
    const aiService = await getAIServiceAsync();
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

    // Save reply locally — Google Business Profile API (needed to post replies)
    // requires special access approval from Google that most accounts don't have.
    // The reply is saved in the app and will be posted when API access is available.
    await prisma.googleReview.update({
      where: { id: reviewId },
      data: { replyText },
    });

    const conn = review.business.googleConn;
    if (!conn || conn.status !== 'CONNECTED') {
      return {
        message: 'Reply saved locally — connect Google OAuth to attempt posting to Google',
        posted: false,
      };
    }

    // Attempt to post via Google Business Profile API (if the review has a valid resource name)
    const isBusinessProfileId = review.googleId.startsWith('accounts/');
    if (!isBusinessProfileId) {
      return {
        message: 'Reply saved in app. To post replies directly to Google Maps, the Google Business Profile API requires special access approval from Google.',
        posted: false,
      };
    }

    try {
      const { googleService } = await import('./google.service');
      const accessToken = await googleService.getValidAccessToken(review.businessId);

      const replyUrl = `https://mybusiness.googleapis.com/v4/${review.googleId}/reply`;
      console.log(`📤 Posting reply to: ${replyUrl}`);

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
        return {
          message: `Reply saved in app — posting to Google failed: ${errText}`,
          posted: false,
          error: errText,
        };
      }

      await prisma.googleReview.update({
        where: { id: reviewId },
        data: { repliedAt: new Date() },
      });

      await prisma.aIReply.updateMany({
        where: { reviewId, content: replyText },
        data: { isPosted: true },
      });

      return { message: 'Reply posted to Google', posted: true };
    } catch (err: any) {
      return {
        message: `Reply saved in app — ${err.message}`,
        posted: false,
        error: err.message,
      };
    }
  }
}

export const googleReviewsService = new GoogleReviewsService();
