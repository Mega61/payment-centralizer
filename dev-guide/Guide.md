# Payment Centralizer Service - Implementation Plan

This document provides a comprehensive step-by-step plan for implementing a payment centralizer service that processes images from OneDrive through Google Cloud Vision API to determine payment status and identify missing payments.

## Service Overview

**Service Name**: Payment Centralizer Service  
**Tech Stack**: Node.js + TypeScript  
**Architecture**: Microservice with Clean Architecture (Domain-Driven Design)  
**Key Integrations**: OneDrive API, Google Cloud Vision API  
**Purpose**: Process payment receipt images to validate payment completion and identify discrepancies

---

## Phase 1: Project Setup and Foundation

### Step 1.1: Initialize Project Structure

```bash
# Create project directory
mkdir payment-centralizer-service
cd payment-centralizer-service

# Initialize npm project
npm init -y

# Create folder structure following Deloim standards
mkdir -p src/{adapters,application,domain,infrastructure,interfaces,shared}
mkdir -p src/adapters/{standalone}
mkdir -p src/application/{use-cases,services}
mkdir -p src/domain/{entities,value-objects,repositories,services,events}
mkdir -p src/infrastructure/{database,http,observability,config,external-apis}
mkdir -p src/interfaces/http/{controllers,middlewares,validators}
mkdir -p src/shared/{errors,utils,types}
mkdir -p tests/{unit,integration,e2e}
```

### Step 1.2: Install Dependencies

```bash
# Core dependencies
npm install express helmet compression
npm install tsyringe reflect-metadata
npm install winston zod
npm install @google-cloud/vision
npm install @azure/msal-node @microsoft/microsoft-graph-client
npm install multer sharp

# Development dependencies
npm install -D typescript @types/node @types/express @types/multer
npm install -D jest @types/jest ts-jest
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install -D prettier nodemon ts-node

# OpenTelemetry dependencies
npm install @opentelemetry/sdk-node @opentelemetry/api
npm install @opentelemetry/auto-instrumentations-node
npm install @opentelemetry/exporter-trace-otlp-http
npm install @opentelemetry/exporter-metrics-otlp-http
npm install @opentelemetry/resources @opentelemetry/semantic-conventions
```

### Step 1.3: Configuration Files

Create essential configuration files:

1. **tsconfig.json** (following Deloim TypeScript standards)
2. **jest.config.js** (testing configuration)
3. **eslintrc.json** and **.prettierrc** (code quality)
4. **Dockerfile** and **docker-compose.yml** (containerization)
5. **.env.example** (environment variables template)

---

## Phase 2: Domain Layer Implementation

### Step 2.1: Define Domain Entities

Create core domain entities for the payment processing:

```typescript
// src/domain/entities/payment-receipt.entity.ts
export class PaymentReceipt {
  constructor(
    public readonly id: string,
    public readonly imageUrl: string,
    public readonly processedAt: Date,
    public readonly status: PaymentStatus,
    public readonly extractedData: ExtractedPaymentData,
    public readonly confidence: number,
    public readonly discrepancies: PaymentDiscrepancy[]
  ) {}
}

// src/domain/entities/payment-analysis.entity.ts
export class PaymentAnalysis {
  constructor(
    public readonly receiptId: string,
    public readonly expectedAmount: number,
    public readonly extractedAmount: number,
    public readonly paymentMethod: string,
    public readonly merchantInfo: MerchantInfo,
    public readonly isValid: boolean,
    public readonly validationErrors: ValidationError[]
  ) {}
}
```

### Step 2.2: Define Value Objects

```typescript
// src/domain/value-objects/money.value-object.ts
export class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string
  ) {
    if (amount < 0) throw new Error('Amount cannot be negative');
    if (!currency || currency.length !== 3) throw new Error('Invalid currency code');
  }
}

// src/domain/value-objects/extracted-payment-data.value-object.ts
export class ExtractedPaymentData {
  constructor(
    public readonly amount: Money,
    public readonly date: Date,
    public readonly merchantName: string,
    public readonly paymentMethod: string,
    public readonly transactionId?: string
  ) {}
}
```

### Step 2.3: Define Repository Interfaces

```typescript
// src/domain/repositories/payment-receipt.repository.ts
export interface PaymentReceiptRepository {
  save(receipt: PaymentReceipt): Promise<void>;
  findById(id: string): Promise<PaymentReceipt | null>;
  findByStatus(status: PaymentStatus): Promise<PaymentReceipt[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<PaymentReceipt[]>;
  update(receipt: PaymentReceipt): Promise<void>;
}

// src/domain/repositories/payment-analysis.repository.ts
export interface PaymentAnalysisRepository {
  save(analysis: PaymentAnalysis): Promise<void>;
  findByReceiptId(receiptId: string): Promise<PaymentAnalysis[]>;
  findDiscrepancies(): Promise<PaymentAnalysis[]>;
}
```

### Step 2.4: Define Domain Services

```typescript
// src/domain/services/payment-validation.service.ts
export class PaymentValidationService {
  validatePayment(
    expectedAmount: Money,
    extractedData: ExtractedPaymentData
  ): ValidationResult {
    // Business logic for payment validation
  }

  detectDiscrepancies(
    expected: PaymentData,
    extracted: ExtractedPaymentData
  ): PaymentDiscrepancy[] {
    // Business logic for discrepancy detection
  }
}
```

---

## Phase 3: Infrastructure Layer Implementation

### Step 3.1: External API Clients

#### OneDrive Integration

```typescript
// src/infrastructure/external-apis/onedrive-client.ts
import { Client } from '@microsoft/microsoft-graph-client';
import { injectable, inject } from 'tsyringe';

@injectable()
export class OneDriveClient {
  private graphClient: Client;

  constructor(
    @inject('ConfigService') private config: ConfigService,
    @inject('Logger') private logger: Logger
  ) {
    this.initializeGraphClient();
  }

  async getImages(folderPath: string): Promise<DriveItem[]> {
    // Implementation to fetch images from OneDrive
  }

  async downloadImage(itemId: string): Promise<Buffer> {
    // Implementation to download image content
  }
}
```

#### Google Cloud Vision Integration

```typescript
// src/infrastructure/external-apis/cloud-vision-client.ts
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { injectable, inject } from 'tsyringe';

@injectable()
export class CloudVisionClient {
  private visionClient: ImageAnnotatorClient;

  constructor(
    @inject('ConfigService') private config: ConfigService,
    @inject('Logger') private logger: Logger
  ) {
    this.visionClient = new ImageAnnotatorClient({
      projectId: this.config.get('GCP_PROJECT_ID'),
      keyFilename: this.config.get('GCP_KEY_FILE_PATH'),
    });
  }

  async extractTextFromImage(imageBuffer: Buffer): Promise<TextAnnotation[]> {
    const [result] = await this.visionClient.textDetection({
      image: { content: imageBuffer },
    });
    return result.textAnnotations || [];
  }

  async detectReceiptData(imageBuffer: Buffer): Promise<ExtractedPaymentData> {
    // Implementation to process receipt data using OCR
  }
}
```

### Step 3.2: Database Implementation

```typescript
// src/infrastructure/database/repositories/payment-receipt.repository.impl.ts
@injectable()
export class PaymentReceiptRepositoryImpl implements PaymentReceiptRepository {
  constructor(
    @inject('DatabaseConnection') private db: DatabaseConnection,
    @inject('Logger') private logger: Logger
  ) {}

  async save(receipt: PaymentReceipt): Promise<void> {
    // Implementation using your preferred database (PostgreSQL/MongoDB)
  }

  async findById(id: string): Promise<PaymentReceipt | null> {
    // Implementation
  }
}
```

### Step 3.3: Observability Implementation

Following the observability standards from your guidelines:

```typescript
// src/infrastructure/observability/telemetry.ts
export class TelemetryService {
  // Implementation following the observability guidelines
}

// src/infrastructure/observability/logger.ts
export class Logger {
  // Implementation with structured logging and OpenTelemetry integration
}

// src/infrastructure/observability/metrics.ts
export class MetricsService {
  // Custom metrics for payment processing
}
```

---

## Phase 4: Application Layer Implementation

### Step 4.1: Use Cases

```typescript
// src/application/use-cases/process-payment-receipt.use-case.ts
@injectable()
export class ProcessPaymentReceiptUseCase {
  constructor(
    @inject('CloudVisionClient') private visionClient: CloudVisionClient,
    @inject('PaymentReceiptRepository') private receiptRepository: PaymentReceiptRepository,
    @inject('PaymentValidationService') private validationService: PaymentValidationService,
    @inject('Logger') private logger: Logger
  ) {}

  async execute(imageBuffer: Buffer, expectedPayment: PaymentData): Promise<PaymentAnalysis> {
    const span = trace.getTracer('payment-service').startSpan('process-receipt');
    
    try {
      // 1. Extract text from image using Cloud Vision
      const extractedData = await this.visionClient.detectReceiptData(imageBuffer);
      
      // 2. Validate payment data
      const validationResult = this.validationService.validatePayment(
        expectedPayment.amount,
        extractedData
      );
      
      // 3. Create and save receipt
      const receipt = new PaymentReceipt(
        generateId(),
        imageUrl,
        new Date(),
        validationResult.isValid ? PaymentStatus.VALID : PaymentStatus.INVALID,
        extractedData,
        validationResult.confidence,
        validationResult.discrepancies
      );
      
      await this.receiptRepository.save(receipt);
      
      // 4. Create analysis
      const analysis = new PaymentAnalysis(
        receipt.id,
        expectedPayment.amount.amount,
        extractedData.amount.amount,
        extractedData.paymentMethod,
        extractedData.merchantInfo,
        validationResult.isValid,
        validationResult.errors
      );
      
      this.logger.info('Payment receipt processed', {
        receiptId: receipt.id,
        isValid: validationResult.isValid,
        confidence: validationResult.confidence,
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      return analysis;
      
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }
}
```

```typescript
// src/application/use-cases/sync-onedrive-receipts.use-case.ts
@injectable()
export class SyncOneDriveReceiptsUseCase {
  constructor(
    @inject('OneDriveClient') private oneDriveClient: OneDriveClient,
    @inject('ProcessPaymentReceiptUseCase') private processReceiptUseCase: ProcessPaymentReceiptUseCase,
    @inject('Logger') private logger: Logger
  ) {}

  async execute(folderPath: string): Promise<ProcessingSummary> {
    const span = trace.getTracer('payment-service').startSpan('sync-onedrive-receipts');
    
    try {
      // 1. Get images from OneDrive
      const images = await this.oneDriveClient.getImages(folderPath);
      
      const results: ProcessingResult[] = [];
      
      // 2. Process each image
      for (const image of images) {
        try {
          const imageBuffer = await this.oneDriveClient.downloadImage(image.id);
          
          // For now, we'll need expected payment data from external source
          // This could come from your ERP system, database, etc.
          const expectedPayment = await this.getExpectedPaymentData(image.name);
          
          const analysis = await this.processReceiptUseCase.execute(
            imageBuffer,
            expectedPayment
          );
          
          results.push({
            imageId: image.id,
            status: 'success',
            analysis,
          });
          
        } catch (error) {
          this.logger.error('Failed to process image', {
            imageId: image.id,
            error: error.message,
          });
          
          results.push({
            imageId: image.id,
            status: 'error',
            error: error.message,
          });
        }
      }
      
      const summary = new ProcessingSummary(
        results.length,
        results.filter(r => r.status === 'success').length,
        results.filter(r => r.status === 'error').length,
        results
      );
      
      span.setStatus({ code: SpanStatusCode.OK });
      return summary;
      
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  private async getExpectedPaymentData(filename: string): Promise<PaymentData> {
    // Implementation to get expected payment data
    // This could parse filename, query database, call external API, etc.
  }
}
```

### Step 4.2: Application Services

```typescript
// src/application/services/payment-processor.service.ts
@injectable()
export class PaymentProcessorService {
  constructor(
    @inject('SyncOneDriveReceiptsUseCase') private syncUseCase: SyncOneDriveReceiptsUseCase,
    @inject('PaymentAnalysisRepository') private analysisRepository: PaymentAnalysisRepository,
    @inject('Logger') private logger: Logger
  ) {}

  async processNewReceipts(): Promise<ProcessingSummary> {
    const folderPath = '/receipts/pending'; // Configure as needed
    return await this.syncUseCase.execute(folderPath);
  }

  async getDiscrepancies(): Promise<PaymentAnalysis[]> {
    return await this.analysisRepository.findDiscrepancies();
  }

  async getPaymentStatus(receiptId: string): Promise<PaymentAnalysis[]> {
    return await this.analysisRepository.findByReceiptId(receiptId);
  }
}
```

---

## Phase 5: Interface Layer Implementation

### Step 5.1: REST API Controllers

```typescript
// src/interfaces/http/controllers/payment.controller.ts
import { Router, Request, Response } from 'express';
import { container } from '@/container';
import { PaymentProcessorService } from '@/application/services/payment-processor.service';

const router = Router();
const paymentService = container.resolve<PaymentProcessorService>('PaymentProcessorService');

// Process new receipts from OneDrive
router.post('/process', async (req: Request, res: Response) => {
  try {
    const summary = await paymentService.processNewReceipts();
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get payment discrepancies
router.get('/discrepancies', async (req: Request, res: Response) => {
  try {
    const discrepancies = await paymentService.getDiscrepancies();
    res.json({
      success: true,
      data: discrepancies,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get payment status by receipt ID
router.get('/status/:receiptId', async (req: Request, res: Response) => {
  try {
    const { receiptId } = req.params;
    const analyses = await paymentService.getPaymentStatus(receiptId);
    res.json({
      success: true,
      data: analyses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Manual upload endpoint for testing
router.post('/upload', upload.single('receipt'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Process uploaded file
    // Implementation here

    res.json({ success: true, message: 'Receipt processed successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export { router as paymentRouter };
```

### Step 5.2: Middleware Implementation

```typescript
// src/interfaces/http/middlewares/auth.middleware.ts
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Implement authentication logic
}

// src/interfaces/http/middlewares/validation.middleware.ts
export function validateUpload(req: Request, res: Response, next: NextFunction): void {
  // Validate file upload
}

// src/interfaces/http/middlewares/rate-limiting.middleware.ts
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Implement rate limiting
}
```

### Step 5.3: Validation Schemas

```typescript
// src/interfaces/http/validators/payment.validator.ts
import { z } from 'zod';

export const ProcessPaymentSchema = z.object({
  expectedAmount: z.number().positive(),
  currency: z.string().length(3),
  merchantName: z.string().optional(),
  paymentMethod: z.string().optional(),
});

export const ReceiptIdSchema = z.object({
  receiptId: z.string().uuid(),
});
```

---

## Phase 6: Configuration and Dependency Injection

### Step 6.1: Configuration Service

```typescript
// src/infrastructure/config/config.service.ts
@injectable()
export class ConfigService {
  private static instance: ConfigService;

  private constructor() {}

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  get(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Configuration key ${key} not found`);
    }
    return value;
  }

  getNumber(key: string): number {
    const value = this.get(key);
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      throw new Error(`Configuration key ${key} is not a valid number`);
    }
    return numValue;
  }

  getBoolean(key: string): boolean {
    const value = this.get(key);
    return value.toLowerCase() === 'true';
  }

  isDevelopment(): boolean {
    return this.get('NODE_ENV') === 'development';
  }

  isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }
}
```

### Step 6.2: Dependency Injection Container

```typescript
// src/container.ts
import 'reflect-metadata';
import { container } from 'tsyringe';

// Configuration
container.registerSingleton<ConfigService>('ConfigService', ConfigService);
container.registerSingleton<Logger>('Logger', Logger);
container.registerSingleton<MetricsService>('MetricsService', MetricsService);

// External APIs
container.register<OneDriveClient>('OneDriveClient', OneDriveClient);
container.register<CloudVisionClient>('CloudVisionClient', CloudVisionClient);

// Repositories
container.register<PaymentReceiptRepository>('PaymentReceiptRepository', PaymentReceiptRepositoryImpl);
container.register<PaymentAnalysisRepository>('PaymentAnalysisRepository', PaymentAnalysisRepositoryImpl);

// Domain Services
container.registerSingleton<PaymentValidationService>('PaymentValidationService', PaymentValidationService);

// Use Cases
container.register<ProcessPaymentReceiptUseCase>('ProcessPaymentReceiptUseCase', ProcessPaymentReceiptUseCase);
container.register<SyncOneDriveReceiptsUseCase>('SyncOneDriveReceiptsUseCase', SyncOneDriveReceiptsUseCase);

// Application Services
container.registerSingleton<PaymentProcessorService>('PaymentProcessorService', PaymentProcessorService);

export { container };
```

---

## Phase 7: Application Bootstrap

### Step 7.1: Express App Configuration

```typescript
// src/app.ts
import express, { Application } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { errorMiddleware } from '@/interfaces/http/middlewares/error.middleware';
import { loggingMiddleware } from '@/interfaces/http/middlewares/logging.middleware';
import { paymentRouter } from '@/interfaces/http/controllers/payment.controller';
import { healthRouter } from '@/interfaces/http/controllers/health.controller';

export function createApp(): Application {
  const app = express();

  // Security middlewares
  app.use(helmet());
  app.use(compression());

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging
  app.use(loggingMiddleware);

  // Health checks
  app.use('/health', healthRouter);

  // API routes
  app.use('/api/v1/payments', paymentRouter);

  // Error handling (must be last)
  app.use(errorMiddleware);

  return app;
}
```

### Step 7.2: Server Entry Point

```typescript
// src/server.ts
import 'reflect-metadata';
import { TelemetryService } from '@/infrastructure/observability/telemetry';
import { ConfigService } from '@/infrastructure/config/config.service';
import { Logger } from '@/infrastructure/observability/logger';
import { createApp } from './app';

async function bootstrap(): Promise<void> {
  try {
    // Initialize configuration
    const config = ConfigService.getInstance();
    const logger = Logger.getInstance();

    // Initialize OpenTelemetry
    const telemetry = new TelemetryService();
    await telemetry.start();

    // Create Express app
    const app = createApp();
    const port = config.getNumber('PORT') || 3000;

    // Start server
    const server = app.listen(port, () => {
      logger.info('Payment Centralizer Service started', {
        port,
        environment: config.get('NODE_ENV'),
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(async () => {
        await telemetry.shutdown();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
```

---

## Phase 8: Environment Configuration

### Step 8.1: Environment Variables

Create `.env.example`:

```env
# Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Microsoft Graph/OneDrive
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret
AZURE_TENANT_ID=your_tenant_id

# Google Cloud Platform
GCP_PROJECT_ID=your_gcp_project_id
GCP_KEY_FILE_PATH=/path/to/service-account-key.json

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/payment_centralizer

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=payment-centralizer-service

# OneDrive Configuration
ONEDRIVE_FOLDER_PATH=/receipts/pending
ONEDRIVE_PROCESSED_PATH=/receipts/processed

# Payment Processing
CONFIDENCE_THRESHOLD=0.8
MAX_AMOUNT_VARIANCE=0.05
```

### Step 8.2: Docker Configuration

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci --only=production && \
    npm ci --only=development

COPY src ./src
RUN npm run build

FROM node:20-alpine

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs package*.json ./

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health/live', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/server.js"]
```

---

## Phase 9: Testing Implementation

### Step 9.1: Unit Tests

```typescript
// tests/unit/application/use-cases/process-payment-receipt.use-case.spec.ts
import { ProcessPaymentReceiptUseCase } from '@/application/use-cases/process-payment-receipt.use-case';

describe('ProcessPaymentReceiptUseCase', () => {
  let useCase: ProcessPaymentReceiptUseCase;
  let mockVisionClient: jest.Mocked<CloudVisionClient>;
  let mockRepository: jest.Mocked<PaymentReceiptRepository>;

  beforeEach(() => {
    // Setup mocks and test instance
  });

  describe('execute', () => {
    it('should process valid receipt successfully', async () => {
      // Arrange
      const imageBuffer = Buffer.from('test-image');
      const expectedPayment = new PaymentData(new Money(100, 'USD'));

      mockVisionClient.detectReceiptData.mockResolvedValue(
        new ExtractedPaymentData(new Money(100, 'USD'), new Date(), 'Test Store', 'Credit Card')
      );

      // Act
      const result = await useCase.execute(imageBuffer, expectedPayment);

      // Assert
      expect(result.isValid).toBe(true);
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid receipt with discrepancies', async () => {
      // Test discrepancy detection
    });

    it('should handle OCR errors gracefully', async () => {
      // Test error handling
    });
  });
});
```

### Step 9.2: Integration Tests

```typescript
// tests/integration/external-apis/cloud-vision-client.spec.ts
describe('CloudVisionClient Integration', () => {
  let client: CloudVisionClient;

  beforeAll(() => {
    // Setup with test credentials
  });

  it('should extract text from real receipt image', async () => {
    // Test with actual Cloud Vision API
  });
});
```

### Step 9.3: End-to-End Tests

```typescript
// tests/e2e/payment-processing.spec.ts
describe('Payment Processing E2E', () => {
  it('should process receipt from OneDrive to completion', async () => {
    // Test full workflow
  });
});
```

---

## Phase 10: Deployment and Monitoring

### Step 10.1: Health Checks

```typescript
// src/interfaces/http/controllers/health.controller.ts
export const healthRouter = Router();

healthRouter.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

healthRouter.get('/ready', async (req: Request, res: Response) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkOneDriveConnection(),
    checkCloudVisionConnection(),
  ]);

  const results = checks.map((check, index) => {
    const names = ['database', 'onedrive', 'cloudvision'];
    return {
      name: names[index],
      status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      error: check.status === 'rejected' ? check.reason.message : undefined,
    };
  });

  const allHealthy = results.every(r => r.status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not_ready',
    checks: results,
    timestamp: new Date().toISOString(),
  });
});
```

### Step 10.2: Monitoring and Alerts

Implement custom metrics for:
- Receipt processing success/failure rates
- OCR confidence scores
- Payment validation accuracy
- Processing latency
- OneDrive API rate limits
- Cloud Vision API usage

### Step 10.3: Scheduled Tasks

```typescript
// src/infrastructure/scheduling/receipt-processor.scheduler.ts
export class ReceiptProcessorScheduler {
  constructor(
    private paymentService: PaymentProcessorService,
    private logger: Logger
  ) {}

  startScheduledProcessing(): void {
    // Schedule periodic processing of new receipts
    cron.schedule('*/15 * * * *', async () => { // Every 15 minutes
      try {
        this.logger.info('Starting scheduled receipt processing');
        const summary = await this.paymentService.processNewReceipts();
        this.logger.info('Scheduled processing completed', { summary });
      } catch (error) {
        this.logger.error('Scheduled processing failed', { error: error.message });
      }
    });
  }
}
```

---

## Implementation Timeline

### Week 1-2: Foundation
- [ ] Project setup and structure
- [ ] Core dependencies installation
- [ ] Configuration system
- [ ] Basic domain models

### Week 3-4: External Integrations
- [ ] OneDrive API integration
- [ ] Google Cloud Vision integration
- [ ] Basic image processing pipeline

### Week 5-6: Core Business Logic
- [ ] Payment validation service
- [ ] Use cases implementation
- [ ] Repository implementations

### Week 7-8: API and Interface
- [ ] REST API controllers
- [ ] Middleware implementation
- [ ] Request/response validation

### Week 9-10: Testing and Quality
- [ ] Unit tests
- [ ] Integration tests
- [ ] Code quality tools

### Week 11-12: Deployment and Monitoring
- [ ] Containerization
- [ ] Health checks
- [ ] Monitoring and logging
- [ ] Performance optimization

---

## Key Technical Considerations

### 1. Image Processing Optimization
- Implement image preprocessing (resize, format conversion) to reduce Cloud Vision API costs
- Cache OCR results to avoid reprocessing identical images
- Implement retry logic with exponential backoff for API failures

### 2. Payment Validation Logic
- Configure confidence thresholds for automatic vs manual review
- Implement fuzzy matching for merchant names and amounts
- Support multiple currency formats and regional variations

### 3. Error Handling and Resilience
- Implement circuit breakers for external API calls
- Queue failed processing for retry
- Graceful degradation when services are unavailable

### 4. Performance and Scalability
- Implement async processing for large image batches
- Use Redis for caching frequently accessed data
- Consider implementing a queue system (SQS/RabbitMQ) for high-volume processing

### 5. Security Considerations
- Encrypt sensitive data at rest and in transit
- Implement proper authentication for OneDrive access
- Secure handling of payment information
- Rate limiting to prevent abuse

### 6. Compliance and Auditing
- Log all payment processing activities
- Implement audit trails for financial data
- Consider PCI DSS compliance requirements
- Data retention and deletion policies

---

## Next Steps

1. **Start with Phase 1**: Set up the basic project structure and dependencies
2. **Implement MVP**: Focus on basic OneDrive → Cloud Vision → validation workflow
3. **Iterate and Improve**: Add more sophisticated validation rules and error handling
4. **Scale and Optimize**: Implement performance optimizations and monitoring

This plan provides a comprehensive roadmap for implementing your payment centralizer service following Deloim's development standards and best practices. Each phase builds upon the previous one, ensuring a solid foundation and maintainable codebase.