import { ReviewDraftInput } from './ai.service';

interface ValidationResult {
  passed: boolean;
  reasons: string[];
}

export class ReviewValidator {
  private static GENERIC_PHRASES = [
    'hidden gem', 'exceeded expectations', 'i had the pleasure',
    'highly recommend', 'highly recommended', 'would definitely recommend',
    'can\'t recommend enough', 'top-notch', 'a must-visit', 'must visit',
    'second to none', 'nothing short of amazing', 'above and beyond',
    'truly remarkable', 'world-class', 'exceptional service',
    'outstanding experience', 'fantastic experience', 'amazing experience',
    'wonderful experience', 'great experience overall',
  ];

  private static POSITIVE_WORDS = ['amazing', 'loved', 'excellent', 'fantastic', 'perfect', 'incredible', 'outstanding', 'wonderful', 'exceptional'];
  private static NEGATIVE_WORDS = ['terrible', 'awful', 'worst', 'horrible', 'dreadful', 'disgusting', 'appalling'];

  validate(content: string, input: ReviewDraftInput): ValidationResult {
    const reasons: string[] = [];
    const lower = content.toLowerCase();

    // 1. Generic-phrase check
    const genericCount = ReviewValidator.GENERIC_PHRASES.filter(p => lower.includes(p)).length;
    if (genericCount >= 2) {
      reasons.push(`Contains ${genericCount} generic phrases`);
    }

    // 2. Specificity check (skip if sparse)
    const isSparse = this.isSparse(input);
    if (!isSparse) {
      const customerDetails = this.extractCustomerDetails(input);
      const matchCount = customerDetails.filter(d => lower.includes(d.toLowerCase())).length;
      if (matchCount === 0 && customerDetails.length > 0) {
        reasons.push('No customer-provided details found in review');
      }
    }

    // 3. Sentiment alignment
    if (input.averageRating <= 2) {
      const positiveCount = ReviewValidator.POSITIVE_WORDS.filter(w => lower.includes(w)).length;
      if (positiveCount >= 2) {
        reasons.push('Strongly positive language for low rating');
      }
    }
    if (input.averageRating >= 4) {
      const negativeCount = ReviewValidator.NEGATIVE_WORDS.filter(w => lower.includes(w)).length;
      if (negativeCount >= 1) {
        reasons.push('Strongly negative language for high rating');
      }
    }

    // 4. Hallucination check: dollar amounts not in input
    const dollarPattern = /\$\d+/;
    if (dollarPattern.test(content) && !input.comment?.match(dollarPattern) && !input.answers.some(a => a.textAnswer?.match(dollarPattern))) {
      reasons.push('Contains dollar amounts not in customer input');
    }

    return { passed: reasons.length === 0, reasons };
  }

  private isSparse(input: ReviewDraftInput): boolean {
    const hasChips = input.answers.some(a =>
      (a.questionType === 'SINGLE_CHOICE' && a.selectedOption) ||
      (a.questionType === 'MULTI_CHOICE' && a.selectedOptions?.length)
    );
    const hasText = input.answers.some(a => a.questionType === 'TEXT' && a.textAnswer);
    return !hasChips && !hasText && !input.comment;
  }

  private extractCustomerDetails(input: ReviewDraftInput): string[] {
    const details: string[] = [];
    for (const a of input.answers) {
      if (a.selectedOption) details.push(a.selectedOption);
      if (a.selectedOptions) details.push(...a.selectedOptions);
      if (a.textAnswer) {
        // Extract key phrases (words of 4+ chars) from free text
        const words = a.textAnswer.split(/\s+/).filter(w => w.length >= 4);
        details.push(...words.slice(0, 5));
      }
    }
    if (input.comment) {
      const words = input.comment.split(/\s+/).filter(w => w.length >= 4);
      details.push(...words.slice(0, 5));
    }
    return details;
  }
}
