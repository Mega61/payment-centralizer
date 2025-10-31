export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export class TransactionValidation {
  public readonly isValid: boolean;
  public readonly warnings: string[];
  public readonly errors: string[];

  private constructor(isValid: boolean, warnings: string[], errors: string[]) {
    this.isValid = isValid;
    this.warnings = warnings;
    this.errors = errors;
  }

  public static create(isValid: boolean, warnings: string[], errors: string[]): TransactionValidation {
    return new TransactionValidation(isValid, warnings, errors);
  }

  public static valid(): TransactionValidation {
    return new TransactionValidation(true, [], []);
  }

  public static invalid(errors: string[], warnings: string[] = []): TransactionValidation {
    return new TransactionValidation(false, warnings, errors);
  }

  public hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  public hasErrors(): boolean {
    return this.errors.length > 0;
  }

  public toJSON(): ValidationResult {
    return {
      isValid: this.isValid,
      warnings: this.warnings,
      errors: this.errors,
    };
  }
}
