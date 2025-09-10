#!/bin/bash

# WordWise AI - Deploy Cloud Scheduler Jobs
# This script deploys the function warming scheduler jobs to Google Cloud

echo "🚀 Deploying WordWise AI Function Warming Scheduler Jobs..."

# Set project ID (update this with your actual project ID)
PROJECT_ID="wordwise-ai-3a4e1"
REGION="us-central1"

echo "📋 Project: $PROJECT_ID"
echo "🌍 Region: $REGION"

# Function to create a scheduler job
create_scheduler_job() {
    local job_name=$1
    local description=$2
    local schedule=$3
    local uri=$4
    
    echo "Creating job: $job_name"
    
    gcloud scheduler jobs create http "$job_name" \
        --project="$PROJECT_ID" \
        --location="$REGION" \
        --schedule="$schedule" \
        --uri="$uri" \
        --http-method="POST" \
        --headers="Content-Type=application/json" \
        --message-body="{}" \
        --description="$description" \
        --time-zone="UTC" \
        --quiet
        
    if [ $? -eq 0 ]; then
        echo "✅ Successfully created $job_name"
    else
        echo "❌ Failed to create $job_name"
    fi
}

# Create all scheduler jobs
echo "🔧 Creating scheduler jobs..."

create_scheduler_job \
    "warm-health-check" \
    "Keep main health check function warm" \
    "*/5 * * * *" \
    "https://us-central1-wordwise-ai-3a4e1.cloudfunctions.net/healthCheck"

create_scheduler_job \
    "warm-analyze-suggestions" \
    "Keep analyzeSuggestions function warm" \
    "1,6,11,16,21,26,31,36,41,46,51,56 * * * *" \
    "https://us-central1-wordwise-ai-3a4e1.cloudfunctions.net/warmAnalyzeSuggestions"

create_scheduler_job \
    "warm-analyze-essay-structure" \
    "Keep analyzeEssayStructure function warm" \
    "2,7,12,17,22,27,32,37,42,47,52,57 * * * *" \
    "https://us-central1-wordwise-ai-3a4e1.cloudfunctions.net/warmAnalyzeEssayStructure"

create_scheduler_job \
    "warm-parse-assignment-rubric" \
    "Keep parseAssignmentRubric function warm" \
    "3,8,13,18,23,28,33,38,43,48,53,58 * * * *" \
    "https://us-central1-wordwise-ai-3a4e1.cloudfunctions.net/warmParseAssignmentRubric"

create_scheduler_job \
    "warm-analyze-with-rubric" \
    "Keep analyzeWithRubric function warm" \
    "4,9,14,19,24,29,34,39,44,49,54,59 * * * *" \
    "https://us-central1-wordwise-ai-3a4e1.cloudfunctions.net/warmAnalyzeWithRubric"

create_scheduler_job \
    "warm-all-functions" \
    "Comprehensive warmup of all functions" \
    "0 */2 * * *" \
    "https://us-central1-wordwise-ai-3a4e1.cloudfunctions.net/warmAllFunctions"

echo "📊 Listing all created scheduler jobs..."
gcloud scheduler jobs list --project="$PROJECT_ID" --location="$REGION" --filter="name:warm-*"

echo "🎉 Function Warming Scheduler deployment complete!"
echo "💡 Jobs will start running automatically and keep your functions warm"
echo "🔍 Monitor job execution: https://console.cloud.google.com/cloudscheduler?project=$PROJECT_ID" 