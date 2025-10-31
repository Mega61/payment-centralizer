# Testing Guide: Bank Transaction Validation

This guide shows how to test your deployed Cloud Functions for validating bank transaction confirmations, specifically optimized for Colombian banks (Bancolombia, Davivienda, etc.).

## Prerequisites

Before testing, ensure you have:

1. **Google Cloud SDK installed and configured**
   ```powershell
   # Check if gcloud is installed
   gcloud --version

   # If not installed, download from:
   # https://cloud.google.com/sdk/docs/install

   # Initialize gcloud (if not already done)
   gcloud init

   # Authenticate
   gcloud auth login
   gcloud auth application-default login
   ```

2. **Python 3.x installed** (for parsing transaction results)
   ```powershell
   python --version
   ```

3. **PowerShell** (Windows users already have this)

4. **Access to the GCP project** with appropriate permissions

### Troubleshooting Prerequisites

**Issue: "gcloud: command not found" or "gcloud is not recognized"**

Solution:
```powershell
# Option 1: Install Google Cloud SDK
# Download and install from: https://cloud.google.com/sdk/docs/install
# Then restart PowerShell

# Option 2: Add gcloud to PATH (if already installed)
# Find installation path (usually C:\Users\<username>\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin)
# Add to PATH environment variable

# Option 3: Use manual token (temporary workaround)
# In a terminal where gcloud works, run:
gcloud auth print-identity-token

# Copy the token and pass it to the script:
.\test_http_function.ps1 "image.jpg" -Token "your-token-here"
```

## Quick Start

```powershell
# Test with a local image file
.\test_http_function.ps1 "C:\path\to\transaction_receipt.jpg"

# Or test with GCS upload
gcloud storage cp "transaction.jpg" gs://vision-input-398862077343/
Start-Sleep -Seconds 10
gcloud storage cat gs://vision-annotations-398862077343/transaction.jpg.json | Out-File result.json
python parse_transaction.py result.json
```

## What Was Deployed

✅ **Cloud Function Endpoints:**
- HTTP Function: `https://annotate-http-crxay6pfoa-uc.a.run.app` (requires authentication)
- GCS Event Function: Triggered by uploads to `gs://vision-input-398862077343`

✅ **Vision API Features (Updated for Bank Transactions):**
- `DOCUMENT_TEXT_DETECTION` - Structured document OCR
- `TEXT_DETECTION` - General text extraction
- `LABEL_DETECTION` - Document type classification
- `LOGO_DETECTION` - Bank logo recognition

✅ **Storage Buckets:**
- Input: `gs://vision-input-398862077343`
- Annotations: `gs://vision-annotations-398862077343`
- Code: `gs://vision-code-398862077343`

## Colombian Bank Transaction Support

The parser now supports:

### Currency Formats
- **Colombian Pesos**: `COP51.558,00` (period for thousands, comma for decimals)
- **US Dollars**: `$1,234.56` or `USD 1,234.56`

### Transaction Types (Spanish & English)
- **Purchase/Compraste**: Credit/debit card purchases
- **Transfer/Transferiste**: Wire transfers, ACH
- **Withdrawal/Retiraste**: ATM withdrawals, cash advances
- **Deposit/Depositaste**: Account deposits
- **Payment/Pagaste**: Bill payments

### Card Types
- **T.Cred**: Tarjeta de Crédito (Credit Card)
- **T.Deb**: Tarjeta de Débito (Debit Card)

### Supported Banks
**Colombian:**
- Bancolombia, Davivienda, BBVA Colombia
- Banco de Bogotá, Banco de Occidente, Banco Popular
- Banco AV Villas, Banco Caja Social, Bancoomeva
- Colpatria, Itaú

**International:**
- Chase, Bank of America, Wells Fargo, Citibank
- Capital One, US Bank, PNC, Santander, TD Bank

## Example: Bancolombia Transaction

Your deployment successfully extracted this information from a real Bancolombia transaction notification:

```json
{
  "transaction_type": "PURCHASE",
  "bank": "Bancolombia",
  "merchant": "EXITO SABANETA",
  "amount": {
    "amount": 51558.0,
    "currency": "COP",
    "formatted": "COP 51.558,00"
  },
  "date": "28/10/2025",
  "time": "20:33",
  "card": {
    "type": "Credit Card",
    "last4": "9095"
  }
}
```

## Testing Scripts

### 1. HTTP Function Test (PowerShell)

```powershell
# test_http_function.ps1
# Sends a local image to the HTTP function with authentication

.\test_http_function.ps1 "C:\path\to\transaction.jpg"
```

### 2. GCS URI Test (PowerShell)

```powershell
# test_gcs_uri.ps1
# Tests with an image already in GCS

.\test_gcs_uri.ps1 gs://vision-input-398862077343/transaction.jpg
```

### 3. Batch Processing (PowerShell)

```powershell
# batch_process.ps1
# Processes a folder of transaction images

.\batch_process.ps1 "C:\path\to\transaction_folder"
```

### 4. Transaction Parser (Python)

```python
# parse_transaction.py
# Extracts transaction details from Vision API results

python parse_transaction.py result.json
```

## Authentication

Since your function requires authentication (due to organization policy), you need a valid access token.

**The test scripts automatically handle authentication** by retrieving a token from gcloud. You don't need to manually get a token unless:
- gcloud is not installed or not in your PATH
- You want to use a specific token

### Automatic Authentication (Recommended)

The test scripts will automatically get a fresh token:

```powershell
# Just run the script - it handles authentication automatically
.\test_http_function.ps1 "transaction.jpg"
```

### Manual Authentication (If needed)

If you need to manually get a token:

```powershell
# Get authentication token
$TOKEN = gcloud auth print-identity-token

# Pass it to the script
.\test_http_function.ps1 "transaction.jpg" -Token $TOKEN
```

**Note**: Access tokens expire after 1 hour. The automatic method always gets a fresh token, eliminating expiration issues.

## Testing Workflow

### Option 1: HTTP Endpoint (Real-time)

```powershell
# 1. Test with local image (authentication is automatic)
.\test_http_function.ps1 "transaction_receipt.jpg"

# 2. Parse results (if script doesn't auto-parse)
python parse_transaction.py result.json
```

### Option 2: GCS Event-Driven (Recommended)

```powershell
# 1. Upload transaction image
gcloud storage cp "wire_transfer.jpg" gs://vision-input-398862077343/transactions/

# 2. Wait for processing
Start-Sleep -Seconds 10

# 3. Download results
gcloud storage cp gs://vision-annotations-398862077343/transactions/wire_transfer.jpg.json ./

# 4. Parse transaction details
python parse_transaction.py wire_transfer.jpg.json
```

### Option 3: Batch Processing

```powershell
# Process multiple transaction images at once
.\batch_process.ps1 "C:\Transactions\October2025"
```

## What the Parser Extracts

The `parse_transaction.py` script extracts:

1. **Transaction Type**: Purchase, transfer, withdrawal, deposit, payment
2. **Amount(s)**: With currency code (COP, USD, etc.)
3. **Date(s)**: Transaction date
4. **Time**: Transaction time (if available)
5. **Merchant**: Store or business name
6. **Bank**: Detected bank from logo or text
7. **Card Info**: Card type and last 4 digits
8. **Reference Numbers**: Transaction IDs, confirmation codes
9. **Account Numbers**: Last 4 digits (if shown)

## Validation Rules

The parser validates transactions and warns about:

- ⚠️ No amounts detected (ERROR - transaction invalid)
- ⚠️ No dates detected (WARNING)
- ⚠️ Unknown transaction type (WARNING)
- ⚠️ No reference numbers (WARNING)
- ⚠️ Multiple amounts detected (WARNING - possible duplicate or multi-item receipt)

## Sample Output

```
============================================================
TRANSACTION ANALYSIS RESULTS
============================================================

Transaction Type: PURCHASE

Detected Banks: Bancolombia

Merchant: EXITO SABANETA

Amounts Detected:
  COP 51.558,00 (COP)

Dates:
  28/10/2025

Time: 20:33

Card: Credit Card ending in 9095

------------------------------------------------------------
VALIDATION RESULTS
------------------------------------------------------------
Status: VALID

Warnings:
  - No reference numbers detected

============================================================
```

## Monitoring

### View Function Logs

```powershell
# HTTP function logs
gcloud functions logs read annotate-http --region=us-central1 --limit=50

# GCS function logs
gcloud functions logs read annotate_gcs --region=us-central1 --limit=50

# Follow logs in real-time
gcloud functions logs read annotate_gcs --region=us-central1 --follow
```

### Check Function Status

```powershell
# List all functions
gcloud functions list --region=us-central1

# Get detailed info
gcloud functions describe annotate-http --region=us-central1 --gen2
```

### View Bucket Contents

```powershell
# List uploaded images
gcloud storage ls gs://vision-input-398862077343/ --recursive

# List annotation results
gcloud storage ls gs://vision-annotations-398862077343/ --recursive
```

## Security Best Practices

### For Testing
1. **Never upload real sensitive data** - Use redacted or test transactions
2. **Blur account numbers** - Keep only last 4 digits visible
3. **Remove personal info** - Names, addresses, full account numbers

### For Production
1. **Enable VPC Service Controls** for data isolation
2. **Implement data retention policies** - Auto-delete after processing
3. **Enable Cloud Audit Logs** for compliance
4. **Use Customer-Managed Encryption Keys (CMEK)** for GCS buckets
5. **Set up DLP (Data Loss Prevention)** to detect and redact sensitive data

## Troubleshooting

### Issue: "gcloud is not recognized" Error

**Cause**: Google Cloud SDK is not installed or not in your PATH.

**Solution**:

1. **Install Google Cloud SDK** (if not installed):
   - Download from: https://cloud.google.com/sdk/docs/install
   - Run the installer
   - Restart PowerShell after installation

2. **Add to PATH** (if already installed):
   - Find the gcloud installation directory (usually `C:\Users\<username>\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin`)
   - Add it to your PATH environment variable
   - Restart PowerShell

3. **Temporary workaround** (use manual token):
   ```powershell
   # In a terminal where gcloud works (e.g., Git Bash, Cloud Shell), run:
   gcloud auth print-identity-token

   # Copy the token and use it with the script:
   .\test_http_function.ps1 "image.jpg" -Token "eyJhbGci...your-token-here"
   ```

### Issue: "Unauthenticated" or "401 Unauthorized" Error

**Cause**: No valid authentication token or token has expired (tokens expire after 1 hour).

**Solution**: Authenticate with gcloud and get a fresh token

```powershell
# Authenticate (if not already done)
gcloud auth login

# The test scripts will automatically get a fresh token
# Or get token manually:
$TOKEN = gcloud auth print-identity-token

# Use with script:
.\test_http_function.ps1 "image.jpg" -Token $TOKEN
```

### Issue: Function Not Triggered

**Solution**: Check function logs
```powershell
gcloud functions logs read annotate_gcs --region=us-central1 --limit=20
```

### Issue: Poor Text Extraction

**Solution**:
- Ensure image is clear and high resolution (min 640x480)
- Avoid blurry or low-light photos
- Ensure text is not too small (min 12pt equivalent)

### Issue: Wrong Amount Format

**Solution**: The parser now handles both:
- Colombian: `COP51.558,00` (period for thousands)
- US: `$1,234.56` (comma for thousands)

## Integration Options

### REST API (Real-time)
Your application calls the HTTP function directly:
```python
import requests

response = requests.post(
    "https://annotate-http-crxay6pfoa-uc.a.run.app/annotate",
    headers={"Authorization": f"Bearer {token}"},
    json={"image": {"content": base64_image}}
)
```

### Event-Driven (Async)
Upload to GCS, results appear automatically:
```python
from google.cloud import storage

client = storage.Client()
bucket = client.bucket('vision-input-398862077343')
blob = bucket.blob('transactions/tx_001.jpg')
blob.upload_from_filename('transaction.jpg')

# Results will appear in vision-annotations-398862077343/transactions/tx_001.jpg.json
```

### Direct GCS Upload (Mobile Apps)
Generate signed URLs for mobile apps to upload directly:
```python
from google.cloud import storage
from datetime import timedelta

bucket = storage.Client().bucket('vision-input-398862077343')
blob = bucket.blob('user_uploads/tx_123.jpg')

url = blob.generate_signed_url(
    version="v4",
    expiration=timedelta(minutes=15),
    method="PUT"
)
# Give this URL to your mobile app for direct upload
```

## Next Steps

1. **Test with your own transaction images** using the provided scripts
2. **Integrate the HTTP endpoint** into your application
3. **Set up monitoring** and alerts for production
4. **Implement data retention policies** to auto-delete processed images
5. **Add custom validation logic** for your specific use case

## Support

For issues or questions:
- Check function logs: `gcloud functions logs read annotate_gcs --region=us-central1`
- Review Cloud Console: https://console.cloud.google.com/functions
- Test Vision API directly: https://console.cloud.google.com/vision

---

**Deployment Date**: 2025-10-30
**Project**: andante-payment-centralizer
**Region**: us-central1
