import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  // Server configuration
  PORT: z.string().default('8080').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  // GCP configuration
  GCP_PROJECT_ID: z.string().optional(),
  GCS_BUCKET_NAME: z.string().optional(),
  GCS_ANNOTATIONS_BUCKET_NAME: z.string().optional(),

  // Vision API configuration
  VISION_API_FEATURES: z
    .string()
    .default('TEXT_DETECTION,DOCUMENT_TEXT_DETECTION,LOGO_DETECTION,LABEL_DETECTION')
    .transform((val) => val.split(',')),

  // OpenTelemetry configuration
  ENABLE_TRACING: z.string().default('true').transform((val) => val === 'true'),
  ENABLE_METRICS: z.string().default('true').transform((val) => val === 'true'),
  OTLP_ENDPOINT: z.string().optional(),

  // Security configuration
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),
  REQUIRE_AUTHENTICATION: z.string().default('false').transform((val) => val === 'true'),
});

export type Config = z.infer<typeof configSchema>;

let configInstance: Config | null = null;

export const getConfig = (): Config => {
  if (configInstance) {
    return configInstance;
  }

  try {
    configInstance = configSchema.parse(process.env);
    return configInstance;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation error:');
      for (const issue of error.issues) {
        console.error(`  ${issue.path.join('.')}: ${issue.message}`);
      }
    }
    throw new Error('Invalid configuration');
  }
};
