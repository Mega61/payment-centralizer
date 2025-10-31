/**
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

locals {
  code_bucket_prefix    = "vision-code"
  functions_src_folder  = "${path.module}/../../../src/gcf/" # local folder where function code resides
  functions_temp_folder = "${path.module}/../../../temp"     # local folder where function code resides
  functions_file_prefix = "gcf_code"
  zip_ext               = ".zip"
}

data "google_project" "project" {}

# Create a fresh archive of the current function folder in a local temp folder
data "archive_file" "functions" {
  type        = "zip"
  output_path = "${local.functions_temp_folder}/${local.functions_file_prefix}.${local.zip_ext}" # create ZIP file with code in the local folder (timestamp removed for Windows compatibility)
  source_dir  = local.functions_src_folder
}

resource "google_storage_bucket" "code_bucket" {
  name                        = "${local.code_bucket_prefix}-${data.google_project.project.number}" # Every bucket name must be globally unique
  location                    = var.gcf_location                                                    # the same as where GCF resides
  uniform_bucket_level_access = true
  force_destroy               = true
  labels                      = var.labels
}

# The archive in Cloud Stoage uses the md5 of the zip file
# This ensures the Function is redeployed only when the source is changed.
resource "google_storage_bucket_object" "gcf_code" {
  name = "${local.functions_file_prefix}_${data.archive_file.functions.output_md5}.${local.zip_ext}" # target name in GCS, will delete old items

  bucket = google_storage_bucket.code_bucket.name
  source = data.archive_file.functions.output_path

  depends_on = [google_storage_bucket.code_bucket, data.archive_file.functions]
}

# Create SA for GCF
resource "google_service_account" "gcf_sa" {
  account_id   = "gcf-sa"
  display_name = "Service Account - for cloud function and eventarc trigger."
}

# set all roles for GCF service account - individual resources to avoid state lock contention
resource "google_project_iam_member" "gcf_sa_cloudfunctions_invoker" {
  role    = "roles/cloudfunctions.invoker"
  member  = "serviceAccount:${google_service_account.gcf_sa.email}"
  project = data.google_project.project.id
}

resource "google_project_iam_member" "gcf_sa_run_invoker" {
  role    = "roles/run.invoker" # eventarc trigger
  member  = "serviceAccount:${google_service_account.gcf_sa.email}"
  project = data.google_project.project.id
}

resource "google_project_iam_member" "gcf_sa_eventarc_receiver" {
  role    = "roles/eventarc.eventReceiver" # receive events
  member  = "serviceAccount:${google_service_account.gcf_sa.email}"
  project = data.google_project.project.id
}

resource "google_project_iam_member" "gcf_sa_storage_admin" {
  role    = "roles/storage.objectAdmin" # R/W objects into GCS
  member  = "serviceAccount:${google_service_account.gcf_sa.email}"
  project = data.google_project.project.id
}

resource "google_project_iam_member" "gcf_sa_logging_writer" {
  role    = "roles/logging.logWriter" # logging
  member  = "serviceAccount:${google_service_account.gcf_sa.email}"
  project = data.google_project.project.id
}

resource "google_project_iam_member" "gcf_sa_artifact_reader" {
  role    = "roles/artifactregistry.reader" # function deployment
  member  = "serviceAccount:${google_service_account.gcf_sa.email}"
  project = data.google_project.project.id
}

# Cloud Build Service Account IAM roles
# The Cloud Build service account is used to build Cloud Functions Gen 2 container images
# Required permissions added due to GCP policy changes that no longer grant these automatically
resource "google_project_iam_member" "cloudbuild_sa_bucket_writer" {
  role    = "roles/logging.bucketWriter"
  member  = "serviceAccount:${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
  project = data.google_project.project.id
}

resource "google_project_iam_member" "cloudbuild_sa_storage_viewer" {
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
  project = data.google_project.project.id
}

resource "google_project_iam_member" "cloudbuild_sa_artifactregistry_writer" {
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
  project = data.google_project.project.id
}

# Grant Cloud Build service account permission to act as (impersonate) the GCF service account
# This is CRITICAL for Cloud Functions Gen 2 deployment
# Cloud Build needs this to deploy the function with the specified service account
# Without this: "Could not build the function due to a missing permission on the build service account"
# Reference: https://cloud.google.com/functions/docs/securing/function-identity#build-time_service_accounts
resource "google_service_account_iam_member" "cloudbuild_acts_as_gcf_sa" {
  service_account_id = google_service_account.gcf_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
  depends_on         = [google_service_account.gcf_sa]
}

# Compute Engine Default Service Account IAM roles
# Cloud Functions Gen 2 defaults to using the Compute Engine SA for builds when build_config.service_account is not specified
# This is needed because the Terraform provider version doesn't support the service_account parameter in build_config yet
resource "google_project_iam_member" "compute_sa_bucket_writer" {
  role    = "roles/logging.bucketWriter"
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  project = data.google_project.project.id
}

resource "google_project_iam_member" "compute_sa_storage_viewer" {
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  project = data.google_project.project.id
}

resource "google_project_iam_member" "compute_sa_artifactregistry_writer" {
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  project = data.google_project.project.id
}

resource "google_service_account_iam_member" "compute_sa_acts_as_gcf_sa" {
  service_account_id = google_service_account.gcf_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  depends_on         = [google_service_account.gcf_sa]
}

resource "time_sleep" "some_time_after_gcf_sa_roles" {
  depends_on = [
    google_project_iam_member.gcf_sa_cloudfunctions_invoker,
    google_project_iam_member.gcf_sa_run_invoker,
    google_project_iam_member.gcf_sa_eventarc_receiver,
    google_project_iam_member.gcf_sa_storage_admin,
    google_project_iam_member.gcf_sa_logging_writer,
    google_project_iam_member.gcf_sa_artifact_reader,
  ]
  create_duration = "90s" # Increased from 30s to allow proper IAM propagation
}

# Wait for Cloud Build service account permissions to propagate
# Includes both Cloud Build SA and Compute Engine SA (which is actually used for builds)
resource "time_sleep" "wait_for_cloudbuild_sa_roles" {
  depends_on = [
    google_project_iam_member.cloudbuild_sa_bucket_writer,
    google_project_iam_member.cloudbuild_sa_storage_viewer,
    google_project_iam_member.cloudbuild_sa_artifactregistry_writer,
    google_service_account_iam_member.cloudbuild_acts_as_gcf_sa,
    google_project_iam_member.compute_sa_bucket_writer,
    google_project_iam_member.compute_sa_storage_viewer,
    google_project_iam_member.compute_sa_artifactregistry_writer,
    google_service_account_iam_member.compute_sa_acts_as_gcf_sa,
  ]
  create_duration = "90s"
}

# -------- Vision annotation GCF accessible from the internet or internally only --------------


resource "google_cloudfunctions2_function" "annotate_http" {
  name        = "annotate-http"
  labels      = var.labels
  location    = var.gcf_location
  description = "Vision API Image Annotate via HTTP, external"
  depends_on = [
    google_storage_bucket_object.gcf_code,
    time_sleep.some_time_after_gcf_sa_roles,
    time_sleep.wait_for_cloudbuild_sa_roles,
  ]
  build_config {
    runtime     = "python311"
    entry_point = "annotate_http"
    source {
      storage_source {
        bucket = google_storage_bucket.code_bucket.name
        object = google_storage_bucket_object.gcf_code.name
      }
    }
  }

  service_config {
    max_instance_count = var.gcf_max_instance_count
    timeout_seconds    = var.gcf_timeout_seconds
    available_memory   = "256M"
    environment_variables = {
      INPUT_BUCKET       = var.input-bucket
      ANNOTATIONS_BUCKET = var.annotations-bucket
      FEATURES           = var.gcf_annotation_features
      LOG_LEVEL          = var.gcf_log_level
    }
    ingress_settings               = var.gcf_http_ingress_types_list[var.gcf_http_ingress_type_index]
    all_traffic_on_latest_revision = true
    service_account_email          = google_service_account.gcf_sa.email
    # service_account_email = local.gcf_default_sa
  }
}

# Allow unauthenticated access
# update the service IAM member for roles/run.invoker, add the following resource referencing your Cloud Run service
# https://cloud.google.com/run/docs/authenticating/public#terraform
# Changed from iam_binding to iam_member to avoid replacing entire role bindings
resource "google_cloud_run_service_iam_member" "annotate_http" {
  for_each = var.gcf_require_http_authentication ? toset([]) : toset(var.gcr_invoker_members)
  project  = google_cloudfunctions2_function.annotate_http.project
  location = google_cloudfunctions2_function.annotate_http.location
  service  = google_cloudfunctions2_function.annotate_http.name
  role     = var.gcr_role_invoker
  member   = each.value
}


# ------- GCS function -----------


# Service Account for GCS, generates/publishes bucket events.
data "google_storage_project_service_account" "gcs_account" {
}

# To use GCS CloudEvent triggers, the GCS service account requires the Pub/Sub Publisher(roles/pubsub.publisher) IAM role in the specified project.
# (See https://cloud.google.com/eventarc/docs/run/quickstart-storage#before-you-begin)
resource "google_project_iam_member" "gcs_pubsub_publishing" {
  depends_on = [data.google_storage_project_service_account.gcs_account]
  project    = data.google_project.project.id
  role       = "roles/pubsub.publisher"
  member     = "serviceAccount:${data.google_storage_project_service_account.gcs_account.email_address}"
}



resource "google_cloudfunctions2_function" "annotate_gcs" {
  depends_on = [
    google_storage_bucket_object.gcf_code,
    time_sleep.some_time_after_gcf_sa_roles,
    data.google_storage_project_service_account.gcs_account,
    time_sleep.wait_for_cloudbuild_sa_roles,
  ]
  name        = "annotate_gcs"
  labels      = var.labels
  location    = var.gcf_location
  description = "Vision API Image Annotate with GCS"

  build_config {
    runtime     = "python310"    # google-cloud-storage is not available for 3.11
    entry_point = "annotate_gcs" # Set the entry point in the code
    environment_variables = {
      BUILD_CONFIG_TEST = "build_test"
    }
    source {
      storage_source {
        bucket = google_storage_bucket.code_bucket.name
        object = google_storage_bucket_object.gcf_code.name
      }
    }
  }

  service_config {
    max_instance_count = var.gcf_max_instance_count
    timeout_seconds    = var.gcf_timeout_seconds
    available_memory   = "256M"
    environment_variables = {
      INPUT_BUCKET       = var.input-bucket
      ANNOTATIONS_BUCKET = var.annotations-bucket
      FEATURES           = var.gcf_annotation_features
      LOG_LEVEL          = var.gcf_log_level
    }
    ingress_settings               = "ALLOW_INTERNAL_ONLY"
    all_traffic_on_latest_revision = true
    # optionally, use dedicated SA, for now we are using default CloudRun SA
    # which is automatically creatd when CloudRun API is enabled.
    # Examnple:
    service_account_email = google_service_account.gcf_sa.email
  }

  event_trigger {
    trigger_region        = var.gcf_location # The trigger must be in the same location as the bucket
    event_type            = "google.cloud.storage.object.v1.finalized"
    retry_policy          = "RETRY_POLICY_RETRY"
    service_account_email = google_service_account.gcf_sa.email
    event_filters {
      attribute = "bucket"
      value     = var.input-bucket
    }
  }
}
