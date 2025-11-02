import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { AnnotateImageUseCase } from '@application/use-cases/AnnotateImageUseCase.js';
import { type StorageRepository } from '@domain/repositories/StorageRepository.js';
import { VisionFeature } from '@shared/types/index.js';
import { getConfig } from '@infrastructure/config/Config.js';
import { type Logger } from 'winston';

interface CloudEventData {
  message: {
    data: string;
    attributes?: Record<string, string>;
  };
}

interface GCSEventData {
  bucket: string;
  name: string;
  metageneration: string;
  timeCreated: string;
  updated: string;
}

@injectable()
export class CloudStorageEventHandler {
  constructor(
    private readonly annotateImageUseCase: AnnotateImageUseCase,
    @inject('StorageRepository') private readonly storageRepository: StorageRepository,
    @inject('Logger') private readonly logger: Logger,
  ) {}

  public handleFinalize = async (req: Request, res: Response): Promise<void> => {
    try {
      this.logger.info('Received Cloud Storage event', {
        headers: req.headers,
        hasBody: !!req.body,
      });

      // Parse CloudEvent (Eventarc format)
      const cloudEvent = req.body as CloudEventData;
      const messageData = cloudEvent.message.data;

      // Decode base64 Pub/Sub message
      const decodedData = Buffer.from(messageData, 'base64').toString('utf-8');
      const eventData = JSON.parse(decodedData) as GCSEventData;

      this.logger.info('Processing GCS object created event', {
        bucket: eventData.bucket,
        fileName: eventData.name,
        timeCreated: eventData.timeCreated,
      });

      // Get configuration
      const config = getConfig();
      const features = (config.VISION_API_FEATURES as unknown as string[]).map(
        (f) => f as VisionFeature,
      );

      // Build GCS URI
      const imageUri = this.storageRepository.getFileUrl(eventData.bucket, eventData.name);

      // Process the image
      const result = await this.annotateImageUseCase.executeFromUri(imageUri, features);

      // Save results to annotations bucket
      const annotationsBucket = config.GCS_ANNOTATIONS_BUCKET_NAME;
      if (annotationsBucket) {
        const annotationFileName = `${eventData.name}_annotations.json`;
        const annotationContent = JSON.stringify(
          {
            ocrResult: result.ocrResult.toJSON(),
            transaction: result.transaction.toJSON(),
            validation: result.validation.toJSON(),
          },
          null,
          2,
        );

        await this.storageRepository.uploadFile(
          annotationsBucket,
          annotationFileName,
          annotationContent,
        );

        this.logger.info('Annotations saved successfully', {
          bucket: annotationsBucket,
          fileName: annotationFileName,
        });
      }

      res.status(200).json({
        success: true,
        transactionId: result.transaction.id,
        ocrResultId: result.ocrResult.id,
        isValid: result.validation.isValid,
      });
    } catch (error) {
      this.logger.error('Error processing Cloud Storage event', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
