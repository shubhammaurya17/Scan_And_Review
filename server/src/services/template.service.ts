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

  async generateReply(review: string, businessName: string, tone: string): Promise<string> {
    const isPositive = /great|excellent|amazing|love|wonderful|fantastic|best|good|enjoyed|impressed/i.test(review);
    const isNegative = /bad|terrible|awful|worst|horrible|disappointed|poor|slow|rude|dirty|cold/i.test(review);
    const sentiment = isNegative ? 'negative' : isPositive ? 'positive' : 'neutral';

    const templates: Record<string, Record<string, string>> = {
      PROFESSIONAL: {
        positive: `Thank you for your positive feedback about ${businessName}. We are delighted to hear about your experience and remain committed to maintaining these high standards. We look forward to welcoming you again.`,
        negative: `Thank you for sharing your concerns regarding ${businessName}. We take all feedback seriously and are reviewing the issues you've raised. Please don't hesitate to contact us directly so we can address this properly.`,
        neutral: `Thank you for your review of ${businessName}. We value your feedback and continuously strive to improve our offerings. We hope to see you again soon.`,
      },
      FRIENDLY: {
        positive: `So glad you had a great time at ${businessName}! 😊 Thanks for the kind words — it really means a lot to our team. Can't wait to see you again!`,
        negative: `Oh no, we're sorry to hear that your visit to ${businessName} didn't meet expectations! That's definitely not what we aim for. We'd love a chance to make it right — please reach out to us!`,
        neutral: `Thanks for stopping by ${businessName} and sharing your thoughts! We appreciate the feedback and are always looking for ways to do better. Hope to see you again soon!`,
      },
      GRATEFUL: {
        positive: `We are truly grateful for your wonderful review of ${businessName}! Your kind words inspire our team to keep delivering the best experience possible. Thank you for your support!`,
        negative: `We sincerely appreciate you taking the time to share your experience at ${businessName}. We're grateful for honest feedback as it helps us grow. We want to make this right — please give us another chance.`,
        neutral: `Thank you so much for reviewing ${businessName}! We're grateful for every piece of feedback we receive. Your thoughts help us become better every day.`,
      },
      APOLOGETIC: {
        positive: `Thank you for your generous review of ${businessName}! We're glad everything went well, and we apologize if anything was less than perfect. We always strive to exceed expectations.`,
        negative: `We sincerely apologize for the experience you had at ${businessName}. This falls short of our standards and we take full responsibility. We would like to make it up to you — please contact us directly.`,
        neutral: `Thank you for your feedback about ${businessName}. We apologize if any aspect of your experience could have been better. We are committed to continuous improvement.`,
      },
      CONCISE: {
        positive: `Thanks for the great review! We're glad you enjoyed ${businessName}. See you again soon.`,
        negative: `Sorry about your experience at ${businessName}. We'll do better. Please reach out so we can make it right.`,
        neutral: `Thanks for your feedback about ${businessName}. We appreciate it and will keep improving.`,
      },
    };

    const toneTemplates = templates[tone.toUpperCase()] || templates.PROFESSIONAL;
    return toneTemplates[sentiment];
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
