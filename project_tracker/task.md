# Task: Add Essay & Short Answer Question Types to Exam System

## Overview
Implement 2 new question types (Essay & Short Answer) for the exam system with manual grading capability.

## Checklist

### Planning
- [/] Analyze current exam structure
- [/] Design data model for text-based answers
- [/] Plan manual grading UI flow

### Implementation - Teacher Side
- [x] Add Essay & Short Answer to type dropdown in ExamEditor
- [x] Add Expected Answer UI for text-based questions
- [x] Add character limit field for Short Answer
- [x] Update validation logic for new types
- [ ] Update Excel import template

### Implementation - Student Side
- [/] Add textarea for Essay questions in ExamTaker
- [/] Add text input for Short Answer in ExamTaker
- [ ] Update submission logic to handle textAnswer
- [ ] Add character counter for Short Answer

### Implementation - Grading System
- [ ] Update auto-grading to skip Essay/Short Answer
- [ ] Add grading status tracking (pending/partial/complete)
- [ ] Create manual grading UI in ExamResults
- [ ] Add score input & feedback fields
- [ ] Update total score calculation (hybrid)

### Implementation - Review
- [ ] Update ExamReview to show Expected Answer conditionally
- [ ] Add pending status indicator for students
- [ ] Show teacher feedback in review

### Verification
- [ ] Test creating exam with Essay questions
- [ ] Test student submission flow
- [ ] Test manual grading by teacher
- [ ] Test score calculation (auto + manual)
- [ ] Test review mode with showResultToStudents
