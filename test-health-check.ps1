# WordWise AI - Test Health Check Endpoints

Write-Host "Testing WordWise AI Function Warming Health Checks..." -ForegroundColor Green

# Test URLs (update for production)
$BASE_URL = "http://localhost:5001/wordwise-ai-3a4e1/us-central1"
$PROD_URL = "https://us-central1-wordwise-ai-3a4e1.cloudfunctions.net"

# Use production URLs for testing
$USE_PRODUCTION = $true

# Function to test an endpoint
function Test-HealthEndpoint {
    param([string]$EndpointName, [string]$Url)
    
    Write-Host "Testing $EndpointName..." -ForegroundColor Yellow
    
    try {
        $headers = @{
            'Content-Type' = 'application/json'
        }
        
        $body = '{"test": true}'
        
        $response = Invoke-RestMethod -Uri $Url -Method POST -Headers $headers -Body $body -TimeoutSec 30
        
        Write-Host "SUCCESS: $EndpointName" -ForegroundColor Green
        Write-Host "   Status: $($response.status)" -ForegroundColor Cyan
        Write-Host "   Timestamp: $($response.timestamp)" -ForegroundColor Cyan
        
        if ($response.message) {
            Write-Host "   Message: $($response.message)" -ForegroundColor Cyan
        }
        
        return $true
    }
    catch {
        Write-Host "FAILED: $EndpointName" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

if ($USE_PRODUCTION) {
    Write-Host "Testing Production Endpoints..." -ForegroundColor Cyan
    $BASE_URL = $PROD_URL
} else {
    Write-Host "Testing Local Emulator Endpoints..." -ForegroundColor Cyan
}

$endpoints = @(
    @{Name = "healthCheck"; Url = "$BASE_URL/healthCheck"},
    @{Name = "warmAnalyzeSuggestions"; Url = "$BASE_URL/warmAnalyzeSuggestions"},
    @{Name = "warmAnalyzeEssayStructure"; Url = "$BASE_URL/warmAnalyzeEssayStructure"},
    @{Name = "warmParseAssignmentRubric"; Url = "$BASE_URL/warmParseAssignmentRubric"},
    @{Name = "warmAnalyzeWithRubric"; Url = "$BASE_URL/warmAnalyzeWithRubric"},
    @{Name = "warmAllFunctions"; Url = "$BASE_URL/warmAllFunctions"}
)

$successCount = 0
$totalCount = $endpoints.Count

foreach ($endpoint in $endpoints) {
    if (Test-HealthEndpoint -EndpointName $endpoint.Name -Url $endpoint.Url) {
        $successCount++
    }
    Start-Sleep -Seconds 1
}

Write-Host "`nTest Results:" -ForegroundColor Cyan
Write-Host "   Successful: $successCount/$totalCount" -ForegroundColor Green

if ($successCount -eq $totalCount) {
    Write-Host "All health check endpoints are working correctly!" -ForegroundColor Green
} else {
    Write-Host "Some endpoints failed. Check the Firebase function logs." -ForegroundColor Yellow
}

Write-Host "`nTo test production endpoints, update BASE_URL to:" -ForegroundColor Yellow
Write-Host "   $PROD_URL" -ForegroundColor Cyan 