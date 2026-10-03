import { IAIService, ReviewDraftInput, GeneratedDraft, SentimentResult, CustomerAnswer } from './ai.service';
import { config } from '../config/env';

interface GeminiGenerateContentResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

interface InteractionsResponse {
  id: string;
  model: string;
  status: string;
  steps: Array<{
    type: string;
    content: Array<{ type: string; text: string }>;
  }>;
  usage?: {
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
  };
}

export class GeminiService implements IAIService {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor() {
    this.apiKey = config.GEMINI_API_KEY || '';
    // Only use AI_MODEL if it's actually a Gemini model; otherwise use default
    const configModel = config.AI_MODEL;
    this.model = configModel && configModel.startsWith('gemini') ? configModel : 'gemini-3.8-flash';
    console.log(`🔧 GeminiService initialized with model: ${this.model}`);
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
    const feedbackBlock = this.formatFeedbackBlock(input);
    const sparse = this.isSparse(input);

    const overallSentiment = input.averageRating >= 4 ? 'mostly positive'
      : input.averageRating >= 3 ? 'mixed'
      : 'mostly negative';

    const sparseNote = sparse
      ? '\nNOTE: The customer provided only star ratings with no specific details. Write brief, honest reviews. Do NOT invent any specifics. Keep each draft to 1-2 sentences.'
      : '';

    const prompt = `You are helping a customer turn their actual feedback into a natural Google review for a ${input.categoryName} they visited.

CUSTOMER FEEDBACK:
${feedbackBlock}

Overall: ${input.averageRating.toFixed(1)}/5 (${overallSentiment})

INSTRUCTIONS:
- Write the review ONLY from the facts provided above. Use the customer's selected options and their own words.
- Do NOT invent details: no staff names, no specific dishes/products/treatments, no prices, no outcomes the customer didn't mention.
- Do NOT add generic praise to fill space. Do NOT use marketing language.
- Do NOT automatically include a recommendation phrase like "highly recommend".
- NEVER include the business name anywhere in the review.
- NEVER use generic filler words like "good", "great", "excellent", "solid", "amazing", "wonderful", "fantastic" — instead describe WHAT specifically happened and WHY it mattered.
- Explain WHAT was good or bad in concrete terms rather than labeling it with an adjective.
- Write like a thoughtful person explaining their experience to a friend — specific, descriptive, with personality.
- The review should sound like a real customer describing what happened, not an advertisement or a template.
- Preserve the customer's actual sentiment — do not upgrade mixed/negative feedback.
${sparseNote}

Write exactly 3 drafts:

DRAFT 1 — Balanced & Authentic (50-90 words):
A thoughtful first-person review that walks through the experience. Mention 1-3 concrete details from the feedback and explain WHY they stood out. Use descriptive language that paints a picture instead of generic adjectives.

DRAFT 2 — Warm & Natural (50-80 words):
Conversational and emotionally genuine. Share how the experience made the customer feel. Still grounded in the same facts but told with warmth and personality. Different sentence structure and opening from Draft 1.

DRAFT 3 — Heartfelt & Personal (50-90 words):
A deeply personal, reflective review that connects the experience to why it mattered. Speak from the heart about what left an impression and why. Thoughtful and sincere — reads like someone who genuinely cares about sharing their honest experience.

CRITICAL: All 3 drafts must use the SAME customer-provided facts. Style changes wording, not facts.

Format EXACTLY:
---STYLE1---
[text]
---STYLE2---
[text]
---STYLE3---
[text]`;

    try {
      const content = await this.generate(prompt, 1.1, 700);
      const drafts = this.parseDrafts(content);
      if (drafts.length >= 2) return drafts;
      // Gemini often hits MAX_TOKENS and returns only 1 draft — fall back
      return this.generateDraftsIndividually(input);
    } catch (err) {
      console.error('Gemini draft generation failed, trying individual calls:', err);
      return this.generateDraftsIndividually(input);
    }
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

  private parseDrafts(content: string): GeneratedDraft[] {
    const drafts: GeneratedDraft[] = [];
    const styleMap: Array<{ marker: string; style: GeneratedDraft['style'] }> = [
      { marker: '---STYLE1---', style: 'PROFESSIONAL' },
      { marker: '---STYLE2---', style: 'FRIENDLY' },
      { marker: '---STYLE3---', style: 'HEARTFELT' },
    ];

    for (let i = 0; i < styleMap.length; i++) {
      const { marker, style } = styleMap[i];
      const nextMarker = styleMap[i + 1]?.marker;
      const startIdx = content.indexOf(marker);
      if (startIdx === -1) continue;

      const textStart = startIdx + marker.length;
      let textEnd = nextMarker ? content.indexOf(nextMarker) : content.length;
      if (textEnd === -1) textEnd = content.length; // next marker not found, take rest

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
  ): Promise<GeneratedDraft[]> {
    const feedbackBlock = this.formatFeedbackBlock(input);
    const sparse = this.isSparse(input);

    const overallSentiment = input.averageRating >= 4 ? 'mostly positive'
      : input.averageRating >= 3 ? 'mixed'
      : 'mostly negative';

    const sparseNote = sparse
      ? '\nNOTE: The customer provided only star ratings. Write a brief, honest review. Do NOT invent any specifics. Keep it to 1-2 sentences.'
      : '';

    const styles = [
      {
        style: 'PROFESSIONAL' as const,
        instruction: `Write a balanced, authentic Google review in 50-90 words. A thoughtful first-person review that walks through the experience mentioning 1-3 concrete details from the feedback. Explain WHY things stood out using descriptive language instead of generic adjectives.${sparseNote}`,
      },
      {
        style: 'FRIENDLY' as const,
        instruction: `Write a warm, natural Google review in 50-80 words. Conversational and emotionally genuine. Share how the experience made the customer feel. Grounded in the same customer facts but told with warmth and personality. Different sentence structure and opening.${sparseNote}`,
      },
      {
        style: 'HEARTFELT' as const,
        instruction: `Write a heartfelt, personal Google review in 50-90 words. A deeply personal, reflective review that connects the experience to why it mattered. Speak from the heart about what left an impression and why. Thoughtful and sincere.${sparseNote}`,
      },
    ];

    const drafts = await Promise.all(
      styles.map(async ({ style, instruction }) => {
        const prompt = `You are helping a customer turn their actual feedback into a natural Google review for a ${input.categoryName} they visited.

CUSTOMER FEEDBACK:
${feedbackBlock}

Overall: ${input.averageRating.toFixed(1)}/5 (${overallSentiment})

${instruction}

RULES:
- Write in first person as the customer
- Write ONLY from the facts provided above — do NOT invent details
- NEVER include the business name in the review
- NEVER use generic words like "good", "great", "excellent", "solid", "amazing", "wonderful" — describe WHAT happened and WHY it mattered instead
- Do NOT use generic phrases like "hidden gem", "exceeded expectations", "highly recommend"
- Write like a real person telling a friend about their experience — specific and descriptive
- Preserve the customer's actual sentiment
- Do NOT start with the business name
- Output ONLY the review text, nothing else`;

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
    // Try the Interactions API first (recommended for gemini-3.8-flash+)
    try {
      return await this.generateViaInteractions(prompt, temperature, maxTokens);
    } catch (interactionsErr) {
      console.warn('Interactions API failed, falling back to generateContent:', (interactionsErr as Error).message);
      return this.generateViaContent(prompt, temperature, maxTokens);
    }
  }

  private async generateViaInteractions(prompt: string, temperature: number, maxTokens: number): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(
        `${this.baseUrl}/interactions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify({
            model: this.model,
            input: prompt,
            generation_config: {
              temperature,
              max_output_tokens: maxTokens,
            },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'no body');
        console.error(`Interactions API error ${res.status}: ${errorBody}`);
        throw new Error(`Interactions API error: ${res.status}`);
      }

      const data = (await res.json()) as InteractionsResponse;

      // Extract text from steps
      let text = '';
      for (const step of data.steps || []) {
        if (step.type === 'model_output' && step.content) {
          for (const part of step.content) {
            if (part.type === 'text' && part.text) {
              text += part.text;
            }
          }
        }
      }

      if (!text) throw new Error('Empty response from Interactions API');

      console.log(`✅ Interactions API response: ${data.usage?.total_output_tokens || '?'} output tokens, ${text.length} chars`);
      return text;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  private async generateViaContent(prompt: string, temperature: number, maxTokens: number): Promise<string> {
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
        console.error(`Gemini generateContent error ${res.status}: ${errorBody}`);
        throw new Error(`Gemini API error: ${res.status}`);
      }

      const data = (await res.json()) as GeminiGenerateContentResponse;
      // Concatenate all parts in case of multi-part response
      const text = data.candidates?.[0]?.content?.parts
        ?.map(p => p.text)
        .filter(Boolean)
        .join('') || '';
      if (!text) throw new Error('Empty response from Gemini');
      return text;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}
