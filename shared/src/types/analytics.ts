export type FunnelEventType =
  | 'QR_SCANNED'
  | 'PAGE_LOADED'
  | 'SESSION_STARTED'
  | 'RATING_STARTED'
  | 'RATING_COMPLETED'
  | 'COMMENT_SUBMITTED'
  | 'DRAFTS_GENERATED'
  | 'DRAFT_SELECTED'
  | 'DRAFT_EDITED'
  | 'GOOGLE_HANDOFF';

export interface FunnelEvent {
  id: string;
  businessId: string;
  sessionId?: string;
  eventType: FunnelEventType;
  metadata?: string;
  createdAt: Date;
}

export interface FunnelMetrics {
  qrScans: number;
  sessionsStarted: number;
  ratingsCompleted: number;
  commentsSubmitted: number;
  draftsGenerated: number;
  draftsSelected: number;
  googleHandoffs: number;
}

export interface AnalyticsDateRange {
  start: Date;
  end: Date;
}

export interface RatingDistribution {
  rating: number;
  count: number;
  percentage: number;
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

export interface TrackEventRequest {
  businessId: string;
  sessionId?: string;
  eventType: FunnelEventType;
  metadata?: Record<string, unknown>;
}
