# Batch Process Pending Documents
# Ruft die batch-process-pending Edge Function auf um alle pending_ocr Dokumente zu verarbeiten

param(
    [int]$Limit = 10,
    [switch]$DryRun
)

$SUPABASE_URL = "https://rsmjgdujlpnydbsfuiek.supabase.co"
# API Key aus supabase/functions/.env - NICHT committen wenn anders!
$API_KEY = 'wNzMEZJRoUBnyb8JxiMUwEi7rDlxcUMTzAlYkkW2SE040w98gna3x1MmrPpC3qeX'

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = $API_KEY
}

$body = @{
    limit = $Limit
    dry_run = $DryRun.IsPresent
} | ConvertTo-Json

Write-Host "=== Batch Process Pending ===" -ForegroundColor Cyan
Write-Host "Limit: $Limit"
Write-Host "Dry Run: $($DryRun.IsPresent)"
Write-Host ""

# Health check first
Write-Host "Checking pending count..." -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "$SUPABASE_URL/functions/v1/batch-process-pending" -Method Get
Write-Host "Pending documents: $($health.pending_count)" -ForegroundColor Green
Write-Host ""

if ($health.pending_count -eq 0) {
    Write-Host "No pending documents to process!" -ForegroundColor Green
    exit 0
}

# Run batch process
Write-Host "Starting batch process..." -ForegroundColor Yellow
try {
    $result = Invoke-RestMethod -Uri "$SUPABASE_URL/functions/v1/batch-process-pending" `
        -Method Post `
        -Headers $headers `
        -Body $body `
        -TimeoutSec 300

    Write-Host ""
    Write-Host "=== Result ===" -ForegroundColor Cyan

    if ($DryRun.IsPresent) {
        Write-Host "DRY RUN - Would process $($result.documents.Count) documents:" -ForegroundColor Yellow
        foreach ($doc in $result.documents) {
            Write-Host "  - $($doc.id): $($doc.betreff)" -ForegroundColor Gray
        }
    } else {
        Write-Host "Processed: $($result.processed)" -ForegroundColor Green
        Write-Host "Success: $($result.success_count)" -ForegroundColor Green
        Write-Host "Errors: $($result.error_count)" -ForegroundColor $(if ($result.error_count -gt 0) { "Red" } else { "Green" })

        if ($result.results) {
            Write-Host ""
            Write-Host "Details:" -ForegroundColor Cyan
            foreach ($r in $result.results) {
                $status = if ($r.success) { "[OK]" } else { "[FAIL]" }
                $color = if ($r.success) { "Green" } else { "Red" }
                $kategorie = if ($r.kategorie) { " -> $($r.kategorie)" } else { "" }
                $error = if ($r.error) { " - $($r.error)" } else { "" }
                Write-Host "  $status $($r.document_id.Substring(0,8))...$kategorie$error" -ForegroundColor $color
            }
        }
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
