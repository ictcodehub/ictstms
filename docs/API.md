# API Documentation

## Table of Contents
- [Utility Functions](#utility-functions)
- [Hooks](#hooks)
- [Firebase Operations](#firebase-operations)
- [Context API](#context-api)

---

## Utility Functions

### classSort.js

#### `sortClasses(classes)`
Sort classes by grade level (number) then by section (letter).

**Parameters:**
- `classes` (Array): Array of class objects with `name` property

**Returns:**
- (Array): Sorted array of classes

**Example:**
```javascript
import { sortClasses } from '@/utils/classSort';

const classes = [
  { id: '1', name: '10A' },
  { id: '2', name: '7B' },
  { id: '3', name: '9A' }
];

const sorted = sortClasses(classes);
// Result: [{ name: '7B' }, { name: '9A' }, { name: '10A' }]
```

**Algorithm:**
1. Extract grade number and section letter using regex
2. Sort by grade number first
3. If same grade, sort by section letter alphabetically
4. Fallback to string comparison for non-standard names

---

### fileUtils.js

#### `validateFileType(file)`
Validate if file type is allowed.

**Parameters:**
- `file` (File): File object to validate

**Returns:**
- (Boolean): True if file type is allowed

**Allowed Types:**
- PDF (.pdf)
- Word Documents (.doc, .docx)
- Images (.png, .jpg, .jpeg)

**Example:**
```javascript
import { validateFileType } from '@/utils/fileUtils';

const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
const isValid = validateFileType(file); // true
```

---

#### `validateFileSize(file, maxSizeMB = 2)`
Validate if file size is within limit.

**Parameters:**
- `file` (File): File object to validate
- `maxSizeMB` (Number): Maximum file size in MB (default: 2)

**Returns:**
- (Boolean): True if file size is valid

**Example:**
```javascript
import { validateFileSize } from '@/utils/fileUtils';

const file = new File(['content'], 'document.pdf');
const isValid = validateFileSize(file, 5); // Check if < 5MB
```

---

#### `formatFileSize(bytes)`
Format file size from bytes to human readable format.

**Parameters:**
- `bytes` (Number): File size in bytes

**Returns:**
- (String): Formatted file size (e.g., "2.5 MB")

**Example:**
```javascript
import { formatFileSize } from '@/utils/fileUtils';

formatFileSize(1024);           // "1 KB"
formatFileSize(1024 * 1024);    // "1 MB"
formatFileSize(1500000);        // "1.43 MB"
```

---

#### `fileToBase64(file)`
Convert file to Base64 string.

**Parameters:**
- `file` (File): File to convert

**Returns:**
- (Promise<String>): Base64 string of the file

**Example:**
```javascript
import { fileToBase64 } from '@/utils/fileUtils';

const file = new File(['content'], 'document.pdf');
const base64 = await fileToBase64(file);
// "data:application/pdf;base64,..."
```

---

#### `processFileForFirestore(file, onProgress)`
Process file for Firestore storage (convert to Base64).

**Parameters:**
- `file` (File): File to process
- `onProgress` (Function): Callback for progress updates (0-100)

**Returns:**
- (Promise<Object>): Object with Base64 data and metadata

**Example:**
```javascript
import { processFileForFirestore } from '@/utils/fileUtils';

const result = await processFileForFirestore(file, (progress) => {
  console.log(`Progress: ${progress}%`);
});

// Result:
// {
//   fileData: "data:application/pdf;base64,...",
//   fileName: "document.pdf",
//   fileSize: 12345,
//   fileType: "application/pdf"
// }
```

---

#### `validateFile(file)`
Comprehensive file validation.

**Parameters:**
- `file` (File): File to validate

**Returns:**
- (Object): `{ valid: boolean, error: string }`

**Example:**
```javascript
import { validateFile } from '@/utils/fileUtils';

const result = validateFile(file);
if (!result.valid) {
  console.error(result.error);
}
```

---

### linkify.jsx

#### `LinkifiedText({ text })`
React component that converts URLs in text to clickable links.

**Props:**
- `text` (String): Text containing URLs

**Example:**
```jsx
import { LinkifiedText } from '@/utils/linkify';

<LinkifiedText text="Visit https://google.com for more" />
// Renders: Visit <a href="https://google.com">https://google.com</a> for more
```

**Features:**
- Detects URLs with http/https protocols
- Opens links in new tab
- Preserves non-URL text

---

### examSession.js

#### `validateExamSession(exam)`
Validate if exam is currently active.

**Parameters:**
- `exam` (Object): Exam object with `startDate` and `endDate`

**Returns:**
- (Object): `{ isActive: boolean, message: string }`

**Example:**
```javascript
import { validateExamSession } from '@/utils/examSession';

const result = validateExamSession({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31')
});

// { isActive: true, message: 'Exam is active' }
```

---

## Hooks

### useToast.js

Custom hook for managing toast notifications.

**Returns:**
- `toasts` (Array): Array of active toasts
- `showSuccess(message)` (Function): Show success toast
- `showError(message)` (Function): Show error toast
- `showWarning(message)` (Function): Show warning toast
- `showInfo(message)` (Function): Show info toast
- `removeToast(id)` (Function): Remove specific toast

**Example:**
```jsx
import { useToast } from '@/hooks/useToast';

function MyComponent() {
  const { showSuccess, showError } = useToast();
  
  const handleSubmit = async () => {
    try {
      await submitData();
      showSuccess('Data saved successfully!');
    } catch (error) {
      showError('Failed to save data');
    }
  };
}
```

---

### useGradeNotifications.js

Custom hook for real-time grade notifications.

**Parameters:**
- `userId` (String): Current user ID
- `userRole` (String): User role ('student' or 'teacher')

**Returns:**
- `notifications` (Array): Array of grade notifications
- `markAsRead(notificationId)` (Function): Mark notification as read

**Example:**
```jsx
import { useGradeNotifications } from '@/hooks/useGradeNotifications';

function Dashboard() {
  const { notifications } = useGradeNotifications(userId, 'student');
  
  return (
    <div>
      {notifications.map(notif => (
        <div key={notif.id}>{notif.message}</div>
      ))}
    </div>
  );
}
```

---

## Firebase Operations

### Authentication

#### `login(email, password, rememberMe)`
Login user with email and password.

**Parameters:**
- `email` (String): User email
- `password` (String): User password
- `rememberMe` (Boolean): Persist session

**Returns:**
- (Promise<UserCredential>): Firebase user credential

**Example:**
```javascript
import { useAuth } from '@/contexts/AuthContext';

const { login } = useAuth();
await login('user@example.com', 'password123', true);
```

---

#### `signup(email, password, name, role, classId)`
Register new user.

**Parameters:**
- `email` (String): User email
- `password` (String): User password
- `name` (String): User full name
- `role` (String): User role ('admin', 'teacher', 'student')
- `classId` (String, optional): Class ID for students

**Returns:**
- (Promise<UserCredential>): Firebase user credential

**Example:**
```javascript
await signup(
  'student@example.com',
  'password123',
  'John Doe',
  'student',
  'class-id-123'
);
```

---

### Firestore Operations

#### Tasks Collection

**Create Task:**
```javascript
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const taskData = {
  title: 'Math Homework',
  description: 'Complete exercises 1-10',
  deadline: '2024-12-31T23:59',
  priority: 'high',
  assignedClasses: ['class-1', 'class-2'],
  createdBy: userId,
  createdAt: serverTimestamp()
};

const docRef = await addDoc(collection(db, 'tasks'), taskData);
```

**Read Tasks:**
```javascript
import { collection, query, where, getDocs } from 'firebase/firestore';

const q = query(
  collection(db, 'tasks'),
  where('assignedClasses', 'array-contains', classId)
);

const snapshot = await getDocs(q);
const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

**Update Task:**
```javascript
import { doc, updateDoc } from 'firebase/firestore';

await updateDoc(doc(db, 'tasks', taskId), {
  title: 'Updated Title',
  description: 'Updated Description'
});
```

**Delete Task:**
```javascript
import { doc, deleteDoc } from 'firebase/firestore';

await deleteDoc(doc(db, 'tasks', taskId));
```

---

#### Submissions Collection

**Submit Task:**
```javascript
const submissionData = {
  taskId: 'task-123',
  studentId: userId,
  studentName: 'John Doe',
  content: 'My answer to the homework',
  submittedAt: serverTimestamp(),
  grade: null,
  feedback: ''
};

await addDoc(collection(db, 'submissions'), submissionData);
```

**Grade Submission:**
```javascript
await updateDoc(doc(db, 'submissions', submissionId), {
  grade: 85,
  feedback: 'Great work!',
  gradedAt: serverTimestamp()
});
```

---

## Context API

### AuthContext

Provides authentication state and methods.

**Available Values:**
- `currentUser` - Current authenticated user
- `userRole` - User role ('admin', 'teacher', 'student')
- `loading` - Loading state
- `login(email, password, rememberMe)` - Login function
- `signup(...)` - Signup function
- `logout()` - Logout function
- `resetPassword(email)` - Password reset function

**Usage:**
```jsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { currentUser, userRole, logout } = useAuth();
  
  return (
    <div>
      <p>Welcome, {currentUser.email}</p>
      <p>Role: {userRole}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

## Error Handling

### Standard Error Format

All API functions should handle errors consistently:

```javascript
try {
  await someOperation();
  showSuccess('Operation successful');
} catch (error) {
  console.error('Error:', error);
  showError('Operation failed: ' + error.message);
}
```

### Common Error Messages

- **Authentication Errors:**
  - `auth/invalid-email` - Invalid email format
  - `auth/user-not-found` - User doesn't exist
  - `auth/wrong-password` - Incorrect password
  - `auth/email-already-in-use` - Email already registered

- **Firestore Errors:**
  - `permission-denied` - Insufficient permissions
  - `not-found` - Document doesn't exist
  - `already-exists` - Document already exists

---

## Best Practices

1. **Always validate input** before Firebase operations
2. **Use serverTimestamp()** for timestamps
3. **Handle loading states** properly
4. **Show user feedback** (toasts) for all operations
5. **Clean up listeners** in useEffect cleanup
6. **Use TypeScript types** for better IDE support (future)

---

## Rate Limits

Firebase has the following limits:

- **Firestore Reads:** 50,000/day (free tier)
- **Firestore Writes:** 20,000/day (free tier)
- **Authentication:** 3,000/hour (free tier)

Plan accordingly for production usage.
