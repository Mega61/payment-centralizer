import { CardType } from '@shared/types/index.js';

export class CardInfo {
  private constructor(
    public readonly type: CardType,
    public readonly last4: string,
  ) {
    if (!/^\d{4}$/.test(last4)) {
      throw new Error('Card last4 must be exactly 4 digits');
    }
  }

  public static create(type: CardType, last4: string): CardInfo {
    return new CardInfo(type, last4);
  }

  public getMasked(): string {
    return `****${this.last4}`;
  }

  public toJSON(): { type: string; last4: string } {
    return {
      type: this.type,
      last4: this.last4,
    };
  }
}
