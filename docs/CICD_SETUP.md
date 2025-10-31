# CI/CD Setup Guide

This guide will help you set up the complete CI/CD pipeline for the Payment Centralizer application.

## Overview

The CI/CD pipeline consists of:
- **Terraform remote state** backed by GCS
- **Workload Identity Federation** for secure, keyless GitHub Actions authentication
- **Automated PR validation** with linting, build checks, and Docker validation
- **Automated build and publish** of Docker images on merge to main
- **Manual approval deployment** to production Cloud Run service

## Prerequisites

- GCP project: `andante-payment-centralizer`
- GitHub repository with admin access
- `gcloud` CLI installed and authenticated
- Terraform >= 1.5 installed

## Step 1: Update Terraform Configuration

### 1.1 Update GitHub Repository Variable

Edit `infra/terraform.tfvars` and update the `github_repository` variable:

```hcl
github_repository = "YOUR_GITHUB_USERNAME/payment-centralizer"
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username or organization name.

## Step 2: Apply Terraform Changes

### 2.1 Create the State Bucket

First, we need to create the GCS bucket for Terraform state. This is a bootstrap step:

```bash
cd infra

# Create the state bucket manually (one-time setup)
gcloud storage buckets create gs://andante-payment-centralizer-tfstate \
  --location=us-central1 \
  --uniform-bucket-level-access

# Enable versioning
gcloud storage buckets update gs://andante-payment-centralizer-tfstate \
  --versioning
```

### 2.2 Initialize Terraform with Remote Backend

```bash
# Initialize with the new backend configuration
terraform init -migrate-state

# When prompted, type 'yes' to migrate existing state to GCS
```

### 2.3 Apply Infrastructure Changes

```bash
# Review the plan
terraform plan

# Apply the changes (creates Workload Identity Federation resources)
terraform apply
```

**Important outputs to save:**
- `workload_identity_provider` - You'll need this for GitHub secrets
- `github_actions_service_account_email` - You'll need this for GitHub secrets

## Step 3: Configure GitHub Repository

### 3.1 Create Production Environment

1. Go to your GitHub repository
2. Click **Settings** → **Environments**
3. Click **New environment**
4. Name it `production`
5. Add **Required reviewers**:
   - Add yourself or team members who should approve deployments
6. Under **Deployment branches**, select "Selected branches"
7. Add rule for `main` branch only

### 3.2 Add GitHub Secrets

Go to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add the following secrets:

| Secret Name | Value | How to Get |
|-------------|-------|------------|
| `GCP_PROJECT_ID` | `andante-payment-centralizer` | Your GCP project ID |
| `GCP_REGION` | `us-central1` | Your GCP region |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider` | From terraform output: `terraform output -raw workload_identity_provider` |
| `GCP_SERVICE_ACCOUNT_EMAIL` | `github-actions-deployer@PROJECT.iam.gserviceaccount.com` | From terraform output: `terraform output -raw github_actions_service_account_email` |

To get your project number:
```bash
gcloud projects describe andante-payment-centralizer --format="value(projectNumber)"
```

### 3.3 Configure Branch Protection

1. Go to **Settings** → **Branches**
2. Add rule for `main` branch:
   - ✅ Require a pull request before merging
   - ✅ Require approvals (at least 1)
   - ✅ Require status checks to pass before merging
     - Add: `Lint and Build`
     - Add: `Validate Dockerfile`
   - ✅ Require branches to be up to date before merging
   - ✅ Do not allow bypassing the above settings

## Step 4: Update package.json Scripts

Ensure your `package.json` has the required scripts:

```json
{
  "scripts": {
    "build": "tsc && tsc-alias",
    "lint": "eslint src --ext .ts",
    "format:check": "prettier --check \"src/**/*.ts\"",
    "format": "prettier --write \"src/**/*.ts\""
  }
}
```

If any scripts are missing, add them and commit:

```bash
npm install --save-dev eslint prettier
# Configure ESLint and Prettier if not already configured
```

## Step 5: Test the Pipeline

### 5.1 Test PR Validation

1. Create a new branch:
   ```bash
   git checkout -b test-cicd
   ```

2. Make a small change to test CI:
   ```bash
   echo "// CI/CD test" >> src/index.ts
   git add src/index.ts
   git commit -m "test: CI/CD pipeline validation"
   git push -u origin test-cicd
   ```

3. Create a Pull Request to `main`

4. Verify that the following workflows run:
   - ✅ Backend CI (lint, build, docker validation)
   - ✅ Terraform Validation (if you changed infra files)

### 5.2 Test Build and Deploy

1. After PR is approved and merged to `main`, the following should happen automatically:
   - ✅ **Build and Publish** workflow runs
   - ✅ Docker image is built and pushed to Artifact Registry
   - ✅ **Deploy to Production** workflow is triggered
   - ⏸️  Deployment **pauses** waiting for manual approval

2. Review the deployment:
   - Go to **Actions** → **Deploy to Production**
   - Review the image that will be deployed
   - Click **Review deployments**
   - Approve or reject the deployment

3. After approval:
   - ✅ Cloud Run service is updated
   - ✅ Health check is performed
   - ✅ Terraform changes are applied (if any)

## Step 6: Verify Deployment

### 6.1 Check Cloud Run Service

```bash
# Get service URL
gcloud run services describe payment-centralizer \
  --region=us-central1 \
  --format='value(status.url)'

# Check service status
gcloud run services describe payment-centralizer \
  --region=us-central1 \
  --format='value(status.conditions.status)'
```

### 6.2 Test Health Endpoint

```bash
# Get an identity token (service requires authentication)
TOKEN=$(gcloud auth print-identity-token)

# Test health endpoint
curl -H "Authorization: Bearer ${TOKEN}" \
  https://YOUR-SERVICE-URL/health/live
```

## Workflow Triggers

### Backend CI (`backend-ci.yml`)
**Triggers on:**
- Pull requests to `main` that modify:
  - `src/**`
  - `package*.json`
  - `tsconfig*.json`
  - `Dockerfile`

**Jobs:**
1. Lint and Build - ESLint, Prettier, TypeScript compilation
2. Validate Dockerfile - Build Docker image
3. CI Summary - Overall status

### Build and Publish (`build-publish.yml`)
**Triggers on:**
- Push to `main` (after PR merge)
- Manual trigger via `workflow_dispatch`

**Jobs:**
1. Extract version from `package.json`
2. Build Docker image
3. Push to Artifact Registry with tags:
   - `vX.Y.Z` (semantic version)
   - `latest`
4. Trigger deployment workflow

### Deploy to Production (`deploy.yml`)
**Triggers on:**
- Called by Build and Publish workflow
- Manual trigger via `workflow_dispatch`

**Jobs:**
1. **Wait for manual approval** (production environment)
2. Update Cloud Run service with new image
3. Verify health check

**Note:** Infrastructure changes are managed separately via Terraform CLI, not in the deployment pipeline.

### Terraform Validation (`terraform.yml`)
**Triggers on:**
- Pull requests to `main` that modify `infra/**`

**Jobs:**
1. Format check
2. Validate configuration
3. Run `terraform plan`
4. Comment plan results on PR
5. Security scan with Checkov

## Version Management

The pipeline uses semantic versioning from `package.json`:

```json
{
  "version": "1.0.0"
}
```

### To Release a New Version

1. Update version in `package.json`:
   ```bash
   npm version patch  # 1.0.0 -> 1.0.1
   # or
   npm version minor  # 1.0.0 -> 1.1.0
   # or
   npm version major  # 1.0.0 -> 2.0.0
   ```

2. Commit and push:
   ```bash
   git add package.json package-lock.json
   git commit -m "chore: bump version to v1.0.1"
   git push origin main
   ```

3. The Docker image will be tagged with the new version

4. Optionally, create a GitHub release:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

## Rollback Procedure

If you need to rollback to a previous version:

1. Find the previous image tag in Artifact Registry:
   ```bash
   gcloud artifacts docker images list \
     us-central1-docker.pkg.dev/andante-payment-centralizer/payment-centralizer/app \
     --limit=10
   ```

2. Trigger manual deployment with the previous version:
   - Go to **Actions** → **Deploy to Production**
   - Click **Run workflow**
   - Enter the previous version tag (e.g., `v1.0.0`)
   - Click **Run workflow**

3. Approve the deployment

## Troubleshooting

### Issue: Workload Identity Federation fails

**Error:** `Failed to authenticate to Google Cloud`

**Solution:**
1. Verify the service account exists:
   ```bash
   gcloud iam service-accounts list | grep github-actions
   ```

2. Check Workload Identity Pool:
   ```bash
   gcloud iam workload-identity-pools list --location=global
   ```

3. Verify GitHub repository is correctly configured in `terraform.tfvars`

### Issue: Docker build fails

**Error:** `Error building Docker image`

**Solution:**
1. Test Docker build locally:
   ```bash
   docker build -t test .
   ```

2. Check that all dependencies are in `package.json`

3. Verify `Dockerfile` is valid

### Issue: Cloud Run deployment fails

**Error:** `ERROR: (gcloud.run.services.update) Service not found`

**Solution:**
1. Verify service exists:
   ```bash
   gcloud run services list --region=us-central1
   ```

2. If service doesn't exist, create it first:
   ```bash
   cd infra
   terraform apply
   ```

### Issue: Terraform plan shows unexpected changes

**Error:** Terraform wants to recreate resources

**Solution:**
1. Check if state is in sync:
   ```bash
   cd infra
   terraform refresh
   ```

2. Review the plan carefully before applying

3. If needed, import existing resources:
   ```bash
   terraform import google_storage_bucket.terraform_state andante-payment-centralizer-tfstate
   ```

## Security Best Practices

✅ **Implemented:**
- Workload Identity Federation (no service account keys)
- Least privilege IAM roles
- Branch protection on `main`
- Required reviewers for production
- Terraform state versioning
- Container image scanning (Checkov for Terraform)

⚠️ **Recommended Next Steps:**
- Enable container vulnerability scanning (Artifact Registry)
- Add npm audit to CI pipeline
- Set up Cloud Monitoring alerts
- Implement automated backup verification
- Add SAST/DAST security scanning

## Monitoring and Observability

After deployment, monitor your service:

```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=payment-centralizer" \
  --limit=50 \
  --format=json

# View metrics
gcloud monitoring dashboards list
```

## Support

If you encounter issues:
1. Check GitHub Actions logs
2. Review Cloud Run logs in GCP Console
3. Verify all secrets are correctly configured
4. Ensure Terraform state is not corrupted

## Next Steps

Consider adding:
- [ ] Staging environment for pre-production testing
- [ ] Automated integration tests
- [ ] Performance testing in CI
- [ ] Canary deployments
- [ ] Automatic rollback on health check failures
- [ ] Slack/email notifications for deployments
- [ ] Cost monitoring and alerts
