# Firebase Database Schema

## Overview

This document describes the Firestore database schema for the ICT STMS application.

---

## Collections

### 1. `users`

Stores user information for all roles (admin, teacher, student).

**Document ID:** Auto-generated or UID from Firebase Auth

**Schema:**
```typescript
{
  uid: string,                    // Firebase Auth UID
  email: string,                  // User email
  name: string,                   // Full name
  role: 'admin' | 'teacher' | 'student',
  classId: string | null,         // Class ID (only for students)
  status: 'active' | 'banned',    // Account status
  createdAt: timestamp            // Account creation date
}
```

**Example:**
```json
{
  "uid": "abc123",
  "email": "john.doe@school.com",
  "name": "John Doe",
  "role": "student",
  "classId": "class-9a",
  "status": "active",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**Indexes:**
- `role` (for filtering users by role)
- `classId` (for querying students in a class)
- `status` (for filtering active/banned users)

---

### 2. `classes`

Stores class information.

**Document ID:** Auto-generated

**Schema:**
```typescript
{
  name: string,                   // Class name (e.g., "10A", "9B")
  subject: string,                // Subject/course name
  teacherId: string,              // UID of the teacher
  createdAt: timestamp,           // Creation date
  updatedAt: timestamp            // Last update date
}
```

**Example:**
```json
{
  "name": "10A",
  "subject": "Mathematics",
  "teacherId": "teacher-uid-123",
  "createdAt": "2024-01-10T09:00:00Z",
  "updatedAt": "2024-01-10T09:00:00Z"
}
```

**Indexes:**
- `teacherId` (for querying classes by teacher)

---

### 3. `tasks`

Stores homework/assignment tasks.

**Document ID:** Auto-generated

**Schema:**
```typescript
{
  title: string,                  // Task title
  description: string,            // Task description (can contain HTML)
  deadline: string,               // ISO 8601 datetime string
  priority: 'low' | 'medium' | 'high',
  assignedClasses: string[],      // Array of class IDs
  createdBy: string,              // Teacher UID who created the task
  createdAt: timestamp,           // Creation date
  updatedAt: timestamp            // Last update date
}
```

**Example:**
```json
{
  "title": "Math Homework - Chapter 5",
  "description": "Complete exercises 1-10 from page 45",
  "deadline": "2024-12-31T23:59:00Z",
  "priority": "high",
  "assignedClasses": ["class-10a", "class-10b"],
  "createdBy": "teacher-uid-123",
  "createdAt": "2024-12-01T10:00:00Z",
  "updatedAt": "2024-12-01T10:00:00Z"
}
```

**Indexes:**
- `assignedClasses` (array-contains for filtering by class)
- `createdBy` (for querying tasks by teacher)
- `deadline` (for sorting by deadline)

---

### 4. `submissions`

Stores student task submissions.

**Document ID:** Auto-generated

**Schema:**
```typescript
{
  taskId: string,                 // Reference to task
  studentId: string,              // Student UID
  studentName: string,            // Student name (denormalized)
  content: string,                // Submission content (answer)
  submittedAt: timestamp,         // Submission date
  revisedAt: timestamp | null,    // Last revision date
  grade: number | null,           // Grade (0-100)
  feedback: string,               // Teacher feedback/comment
  teacherComment: string,         // Alternative field for feedback
  gradedAt: timestamp | null      // Grading date
}
```

**Example:**
```json
{
  "taskId": "task-123",
  "studentId": "student-uid-456",
  "studentName": "John Doe",
  "content": "My answer: The result is 42...",
  "submittedAt": "2024-12-15T14:30:00Z",
  "revisedAt": null,
  "grade": 85,
  "feedback": "Good work! Minor mistakes in step 3.",
  "teacherComment": "Good work! Minor mistakes in step 3.",
  "gradedAt": "2024-12-16T10:00:00Z"
}
```

**Indexes:**
- `taskId` (for querying submissions by task)
- `studentId` (for querying submissions by student)
- Composite: `taskId + studentId` (for unique submission lookup)

---

### 5. `exams`

Stores exam/test information.

**Document ID:** Auto-generated

**Schema:**
```typescript
{
  title: string,                  // Exam title
  description: string,            // Exam description
  duration: number,               // Duration in minutes
  totalPoints: number,            // Total points
  passingGrade: number,           // Minimum passing grade
  assignedClasses: string[],      // Array of class IDs
  status: 'draft' | 'published',  // Exam status
  questions: Question[],          // Array of question objects
  createdBy: string,              // Teacher UID
  createdAt: timestamp,
  updatedAt: timestamp
}

type Question = {
  id: string,
  type: 'multiple_choice' | 'essay',
  question: string,
  points: number,
  options?: string[],             // For multiple choice
  correctAnswer?: string,         // For multiple choice
  attachment?: {                  // Optional attachment
    fileData: string,             // Base64 file data
    fileName: string,
    fileType: string,
    fileSize: number
  }
}
```

**Example:**
```json
{
  "title": "Mid-term Math Test",
  "description": "Covers chapters 1-5",
  "duration": 90,
  "totalPoints": 100,
  "passingGrade": 70,
  "assignedClasses": ["class-10a"],
  "status": "published",
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "question": "What is 2+2?",
      "points": 10,
      "options": ["3", "4", "5", "6"],
      "correctAnswer": "4"
    }
  ],
  "createdBy": "teacher-uid-123",
  "createdAt": "2024-12-01T09:00:00Z",
  "updatedAt": "2024-12-01T09:00:00Z"
}
```

**Indexes:**
- `assignedClasses` (array-contains)
- `status`
- `createdBy`

---

### 6. `exam_results`

Stores student exam results/attempts.

**Document ID:** Auto-generated

**Schema:**
```typescript
{
  examId: string,                 // Reference to exam
  studentId: string,              // Student UID
  studentName: string,            // Student name (denormalized)
  answers: Answer[],              // Array of answer objects
  score: number,                  // Total score
  percentage: number,             // Percentage score
  status: 'completed' | 'in_progress',
  startedAt: timestamp,           // Exam start time
  completedAt: timestamp | null,  // Exam completion time
  allowRetake: boolean,           // Whether student can retake
  attemptNumber: number           // Attempt number (1, 2, 3...)
}

type Answer = {
  questionId: string,
  answer: string,
  isCorrect: boolean,
  points: number
}
```

**Example:**
```json
{
  "examId": "exam-123",
  "studentId": "student-uid-456",
  "studentName": "John Doe",
  "answers": [
    {
      "questionId": "q1",
      "answer": "4",
      "isCorrect": true,
      "points": 10
    }
  ],
  "score": 85,
  "percentage": 85,
  "status": "completed",
  "startedAt": "2024-12-20T10:00:00Z",
  "completedAt": "2024-12-20T11:30:00Z",
  "allowRetake": false,
  "attemptNumber": 1
}
```

**Indexes:**
- `examId` (for querying results by exam)
- `studentId` (for querying results by student)
- Composite: `examId + studentId` (for lookup)

---

## Data Relationships

### Entity Relationship Diagram

```
users (teacher) ----< classes
                     |
                     |----< tasks
                     |      |
                     |      |----< submissions
                     |
                     |----< exams
                            |
                            |----< exam_results

users (student) ----< submissions
                 |
                 |----< exam_results
```

### Key Relationships:

1. **Teacher → Classes**: One-to-Many
   - One teacher can have multiple classes
   - `classes.teacherId` references `users.uid`

2. **Classes → Tasks**: Many-to-Many
   - Tasks can be assigned to multiple classes
   - `tasks.assignedClasses[]` contains class IDs

3. **Tasks → Submissions**: One-to-Many
   - One task can have many submissions
   - `submissions.taskId` references `tasks.id`

4. **Student → Submissions**: One-to-Many
   - One student can have many submissions
   - `submissions.studentId` references `users.uid`

5. **Exams → Results**: One-to-Many
   - One exam can have many results
   - `exam_results.examId` references `exams.id`

---

## Security Rules

### Recommended Firestore Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to get user role
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && 
                      (request.auth.uid == userId || getUserRole() == 'admin');
      allow delete: if getUserRole() == 'admin';
    }
    
    // Classes collection
    match /classes/{classId} {
      allow read: if isAuthenticated();
      allow write: if getUserRole() in ['admin', 'teacher'];
    }
    
    // Tasks collection
    match /tasks/{taskId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if getUserRole() in ['admin', 'teacher'];
    }
    
    // Submissions collection
    match /submissions/{submissionId} {
      allow read: if isAuthenticated();
      allow create: if getUserRole() == 'student';
      allow update: if getUserRole() in ['admin', 'teacher', 'student'];
      allow delete: if getUserRole() in ['admin', 'teacher'];
    }
    
    // Exams collection
    match /exams/{examId} {
      allow read: if isAuthenticated();
      allow write: if getUserRole() in ['admin', 'teacher'];
    }
    
    // Exam results collection
    match /exam_results/{resultId} {
      allow read: if isAuthenticated();
      allow create: if getUserRole() == 'student';
      allow update: if getUserRole() in ['admin', 'teacher'];
      allow delete: if getUserRole() in ['admin', 'teacher'];
    }
  }
}
```

---

## Data Migration

### If schema changes are needed:

1. Create backup of production data
2. Write migration script
3. Test on staging environment
4. Apply to production
5. Update security rules if needed

### Example Migration Script:

```javascript
// Add new field to all users
const usersRef = collection(db, 'users');
const snapshot = await getDocs(usersRef);

const batch = writeBatch(db);
snapshot.docs.forEach(doc => {
  batch.update(doc.ref, { status: 'active' });
});

await batch.commit();
```

---

## Backup Strategy

1. **Automatic Backups**: Enable Firebase automatic backups
2. **Manual Exports**: Export data regularly using Firebase CLI
3. **Version Control**: Keep schema documentation in Git

```bash
# Export Firestore data
firebase firestore:export gs://your-bucket/backups/$(date +%Y%m%d)
```

---

## Performance Optimization

### Indexes

Create composite indexes for common queries:

```
Collection: tasks
Fields: assignedClasses (Array) + deadline (Ascending)

Collection: submissions
Fields: taskId (Ascending) + studentId (Ascending)

Collection: exam_results
Fields: examId (Ascending) + studentId (Ascending)
```

### Denormalization

Some data is denormalized for performance:
- `submissions.studentName` (avoids extra user lookup)
- Task counts in class stats (calculated on write)

---

## Future Enhancements

Potential schema additions:

1. **Notifications Collection**: Real-time notifications
2. **Announcements Collection**: Class-wide announcements
3. **Attendance Collection**: Track student attendance
4. **Materials Collection**: Course materials/resources
5. **Messages Collection**: Direct messaging between users

