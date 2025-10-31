# PowerShell script to test the HTTP function with a local image
# Usage: .\test_http_function.ps1 <path-to-image> [-Token <access-token>]

param(
    [Parameter(Mandatory=$true)]
    [string]$ImagePath,

    [Parameter(Mandatory=$false)]
    [string]$Token
)

# Get access token
if ($Token) {
    $TOKEN = $Token
    Write-Host "Using provided token..."
} else {
    Write-Host "Getting access token from gcloud..."

    # Check if gcloud is available
    $gcloudCommand = Get-Command gcloud -ErrorAction SilentlyContinue

    if (-not $gcloudCommand) {
        Write-Host ""
        Write-Host "ERROR: 'gcloud' command not found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install Google Cloud SDK or add it to your PATH:" -ForegroundColor Yellow
        Write-Host "  1. Install from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
        Write-Host "  2. Run: gcloud init" -ForegroundColor Yellow
        Write-Host "  3. Restart PowerShell" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Alternatively, get a token manually and pass it to this script:" -ForegroundColor Yellow
        Write-Host "  .\test_http_function.ps1 'image.jpg' -Token 'your-token-here'" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "To get a token manually:" -ForegroundColor Yellow
        Write-Host "  1. Open a terminal where gcloud works" -ForegroundColor Yellow
        Write-Host "  2. Run: gcloud auth print-identity-token" -ForegroundColor Yellow
        Write-Host "  3. Copy the token and pass it to this script" -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }

    try {
        $TOKEN = gcloud auth print-identity-token 2>&1

        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "ERROR: Failed to get authentication token!" -ForegroundColor Red
            Write-Host ""
            Write-Host "Please authenticate with gcloud:" -ForegroundColor Yellow
            Write-Host "  gcloud auth login" -ForegroundColor Yellow
            Write-Host "  gcloud auth application-default login" -ForegroundColor Yellow
            Write-Host ""
            exit 1
        }

        Write-Host "Token retrieved successfully!"
    } catch {
        Write-Host ""
        Write-Host "ERROR: Failed to get authentication token: $_" -ForegroundColor Red
        Write-Host ""
        exit 1
    }
}

# Convert image to base64
$imageBytes = [System.IO.File]::ReadAllBytes($ImagePath)
$base64Image = [System.Convert]::ToBase64String($imageBytes)

# Create JSON payload
$payload = @{
    image = @{
        content = $base64Image
    }
} | ConvertTo-Json

# Call the function
$response = Invoke-RestMethod `
    -Uri "https://annotate-http-crxay6pfoa-uc.a.run.app/annotate" `
    -Method Post `
    -Headers @{
        "Authorization" = "Bearer $TOKEN"
        "Content-Type" = "application/json"
    } `
    -Body $payload

# Display results
$response | ConvertTo-Json -Depth 10
