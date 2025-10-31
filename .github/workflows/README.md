# GitHub Actions Workflows

This directory contains the CI/CD workflows for the Payment Centralizer application.

## Workflows Overview

### 🔍 [backend-ci.yml](backend-ci.yml)
**Purpose:** Validate pull requests for backend changes

**Triggers:**
- Pull requests to `main` with changes in `src/`, `package*.json`, `tsconfig*.json`, or `Dockerfile`

**Jobs:**
- Lint and build TypeScript code
- Validate Dockerfile can be built

**Status:** Required for merging PRs

---

### 🏗️ [build-publish.yml](build-publish.yml)
**Purpose:** Build and publish Docker images to Artifact Registry

**Triggers:**
- Push to `main` branch
- Manual trigger

**Jobs:**
- Extract semantic version from `package.json`
- Build Docker image with multi-stage build
- Push to Artifact Registry with version tag and `latest`
- Trigger deployment workflow

**Outputs:**
- Docker image tagged with semantic version (e.g., `v1.0.0`)
- Image digest for deployment verification

---

### 🚀 [deploy.yml](deploy.yml)
**Purpose:** Deploy to Cloud Run production environment

**Triggers:**
- Called by build-publish workflow
- Manual trigger

**Environment:** `production` (requires manual approval)

**Jobs:**
1. Wait for manual approval from designated reviewers
2. Update Cloud Run service with new container image
3. Verify health check passes

**Approval Required:** ✅ Yes - protects production from accidental deployments

**Note:** Infrastructure changes are managed separately via Terraform CLI, not in the deployment workflow.

---

### 🏗️ [terraform.yml](terraform.yml)
**Purpose:** Validate Terraform infrastructure changes

**Triggers:**
- Pull requests to `main` with changes in `infra/`

**Jobs:**
- Format check (`terraform fmt`)
- Validation (`terraform validate`)
- Plan execution (`terraform plan`)
- Security scan (Checkov)
- Comment plan results on PR

**Status:** Required for merging infrastructure PRs

---

### ⚛️ [frontend.yml](frontend.yml)
**Purpose:** Test frontend React application

**Triggers:**
- Push/PR to `main` with changes in `src/frontend/`

**Jobs:**
- Install dependencies
- Run unit tests with coverage

---

## Deployment Flow

```
┌─────────────────────────┐
│  Developer creates PR   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   backend-ci.yml runs   │
│   - Lint & build        │
│   - Validate Dockerfile │
└───────────┬─────────────┘
            │
            │ ✅ PR approved & merged
            ▼
┌─────────────────────────┐
│ build-publish.yml runs  │
│   - Build Docker image  │
│   - Push to registry    │
└───────────┬─────────────┘
            │
            │ Automatically triggers
            ▼
┌─────────────────────────┐
│   deploy.yml starts     │
│   ⏸️  PAUSED FOR APPROVAL │
└───────────┬─────────────┘
            │
            │ 👤 Manual approval
            ▼
┌─────────────────────────┐
│  Deploy to Cloud Run    │
│   - Update service      │
│   - Verify health       │
│   - Apply Terraform     │
└─────────────────────────┘
```

## Required GitHub Secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret | Description | Example |
|--------|-------------|---------|
| `GCP_PROJECT_ID` | GCP project ID | `andante-payment-centralizer` |
| `GCP_REGION` | GCP region for resources | `us-central1` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | WIF provider for auth | `projects/123.../providers/github-provider` |
| `GCP_SERVICE_ACCOUNT_EMAIL` | Service account for deployments | `github-actions-deployer@PROJECT.iam.gserviceaccount.com` |

## Required GitHub Environment

Create a `production` environment in **Settings → Environments**:

**Configuration:**
- ✅ Required reviewers (add team members)
- ✅ Deployment branches: `main` only
- ⏱️ Wait timer: Optional (e.g., 5 minutes before deployment can proceed)

## Version Management

Versions are managed via `package.json`:

```bash
# Bump patch version (1.0.0 -> 1.0.1)
npm version patch

# Bump minor version (1.0.0 -> 1.1.0)
npm version minor

# Bump major version (1.0.0 -> 2.0.0)
npm version major

# Commit and push
git push origin main
```

The Docker image will be automatically tagged with the new version.

## Manual Deployment

To manually deploy a specific version:

1. Go to **Actions** → **Deploy to Production**
2. Click **Run workflow**
3. Select branch: `main`
4. Enter image tag (e.g., `v1.0.0`)
5. Click **Run workflow**
6. Approve the deployment when prompted

## Rollback

To rollback to a previous version:

1. Find the previous version in Artifact Registry
2. Manually trigger deploy workflow with the previous version tag
3. Approve the rollback deployment

## Managing Infrastructure Changes

Infrastructure is managed separately from application deployments using Terraform CLI:

```bash
# Make changes to Terraform files in infra/
cd infra

# Review changes
terraform plan

# Apply after review
terraform apply
```

**Note:** The `terraform.yml` workflow validates infrastructure changes in PRs but does NOT automatically apply them. This ensures infrastructure changes are deliberate and reviewed.

## Troubleshooting

### Workflow fails with authentication error

**Issue:** `Failed to authenticate to Google Cloud`

**Fix:**
1. Verify `GCP_WORKLOAD_IDENTITY_PROVIDER` secret is correct
2. Check that Workload Identity Federation is properly configured in Terraform
3. Ensure GitHub repository name matches the one configured in Terraform

### Docker build fails

**Issue:** `Error building Docker image`

**Fix:**
1. Test build locally: `docker build -t test .`
2. Check that all dependencies are listed in `package.json`
3. Verify Node.js version compatibility (should be 20)

### Deployment paused indefinitely

**Issue:** Deployment stuck waiting for approval

**Fix:**
1. Check if reviewers are configured in the `production` environment
2. Reviewers need to go to **Actions** → **Deploy to Production** and approve
3. Ensure you have the `required_reviewers` set correctly

### Terraform plan shows unexpected changes

**Issue:** Terraform wants to recreate resources

**Fix:**
1. Review the plan carefully in the PR comment
2. Check if manual changes were made in GCP Console
3. If needed, import resources: `terraform import <resource> <id>`

## Best Practices

✅ **DO:**
- Always create PRs for changes (never push directly to main)
- Review Terraform plans before approving PRs
- Wait for CI checks to pass before merging
- Review deployment before approving production deployment
- Keep package.json version updated
- Use semantic versioning

❌ **DON'T:**
- Bypass branch protection rules
- Approve deployments without reviewing
- Make manual changes to Cloud Run service (use Terraform)
- Commit secrets or credentials
- Skip CI checks

## Monitoring

After deployment, verify:

```bash
# Check Cloud Run service status
gcloud run services describe payment-centralizer --region=us-central1

# View recent logs
gcloud logging read "resource.type=cloud_run_revision" --limit=20

# Check latest revision
gcloud run revisions list --service=payment-centralizer --region=us-central1
```

## Support

For more detailed setup instructions, see [CICD_SETUP.md](../../CICD_SETUP.md)

For issues or questions:
1. Check the workflow logs in GitHub Actions
2. Review Cloud Run logs in GCP Console
3. Verify all secrets are correctly configured
4. Consult the troubleshooting section in CICD_SETUP.md
