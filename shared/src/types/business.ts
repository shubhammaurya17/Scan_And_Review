export interface Category {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface QuestionTemplate {
  id: string;
  categoryId: string;
  text: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  description?: string;
  categoryId?: string;
  category?: Category;
  address?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
  googlePlaceId?: string;
  googleReviewUrl?: string;
  googleMapsUrl?: string;
  isDemo: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type QuestionType = 'STAR_RATING' | 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'TEXT';

export interface BusinessQuestion {
  id: string;
  businessId: string;
  text: string;
  type: QuestionType;
  options: string[] | null;
  placeholder: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface BusinessMember {
  id: string;
  userId: string;
  businessId: string;
  role: BusinessMemberRole;
  createdAt: Date;
}

export type BusinessMemberRole = 'OWNER' | 'MANAGER' | 'VIEWER';
