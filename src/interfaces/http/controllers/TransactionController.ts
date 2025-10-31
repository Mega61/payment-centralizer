import { Request, Response, NextFunction } from 'express';
import { inject, injectable } from 'tsyringe';
import { AnnotateImageUseCase } from '@application/use-cases/AnnotateImageUseCase.js';
import { validateAnnotateRequest } from '@application/dto/AnnotateRequest.js';
import { ValidationError } from '@shared/errors/DomainErrors.js';
import type { Logger } from 'winston';

@injectable()
export class TransactionController {
  constructor(
    private readonly annotateImageUseCase: AnnotateImageUseCase,
    @inject('Logger') private readonly logger: Logger,
  ) {}

  public annotate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.logger.info('Received annotation request', {
        hasBody: !!req.body,
        contentType: req.get('content-type'),
      });

      const validatedRequest = validateAnnotateRequest(req.body);

      let result;

      if (validatedRequest.imageUri) {
        result = await this.annotateImageUseCase.executeFromUri(
          validatedRequest.imageUri,
          validatedRequest.features,
        );
      } else if (validatedRequest.imageBase64) {
        const imageBuffer = Buffer.from(validatedRequest.imageBase64, 'base64');
        result = await this.annotateImageUseCase.executeFromBuffer(
          imageBuffer,
          validatedRequest.features,
        );
      } else {
        throw new ValidationError('Either imageUri or imageBase64 must be provided');
      }

      // Log the complete OCR result for debugging and audit purposes
      this.logger.info('Annotation completed successfully', {
        transactionId: result.transaction.id,
        ocrResultId: result.ocrResult.id,
        isValid: result.validation.isValid,
        ocrResult: result.ocrResult.toJSON(), // Full OCR data logged but not returned in API response
      });

      res.status(200).json({
        transaction: result.transaction.toJSON(),
        validation: result.validation.toJSON(),
      });
    } catch (error) {
      this.logger.error('Error processing annotation request', { error });
      next(error);
    }
  };
}
