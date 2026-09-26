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

    console.log(`📍 Places API response for ${placeId}: rating=${data.rating}, userRatingCount=${data.userRatingCount}, reviews=${data.reviews?.length || 0}`);

    const reviews = data.reviews || [];

    return {
      reviews: reviews.map((r, i) => ({
        googleId: r.name || `places/${placeId}/reviews/${i}`,
        authorName: r.authorAttribution?.displayName || 'Anonymous',
        rating: r.rating || 0,
        comment: r.text?.text || r.originalText?.text || null,
        publishedAt: r.publishTime ? new Date(r.publishTime) : new Date(),
      })),
      rating: data.rating ?? null,
      userRatingCount: data.userRatingCount ?? null,
    };
  }
}

export const googlePlacesService = new GooglePlacesService();
