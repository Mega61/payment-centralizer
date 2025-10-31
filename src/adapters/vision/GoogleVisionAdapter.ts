import { ImageAnnotatorClient } from '@google-cloud/vision';
import { injectable } from 'tsyringe';
import { VisionRepository } from '@domain/repositories/VisionRepository.js';
import { OCRResult } from '@domain/entities/OCRResult.js';
import { VisionFeature } from '@shared/types/index.js';
import { ExternalServiceError } from '@shared/errors/DomainErrors.js';
import type { Logger } from 'winston';

@injectable()
export class GoogleVisionAdapter implements VisionRepository {
  private client: ImageAnnotatorClient;

  constructor(private readonly logger: Logger) {
    this.client = new ImageAnnotatorClient();
    this.logger.info('Google Vision API client initialized');
  }

  public async annotateImage(imageUri: string, features: VisionFeature[]): Promise<OCRResult> {
    try {
      this.logger.info('Annotating image from URI', { imageUri, features });

      const request = {
        image: { source: { imageUri } },
        features: features.map((feature) => ({ type: feature })),
      };

      const [result] = await this.client.annotateImage(request);

      if (!result) {
        throw new ExternalServiceError('Vision API returned no results', { imageUri });
      }

      if (result.error) {
        throw new ExternalServiceError(`Vision API error: ${result.error.message}`, {
          imageUri,
          error: result.error,
        });
      }

      const ocrResult = OCRResult.create({
        imageUri,
        features,
        annotations: {
          textAnnotations: result.textAnnotations ?? undefined,
          logoAnnotations: result.logoAnnotations ?? undefined,
          labelAnnotations: result.labelAnnotations ?? undefined,
          safeSearchAnnotation: result.safeSearchAnnotation ?? undefined,
          fullTextAnnotation: result.fullTextAnnotation ?? undefined,
        },
      });

      this.logger.info('Image annotation completed successfully', {
        imageUri,
        ocrResultId: ocrResult.id,
      });

      return ocrResult;
    } catch (error) {
      this.logger.error('Failed to annotate image', { imageUri, error });
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      throw new ExternalServiceError('Failed to process image with Vision API', {
        imageUri,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async annotateImageBuffer(
    imageBuffer: Buffer,
    features: VisionFeature[],
  ): Promise<OCRResult> {
    try {
      this.logger.info('Annotating image from buffer', {
        bufferSize: imageBuffer.length,
        features,
      });

      const request = {
        image: { content: imageBuffer },
        features: features.map((feature) => ({ type: feature })),
      };

      const [result] = await this.client.annotateImage(request);

      if (!result) {
        throw new ExternalServiceError('Vision API returned no results');
      }

      if (result.error) {
        throw new ExternalServiceError(`Vision API error: ${result.error.message}`, {
          error: result.error,
        });
      }

      // Generate a unique URI for buffer-based images
      const imageUri = `buffer://${Date.now()}_${imageBuffer.length}`;

      const ocrResult = OCRResult.create({
        imageUri,
        features,
        annotations: {
          textAnnotations: result.textAnnotations ?? undefined,
          logoAnnotations: result.logoAnnotations ?? undefined,
          labelAnnotations: result.labelAnnotations ?? undefined,
          safeSearchAnnotation: result.safeSearchAnnotation ?? undefined,
          fullTextAnnotation: result.fullTextAnnotation ?? undefined,
        },
      });

      this.logger.info('Image buffer annotation completed successfully', {
        ocrResultId: ocrResult.id,
      });

      return ocrResult;
    } catch (error) {
      this.logger.error('Failed to annotate image buffer', { error });
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      throw new ExternalServiceError('Failed to process image buffer with Vision API', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
