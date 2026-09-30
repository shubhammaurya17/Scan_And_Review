import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { googlePlacesService } from './google-places.service';
import { alertService } from './alert.service';

export class GoogleReviewsService {
  /**
   * Fetch reviews via the Google Business Profile API (OAuth).
   * Returns ALL reviews with proper resource names that support reply posting.
   */
  private async fetchReviewsViaBusinessProfileApi(
    businessId: string,
    accessToken: string,
    googlePlaceId: string
  ): Promise<{
    reviews: Array<{
      googleId: string;
      authorName: string;
      rating: number;
      comment: string | null;
      publishedAt: Date;
    }>;
    rating: number | null;
    userRatingCount: number | null;
  } | null> {
    try {
      // Step 1: List accounts
      console.log(`🔄 [BizProfile] Listing accounts...`);
      const accountsRes = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!accountsRes.ok) {
        console.log(`🔄 [BizProfile] Accounts API failed: ${accountsRes.status}`);
        return null;
      }
      const accountsData = await accountsRes.json() as {
        accounts?: Array<{ name: string }>;
      };
      const accounts = accountsData.accounts || [];
      if (accounts.length === 0) {
        console.log(`🔄 [BizProfile] No accounts found`);
        return null;
      }

      // Step 2: Find the location matching our Place ID
      let locationName: string | null = null;

      for (const account of accounts) {
        console.log(`🔄 [BizProfile] Checking account: ${account.name}`);
        const locationsRes = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,metadata,title`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!locationsRes.ok) {
          // Try the legacy v4 API as fallback
          const legacyLocRes = await fetch(
            `https://mybusiness.googleapis.com/v4/${account.name}/locations`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (legacyLocRes.ok) {
            const legacyLocData = await legacyLocRes.json() as {
              locations?: Array<{ name: string; locationKey?: { placeId?: string } }>;
            };
            const match = (legacyLocData.locations || []).find(
              l => l.locationKey?.placeId === googlePlaceId
            );
            if (match) {
              locationName = match.name;
              break;
            }
          }
          continue;
        }

        const locationsData = await locationsRes.json() as {
          locations?: Array<{
            name: string;
            metadata?: { placeId?: string; mapsUri?: string };
            title?: string;
          }>;
        };

        const match = (locationsData.locations || []).find(
          l => l.metadata?.placeId === googlePlaceId
        );
        if (match) {
          locationName = match.name;
          console.log(`🔄 [BizProfile] Found location: ${locationName} (${match.title})`);
          break;
        }
      }

      if (!locationName) {
        console.log(`🔄 [BizProfile] No location matched placeId: ${googlePlaceId}`);
        return null;
      }

      // Step 3: Fetch ALL reviews (paginated)
      const allReviews: Array<{
        googleId: string;
        authorName: string;
        rating: number;
        comment: string | null;
        publishedAt: Date;
      }> = [];
      let pageToken: string | undefined;
      let totalRating: number | null = null;
      let totalReviewCount: number | null = null;

      do {
        const reviewUrl = new URL(`https://mybusiness.googleapis.com/v4/${locationName}/reviews`);
        reviewUrl.searchParams.set('pageSize', '50');
        if (pageToken) reviewUrl.searchParams.set('pageToken', pageToken);

        const reviewsRes = await fetch(reviewUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!reviewsRes.ok) {
          const errText = await reviewsRes.text();
          console.log(`🔄 [BizProfile] Reviews API failed: ${reviewsRes.status} - ${errText}`);
          return null;
        }

        const reviewsData = await reviewsRes.json() as {
          reviews?: Array<{
            name: string; // e.g. accounts/123/locations/456/reviews/789
            reviewer?: { displayName?: string };
            starRating?: string; // "FIVE", "FOUR", etc.
            comment?: string;
            createTime?: string;
            updateTime?: string;
          }>;
          averageRating?: number;
          totalReviewCount?: number;
          nextPageToken?: string;
        };

        if (reviewsData.averageRating) totalRating = reviewsData.averageRating;
        if (reviewsData.totalReviewCount) totalReviewCount = reviewsData.totalReviewCount;

        for (const r of (reviewsData.reviews || [])) {
          allReviews.push({
            googleId: r.name, // This is the proper resource name for reply posting!
            authorName: r.reviewer?.displayName || 'Anonymous',
            rating: this.starRatingToNumber(r.starRating),
            comment: r.comment || null,
            publishedAt: r.createTime ? new Date(r.createTime) : new Date(),
          });
        }

        pageToken = reviewsData.nextPageToken;
        console.log(`🔄 [BizProfile] Fetched ${reviewsData.reviews?.length || 0} reviews (total so far: ${allReviews.length})`);
      } while (pageToken);

      // Sort by newest first
      allReviews.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

      console.log(`🔄 [BizProfile] Total reviews fetched: ${allReviews.length}, avgRating: ${totalRating}, totalCount: ${totalReviewCount}`);

      return {
        reviews: allReviews,
        rating: totalRating,
        userRatingCount: totalReviewCount,
      };
    } catch (err: any) {
      console.log(`🔄 [BizProfile] Error: ${err.message}`);
      return null;
    }
  }

  private starRatingToNumber(starRating?: string): number {
    switch (starRating) {
      case 'FIVE': return 5;
      case 'FOUR': return 4;
      case 'THREE': return 3;
      case 'TWO': return 2;
      case 'ONE': return 1;
      default: return 0;
    }
  }

  async syncReviews(businessId: string) {
    // Look up business to get googlePlaceId
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      throw new AppError('Business not found', 404);
    }
    if (!business.googlePlaceId) {
      throw new AppError('Google Place ID is not configured for this business. Set it in Settings.', 400);
    }

    // Ensure a GoogleConnection record exists for status tracking
    await prisma.googleConnection.upsert({
      where: { businessId },
      update: { status: 'SYNCING', syncError: null },
      create: { businessId, status: 'SYNCING' },
    });

    try {
      let placeData: {
        reviews: Array<{
          googleId: string;
          authorName: string;
          rating: number;
          comment: string | null;
          publishedAt: Date;
        }>;
        rating: number | null;
        userRatingCount: number | null;
      };
      let source = 'places_api';

      // Try Business Profile API first (gets ALL reviews + reply-capable resource names)
      const { googleService } = await import('./google.service');
      let accessToken: string | null = null;
      try {
        accessToken = await googleService.getValidAccessToken(businessId);
      } catch {
        // OAuth not connected or token expired — will fall back to Places API
      }

      if (accessToken) {
        const bpResult = await this.fetchReviewsViaBusinessProfileApi(
          businessId, accessToken, business.googlePlaceId
        );
        if (bpResult && bpResult.reviews.length > 0) {
          placeData = bpResult;
          source = 'business_profile_api';
          console.log(`🔄 Using Business Profile API: ${placeData.reviews.length} reviews`);
        } else {
          // Fall back to Places API
          console.log(`🔄 Business Profile API returned no results, falling back to Places API`);
          placeData = await googlePlacesService.fetchReviews(business.googlePlaceId);
          console.log(`🔄 Using Places API: ${placeData.reviews.length} reviews`);
        }
      } else {
        if (!googlePlacesService.isConfigured()) {
          throw new AppError('Neither Google OAuth nor Places API key is configured', 501);
        }
        placeData = await googlePlacesService.fetchReviews(business.googlePlaceId);
        source = 'places_api';
        console.log(`🔄 Using Places API (no OAuth): ${placeData.reviews.length} reviews`);
      }

      // Clear old reviews and insert fresh data
      // (Places API returns max 5; Business Profile API returns all)
      const oldReviewCount = await prisma.googleReview.count({ where: { businessId } });
      if (oldReviewCount > 0) {
        console.log(`🔄 Clearing ${oldReviewCount} old reviews before fresh sync`);
        await prisma.aIReply.deleteMany({
          where: { review: { businessId } },
        });
        await prisma.googleReview.deleteMany({ where: { businessId } });
      }

      let totalUpserted = 0;
      for (const review of placeData.reviews) {
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
        totalUpserted++;
      }

      // Update connection status with aggregate stats
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
        reviewCount: totalUpserted,
        googleRating: placeData.rating,
        googleReviewCount: placeData.userRatingCount,
        source,
        note: source === 'business_profile_api'
          ? `Fetched all ${totalUpserted} reviews via Google Business Profile API`
          : 'Google Places API returns up to 5 most relevant reviews per sync; connect Google OAuth for all reviews',
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

    // Check if the googleId is a Business Profile API resource name (supports reply posting)
    const isBusinessProfileId = review.googleId.startsWith('accounts/');

    if (!isBusinessProfileId) {
      // Reviews fetched via Places API don't have reply-compatible resource names
      await prisma.googleReview.update({
        where: { id: reviewId },
        data: { replyText },
      });
      return {
        message: 'Reply saved locally — sync via Google OAuth to enable posting replies to Google',
        posted: false,
      };
    }

    try {
      const { googleService } = await import('./google.service');
      const accessToken = await googleService.getValidAccessToken(review.businessId);

      // The googleId from Business Profile API is the correct resource name
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
        console.log(`📤 Reply post failed: ${res.status} - ${errText}`);
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
