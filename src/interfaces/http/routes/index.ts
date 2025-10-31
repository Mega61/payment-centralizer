import { Router } from 'express';
import { container } from 'tsyringe';
import { HealthController } from '../controllers/HealthController.js';
import { TransactionController } from '../controllers/TransactionController.js';
import { CloudStorageEventHandler } from '../../events/CloudStorageEventHandler.js';

export const createRoutes = (): Router => {
  const router = Router();

  const healthController = container.resolve(HealthController);
  const transactionController = container.resolve(TransactionController);
  const cloudStorageEventHandler = container.resolve(CloudStorageEventHandler);

  // Health check routes
  router.get('/health/live', healthController.liveness);
  router.get('/health/ready', healthController.readiness);

  // API routes
  router.post('/api/v1/transactions/annotate', transactionController.annotate);

  // Event handler routes (for Pub/Sub push subscriptions and Eventarc)
  router.post('/events/gcs/finalize', cloudStorageEventHandler.handleFinalize);

  return router;
};
