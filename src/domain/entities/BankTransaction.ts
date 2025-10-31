import { TransactionType } from '@shared/types/index.js';
import { Amount } from '@domain/value-objects/Amount.js';
import { CardInfo } from '@domain/value-objects/CardInfo.js';

export interface BankTransactionProps {
  id?: string;
  rawText: string;
  amounts: Amount[];
  dates: string[];
  time?: string;
  merchant?: string;
  cardInfo?: CardInfo;
  referenceNumbers: string[];
  accountNumbers: string[];
  transactionType: TransactionType;
  banks: string[];
  documentLabels: string[];
  createdAt?: Date;
}

export class BankTransaction {
  public readonly id: string;
  public readonly rawText: string;
  public readonly amounts: Amount[];
  public readonly dates: string[];
  public readonly time?: string;
  public readonly merchant?: string;
  public readonly cardInfo?: CardInfo;
  public readonly referenceNumbers: string[];
  public readonly accountNumbers: string[];
  public readonly transactionType: TransactionType;
  public readonly banks: string[];
  public readonly documentLabels: string[];
  public readonly createdAt: Date;

  private constructor(props: BankTransactionProps) {
    this.id = props.id ?? this.generateId();
    this.rawText = props.rawText;
    this.amounts = props.amounts;
    this.dates = props.dates;
    this.time = props.time;
    this.merchant = props.merchant;
    this.cardInfo = props.cardInfo;
    this.referenceNumbers = props.referenceNumbers;
    this.accountNumbers = props.accountNumbers;
    this.transactionType = props.transactionType;
    this.banks = props.banks;
    this.documentLabels = props.documentLabels;
    this.createdAt = props.createdAt ?? new Date();
  }

  public static create(props: BankTransactionProps): BankTransaction {
    return new BankTransaction(props);
  }

  private generateId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  public getPrimaryAmount(): Amount | undefined {
    return this.amounts[0];
  }

  public hasValidAmount(): boolean {
    return this.amounts.length > 0;
  }

  public hasValidDate(): boolean {
    return this.dates.length > 0;
  }

  public isTypeKnown(): boolean {
    return this.transactionType !== TransactionType.UNKNOWN;
  }

  public hasReferenceNumber(): boolean {
    return this.referenceNumbers.length > 0;
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      rawText: this.rawText,
      amounts: this.amounts.map((amount) => amount.toJSON()),
      dates: this.dates,
      time: this.time,
      merchant: this.merchant,
      cardInfo: this.cardInfo?.toJSON(),
      referenceNumbers: this.referenceNumbers,
      accountNumbers: this.accountNumbers,
      transactionType: this.transactionType,
      banks: this.banks,
      documentLabels: this.documentLabels,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
