import { ReviewValidator } from '../review-validator.service';
import { ReviewDraftInput } from '../ai.service';

describe('ReviewValidator', () => {
  const validator = new ReviewValidator();

  const richInput: ReviewDraftInput = {
    businessName: 'Balance Plus - HSR',
    categoryName: 'Physiotherapy',
    answers: [
      { questionText: 'How would you rate your session?', questionType: 'STAR_RATING', rating: 4 },
      { questionText: 'What was most helpful?', questionType: 'MULTI_CHOICE', selectedOptions: ['Therapist listened', 'Exercise guidance'] },
      { questionText: 'How was the therapist\'s communication?', questionType: 'SINGLE_CHOICE', selectedOption: 'Very clear' },
      { questionText: 'How was the appointment timing?', questionType: 'SINGLE_CHOICE', selectedOption: 'On time' },
      { questionText: 'Anything specific?', questionType: 'TEXT', textAnswer: 'The therapist explained why each exercise was needed' },
    ],
    comment: undefined,
    averageRating: 4,
  };

  const sparseInput: ReviewDraftInput = {
    businessName: 'Balance Plus - HSR',
    categoryName: 'Physiotherapy',
    answers: [
      { questionText: 'How would you rate your session?', questionType: 'STAR_RATING', rating: 5 },
    ],
    comment: undefined,
    averageRating: 5,
  };

  const lowRatingInput: ReviewDraftInput = {
    ...richInput,
    averageRating: 2,
    answers: [
      { questionText: 'How would you rate your session?', questionType: 'STAR_RATING', rating: 2 },
      { questionText: 'What was most helpful?', questionType: 'MULTI_CHOICE', selectedOptions: [] },
      { questionText: 'How was the appointment timing?', questionType: 'SINGLE_CHOICE', selectedOption: 'Significant wait' },
    ],
  };

  // ── Generic-phrase detection ──

  it('passes when review has 0-1 generic phrases', () => {
    const review = 'The therapist listened carefully and explained the exercises clearly. I also liked the personal attention during the session.';
    expect(validator.validate(review, richInput).passed).toBe(true);
  });

  it('fails when review has 2+ generic phrases', () => {
    const review = 'This was a hidden gem — the service truly exceeded expectations. I would highly recommend this place to everyone.';
    const result = validator.validate(review, richInput);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('generic phrases'))).toBe(true);
  });

  // ── Specificity check ──

  it('passes when review contains customer-provided details', () => {
    const review = 'The therapist listened carefully and the exercise guidance was helpful. Communication was very clear throughout.';
    expect(validator.validate(review, richInput).passed).toBe(true);
  });

  it('fails when review has no customer details (non-sparse input)', () => {
    const review = 'Had a great time. Everything was wonderful and I really enjoyed the visit. Would come again.';
    const result = validator.validate(review, richInput);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('customer-provided details'))).toBe(true);
  });

  it('skips specificity check for sparse input', () => {
    const review = 'Good experience at Balance Plus.';
    // Sparse input = only star ratings, no chips/text — specificity check should be relaxed
    expect(validator.validate(review, sparseInput).passed).toBe(true);
  });

  // ── Sentiment alignment ──

  it('fails when strongly positive language used for low rating', () => {
    const review = 'This place was amazing and I absolutely loved every minute of it. The experience was excellent!';
    const result = validator.validate(review, lowRatingInput);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('positive language'))).toBe(true);
  });

  it('passes when negative language matches low rating', () => {
    const review = 'The appointment started late and I had to wait a long time. The session was below expectations.';
    const result = validator.validate(review, lowRatingInput);
    // Should not fail on sentiment — negative tone matches low rating
    expect(result.reasons.some(r => r.includes('positive language'))).toBe(false);
  });

  it('fails when strongly negative language used for high rating', () => {
    const highInput = { ...richInput, averageRating: 5 };
    const review = 'This was a terrible experience. The therapist was horrible and awful in every way.';
    const result = validator.validate(review, highInput);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('negative language'))).toBe(true);
  });

  // ── Hallucination check ──

  it('fails when dollar amounts appear that customer did not provide', () => {
    const review = 'Great session, well worth the $150 I paid. The therapist was excellent.';
    const result = validator.validate(review, richInput);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('dollar amounts'))).toBe(true);
  });

  it('passes when dollar amounts appear and customer mentioned them', () => {
    const inputWithPrice: ReviewDraftInput = {
      ...richInput,
      answers: [
        ...richInput.answers,
        { questionText: 'Price comment', questionType: 'TEXT', textAnswer: 'The $150 fee was reasonable' },
      ],
    };
    const review = 'The $150 session was well worth it. The therapist listened carefully.';
    expect(validator.validate(review, inputWithPrice).passed).toBe(true);
  });

  // ── Insight presence check ──

  it('passes when selected insight label appears in review', () => {
    const inputWithInsights: ReviewDraftInput = {
      ...richInput,
      selectedInsights: ['Clear explanation', 'Personal attention', 'On time'],
    };
    const review = 'The therapist gave a clear explanation and I appreciated the personal attention during the session.';
    expect(validator.validate(review, inputWithInsights).passed).toBe(true);
  });

  it('fails when no selected insight labels appear in review', () => {
    const inputWithInsights: ReviewDraftInput = {
      ...richInput,
      selectedInsights: ['Clear explanation', 'Personal attention', 'On time'],
    };
    const review = 'Had a good session at Balance Plus. Everything was fine and the experience was pleasant.';
    const result = validator.validate(review, inputWithInsights);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('insights'))).toBe(true);
  });

  it('isSparse returns false when selectedInsights provided', () => {
    const inputWithInsights: ReviewDraftInput = {
      ...sparseInput,
      selectedInsights: ['Friendly staff'],
    };
    // With insights, even star-only answers should not be considered sparse
    const review = 'The staff at Balance Plus were friendly and welcoming.';
    const result = validator.validate(review, inputWithInsights);
    // Should not fail specificity check since insights make it non-sparse
    expect(result.reasons.some(r => r.includes('customer-provided details'))).toBe(false);
  });

  // ── Test case from requirements: Balance Plus physiotherapy ──

  it('accepts a good physiotherapy review', () => {
    const review = 'I had a good session at Balance Plus - HSR. The therapist took time to listen to my concerns and explained the exercises clearly. I also liked that the session felt personalized rather than rushed.';
    expect(validator.validate(review, richInput).passed).toBe(true);
  });

  it('rejects a generic physiotherapy review', () => {
    const review = 'Great experience at Balance Plus - HSR. The service was truly exceptional and exceeded expectations. Highly recommended!';
    const result = validator.validate(review, richInput);
    expect(result.passed).toBe(false);
  });
});
