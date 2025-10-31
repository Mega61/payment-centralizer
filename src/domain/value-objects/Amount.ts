import { Currency } from '@shared/types/index.js';

export class Amount {
  private constructor(
    public readonly value: number,
    public readonly currency: Currency,
    public readonly formatted: string,
  ) {
    if (value < 0) {
      throw new Error('Amount value cannot be negative');
    }
  }

  public static create(value: number, currency: Currency, formatted?: string): Amount {
    const defaultFormatted = Amount.formatAmount(value, currency);
    return new Amount(value, currency, formatted ?? defaultFormatted);
  }

  private static formatAmount(value: number, currency: Currency): string {
    switch (currency) {
      case Currency.COP:
        // Colombian format: period for thousands, comma for decimals
        return `COP ${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace('.', ',')}`;
      case Currency.USD:
        // US format: comma for thousands, period for decimals
        return `USD ${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
      default:
        return `${value.toFixed(2)}`;
    }
  }

  public equals(other: Amount): boolean {
    return this.value === other.value && this.currency === other.currency;
  }

  public toJSON(): { amount: number; currency: string; formatted: string } {
    return {
      amount: this.value,
      currency: this.currency,
      formatted: this.formatted,
    };
  }
}
