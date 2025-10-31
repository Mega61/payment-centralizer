import { Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import type { Logger } from 'winston';

@injectable()
export class HealthController {
  constructor(@inject('Logger') private readonly logger: Logger) {}

  public liveness = (_req: Request, res: Response): void => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
    });
  };

  public readiness = async (_req: Request, res: Response): Promise<void> => {
    try {
      // Check dependencies (Vision API, GCS, etc.)
      const checks = {
        server: 'UP',
        visionApi: 'UP', // Could add actual health check
        storage: 'UP', // Could add actual health check
      };

      const isHealthy = Object.values(checks).every((status) => status === 'UP');

      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'UP' : 'DOWN',
        checks,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Health check failed', { error });
      res.status(503).json({
        status: 'DOWN',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
