output "service_url" {
  description = "URL of the Cloud Run service"
  value       = google_cloud_run_v2_service.main.uri
}

output "service_name" {
  description = "Name of the Cloud Run service"
  value       = google_cloud_run_v2_service.main.name
}

output "service_id" {
  description = "ID of the Cloud Run service"
  value       = google_cloud_run_v2_service.main.id
}

output "service_account_email" {
  description = "Email of the service account used by Cloud Run"
  value       = var.service_account_email != "" ? var.service_account_email : google_service_account.cloudrun_sa[0].email
}
