import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { container } from 'tsyringe';
import { Config } from '@infrastructure/config/Config.js';
import { createRoutes } from '@interfaces/http/routes/index.js';
import { createErrorHandler } from '@interfaces/http/middlewares/ErrorHandler.js';
import { createRequestLogger } from '@interfaces/http/middlewares/RequestLogger.js';
import type { Logger } from 'winston';

export const createExpressApp = (config: Config): Express => {
  const app = express();
  const logger = container.resolve<Logger>('Logger');

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
    }),
  );

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    message: 'Too many requests from this IP, please try again later.',
  });
  app.use('/api/', limiter);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression());

  // Request logging
  app.use(createRequestLogger(logger));

  // Routes
  app.use(createRoutes());

  // Error handling (must be last)
  app.use(createErrorHandler(logger));

  return app;
};
