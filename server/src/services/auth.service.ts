import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { AppError } from '../utils/AppError';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export class AuthService {
  async signup(data: {
    email: string;
    password: string;
    name: string;
    businessName: string;
    categoryId?: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('Email already registered', 409);

    const passwordHash = await bcrypt.hash(data.password, 12);

    let slug = slugify(data.businessName);
    // Ensure unique slug
    const existingBusiness = await prisma.business.findUnique({ where: { slug } });
    if (existingBusiness) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          name: data.name,
          role: 'BUSINESS_OWNER',
        },
      });

      const business = await tx.business.create({
        data: {
          name: data.businessName,
          slug,
          categoryId: data.categoryId || undefined,
        },
      });

      await tx.businessMember.create({
        data: {
          userId: user.id,
          businessId: business.id,
          role: 'OWNER',
        },
      });

      // Copy question templates if category is selected
      if (data.categoryId) {
        const templates = await tx.questionTemplate.findMany({
          where: { categoryId: data.categoryId, isActive: true },
          orderBy: { sortOrder: 'asc' },
        });

        for (const template of templates) {
          await tx.businessQuestion.create({
            data: {
              businessId: business.id,
              text: template.text,
              sortOrder: template.sortOrder,
            },
          });
        }
      }

      return { user, business };
    });

    const tokens = this.generateTokens(result.user.id, result.user.role);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
      business: {
        id: result.business.id,
        name: result.business.name,
        slug: result.business.slug,
      },
      tokens,
    };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { business: true },
        },
      },
    });

    if (!user) throw new AppError('Invalid email or password', 401);

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) throw new AppError('Invalid email or password', 401);

    const tokens = this.generateTokens(user.id, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      businesses: user.memberships.map(m => ({
        id: m.business.id,
        name: m.business.name,
        slug: m.business.slug,
        role: m.role,
      })),
      tokens,
    };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { business: true },
        },
      },
    });

    if (!user) throw new AppError('User not found', 404);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      businesses: user.memberships.map(m => ({
        id: m.business.id,
        name: m.business.name,
        slug: m.business.slug,
        role: m.role,
      })),
    };
  }

  private generateTokens(userId: string, role: string) {
    const accessToken = jwt.sign(
      { userId, role },
      config.JWT_SECRET,
      { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
      { userId, role },
      config.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    return { accessToken, refreshToken };
  }

  async refreshToken(token: string) {
    try {
      const payload = jwt.verify(token, config.JWT_REFRESH_SECRET) as { userId: string; role: string };
      const tokens = this.generateTokens(payload.userId, payload.role);
      return tokens;
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }
  }
}

export const authService = new AuthService();
