import { IAIService, ReviewDraftInput, GeneratedDraft, SentimentResult, CustomerAnswer } from './ai.service';
import { config } from '../config/env';

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
}

export class GroqService implements IAIService {
  private baseUrl: string;
  private model: string;
  private apiKey: string;
  // Ordered fallback list — first available model wins
  private static readonly FALLBACK_MODELS = [
    'openai/gpt-oss-20b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'qwen/qwen3.8-27b',
    'meta-llama/llama-4-scout-17b-16e-instruct',
  ];
  private resolvedModel: string | null = null;

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
      if (!res.ok) return false;

      // Log available models on startup and find a working model
      try {
        const data = await res.json() as { data: Array<{ id: string }> };
        const ids = data.data.map(m => m.id);
        console.log(`📋 Groq available models: ${ids.join(', ')}`);

        // Check configured model first, then fallbacks
        const candidates = [this.model, ...GroqService.FALLBACK_MODELS];
        for (const candidate of candidates) {
          if (ids.includes(candidate)) {
            this.resolvedModel = candidate;
            if (candidate !== this.model) {
              console.log(`⚠️ Configured model "${this.model}" not available, using "${candidate}" instead`);
            } else {
              console.log(`✅ Using model: ${candidate}`);
            }
            break;
          }
        }
        if (!this.resolvedModel) {
          console.error(`❌ None of the configured/fallback models are available. Available: ${ids.join(', ')}`);
        }
      } catch {
        // If we can't parse models list, we'll try the configured model anyway
      }

      return true;
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
- Do NOT use quotation marks around the review
- If a BUSINESS CONTEXT section with an Area is provided above, try to mention the area or neighborhood ONCE naturally (e.g. "this place in Koramangala", "near Downtown") — only if it fits the flow. Skip if it sounds forced.
- Use specific service words for this ${input.categoryName} (e.g. for a Restaurant say "meal", "dishes", "dine-in"; for a Salon say "haircut", "styling") instead of vague words like "experience" or "visit" — use words a real customer would use.
- Output ONLY the review text, nothing else`;

        try {
          const content = await this.generate(prompt, 0.8, 200);
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
    // Use the resolved model from isAvailable(), or fall back to configured model
    const model = this.resolvedModel || this.model;
    return this.generateWithModel(model, prompt, temperature, maxTokens);
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
        console.error(`Groq API error ${res.status} (model: ${model}): ${errorBody}`);

        // If model not found, try next fallback
        if (res.status === 404) {
          const fallbacks = GroqService.FALLBACK_MODELS.filter(m => m !== model && m !== this.model);
          for (const fallback of fallbacks) {
            try {
              console.log(`Retrying with fallback model ${fallback}...`);
              const result = await this.generateWithModel(fallback, prompt, temperature, maxTokens);
              // Cache the working model for future calls
              this.resolvedModel = fallback;
              return result;
            } catch (e: any) {
              if (e.message?.includes('404')) continue;
              throw e;
            }
          }
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
}
