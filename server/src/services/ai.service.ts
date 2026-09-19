export interface ReviewDraftInput {
  businessName: string;
  categoryName: string;
  ratings: Array<{ questionText: string; rating: number }>;
  comment?: string;
  averageRating: number;
}

export interface GeneratedDraft {
  style: 'PROFESSIONAL' | 'FRIENDLY' | 'CONCISE';
  content: string;
}

export interface SentimentResult {
  score: number; // -1 to 1
  label: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
}

export interface IAIService {
  generateReviewDrafts(input: ReviewDraftInput): Promise<GeneratedDraft[]>;
  generateReply(review: string, businessName: string, tone: string): Promise<string>;
  analyzeSentiment(text: string): Promise<SentimentResult>;
  detectTopics(texts: string[]): Promise<string[]>;
  isAvailable(): Promise<boolean>;
}
