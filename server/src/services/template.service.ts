import { IAIService, ReviewDraftInput, GeneratedDraft, SentimentResult } from './ai.service';

export class TemplateService implements IAIService {
  async isAvailable(): Promise<boolean> {
    return true; // Template service is always available
  }

  async generateReviewDrafts(input: ReviewDraftInput): Promise<GeneratedDraft[]> {
    const avgRating = input.averageRating;
    const qualityWord = this.getQualityWord(avgRating);
    const highestRated = [...input.ratings].sort((a, b) => b.rating - a.rating)[0];
    const lowestRated = [...input.ratings].sort((a, b) => a.rating - b.rating)[0];

    const commentPart = input.comment ? ` ${input.comment}` : '';
    const businessName = input.businessName;

    // Professional / Balanced & Authentic
    let professional = `Had a ${qualityWord} experience at ${businessName}.`;
    if (highestRated && highestRated.rating >= 4) {
      professional += ` The ${highestRated.questionText.toLowerCase()} was particularly impressive.`;
    }
    if (lowestRated && lowestRated.rating <= 2) {
      professional += ` However, the ${lowestRated.questionText.toLowerCase()} could use some improvement.`;
    }
    if (commentPart) {
      professional += commentPart;
    }

    // Friendly / Warm & Natural
    let friendly = avgRating >= 4
      ? `Really enjoyed my visit to ${businessName}!`
      : avgRating >= 3
        ? `Visited ${businessName} recently — it was a decent experience.`
        : `Visited ${businessName} and had some concerns.`;
    if (highestRated && highestRated.rating >= 4) {
      friendly += ` Loved the ${highestRated.questionText.toLowerCase()}.`;
    }
    if (lowestRated && lowestRated.rating <= 2) {
      friendly += ` The ${lowestRated.questionText.toLowerCase()} wasn't quite what I hoped for.`;
    }
    if (commentPart) {
      friendly += commentPart;
    }

    // Concise / Short & Direct
    let concise = `${businessName}: ${qualityWord} overall.`;
    if (commentPart) {
      concise += commentPart;
    }

    return [
      { style: 'PROFESSIONAL', content: professional },
      { style: 'FRIENDLY', content: friendly },
      { style: 'CONCISE', content: concise },
    ];
  }

  async generateReply(review: string, businessName: string, _tone: string): Promise<string> {
    return `Thank you for taking the time to share your feedback about ${businessName}. We appreciate your input and will use it to improve our service.`;
  }

  async analyzeSentiment(text: string): Promise<SentimentResult> {
    const lower = text.toLowerCase();
    const positiveWords = ['great', 'excellent', 'amazing', 'love', 'wonderful', 'fantastic', 'best', 'good', 'enjoyed', 'impressed'];
    const negativeWords = ['bad', 'terrible', 'awful', 'worst', 'horrible', 'disappointed', 'poor', 'slow', 'rude', 'dirty'];

    const posCount = positiveWords.filter(w => lower.includes(w)).length;
    const negCount = negativeWords.filter(w => lower.includes(w)).length;

    if (posCount > negCount) return { score: 0.6, label: 'POSITIVE' };
    if (negCount > posCount) return { score: -0.6, label: 'NEGATIVE' };
    return { score: 0, label: 'NEUTRAL' };
  }

  async detectTopics(texts: string[]): Promise<string[]> {
    const topicKeywords: Record<string, string[]> = {
      'Food Quality': ['food', 'taste', 'meal', 'dish', 'menu', 'cook', 'flavor'],
      'Service': ['service', 'staff', 'waiter', 'waitress', 'server', 'attentive'],
      'Ambiance': ['ambiance', 'atmosphere', 'decor', 'music', 'vibe', 'setting'],
      'Cleanliness': ['clean', 'dirty', 'hygiene', 'sanitary', 'tidy'],
      'Value': ['price', 'value', 'expensive', 'cheap', 'worth', 'cost'],
      'Wait Time': ['wait', 'slow', 'fast', 'quick', 'time', 'delay'],
    };

    const combined = texts.join(' ').toLowerCase();
    return Object.entries(topicKeywords)
      .filter(([_, keywords]) => keywords.some(k => combined.includes(k)))
      .map(([topic]) => topic);
  }

  private getQualityWord(rating: number): string {
    if (rating >= 4.5) return 'excellent';
    if (rating >= 3.5) return 'great';
    if (rating >= 2.5) return 'decent';
    if (rating >= 1.5) return 'disappointing';
    return 'poor';
  }
}
