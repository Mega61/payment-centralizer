import winston from 'winston';
import { context, trace } from '@opentelemetry/api';

const getTraceContext = (): { traceId?: string; spanId?: string } => {
  const span = trace.getSpan(context.active());
  if (!span) {
    return {};
  }

  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
};

const traceContextFormat = winston.format((info) => {
  const traceContext = getTraceContext();
  return {
    ...info,
    ...traceContext,
  };
});

export const createLogger = (serviceName: string, logLevel: string): winston.Logger => {
  return winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      traceContextFormat(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    defaultMeta: {
      service: serviceName,
      environment: process.env['NODE_ENV'] ?? 'development',
    },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf((info) => {
            const { timestamp, level, message, service, traceId, spanId, ...meta } = info as {
              timestamp: string;
              level: string;
              message: string;
              service: string;
              traceId?: string;
              spanId?: string;
              [key: string]: unknown;
            };

            const traceInfo =
              traceId !== undefined && spanId !== undefined
                ? ` [trace:${traceId} span:${spanId}]`
                : '';
            const metaStr =
              Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
            return `${String(timestamp)} [${String(service)}] ${String(level)}: ${String(message)}${traceInfo}${metaStr}`;
          }),
        ),
      }),
    ],
  });
};
