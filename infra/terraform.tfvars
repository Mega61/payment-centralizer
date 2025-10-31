project_id = "andante-payment-centralizer"
region     = "us-central1"

# Container image from Artifact Registry
cloudrun_container_image = "us-central1-docker.pkg.dev/andante-payment-centralizer/payment-centralizer/app:latest"

# Scaling configuration
cloudrun_min_instances = 0
cloudrun_max_instances = 10

# Resource allocation
cloudrun_cpu_limit    = "1000m"  # 1 CPU
cloudrun_memory_limit = "512Mi"  # 512 MB

# Timeout
cloudrun_timeout_seconds = 300

# Logging
cloudrun_log_level = "info"

# Vision API features optimized for bank transaction validation
# DOCUMENT_TEXT_DETECTION: Extract text from structured documents
# TEXT_DETECTION: General text extraction (fallback)
# LABEL_DETECTION: Identify document types (receipt, invoice, etc.)
# LOGO_DETECTION: Detect bank logos for authenticity verification
cloudrun_vision_features = [
  "TEXT_DETECTION",
  "DOCUMENT_TEXT_DETECTION",
  "LOGO_DETECTION",
  "LABEL_DETECTION"
]

# Security
cloudrun_cors_origin             = "*"
cloudrun_require_authentication  = true

# Labels
labels = {
  app         = "payment-centralizer"
  env         = "production"
  managed-by  = "terraform"
}
