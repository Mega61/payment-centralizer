# Quick Start: Test Your Deployment

Your Cloud Functions are deployed and ready to validate bank transaction confirmations!

## ✅ What's Deployed

- **HTTP Function**: `https://annotate-http-crxay6pfoa-uc.a.run.app`
- **GCS Function**: Processes uploads to `gs://vision-input-398862077343`
- **Vision API**: Configured for OCR and document text extraction
- **Optimized for**: Colombian bank transactions (Bancolombia, Davivienda, etc.)

## 🚀 Test in 3 Steps

### Method 1: Quick Test with Local Image

```powershell
# 1. Test the function
.\test_http_function.ps1 "C:\path\to\transaction_screenshot.jpg"

# 2. Parse the results
python parse_transaction.py result.json
```

### Method 2: GCS Upload (Event-Driven)

```powershell
# 1. Upload your transaction image
gcloud storage cp "transaction.jpg" gs://vision-input-398862077343/

# 2. Wait 10 seconds for processing
Start-Sleep -Seconds 10

# 3. Download and parse results
gcloud storage cat gs://vision-annotations-398862077343/transaction.jpg.json | Out-File result.json
python parse_transaction.py result.json
```

### Method 3: Batch Process Multiple Images

```powershell
.\batch_process.ps1 "C:\folder\with\transaction\images"
```

## 📊 Example Result

Based on your real Bancolombia transaction test:

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
```

## 🇨🇴 Colombian Bank Support

The system recognizes:
- **Currency**: COP format (51.558,00)
- **Language**: Spanish transaction keywords
- **Banks**: Bancolombia, Davivienda, BBVA Colombia, Banco de Bogotá, etc.
- **Cards**: T.Cred (Credit), T.Deb (Debit)

## 🔐 Authentication

Get your access token (required for HTTP function):

```powershell
gcloud auth print-identity-token
```

## 📝 Supported Transaction Types

- ✅ Credit/Debit card purchases (Compraste/Purchase)
- ✅ Wire transfers (Transferiste/Transfer)
- ✅ ATM withdrawals (Retiraste/Withdrawal)
- ✅ Deposits (Depositaste/Deposit)
- ✅ Payments (Pagaste/Payment)

## 🛠️ Available Scripts

| Script | Purpose |
|--------|---------|
| `test_http_function.ps1` | Test HTTP endpoint with local image |
| `test_gcs_uri.ps1` | Test with GCS-hosted image |
| `batch_process.ps1` | Process multiple images at once |
| `parse_transaction.py` | Extract transaction details from results |

## 📚 Full Documentation

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for:
- Detailed testing workflows
- Security best practices
- Troubleshooting guide
- Integration examples
- Monitoring and logs

## ⚠️ Important Notes

1. **Authentication Required**: The HTTP function requires a valid access token
2. **Test Data Only**: Never upload real sensitive financial data for testing
3. **Processing Time**: GCS function takes 5-10 seconds to process images
4. **Image Quality**: Use clear, high-resolution images for best results

## 🎯 Your Use Case: Bank Transaction Validation

This deployment is optimized for validating:
- Bank transaction confirmations
- Wire transfer receipts
- Mobile banking screenshots
- ATM receipts
- Payment confirmations

The parser automatically extracts:
- Transaction amounts (with currency)
- Dates and times
- Merchant names
- Card information (last 4 digits)
- Bank names
- Transaction types

## 🔍 Monitoring

```powershell
# View function logs
gcloud functions logs read annotate_gcs --region=us-central1 --limit=20

# List processed files
gcloud storage ls gs://vision-annotations-398862077343/ --recursive

# Check function status
gcloud functions list --region=us-central1
```

## ✨ Ready to Test!

Start with your first transaction image:

```powershell
.\test_http_function.ps1 "path\to\your\transaction.jpg"
```

---

**Deployment**: andante-payment-centralizer | us-central1
**Status**: ✅ ACTIVE and READY
