import { OCRResult } from '@domain/entities/OCRResult.js';
import { VisionFeature } from '@shared/types/index.js';

export interface VisionRepository {
  annotateImage(imageUri: string, features: VisionFeature[]): Promise<OCRResult>;
  annotateImageBuffer(imageBuffer: Buffer, features: VisionFeature[]): Promise<OCRResult>;
}
