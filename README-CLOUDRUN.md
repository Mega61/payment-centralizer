# Payment Centralizer - Cloud Run (Node.js/TypeScript)

Payment reconciliation solution using Google Cloud Vision API for OCR processing of bank transaction images. Built with Node.js/TypeScript following Clean Architecture (DDD) principles and deployed on Google Cloud Run serverless platform.

## Architecture

This application is built using **Clean Architecture (DDD)** with the following layers:

```
src/
├── domain/           # Business entities and interfaces
│   ├── entities/     # Core business objects (BankTransaction, OCRResult)
│   ├── repositories/ # Repository interfaces
│   └── value-objects/# Immutable value objects (Amount, CardInfo)
├── application/      # Use cases and DTOs
│   ├── use-cases/    # Business logic (AnnotateImageUseCase, ParseTransactionUseCase)
│   └── dto/          # Data transfer objects
├── infrastructure/   # External dependencies
│   ├── config/       # Configuration and DI container
│   ├── http/         # Express server setup
│   ├── logging/      # Winston logger
│   └── observability/# OpenTelemetry setup
├── adapters/         # External service adapters
│   ├── vision/       # Google Vision API adapter
│   └── storage/      # Google Cloud Storage adapter
├── interfaces/       # Entry points
│   ├── http/         # REST API (controllers, routes, middleware)
│   └── events/       # Event handlers (GCS, Pub/Sub)
└── shared/           # Shared utilities
    ├── errors/       # Custom error classes
    ├── types/        # TypeScript types and enums
    └── utils/        # Utility functions
```

## Features

- **OCR Processing**: Extract text from bank transaction images using Google Cloud Vision API
- **Transaction Parsing**: Parse Colombian and international bank transaction formats
- **Multi-Bank Support**: Bancolombia, Davivienda, BBVA, and other Colombian/international banks
- **Currency Detection**: Automatic detection of COP (Colombian Peso) and USD
- **Event-Driven**: Process images automatically when uploaded to GCS bucket
- **REST API**: HTTP endpoints for manual image annotation
- **Health Checks**: Kubernetes-ready liveness and readiness probes
- **Observability**: Full OpenTelemetry integration (traces, metrics, logs)
- **Security**: Helmet, CORS, rate limiting, authentication support

## Technology Stack

- **Runtime**: Node.js 20 + TypeScript 5.7
- **Framework**: Express.js
- **DI**: TSyringe with reflect-metadata
- **Validation**: Zod schemas
- **Logging**: Winston with trace context injection
- **Observability**: OpenTelemetry (OTLP exporters)
- **Testing**: Jest with AAA pattern
- **GCP Services**: Cloud Run, Vision API, Cloud Storage, Eventarc
- **Infrastructure**: Terraform

## Prerequisites

- Node.js 20 or later
- Docker (for containerization)
- Google Cloud SDK
- Terraform 1.5 or later
- GCP Project with billing enabled

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your GCP project details
```

### 3. Run Locally

```bash
# Authenticate with GCP
gcloud auth application-default login

# Start development server
npm run dev
```

### 4. Test API

```bash
# Health check
curl http://localhost:8080/health/live

# Annotate image
curl -X POST http://localhost:8080/api/v1/transactions/annotate \
  -H "Content-Type: application/json" \
  -d '{"imageUri": "gs://bucket/transaction.jpg"}'
```

## Deployment

### Build and Push Docker Image

```bash
# Build
docker build -t payment-centralizer .

# Tag for Artifact Registry
export PROJECT_ID=$(gcloud config get-value project)
export REGION=us-west4
docker tag payment-centralizer \
  ${REGION}-docker.pkg.dev/${PROJECT_ID}/payment-centralizer/app:latest

# Push
gcloud auth configure-docker ${REGION}-docker.pkg.dev
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/payment-centralizer/app:latest
```

### Deploy with Terraform

```bash
cd infra

# Initialize
terraform init

# Create terraform.tfvars
cat > terraform.tfvars <<EOF
project_id = "${PROJECT_ID}"
region     = "us-west4"
cloudrun_container_image = "${REGION}-docker.pkg.dev/${PROJECT_ID}/payment-centralizer/app:latest"
EOF

# Apply
terraform apply -var-file=terraform.tfvars
```

## API Documentation

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health/live` | Liveness probe |
| GET | `/health/ready` | Readiness probe |
| POST | `/api/v1/transactions/annotate` | Annotate transaction image |
| POST | `/events/gcs/finalize` | GCS event handler (Eventarc) |

### Example: Annotate Transaction

**Request**:
```bash
curl -X POST https://your-service-url/api/v1/transactions/annotate \
  -H "Content-Type: application/json" \
  -d '{
    "imageUri": "gs://bucket/transaction.jpg",
    "features": ["TEXT_DETECTION", "DOCUMENT_TEXT_DETECTION"]
  }'
```

**Response**:
```json
{
  "transaction": {
    "id": "txn_...",
    "amounts": [
      {
        "amount": 200000,
        "currency": "COP",
        "formatted": "COP 200.000,00"
      }
    ],
    "dates": ["15/01/2024"],
    "time": "20:33",
    "merchant": "EXITO SABANETA",
    "cardInfo": {
      "type": "Credit Card",
      "last4": "9095"
    },
    "transactionType": "PURCHASE",
    "banks": ["Bancolombia"]
  },
  "validation": {
    "isValid": true,
    "warnings": ["No reference numbers detected"],
    "errors": []
  }
}
```

**Note**: The full OCR result from Google Vision API is logged server-side for debugging and audit purposes, and is also saved to the GCS annotations bucket (`vision-annotations-*`) for archival.

## Development

### Project Structure

```
payment-centralizer/
├── src/                    # Source code
├── infra/                  # Terraform infrastructure
│   ├── main-cloudrun.tf    # Cloud Run configuration
│   ├── modules/cloudrun/   # Cloud Run module
│   └── modules/storage/    # GCS buckets module
├── dev-guide/              # Development standards
├── business-guide/         # Business requirements
├── Dockerfile              # Multi-stage Docker build
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript configuration
└── README-CLOUDRUN.md      # This file
```

### Commands

```bash
# Development
npm run dev              # Start dev server with watch mode
npm run build            # Build TypeScript
npm run start            # Start production server

# Testing
npm test                 # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# Code Quality
npm run lint             # Lint code
npm run lint:fix         # Fix linting issues
npm run format           # Format code
npm run typecheck        # Type checking

# Docker
npm run docker:build     # Build Docker image
npm run docker:run       # Run Docker container
```

## Migration from Python Cloud Functions

This Node.js/TypeScript version replaces the original Python Cloud Functions implementation with the following improvements:

| Feature | Python (Old) | Node.js (New) |
|---------|-------------|---------------|
| **Architecture** | Functional | Clean Architecture (DDD) |
| **Platform** | Cloud Functions | Cloud Run |
| **DI** | None | TSyringe |
| **Validation** | Manual | Zod schemas |
| **Observability** | Basic | Full OpenTelemetry |
| **Testing** | Manual | Jest (AAA pattern) |
| **Standards** | Ad-hoc | Deloim dev-guide compliant |

### Key Files Mapping

| Python | Node.js/TypeScript |
|--------|--------------------|
| `src/gcf/main.py` | `src/index.ts`, `src/interfaces/http/controllers/TransactionController.ts` |
| `parse_transaction.py` | `src/application/use-cases/ParseTransactionUseCase.ts` |
| `infra/modules/cloudfunctions/` | `infra/modules/cloudrun/` |
| N/A | `src/domain/entities/BankTransaction.ts` (new) |
| N/A | `src/infrastructure/observability/Telemetry.ts` (new) |

## Supported Banks & Formats

### Colombian Banks
- Bancolombia, Davivienda, BBVA Colombia, Banco de Bogotá, Banco de Occidente, and more

### International Banks
- Chase, Bank of America, Wells Fargo, Citibank, Capital One, and more

### Currency Formats
- **COP**: `51.558,00` (period thousands, comma decimals)
- **USD**: `1,234.56` (comma thousands, period decimals)

### Transaction Types
- PURCHASE, WIRE_TRANSFER, WITHDRAWAL, DEPOSIT, PAYMENT, ACH_TRANSFER

## Observability

### Structured Logging
Winston logger with OpenTelemetry trace context injection:

```json
{
  "timestamp": "2024-01-15T20:33:00.000Z",
  "level": "info",
  "message": "Transaction parsed successfully",
  "service": "payment-centralizer",
  "traceId": "abc123...",
  "spanId": "def456...",
  "transactionId": "txn_..."
}
```

### Tracing
OpenTelemetry traces exported to Cloud Trace:
- HTTP requests
- Vision API calls
- Transaction parsing
- Storage operations

### Metrics
Custom business metrics:
- Processing duration
- Success/failure rates
- Transaction validation metrics

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `NODE_ENV` | Environment (`development`/`production`) | `development` |
| `LOG_LEVEL` | Log level | `info` |
| `GCP_PROJECT_ID` | GCP project ID | Required |
| `GCS_BUCKET_NAME` | Input bucket name | Required |
| `GCS_ANNOTATIONS_BUCKET_NAME` | Annotations bucket | Required |
| `VISION_API_FEATURES` | Vision features (comma-separated) | `TEXT_DETECTION,...` |
| `ENABLE_TRACING` | Enable OpenTelemetry tracing | `true` |
| `ENABLE_METRICS` | Enable metrics export | `true` |
| `CORS_ORIGIN` | CORS allowed origin | `*` |
| `REQUIRE_AUTHENTICATION` | Require auth | `false` |

## Security

- **Helmet**: Security headers
- **CORS**: Configurable cross-origin access
- **Rate Limiting**: 100 requests/15min per IP (configurable)
- **Authentication**: Optional IAM-based authentication
- **Non-root User**: Docker runs as non-root user
- **Health Checks**: Liveness and readiness probes

## Contributing

Follow these standards:
1. **TypeScript Style**: See `dev-guide/typescript.md`
2. **Architecture**: Clean Architecture per `dev-guide/nodejs.md`
3. **Observability**: Follow `dev-guide/observabilidad-nodejs.md`
4. **Testing**: Use AAA pattern (Arrange-Act-Assert)
5. **Commits**: Conventional commits format

## License

UNLICENSED - Internal use only

## References

- [Original Python Version](./src/gcf/main.py)
- [Dev Guide](./dev-guide/nodejs.md)
- [Business Requirements](./business-guide/payment-reconciliation-solution.md)
- [Terraform Cloud Run Module](./infra/modules/cloudrun/)
