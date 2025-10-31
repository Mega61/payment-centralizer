# Batch process multiple transaction images
# Usage: .\batch_process.ps1 <folder-with-images>

param(
    [Parameter(Mandatory=$true)]
    [string]$ImageFolder
)

$inputBucket = "gs://vision-input-398862077343"
$annotationsBucket = "gs://vision-annotations-398862077343"
$timestamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
$batchFolder = "batch/$timestamp"

Write-Host "Starting batch processing of images from: $ImageFolder"
Write-Host "Batch ID: $batchFolder"
Write-Host ""

# Get all image files
$images = Get-ChildItem -Path $ImageFolder -Include *.jpg,*.jpeg,*.png -Recurse

Write-Host "Found $($images.Count) images to process"
Write-Host ""

# Upload all images
foreach ($image in $images) {
    $gcsPath = "$inputBucket/$batchFolder/$($image.Name)"
    Write-Host "Uploading: $($image.Name)"
    gcloud storage cp $image.FullName $gcsPath
}

Write-Host ""
Write-Host "All images uploaded. Waiting for processing (30 seconds)..."
Start-Sleep -Seconds 30

# Download annotations
Write-Host ""
Write-Host "Downloading annotation results..."
New-Item -ItemType Directory -Force -Path "./batch_results/$timestamp" | Out-Null

foreach ($image in $images) {
    $annotationPath = "$annotationsBucket/$batchFolder/$($image.Name).json"
    $localPath = "./batch_results/$timestamp/$($image.Name).json"

    Write-Host "Downloading annotations for: $($image.Name)"
    gcloud storage cp $annotationPath $localPath 2>$null

    if (Test-Path $localPath) {
        # Parse transaction
        Write-Host "  Parsing transaction data..."
        python parse_transaction.py $localPath 2>$null
    } else {
        Write-Host "  WARNING: Annotation file not found (processing may still be in progress)"
    }
}

Write-Host ""
Write-Host "Batch processing complete!"
Write-Host "Results saved to: ./batch_results/$timestamp/"
Write-Host ""
Write-Host "Summary:"
Write-Host "  Images processed: $($images.Count)"
Write-Host "  Batch folder: $batchFolder"
