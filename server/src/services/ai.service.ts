export interface CustomerAnswer {
  questionText: string;
  questionType: 'STAR_RATING' | 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'TEXT';
  rating?: number;
  selectedOption?: string;
  selectedOptions?: string[];
  textAnswer?: string;
}

export interface ReviewDraftInput {
  businessName: string;
  categoryName: string;
  answers: CustomerAnswer[];
  comment?: string;
  averageRating: number;
  selectedInsights?: string[];
}

export interface GeneratedDraft {
  style: 'PROFESSIONAL' | 'FRIENDLY' | 'CONCISE';
  content: string;
}

export interface SentimentResult {
  score: number;
  label: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
}

export interface IAIService {
  generateReviewDrafts(input: ReviewDraftInput): Promise<GeneratedDraft[]>;
  generateReply(review: string, businessName: string, tone: string): Promise<string>;
  analyzeSentiment(text: string): Promise<SentimentResult>;
  detectTopics(texts: string[]): Promise<string[]>;
  isAvailable(): Promise<boolean>;
}
