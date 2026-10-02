import { IAIService, ReviewDraftInput, GeneratedDraft, SentimentResult, CustomerAnswer } from './ai.service';
import { config } from '../config/env';

export class OllamaService implements IAIService {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = config.AI_BASE_URL;
    this.model = config.AI_MODEL;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  async generateReviewDrafts(input: ReviewDraftInput): Promise<GeneratedDraft[]> {
    const styles = [
      { style: 'PROFESSIONAL' as const, instruction: 'Write a balanced and authentic review in 50-90 words. Use polished, specific language. Mention what stood out positively and note areas for improvement honestly.' },
      { style: 'FRIENDLY' as const, instruction: 'Write a warm and natural review in 50-80 words. Use conversational tone. Show genuine enthusiasm for positives and honest feedback about any negatives.' },
      { style: 'CONCISE' as const, instruction: 'Write a short and direct review in 30-50 words. Be brief — 1-2 sentences maximum. Hit the key points only.' },
    ];

    const feedbackBlock = this.formatFeedbackBlock(input);
    const sparse = this.isSparse(input);
    const sparseNote = sparse
      ? '\nNOTE: The customer provided only star ratings with no specific details. Write brief, honest reviews. Do NOT invent any specifics.'
      : '';

    const drafts = await Promise.all(
      styles.map(async ({ style, instruction }) => {
        const prompt = `You are helping a customer turn their actual feedback into a natural Google review for "${input.businessName}" (${input.categoryName}).

CUSTOMER FEEDBACK:
${feedbackBlock}

Overall: ${input.averageRating.toFixed(1)}/5

${instruction}
${sparseNote}

IMPORTANT RULES:
- Write from the customer's perspective (first person)
- Write ONLY from the facts provided above — do NOT invent details
- Do NOT use generic phrases like "hidden gem", "exceeded expectations", "highly recommend"
- If ratings are low, reflect that honestly — do not turn negatives into positives
- Keep it natural and authentic

Write only the review text, nothing else:`;

        try {
          const content = await this.generate(prompt, 0.7, 256);
          return { style, content: content.trim() };
        } catch (err) {
          console.error(`Failed to generate ${style} draft:`, err);
          return null;
        }
      })
    );

    return drafts.filter((d): d is GeneratedDraft => d !== null);
  }

  private formatFeedbackBlock(input: ReviewDraftInput): string {
    const lines: string[] = [];
    for (const a of input.answers) {
      if (a.questionType === 'STAR_RATING' && a.rating) {
        lines.push(`- ${a.questionText}: ${a.rating}/5 stars`);
      } else if (a.questionType === 'SINGLE_CHOICE' && a.selectedOption) {
        lines.push(`- ${a.questionText}: "${a.selectedOption}" (customer selected)`);
      } else if (a.questionType === 'MULTI_CHOICE' && a.selectedOptions?.length) {
        const chips = a.selectedOptions.map(o => `"${o}"`).join(', ');
        lines.push(`- ${a.questionText}: ${chips} (customer selected these)`);
      } else if (a.questionType === 'TEXT' && a.textAnswer) {
        lines.push(`- ${a.questionText}: "${a.textAnswer}" (customer's own words)`);
      }
    }
    if (input.comment) {
      lines.push(`- Additional comment: "${input.comment}" (customer's own words)`);
    }
    if (input.selectedInsights && input.selectedInsights.length > 0) {
      lines.push('');
      lines.push('QUICK INSIGHTS (customer specifically highlighted these):');
      for (const insight of input.selectedInsights) {
        lines.push(`- ${insight}`);
      }
      lines.push('');
      lines.push('IMPORTANT: Weave these insights naturally into the review — do NOT list them.');
      lines.push('Unselected insights mean NOTHING — never interpret absence as negative.');
    }
    return lines.join('\n');
  }

  private isSparse(input: ReviewDraftInput): boolean {
    const hasChips = input.answers.some(a =>
      (a.questionType === 'SINGLE_CHOICE' && a.selectedOption) ||
      (a.questionType === 'MULTI_CHOICE' && a.selectedOptions?.length)
    );
    const hasText = input.answers.some(a => a.questionType === 'TEXT' && a.textAnswer);
    const hasInsights = (input.selectedInsights?.length ?? 0) > 0;
    return !hasChips && !hasText && !hasInsights && !input.comment;
  }

  async generateReply(review: string, businessName: string, tone: string): Promise<string> {
    const toneInstructions: Record<string, string> = {
      PROFESSIONAL: 'Use a professional, courteous tone.',
      FRIENDLY: 'Use a warm, friendly tone.',
      GRATEFUL: 'Express gratitude sincerely.',
      APOLOGETIC: 'Acknowledge concerns and apologize sincerely.',
      CONCISE: 'Be brief and to the point.',
    };

    const prompt = `You are the owner of "${businessName}" replying to a Google review.

The review: "${review}"

Write a reply. ${toneInstructions[tone] || toneInstructions.PROFESSIONAL}

RULES:
- Address specific points the reviewer mentioned
- Do NOT make promises you cannot verify
- Keep it under 150 words
- Be authentic

Write only the reply text:`;

    const content = await this.generate(prompt, 0.7, 200);
    return content.trim();
  }

  async analyzeSentiment(text: string): Promise<SentimentResult> {
    const prompt = `Analyze the sentiment of this text and respond with ONLY one word: POSITIVE, NEUTRAL, or NEGATIVE.

Text: "${text}"

Sentiment:`;

    try {
      const result = await this.generate(prompt, 0.1, 10);
      const label = result.trim().toUpperCase();
      if (label.includes('POSITIVE')) return { score: 0.8, label: 'POSITIVE' };
      if (label.includes('NEGATIVE')) return { score: -0.8, label: 'NEGATIVE' };
      return { score: 0, label: 'NEUTRAL' };
    } catch {
      return { score: 0, label: 'NEUTRAL' };
    }
  }

  async detectTopics(texts: string[]): Promise<string[]> {
    const combined = texts.join('\n---\n');
    const prompt = `Extract the main topics mentioned across these customer reviews. Return ONLY a comma-separated list of topics (e.g., "food quality, service speed, ambiance").

Reviews:
${combined}

Topics:`;

    try {
      const result = await this.generate(prompt, 0.3, 100);
      return result.split(',').map(t => t.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  private async generate(prompt: string, temperature: number, maxTokens: number): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: { temperature, num_predict: maxTokens },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Ollama API error: ${res.status}`);
      }

      const data = await res.json() as { response: string };
      return data.response;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}
