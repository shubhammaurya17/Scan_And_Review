import { IAIService, ReviewDraftInput, GeneratedDraft, SentimentResult } from './ai.service';
import { config } from '../config/env';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

export class GeminiService implements IAIService {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor() {
    this.apiKey = config.GEMINI_API_KEY || '';
    this.model = config.AI_MODEL || 'gemini-2.0-flash';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `${this.baseUrl}/models/${this.model}?key=${this.apiKey}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (res.ok) {
        console.log(`✅ Gemini model "${this.model}" is available`);
        return true;
      }
      console.error(`❌ Gemini model check failed: ${res.status}`);
      return false;
    } catch {
      return false;
    }
  }

  async generateReviewDrafts(input: ReviewDraftInput): Promise<GeneratedDraft[]> {
    const ratingsText = input.ratings
      .map(r => {
        const emoji = r.rating >= 4 ? '👍' : r.rating <= 2 ? '👎' : '👌';
        return `- ${r.questionText}: ${r.rating}/5 ${emoji}`;
      })
      .join('\n');

    const overallSentiment = input.averageRating >= 4 ? 'mostly positive'
      : input.averageRating >= 3 ? 'mixed'
      : 'mostly negative';

    // Generate all 3 styles in a single API call for efficiency
    const prompt = `You are helping a real customer write a Google review for "${input.businessName}" (a ${input.categoryName} business).

Here's how the customer rated their visit:
${ratingsText}

Overall: ${input.averageRating.toFixed(1)}/5 (${overallSentiment})
${input.comment ? `\nCustomer's personal note: "${input.comment}"` : ''}

Write exactly 3 different review drafts in these styles. Each draft MUST feel genuinely different — not just rephrased versions of each other. Vary the structure, opening, focus points, and word choices.

STYLE 1 — Balanced & Authentic (3-4 sentences):
A polished, well-rounded review. Sound like someone who thinks before writing but keeps it real. Highlight the most notable aspects of the visit. Use natural, confident language.

STYLE 2 — Warm & Natural (2-3 sentences):
A casual, conversational review like you're texting a friend about the place. Use contractions, simple words, genuine emotion. Show personality.

STYLE 3 — Short & Direct (1-2 sentences max):
A punchy, no-nonsense review. Get to the point immediately. What mattered most? Say it plainly.

CRITICAL RULES:
- Write each in first person as the customer
- ONLY reference things from the ratings and comments — NEVER invent specific details like staff names, dish names, prices, or events
- Match the tone to the actual ratings — don't sugarcoat low scores or over-hype average ones
- Each draft must use a DIFFERENT opening (never start two drafts the same way)
- Sound like real Google reviews, not AI-generated marketing copy
- Do NOT use phrases like "I had the pleasure", "I highly recommend", "exceeded expectations"
- VARY sentence length and rhythm between drafts

Respond in this EXACT format with no other text:
---STYLE1---
[review text]
---STYLE2---
[review text]
---STYLE3---
[review text]`;

    try {
      const content = await this.generate(prompt, 1.0, 600);
      return this.parseDrafts(content);
    } catch (err) {
      console.error('Gemini draft generation failed, trying individual calls:', err);
      // Fallback: generate each style individually
      return this.generateDraftsIndividually(input, ratingsText, overallSentiment);
    }
  }

  private parseDrafts(content: string): GeneratedDraft[] {
    const drafts: GeneratedDraft[] = [];
    const styleMap: Array<{ marker: string; style: GeneratedDraft['style'] }> = [
      { marker: '---STYLE1---', style: 'PROFESSIONAL' },
      { marker: '---STYLE2---', style: 'FRIENDLY' },
      { marker: '---STYLE3---', style: 'CONCISE' },
    ];

    for (let i = 0; i < styleMap.length; i++) {
      const { marker, style } = styleMap[i];
      const nextMarker = styleMap[i + 1]?.marker;
      const startIdx = content.indexOf(marker);
      if (startIdx === -1) continue;

      const textStart = startIdx + marker.length;
      const textEnd = nextMarker ? content.indexOf(nextMarker) : content.length;
      if (textEnd === -1) continue;

      let text = content.slice(textStart, textEnd).trim();
      // Clean up any accidental quotes or prefixes
      text = text.replace(/^["']|["']$/g, '');
      text = text.replace(/^(Review|Here'?s?|My review|Draft):?\s*/i, '');

      if (text.length > 10) {
        drafts.push({ style, content: text });
      }
    }

    return drafts;
  }

  private async generateDraftsIndividually(
    input: ReviewDraftInput,
    ratingsText: string,
    overallSentiment: string
  ): Promise<GeneratedDraft[]> {
    const styles = [
      {
        style: 'PROFESSIONAL' as const,
        instruction: `Write a polished, genuine Google review in 3-4 sentences. Sound like a real person who visited — be specific about what was good or bad based on the ratings. Use natural, confident language. Avoid generic filler.`,
      },
      {
        style: 'FRIENDLY' as const,
        instruction: `Write a casual, upbeat Google review in 2-3 sentences. Sound like you're telling a friend about the place. Use contractions, simple words, genuine emotion.`,
      },
      {
        style: 'CONCISE' as const,
        instruction: `Write a brief, punchy Google review in 1-2 sentences max. Get straight to the point — what was good, what wasn't. No fluff.`,
      },
    ];

    const drafts = await Promise.all(
      styles.map(async ({ style, instruction }) => {
        const prompt = `You are a real customer writing a Google review for "${input.businessName}" (${input.categoryName}).

Here's how you rated your visit:
${ratingsText}

Overall: ${input.averageRating.toFixed(1)}/5 (${overallSentiment})
${input.comment ? `\nYour personal note: "${input.comment}"` : ''}

${instruction}

RULES:
- Write in first person as the customer
- ONLY reference things the ratings cover — never invent details
- Match tone to ratings — don't sugarcoat low ratings
- Sound like a real Google review, not AI
- Do NOT start with the business name
- Output ONLY the review text`;

        try {
          const content = await this.generate(prompt, 1.0, 250);
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
      const res = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
              topP: 0.95,
              topK: 40,
            },
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'no body');
        console.error(`Gemini API error ${res.status}: ${errorBody}`);
        throw new Error(`Gemini API error: ${res.status}`);
      }

      const data = (await res.json()) as GeminiResponse;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini');
      return text;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}
