#!/usr/bin/env python3
"""
Parse bank transaction details from Vision API annotation results.
Usage: python parse_transaction.py <annotation-file.json>
"""

import json
import re
import sys
from datetime import datetime
from typing import Dict, List, Optional

# Colombian banks that use COP as default currency
COLOMBIAN_BANKS = {
    'bancolombia', 'davivienda', 'bbva colombia', 'banco de bogotá',
    'banco de occidente', 'banco popular', 'banco av villas',
    'banco caja social', 'bancoomeva', 'colpatria', 'itaú'
}

def extract_text_from_annotations(annotations: Dict) -> str:
    """Extract full text from Vision API response."""
    if 'textAnnotations' in annotations and annotations['textAnnotations']:
        # First annotation contains full detected text
        return annotations['textAnnotations'][0].get('description', '')
    return ''

def extract_amounts(text: str, banks: List[str] = None) -> List[Dict]:
    """Extract monetary amounts from text with currency info.

    Args:
        text: Text to extract amounts from
        banks: List of detected bank names (used to determine default currency)

    Returns:
        List of amount dictionaries with amount, currency, and formatted fields
    """
    amounts = []

    # Determine if this is from a Colombian bank
    is_colombian_bank = False
    if banks:
        is_colombian_bank = any(bank.lower() in COLOMBIAN_BANKS for bank in banks)

    # Priority 1: Explicit COP format: COP51.558,00 or COP 51.558,00
    # Uses period (.) for thousands, comma (,) for decimals
    cop_pattern = r'COP\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)'
    cop_matches = re.findall(cop_pattern, text, re.IGNORECASE)
    for match in cop_matches:
        try:
            # Convert Colombian format to float: remove periods, replace comma with period
            amount_str = match.replace('.', '').replace(',', '.')
            amount = float(amount_str)
            amounts.append({
                'amount': amount,
                'currency': 'COP',
                'formatted': f"COP {amount:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            })
        except ValueError:
            continue

    # Priority 2: Explicit USD format: USD 1,234.56
    # Uses comma (,) for thousands, period (.) for decimals
    usd_pattern = r'USD\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)'
    usd_matches = re.findall(usd_pattern, text, re.IGNORECASE)
    for match in usd_matches:
        try:
            # Remove commas and convert to float
            amount = float(match.replace(',', ''))
            amounts.append({
                'amount': amount,
                'currency': 'USD',
                'formatted': f"USD {amount:,.2f}"
            })
        except ValueError:
            continue

    # Priority 3: Dollar sign ($) - format depends on bank origin
    dollar_sign_pattern = r'\$\s*(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})?)'
    dollar_matches = re.findall(dollar_sign_pattern, text)

    for match in dollar_matches:
        try:
            if is_colombian_bank:
                # Colombian format: $ 200.000 or $ 200.000,00
                # Period for thousands, optional comma for decimals
                if '.' in match and ',' in match:
                    # Has both: $ 200.000,00 (200 thousand with cents)
                    amount_str = match.replace('.', '').replace(',', '.')
                elif '.' in match:
                    # Only periods: $ 200.000 (200 thousand, no cents)
                    # Count periods to determine if it's thousands separator
                    if match.count('.') >= 1 and len(match.split('.')[-1]) == 3:
                        # Likely thousands separator: 200.000
                        amount_str = match.replace('.', '')
                    else:
                        # Likely decimal: 200.50
                        amount_str = match
                else:
                    # No separators or only comma
                    amount_str = match.replace(',', '.')

                amount = float(amount_str)
                amounts.append({
                    'amount': amount,
                    'currency': 'COP',
                    'formatted': f"$ {amount:,.0f}".replace(',', '.')
                })
            else:
                # US format: $1,234.56
                # Comma for thousands, period for decimals
                amount = float(match.replace(',', ''))
                amounts.append({
                    'amount': amount,
                    'currency': 'USD',
                    'formatted': f"${amount:,.2f}"
                })
        except ValueError:
            continue

    # Priority 4: If no currency specified, try Colombian format without prefix
    if not amounts:
        # Try Colombian format: 200.000,00 or 200.000
        general_cop = r'(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)'
        matches = re.findall(general_cop, text)
        for match in matches:
            try:
                amount_str = match.replace('.', '').replace(',', '.')
                amount = float(amount_str)
                # If Colombian bank detected, default to COP
                currency = 'COP' if is_colombian_bank else 'UNKNOWN'
                amounts.append({
                    'amount': amount,
                    'currency': currency,
                    'formatted': match
                })
            except ValueError:
                continue

    return amounts

def extract_dates(text: str) -> List[str]:
    """Extract dates from text."""
    # Common date patterns
    patterns = [
        r'\d{1,2}/\d{1,2}/\d{2,4}',  # MM/DD/YYYY or DD/MM/YYYY
        r'\d{4}-\d{2}-\d{2}',          # YYYY-MM-DD
        r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}',  # Month DD, YYYY
    ]

    dates = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        dates.extend(matches)

    return dates

def extract_reference_numbers(text: str) -> List[str]:
    """Extract transaction/confirmation reference numbers."""
    # Pattern for common reference number formats
    patterns = [
        r'(?:REF|REFERENCE|CONFIRMATION|TRANSACTION)\s*(?:NO|NUMBER|#)?:?\s*([A-Z0-9-]+)',
        r'\b[A-Z]{2,}\d{6,}\b',  # Alphanumeric codes like ABC123456
    ]

    references = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        references.extend(matches)

    return references

def extract_account_numbers(text: str) -> List[str]:
    """Extract account numbers (last 4 digits only for security)."""
    # Pattern for account numbers (typically shown as ****1234)
    patterns = [
        r'\*{4,}(\d{4})',
        r'(?:ACCOUNT|ACCT)\s*(?:NO|NUMBER|#)?:?\s*\**(\d{4})',
    ]

    accounts = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        accounts.extend(matches)

    return accounts

def extract_merchant(text: str) -> Optional[str]:
    """Extract merchant name from transaction text."""
    # Colombian format: "Compraste COP... en MERCHANT con..."
    # English format: "Purchase at MERCHANT"
    patterns = [
        r'en\s+([A-Z][A-Z\s]+?)(?:\s+con\s+)',  # Spanish: "en EXITO SABANETA con"
        r'at\s+([A-Z][A-Z\s]+?)(?:\s|$)',        # English: "at STORE NAME"
        r'@\s*([A-Z][A-Z\s]+?)(?:\s|$)',         # "@MERCHANT"
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            merchant = match.group(1).strip()
            # Clean up excessive spaces
            merchant = re.sub(r'\s+', ' ', merchant)
            return merchant

    return None

def extract_card_info(text: str) -> Optional[Dict]:
    """Extract card type and last 4 digits."""
    # Colombian format: "T.Cred *9095" or "T.Deb *1234"
    # English format: "Card *1234" or "Credit *9095"
    patterns = [
        r'(T\.Cred|T\.Deb|Tarjeta)\s*\*(\d{4})',  # Colombian
        r'(Credit|Debit|Card)\s*\*(\d{4})',        # English
        r'\*(\d{4})',                               # Just last 4 digits
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            if len(match.groups()) == 2:
                card_type = match.group(1)
                # Translate Colombian card types
                if 'T.Cred' in card_type or 'Tarjeta' in card_type:
                    card_type = 'Credit Card'
                elif 'T.Deb' in card_type:
                    card_type = 'Debit Card'
                return {
                    'type': card_type,
                    'last4': match.group(2)
                }
            else:
                return {
                    'type': 'Unknown',
                    'last4': match.group(1)
                }

    return None

def extract_time(text: str) -> Optional[str]:
    """Extract time from transaction text."""
    # Patterns: 20:33, 8:33 PM, etc.
    patterns = [
        r'\b([0-2]?\d):([0-5]\d)\s*(AM|PM|am|pm)?\b',
        r'a\s+las\s+([0-2]?\d):([0-5]\d)',  # Spanish: "a las 20:33"
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            hour = match.group(1)
            minute = match.group(2)
            meridiem = match.group(3) if len(match.groups()) >= 3 else ''
            return f"{hour}:{minute} {meridiem}".strip()

    return None

def detect_transaction_type(text: str) -> Optional[str]:
    """Detect the type of transaction (English and Spanish)."""
    text_lower = text.lower()

    # Spanish keywords
    if any(keyword in text_lower for keyword in ['compraste', 'compra', 'purchase']):
        return 'PURCHASE'
    elif any(keyword in text_lower for keyword in ['transferiste', 'transferencia', 'wire transfer', 'wire']):
        return 'WIRE_TRANSFER'
    elif any(keyword in text_lower for keyword in ['retiraste', 'retiro', 'withdrawal', 'withdraw', 'atm']):
        return 'WITHDRAWAL'
    elif any(keyword in text_lower for keyword in ['depositaste', 'depósito', 'deposit', 'deposited']):
        return 'DEPOSIT'
    elif any(keyword in text_lower for keyword in ['pagaste', 'pago', 'payment', 'paid']):
        return 'PAYMENT'
    elif any(keyword in text_lower for keyword in ['ach', 'electronic transfer']):
        return 'ACH_TRANSFER'

    return 'UNKNOWN'

def extract_bank_names(annotations: Dict) -> List[str]:
    """Extract bank names from logo detection."""
    banks = []

    # From logo detection
    if 'logoAnnotations' in annotations:
        for logo in annotations['logoAnnotations']:
            banks.append(logo.get('description', ''))

    # From text (common bank names - Colombian and International)
    if 'textAnnotations' in annotations and annotations['textAnnotations']:
        text = annotations['textAnnotations'][0].get('description', '')
        common_banks = [
            # Colombian Banks
            'Bancolombia', 'Davivienda', 'BBVA Colombia', 'Banco de Bogotá',
            'Banco de Occidente', 'Banco Popular', 'Banco AV Villas',
            'Banco Caja Social', 'Bancoomeva', 'Colpatria', 'Itaú',
            # International Banks
            'Chase', 'Bank of America', 'Wells Fargo', 'Citibank', 'Capital One',
            'US Bank', 'PNC', 'TD Bank', 'Truist', 'Fifth Third', 'Santander'
        ]
        for bank in common_banks:
            if bank.lower() in text.lower():
                banks.append(bank)

    return list(set(banks))  # Remove duplicates

def parse_transaction(annotation_file: str) -> Dict:
    """Parse transaction details from Vision API annotation file."""
    with open(annotation_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Handle different response structures
    annotations = data
    if 'responses' in data and data['responses']:
        annotations = data['responses'][0]

    # Extract full text
    full_text = extract_text_from_annotations(annotations)

    # Extract bank names FIRST (needed for currency detection)
    banks = extract_bank_names(annotations)

    # Parse transaction details (pass banks to extract_amounts for currency context)
    transaction = {
        'raw_text': full_text,
        'amounts': extract_amounts(full_text, banks),  # Pass banks for currency detection
        'dates': extract_dates(full_text),
        'time': extract_time(full_text),
        'merchant': extract_merchant(full_text),
        'card_info': extract_card_info(full_text),
        'reference_numbers': extract_reference_numbers(full_text),
        'account_numbers': extract_account_numbers(full_text),
        'transaction_type': detect_transaction_type(full_text),
        'banks': banks,
        'document_labels': [],
    }

    # Add document labels if available
    if 'labelAnnotations' in annotations:
        transaction['document_labels'] = [
            label.get('description', '')
            for label in annotations['labelAnnotations'][:5]  # Top 5 labels
        ]

    return transaction

def validate_transaction(transaction: Dict) -> Dict:
    """Validate extracted transaction data."""
    validation = {
        'is_valid': True,
        'warnings': [],
        'errors': []
    }

    # Check for required fields
    if not transaction['amounts']:
        validation['errors'].append('No monetary amounts detected')
        validation['is_valid'] = False

    if not transaction['dates']:
        validation['warnings'].append('No dates detected')

    if transaction['transaction_type'] == 'UNKNOWN':
        validation['warnings'].append('Could not determine transaction type')

    if not transaction['reference_numbers']:
        validation['warnings'].append('No reference numbers detected')

    # Check for suspicious patterns
    if len(transaction['amounts']) > 5:
        validation['warnings'].append(f'Multiple amounts detected ({len(transaction["amounts"])})')

    if validation['errors']:
        validation['is_valid'] = False

    return validation

def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_transaction.py <annotation-file.json>")
        sys.exit(1)

    annotation_file = sys.argv[1]

    try:
        # Parse transaction
        transaction = parse_transaction(annotation_file)

        # Validate
        validation = validate_transaction(transaction)

        # Output results
        print("\n" + "="*60)
        print("TRANSACTION ANALYSIS RESULTS")
        print("="*60)

        print(f"\nTransaction Type: {transaction['transaction_type']}")

        if transaction['banks']:
            print(f"\nDetected Banks: {', '.join(transaction['banks'])}")

        if transaction['merchant']:
            print(f"\nMerchant: {transaction['merchant']}")

        if transaction['amounts']:
            print(f"\nAmounts Detected:")
            for amount_info in transaction['amounts']:
                print(f"  {amount_info['formatted']} ({amount_info['currency']})")

        if transaction['dates']:
            print(f"\nDates:")
            for date in transaction['dates']:
                print(f"  {date}")

        if transaction['time']:
            print(f"\nTime: {transaction['time']}")

        if transaction['card_info']:
            card = transaction['card_info']
            print(f"\nCard: {card['type']} ending in {card['last4']}")

        if transaction['reference_numbers']:
            print(f"\nReference Numbers:")
            for ref in transaction['reference_numbers']:
                print(f"  {ref}")

        if transaction['account_numbers']:
            print(f"\nAccount Numbers (last 4 digits):")
            for acct in transaction['account_numbers']:
                print(f"  ****{acct}")

        if transaction['document_labels']:
            print(f"\nDocument Labels: {', '.join(transaction['document_labels'])}")

        print("\n" + "-"*60)
        print("VALIDATION RESULTS")
        print("-"*60)
        print(f"Status: {'VALID' if validation['is_valid'] else 'INVALID'}")

        if validation['warnings']:
            print("\nWarnings:")
            for warning in validation['warnings']:
                print(f"  - {warning}")

        if validation['errors']:
            print("\nErrors:")
            for error in validation['errors']:
                print(f"  - {error}")

        print("\n" + "="*60)

        # Save parsed data
        output_file = annotation_file.replace('.json', '_parsed.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                'transaction': transaction,
                'validation': validation
            }, f, indent=2)

        print(f"\nParsed data saved to: {output_file}")

    except Exception as e:
        print(f"Error parsing transaction: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
