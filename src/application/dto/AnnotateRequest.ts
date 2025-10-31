import { z } from 'zod';
import { VisionFeature } from '@shared/types/index.js';

export const annotateRequestSchema = z.object({
  imageUri: z.string().url().optional(),
  imageBase64: z.string().optional(),
  features: z
    .array(z.nativeEnum(VisionFeature))
    .optional()
    .default([VisionFeature.TEXT_DETECTION, VisionFeature.DOCUMENT_TEXT_DETECTION]),
});

export type AnnotateRequest = z.infer<typeof annotateRequestSchema>;

export const validateAnnotateRequest = (data: unknown): AnnotateRequest => {
  const result = annotateRequestSchema.safeParse(data);

  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.message}`);
  }

  // Ensure at least one image source is provided
  if (!result.data.imageUri && !result.data.imageBase64) {
    throw new Error('Either imageUri or imageBase64 must be provided');
  }

  return result.data;
};
