# PowerShell script to test the HTTP function with a GCS URI
# Usage: .\test_gcs_uri.ps1 gs://bucket-name/path/to/image.jpg

param(
    [Parameter(Mandatory=$true)]
    [string]$GcsUri
)

# Get access token
$TOKEN = gcloud auth print-identity-token

# Create JSON payload
$payload = @{
    image = @{
        source = @{
            gcs_image_uri = $GcsUri
        }
    }
} | ConvertTo-Json -Depth 3

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
