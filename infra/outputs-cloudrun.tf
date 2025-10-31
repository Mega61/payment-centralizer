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
  value       = module.storage.gcs_input.name
}

output "gcs_annotations_bucket" {
  description = "GCS bucket for annotations"
  value       = module.storage.gcs_annotations.name
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
