import { injectable } from 'tsyringe';
import { OCRResult } from '@domain/entities/OCRResult.js';
import { BankTransaction } from '@domain/entities/BankTransaction.js';
import { TransactionValidation } from '@domain/entities/TransactionValidation.js';
import { Amount } from '@domain/value-objects/Amount.js';
import { CardInfo } from '@domain/value-objects/CardInfo.js';
import { TransactionType, Currency, CardType } from '@shared/types/index.js';
import type { Logger } from 'winston';

const COLOMBIAN_BANKS = new Set([
  'bancolombia',
  'davivienda',
  'bbva colombia',
  'banco de bogotá',
  'banco de occidente',
  'banco popular',
  'banco av villas',
  'banco caja social',
  'bancoomeva',
  'colpatria',
  'itaú',
]);

@injectable()
export class ParseTransactionUseCase {
  constructor(private readonly logger: Logger) {}

  public execute(ocrResult: OCRResult): {
    transaction: BankTransaction;
    validation: TransactionValidation;
  } {
    const fullText = ocrResult.extractFullText();
    const logos = ocrResult.extractLogos();
    const banks = this.extractBankNames(fullText, logos);

    this.logger.info('Parsing transaction', {
      ocrResultId: ocrResult.id,
      textLength: fullText.length,
      banksDetected: banks.length,
    });

    const amounts = this.extractAmounts(fullText, banks);
    const dates = this.extractDates(fullText);
    const time = this.extractTime(fullText);
    const merchant = this.extractMerchant(fullText);
    const cardInfo = this.extractCardInfo(fullText);
    const referenceNumbers = this.extractReferenceNumbers(fullText);
    const accountNumbers = this.extractAccountNumbers(fullText);
    const transactionType = this.detectTransactionType(fullText);
    const documentLabels = ocrResult.extractLabels(5);

    const transaction = BankTransaction.create({
      rawText: fullText,
      amounts,
      dates,
      time,
      merchant,
      cardInfo,
      referenceNumbers,
      accountNumbers,
      transactionType,
      banks,
      documentLabels,
    });

    const validation = this.validateTransaction(transaction);

    this.logger.info('Transaction parsed successfully', {
      transactionId: transaction.id,
      isValid: validation.isValid,
      warningsCount: validation.warnings.length,
      errorsCount: validation.errors.length,
    });

    return { transaction, validation };
  }

  private extractAmounts(text: string, banks: string[]): Amount[] {
    const amounts: Amount[] = [];
    const isColombianBank = banks.some((bank) => COLOMBIAN_BANKS.has(bank.toLowerCase()));

    // Priority 1: Explicit COP format
    const copPattern = /COP\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi;
    const copMatches = text.matchAll(copPattern);
    for (const match of copMatches) {
      try {
        const amountStr = match[1]?.replace(/\./g, '').replace(',', '.') ?? '';
        const value = parseFloat(amountStr);
        if (!isNaN(value)) {
          amounts.push(Amount.create(value, Currency.COP));
        }
      } catch {
        continue;
      }
    }

    // Priority 2: Explicit USD format
    const usdPattern = /USD\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi;
    const usdMatches = text.matchAll(usdPattern);
    for (const match of usdMatches) {
      try {
        const amountStr = match[1]?.replace(/,/g, '') ?? '';
        const value = parseFloat(amountStr);
        if (!isNaN(value)) {
          amounts.push(Amount.create(value, Currency.USD));
        }
      } catch {
        continue;
      }
    }

    // Priority 3: Dollar sign ($)
    const dollarPattern = /\$\s*(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})?)/g;
    const dollarMatches = text.matchAll(dollarPattern);
    for (const match of dollarMatches) {
      try {
        const matchStr = match[1] ?? '';
        let value: number;
        let currency: Currency;

        if (isColombianBank) {
          // Colombian format
          if (matchStr.includes('.') && matchStr.includes(',')) {
            value = parseFloat(matchStr.replace(/\./g, '').replace(',', '.'));
          } else if (matchStr.includes('.')) {
            const parts = matchStr.split('.');
            if (parts.length > 0 && parts[parts.length - 1]?.length === 3) {
              value = parseFloat(matchStr.replace(/\./g, ''));
            } else {
              value = parseFloat(matchStr);
            }
          } else {
            value = parseFloat(matchStr.replace(',', '.'));
          }
          currency = Currency.COP;
        } else {
          // US format
          value = parseFloat(matchStr.replace(/,/g, ''));
          currency = Currency.USD;
        }

        if (!isNaN(value)) {
          amounts.push(Amount.create(value, currency));
        }
      } catch {
        continue;
      }
    }

    // Priority 4: Colombian format without currency prefix
    if (amounts.length === 0) {
      const generalCopPattern = /(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)/g;
      const matches = text.matchAll(generalCopPattern);
      for (const match of matches) {
        try {
          const amountStr = match[1]?.replace(/\./g, '').replace(',', '.') ?? '';
          const value = parseFloat(amountStr);
          if (!isNaN(value)) {
            const currency = isColombianBank ? Currency.COP : Currency.UNKNOWN;
            amounts.push(Amount.create(value, currency));
          }
        } catch {
          continue;
        }
      }
    }

    return amounts;
  }

  private extractDates(text: string): string[] {
    const dates: string[] = [];
    const patterns = [
      /\d{1,2}\/\d{1,2}\/\d{2,4}/g,
      /\d{4}-\d{2}-\d{2}/g,
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}/gi,
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        dates.push(match[0] ?? '');
      }
    }

    return dates;
  }

  private extractTime(text: string): string | undefined {
    const patterns = [
      /\b([0-2]?\d):([0-5]\d)\s*(AM|PM|am|pm)?\b/,
      /a\s+las\s+([0-2]?\d):([0-5]\d)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const hour = match[1];
        const minute = match[2];
        const meridiem = match[3] ?? '';
        return `${hour}:${minute} ${meridiem}`.trim();
      }
    }

    return undefined;
  }

  private extractMerchant(text: string): string | undefined {
    const patterns = [
      /en\s+([A-Z][A-Z\s]+?)(?:\s+con\s+)/,
      /at\s+([A-Z][A-Z\s]+?)(?:\s|$)/,
      /@\s*([A-Z][A-Z\s]+?)(?:\s|$)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const merchant = match[1].trim().replace(/\s+/g, ' ');
        return merchant;
      }
    }

    return undefined;
  }

  private extractCardInfo(text: string): CardInfo | undefined {
    const patterns = [
      /(T\.Cred|T\.Deb|Tarjeta)\s*\*(\d{4})/i,
      /(Credit|Debit|Card)\s*\*(\d{4})/i,
      /\*(\d{4})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (match.length === 3 && match[1] && match[2]) {
          let cardType: CardType;
          const typeStr = match[1].toLowerCase();
          if (typeStr.includes('cred') || typeStr === 'credit') {
            cardType = CardType.CREDIT;
          } else if (typeStr.includes('deb') || typeStr === 'debit') {
            cardType = CardType.DEBIT;
          } else {
            cardType = CardType.UNKNOWN;
          }
          return CardInfo.create(cardType, match[2]);
        } else if (match[1]) {
          return CardInfo.create(CardType.UNKNOWN, match[1]);
        }
      }
    }

    return undefined;
  }

  private extractReferenceNumbers(text: string): string[] {
    const references: string[] = [];
    const patterns = [
      /(?:REF|REFERENCE|CONFIRMATION|TRANSACTION)\s*(?:NO|NUMBER|#)?:?\s*([A-Z0-9-]+)/gi,
      /\b[A-Z]{2,}\d{6,}\b/g,
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          references.push(match[1]);
        } else if (match[0]) {
          references.push(match[0]);
        }
      }
    }

    return references;
  }

  private extractAccountNumbers(text: string): string[] {
    const accounts: string[] = [];
    const patterns = [/\*{4,}(\d{4})/g, /(?:ACCOUNT|ACCT)\s*(?:NO|NUMBER|#)?:?\s*\**(\d{4})/gi];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          accounts.push(match[1]);
        }
      }
    }

    return accounts;
  }

  private detectTransactionType(text: string): TransactionType {
    const textLower = text.toLowerCase();

    if (/compraste|compra|purchase/.test(textLower)) {
      return TransactionType.PURCHASE;
    } else if (/transferiste|transferencia|wire transfer|wire/.test(textLower)) {
      return TransactionType.WIRE_TRANSFER;
    } else if (/retiraste|retiro|withdrawal|withdraw|atm/.test(textLower)) {
      return TransactionType.WITHDRAWAL;
    } else if (/depositaste|depósito|deposit|deposited/.test(textLower)) {
      return TransactionType.DEPOSIT;
    } else if (/pagaste|pago|payment|paid/.test(textLower)) {
      return TransactionType.PAYMENT;
    } else if (/ach|electronic transfer/.test(textLower)) {
      return TransactionType.ACH_TRANSFER;
    }

    return TransactionType.UNKNOWN;
  }

  private extractBankNames(text: string, logos: string[]): string[] {
    const banks = new Set<string>(logos);

    const commonBanks = [
      'Bancolombia',
      'Davivienda',
      'BBVA Colombia',
      'Banco de Bogotá',
      'Banco de Occidente',
      'Banco Popular',
      'Banco AV Villas',
      'Banco Caja Social',
      'Bancoomeva',
      'Colpatria',
      'Itaú',
      'Chase',
      'Bank of America',
      'Wells Fargo',
      'Citibank',
      'Capital One',
      'US Bank',
      'PNC',
      'TD Bank',
      'Truist',
      'Fifth Third',
      'Santander',
    ];

    for (const bank of commonBanks) {
      if (text.toLowerCase().includes(bank.toLowerCase())) {
        banks.add(bank);
      }
    }

    return Array.from(banks);
  }

  private validateTransaction(transaction: BankTransaction): TransactionValidation {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!transaction.hasValidAmount()) {
      errors.push('No monetary amounts detected');
    }

    if (!transaction.hasValidDate()) {
      warnings.push('No dates detected');
    }

    if (!transaction.isTypeKnown()) {
      warnings.push('Could not determine transaction type');
    }

    if (!transaction.hasReferenceNumber()) {
      warnings.push('No reference numbers detected');
    }

    if (transaction.amounts.length > 5) {
      warnings.push(`Multiple amounts detected (${transaction.amounts.length})`);
    }

    const isValid = errors.length === 0;

    return isValid
      ? TransactionValidation.create(true, warnings, errors)
      : TransactionValidation.invalid(errors, warnings);
  }
}
