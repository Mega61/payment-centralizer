# Node.js Deloim - Arquitectura y Mejores Prácticas

Esta guía define los estándares arquitectónicos y mejores prácticas para desarrollo de microservicios Node.js/TypeScript en Deloim, con enfoque en alta disponibilidad, escalabilidad e interoperabilidad con VTEX.

---

## Tabla de Contenidos

1. [Arquitectura de Microservicios](#arquitectura-de-microservicios)
2. [Estructura de Proyecto](#estructura-de-proyecto)
3. [Inyección de Dependencias](#inyección-de-dependencias)
4. [Frameworks Web](#frameworks-web)
5. [Configuración y Variables de Entorno](#configuración-y-variables-de-entorno)
6. [Manejo de Errores](#manejo-de-errores)
7. [Logging y Monitoreo](#logging-y-monitoreo)
8. [Base de Datos y Persistencia](#base-de-datos-y-persistencia)
9. [HTTP Client y Llamadas Externas](#http-client-y-llamadas-externas)
10. [Validación de Datos](#validación-de-datos)
11. [Seguridad](#seguridad)
12. [Performance y Optimización](#performance-y-optimización)
13. [Testing](#testing)
14. [Containerización](#containerización)
15. [Health Checks](#health-checks)

---

## Arquitectura de Microservicios

### Principios Fundamentales

1. **Separación de Responsabilidades**: Cada microservicio debe tener una responsabilidad clara y única.
2. **Independencia de Despliegue**: Los servicios deben poder desplegarse independientemente.
3. **Comunicación Asíncrona**: Preferir eventos sobre llamadas síncronas cuando sea posible.
4. **Resiliencia**: Implementar circuit breakers, retries, timeouts.
5. **Observabilidad**: Logging estructurado, métricas y tracing distribuido.

### Arquitectura por Capas

```
┌─────────────────────────────────────────────┐
│          Capa de Presentación               │
│   (Controllers, Middlewares, Validators)    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         Capa de Aplicación                  │
│     (Use Cases, Application Services)       │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│           Capa de Dominio                   │
│    (Entities, Value Objects, Services)      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│        Capa de Infraestructura              │
│  (Repositories, External APIs, Messaging)   │
└─────────────────────────────────────────────┘
```

---

## Estructura de Proyecto

### Estructura Recomendada

```
proyecto-microservicio/
├── src/
│   ├── adapters/              # Adaptadores de plataforma (VTEX, standalone)
│   │   ├── vtex/
│   │   │   └── vtex-adapter.ts
│   │   └── standalone/
│   │       └── http-adapter.ts
│   ├── application/           # Casos de uso y servicios de aplicación
│   │   ├── use-cases/
│   │   │   ├── create-order.use-case.ts
│   │   │   └── update-inventory.use-case.ts
│   │   └── services/
│   │       └── order.service.ts
│   ├── domain/                # Lógica de negocio y entidades
│   │   ├── entities/
│   │   │   ├── order.entity.ts
│   │   │   └── order-item.entity.ts
│   │   ├── value-objects/
│   │   │   └── money.value-object.ts
│   │   ├── repositories/      # Interfaces (contratos)
│   │   │   └── order.repository.ts
│   │   ├── services/          # Servicios de dominio
│   │   │   └── pricing.service.ts
│   │   └── events/            # Eventos de dominio
│   │       └── order-created.event.ts
│   ├── infrastructure/        # Implementaciones técnicas
│   │   ├── database/
│   │   │   ├── repositories/
│   │   │   │   └── order.repository.impl.ts
│   │   │   └── connection.ts
│   │   ├── messaging/
│   │   │   ├── solace-client.ts
│   │   │   └── event-publisher.ts
│   │   ├── http/
│   │   │   └── vtex-client.ts
│   │   ├── observability/
│   │   │   ├── logger.ts
│   │   │   ├── metrics.ts
│   │   │   └── tracing.ts
│   │   └── config/
│   │       └── config.service.ts
│   ├── interfaces/            # Controladores e interfaces HTTP
│   │   ├── http/
│   │   │   ├── controllers/
│   │   │   │   └── order.controller.ts
│   │   │   ├── middlewares/
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── error.middleware.ts
│   │   │   │   └── logging.middleware.ts
│   │   │   └── validators/
│   │   │       └── order.validator.ts
│   │   └── graphql/           # (Opcional) Resolvers GraphQL
│   │       └── order.resolver.ts
│   ├── shared/                # Código compartido
│   │   ├── errors/
│   │   │   ├── base.error.ts
│   │   │   └── domain.errors.ts
│   │   ├── utils/
│   │   │   ├── date.utils.ts
│   │   │   └── validation.utils.ts
│   │   └── types/
│   │       └── common.types.ts
│   ├── container.ts           # Configuración de DI
│   ├── app.ts                 # Configuración de la aplicación
│   └── server.ts              # Entry point del servidor
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── jest.config.js
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## Inyección de Dependencias

### Usar TSyringe

**Instalación:**

```bash
npm install tsyringe reflect-metadata
```

**Configuración en `container.ts`:**

```typescript
import 'reflect-metadata';
import { container } from 'tsyringe';
import { OrderRepository } from '@/domain/repositories/order.repository';
import { OrderRepositoryImpl } from '@/infrastructure/database/repositories/order.repository.impl';
import { OrderService } from '@/application/services/order.service';
import { ConfigService } from '@/infrastructure/config/config.service';
import { Logger } from '@/infrastructure/observability/logger';

// Registrar servicios singleton
container.registerSingleton<ConfigService>('ConfigService', ConfigService);
container.registerSingleton<Logger>('Logger', Logger);

// Registrar repositorios
container.register<OrderRepository>('OrderRepository', {
  useClass: OrderRepositoryImpl,
});

// Registrar servicios de aplicación
container.registerSingleton<OrderService>('OrderService', OrderService);

export { container };
```

**Uso en clases:**

```typescript
import { injectable, inject } from 'tsyringe';
import { OrderRepository } from '@/domain/repositories/order.repository';
import { Logger } from '@/infrastructure/observability/logger';

@injectable()
export class OrderService {
  constructor(
    @inject('OrderRepository') private readonly orderRepository: OrderRepository,
    @inject('Logger') private readonly logger: Logger
  ) {}

  async createOrder(data: CreateOrderData): Promise<Order> {
    this.logger.info('Creating order', { customerId: data.customerId });

    const order = new Order(data);
    await this.orderRepository.save(order);

    return order;
  }
}
```

---

## Frameworks Web

### Opción 1: Express.js (Recomendado para compatibilidad VTEX)

**Instalación:**

```bash
npm install express
npm install -D @types/express
```

**Configuración básica (`app.ts`):**

```typescript
import express, { Application } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { errorMiddleware } from '@/interfaces/http/middlewares/error.middleware';
import { loggingMiddleware } from '@/interfaces/http/middlewares/logging.middleware';
import { orderRouter } from '@/interfaces/http/controllers/order.controller';
import { healthRouter } from '@/interfaces/http/controllers/health.controller';

export function createApp(): Application {
  const app = express();

  // Middlewares de seguridad
  app.use(helmet());
  app.use(compression());

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging
  app.use(loggingMiddleware);

  // Health checks
  app.use('/health', healthRouter);

  // Rutas de la aplicación
  app.use('/api/v1/orders', orderRouter);

  // Manejo de errores (debe ir al final)
  app.use(errorMiddleware);

  return app;
}
```

### Opción 2: Fastify (Recomendado para alto rendimiento)

**Instalación:**

```bash
npm install fastify
```

**Configuración básica:**

```typescript
import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Usamos nuestro logger personalizado
    requestIdLogLabel: 'requestId',
    disableRequestLogging: true,
  });

  // Plugins
  await app.register(helmet);
  await app.register(compress);

  // Health checks
  app.get('/health/live', async () => ({ status: 'ok' }));

  // Rutas
  await app.register(orderRoutes, { prefix: '/api/v1/orders' });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    reply.status(error.statusCode || 500).send({
      error: error.message,
      statusCode: error.statusCode || 500,
    });
  });

  return app;
}
```

---

## Configuración y Variables de Entorno

### Usar dotenv y Validación con Zod

**Instalación:**

```bash
npm install dotenv zod
```

**Schema de configuración (`config.service.ts`):**

```typescript
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const ConfigSchema = z.object({
  // Aplicación
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Base de datos
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.string().transform(Number).default('10'),

  // Solace
  SOLACE_HOST: z.string(),
  SOLACE_VPN: z.string(),
  SOLACE_USERNAME: z.string(),
  SOLACE_PASSWORD: z.string(),

  // VTEX (opcional)
  VTEX_ACCOUNT: z.string().optional(),
  VTEX_WORKSPACE: z.string().optional(),
  VTEX_APP_KEY: z.string().optional(),
  VTEX_APP_TOKEN: z.string().optional(),

  // OpenTelemetry
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url(),
  OTEL_SERVICE_NAME: z.string(),

  // APIs externas
  EXTERNAL_API_BASE_URL: z.string().url().optional(),
  EXTERNAL_API_TIMEOUT_MS: z.string().transform(Number).default('30000'),
});

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigService {
  private static instance: ConfigService;
  public readonly config: Config;

  private constructor() {
    const result = ConfigSchema.safeParse(process.env);

    if (!result.success) {
      console.error('❌ Invalid environment variables:', result.error.format());
      throw new Error('Invalid configuration');
    }

    this.config = result.data;
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }
}
```

**.env.example:**

```bash
# Aplicación
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
DATABASE_POOL_SIZE=10

# Solace
SOLACE_HOST=tcp://localhost:55555
SOLACE_VPN=default
SOLACE_USERNAME=user
SOLACE_PASSWORD=password

# VTEX
VTEX_ACCOUNT=accountname
VTEX_WORKSPACE=master
VTEX_APP_KEY=vtexappkey-xxx
VTEX_APP_TOKEN=xxx

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.deloim.com/obshub/otlp
OTEL_SERVICE_NAME=order-service

# APIs externas
EXTERNAL_API_BASE_URL=https://api.example.com
EXTERNAL_API_TIMEOUT_MS=30000
```

---

## Manejo de Errores

### Jerarquía de Errores

```typescript
// base.error.ts
export abstract class BaseError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// domain.errors.ts
export class ValidationError extends BaseError {
  constructor(message: string, public readonly field?: string, options?: ErrorOptions) {
    super(message, 400, true, options);
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string, id: string, options?: ErrorOptions) {
    super(`${resource} with id ${id} not found`, 404, true, options);
  }
}

export class ConflictError extends BaseError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 409, true, options);
  }
}

export class UnauthorizedError extends BaseError {
  constructor(message: string = 'Unauthorized', options?: ErrorOptions) {
    super(message, 401, true, options);
  }
}

export class ForbiddenError extends BaseError {
  constructor(message: string = 'Forbidden', options?: ErrorOptions) {
    super(message, 403, true, options);
  }
}

export class ExternalServiceError extends BaseError {
  constructor(
    service: string,
    message: string,
    public readonly originalError?: Error
  ) {
    super(`External service error (${service}): ${message}`, 502, false, {
      cause: originalError,
    });
  }
}
```

### Middleware de Manejo de Errores (Express)

```typescript
import { Request, Response, NextFunction } from 'express';
import { BaseError } from '@/shared/errors/base.error';
import { Logger } from '@/infrastructure/observability/logger';

export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const logger = Logger.getInstance();

  if (error instanceof BaseError) {
    logger.warn('Operational error', {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      path: req.path,
      method: req.method,
    });

    res.status(error.statusCode).json({
      error: {
        type: error.name,
        message: error.message,
        statusCode: error.statusCode,
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  } else {
    // Error no operacional - error crítico
    logger.error('Unexpected error', {
      error,
      stack: error.stack,
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      error: {
        type: 'InternalServerError',
        message: 'An unexpected error occurred',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
}
```

---

## Logging y Monitoreo

### Logger con Winston

```typescript
import winston from 'winston';
import { ConfigService } from '@/infrastructure/config/config.service';

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor() {
    const config = ConfigService.getInstance();

    this.logger = winston.createLogger({
      level: config.get('LOG_LEVEL'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: config.get('OTEL_SERVICE_NAME'),
        environment: config.get('NODE_ENV'),
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, meta);
  }
}
```

---

## Base de Datos y Persistencia

### Patrón Repository

**Interface del repositorio:**

```typescript
// domain/repositories/order.repository.ts
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findByCustomerId(customerId: string): Promise<Order[]>;
  save(order: Order): Promise<void>;
  update(order: Order): Promise<void>;
  delete(id: string): Promise<void>;
}
```

**Implementación con TypeORM:**

```typescript
// infrastructure/database/repositories/order.repository.impl.ts
import { injectable } from 'tsyringe';
import { Repository, DataSource } from 'typeorm';
import { OrderRepository } from '@/domain/repositories/order.repository';
import { Order } from '@/domain/entities/order.entity';
import { OrderEntity } from '../entities/order.entity';

@injectable()
export class OrderRepositoryImpl implements OrderRepository {
  private repository: Repository<OrderEntity>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(OrderEntity);
  }

  async findById(id: string): Promise<Order | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    const entities = await this.repository.find({ where: { customerId } });
    return entities.map(e => this.toDomain(e));
  }

  async save(order: Order): Promise<void> {
    const entity = this.toEntity(order);
    await this.repository.save(entity);
  }

  async update(order: Order): Promise<void> {
    const entity = this.toEntity(order);
    await this.repository.update(order.id, entity);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private toDomain(entity: OrderEntity): Order {
    // Mapeo de entidad de BD a entidad de dominio
    return new Order(/* ... */);
  }

  private toEntity(order: Order): OrderEntity {
    // Mapeo de entidad de dominio a entidad de BD
    return { /* ... */ };
  }
}
```

---

## HTTP Client y Llamadas Externas

### Axios con Retry y Circuit Breaker

```typescript
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import CircuitBreaker from 'opossum';
import { Logger } from '@/infrastructure/observability/logger';

export class HttpClient {
  private client: AxiosInstance;
  private circuitBreaker: CircuitBreaker;
  private logger = Logger.getInstance();

  constructor(baseURL: string, timeout: number = 30000) {
    // Configurar Axios
    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Configurar retry automático
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: error => {
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429 || // Rate limit
          (error.response?.status ?? 0) >= 500 // Server errors
        );
      },
      onRetry: (retryCount, error) => {
        this.logger.warn('Retrying HTTP request', {
          retryCount,
          url: error.config?.url,
          method: error.config?.method,
        });
      },
    });

    // Configurar circuit breaker
    this.circuitBreaker = new CircuitBreaker(this.makeRequest.bind(this), {
      timeout: timeout,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000,
    });

    this.circuitBreaker.on('open', () => {
      this.logger.error('Circuit breaker opened', { baseURL });
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.warn('Circuit breaker half-open', { baseURL });
    });

    this.circuitBreaker.on('close', () => {
      this.logger.info('Circuit breaker closed', { baseURL });
    });
  }

  private async makeRequest<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config);
    return response.data;
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.circuitBreaker.fire({ ...config, method: 'GET', url });
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.circuitBreaker.fire({ ...config, method: 'POST', url, data });
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.circuitBreaker.fire({ ...config, method: 'PUT', url, data });
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.circuitBreaker.fire({ ...config, method: 'DELETE', url });
  }
}
```

---

## Validación de Datos

### Usar Zod para Schemas

```typescript
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '@/shared/errors/domain.errors';

// Schema de validación
export const CreateOrderSchema = z.object({
  customerId: z.string().uuid('Customer ID must be a valid UUID'),
  items: z
    .array(
      z.object({
        sku: z.string().min(1).max(50),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
      })
    )
    .min(1, 'Order must have at least one item'),
  shippingAddress: z.object({
    street: z.string(),
    city: z.string(),
    zipCode: z.string().regex(/^\d{5}$/),
  }),
  notes: z.string().max(1000).optional(),
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;

// Middleware de validación
export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        throw new ValidationError('Validation failed', fieldErrors[0]?.field);
      }
      throw error;
    }
  };
}

// Uso en controlador
router.post(
  '/orders',
  validateBody(CreateOrderSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const orderData = req.body as CreateOrderDto;
    const order = await orderService.createOrder(orderData);
    res.status(201).json(order);
  })
);
```

---

## Seguridad

### 1. Helmet para Headers Seguros

```typescript
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);
```

### 2. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de 100 requests por ventana
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
```

### 3. CORS

```typescript
import cors from 'cors';

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
```

### 4. Client Certificate Authentication para Solace

**Uso:** Autenticación mutual TLS (mTLS) para conexiones seguras entre microservicios y Solace broker.

```typescript
// infrastructure/messaging/solace-secure-connection.ts
import solace from 'solclientjs';
import fs from 'fs';
import path from 'path';
import { Logger } from '../observability/logger';

export interface SecureSolaceConfig {
  host: string; // wss://secure.solace.example.com:55443
  vpnName: string;
  username: string;
  password: string;
  // Certificados para mTLS
  clientCertPath: string;
  clientKeyPath: string;
  trustedCAPath: string;
  validateCertificate: boolean;
  trustedCommonNames: string[];
}

export class SecureSolaceConnection {
  private logger = Logger.getInstance();
  private session: solace.Session | null = null;

  constructor(private config: SecureSolaceConfig) {}

  async connect(): Promise<solace.Session> {
    return new Promise((resolve, reject) => {
      try {
        // Cargar certificados
        const clientCert = fs.readFileSync(this.config.clientCertPath, 'utf8');
        const clientKey = fs.readFileSync(this.config.clientKeyPath, 'utf8');
        const trustedCA = fs.readFileSync(this.config.trustedCAPath, 'utf8');

        this.logger.info('Connecting to Solace with mTLS', {
          host: this.config.host,
          vpn: this.config.vpnName,
        });

        // Configuración de sesión con SSL/TLS
        const sessionProperties = {
          url: this.config.host, // wss:// para secure WebSocket
          vpnName: this.config.vpnName,
          userName: this.config.username,
          password: this.config.password,

          // Propiedades SSL/TLS
          sslValidateCertificate: this.config.validateCertificate,
          sslTrustStores: [trustedCA],
          sslClientCertificate: clientCert,
          sslClientPrivateKey: clientKey,

          // Validación de common name
          sslValidateCertificateDate: true,
          sslTrustedCommonNameList: this.config.trustedCommonNames,

          // Timeouts y reconexión
          connectTimeoutInMsecs: 10000,
          reconnectRetries: 3,
          reconnectRetryWaitInMsecs: 3000,

          // Propiedades de seguridad adicionales
          generateSendTimestamps: true,
          generateReceiveTimestamps: true,
        };

        this.session = solace.SolclientFactory.createSession(sessionProperties);

        this.session.on(solace.SessionEventCode.UP_NOTICE, () => {
          this.logger.info('Secure Solace session established', {
            vpn: this.config.vpnName,
            cipher: 'TLS 1.3', // Logged automáticamente por Solace
          });
          resolve(this.session!);
        });

        this.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (error) => {
          this.logger.error('Secure Solace connection failed', {
            error,
            reason: 'Check certificates and common names',
          });
          reject(new Error('Failed to establish secure connection to Solace'));
        });

        this.session.on(solace.SessionEventCode.DISCONNECTED, () => {
          this.logger.warn('Secure Solace session disconnected');
        });

        this.session.connect();
      } catch (error) {
        this.logger.error('Error loading certificates or creating session', { error });
        reject(error);
      }
    });
  }

  getSession(): solace.Session {
    if (!this.session) {
      throw new Error('Secure Solace session not initialized');
    }
    return this.session;
  }

  async disconnect(): Promise<void> {
    if (this.session) {
      this.session.disconnect();
      this.session = null;
      this.logger.info('Secure Solace session disconnected');
    }
  }
}
```

#### Certificate Rotation Strategy

```typescript
// infrastructure/security/certificate-manager.ts
import fs from 'fs/promises';
import { Logger } from '../observability/logger';

export class CertificateManager {
  private logger = Logger.getInstance();
  private rotationCheckInterval?: NodeJS.Timer;

  constructor(
    private certPath: string,
    private keyPath: string,
    private onRotation: () => Promise<void>
  ) {}

  async startRotationMonitoring(checkIntervalMs: number = 3600000): Promise<void> {
    this.rotationCheckInterval = setInterval(async () => {
      await this.checkAndRotate();
    }, checkIntervalMs); // Check cada hora

    // Check inicial
    await this.checkAndRotate();
  }

  private async checkAndRotate(): Promise<void> {
    try {
      const certContent = await fs.readFile(this.certPath, 'utf8');
      const expiryDate = this.extractExpiryDate(certContent);

      if (!expiryDate) {
        this.logger.warn('Could not extract certificate expiry date');
        return;
      }

      const daysUntilExpiry = this.calculateDaysUntilExpiry(expiryDate);

      this.logger.debug('Certificate expiry check', {
        expiryDate: expiryDate.toISOString(),
        daysUntilExpiry,
      });

      // Rotar si quedan menos de 30 días
      if (daysUntilExpiry <= 30) {
        this.logger.warn('Certificate expiring soon, triggering rotation', {
          daysUntilExpiry,
        });
        await this.onRotation();
      } else if (daysUntilExpiry <= 7) {
        this.logger.error('Certificate expiring very soon!', {
          daysUntilExpiry,
        });
      }
    } catch (error) {
      this.logger.error('Error checking certificate rotation', { error });
    }
  }

  private extractExpiryDate(certContent: string): Date | null {
    // Parsear certificado X.509 para extraer fecha de expiración
    // En producción, usar una librería como 'node-forge' o '@peculiar/x509'
    try {
      const match = certContent.match(/Not After\s*:\s*(.+)/);
      if (match) {
        return new Date(match[1]);
      }
    } catch (error) {
      this.logger.error('Failed to parse certificate expiry', { error });
    }
    return null;
  }

  private calculateDaysUntilExpiry(expiryDate: Date): number {
    const now = new Date();
    const diff = expiryDate.getTime() - now.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  stopRotationMonitoring(): void {
    if (this.rotationCheckInterval) {
      clearInterval(this.rotationCheckInterval);
      this.rotationCheckInterval = undefined;
    }
  }
}
```

### 5. Secrets Management con HashiCorp Vault

```bash
npm install node-vault
npm install -D @types/node-vault
```

```typescript
// infrastructure/security/vault-client.ts
import vault from 'node-vault';
import { Logger } from '../observability/logger';

export class VaultSecretsManager {
  private static instance: VaultSecretsManager;
  private client: vault.client;
  private logger = Logger.getInstance();
  private secretsCache = new Map<string, { value: any; expiresAt: number }>();

  private constructor() {
    this.client = vault({
      apiVersion: 'v1',
      endpoint: process.env.VAULT_ADDR || 'http://localhost:8200',
      token: process.env.VAULT_TOKEN,
    });
  }

  static getInstance(): VaultSecretsManager {
    if (!VaultSecretsManager.instance) {
      VaultSecretsManager.instance = new VaultSecretsManager();
    }
    return VaultSecretsManager.instance;
  }

  async getSecret(path: string, cacheTTLSeconds: number = 300): Promise<any> {
    try {
      // Check cache
      const cached = this.secretsCache.get(path);
      if (cached && Date.now() < cached.expiresAt) {
        this.logger.debug('Returning cached secret', { path });
        return cached.value;
      }

      // Fetch from Vault
      this.logger.debug('Fetching secret from Vault', { path });
      const response = await this.client.read(path);

      // Cache secret
      const expiresAt = Date.now() + (cacheTTLSeconds * 1000);
      this.secretsCache.set(path, {
        value: response.data,
        expiresAt,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch secret from Vault', { path, error });
      throw error;
    }
  }

  async getSolaceCredentials(): Promise<{
    username: string;
    password: string;
    clientCertPath: string;
    clientKeyPath: string;
  }> {
    const secrets = await this.getSecret('secret/data/solace/credentials');
    return {
      username: secrets.username,
      password: secrets.password,
      clientCertPath: secrets.client_cert_path,
      clientKeyPath: secrets.client_key_path,
    };
  }

  async getDatabaseCredentials(): Promise<{
    url: string;
    username: string;
    password: string;
  }> {
    const secrets = await this.getSecret('secret/data/database/credentials');
    return {
      url: secrets.url,
      username: secrets.username,
      password: secrets.password,
    };
  }

  async refreshSecret(path: string): Promise<void> {
    this.secretsCache.delete(path);
    await this.getSecret(path);
    this.logger.info('Secret refreshed', { path });
  }

  clearCache(): void {
    this.secretsCache.clear();
    this.logger.info('Secrets cache cleared');
  }
}

// Uso en configuración
import { VaultSecretsManager } from '@/infrastructure/security/vault-client';

async function loadSecureConfig() {
  const vaultManager = VaultSecretsManager.getInstance();

  // Cargar credenciales de Solace desde Vault
  const solaceCredentials = await vaultManager.getSolaceCredentials();

  return {
    solace: {
      host: process.env.SOLACE_HOST!,
      vpnName: process.env.SOLACE_VPN!,
      username: solaceCredentials.username,
      password: solaceCredentials.password,
      clientCertPath: solaceCredentials.clientCertPath,
      clientKeyPath: solaceCredentials.clientKeyPath,
    },
  };
}
```

### 6. ACL Profiles y Role-Based Access

```typescript
// infrastructure/security/acl-manager.ts
export interface ACLProfile {
  serviceName: string;
  allowedTopics: string[];
  allowedQueues: string[];
  permissions: {
    publish: string[];
    subscribe: string[];
    consume: string[];
  };
}

export class ACLManager {
  private profiles = new Map<string, ACLProfile>();
  private logger = Logger.getInstance();

  registerProfile(profile: ACLProfile): void {
    this.profiles.set(profile.serviceName, profile);
    this.logger.info('ACL profile registered', {
      serviceName: profile.serviceName,
      topicCount: profile.allowedTopics.length,
      queueCount: profile.allowedQueues.length,
    });
  }

  canPublish(serviceName: string, topic: string): boolean {
    const profile = this.profiles.get(serviceName);
    if (!profile) {
      this.logger.warn('No ACL profile found for service', { serviceName });
      return false;
    }

    return profile.permissions.publish.some(pattern =>
      this.matchPattern(topic, pattern)
    );
  }

  canSubscribe(serviceName: string, topic: string): boolean {
    const profile = this.profiles.get(serviceName);
    if (!profile) return false;

    return profile.permissions.subscribe.some(pattern =>
      this.matchPattern(topic, pattern)
    );
  }

  canConsume(serviceName: string, queue: string): boolean {
    const profile = this.profiles.get(serviceName);
    if (!profile) return false;

    return profile.permissions.consume.some(pattern =>
      this.matchPattern(queue, pattern)
    );
  }

  private matchPattern(value: string, pattern: string): boolean {
    // Soportar wildcards: * = cualquier nivel, > = multi-nivel
    const regexPattern = pattern
      .replace(/\*/g, '[^/]+')
      .replace(/>/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(value);
  }
}

// Configuración de ACL Profiles
const aclManager = new ACLManager();

// Profile para Order Service
aclManager.registerProfile({
  serviceName: 'order-service',
  allowedTopics: ['ecom/orders/v1/*'],
  allowedQueues: ['order-events-queue'],
  permissions: {
    publish: ['ecom/orders/v1/order-events/*'],
    subscribe: ['ecom/inventory/v1/stock-events/*'],
    consume: ['order-events-queue'],
  },
});

// Profile para Inventory Service
aclManager.registerProfile({
  serviceName: 'inventory-service',
  allowedTopics: ['ecom/inventory/v1/*'],
  allowedQueues: ['inventory-events-queue'],
  permissions: {
    publish: ['ecom/inventory/v1/stock-events/*'],
    subscribe: ['ecom/orders/v1/order-events/*'],
    consume: ['inventory-events-queue'],
  },
});
```

---

## Serialización y Rendimiento

### Protocol Buffers para Alta Performance

**Ventaja:** Protocol Buffers ofrece hasta **3-5x mejor rendimiento** que JSON (621K ops/sec vs ~200K ops/sec) y reduce el tamaño de payload en ~40%.

#### Instalación

```bash
npm install protobufjs @types/protobufjs
npm install -D protoc
```

#### Definición de Schemas

```protobuf
// schemas/order-event.proto
syntax = "proto3";

package ecom.orders;

message OrderEvent {
  string order_id = 1;
  string customer_id = 2;
  int32 sequence_number = 3;
  string event_type = 4;
  int64 timestamp = 5;
  OrderPayload payload = 6;
}

message OrderPayload {
  repeated OrderItem items = 1;
  Address shipping_address = 2;
  PaymentInfo payment = 3;
  double total_amount = 4;
}

message OrderItem {
  string sku = 1;
  string name = 2;
  int32 quantity = 3;
  double unit_price = 4;
}

message Address {
  string street = 1;
  string city = 2;
  string state = 3;
  string zip_code = 4;
  string country = 5;
}

message PaymentInfo {
  string method = 1;
  string transaction_id = 2;
  string status = 3;
}
```

#### Serializer/Deserializer Service

```typescript
// infrastructure/serialization/protobuf-serializer.ts
import protobuf from 'protobufjs';
import path from 'path';
import { Logger } from '../observability/logger';

export class ProtobufSerializer {
  private static instance: ProtobufSerializer;
  private root?: protobuf.Root;
  private logger = Logger.getInstance();
  private schemaCache = new Map<string, protobuf.Type>();

  private constructor() {}

  static getInstance(): ProtobufSerializer {
    if (!ProtobufSerializer.instance) {
      ProtobufSerializer.instance = new ProtobufSerializer();
    }
    return ProtobufSerializer.instance;
  }

  async initialize(schemaPath: string): Promise<void> {
    try {
      this.root = await protobuf.load(schemaPath);
      this.logger.info('Protobuf schemas loaded', { schemaPath });
    } catch (error) {
      this.logger.error('Failed to load protobuf schemas', { error });
      throw error;
    }
  }

  serialize<T>(messageName: string, data: T): Buffer {
    try {
      const MessageType = this.getMessageType(messageName);

      // Validar datos contra schema
      const errMsg = MessageType.verify(data);
      if (errMsg) {
        throw new Error(`Validation error: ${errMsg}`);
      }

      // Crear mensaje y serializar
      const message = MessageType.create(data);
      const buffer = MessageType.encode(message).finish();

      this.logger.debug('Message serialized', {
        messageName,
        originalSize: JSON.stringify(data).length,
        compressedSize: buffer.length,
        compressionRatio: (1 - buffer.length / JSON.stringify(data).length).toFixed(2),
      });

      return Buffer.from(buffer);
    } catch (error) {
      this.logger.error('Serialization failed', { messageName, error });
      throw error;
    }
  }

  deserialize<T>(messageName: string, buffer: Buffer): T {
    try {
      const MessageType = this.getMessageType(messageName);
      const message = MessageType.decode(buffer);
      const object = MessageType.toObject(message, {
        longs: String,
        enums: String,
        bytes: String,
        defaults: true,
      }) as T;

      this.logger.debug('Message deserialized', {
        messageName,
        bufferSize: buffer.length,
      });

      return object;
    } catch (error) {
      this.logger.error('Deserialization failed', { messageName, error });
      throw error;
    }
  }

  private getMessageType(messageName: string): protobuf.Type {
    if (this.schemaCache.has(messageName)) {
      return this.schemaCache.get(messageName)!;
    }

    if (!this.root) {
      throw new Error('Protobuf root not initialized');
    }

    const MessageType = this.root.lookupType(messageName);
    this.schemaCache.set(messageName, MessageType);
    return MessageType;
  }

  // Helper para comparación de rendimiento
  async benchmark(messageName: string, data: any, iterations: number = 10000): Promise<void> {
    this.logger.info('Starting serialization benchmark', { iterations });

    // Benchmark Protobuf
    const protobufStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      const buffer = this.serialize(messageName, data);
      this.deserialize(messageName, buffer);
    }
    const protobufTime = Date.now() - protobufStart;

    // Benchmark JSON
    const jsonStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      const json = JSON.stringify(data);
      JSON.parse(json);
    }
    const jsonTime = Date.now() - jsonStart;

    this.logger.info('Benchmark results', {
      protobuf: {
        timeMs: protobufTime,
        opsPerSec: Math.round((iterations / protobufTime) * 1000),
        avgTimePerOpUs: (protobufTime / iterations * 1000).toFixed(2),
      },
      json: {
        timeMs: jsonTime,
        opsPerSec: Math.round((iterations / jsonTime) * 1000),
        avgTimePerOpUs: (jsonTime / iterations * 1000).toFixed(2),
      },
      improvement: `${((jsonTime / protobufTime - 1) * 100).toFixed(1)}% faster`,
    });
  }
}
```

#### Uso con Solace

```typescript
// infrastructure/messaging/solace-protobuf-publisher.ts
import solace from 'solclientjs';
import { ProtobufSerializer } from '../serialization/protobuf-serializer';
import { Logger } from '../observability/logger';

export class SolaceProtobufPublisher {
  private serializer = ProtobufSerializer.getInstance();
  private logger = Logger.getInstance();

  constructor(private session: solace.Session) {}

  async publishOrderEvent(orderEvent: OrderEvent, topicName: string): Promise<void> {
    try {
      // Serializar con Protobuf
      const buffer = this.serializer.serialize('ecom.orders.OrderEvent', orderEvent);

      // Crear mensaje Solace
      const message = solace.SolclientFactory.createMessage();
      message.setDestination(solace.SolclientFactory.createTopicDestination(topicName));
      message.setBinaryAttachment(buffer.toString('base64')); // Solace acepta base64

      // Metadatos
      const userProperties = new solace.SDTMapContainer();
      userProperties.addField('ContentType', solace.SDTFieldType.STRING, 'application/protobuf');
      userProperties.addField('Schema', solace.SDTFieldType.STRING, 'ecom.orders.OrderEvent');
      userProperties.addField('SchemaVersion', solace.SDTFieldType.STRING, '1.0.0');
      message.setUserPropertyMap(userProperties);

      // Publicar
      message.setDeliveryMode(solace.MessageDeliveryModeType.PERSISTENT);
      this.session.send(message);

      this.logger.info('Protobuf message published', {
        topic: topicName,
        orderId: orderEvent.order_id,
        bufferSize: buffer.length,
      });
    } catch (error) {
      this.logger.error('Failed to publish protobuf message', { error });
      throw error;
    }
  }
}
```

#### Schema Versioning Strategy

```typescript
// infrastructure/serialization/schema-registry.ts
export interface SchemaVersion {
  name: string;
  version: string;
  schemaPath: string;
  compatibleWith: string[];
}

export class SchemaRegistry {
  private schemas = new Map<string, Map<string, SchemaVersion>>();

  registerSchema(schema: SchemaVersion): void {
    if (!this.schemas.has(schema.name)) {
      this.schemas.set(schema.name, new Map());
    }
    this.schemas.get(schema.name)!.set(schema.version, schema);
  }

  getSchema(name: string, version: string): SchemaVersion | undefined {
    return this.schemas.get(name)?.get(version);
  }

  getLatestSchema(name: string): SchemaVersion | undefined {
    const versions = this.schemas.get(name);
    if (!versions || versions.size === 0) return undefined;

    // Obtener versión más reciente
    const sortedVersions = Array.from(versions.entries())
      .sort((a, b) => this.compareVersions(b[0], a[0]));

    return sortedVersions[0][1];
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      if (part1 !== part2) return part1 - part2;
    }
    return 0;
  }
}

// Uso
const registry = new SchemaRegistry();
registry.registerSchema({
  name: 'ecom.orders.OrderEvent',
  version: '1.0.0',
  schemaPath: 'schemas/order-event-v1.proto',
  compatibleWith: [],
});

registry.registerSchema({
  name: 'ecom.orders.OrderEvent',
  version: '1.1.0',
  schemaPath: 'schemas/order-event-v1.1.proto',
  compatibleWith: ['1.0.0'], // Backward compatible
});
```

---

## Performance y Optimización

### 1. Clustering para Aprovechar Múltiples Núcleos

```typescript
// server.ts
import cluster from 'cluster';
import os from 'os';

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(`Master process ${process.pid} is running`);
  console.log(`Forking ${numCPUs} workers`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  // Worker process - iniciar aplicación
  const app = createApp();
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`Worker ${process.pid} listening on port ${PORT}`);
  });
}
```

### 2. Compression

```typescript
import compression from 'compression';

app.use(compression());
```

### 3. Caching con Redis

```typescript
import { createClient, RedisClientType } from 'redis';

export class CacheService {
  private client: RedisClientType;

  async connect(): Promise<void> {
    this.client = createClient({
      url: process.env.REDIS_URL,
    });
    await this.client.connect();
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
```

### 4. Connection Pooling para Solace

**Objetivo:** Mantener pool de conexiones reutilizables para alto throughput con baja latencia.

```typescript
// infrastructure/messaging/solace-connection-pool.ts
import solace from 'solclientjs';
import { Logger } from '../observability/logger';
import { MetricsService } from '../observability/metrics';

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  performanceTargets: {
    p95LatencyMs: number;      // Target: <100ms
    p99LatencyMs: number;      // Target: <200ms
    reliabilityPercent: number; // Target: 99.99%
  };
}

export class SolaceConnectionPoolAdvanced {
  private pool: solace.Session[] = [];
  private available: solace.Session[] = [];
  private inUse = new Set<solace.Session>();
  private logger = Logger.getInstance();
  private metrics = MetricsService.getInstance();
  private healthCheckInterval?: NodeJS.Timer;
  private performanceMonitor?: NodeJS.Timer;
  private latencyHistory: number[] = [];

  constructor(
    private config: SolaceConfig,
    private poolConfig: ConnectionPoolConfig = {
      minConnections: 5,
      maxConnections: 20,
      acquireTimeoutMs: 10000,
      idleTimeoutMs: 300000, // 5 minutos
      performanceTargets: {
        p95LatencyMs: 100,
        p99LatencyMs: 200,
        reliabilityPercent: 99.99,
      }
    }
  ) {}

  async initialize(): Promise<void> {
    // Crear conexiones mínimas
    for (let i = 0; i < this.poolConfig.minConnections; i++) {
      const session = await this.createSession(`pool-session-${i}`);
      this.pool.push(session);
      this.available.push(session);
    }

    // Health check cada 30 segundos
    this.healthCheckInterval = setInterval(() => {
      this.checkPoolHealth();
    }, 30000);

    // Performance monitoring cada 60 segundos
    this.performanceMonitor = setInterval(() => {
      this.monitorPerformance();
    }, 60000);

    this.logger.info('Solace connection pool initialized', {
      minConnections: this.poolConfig.minConnections,
      maxConnections: this.poolConfig.maxConnections,
      targets: this.poolConfig.performanceTargets,
    });
  }

  async acquire(): Promise<solace.Session> {
    const startTime = Date.now();

    try {
      // Esperar conexión disponible con timeout
      const session = await this.waitForAvailableSession(this.poolConfig.acquireTimeoutMs);

      this.inUse.add(session);
      const acquireLatency = Date.now() - startTime;

      // Registrar latencia
      this.latencyHistory.push(acquireLatency);
      if (this.latencyHistory.length > 1000) {
        this.latencyHistory.shift();
      }

      this.metrics.recordMessageProcessed({
        queue: 'connection-pool',
        eventType: 'connection-acquire',
        durationMs: acquireLatency,
      });

      this.logger.debug('Session acquired from pool', {
        available: this.available.length,
        inUse: this.inUse.size,
        latencyMs: acquireLatency,
      });

      return session;
    } catch (error) {
      this.logger.error('Failed to acquire session', { error });
      throw error;
    }
  }

  release(session: solace.Session): void {
    this.inUse.delete(session);
    this.available.push(session);

    this.logger.debug('Session released to pool', {
      available: this.available.length,
      inUse: this.inUse.size,
    });
  }

  private async waitForAvailableSession(timeoutMs: number): Promise<solace.Session> {
    const startTime = Date.now();

    while (true) {
      // Si hay sesiones disponibles, retornar una
      if (this.available.length > 0) {
        return this.available.pop()!;
      }

      // Si se puede crear una nueva sesión (no alcanzó el máximo)
      if (this.pool.length < this.poolConfig.maxConnections) {
        const session = await this.createSession(`pool-session-${this.pool.length}`);
        this.pool.push(session);
        return session;
      }

      // Verificar timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('Timeout waiting for available session');
      }

      // Esperar 100ms antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private monitorPerformance(): void {
    if (this.latencyHistory.length === 0) return;

    // Calcular percentiles
    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    const meetsP95Target = p95 <= this.poolConfig.performanceTargets.p95LatencyMs;
    const meetsP99Target = p99 <= this.poolConfig.performanceTargets.p99LatencyMs;

    this.logger.info('Connection pool performance', {
      latency: { p50, p95, p99 },
      targets: this.poolConfig.performanceTargets,
      meetsTargets: meetsP95Target && meetsP99Target,
      poolSize: {
        total: this.pool.length,
        available: this.available.length,
        inUse: this.inUse.size,
      }
    });

    // Alertar si no cumple targets
    if (!meetsP95Target) {
      this.logger.warn('Connection pool P95 latency exceeds target', {
        current: p95,
        target: this.poolConfig.performanceTargets.p95LatencyMs,
      });
    }

    if (!meetsP99Target) {
      this.logger.warn('Connection pool P99 latency exceeds target', {
        current: p99,
        target: this.poolConfig.performanceTargets.p99LatencyMs,
      });
    }
  }

  private checkPoolHealth(): void {
    this.pool.forEach((session, index) => {
      if (!session.isCapable(solace.CapabilityType.ACTIVE_FLOW_INDICATION)) {
        this.logger.warn('Unhealthy session detected', { sessionIndex: index });
        this.reconnectSession(session);
      }
    });
  }

  private async reconnectSession(session: solace.Session): Promise<void> {
    try {
      session.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));
      session.connect();
      this.logger.info('Session reconnected successfully');
    } catch (error) {
      this.logger.error('Failed to reconnect session', { error });
    }
  }

  private async createSession(sessionId: string): Promise<solace.Session> {
    return new Promise((resolve, reject) => {
      const session = solace.SolclientFactory.createSession({
        url: this.config.host,
        vpnName: this.config.vpnName,
        userName: this.config.username,
        password: this.config.password,
        clientName: sessionId,
        connectTimeoutInMsecs: 10000,
        reconnectRetries: 3,
        reconnectRetryWaitInMsecs: 3000,
      });

      session.on(solace.SessionEventCode.UP_NOTICE, () => {
        this.logger.debug('Session connected', { sessionId });
        resolve(session);
      });

      session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, error => {
        this.logger.error('Session connection failed', { sessionId, error });
        reject(new Error(`Failed to connect session ${sessionId}`));
      });

      session.connect();
    });
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.performanceMonitor) {
      clearInterval(this.performanceMonitor);
    }

    this.pool.forEach(session => {
      try {
        session.disconnect();
      } catch (error) {
        this.logger.error('Error disconnecting session', { error });
      }
    });

    this.pool = [];
    this.available = [];
    this.inUse.clear();

    this.logger.info('Solace connection pool shutdown');
  }
}

interface SolaceConfig {
  host: string;
  vpnName: string;
  username: string;
  password: string;
}
```

### 5. Memory Optimization

```typescript
// infrastructure/observability/memory-monitor.ts
export class MemoryMonitor {
  private logger = Logger.getInstance();
  private metrics = MetricsService.getInstance();

  startMonitoring(intervalMs: number = 60000): NodeJS.Timer {
    return setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;

      this.logger.info('Memory usage', {
        heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsedPercent: `${heapUsedPercent.toFixed(2)}%`,
        rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`,
        external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`,
      });

      // Alertar si el uso de heap supera el 80%
      if (heapUsedPercent > 80) {
        this.logger.warn('High memory usage detected', {
          heapUsedPercent: `${heapUsedPercent.toFixed(2)}%`,
        });

        // Considerar garbage collection manual si está habilitado
        if (global.gc) {
          this.logger.info('Triggering manual garbage collection');
          global.gc();
        }
      }

      // Registrar métricas
      this.metrics.recordHttpRequest({
        method: 'MEMORY',
        path: '/monitor',
        statusCode: 200,
        durationMs: heapUsedPercent,
      });
    }, intervalMs);
  }
}

// Iniciar en server.ts
const memoryMonitor = new MemoryMonitor();
memoryMonitor.startMonitoring(60000); // Cada minuto
```

---

## Testing

### Jest Configuration

**jest.config.js:**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.types.ts',
    '!src/**/*.interface.ts',
    '!src/server.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

### Test Example

```typescript
import { OrderService } from '@/application/services/order.service';
import { OrderRepository } from '@/domain/repositories/order.repository';
import { Logger } from '@/infrastructure/observability/logger';

describe('OrderService', () => {
  let orderService: OrderService;
  let mockRepository: jest.Mocked<OrderRepository>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByCustomerId: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    orderService = new OrderService(mockRepository, mockLogger);
  });

  describe('createOrder', () => {
    it('should create order successfully', async () => {
      // Arrange
      const orderData = {
        customerId: 'customer-123',
        items: [{ sku: 'SKU-001', quantity: 2, unitPrice: 100 }],
      };
      mockRepository.save.mockResolvedValue(undefined);

      // Act
      const result = await orderService.createOrder(orderData);

      // Assert
      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating order',
        expect.objectContaining({ customerId: 'customer-123' })
      );
    });
  });
});
```

---

## Containerización

### Dockerfile Optimizado

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependencias
RUN npm ci --only=production && \
    npm ci --only=development

# Copiar código fuente
COPY src ./src

# Build
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copiar archivos necesarios
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs package*.json ./

# Cambiar a usuario no-root
USER nodejs

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health/live', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando de inicio
CMD ["node", "dist/server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://user:password@postgres:5432/dbname
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./src:/app/src
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=dbname
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - '5432:5432'

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data

volumes:
  postgres-data:
  redis-data:
```

---

## Health Checks

### Implementación Completa

```typescript
import { Request, Response, Router } from 'express';
import { container } from '@/container';
import { ConfigService } from '@/infrastructure/config/config.service';

export const healthRouter = Router();

// Liveness probe - el servicio está vivo
healthRouter.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Readiness probe - el servicio está listo para recibir tráfico
healthRouter.get('/ready', async (req: Request, res: Response) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkSolace(),
  ]);

  const results = checks.map((check, index) => {
    const names = ['database', 'redis', 'solace'];
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

async function checkDatabase(): Promise<void> {
  // Implementar check de base de datos
}

async function checkRedis(): Promise<void> {
  // Implementar check de Redis
}

async function checkSolace(): Promise<void> {
  // Implementar check de Solace
}
```

---
