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

  // Random voice/perspective directives to ensure uniqueness across identical inputs
  private readonly voiceDirectives = [
    'Write as someone straightforward who says what they liked or didn\'t like.',
    'Write as someone who gets to the point about what mattered most.',
    'Write as someone who just wants to share a quick honest take.',
    'Write as someone casual who talks about their visit simply.',
    'Write as someone who focuses on what they got for their money.',
    'Write as someone who noticed how the staff treated them.',
    'Write as someone who cares about whether things worked smoothly.',
    'Write as someone who doesn\'t usually write reviews but wanted to this time.',
    'Write as someone who paid attention to the little things.',
    'Write as someone who had a clear expectation going in.',
  ];

  private readonly openingStyles = [
    'Start with what you liked or noticed first.',
    'Start with why you went there.',
    'Start with the best part of your visit.',
    'Start with how the experience was overall.',
    'Start with something specific that happened.',
    'Start with what you were expecting.',
  ];

  private getRandomDirective(): string {
    const voice = this.voiceDirectives[Math.floor(Math.random() * this.voiceDirectives.length)];
    const opening = this.openingStyles[Math.floor(Math.random() * this.openingStyles.length)];
    const seed = Math.random().toString(36).substring(2, 8);
    return `\nUNIQUENESS DIRECTIVE (seed: ${seed}):\n- ${voice}\n- ${opening}\n- Use completely fresh vocabulary and sentence structures — never repeat phrasing from previous generations.`;
  }

  constructor() {
    this.apiKey = config.GEMINI_API_KEY || '';
    // Only use AI_MODEL if it's actually a Gemini model; otherwise use default
    const configModel = config.AI_MODEL;
    this.model = configModel && configModel.startsWith('gemini') ? configModel : 'gemini-3.5-flash-lite';
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
    // Go directly to parallel individual calls — the single-prompt approach
    // often hits MAX_TOKENS and falls back here anyway, wasting a round-trip
    return this.generateDraftsIndividually(input);
  }

  private formatFeedbackBlock(input: ReviewDraftInput): string {
    const lines: string[] = [];

    // SEO context block — location and business description for natural reference
    const contextParts: string[] = [];
    if (input.locationArea) {
      contextParts.push(`Area/Neighborhood: ${input.locationArea}`);
    }
    if (input.businessDescription) {
      contextParts.push(`About this business: ${input.businessDescription}`);
    }
    if (contextParts.length > 0) {
      lines.push('BUSINESS CONTEXT (for natural reference if it fits):');
      for (const part of contextParts) {
        lines.push(`- ${part}`);
      }
      lines.push('');
    }

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
        instruction: `Write a balanced, authentic Google review in 30-50 words. A thoughtful first-person review mentioning 1-2 concrete details. Explain WHY things stood out — 2-3 sentences max.${sparseNote}`,
      },
      {
        style: 'FRIENDLY' as const,
        instruction: `Write a warm, natural Google review in 30-45 words. Conversational and emotionally genuine. Share how the experience felt. 2-3 sentences max.${sparseNote}`,
      },
      {
        style: 'HEARTFELT' as const,
        instruction: `Write a heartfelt, personal Google review in 30-50 words. Connect the experience to why it mattered. Speak from the heart. 2-3 sentences max.${sparseNote}`,
      },
    ];

    const drafts = await Promise.all(
      styles.map(async ({ style, instruction }) => {
        const prompt = `You are helping a customer turn their actual feedback into a natural Google review for a ${input.categoryName} they visited.
${this.getRandomDirective()}

CUSTOMER FEEDBACK:
${feedbackBlock}

Overall: ${input.averageRating.toFixed(1)}/5 (${overallSentiment})

${instruction}

RULES:
- Write in first person as the customer
- Write ONLY from the facts provided above — do NOT invent details
- If QUICK INSIGHTS are listed above, you MUST mention at least one of them naturally in the review — they are what the customer specifically highlighted
- NEVER include the business name in the review
- NEVER use generic words like "good", "great", "excellent", "solid", "amazing", "wonderful" — describe WHAT happened and WHY it mattered instead
- Do NOT use generic phrases like "hidden gem", "exceeded expectations", "highly recommend"
- USE SIMPLE, EVERYDAY ENGLISH ONLY. Plain words everyone knows. NO idioms, NO metaphors, NO figurative language. Never write things like "my shoulders dropped" or "a breath of fresh air". Just say what happened directly.
- Write like a normal person texting a friend about their visit — casual, simple, honest
- Preserve the customer's actual sentiment
- Do NOT start with the business name
- NEVER start with "..." or ellipsis — always begin with a complete, natural sentence
- Use completely fresh vocabulary — never reuse phrasing from any other draft
- If a BUSINESS CONTEXT section with an Area is provided above, try to mention the area or neighborhood ONCE naturally (e.g. "this place in Koramangala", "near Downtown") — only if it fits the flow. Skip if it sounds forced.
- Use specific service words for this ${input.categoryName} (e.g. for a Restaurant say "meal", "dishes", "dine-in"; for a Salon say "haircut", "styling") instead of vague words like "experience" or "visit" — use words a real customer would use.
- Output ONLY the review text, nothing else`;

        try {
          const content = await this.generate(prompt, 1.2, 120);
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
    // API call disconnected — will reconnect when feature is used
    return '';
  }

  async analyzeSentiment(text: string): Promise<SentimentResult> {
    // Permanently disabled — sentiment section removed from dashboard
    return { score: 0, label: 'NEUTRAL' };
  }

  async detectTopics(texts: string[]): Promise<string[]> {
    // API call disconnected — will reconnect when feature is used
    return [];
  }

  private async generate(prompt: string, temperature: number, maxTokens: number): Promise<string> {
    // Boost tokens moderately for reasoning overhead, but cap to avoid slow generation
    const boostedTokens = Math.max(maxTokens * 3, 512);

    // Try Interactions API with primary model
    try {
      return await this.generateViaInteractions(prompt, temperature, boostedTokens, this.model);
    } catch (err1) {
      console.warn(`Interactions API (${this.model}) failed: ${(err1 as Error).message}`);
    }

    // Try Interactions API with fallback model (gemini-3.5-flash)
    if (this.model !== 'gemini-3.5-flash') {
      try {
        console.log('Trying fallback model gemini-3.5-flash via Interactions API...');
        return await this.generateViaInteractions(prompt, temperature, boostedTokens, 'gemini-3.5-flash');
      } catch (err2) {
        console.warn(`Interactions API (gemini-3.5-flash) failed: ${(err2 as Error).message}`);
      }
    }

    // Last resort: generateContent API
    try {
      console.log('Trying generateContent API as last resort...');
      return await this.generateViaContent(prompt, temperature, boostedTokens);
    } catch (err3) {
      console.error('All Gemini API methods failed:', (err3 as Error).message);
      throw err3;
    }
  }

  private async generateViaInteractions(prompt: string, temperature: number, maxTokens: number, model?: string): Promise<string> {
    const useModel = model || this.model;
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
            model: useModel,
            input: prompt,
            generation_config: {
              temperature,
              max_output_tokens: maxTokens,
              thinking_level: 'minimal',
            },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'no body');
        console.error(`Interactions API error ${res.status} (${useModel}): ${errorBody}`);
        throw new Error(`Interactions API error: ${res.status} (${useModel})`);
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

      if (!text) throw new Error(`Empty response from Interactions API (${useModel})`);

      console.log(`✅ Interactions API (${useModel}): ${data.usage?.total_output_tokens || '?'} output tokens, ${text.length} chars`);
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
