import { Storage } from '@google-cloud/storage';
import { injectable } from 'tsyringe';
import { StorageRepository } from '@domain/repositories/StorageRepository.js';
import { ExternalServiceError, NotFoundError } from '@shared/errors/DomainErrors.js';
import type { Logger } from 'winston';

@injectable()
export class GoogleCloudStorageAdapter implements StorageRepository {
  private storage: Storage;

  constructor(private readonly logger: Logger) {
    this.storage = new Storage();
    this.logger.info('Google Cloud Storage client initialized');
  }

  public async uploadFile(
    bucketName: string,
    fileName: string,
    content: Buffer | string,
  ): Promise<string> {
    try {
      this.logger.info('Uploading file to GCS', { bucketName, fileName });

      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);

      await file.save(content);

      const publicUrl = this.getFileUrl(bucketName, fileName);

      this.logger.info('File uploaded successfully', {
        bucketName,
        fileName,
        url: publicUrl,
      });

      return publicUrl;
    } catch (error) {
      this.logger.error('Failed to upload file to GCS', {
        bucketName,
        fileName,
        error,
      });
      throw new ExternalServiceError('Failed to upload file to Cloud Storage', {
        bucketName,
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async downloadFile(bucketName: string, fileName: string): Promise<Buffer> {
    try {
      this.logger.info('Downloading file from GCS', { bucketName, fileName });

      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);

      const [exists] = await file.exists();
      if (!exists) {
        throw new NotFoundError('File not found in Cloud Storage', {
          bucketName,
          fileName,
        });
      }

      const [buffer] = await file.download();

      this.logger.info('File downloaded successfully', {
        bucketName,
        fileName,
        size: buffer.length,
      });

      return buffer;
    } catch (error) {
      this.logger.error('Failed to download file from GCS', {
        bucketName,
        fileName,
        error,
      });
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ExternalServiceError('Failed to download file from Cloud Storage', {
        bucketName,
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public getFileUrl(bucketName: string, fileName: string): string {
    return `gs://${bucketName}/${fileName}`;
  }

  public async fileExists(bucketName: string, fileName: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      this.logger.error('Failed to check file existence in GCS', {
        bucketName,
        fileName,
        error,
      });
      return false;
    }
  }
}
