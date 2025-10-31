import { Request, Response, NextFunction } from 'express';
import type { Logger } from 'winston';

export const createRequestLogger = (logger: Logger) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info('HTTP request', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get('user-agent'),
        ip: req.ip,
      });
    });

    next();
  };
};
