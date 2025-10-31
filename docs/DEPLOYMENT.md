# Deployment Guide - Payment Centralizer on Cloud Run

Complete step-by-step guide to deploy the payment-centralizer application to Google Cloud Run.

## Prerequisites

- Google Cloud Project with billing enabled
- gcloud CLI installed and configured
- Docker installed
- Terraform 1.5+ installed
- Node.js 20+ (for local testing)

## Step 1: Set Up GCP Project

### 1.1 Authenticate and Set Project

```bash
# Login to GCP
gcloud auth login

# Set your project
export PROJECT_ID="your-project-id"
gcloud config set project ${PROJECT_ID}

# Enable required APIs (this will be done by Terraform, but can be done manually)
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  vision.googleapis.com \
  storage.googleapis.com \
  eventarc.googleapis.com
```

### 1.2 Set Region

```bash
export REGION="us-west4"
gcloud config set run/region ${REGION}
```

## Step 2: Build and Push Docker Image

### 2.1 Build the Docker Image

```bash
# From the project root directory
docker build -t payment-centralizer:latest .
```

### 2.2 Create Artifact Registry Repository

Terraform will create this, but you can also create it manually:

```bash
gcloud artifacts repositories create payment-centralizer \
  --repository-format=docker \
  --location=${REGION} \
  --description="Docker repository for payment-centralizer"
```

### 2.3 Configure Docker Authentication

```bash
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

### 2.4 Tag and Push Image

```bash
# Tag the image
docker tag payment-centralizer:latest \
  ${REGION}-docker.pkg.dev/${PROJECT_ID}/payment-centralizer/app:latest

# Push to Artifact Registry
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/payment-centralizer/app:latest
```

## Step 3: Deploy with Terraform

### 3.1 Navigate to Infrastructure Directory

```bash
cd infra
```

### 3.2 Initialize Terraform

```bash
terraform init
```

### 3.3 Create terraform.tfvars

Create a file named `terraform.tfvars` with your configuration:

```hcl
project_id = "your-project-id"
region     = "us-west4"

# Container image from Artifact Registry
cloudrun_container_image = "us-west4-docker.pkg.dev/your-project-id/payment-centralizer/app:latest"

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

# Vision API features
cloudrun_vision_features = [
  "TEXT_DETECTION",
  "DOCUMENT_TEXT_DETECTION",
  "LOGO_DETECTION",
  "LABEL_DETECTION"
]

# Security
cloudrun_cors_origin             = "*"
cloudrun_require_authentication  = false

# Labels
labels = {
  app         = "payment-centralizer"
  env         = "production"
  managed-by  = "terraform"
}
```

### 3.4 Plan Deployment

```bash
terraform plan -var-file=terraform.tfvars
```

Review the plan to ensure everything looks correct.

### 3.5 Apply Infrastructure

```bash
terraform apply -var-file=terraform.tfvars
```

Type `yes` when prompted to confirm.

### 3.6 Get Outputs

```bash
terraform output
```

You should see:
- `cloudrun_service_url`: Your Cloud Run service URL
- `gcs_input_bucket`: GCS bucket for uploads
- `gcs_annotations_bucket`: GCS bucket for results
- `artifact_registry_repository`: Docker repository name

## Step 4: Verify Deployment

### 4.1 Get Service URL

```bash
export SERVICE_URL=$(terraform output -raw cloudrun_service_url)
echo "Service URL: ${SERVICE_URL}"
```

### 4.2 Test Health Endpoints

```bash
# Liveness probe
curl ${SERVICE_URL}/health/live

# Readiness probe
curl ${SERVICE_URL}/health/ready
```

Expected response:
```json
{
  "status": "UP",
  "timestamp": "2024-01-15T20:33:00.000Z"
}
```

### 4.3 Test Transaction Annotation

Upload a test image to GCS:

```bash
# Get bucket name
export INPUT_BUCKET=$(terraform output -raw gcs_input_bucket)

# Upload test image
gsutil cp /path/to/transaction.jpg gs://${INPUT_BUCKET}/

# Or test via API
curl -X POST ${SERVICE_URL}/api/v1/transactions/annotate \
  -H "Content-Type: application/json" \
  -d "{
    \"imageUri\": \"gs://${INPUT_BUCKET}/transaction.jpg\",
    \"features\": [\"TEXT_DETECTION\", \"DOCUMENT_TEXT_DETECTION\"]
  }"
```

### 4.4 Check Eventarc Trigger

When you upload a file to the input bucket, it should automatically trigger processing:

```bash
# Upload a file
gsutil cp transaction.jpg gs://${INPUT_BUCKET}/test-$(date +%s).jpg

# Check Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=payment-centralizer" --limit=20

# Check annotations bucket for results
export ANNOTATIONS_BUCKET=$(terraform output -raw gcs_annotations_bucket)
gsutil ls gs://${ANNOTATIONS_BUCKET}/
```

## Step 5: Monitor and Observe

### 5.1 View Logs

```bash
# Stream logs
gcloud run services logs read payment-centralizer --limit=50

# Or in Cloud Console
echo "https://console.cloud.google.com/run/detail/${REGION}/payment-centralizer/logs?project=${PROJECT_ID}"
```

### 5.2 View Traces

```bash
# Open Cloud Trace
echo "https://console.cloud.google.com/traces/list?project=${PROJECT_ID}"
```

### 5.3 View Metrics

```bash
# Open Cloud Monitoring
echo "https://console.cloud.google.com/monitoring/dashboards?project=${PROJECT_ID}"
```

## Step 6: Update Deployment

### 6.1 Build New Image

```bash
# Make code changes, then rebuild
docker build -t payment-centralizer:v2 .
docker tag payment-centralizer:v2 \
  ${REGION}-docker.pkg.dev/${PROJECT_ID}/payment-centralizer/app:v2
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/payment-centralizer/app:v2
```

### 6.2 Update Terraform Variable

Update `terraform.tfvars`:

```hcl
cloudrun_container_image = "us-west4-docker.pkg.dev/your-project-id/payment-centralizer/app:v2"
```

### 6.3 Apply Changes

```bash
terraform apply -var-file=terraform.tfvars
```

Cloud Run will perform a rolling update with zero downtime.

## Step 7: Production Hardening (Optional)

### 7.1 Enable Authentication

Update `terraform.tfvars`:

```hcl
cloudrun_require_authentication = true
```

Apply changes:

```bash
terraform apply -var-file=terraform.tfvars
```

Now API calls require authentication:

```bash
# Get auth token
export TOKEN=$(gcloud auth print-identity-token)

# Make authenticated request
curl ${SERVICE_URL}/api/v1/transactions/annotate \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"imageUri": "gs://bucket/image.jpg"}'
```

### 7.2 Set Up Custom Domain

```bash
# Map domain to Cloud Run
gcloud run domain-mappings create \
  --service=payment-centralizer \
  --domain=api.yourdomain.com \
  --region=${REGION}
```

### 7.3 Configure CORS

Update `terraform.tfvars`:

```hcl
cloudrun_cors_origin = "https://yourdomain.com"
```

### 7.4 Increase Resources (if needed)

Update `terraform.tfvars`:

```hcl
cloudrun_cpu_limit    = "2000m"  # 2 CPUs
cloudrun_memory_limit = "1Gi"    # 1 GB
cloudrun_max_instances = 20
```

## Troubleshooting

### Issue: Container fails to start

**Check logs**:
```bash
gcloud run services logs read payment-centralizer --limit=50
```

**Common causes**:
- Missing environment variables
- Invalid GCP credentials
- Port mismatch (must be 8080)

### Issue: Vision API errors

**Check permissions**:
```bash
gcloud projects get-iam-policy ${PROJECT_ID} \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*payment-centralizer*"
```

**Grant Vision API access**:
```bash
export SA_EMAIL=$(terraform output -raw cloudrun_service_account)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudvision.user"
```

### Issue: Eventarc trigger not working

**Check trigger status**:
```bash
gcloud eventarc triggers list --location=${REGION}
```

**Check trigger details**:
```bash
gcloud eventarc triggers describe payment-centralizer-gcs-trigger \
  --location=${REGION}
```

**Verify Pub/Sub permissions**:
```bash
export SA_EMAIL=$(terraform output -raw cloudrun_service_account)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/pubsub.publisher"
```

### Issue: High latency

**Check cold start times**:
- Consider setting `cloudrun_min_instances = 1` to keep a warm instance

**Optimize Docker image**:
- Use multi-stage builds (already configured)
- Minimize dependencies in `package.json`

**Check resource allocation**:
- Increase CPU/memory if needed

## Cleanup

### Remove All Resources

```bash
cd infra
terraform destroy -var-file=terraform.tfvars
```

Type `yes` when prompted.

### Manual Cleanup (if needed)

```bash
# Delete Cloud Run service
gcloud run services delete payment-centralizer --region=${REGION}

# Delete Artifact Registry repository
gcloud artifacts repositories delete payment-centralizer --location=${REGION}

# Delete GCS buckets
gsutil -m rm -r gs://$(terraform output -raw gcs_input_bucket)
gsutil -m rm -r gs://$(terraform output -raw gcs_annotations_bucket)

# Delete Eventarc trigger
gcloud eventarc triggers delete payment-centralizer-gcs-trigger --location=${REGION}
```

## Cost Optimization

### Minimize Costs

1. **Set min instances to 0**: Only pay when handling requests
2. **Right-size resources**: Start with 512Mi/1CPU, adjust as needed
3. **Enable request timeout**: Prevent long-running requests
4. **Use lifecycle policies on GCS**: Delete old files automatically

### Example Lifecycle Policy for GCS

```bash
cat > lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 30}
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://${INPUT_BUCKET}
```

## Next Steps

1. **Integrate with frontend**: Update React app to use new Cloud Run URL
2. **Add authentication**: Enable IAM-based authentication for production
3. **Set up CI/CD**: Automate builds and deployments with Cloud Build
4. **Monitor SLAs**: Set up alerting for availability and latency
5. **Implement additional features**: See `business-guide/payment-reconciliation-solution.md`

## Support

For issues or questions:
- Review logs: `gcloud run services logs read payment-centralizer`
- Check [README-CLOUDRUN.md](./README-CLOUDRUN.md)
- Refer to dev-guide standards

## References

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Vision API Documentation](https://cloud.google.com/vision/docs)
- [Eventarc Documentation](https://cloud.google.com/eventarc/docs)
- [Terraform Google Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
