import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: { count: number; resetAt: number };
}

function createRateLimiter(maxRequests: number, windowMs: number) {
  const store: RateLimitStore = {};

  // Clean up expired entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const key in store) {
      if (store[key].resetAt < now) delete store[key];
    }
  }, 60000);

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (!store[key] || store[key].resetAt < now) {
      store[key] = { count: 1, resetAt: now + windowMs };
    } else {
      store[key].count++;
    }

    if (store[key].count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((store[key].resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
      });
    }

    next();
  };
}

export const generalLimiter = createRateLimiter(100, 60000); // 100/min
export const aiLimiter = createRateLimiter(10, 60000); // 10/min
export const authLimiter = createRateLimiter(10, 60000); // 10/min
