import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export class GoogleReviewsService {
  async syncReviews(businessId: string) {
    const conn = await prisma.googleConnection.findUnique({ where: { businessId } });
    if (!conn || conn.status === 'DISCONNECTED') {
      throw new AppError('Google Business Profile is not connected', 400);
    }

    // Set status to SYNCING
    await prisma.googleConnection.update({
      where: { businessId },
      data: { status: 'SYNCING', syncError: null },
    });

    try {
      const { googleService } = await import('./google.service');
      const accessToken = await googleService.getValidAccessToken(businessId);

      // Step 1: Get accounts (Account Management API)
      const accountsRes = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!accountsRes.ok) {
        const errText = await accountsRes.text();
        throw new AppError(`Failed to fetch Google accounts: ${accountsRes.status} ${errText}`, accountsRes.status);
      }

      const accountsData = await accountsRes.json() as { accounts?: Array<{ name: string }> };
      const accounts = accountsData.accounts || [];

      if (accounts.length === 0) {
        throw new AppError('No Google Business accounts found for this user', 404);
      }

      let totalUpserted = 0;
      let newReviews = 0;

      // Step 2: For each account, get locations and reviews
      for (const account of accounts) {
        const locationsRes = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!locationsRes.ok) continue;

        const locationsData = await locationsRes.json() as { locations?: Array<{ name: string }> };
        const locations = locationsData.locations || [];

        for (const location of locations) {
          // Step 3: Fetch reviews for this location
          let nextPageToken: string | undefined;
          do {
            const reviewsUrl = new URL(`https://mybusiness.googleapis.com/v4/${location.name}/reviews`);
            if (nextPageToken) reviewsUrl.searchParams.set('pageToken', nextPageToken);
            reviewsUrl.searchParams.set('pageSize', '50');

            const reviewsRes = await fetch(reviewsUrl.toString(), {
              headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!reviewsRes.ok) break;

            const reviewsData = await reviewsRes.json() as {
              reviews?: Array<{
                name: string;
                reviewId: string;
                reviewer: { displayName: string };
                starRating: string;
                comment?: string;
                createTime: string;
                reviewReply?: { comment: string; updateTime: string };
              }>;
              nextPageToken?: string;
            };

            const reviews = reviewsData.reviews || [];
            nextPageToken = reviewsData.nextPageToken;

            // Step 4: Upsert each review
            for (const review of reviews) {
              const googleId = review.name || review.reviewId;
              const ratingMap: Record<string, number> = {
                ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
              };

              const existing = await prisma.googleReview.findUnique({ where: { googleId } });

              await prisma.googleReview.upsert({
                where: { googleId },
                update: {
                  authorName: review.reviewer?.displayName || 'Anonymous',
                  rating: ratingMap[review.starRating] || 0,
                  comment: review.comment || null,
                  publishedAt: new Date(review.createTime),
                  replyText: review.reviewReply?.comment || null,
                  repliedAt: review.reviewReply?.updateTime ? new Date(review.reviewReply.updateTime) : null,
                },
                create: {
                  businessId,
                  googleId,
                  authorName: review.reviewer?.displayName || 'Anonymous',
                  rating: ratingMap[review.starRating] || 0,
                  comment: review.comment || null,
                  publishedAt: new Date(review.createTime),
                  replyText: review.reviewReply?.comment || null,
                  repliedAt: review.reviewReply?.updateTime ? new Date(review.reviewReply.updateTime) : null,
                },
              });

              if (!existing) newReviews++;
              totalUpserted++;
            }
          } while (nextPageToken);
        }
      }

      // Update connection status
      await prisma.googleConnection.update({
        where: { businessId },
        data: { status: 'CONNECTED', lastSyncAt: new Date(), syncError: null },
      });

      return { message: 'Sync completed', reviewCount: totalUpserted, newReviews };
    } catch (err: any) {
      // Update connection with error
      const status = err instanceof AppError && err.statusCode === 401 ? 'EXPIRED' : 'SYNC_ERROR';
      const syncError = err.message || 'Unknown sync error';

      await prisma.googleConnection.update({
        where: { businessId },
        data: { status, syncError },
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
