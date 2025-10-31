/**
 * Variables for Cloud Run deployment
 */

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for deployment"
  type        = string
  default     = "us-west4"
}

variable "enable_apis" {
  description = "Whether to enable GCP APIs"
  type        = bool
  default     = true
}

variable "time_to_enable_apis" {
  description = "Wait time for APIs to be enabled"
  type        = string
  default     = "90s"
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default = {
    app = "payment-centralizer"
    env = "production"
  }
}

# Cloud Run Configuration
variable "cloudrun_container_image" {
  description = "Container image for Cloud Run (e.g., us-west4-docker.pkg.dev/PROJECT/payment-centralizer/app:latest)"
  type        = string
}

variable "cloudrun_min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0
}

variable "cloudrun_max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
}

variable "cloudrun_cpu_limit" {
  description = "CPU limit per Cloud Run instance"
  type        = string
  default     = "1000m"
}

variable "cloudrun_memory_limit" {
  description = "Memory limit per Cloud Run instance"
  type        = string
  default     = "512Mi"
}

variable "cloudrun_timeout_seconds" {
  description = "Request timeout for Cloud Run in seconds"
  type        = number
  default     = 300
}

variable "cloudrun_log_level" {
  description = "Log level for the application"
  type        = string
  default     = "info"
  validation {
    condition     = contains(["error", "warn", "info", "debug"], var.cloudrun_log_level)
    error_message = "Log level must be one of: error, warn, info, debug"
  }
}

variable "cloudrun_vision_features" {
  description = "Vision API features to use"
  type        = list(string)
  default = [
    "TEXT_DETECTION",
    "DOCUMENT_TEXT_DETECTION",
    "LOGO_DETECTION",
    "LABEL_DETECTION"
  ]
}

variable "cloudrun_cors_origin" {
  description = "CORS origin for Cloud Run service"
  type        = string
  default     = "*"
}

variable "cloudrun_require_authentication" {
  description = "Whether to require authentication for Cloud Run service"
  type        = bool
  default     = false
}
