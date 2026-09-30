import { config } from '../config/env';
import { AppError } from '../utils/AppError';

export interface PlaceReview {
  googleId: string;
  authorName: string;
  rating: number;
  comment: string | null;
  publishedAt: Date;
}

export interface PlaceData {
  reviews: PlaceReview[];
  rating: number | null;
  userRatingCount: number | null;
}

export class GooglePlacesService {
  private apiKey: string;

  constructor() {
    this.apiKey = config.GOOGLE_PLACES_API_KEY || '';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async fetchReviews(placeId: string): Promise<PlaceData> {
    if (!this.isConfigured()) {
      throw new AppError('Google Places API key is not configured on this server', 501);
    }

    // Try the legacy Place Details API first (supports reviews_sort=newest)
    // Fall back to the new Places API if the legacy one is not enabled for this API key
    try {
      const result = await this.fetchFromLegacyApi(placeId);
      console.log(`📍 Used legacy Places API (newest sort) for ${placeId}`);
      return result;
    } catch (legacyErr: any) {
      console.log(`📍 Legacy Places API failed (${legacyErr.message}), falling back to new Places API`);
      return this.fetchFromNewApi(placeId);
    }
  }

  /**
   * Legacy Place Details API — supports reviews_sort=newest
   * Requires "Places API" enabled in Google Cloud Console
   */
  private async fetchFromLegacyApi(placeId: string): Promise<PlaceData> {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'reviews,rating,user_ratings_total');
    url.searchParams.set('reviews_sort', 'newest');
    url.searchParams.set('reviews_no_translations', 'false');
    url.searchParams.set('key', this.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new AppError(`Legacy Places API HTTP error: ${res.status}`, res.status);
    }

    const body = await res.json() as {
      status: string;
      error_message?: string;
      result?: {
        reviews?: Array<{
          author_name?: string;
          rating?: number;
          text?: string;
          time?: number;
        }>;
        rating?: number;
        user_ratings_total?: number;
      };
    };

    if (body.status === 'REQUEST_DENIED' || body.status === 'OVER_QUERY_LIMIT') {
      throw new AppError(`Legacy API: ${body.error_message || body.status}`, 403);
    }
    if (body.status === 'NOT_FOUND' || body.status === 'INVALID_REQUEST') {
      throw new AppError(`Place ID not found: ${placeId}. ${body.error_message || ''}`, 404);
    }
    if (body.status !== 'OK' && body.status !== 'ZERO_RESULTS') {
      throw new AppError(`Legacy API error: ${body.error_message || body.status}`, 500);
    }

    const result = body.result || {};
    const reviews = result.reviews || [];

    console.log(`📍 Legacy API for ${placeId}: rating=${result.rating}, total=${result.user_ratings_total}, reviews=${reviews.length} (newest)`);

    return {
      reviews: reviews.map((r, i) => ({
        googleId: `places/${placeId}/reviews/${r.time || i}_${(r.author_name || 'anon').replace(/\s+/g, '_').substring(0, 30)}`,
        authorName: r.author_name || 'Anonymous',
        rating: r.rating || 0,
        comment: r.text || null,
        publishedAt: r.time ? new Date(r.time * 1000) : new Date(),
      })),
      rating: result.rating ?? null,
      userRatingCount: result.user_ratings_total ?? null,
    };
  }

  /**
   * New Places API — returns "most relevant" reviews (no sort option)
   * Requires "Places API (New)" enabled in Google Cloud Console
   * Reviews are sorted by publishedAt on our end after fetching
   */
  private async fetchFromNewApi(placeId: string): Promise<PlaceData> {
    const url = `https://places.googleapis.com/v1/places/${placeId}`;

    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'reviews,rating,userRatingCount',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 403) {
        throw new AppError(`Google Places API key is invalid or restricted: ${errText}`, 403);
      }
      if (res.status === 404) {
        throw new AppError(`Google Place ID not found: ${placeId}. Check your Place ID in Settings.`, 404);
      }
      throw new AppError(`Google Places API error (${res.status}): ${errText}`, res.status);
    }

    const data = await res.json() as {
      reviews?: Array<{
        name?: string;
        authorAttribution?: { displayName?: string };
        rating?: number;
        text?: { text?: string };
        originalText?: { text?: string };
        publishTime?: string;
      }>;
      rating?: number;
      userRatingCount?: number;
    };

    console.log(`📍 New API for ${placeId}: rating=${data.rating}, userRatingCount=${data.userRatingCount}, reviews=${data.reviews?.length || 0}`);

    const reviews = data.reviews || [];

    // Sort by publish time descending (newest first) since the new API returns by relevance
    const mappedReviews = reviews.map((r, i) => ({
      googleId: r.name || `places/${placeId}/reviews/${i}`,
      authorName: r.authorAttribution?.displayName || 'Anonymous',
      rating: r.rating || 0,
      comment: r.text?.text || r.originalText?.text || null,
      publishedAt: r.publishTime ? new Date(r.publishTime) : new Date(),
    })).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    return {
      reviews: mappedReviews,
      rating: data.rating ?? null,
      userRatingCount: data.userRatingCount ?? null,
    };
  }
}

export const googlePlacesService = new GooglePlacesService();
