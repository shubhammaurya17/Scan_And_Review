import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { generalLimiter } from './middleware/rateLimit';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);
app.use('/api', generalLimiter);

// Routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

// Start
app.listen(config.PORT, () => {
  console.log(`🚀 ReputeAI server running on port ${config.PORT}`);
  console.log(`📊 Environment: ${config.NODE_ENV}`);
  console.log(`🤖 AI Provider: ${config.AI_PROVIDER} (${config.AI_MODEL})`);
});

export default app;
