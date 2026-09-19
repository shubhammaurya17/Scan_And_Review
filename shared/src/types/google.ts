export type GoogleConnectionStatus = 'CONNECTED' | 'EXPIRED' | 'DISCONNECTED';

export interface GoogleConnection {
  id: string;
  businessId: string;
  status: GoogleConnectionStatus;
  lastSyncAt?: Date;
  createdAt: Date;
}

export interface GoogleReview {
  id: string;
  businessId: string;
  googleId: string;
  authorName: string;
  rating: number;
  comment?: string;
  publishedAt: Date;
  replyText?: string;
  repliedAt?: Date;
}

export type AIReplyTone = 'PROFESSIONAL' | 'FRIENDLY' | 'GRATEFUL' | 'APOLOGETIC' | 'CONCISE';

export interface AIReply {
  id: string;
  reviewId: string;
  tone: AIReplyTone;
  content: string;
  isPosted: boolean;
  createdAt: Date;
}
