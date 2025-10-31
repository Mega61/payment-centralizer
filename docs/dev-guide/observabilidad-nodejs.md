# Observabilidad y Operación - Node.js

Esta guía define los estándares de observabilidad para microservicios Node.js/TypeScript usando OpenTelemetry, alineado con las prácticas establecidas en .NET.

---

## Tabla de Contenidos

1. [Instalación y Configuración de OpenTelemetry](#instalación-y-configuración-de-opentelemetry)
2. [Logging Estructurado](#logging-estructurado)
3. [Métricas](#métricas)
4. [Tracing Distribuido](#tracing-distribuido)
5. [Health Checks](#health-checks)
6. [Alertas y Monitoreo](#alertas-y-monitoreo)
7. [Integración Completa](#integración-completa)

---

## Instalación y Configuración de OpenTelemetry

### Dependencias Necesarias

```bash
# OpenTelemetry SDK y API
npm install @opentelemetry/sdk-node
npm install @opentelemetry/api
npm install @opentelemetry/auto-instrumentations-node

# Exporters OTLP
npm install @opentelemetry/exporter-trace-otlp-http
npm install @opentelemetry/exporter-metrics-otlp-http
npm install @opentelemetry/exporter-logs-otlp-http

# Instrumentaciones específicas
npm install @opentelemetry/instrumentation-http
npm install @opentelemetry/instrumentation-express
npm install @opentelemetry/instrumentation-pg  # Para PostgreSQL
npm install @opentelemetry/instrumentation-redis

# Resources
npm install @opentelemetry/resources
npm install @opentelemetry/semantic-conventions
```

### Configuración Base de OpenTelemetry

```typescript
// infrastructure/observability/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import {
  SemanticResourceAttributes,
  SemanticAttributes,
} from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ConfigService } from '../config/config.service';

export class TelemetryService {
  private sdk: NodeSDK;
  private config: ConfigService;

  constructor() {
    this.config = ConfigService.getInstance();
    this.sdk = this.initializeSDK();
  }

  private initializeSDK(): NodeSDK {
    const otlpEndpoint = this.config.get('OTEL_EXPORTER_OTLP_ENDPOINT');
    const serviceName = this.config.get('OTEL_SERVICE_NAME');

    // Resource con información del servicio
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.get('NODE_ENV'),
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'nazan',
    });

    // Trace Exporter
    const traceExporter = new OTLPTraceExporter({
      url: `${otlpEndpoint}/v1/traces`,
      headers: {},
    });

    // Metric Exporter
    const metricExporter = new OTLPMetricExporter({
      url: `${otlpEndpoint}/v1/metrics`,
      headers: {},
    });

    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 60000, // Exportar cada 60 segundos
    });

    // SDK Configuration
    const sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Configuración de auto-instrumentaciones
          '@opentelemetry/instrumentation-http': {
            requestHook: (span, request) => {
              span.setAttribute('http.custom.user_agent', request.headers['user-agent'] || '');
            },
          },
          '@opentelemetry/instrumentation-express': {
            requestHook: (span, request) => {
              span.setAttribute('express.route', request.route?.path || 'unknown');
            },
          },
        }),
      ],
    });

    return sdk;
  }

  async start(): Promise<void> {
    try {
      await this.sdk.start();
      console.log('✅ OpenTelemetry SDK started successfully');
    } catch (error) {
      console.error('❌ Error starting OpenTelemetry SDK:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      await this.sdk.shutdown();
      console.log('OpenTelemetry SDK shut down successfully');
    } catch (error) {
      console.error('Error shutting down OpenTelemetry SDK:', error);
    }
  }
}
```

---

## Logging Estructurado

### Implementación con Winston y OpenTelemetry

```typescript
// infrastructure/observability/logger.ts
import winston from 'winston';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { ConfigService } from '../config/config.service';

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;
  private config: ConfigService;

  private constructor() {
    this.config = ConfigService.getInstance();
    this.logger = this.createLogger();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private createLogger(): winston.Logger {
    const logLevel = this.config.get('LOG_LEVEL');
    const serviceName = this.config.get('OTEL_SERVICE_NAME');
    const environment = this.config.get('NODE_ENV');

    return winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'ISO' }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(info => {
          // Agregar trace context
          const span = trace.getActiveSpan();
          if (span) {
            const spanContext = span.spanContext();
            info.traceId = spanContext.traceId;
            info.spanId = spanContext.spanId;
            info.traceFlags = spanContext.traceFlags;
          }

          info.service = serviceName;
          info.environment = environment;

          return JSON.stringify(info);
        })
      ),
      defaultMeta: {
        service: serviceName,
        environment,
      },
      transports: [
        new winston.transports.Console({
          format: this.config.isDevelopment()
            ? winston.format.combine(winston.format.colorize(), winston.format.simple())
            : winston.format.json(),
        }),
      ],
    });
  }

  private enrichWithContext(meta: Record<string, unknown> = {}): Record<string, unknown> {
    const span = trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      return {
        ...meta,
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
      };
    }
    return meta;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, this.enrichWithContext(meta));
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, this.enrichWithContext(meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, this.enrichWithContext(meta));

    // Agregar evento al span actual
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent('warning', { message, ...meta });
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, this.enrichWithContext(meta));

    // Marcar span como error
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(new Error(message));
      span.setStatus({ code: SpanStatusCode.ERROR, message });
    }
  }

  // Método helper para logging estructurado de eventos de negocio
  logBusinessEvent(
    eventName: string,
    data: Record<string, unknown>,
    level: 'info' | 'warn' | 'error' = 'info'
  ): void {
    const enrichedData = {
      eventType: 'business',
      eventName,
      ...data,
    };

    this[level](`Business event: ${eventName}`, enrichedData);
  }
}
```

### Middleware de Logging para Express

```typescript
// interfaces/http/middlewares/logging.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Logger } from '@/infrastructure/observability/logger';

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const logger = Logger.getInstance();
  const startTime = Date.now();

  // Log de request
  logger.info('HTTP Request', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Interceptar el response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const span = trace.getActiveSpan();

    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
    };

    if (span) {
      span.setAttribute('http.response.duration_ms', duration);
      span.setAttribute('http.response.status_code', res.statusCode);

      if (res.statusCode >= 400) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.statusCode}` });
      }
    }

    if (res.statusCode >= 500) {
      logger.error('HTTP Response Error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('HTTP Response Warning', logData);
    } else {
      logger.info('HTTP Response', logData);
    }
  });

  next();
}
```

---

## Métricas

### Configuración de Métricas Personalizadas

```typescript
// infrastructure/observability/metrics.ts
import { metrics, ValueType } from '@opentelemetry/api';
import {
  Counter,
  Histogram,
  ObservableGauge,
  Meter,
  MeterProvider,
} from '@opentelemetry/sdk-metrics';
import { Logger } from './logger';

export class MetricsService {
  private static instance: MetricsService;
  private meter: Meter;
  private logger = Logger.getInstance();

  // Métricas de mensajería
  private messagesProcessedCounter: Counter;
  private messagesFailedCounter: Counter;
  private dlqMessagesCounter: Counter;
  private processingDurationHistogram: Histogram;
  private queueDepthGauge: ObservableGauge;

  // Métricas de HTTP
  private httpRequestsCounter: Counter;
  private httpRequestDurationHistogram: Histogram;

  // Métricas de negocio
  private ordersCreatedCounter: Counter;
  private ordersTotalValueHistogram: Histogram;

  private constructor() {
    const meterProvider = metrics.getMeterProvider() as MeterProvider;
    this.meter = meterProvider.getMeter('nazanone-metrics', '1.0.0');

    this.initializeMetrics();
  }

  static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  private initializeMetrics(): void {
    // Métricas de mensajería Solace
    this.messagesProcessedCounter = this.meter.createCounter('nazanone.solace.messages.processed', {
      description: 'Número total de mensajes procesados exitosamente',
      unit: '{messages}',
      valueType: ValueType.INT,
    });

    this.messagesFailedCounter = this.meter.createCounter('nazanone.solace.messages.failed', {
      description: 'Número total de mensajes que fallaron',
      unit: '{messages}',
      valueType: ValueType.INT,
    });

    this.dlqMessagesCounter = this.meter.createCounter('nazanone.solace.messages.dlq', {
      description: 'Mensajes enviados a Dead Letter Queue',
      unit: '{messages}',
      valueType: ValueType.INT,
    });

    this.processingDurationHistogram = this.meter.createHistogram(
      'nazanone.solace.processing.duration',
      {
        description: 'Duración del procesamiento de mensajes',
        unit: 'ms',
        valueType: ValueType.DOUBLE,
      }
    );

    this.queueDepthGauge = this.meter.createObservableGauge('nazanone.solace.queue.depth', {
      description: 'Número de mensajes pendientes en cola',
      unit: '{messages}',
      valueType: ValueType.INT,
    });

    // Métricas HTTP
    this.httpRequestsCounter = this.meter.createCounter('nazanone.http.requests', {
      description: 'Número total de requests HTTP',
      unit: '{requests}',
      valueType: ValueType.INT,
    });

    this.httpRequestDurationHistogram = this.meter.createHistogram(
      'nazanone.http.request.duration',
      {
        description: 'Duración de requests HTTP',
        unit: 'ms',
        valueType: ValueType.DOUBLE,
      }
    );

    // Métricas de negocio
    this.ordersCreatedCounter = this.meter.createCounter('nazanone.orders.created', {
      description: 'Número de órdenes creadas',
      unit: '{orders}',
      valueType: ValueType.INT,
    });

    this.ordersTotalValueHistogram = this.meter.createHistogram('nazanone.orders.total_value', {
      description: 'Valor total de las órdenes',
      unit: 'currency',
      valueType: ValueType.DOUBLE,
    });
  }

  // Métodos para registrar métricas de mensajería
  recordMessageProcessed(attributes: { queue: string; eventType: string; durationMs: number }): void {
    this.messagesProcessedCounter.add(1, {
      queue: attributes.queue,
      event_type: attributes.eventType,
    });

    this.processingDurationHistogram.record(attributes.durationMs, {
      queue: attributes.queue,
      event_type: attributes.eventType,
    });

    this.logger.debug('Message processing metric recorded', attributes);
  }

  recordMessageFailed(attributes: {
    queue: string;
    eventType: string;
    reason: string;
  }): void {
    this.messagesFailedCounter.add(1, {
      queue: attributes.queue,
      event_type: attributes.eventType,
      reason: attributes.reason,
    });

    this.logger.warn('Message failure metric recorded', attributes);
  }

  recordDLQMessage(attributes: { dlq: string; failureReason: string }): void {
    this.dlqMessagesCounter.add(1, {
      dlq: attributes.dlq,
      failure_reason: attributes.failureReason,
    });
  }

  // Métodos para registrar métricas HTTP
  recordHttpRequest(attributes: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
  }): void {
    this.httpRequestsCounter.add(1, {
      method: attributes.method,
      path: attributes.path,
      status_code: attributes.statusCode.toString(),
    });

    this.httpRequestDurationHistogram.record(attributes.durationMs, {
      method: attributes.method,
      path: attributes.path,
      status_code: attributes.statusCode.toString(),
    });
  }

  // Métodos para registrar métricas de negocio
  recordOrderCreated(attributes: { customerId: string; orderValue: number }): void {
    this.ordersCreatedCounter.add(1, {
      customer_id: attributes.customerId,
    });

    this.ordersTotalValueHistogram.record(attributes.orderValue, {
      customer_id: attributes.customerId,
    });

    this.logger.logBusinessEvent('order.created', attributes);
  }

  // Business-level metrics para E-commerce
  recordOrderProcessingLatency(attributes: {
    orderId: string;
    stage: 'validation' | 'payment' | 'inventory' | 'fulfillment' | 'complete';
    latencyMs: number;
  }): void {
    this.processingDurationHistogram.record(attributes.latencyMs, {
      queue: 'business-orders',
      event_type: `order_${attributes.stage}`,
      order_id: attributes.orderId,
    });

    // Alertar si excede targets SLA
    if (attributes.latencyMs > 100) { // P95 target
      this.logger.warn('Order processing latency exceeds target', {
        orderId: attributes.orderId,
        stage: attributes.stage,
        latencyMs: attributes.latencyMs,
        targetMs: 100,
      });
    }
  }

  recordBusinessTransaction(attributes: {
    transactionType: 'order_created' | 'payment_captured' | 'shipment_created';
    success: boolean;
    durationMs: number;
  }): void {
    const transactionCounter = this.meter.createCounter(`nazanone.business.${attributes.transactionType}`, {
      description: `Count of ${attributes.transactionType} transactions`,
      unit: '{transactions}',
      valueType: ValueType.INT,
    });

    transactionCounter.add(1, {
      success: attributes.success.toString(),
      status: attributes.success ? 'completed' : 'failed',
    });

    this.logger.info('Business transaction recorded', attributes);
  }

  // Callback para gauge observable
  registerQueueDepthCallback(callback: () => Promise<number>): void {
    this.queueDepthGauge.addCallback(async observableResult => {
      try {
        const depth = await callback();
        observableResult.observe(depth, { queue: 'orders' });
      } catch (error) {
        this.logger.error('Error reading queue depth', { error });
      }
    });
  }
}
```

### Middleware de Métricas para Express

```typescript
// interfaces/http/middlewares/metrics.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '@/infrastructure/observability/metrics';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const metricsService = MetricsService.getInstance();
  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;

    metricsService.recordHttpRequest({
      method: req.method,
      path: req.route?.path || req.path,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}
```

---

## Tracing Distribuido

### Creación de Spans Personalizados

```typescript
// infrastructure/observability/tracing.ts
import { trace, context, SpanStatusCode, Span, SpanKind } from '@opentelemetry/api';
import { Logger } from './logger';

export class TracingService {
  private static instance: TracingService;
  private tracer = trace.getTracer('nazanone-tracer', '1.0.0');
  private logger = Logger.getInstance();

  static getInstance(): TracingService {
    if (!TracingService.instance) {
      TracingService.instance = new TracingService();
    }
    return TracingService.instance;
  }

  /**
   * Ejecuta una función dentro de un nuevo span
   */
  async withSpan<T>(
    spanName: string,
    fn: (span: Span) => Promise<T>,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
    }
  ): Promise<T> {
    const span = this.tracer.startSpan(spanName, {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes,
    });

    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Crea un span hijo del contexto actual
   */
  startChildSpan(
    spanName: string,
    attributes?: Record<string, string | number | boolean>
  ): Span {
    return this.tracer.startSpan(spanName, { attributes });
  }

  /**
   * Obtiene el span activo del contexto
   */
  getActiveSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  /**
   * Agrega un evento al span actual
   */
  addEvent(eventName: string, attributes?: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(eventName, attributes);
    }
  }

  /**
   * Marca el span actual como error
   */
  recordError(error: Error): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    }
  }
}
```

### Ejemplo de Uso en Service

```typescript
// application/services/order.service.ts
import { injectable, inject } from 'tsyringe';
import { SpanKind } from '@opentelemetry/api';
import { OrderRepository } from '@/domain/repositories/order.repository';
import { TracingService } from '@/infrastructure/observability/tracing';
import { MetricsService } from '@/infrastructure/observability/metrics';
import { Logger } from '@/infrastructure/observability/logger';

@injectable()
export class OrderService {
  private tracingService = TracingService.getInstance();
  private metricsService = MetricsService.getInstance();
  private logger = Logger.getInstance();

  constructor(
    @inject('OrderRepository') private orderRepository: OrderRepository
  ) {}

  async createOrder(data: CreateOrderData): Promise<Order> {
    return this.tracingService.withSpan(
      'OrderService.createOrder',
      async span => {
        span.setAttribute('customer.id', data.customerId);
        span.setAttribute('order.items_count', data.items.length);

        this.logger.info('Creating order', { customerId: data.customerId });

        // Validación en sub-span
        await this.tracingService.withSpan(
          'validateOrderData',
          async validateSpan => {
            validateSpan.setAttribute('validation.type', 'order');
            await this.validateOrderData(data);
          }
        );

        // Crear entidad de dominio
        const order = new Order(data);
        span.setAttribute('order.id', order.id);

        // Guardar en repositorio
        await this.tracingService.withSpan(
          'OrderRepository.save',
          async saveSpan => {
            saveSpan.setAttribute('repository.operation', 'save');
            await this.orderRepository.save(order);
          },
          { kind: SpanKind.CLIENT }
        );

        // Registrar métrica
        this.metricsService.recordOrderCreated({
          customerId: data.customerId,
          orderValue: order.totalValue,
        });

        this.logger.info('Order created successfully', { orderId: order.id });

        return order;
      },
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'service.operation': 'createOrder',
        },
      }
    );
  }

  private async validateOrderData(data: CreateOrderData): Promise<void> {
    // Validación...
  }
}
```

---

## Health Checks

### Health Check Service Completo

```typescript
// infrastructure/observability/health-check.service.ts
import { injectable } from 'tsyringe';
import { Logger } from './logger';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  timestamp: string;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy';
  message?: string;
  responseTime?: number;
  details?: Record<string, unknown>;
}

@injectable()
export class HealthCheckService {
  private logger = Logger.getInstance();
  private healthCheckers = new Map<string, () => Promise<HealthCheck>>();

  registerHealthCheck(name: string, checker: () => Promise<HealthCheck>): void {
    this.healthCheckers.set(name, checker);
    this.logger.debug('Health check registered', { name });
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const checks: HealthCheck[] = [];

    for (const [name, checker] of this.healthCheckers) {
      try {
        const startTime = Date.now();
        const check = await checker();
        check.responseTime = Date.now() - startTime;
        checks.push(check);
      } catch (error) {
        this.logger.error('Health check failed', { name, error });
        checks.push({
          name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const unhealthyChecks = checks.filter(c => c.status === 'unhealthy');
    const status =
      unhealthyChecks.length === 0
        ? 'healthy'
        : unhealthyChecks.length === checks.length
        ? 'unhealthy'
        : 'degraded';

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  async checkLiveness(): Promise<boolean> {
    // Liveness check simple - el proceso está vivo
    return true;
  }

  async checkReadiness(): Promise<boolean> {
    const result = await this.checkHealth();
    return result.status !== 'unhealthy';
  }
}
```

### Health Check Implementations

```typescript
// infrastructure/observability/health-checks/database.health-check.ts
import { injectable, inject } from 'tsyringe';
import { DataSource } from 'typeorm';
import { HealthCheck } from '../health-check.service';

@injectable()
export class DatabaseHealthCheck {
  constructor(@inject('DataSource') private dataSource: DataSource) {}

  async check(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      await this.dataSource.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      return {
        name: 'database',
        status: 'healthy',
        message: 'Database connection is healthy',
        responseTime,
        details: {
          database: this.dataSource.options.database,
          type: this.dataSource.options.type,
        },
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database check failed',
      };
    }
  }
}
```

```typescript
// infrastructure/observability/health-checks/solace.health-check.ts
import { injectable, inject } from 'tsyringe';
import { SolaceConnectionPool } from '@/infrastructure/messaging/solace-connection-pool';
import { HealthCheck } from '../health-check.service';

@injectable()
export class SolaceHealthCheck {
  constructor(@inject('SolaceConnectionPool') private connectionPool: SolaceConnectionPool) {}

  async check(): Promise<HealthCheck> {
    try {
      const session = await this.connectionPool.acquire();
      const isConnected = session.isCapable(
        require('solclientjs').CapabilityType.ACTIVE_FLOW_INDICATION
      );
      this.connectionPool.release(session);

      if (isConnected) {
        return {
          name: 'solace',
          status: 'healthy',
          message: 'Solace connection is healthy',
        };
      } else {
        return {
          name: 'solace',
          status: 'unhealthy',
          message: 'Solace connection is not active',
        };
      }
    } catch (error) {
      return {
        name: 'solace',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Solace check failed',
      };
    }
  }
}
```

### Health Check Controller

```typescript
// interfaces/http/controllers/health.controller.ts
import { Router, Request, Response } from 'express';
import { container } from '@/container';
import { HealthCheckService } from '@/infrastructure/observability/health-check.service';

export const healthRouter = Router();

const healthCheckService = container.resolve(HealthCheckService);

// Liveness probe - verifica que el proceso está vivo
healthRouter.get('/live', async (req: Request, res: Response) => {
  const isAlive = await healthCheckService.checkLiveness();

  if (isAlive) {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } else {
    res.status(503).json({
      status: 'dead',
      timestamp: new Date().toISOString(),
    });
  }
});

// Readiness probe - verifica que el servicio está listo
healthRouter.get('/ready', async (req: Request, res: Response) => {
  const result = await healthCheckService.checkHealth();

  const statusCode = result.status === 'unhealthy' ? 503 : 200;

  res.status(statusCode).json({
    status: result.status,
    checks: result.checks,
    timestamp: result.timestamp,
  });
});

// Health check detallado
healthRouter.get('/health', async (req: Request, res: Response) => {
  const result = await healthCheckService.checkHealth();

  res.status(200).json(result);
});
```

---

## Alertas y Monitoreo

### Servicio de Alertas

```typescript
// infrastructure/observability/alerting.service.ts
import { injectable } from 'tsyringe';
import { Logger } from './logger';

export interface AlertThreshold {
  value: number;
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

export interface Alert {
  metricName: string;
  currentValue: number;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  timestamp: Date;
}

@injectable()
export class AlertingService {
  private logger = Logger.getInstance();
  private thresholds = new Map<string, AlertThreshold>();

  constructor() {
    this.initializeThresholds();
  }

  private initializeThresholds(): void {
    // Umbrales de cola
    this.thresholds.set('queue.depth.warning', {
      value: 1000,
      severity: 'warning',
      description: 'Profundidad de cola superior a 1000 mensajes',
    });

    this.thresholds.set('queue.depth.critical', {
      value: 5000,
      severity: 'critical',
      description: 'Profundidad de cola superior a 5000 mensajes',
    });

    // Umbrales de latencia
    this.thresholds.set('processing.latency.warning', {
      value: 1000, // ms
      severity: 'warning',
      description: 'Latencia de procesamiento superior a 1s',
    });

    // Umbrales de error
    this.thresholds.set('error.rate.warning', {
      value: 0.05, // 5%
      severity: 'warning',
      description: 'Tasa de error superior al 5%',
    });

    // Umbrales de DLQ
    this.thresholds.set('dlq.messages', {
      value: 10,
      severity: 'warning',
      description: 'Más de 10 mensajes en DLQ',
    });
  }

  async checkAndAlert(metricName: string, value: number): Promise<void> {
    const threshold = this.thresholds.get(metricName);

    if (!threshold) {
      return;
    }

    if (value >= threshold.value) {
      const alert: Alert = {
        metricName,
        currentValue: value,
        threshold: threshold.value,
        severity: threshold.severity,
        description: threshold.description,
        timestamp: new Date(),
      };

      await this.sendAlert(alert);
    }
  }

  private async sendAlert(alert: Alert): Promise<void> {
    // Log del alert
    this.logger.warn('Alert triggered', {
      metricName: alert.metricName,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
      severity: alert.severity,
      description: alert.description,
    });

    // Aquí se podría integrar con servicios externos:
    // - PagerDuty
    // - Slack
    // - Email
    // - etc.
  }
}
```

---

## Integración Completa

### Inicialización en server.ts

```typescript
// server.ts
import 'reflect-metadata';
import { TelemetryService } from '@/infrastructure/observability/telemetry';
import { HealthCheckService } from '@/infrastructure/observability/health-check.service';
import { DatabaseHealthCheck } from '@/infrastructure/observability/health-checks/database.health-check';
import { SolaceHealthCheck } from '@/infrastructure/observability/health-checks/solace.health-check';
import { Logger } from '@/infrastructure/observability/logger';
import { createApp } from './app';
import { container } from './container';

async function bootstrap(): Promise<void> {
  const logger = Logger.getInstance();

  try {
    // 1. Inicializar OpenTelemetry
    const telemetry = new TelemetryService();
    await telemetry.start();

    // 2. Registrar health checks
    const healthCheckService = container.resolve(HealthCheckService);
    const databaseHealthCheck = container.resolve(DatabaseHealthCheck);
    const solaceHealthCheck = container.resolve(SolaceHealthCheck);

    healthCheckService.registerHealthCheck('database', () => databaseHealthCheck.check());
    healthCheckService.registerHealthCheck('solace', () => solaceHealthCheck.check());

    // 3. Crear y configurar app
    const app = createApp();
    const PORT = process.env.PORT || 3000;

    // 4. Iniciar servidor
    const server = app.listen(PORT, () => {
      logger.info('Server started', {
        port: PORT,
        environment: process.env.NODE_ENV,
      });
    });

    // 5. Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');

      server.close(() => {
        logger.info('HTTP server closed');
      });

      await telemetry.shutdown();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

bootstrap();
```

---

### Configuración .env para Observabilidad

```bash
# Observabilidad
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.deloim.com/obshub/otlp
OTEL_SERVICE_NAME=order-service
LOG_LEVEL=info

# Para desarrollo local
# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

---

## SLA Tracking y Compliance

### Service Level Agreement Monitoring

```typescript
// infrastructure/observability/sla-tracker.ts
import { MetricsService } from './metrics';
import { Logger } from './logger';

export interface SLATarget {
  name: string;
  uptime: number; // Percentage: 99.9, 99.99, etc.
  maxErrorRate: number; // Percentage: 1.0, 0.1, etc.
  p95LatencyMs: number; // Milliseconds
  p99LatencyMs: number; // Milliseconds
}

export interface SLAMetrics {
  uptime: number;
  errorRate: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  totalRequests: number;
  failedRequests: number;
  period: string;
}

export class SLATracker {
  private logger = Logger.getInstance();
  private metrics = MetricsService.getInstance();
  private latencyHistory: number[] = [];
  private totalRequests: number = 0;
  private failedRequests: number = 0;
  private uptimeStart: Date;
  private downtimeTotal: number = 0;

  constructor(
    private serviceName: string,
    private targets: SLATarget = {
      name: 'default',
      uptime: 99.9,
      maxErrorRate: 1.0,
      p95LatencyMs: 100,
      p99LatencyMs: 200,
    }
  ) {
    this.uptimeStart = new Date();
  }

  recordRequest(latencyMs: number, success: boolean): void {
    this.totalRequests++;
    this.latencyHistory.push(latencyMs);

    if (!success) {
      this.failedRequests++;
    }

    // Mantener historial limitado (últimas 10,000 requests)
    if (this.latencyHistory.length > 10000) {
      this.latencyHistory.shift();
    }
  }

  recordDowntime(durationMs: number): void {
    this.downtimeTotal += durationMs;
    this.logger.warn('Downtime recorded', {
      durationMs,
      totalDowntimeMs: this.downtimeTotal,
    });
  }

  getCurrentMetrics(): SLAMetrics {
    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

    const uptimeMs = Date.now() - this.uptimeStart.getTime();
    const uptimePercent = ((uptimeMs - this.downtimeTotal) / uptimeMs) * 100;
    const errorRate = this.totalRequests > 0
      ? (this.failedRequests / this.totalRequests) * 100
      : 0;

    return {
      uptime: uptimePercent,
      errorRate,
      p50Latency: p50,
      p95Latency: p95,
      p99Latency: p99,
      totalRequests: this.totalRequests,
      failedRequests: this.failedRequests,
      period: this.calculatePeriod(),
    };
  }

  checkCompliance(): SLAComplianceReport {
    const current = this.getCurrentMetrics();

    const uptimeCompliant = current.uptime >= this.targets.uptime;
    const errorRateCompliant = current.errorRate <= this.targets.maxErrorRate;
    const p95Compliant = current.p95Latency <= this.targets.p95LatencyMs;
    const p99Compliant = current.p99Latency <= this.targets.p99LatencyMs;

    const overallCompliant = uptimeCompliant &&
                            errorRateCompliant &&
                            p95Compliant &&
                            p99Compliant;

    const report: SLAComplianceReport = {
      serviceName: this.serviceName,
      timestamp: new Date().toISOString(),
      targets: this.targets,
      current: current,
      compliance: {
        overall: overallCompliant,
        uptime: uptimeCompliant,
        errorRate: errorRateCompliant,
        p95Latency: p95Compliant,
        p99Latency: p99Compliant,
      },
      violations: [],
    };

    // Registrar violaciones
    if (!uptimeCompliant) {
      report.violations.push({
        metric: 'uptime',
        target: this.targets.uptime,
        current: current.uptime,
        severity: 'critical',
      });
    }

    if (!errorRateCompliant) {
      report.violations.push({
        metric: 'errorRate',
        target: this.targets.maxErrorRate,
        current: current.errorRate,
        severity: 'high',
      });
    }

    if (!p95Compliant) {
      report.violations.push({
        metric: 'p95Latency',
        target: this.targets.p95LatencyMs,
        current: current.p95Latency,
        severity: 'medium',
      });
    }

    if (!p99Compliant) {
      report.violations.push({
        metric: 'p99Latency',
        target: this.targets.p99LatencyMs,
        current: current.p99Latency,
        severity: 'low',
      });
    }

    // Log compliance status
    if (overallCompliant) {
      this.logger.info('SLA compliance check passed', {
        serviceName: this.serviceName,
        current,
      });
    } else {
      this.logger.error('SLA compliance violations detected', {
        serviceName: this.serviceName,
        violations: report.violations,
      });
    }

    return report;
  }

  startPeriodicComplianceCheck(intervalMs: number = 300000): NodeJS.Timer {
    return setInterval(() => {
      const report = this.checkCompliance();

      // Exportar métricas de compliance
      this.exportComplianceMetrics(report);
    }, intervalMs); // Check cada 5 minutos por defecto
  }

  private exportComplianceMetrics(report: SLAComplianceReport): void {
    // Registrar métricas de SLA en OpenTelemetry
    this.metrics.recordHttpRequest({
      method: 'SLA_UPTIME',
      path: '/sla/uptime',
      statusCode: report.compliance.uptime ? 200 : 503,
      durationMs: report.current.uptime,
    });

    this.metrics.recordHttpRequest({
      method: 'SLA_ERROR_RATE',
      path: '/sla/error-rate',
      statusCode: report.compliance.errorRate ? 200 : 500,
      durationMs: report.current.errorRate,
    });

    this.metrics.recordHttpRequest({
      method: 'SLA_P95',
      path: '/sla/p95',
      statusCode: report.compliance.p95Latency ? 200 : 500,
      durationMs: report.current.p95Latency,
    });
  }

  private calculatePeriod(): string {
    const uptimeMs = Date.now() - this.uptimeStart.getTime();
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h`;
  }

  reset(): void {
    this.latencyHistory = [];
    this.totalRequests = 0;
    this.failedRequests = 0;
    this.uptimeStart = new Date();
    this.downtimeTotal = 0;

    this.logger.info('SLA tracker reset', { serviceName: this.serviceName });
  }
}

export interface SLAComplianceReport {
  serviceName: string;
  timestamp: string;
  targets: SLATarget;
  current: SLAMetrics;
  compliance: {
    overall: boolean;
    uptime: boolean;
    errorRate: boolean;
    p95Latency: boolean;
    p99Latency: boolean;
  };
  violations: SLAViolation[];
}

export interface SLAViolation {
  metric: string;
  target: number;
  current: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}
```

### Integración con Express Middleware

```typescript
// interfaces/http/middlewares/sla-tracking.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { SLATracker } from '@/infrastructure/observability/sla-tracker';

const slaTracker = new SLATracker('order-service', {
  name: 'order-service-sla',
  uptime: 99.99, // 99.99% uptime target
  maxErrorRate: 0.1, // Max 0.1% error rate
  p95LatencyMs: 100, // <100ms P95
  p99LatencyMs: 200, // <200ms P99
});

// Iniciar monitoreo periódico
slaTracker.startPeriodicComplianceCheck(300000); // Cada 5 minutos

export function slaTrackingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const latency = Date.now() - startTime;
    const success = res.statusCode < 500;

    slaTracker.recordRequest(latency, success);
  });

  next();
}

// Endpoint para SLA dashboard
export function getSLAReport(req: Request, res: Response): void {
  const report = slaTracker.checkCompliance();
  res.json(report);
}
```

### Dashboard de SLA (Grafana/Kibana Query Example)

```promql
# Uptime SLA (Prometheus query)
(
  sum(rate(http_requests_total{job="order-service"}[5m]))
  -
  sum(rate(http_requests_total{job="order-service",status=~"5.."}[5m]))
)
/
sum(rate(http_requests_total{job="order-service"}[5m]))
* 100

# P95 Latency
histogram_quantile(0.95,
  sum(rate(http_request_duration_ms_bucket{job="order-service"}[5m])) by (le)
)

# Error Rate
sum(rate(http_requests_total{job="order-service",status=~"5.."}[5m]))
/
sum(rate(http_requests_total{job="order-service"}[5m]))
* 100
```

---
