/**
 * Cloud Run module for payment-centralizer
 * Deploys a serverless container service with auto-scaling
 */

resource "google_cloud_run_v2_service" "main" {
  name     = var.service_name
  location = var.region
  project  = var.project_id

  template {
    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.container_image

      ports {
        container_port = var.container_port
      }

      # Resource allocation
      resources {
        limits = {
          cpu    = var.cpu_limit
          memory = var.memory_limit
        }
      }

      # Environment variables
      dynamic "env" {
        for_each = var.environment_variables
        content {
          name  = env.key
          value = env.value
        }
      }

      # Startup probe
      startup_probe {
        http_get {
          path = "/health/live"
          port = var.container_port
        }
        initial_delay_seconds = 10
        timeout_seconds       = 3
        period_seconds        = 10
        failure_threshold     = 3
      }

      # Liveness probe
      liveness_probe {
        http_get {
          path = "/health/live"
          port = var.container_port
        }
        initial_delay_seconds = 30
        timeout_seconds       = 3
        period_seconds        = 30
        failure_threshold     = 3
      }
    }

    timeout = "${var.request_timeout}s"

    service_account = var.service_account_email != "" ? var.service_account_email : null
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    var.depends_on_apis
  ]
}

# IAM policy to allow public access (optional)
resource "google_cloud_run_service_iam_member" "public_access" {
  count = var.allow_unauthenticated ? 1 : 0

  service  = google_cloud_run_v2_service.main.name
  location = google_cloud_run_v2_service.main.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Service account for Cloud Run (if not provided)
resource "google_service_account" "cloudrun_sa" {
  count = var.service_account_email == "" ? 1 : 0

  account_id   = "${var.service_name}-sa"
  display_name = "Service Account for ${var.service_name}"
  project      = var.project_id
}

# Note: Vision API access is granted automatically when the API is enabled
# No specific IAM role is required for Cloud Vision API usage

# Grant Storage permissions
resource "google_project_iam_member" "storage_object_viewer" {
  count = var.service_account_email == "" ? 1 : 0

  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.cloudrun_sa[0].email}"
}

resource "google_project_iam_member" "storage_object_creator" {
  count = var.service_account_email == "" ? 1 : 0

  project = var.project_id
  role    = "roles/storage.objectCreator"
  member  = "serviceAccount:${google_service_account.cloudrun_sa[0].email}"
}
