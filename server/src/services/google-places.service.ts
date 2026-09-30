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

    // Use the legacy Place Details API which supports reviews_sort=newest
    // (the new Places API only returns "most relevant" reviews with no sort option)
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'reviews,rating,user_ratings_total');
    url.searchParams.set('reviews_sort', 'newest');
    url.searchParams.set('reviews_no_translations', 'false');
    url.searchParams.set('key', this.apiKey);

    const res = await fetch(url.toString());

    if (!res.ok) {
      const errText = await res.text();
      throw new AppError(`Google Places API error (${res.status}): ${errText}`, res.status);
    }

    const body = await res.json() as {
      status: string;
      error_message?: string;
      result?: {
        reviews?: Array<{
          author_name?: string;
          rating?: number;
          text?: string;
          time?: number; // Unix timestamp in seconds
          relative_time_description?: string;
          author_url?: string;
        }>;
        rating?: number;
        user_ratings_total?: number;
      };
    };

    if (body.status === 'REQUEST_DENIED') {
      throw new AppError(`Google Places API key is invalid or restricted: ${body.error_message || body.status}`, 403);
    }
    if (body.status === 'NOT_FOUND' || body.status === 'INVALID_REQUEST') {
      throw new AppError(`Google Place ID not found or invalid: ${placeId}. Check your Place ID in Settings. (${body.error_message || body.status})`, 404);
    }
    if (body.status !== 'OK' && body.status !== 'ZERO_RESULTS') {
      throw new AppError(`Google Places API error: ${body.error_message || body.status}`, 500);
    }

    const result = body.result || {};
    const reviews = result.reviews || [];

    console.log(`📍 Places API response for ${placeId}: rating=${result.rating}, user_ratings_total=${result.user_ratings_total}, reviews=${reviews.length} (sorted by newest)`);

    return {
      reviews: reviews.map((r, i) => ({
        // Legacy API doesn't have a unique review name/id, so generate one from place + author + time
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
}

export const googlePlacesService = new GooglePlacesService();
