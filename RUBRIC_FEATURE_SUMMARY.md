# Rubric-Based Feedback Feature

## Overview
Added a comprehensive rubric-based feedback system that allows users to paste assignment prompts or grading rubrics, parse and extract key expectations, and receive real-time feedback on how well their writing matches the assignment criteria.

## New Components

### 1. Type Definitions (`src/types/suggestion.ts`)
- **RubricCriterion**: Defines individual grading criteria with weights and types
- **AssignmentRubric**: Complete rubric structure with extracted requirements
- **RubricAnalysisResult**: Results for each criterion evaluation
- **RubricFeedback**: Overall feedback with scores and suggestions
- **RubricAnalysisRequest/Response**: API interfaces for rubric analysis

### 2. Rubric Service (`src/services/rubricService.ts`)
- **parseRubricText()**: AI-powered parsing of raw rubric text
- **getRubric()**: Retrieve stored rubrics
- **getDocumentRubrics()**: Get all rubrics for a document
- **requestRubricAnalysis()**: Request AI analysis against rubric
- **getLatestRubricFeedback()**: Get latest feedback results
- **extractBasicRequirements()**: Fallback parser for basic requirements

### 3. Rubric Manager (`src/components/ai/RubricManager.tsx`)
- Interface for adding, viewing, and managing rubrics
- Paste assignment prompts or rubrics for AI parsing
- Visual display of criteria and requirements
- Rubric selection and deletion

### 4. Rubric Feedback Panel (`src/components/ai/RubricFeedbackPanel.tsx`)
- Real-time analysis of writing against selected rubric
- Detailed breakdown by criterion with scores
- Word count tracking against requirements
- Specific suggestions for improvement
- Visual indicators for met/missed expectations

### 5. Updated Document Editor (`src/pages/DocumentEditor.tsx`)
- Added "Rubrics" button in header
- Tabbed interface for Suggestions vs. Rubric feedback
- Modal for rubric management
- Integrated rubric selection and analysis

## Features

### Rubric Parsing
- **Smart Extraction**: AI parses assignment prompts to identify:
  - Word count requirements (min/max)
  - Citation requirements (count and style)
  - Structural requirements (introduction, thesis, etc.)
  - Tone and format expectations
  - Grading criteria with weights

### Real-Time Feedback
- **Criterion-by-Criterion Analysis**: Detailed scoring for each rubric criterion
- **Overall Score**: Weighted average based on criterion importance
- **Specific Issues**: Pinpointed problems with improvement suggestions
- **Requirements Checklist**: Visual tracking of basic requirements (word count, citations)

### Assignment Types Supported
- Essays
- Reflections
- Reports
- Research Papers
- Creative Writing
- Other/Custom assignments

### User Experience
- **Simple Input**: Just paste the assignment prompt or rubric text
- **Visual Feedback**: Color-coded scores and clear progress indicators
- **Contextual Suggestions**: Specific recommendations tied to rubric criteria
- **Requirements Tracking**: Real-time word count and citation tracking

## Integration Points

### Firebase Functions (Required)
Two new cloud functions need to be implemented:
1. **parseAssignmentRubric**: Parses raw rubric text using AI
2. **analyzeWithRubric**: Analyzes content against rubric criteria

### Database Collections
- **rubrics**: Stores parsed assignment rubrics
- **rubricFeedback**: Stores analysis results and feedback
- **essayStructures**: Enhanced for rubric-aware structure analysis

### Updated Firestore Rules
Added security rules for:
- User rubric management
- Rubric feedback access
- Essay structure permissions

## Usage Flow

1. **Add Rubric**: User clicks "Rubrics" button and pastes assignment prompt
2. **AI Parsing**: System extracts criteria, requirements, and weights
3. **Writing Analysis**: As user writes, content is analyzed against rubric
4. **Real-Time Feedback**: Detailed scores and suggestions provided
5. **Requirement Tracking**: Word count and other requirements monitored
6. **Iterative Improvement**: User refines writing based on rubric feedback

## Benefits

- **Assignment-Specific Guidance**: Feedback tailored to actual assignment requirements
- **Comprehensive Analysis**: Goes beyond grammar to evaluate content quality
- **Learning Support**: Helps students understand rubric expectations
- **Time Efficiency**: Reduces need for manual rubric checking
- **Consistent Standards**: Ensures writing meets assignment criteria

This feature transforms WordWise AI from a general writing assistant into a rubric-aware academic writing coach that provides targeted, assignment-specific feedback. 