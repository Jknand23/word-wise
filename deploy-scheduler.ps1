# WordWise AI - Deploy Cloud Scheduler Jobs (PowerShell)
# This script deploys the function warming scheduler jobs to Google Cloud

Write-Host "Deploying WordWise AI Function Warming Scheduler Jobs..." -ForegroundColor Green

# Set project ID (update this with your actual project ID)
$PROJECT_ID = "wordwise-ai-3a4e1"
$REGION = "us-central1"

Write-Host "Project: $PROJECT_ID" -ForegroundColor Cyan
Write-Host "Region: $REGION" -ForegroundColor Cyan

# Function to create a scheduler job
function Create-SchedulerJob {
    param(
        [string]$JobName,
        [string]$Description,
        [string]$Schedule,
        [string]$Uri
    )
    
    Write-Host "Creating job: $JobName" -ForegroundColor Yellow
    
    $result = gcloud scheduler jobs create http $JobName `
        --project="$PROJECT_ID" `
        --location="$REGION" `
        --schedule="$Schedule" `
        --uri="$Uri" `
        --http-method="POST" `
        --headers="Content-Type=application/json" `
        --message-body="{}" `
        --description="$Description" `
        --time-zone="UTC" `
        --quiet 2>&1
        
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully created $JobName" -ForegroundColor Green
    } else {
        Write-Host "Failed to create $JobName" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
}

# Create all scheduler jobs
Write-Host "Creating scheduler jobs..." -ForegroundColor Cyan

Create-SchedulerJob `
    -JobName "warm-health-check" `
    -Description "Keep main health check function warm" `
    -Schedule "*/5 * * * *" `
    -Uri "https://us-central1-wordwise-ai-3a4e1.cloudfunctions.net/healthCheck"

Create-SchedulerJob `
    -JobName "warm-analyze-suggestions" `
    -Description "Keep analyzeSuggestions function warm" `
    -Schedule "1,6,11,16,21,26,31,36,41,46,51,56 * * * *" `
    -Uri "https://us-central1-wordwise-ai-3a4e1.cloudfunctions.net/warmAnalyzeSuggestions"

Create-SchedulerJob `
    -JobName "warm-analyze-essay-structure" `
    -Description "Keep analyzeEssayStructure function warm" `
    -Schedule "2,7,12,17,22,27,32,37,42,47,52,57 * * * *" `
    -Uri "https://us-central1-wordwise-ai-3a4e1.cloudfunctions.net/warmAnalyzeEssayStructure"

Create-SchedulerJob `
    -JobName "warm-parse-assignment-rubric" `
    -Description "Keep parseAssignmentRubric function warm" `
    -Schedule "3,8,13,18,23,28,33,38,43,48,53,58 * * * *" `
    -Uri "https://us-central1-wordwise-ai-3a4e1.cloudfunctions.net/warmParseAssignmentRubric"

Create-SchedulerJob `
    -JobName "warm-analyze-with-rubric" `
    -Description "Keep analyzeWithRubric function warm" `
    -Schedule "4,9,14,19,24,29,34,39,44,49,54,59 * * * *" `
    -Uri "https://us-central1-wordwise-ai-3a4e1.cloudfunctions.net/warmAnalyzeWithRubric"

Create-SchedulerJob `
    -JobName "warm-all-functions" `
    -Description "Comprehensive warmup of all functions" `
    -Schedule "0 */2 * * *" `
    -Uri "https://us-central1-wordwise-ai-3a4e1.cloudfunctions.net/warmAllFunctions"

Write-Host "Listing all created scheduler jobs..." -ForegroundColor Cyan
gcloud scheduler jobs list --project="$PROJECT_ID" --location="$REGION" --filter="name:warm-*"

Write-Host "Function Warming Scheduler deployment complete!" -ForegroundColor Green
Write-Host "Jobs will start running automatically and keep your functions warm" -ForegroundColor Yellow
Write-Host "Monitor job execution: https://console.cloud.google.com/cloudscheduler?project=$PROJECT_ID" -ForegroundColor Cyan 