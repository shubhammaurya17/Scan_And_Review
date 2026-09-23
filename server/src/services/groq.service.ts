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
      {
        style: 'PROFESSIONAL' as const,
        instruction: `Write a polished, genuine Google review in 3-4 sentences. Sound like a real person who visited — be specific about what was good or bad based on the ratings. Use natural, confident language. No generic filler phrases like "I had the pleasure" or "I would recommend". Just honest, clear feedback.`,
      },
      {
        style: 'FRIENDLY' as const,
        instruction: `Write a casual, upbeat Google review in 2-3 sentences. Sound like you're telling a friend about the place. Use conversational language — contractions, simple words, genuine emotion. If something was great, show excitement. If something was lacking, be honest but kind.`,
      },
      {
        style: 'CONCISE' as const,
        instruction: `Write a brief, punchy Google review in 1-2 sentences max. Get straight to the point — what was good, what wasn't. No fluff, no pleasantries. Think of it as a quick summary for someone scrolling through reviews.`,
      },
    ];

    const ratingsText = input.ratings
      .map(r => {
        const emoji = r.rating >= 4 ? '👍' : r.rating <= 2 ? '👎' : '👌';
        return `- ${r.questionText}: ${r.rating}/5 ${emoji}`;
      })
      .join('\n');

    const overallSentiment = input.averageRating >= 4 ? 'mostly positive'
      : input.averageRating >= 3 ? 'mixed'
      : 'mostly negative';

    const drafts = await Promise.all(
      styles.map(async ({ style, instruction }) => {
        const prompt = `You are a real customer writing a Google review for "${input.businessName}" (${input.categoryName}).

Here's how you rated your visit:
${ratingsText}

Overall: ${input.averageRating.toFixed(1)}/5 (${overallSentiment})
${input.comment ? `\nYour personal note: "${input.comment}"` : ''}

${instruction}

CRITICAL RULES:
- Write in first person as the customer
- ONLY reference things the ratings and comments actually cover — never invent details
- Do NOT mention specific staff names, dish names, prices, or events unless the customer wrote about them
- Match the tone to the ratings — don't sugarcoat low ratings or be overly excited about mediocre ones
- Sound like a real Google review, not an AI-generated one
- Do NOT start with the business name
- Do NOT use quotation marks around the review
- Output ONLY the review text, nothing else`;

        try {
          const content = await this.generate(prompt, 0.8, 200);
          // Clean up any accidental quotation marks or prefixes
          let cleaned = content.trim();
          cleaned = cleaned.replace(/^["']|["']$/g, '');
          cleaned = cleaned.replace(/^(Review|Here'?s?|My review|Draft):?\s*/i, '');
          return { style, content: cleaned };
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
          messages: [
            { role: 'system', content: 'You are a helpful assistant that writes Google reviews. Follow the user instructions exactly. Output only what is asked, no preamble.' },
            { role: 'user', content: prompt },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'no body');
        console.error(`Groq API error ${res.status}: ${errorBody}`);

        // If 404 (model not found), try fallback model
        if (res.status === 404 && this.model !== 'llama3-8b-8192') {
          console.log(`Retrying with fallback model llama3-8b-8192...`);
          return this.generateWithModel('llama3-8b-8192', prompt, temperature, maxTokens);
        }

        throw new Error(`Groq API error: ${res.status}`);
      }

      const data = await res.json() as ChatCompletionResponse;
      return data.choices[0]?.message?.content || '';
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  private async generateWithModel(model: string, prompt: string, temperature: number, maxTokens: number): Promise<string> {
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
          model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that writes Google reviews. Follow the user instructions exactly. Output only what is asked, no preamble.' },
            { role: 'user', content: prompt },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'no body');
        console.error(`Groq fallback model error ${res.status}: ${errorBody}`);
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
