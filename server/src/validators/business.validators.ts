import { z } from 'zod';

export const createQuestionSchema = z.object({
  text: z.string().min(3).max(200),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateQuestionSchema = z.object({
  text: z.string().min(3).max(200).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const reorderQuestionsSchema = z.object({
  questionIds: z.array(z.string().min(1)),
});

export const updateBusinessSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().max(500).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  googleReviewUrl: z.string().optional(),
  googleMapsUrl: z.string().optional(),
  googlePlaceId: z.string().optional(),
  instagramUrl: z.string().optional(),
  youtubeUrl: z.string().optional(),
});

export const createInsightSchema = z.object({
  label: z.string().min(2).max(50),
});

export const updateInsightSchema = z.object({
  label: z.string().min(2).max(50).optional(),
  isActive: z.boolean().optional(),
});

export const reorderInsightsSchema = z.object({
  insightIds: z.array(z.string().min(1)),
});
