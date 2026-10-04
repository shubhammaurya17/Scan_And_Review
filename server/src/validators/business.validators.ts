import { z } from 'zod';

const questionTypeEnum = z.enum(['STAR_RATING', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'TEXT']);

export const createQuestionSchema = z.object({
  text: z.string().min(3).max(200),
  type: questionTypeEnum.optional().default('STAR_RATING'),
  options: z.array(z.string().min(1).max(50)).min(2).max(10).optional(),
  placeholder: z.string().max(200).optional(),
  sortOrder: z.number().int().min(0).optional(),
}).refine(
  (data) => {
    if (data.type === 'SINGLE_CHOICE' || data.type === 'MULTI_CHOICE') {
      return data.options && data.options.length >= 2;
    }
    return true;
  },
  { message: 'Choice questions require at least 2 options', path: ['options'] }
);

export const updateQuestionSchema = z.object({
  text: z.string().min(3).max(200).optional(),
  type: questionTypeEnum.optional(),
  options: z.array(z.string().min(1).max(50)).min(2).max(10).optional().nullable(),
  placeholder: z.string().max(200).optional().nullable(),
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
