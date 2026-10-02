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

    // Add randomness so Gemini generates completely different results every time
    const randomSeed = Math.random().toString(36).substring(2, 10);
    const timestamp = Date.now();
    const randomAngle = ['what surprised them', 'what they noticed first', 'how it compared to expectations', 'the overall vibe', 'the one thing they keep thinking about'][Math.floor(Math.random() * 5)];
    const randomOpener = ['Start with a feeling or reaction', 'Start with what happened', 'Start with a verdict', 'Start mid-thought', 'Start with a contrast'][Math.floor(Math.random() * 5)];

    // Generate all 3 styles in a single API call for efficiency
    const prompt = `You are ghostwriting a Google review on behalf of a real customer who just visited "${input.businessName}" (a ${input.categoryName} business).

Their ratings:
${ratingsText}

Overall impression: ${input.averageRating.toFixed(1)}/5 (${overallSentiment})
${input.comment ? `Customer said in their own words: "${input.comment}"` : ''}

Write 3 review drafts. Each one should read like it was typed by a real person — imperfect, personal, and honest. Think about how actual people write Google reviews: sometimes they ramble a bit, sometimes they're blunt, sometimes they mention one thing that stuck with them.

DRAFT 1 — Thoughtful (3-4 sentences):
Write like someone who took a moment to reflect. Natural flow, not a list. Mention what stood out (good or bad). Don't try to cover everything.

DRAFT 2 — Casual (2-3 sentences):
Write like someone tapping out a quick review on their phone. Relaxed grammar is fine. Show genuine feeling — excitement, disappointment, surprise, whatever fits the ratings.

DRAFT 3 — Minimal (1-2 sentences):
Write like someone who rarely leaves reviews but felt compelled to this time. Just the core takeaway.

HARD RULES:
- First person only
- NEVER invent specifics not in the ratings (no staff names, no menu items, no prices)
- Match the sentiment to the actual scores — a 2/5 is not "pretty decent"
- NO review clichés: avoid "exceeded expectations", "hidden gem", "I had the pleasure", "highly recommend", "will definitely be back", "top-notch"
- Each draft must start differently — vary the first word and sentence structure
- Keep it grounded: real reviews are specific about what was good/bad, not generic praise
- Vary sentence length within each draft — mix short and longer sentences
- IMPORTANT: Every generation must be completely unique. Never repeat phrasing from previous outputs.
- Focus angle for this generation: ${randomAngle}
- Opening style: ${randomOpener}
- Uniqueness seed: ${randomSeed}-${timestamp}

Format your response EXACTLY like this (no extra text):
---STYLE1---
[draft text]
---STYLE2---
[draft text]
---STYLE3---
[draft text]`;

    try {
      const content = await this.generate(prompt, 1.1, 700);
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
    const randomSeed = Math.random().toString(36).substring(2, 10);
    const timestamp = Date.now();
    const angles = ['what surprised you', 'what you noticed first', 'how it compared to expectations', 'the overall vibe', 'the one thing you keep thinking about'];
    const styles = [
      {
        style: 'PROFESSIONAL' as const,
        instruction: `Write a thoughtful Google review in 3-4 sentences. Sound like someone reflecting on their visit — not listing pros and cons, just sharing what stuck with them. Be honest about what was good and what wasn't. Avoid review clichés. Focus on: ${angles[Math.floor(Math.random() * angles.length)]}.`,
      },
      {
        style: 'FRIENDLY' as const,
        instruction: `Write a casual Google review in 2-3 sentences, like you're typing it on your phone right after leaving. Relaxed tone, real emotion, maybe a bit unpolished. Show personality — be enthusiastic, disappointed, or surprised based on the ratings. Focus on: ${angles[Math.floor(Math.random() * angles.length)]}.`,
      },
      {
        style: 'CONCISE' as const,
        instruction: `Write a Google review in 1-2 sentences max. You rarely leave reviews — say only what compelled you to write this one. Be blunt and direct. Focus on: ${angles[Math.floor(Math.random() * angles.length)]}.`,
      },
    ];

    const drafts = await Promise.all(
      styles.map(async ({ style, instruction }) => {
        const prompt = `You are a real customer writing a Google review for "${input.businessName}" (${input.categoryName}).

Your ratings:
${ratingsText}

Overall: ${input.averageRating.toFixed(1)}/5 (${overallSentiment})
${input.comment ? `You noted: "${input.comment}"` : ''}

${instruction}

RULES:
- First person, as the customer
- ONLY mention things from the ratings — never make up details
- Match tone to the actual scores
- NO clichés like "hidden gem", "exceeded expectations", "highly recommend", "will definitely be back"
- IMPORTANT: Every generation must produce completely unique text. Never repeat prior phrasing.
- Don't start with the business name
- Output ONLY the review text, nothing else
- Uniqueness seed: ${randomSeed}-${timestamp}`;

        try {
          const content = await this.generate(prompt, 1.2, 250);
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
      PROFESSIONAL: 'Keep it professional but warm — like a real business owner who cares, not a corporate PR template.',
      FRIENDLY: 'Be genuinely friendly and personal — like the owner actually remembers this customer.',
      GRATEFUL: 'Express real gratitude — be specific about what you appreciate, not just "thanks for the kind words".',
      APOLOGETIC: 'Acknowledge what went wrong honestly. Don\'t be defensive or make excuses. Show you take it seriously.',
      CONCISE: 'Keep it short — 2-3 sentences max. Address the key point and move on.',
    };

    const prompt = `You are the owner of "${businessName}" writing a reply to this Google review:

"${review}"

${toneInstructions[tone] || toneInstructions.PROFESSIONAL}

Write a reply that sounds like a real person — not a chatbot or a marketing team. Address what the reviewer actually said. Keep it under 100 words.

AVOID these patterns that scream "AI-generated":
- Starting with "Thank you for your [adjective] review/feedback"
- "We're thrilled/delighted to hear..."
- "Your feedback is invaluable"
- "We strive to..."
- Ending with "We look forward to welcoming you back"

Write only the reply:`;

    const content = await this.generate(prompt, 0.8, 200);
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
