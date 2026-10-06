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
      { style: 'PROFESSIONAL' as const, instruction: 'Write a balanced and authentic review in 30-50 words. Mention what specifically stood out and why. Use descriptive language instead of generic adjectives like good/great/excellent. 2-3 sentences max.' },
      { style: 'FRIENDLY' as const, instruction: 'Write a warm and natural review in 30-45 words. Conversational and emotionally genuine. Share how the experience felt. Show genuine personality. 2-3 sentences max.' },
      { style: 'HEARTFELT' as const, instruction: 'Write a heartfelt and personal review in 30-50 words. Connect the experience to why it mattered. Speak from the heart about what left an impression. 2-3 sentences max.' },
    ];

    const feedbackBlock = this.formatFeedbackBlock(input);
    const sparse = this.isSparse(input);
    const sparseNote = sparse
      ? '\nNOTE: The customer provided only star ratings with no specific details. Write brief, honest reviews. Do NOT invent any specifics.'
      : '';

    const drafts = await Promise.all(
      styles.map(async ({ style, instruction }) => {
        const prompt = `You are helping a customer turn their actual feedback into a natural Google review for a ${input.categoryName} they visited.

CUSTOMER FEEDBACK:
${feedbackBlock}

Overall: ${input.averageRating.toFixed(1)}/5

${instruction}
${sparseNote}

IMPORTANT RULES:
- Write from the customer's perspective (first person)
- Write ONLY from the facts provided above — do NOT invent details
- NEVER include the business name in the review
- NEVER use generic words like "good", "great", "excellent", "solid", "amazing" — describe WHAT happened and WHY it mattered
- Do NOT use generic phrases like "hidden gem", "exceeded expectations", "highly recommend"
- If ratings are low, reflect that honestly — do not turn negatives into positives
- USE SIMPLE, EVERYDAY ENGLISH ONLY. Plain words everyone knows. NO idioms, NO metaphors, NO figurative language. Never write things like "my shoulders dropped" or "a breath of fresh air". Just say what happened directly.
- Write like a normal person texting a friend about their visit — casual, simple, honest
- If a BUSINESS CONTEXT section with an Area is provided above, try to mention the area or neighborhood ONCE naturally (e.g. "this place in Koramangala", "near Downtown") — only if it fits the flow. Skip if it sounds forced.
- Use specific service words for this ${input.categoryName} (e.g. for a Restaurant say "meal", "dishes", "dine-in"; for a Salon say "haircut", "styling") instead of vague words like "experience" or "visit" — use words a real customer would use.

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
