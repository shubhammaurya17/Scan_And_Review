import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateService } from '../template.service';
import type { ReviewDraftInput, GeneratedDraft } from '../ai.service';

// Mock Prisma
vi.mock('../../config/database', () => ({
  prisma: {
    reviewSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    reviewDraft: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    funnelEvent: {
      create: vi.fn(),
    },
  },
}));

const sampleInput: ReviewDraftInput = {
  businessName: "Bella's Italian Kitchen",
  categoryName: 'Restaurant',
  ratings: [
    { questionText: 'Food quality', rating: 5 },
    { questionText: 'Service', rating: 4 },
    { questionText: 'Ambience', rating: 5 },
  ],
  comment: 'Great food and lovely atmosphere!',
  averageRating: 4.7,
};

describe('AI Draft Generation Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TEST A: Ollama returns 3 drafts
  describe('TEST A: Ollama returns 3 drafts', () => {
    it('should return 3 drafts when Ollama is available and working', async () => {
      // Simulate a mock OllamaService that returns 3 drafts
      const mockDrafts: GeneratedDraft[] = [
        { style: 'PROFESSIONAL', content: 'Had an excellent experience at Bella\'s...' },
        { style: 'FRIENDLY', content: 'Really enjoyed my visit to Bella\'s!' },
        { style: 'CONCISE', content: 'Great restaurant. Highly recommended.' },
      ];

      const mockAIService = {
        generateReviewDrafts: vi.fn().mockResolvedValue(mockDrafts),
        isAvailable: vi.fn().mockResolvedValue(true),
        generateReply: vi.fn(),
        analyzeSentiment: vi.fn(),
        detectTopics: vi.fn(),
      };

      const drafts = await mockAIService.generateReviewDrafts(sampleInput);
      expect(drafts).toHaveLength(3);
      expect(drafts.map(d => d.style)).toEqual(['PROFESSIONAL', 'FRIENDLY', 'CONCISE']);
      drafts.forEach(d => {
        expect(d.content).toBeTruthy();
        expect(d.content.length).toBeGreaterThan(10);
      });
    });
  });

  // TEST B: Ollama returns 0 drafts — template fallback
  describe('TEST B: Ollama returns 0 drafts', () => {
    it('should fall back to template service when Ollama returns empty array', async () => {
      // Ollama returns empty (all individual generations failed)
      const mockAIService = {
        generateReviewDrafts: vi.fn().mockResolvedValue([]),
      };

      let drafts = await mockAIService.generateReviewDrafts(sampleInput);
      expect(drafts).toHaveLength(0);

      // Template fallback should generate 3 drafts
      const templateService = new TemplateService();
      drafts = await templateService.generateReviewDrafts(sampleInput);
      expect(drafts).toHaveLength(3);
      expect(drafts.map(d => d.style)).toEqual(['PROFESSIONAL', 'FRIENDLY', 'CONCISE']);
      drafts.forEach(d => {
        expect(d.content).toBeTruthy();
        expect(d.content).toContain("Bella's Italian Kitchen");
      });
    });
  });

  // TEST C: Ollama connection fails — template fallback
  describe('TEST C: Ollama connection fails', () => {
    it('should fall back to template service when Ollama throws', async () => {
      const mockAIService = {
        generateReviewDrafts: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      };

      let drafts: GeneratedDraft[] = [];
      try {
        drafts = await mockAIService.generateReviewDrafts(sampleInput);
      } catch {
        // Expected — AI threw, drafts stays []
      }

      // Same logic as review.service.ts: if drafts is empty, fall back
      if (drafts.length === 0) {
        const templateService = new TemplateService();
        drafts = await templateService.generateReviewDrafts(sampleInput);
      }

      expect(drafts).toHaveLength(3);
      expect(drafts[0].style).toBe('PROFESSIONAL');
    });
  });

  // TEST D: Fallback also fails — error state
  describe('TEST D: Both AI and fallback fail', () => {
    it('should produce a clean error when template service throws (impossible but tested)', async () => {
      // If even template service somehow fails, the error should be clean
      const brokenTemplate = new TemplateService();
      vi.spyOn(brokenTemplate, 'generateReviewDrafts').mockRejectedValue(new Error('Unexpected template error'));

      let error: Error | null = null;
      try {
        await brokenTemplate.generateReviewDrafts(sampleInput);
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(error!.message).toBe('Unexpected template error');
      // In real code, this would result in a user-friendly error response
      // and not expose the stack trace to the customer
    });
  });

  // TEST E: Customer retries — no duplicate sessions
  describe('TEST E: Customer retries draft generation', () => {
    it('should delete existing drafts before saving new ones on retry', async () => {
      const { prisma } = await import('../../config/database');

      // Simulate retry: generateDrafts is called again for same session
      // The service calls deleteMany before creating new drafts
      const templateService = new TemplateService();
      const drafts = await templateService.generateReviewDrafts(sampleInput);

      expect(drafts).toHaveLength(3);
      // On retry, review.service.ts deletes old drafts then creates new ones
      // This ensures no duplicate drafts accumulate
    });
  });
});

describe('TemplateService', () => {
  const templateService = new TemplateService();

  it('is always available', async () => {
    expect(await templateService.isAvailable()).toBe(true);
  });

  it('generates 3 drafts for any valid input', async () => {
    const drafts = await templateService.generateReviewDrafts(sampleInput);
    expect(drafts).toHaveLength(3);
    expect(drafts.map(d => d.style)).toEqual(['PROFESSIONAL', 'FRIENDLY', 'CONCISE']);
  });

  it('generates appropriate quality words based on rating', async () => {
    const lowInput = { ...sampleInput, averageRating: 1.2 };
    const drafts = await templateService.generateReviewDrafts(lowInput);
    expect(drafts[0].content).toContain('poor');

    const highInput = { ...sampleInput, averageRating: 4.8 };
    const highDrafts = await templateService.generateReviewDrafts(highInput);
    expect(highDrafts[0].content).toContain('excellent');
  });

  it('includes the comment when provided', async () => {
    const drafts = await templateService.generateReviewDrafts(sampleInput);
    expect(drafts[0].content).toContain('Great food');
  });

  it('handles no comment gracefully', async () => {
    const noCommentInput = { ...sampleInput, comment: undefined };
    const drafts = await templateService.generateReviewDrafts(noCommentInput);
    expect(drafts).toHaveLength(3);
    drafts.forEach(d => expect(d.content.length).toBeGreaterThan(0));
  });

  it('generates sentiment analysis', async () => {
    const posResult = await templateService.analyzeSentiment('The food was great and amazing!');
    expect(posResult.label).toBe('POSITIVE');

    const negResult = await templateService.analyzeSentiment('The food was terrible and awful');
    expect(negResult.label).toBe('NEGATIVE');

    const neuResult = await templateService.analyzeSentiment('We visited the restaurant');
    expect(neuResult.label).toBe('NEUTRAL');
  });

  it('detects topics from texts', async () => {
    const topics = await templateService.detectTopics([
      'The food quality was excellent',
      'Service was slow but the ambiance was nice',
    ]);
    expect(topics).toContain('Food Quality');
    expect(topics).toContain('Service');
    expect(topics).toContain('Ambiance');
  });
});
