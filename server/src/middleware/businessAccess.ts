import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export function requireBusinessAccess(paramName = 'businessId') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const businessId = req.params[paramName];
      const userId = req.user?.userId;

      if (!userId || !businessId) {
        return next(new AppError('Unauthorized', 401));
      }

      // Admin users can access any business
      if (req.user?.role === 'ADMIN') {
        return next();
      }

      const membership = await prisma.businessMember.findUnique({
        where: {
          userId_businessId: { userId, businessId },
        },
      });

      if (!membership) {
        return next(new AppError('Access denied to this business', 403));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
