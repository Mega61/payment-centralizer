import { BaseError } from './BaseError.js';

export class ValidationError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 400, true, context);
  }
}

export class NotFoundError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 404, true, context);
  }
}

export class InternalServerError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 500, true, context);
  }
}

export class ExternalServiceError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 502, true, context);
  }
}

export class TransactionParsingError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 422, true, context);
  }
}
