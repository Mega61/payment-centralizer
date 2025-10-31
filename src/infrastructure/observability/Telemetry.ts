import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
// import { PeriodicExportingMetricReader, MetricReader } from '@opentelemetry/sdk-metrics';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  otlpEndpoint?: string;
  enableTracing: boolean;
  enableMetrics: boolean;
}

export class Telemetry {
  private sdk: NodeSDK | null = null;

  public initialize(config: TelemetryConfig): void {
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
    });

    const instrumentations = [
      new HttpInstrumentation({
        requestHook: (span, request) => {
          if (request.method) {
            span.setAttribute('http.request.method', request.method);
          }
        },
      }),
      new ExpressInstrumentation(),
    ];

    const traceExporter = config.enableTracing
      ? new OTLPTraceExporter({
          url: config.otlpEndpoint,
        })
      : undefined;

    // Note: MetricReader temporarily disabled due to type incompatibility between
    // @opentelemetry/sdk-metrics and @opentelemetry/sdk-node dependencies
    // TODO: Re-enable when dependency versions are aligned
    const metricReader = undefined;

    this.sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader,
      instrumentations,
    });

    this.sdk.start();

    process.on('SIGTERM', () => {
      void this.shutdown();
    });

    process.on('SIGINT', () => {
      void this.shutdown();
    });
  }

  public async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
    }
  }
}
