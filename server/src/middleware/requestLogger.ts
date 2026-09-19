import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // Skip health check to reduce noise
  if (req.path === '/api/health') return next();

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusIcon = status >= 500 ? '❌' : status >= 400 ? '⚠️' : '✅';
    console.log(`${statusIcon} ${req.method} ${req.originalUrl} ${status} ${duration}ms`);
  });

  next();
}
