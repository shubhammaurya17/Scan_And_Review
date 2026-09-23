import { IAIService, ReviewDraftInput, GeneratedDraft, SentimentResult } from './ai.service';
import { config } from '../config/env';

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
}

export class GroqService implements IAIService {
  private baseUrl: string;
  private model: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.AI_BASE_URL;
    this.model = config.AI_MODEL;
    this.apiKey = config.GROQ_API_KEY || '';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  async generateReviewDrafts(input: ReviewDraftInput): Promise<GeneratedDraft[]> {
    const styles = [
      { style: 'PROFESSIONAL' as const, instruction: 'Write a balanced and authentic review. Use polished, specific language. Mention what stood out positively and note areas for improvement honestly.' },
      { style: 'FRIENDLY' as const, instruction: 'Write a warm and natural review. Use conversational tone. Show genuine enthusiasm for positives and honest feedback about any negatives.' },
      { style: 'CONCISE' as const, instruction: 'Write a short and direct review. Be brief — 1-2 sentences maximum. Hit the key points only.' },
    ];

    const ratingsText = input.ratings
      .map(r => `- ${r.questionText}: ${r.rating}/5`)
      .join('\n');

    const drafts = await Promise.all(
      styles.map(async ({ style, instruction }) => {
        const prompt = `You are helping a customer write a Google review for "${input.businessName}" (a ${input.categoryName}).

The customer rated their experience:
${ratingsText}
Overall average: ${input.averageRating.toFixed(1)}/5
${input.comment ? `\nCustomer's note: "${input.comment}"` : ''}

${instruction}

IMPORTANT RULES:
- Write from the customer's perspective (first person)
- Only mention what the customer actually rated or commented on
- Do NOT invent staff names, specific dishes, prices, or experiences not mentioned
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
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Groq API error: ${res.status}`);
      }

      const data = await res.json() as ChatCompletionResponse;
      return data.choices[0]?.message?.content || '';
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}
