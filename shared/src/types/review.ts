export type DraftStyle = 'PROFESSIONAL' | 'FRIENDLY' | 'CONCISE';

export type SessionStatus = 'STARTED' | 'RATING' | 'COMMENT' | 'DRAFTS' | 'SELECTED' | 'HANDED_OFF';

export interface ReviewSession {
  id: string;
  businessId: string;
  sessionToken: string;
  status: SessionStatus;
  ipHash?: string;
  userAgent?: string;
  completedAt?: Date;
  createdAt: Date;
}

export interface CustomerResponse {
  id: string;
  sessionId: string;
  questionId: string;
  rating: number;
  createdAt: Date;
}

export interface CustomerFeedback {
  id: string;
  sessionId: string;
  comment?: string;
  createdAt: Date;
}

export interface ReviewDraft {
  id: string;
  sessionId: string;
  style: DraftStyle;
  content: string;
  isSelected: boolean;
  editedText?: string;
  createdAt: Date;
}

export interface SubmitFeedbackRequest {
  sessionToken: string;
  ratings: Array<{ questionId: string; rating: number }>;
  comment?: string;
}

export interface GenerateDraftsRequest {
  sessionToken: string;
}

export interface SelectDraftRequest {
  sessionToken: string;
  draftId: string;
  editedText?: string;
}

export interface HandoffRequest {
  sessionToken: string;
}

export interface BusinessReviewInfo {
  business: {
    name: string;
    description?: string;
    logoUrl?: string;
    googleReviewUrl?: string;
    category?: string;
  };
  questions: Array<{
    id: string;
    text: string;
    sortOrder: number;
  }>;
}

export interface GeneratedDraft {
  style: DraftStyle;
  content: string;
}
