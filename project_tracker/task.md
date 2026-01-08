# Task: Add Essay & Short Answer Question Types to Exam System

## Overview
Implement 2 new question types (Essay & Short Answer) for the exam system with manual grading capability.

## Checklist

### Planning
- [x] Analyze current exam structure
- [x] Design data model for text-based answers
- [x] Plan manual grading UI flow

### Implementation - Grading System
- [x] Update auto-grading to skip Essay/Short Answer
- [x] Add grading status tracking (pending/partial/complete)
- [x] Create manual grading UI in ExamResults
- [x] Add score input & feedback fields
- [x] Update total score calculation (hybrid)

### Implementation - Review
- [x] Update ExamReview to show Expected Answer conditionally
- [x] Add pending status indicator for students
- [x] Show teacher feedback in review

### Verification
- [x] Test creating exam with Essay questions
- [x] Test student submission flow
- [x] Test manual grading by teacher
- [x] Test score calculation (auto + manual)
- [x] Test review mode with showResultToStudents
- [x] Revert "Premium" modal in ExamTaker to "Classic" style but keep Pending logic

