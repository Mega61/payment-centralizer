import { Request, Response, NextFunction } from 'express';
import { BaseError } from '@shared/errors/BaseError.js';
import type { Logger } from 'winston';

export const createErrorHandler = (logger: Logger) => {
  return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof BaseError) {
      logger.warn('Operational error occurred', {
        error: err.toJSON(),
        method: req.method,
        path: req.path,
      });

      res.status(err.statusCode).json({
        error: {
          name: err.name,
          message: err.message,
          statusCode: err.statusCode,
          timestamp: err.timestamp.toISOString(),
          context: err.context,
        },
      });
      return;
    }

    // Unhandled errors
    logger.error('Unexpected error occurred', {
      error: err.message,
      stack: err.stack,
      method: req.method,
      path: req.path,
    });

    res.status(500).json({
      error: {
        name: 'InternalServerError',
        message: 'An unexpected error occurred',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  };
};
