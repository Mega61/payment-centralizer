/**
 * Outputs for Cloud Run deployment
 */

output "cloudrun_service_url" {
  description = "URL of the Cloud Run service"
  value       = module.cloudrun.service_url
}

output "cloudrun_service_name" {
  description = "Name of the Cloud Run service"
  value       = module.cloudrun.service_name
}

output "cloudrun_service_account" {
  description = "Service account used by Cloud Run"
  value       = module.cloudrun.service_account_email
}

output "gcs_input_bucket" {
  description = "GCS bucket for input images"
  value       = module.storage.gcs_input
}

output "gcs_annotations_bucket" {
  description = "GCS bucket for annotations"
  value       = module.storage.gcs_annotations
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository for Docker images"
  value       = google_artifact_registry_repository.docker_repo.name
}

output "artifact_registry_location" {
  description = "Location of Artifact Registry repository"
  value       = google_artifact_registry_repository.docker_repo.location
}

output "eventarc_trigger_name" {
  description = "Name of the Eventarc trigger"
  value       = google_eventarc_trigger.gcs_trigger.name
}

# CI/CD Outputs
output "workload_identity_provider" {
  description = "Workload Identity Provider for GitHub Actions (use in GITHUB_WIF_PROVIDER secret)"
  value       = google_iam_workload_identity_pool_provider.github_provider.name
}

output "github_actions_service_account_email" {
  description = "Service account email for GitHub Actions (use in GITHUB_SA_EMAIL secret)"
  value       = google_service_account.github_actions.email
}

output "terraform_state_bucket" {
  description = "GCS bucket for Terraform state"
  value       = google_storage_bucket.terraform_state.name
}
