export type UserRole = 'BUSINESS_OWNER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  businessName: string;
  categoryId?: string;
}

export interface AuthResponse {
  user: User;
  businesses: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>;
}
