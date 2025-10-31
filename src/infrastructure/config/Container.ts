import 'reflect-metadata';
import { container } from 'tsyringe';
import { Logger } from 'winston';
import { createLogger } from '@infrastructure/logging/Logger.js';
import { GoogleVisionAdapter } from '@adapters/vision/GoogleVisionAdapter.js';
import { GoogleCloudStorageAdapter } from '@adapters/storage/GoogleCloudStorageAdapter.js';
import { VisionRepository } from '@domain/repositories/VisionRepository.js';
import { StorageRepository } from '@domain/repositories/StorageRepository.js';
import { ParseTransactionUseCase } from '@application/use-cases/ParseTransactionUseCase.js';
import { AnnotateImageUseCase } from '@application/use-cases/AnnotateImageUseCase.js';
import { getConfig } from './Config.js';

export const setupDependencyInjection = (): void => {
  const config = getConfig();

  // Register logger
  const logger = createLogger('payment-centralizer', config.LOG_LEVEL);
  container.register<Logger>('Logger', {
    useValue: logger,
  });

  // Register repositories
  container.register<VisionRepository>('VisionRepository', {
    useClass: GoogleVisionAdapter,
  });

  container.register<StorageRepository>('StorageRepository', {
    useClass: GoogleCloudStorageAdapter,
  });

  // Register use cases
  container.register<ParseTransactionUseCase>(ParseTransactionUseCase, {
    useClass: ParseTransactionUseCase,
  });

  container.register<AnnotateImageUseCase>(AnnotateImageUseCase, {
    useClass: AnnotateImageUseCase,
  });

  logger.info('Dependency injection container configured successfully');
};
