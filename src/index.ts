import 'reflect-metadata';
import { container } from 'tsyringe';
import { getConfig } from '@infrastructure/config/Config.js';
import { setupDependencyInjection } from '@infrastructure/config/Container.js';
import { Telemetry } from '@infrastructure/observability/Telemetry.js';
import { createExpressApp } from '@infrastructure/http/Server.js';
import type { Logger } from 'winston';

const main = async (): Promise<void> => {
  const config = getConfig();

  // Initialize observability
  const telemetry = new Telemetry();
  telemetry.initialize({
    serviceName: 'payment-centralizer',
    serviceVersion: '1.0.0',
    otlpEndpoint: config.OTLP_ENDPOINT,
    enableTracing: config.ENABLE_TRACING,
    enableMetrics: config.ENABLE_METRICS,
  });

  // Setup dependency injection
  setupDependencyInjection();

  const logger = container.resolve<Logger>('Logger');

  // Create Express app
  const app = createExpressApp(config);

  // Start server
  const server = app.listen(config.PORT, () => {
    logger.info('Server started successfully', {
      port: config.PORT,
      environment: config.NODE_ENV,
      tracing: config.ENABLE_TRACING,
      metrics: config.ENABLE_METRICS,
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received, shutting down gracefully...`);

    server.close(() => {
      logger.info('HTTP server closed');
    });

    await telemetry.shutdown();
    logger.info('Telemetry shutdown complete');

    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
};

main().catch((error) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});
