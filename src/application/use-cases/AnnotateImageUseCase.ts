import { injectable, inject } from 'tsyringe';
import { type VisionRepository } from '@domain/repositories/VisionRepository.js';
import { ParseTransactionUseCase } from './ParseTransactionUseCase.js';
import { BankTransaction } from '@domain/entities/BankTransaction.js';
import { TransactionValidation } from '@domain/entities/TransactionValidation.js';
import { OCRResult } from '@domain/entities/OCRResult.js';
import { VisionFeature } from '@shared/types/index.js';
import { type Logger } from 'winston';

export interface AnnotateImageResult {
  ocrResult: OCRResult;
  transaction: BankTransaction;
  validation: TransactionValidation;
}

@injectable()
export class AnnotateImageUseCase {
  constructor(
    @inject('VisionRepository') private readonly visionRepository: VisionRepository,
    @inject('Logger') private readonly logger: Logger,
    private readonly parseTransactionUseCase: ParseTransactionUseCase,
  ) {}

  // Logger type is imported with 'import type' to satisfy TypeScript decorator requirements

  public async executeFromUri(
    imageUri: string,
    features: VisionFeature[],
  ): Promise<AnnotateImageResult> {
    this.logger.info('Annotating image from URI', { imageUri, features });

    const ocrResult = await this.visionRepository.annotateImage(imageUri, features);
    const { transaction, validation } = this.parseTransactionUseCase.execute(ocrResult);

    return {
      ocrResult,
      transaction,
      validation,
    };
  }

  public async executeFromBuffer(
    imageBuffer: Buffer,
    features: VisionFeature[],
  ): Promise<AnnotateImageResult> {
    this.logger.info('Annotating image from buffer', {
      bufferSize: imageBuffer.length,
      features,
    });

    const ocrResult = await this.visionRepository.annotateImageBuffer(imageBuffer, features);
    const { transaction, validation } = this.parseTransactionUseCase.execute(ocrResult);

    return {
      ocrResult,
      transaction,
      validation,
    };
  }
}
