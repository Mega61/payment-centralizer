/**
 * Main Terraform configuration for payment-centralizer
 * Cloud Run deployment (replaces Cloud Functions)
 */

data "google_project" "project" {
  project_id = var.project_id
}

# Enable required GCP APIs
module "project-services" {
  source                      = "terraform-google-modules/project-factory/google//modules/project_services"
  version                     = "15.0"
  disable_services_on_destroy = false

  project_id  = var.project_id
  enable_apis = var.enable_apis

  activate_apis = [
    "compute.googleapis.com",
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "logging.googleapis.com",
    "pubsub.googleapis.com",
    "eventarc.googleapis.com",
    "storage.googleapis.com",
    "vision.googleapis.com",
    "iam.googleapis.com",
    "secretmanager.googleapis.com",
  ]

  activate_api_identities = [
    {
      api = "eventarc.googleapis.com"
      roles = [
        "roles/eventarc.serviceAgent",
      ]
    },
  ]
}

# Wait for APIs to be enabled
resource "time_sleep" "wait_for_apis" {
  depends_on = [module.project-services]
  create_duration = var.time_to_enable_apis
}

# GCS Storage Module (for input and annotations buckets)
module "storage" {
  source = "./modules/storage"
  depends_on = [time_sleep.wait_for_apis]

  gcf_location = var.region
  labels       = var.labels
}

# Artifact Registry for Docker images
resource "google_artifact_registry_repository" "docker_repo" {
  depends_on = [time_sleep.wait_for_apis]

  project       = var.project_id
  location      = var.region
  repository_id = "payment-centralizer"
  description   = "Docker repository for payment-centralizer application"
  format        = "DOCKER"
  labels        = var.labels
}

# Cloud Run Service
module "cloudrun" {
  source = "./modules/cloudrun"
  depends_on = [
    time_sleep.wait_for_apis,
    google_artifact_registry_repository.docker_repo
  ]

  project_id      = var.project_id
  region          = var.region
  service_name    = "payment-centralizer"
  container_image = var.cloudrun_container_image
  container_port  = 8080

  min_instances = var.cloudrun_min_instances
  max_instances = var.cloudrun_max_instances
  cpu_limit     = var.cloudrun_cpu_limit
  memory_limit  = var.cloudrun_memory_limit

  request_timeout = var.cloudrun_timeout_seconds

  environment_variables = {
    NODE_ENV                       = "production"
    LOG_LEVEL                      = var.cloudrun_log_level
    GCP_PROJECT_ID                 = var.project_id
    GCS_BUCKET_NAME                = module.storage.gcs_input.name
    GCS_ANNOTATIONS_BUCKET_NAME    = module.storage.gcs_annotations.name
    VISION_API_FEATURES            = join(",", var.cloudrun_vision_features)
    ENABLE_TRACING                 = "true"
    ENABLE_METRICS                 = "true"
    CORS_ORIGIN                    = var.cloudrun_cors_origin
    REQUIRE_AUTHENTICATION         = var.cloudrun_require_authentication ? "true" : "false"
  }

  allow_unauthenticated = !var.cloudrun_require_authentication
  depends_on_apis       = module.project-services.project_id
}

# Eventarc trigger for GCS bucket events -> Cloud Run
resource "google_eventarc_trigger" "gcs_trigger" {
  depends_on = [
    module.cloudrun,
    module.storage,
    time_sleep.wait_for_apis
  ]

  name     = "payment-centralizer-gcs-trigger"
  location = var.region
  project  = var.project_id

  matching_criteria {
    attribute = "type"
    value     = "google.cloud.storage.object.v1.finalized"
  }

  matching_criteria {
    attribute = "bucket"
    value     = module.storage.gcs_input.name
  }

  destination {
    cloud_run_service {
      service = module.cloudrun.service_name
      region  = var.region
      path    = "/events/gcs/finalize"
    }
  }

  service_account = module.cloudrun.service_account_email
}

# Grant Eventarc permissions to invoke Cloud Run
resource "google_cloud_run_service_iam_member" "eventarc_invoker" {
  depends_on = [module.cloudrun]

  service  = module.cloudrun.service_name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${module.cloudrun.service_account_email}"
}

# Grant Eventarc permission to publish events
resource "google_project_iam_member" "eventarc_pubsub_publisher" {
  depends_on = [module.cloudrun]

  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${module.cloudrun.service_account_email}"
}
