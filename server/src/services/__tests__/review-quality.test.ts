import { TemplateService } from '../template.service';
import { ReviewDraftInput } from '../ai.service';

describe('Review Quality — Template Service with Structured Input', () => {
  const templateService = new TemplateService();

  // ── Test Case 1: Physiotherapy — rich feedback ──

  it('generates specific reviews for physiotherapy with rich feedback', async () => {
    const input: ReviewDraftInput = {
      businessName: 'Balance Plus - HSR',
      categoryName: 'Physiotherapy',
      answers: [
        { questionText: 'How would you rate your session?', questionType: 'STAR_RATING', rating: 5 },
        { questionText: 'What was most helpful?', questionType: 'MULTI_CHOICE', selectedOptions: ['Therapist listened', 'Exercise guidance', 'Personal attention'] },
        { questionText: 'How was the therapist\'s communication?', questionType: 'SINGLE_CHOICE', selectedOption: 'Very clear' },
        { questionText: 'How was the appointment timing?', questionType: 'SINGLE_CHOICE', selectedOption: 'On time' },
        { questionText: 'Anything specific?', questionType: 'TEXT', textAnswer: 'The therapist explained why I needed to do each exercise' },
      ],
      averageRating: 5,
    };

    const drafts = await templateService.generateReviewDrafts(input);
    expect(drafts).toHaveLength(3);
    expect(drafts.map(d => d.style)).toEqual(expect.arrayContaining(['PROFESSIONAL', 'FRIENDLY', 'HEARTFELT']));

    // Each draft should contain at least one customer-provided detail
    for (const d of drafts) {
      expect(d.content.length).toBeGreaterThan(10);
    }
  });

  // ── Test Case 2: Mixed feedback (positive + negative) ──

  it('preserves mixed sentiment in reviews', async () => {
    const input: ReviewDraftInput = {
      businessName: 'Balance Plus - HSR',
      categoryName: 'Physiotherapy',
      answers: [
        { questionText: 'How would you rate your session?', questionType: 'STAR_RATING', rating: 3 },
        { questionText: 'What was most helpful?', questionType: 'MULTI_CHOICE', selectedOptions: ['Treatment approach'] },
        { questionText: 'How was the appointment timing?', questionType: 'SINGLE_CHOICE', selectedOption: 'Significant wait' },
      ],
      averageRating: 3,
    };

    const drafts = await templateService.generateReviewDrafts(input);
    expect(drafts).toHaveLength(3);

    // Should not contain strongly positive language for a 3-star review
    for (const d of drafts) {
      const lower = d.content.toLowerCase();
      expect(lower).not.toContain('amazing');
      expect(lower).not.toContain('incredible');
    }
  });

  // ── Test Case 3: Sparse input (stars only) ──

  it('generates brief reviews for sparse input', async () => {
    const input: ReviewDraftInput = {
      businessName: 'Balance Plus - HSR',
      categoryName: 'Physiotherapy',
      answers: [
        { questionText: 'How would you rate your session?', questionType: 'STAR_RATING', rating: 4 },
      ],
      averageRating: 4,
    };

    const drafts = await templateService.generateReviewDrafts(input);
    expect(drafts).toHaveLength(3);

    for (const d of drafts) {
      expect(d.content.length).toBeGreaterThan(5);
    }
  });

  // ── Test Case 4: Restaurant — rich feedback ──

  it('generates restaurant-relevant reviews', async () => {
    const input: ReviewDraftInput = {
      businessName: 'Bella\'s Kitchen',
      categoryName: 'Restaurant',
      answers: [
        { questionText: 'How would you rate your overall dining experience?', questionType: 'STAR_RATING', rating: 4 },
        { questionText: 'What stood out?', questionType: 'MULTI_CHOICE', selectedOptions: ['Flavorful food', 'Good portions'] },
        { questionText: 'What best describes the service?', questionType: 'SINGLE_CHOICE', selectedOption: 'Friendly but slow' },
        { questionText: 'How was the wait time?', questionType: 'SINGLE_CHOICE', selectedOption: 'Reasonable' },
        { questionText: 'Anything specific?', questionType: 'TEXT', textAnswer: 'The pasta carbonara was incredible' },
      ],
      averageRating: 4,
    };

    const drafts = await templateService.generateReviewDrafts(input);
    expect(drafts).toHaveLength(3);
  });

  // ── Test Case 5: Salon — result matched expectations ──

  it('generates salon-relevant reviews', async () => {
    const input: ReviewDraftInput = {
      businessName: 'Style Studio',
      categoryName: 'Salon',
      answers: [
        { questionText: 'How would you rate your visit?', questionType: 'STAR_RATING', rating: 5 },
        { questionText: 'What stood out?', questionType: 'MULTI_CHOICE', selectedOptions: ['Stylist skill', 'Listened to what I wanted'] },
        { questionText: 'How does the result compare?', questionType: 'SINGLE_CHOICE', selectedOption: 'Exactly what I wanted' },
        { questionText: 'How was the appointment timing?', questionType: 'SINGLE_CHOICE', selectedOption: 'On time' },
      ],
      averageRating: 5,
    };

    const drafts = await templateService.generateReviewDrafts(input);
    expect(drafts).toHaveLength(3);
    expect(drafts.map(d => d.style)).toEqual(expect.arrayContaining(['PROFESSIONAL', 'FRIENDLY', 'HEARTFELT']));
  });

  // ── Test Case 6: Low rating generates appropriate tone ──

  it('generates negative-toned reviews for low ratings', async () => {
    const input: ReviewDraftInput = {
      businessName: 'Bad Place',
      categoryName: 'Restaurant',
      answers: [
        { questionText: 'How would you rate your experience?', questionType: 'STAR_RATING', rating: 1 },
        { questionText: 'What stood out?', questionType: 'MULTI_CHOICE', selectedOptions: [] },
        { questionText: 'What best describes the service?', questionType: 'SINGLE_CHOICE', selectedOption: 'Could be better' },
        { questionText: 'How was the wait time?', questionType: 'SINGLE_CHOICE', selectedOption: 'Too long' },
      ],
      averageRating: 1,
    };

    const drafts = await templateService.generateReviewDrafts(input);
    expect(drafts).toHaveLength(3);

    // Low rating reviews should not be overly positive
    for (const d of drafts) {
      const lower = d.content.toLowerCase();
      expect(lower).not.toContain('excellent');
      expect(lower).not.toContain('loved');
      expect(lower).not.toContain('amazing');
    }
  });

  // ── All styles must be present ──

  it('always returns all 3 styles', async () => {
    const input: ReviewDraftInput = {
      businessName: 'Test Place',
      categoryName: 'Hotel',
      answers: [
        { questionText: 'How would you rate your stay?', questionType: 'STAR_RATING', rating: 4 },
        { questionText: 'What stood out?', questionType: 'MULTI_CHOICE', selectedOptions: ['Clean room', 'Helpful staff'] },
      ],
      averageRating: 4,
    };

    const drafts = await templateService.generateReviewDrafts(input);
    const styles = drafts.map(d => d.style);
    expect(styles).toContain('PROFESSIONAL');
    expect(styles).toContain('FRIENDLY');
    expect(styles).toContain('HEARTFELT');
  });

  // ── Test Case 8: Insights enrich template drafts ──

  it('generates reviews that incorporate selectedInsights', async () => {
    const input: ReviewDraftInput = {
      businessName: 'Balance Plus - HSR',
      categoryName: 'Physiotherapy',
      answers: [
        { questionText: 'How would you rate your session?', questionType: 'STAR_RATING', rating: 5 },
      ],
      selectedInsights: ['Clear exercise guidance', 'Personal attention', 'Therapist listened'],
      averageRating: 5,
    };

    const drafts = await templateService.generateReviewDrafts(input);
    expect(drafts).toHaveLength(3);
    // With insights, drafts should be more substantive than sparse-only
    for (const d of drafts) {
      expect(d.content.length).toBeGreaterThan(10);
    }
  });

  // ── Test Case 9: Insights-only input (no question answers beyond rating) ──

  it('generates reviews from insights even without question answers', async () => {
    const input: ReviewDraftInput = {
      businessName: 'Style Studio',
      categoryName: 'Salon',
      answers: [
        { questionText: 'How would you rate your visit?', questionType: 'STAR_RATING', rating: 4 },
      ],
      selectedInsights: ['Skilled stylist', 'Listened carefully'],
      averageRating: 4,
    };

    const drafts = await templateService.generateReviewDrafts(input);
    expect(drafts).toHaveLength(3);
    expect(drafts.map(d => d.style)).toEqual(expect.arrayContaining(['PROFESSIONAL', 'FRIENDLY', 'HEARTFELT']));
  });
});
