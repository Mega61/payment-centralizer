project_id = "andante-payment-centralizer"  # Your project ID
region     = "us-central1"                   # Your preferred region
gcf_require_http_authentication = true

# Vision API features optimized for bank transaction validation
# DOCUMENT_TEXT_DETECTION: Extract text from structured documents
# TEXT_DETECTION: General text extraction (fallback)
# LABEL_DETECTION: Identify document types (receipt, invoice, etc.)
# LOGO_DETECTION: Detect bank logos for authenticity verification
gcf_annotation_features = "DOCUMENT_TEXT_DETECTION,TEXT_DETECTION,LABEL_DETECTION,LOGO_DETECTION"