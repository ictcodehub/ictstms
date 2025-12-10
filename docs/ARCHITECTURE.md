# Architecture Documentation

## System Overview

ICT STMS (Student Task Management System) is a modern web application built with React and Firebase for managing educational tasks, assignments, and assessments.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer (React)                  │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Teacher    │  │   Student    │  │    Admin     │ │
│  │  Dashboard   │  │  Dashboard   │  │  Dashboard   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Shared Components & Layouts             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Context    │  │    Hooks     │  │   Utils      │ │
│  │  (Auth, etc) │  │  (Custom)    │  │  (Helpers)   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Firebase Backend Services                   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │     Auth     │  │  Firestore   │  │   Hosting    │ │
│  │ (User Login) │  │  (Database)  │  │   (Deploy)   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
- **React 19.2.0** - UI library
- **Vite 7.2.4** - Build tool & dev server
- **React Router DOM 7.9.6** - Client-side routing
- **Tailwind CSS 3.3.0** - Utility-first CSS
- **Framer Motion 12.23.24** - Animation library
- **Lucide React 0.554.0** - Icon library

### Backend
- **Firebase Authentication** - User authentication
- **Cloud Firestore** - NoSQL database
- **Firebase Hosting** - Static site hosting

### State Management
- **React Context API** - Global state (Auth)
- **Local Component State** - Component-level state
- **Real-time Listeners** - Firebase onSnapshot

### Testing
- **Vitest 4.0.15** - Test runner
- **Testing Library** - Component testing
- **Happy DOM** - DOM implementation

---

## Project Structure

```
ictstms/
├── public/                      # Static assets
│   ├── favicon.ico
│   └── logo.png
│
├── src/
│   ├── assets/                  # Images, fonts, etc.
│   │
│   ├── components/              # Reusable components
│   │   ├── Toast.jsx
│   │   ├── ToastContainer.jsx
│   │   ├── FileUpload.jsx
│   │   ├── ProfileDropdown.jsx
│   │   ├── HamburgerButton.jsx
│   │   └── ErrorBoundary.jsx
│   │
│   ├── contexts/                # React contexts
│   │   └── AuthContext.jsx     # Authentication context
│   │
│   ├── hooks/                   # Custom hooks
│   │   ├── useToast.js
│   │   └── useGradeNotifications.js
│   │
│   ├── layouts/                 # Layout components
│   │   └── DashboardLayout.jsx
│   │
│   ├── lib/                     # Third-party configs
│   │   └── firebase.js          # Firebase initialization
│   │
│   ├── pages/                   # Page components
│   │   ├── admin/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── UserManagement.jsx
│   │   │   └── AdminLayout.jsx
│   │   ├── teacher/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Tasks.jsx
│   │   │   ├── TaskDetail.jsx
│   │   │   ├── Classes.jsx
│   │   │   ├── ClassDetail.jsx
│   │   │   ├── Students.jsx
│   │   │   ├── StudentDetail.jsx
│   │   │   ├── Exams.jsx
│   │   │   ├── ExamEditor.jsx
│   │   │   ├── ExamResults.jsx
│   │   │   ├── Gradebook.jsx
│   │   │   └── Overview.jsx
│   │   ├── student/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Tasks.jsx
│   │   │   ├── StudentExams.jsx
│   │   │   ├── ExamTaker.jsx
│   │   │   ├── Grades.jsx
│   │   │   └── Overview.jsx
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   └── ForgotPassword.jsx
│   │
│   ├── utils/                   # Utility functions
│   │   ├── linkify.jsx
│   │   ├── fileUtils.js
│   │   ├── classSort.js
│   │   └── examSession.js
│   │
│   ├── App.jsx                  # Main app component
│   ├── App.css                  # Global styles
│   ├── main.jsx                 # Entry point
│   └── index.css                # Tailwind imports
│
├── tests/                       # Test files
│   ├── setup.js
│   └── integration/
│       ├── auth.test.jsx
│       └── task-flow.test.jsx
│
├── docs/                        # Documentation
│   ├── API.md
│   ├── FIREBASE_SCHEMA.md
│   ├── COMPONENTS.md
│   └── ARCHITECTURE.md
│
├── .firebase/                   # Firebase cache
├── .github/                     # GitHub workflows
├── legacy/                      # Old codebase
│
├── .firebaserc                  # Firebase project config
├── .gitignore
├── eslint.config.js
├── firebase.json
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── vitest.config.js
├── README.md
├── DEVELOPMENT_WORKFLOW.md
├── TESTING_GUIDE.md
└── TRANSLATION_TODO.md
```

---

## Data Flow

### Authentication Flow

```
1. User enters credentials
   ↓
2. AuthContext.login() called
   ↓
3. Firebase Auth validates
   ↓
4. onAuthStateChanged triggered
   ↓
5. Fetch user role from Firestore
   ↓
6. Update context state
   ↓
7. Redirect to role-based dashboard
```

### Task Creation Flow (Teacher)

```
1. Teacher fills task form
   ↓
2. Client validates input
   ↓
3. addDoc() to Firestore 'tasks' collection
   ↓
4. Real-time listener updates UI
   ↓
5. Toast notification shown
   ↓
6. Modal closed
```

### Task Submission Flow (Student)

```
1. Student views task
   ↓
2. Writes answer in textarea
   ↓
3. Clicks submit button
   ↓
4. Client validates (non-empty)
   ↓
5. addDoc() to 'submissions' collection
   ↓
6. Real-time listener updates teacher view
   ↓
7. Success toast shown
```

### Grading Flow (Teacher)

```
1. Teacher opens submission
   ↓
2. Enters grade (0-100) and feedback
   ↓
3. Client validates grade range
   ↓
4. updateDoc() submission document
   ↓
5. Real-time listener updates student view
   ↓
6. Student receives grade notification
```

---

## State Management Strategy

### Global State (Context API)

**AuthContext:**
- Current user
- User role
- Loading state
- Auth methods (login, logout, signup)

**Usage:**
```jsx
const { currentUser, userRole, logout } = useAuth();
```

### Local State (useState)

Component-level state for:
- Form inputs
- UI state (modals, dropdowns)
- Loading indicators
- Filtered/sorted data

### Real-time State (Firebase Listeners)

Real-time updates using `onSnapshot`:
- Tasks list
- Submissions
- Grades
- Exam results

**Pattern:**
```jsx
useEffect(() => {
  const unsubscribe = onSnapshot(query(...), (snapshot) => {
    setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
  return () => unsubscribe();
}, [dependencies]);
```

---

## Routing Structure

### Public Routes
- `/login` - Login page
- `/register` - Registration page
- `/forgot-password` - Password reset

### Protected Routes

**Teacher Routes (`/teacher/*`)**
- `/teacher` - Dashboard overview
- `/teacher/tasks` - Task management
- `/teacher/tasks/:id` - Task details
- `/teacher/classes` - Class management
- `/teacher/classes/:id` - Class details
- `/teacher/students` - Student list
- `/teacher/students/:id` - Student details
- `/teacher/exams` - Exam list
- `/teacher/exams/create` - Create exam
- `/teacher/exams/:id/edit` - Edit exam
- `/teacher/exams/:id/results` - View results
- `/teacher/gradebook` - Grade book

**Student Routes (`/student/*`)**
- `/student` - Dashboard overview
- `/student/tasks` - View & submit tasks
- `/student/exams` - View available exams
- `/student/exams/:id/take` - Take exam
- `/student/grades` - View grades

**Admin Routes (`/admin/*`)**
- `/admin` - Admin dashboard
- `/admin/users` - User management

### Route Protection

```jsx
<ProtectedRoute role="teacher">
  <TeacherDashboard />
</ProtectedRoute>
```

---

## Security Architecture

### Client-Side Security

1. **Route Protection**
   - Check authentication before rendering
   - Verify role matches required role
   - Redirect unauthorized users

2. **Input Validation**
   - Validate all form inputs
   - Sanitize user input
   - Check file types and sizes

3. **Error Handling**
   - Never expose sensitive errors
   - Log errors securely
   - Show user-friendly messages

### Server-Side Security (Firebase)

1. **Firestore Security Rules**
   - Role-based access control
   - Document-level permissions
   - Field-level validation

2. **Authentication**
   - Email/password authentication
   - Session management
   - Password reset flow

3. **Data Validation**
   - Type checking in rules
   - Required field validation
   - Size limits

---

## Performance Optimizations

### Code Splitting

```jsx
// Route-based code splitting
const TeacherDashboard = lazy(() => import('./pages/teacher/Dashboard'));
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
```

### Lazy Loading

- Images loaded on demand
- Components loaded on route change
- Firebase listeners cleaned up properly

### Memoization

```jsx
const sortedData = useMemo(() => {
  return data.sort((a, b) => a.name.localeCompare(b.name));
}, [data]);
```

### Debouncing

```jsx
// Search input debounced
const debouncedSearch = useDebounce(searchTerm, 300);
```

---

## Deployment Architecture

### Development

```
Local Machine
├── npm run dev (Vite dev server)
├── http://localhost:5173
└── Firebase Emulators (optional)
```

### Production

```
GitHub Repository
    ↓ (push to main)
GitHub Actions (CI/CD)
    ↓ (build & test)
Firebase Hosting
    ↓ (deploy)
Production URL
```

### Build Process

```bash
npm run build
  ↓
Vite bundles app
  ↓
Optimizes assets
  ↓
Outputs to dist/
  ↓
firebase deploy
```

---

## Scalability Considerations

### Current Limits

- **Users**: ~10,000 users (free tier)
- **Concurrent users**: ~100 simultaneous
- **Data**: 1GB storage (free tier)
- **Bandwidth**: 10GB/month (free tier)

### Scaling Strategies

1. **Vertical Scaling**
   - Upgrade Firebase plan
   - Enable Firebase extensions
   - Add caching layer

2. **Horizontal Scaling**
   - Implement pagination
   - Lazy load data
   - Use batch operations

3. **Data Optimization**
   - Index frequently queried fields
   - Denormalize when appropriate
   - Archive old data

---

## Monitoring & Logging

### Client-Side

```jsx
// Error boundary catches errors
<ErrorBoundary>
  <App />
</ErrorBoundary>

// Console logging in development
if (import.meta.env.DEV) {
  console.log('Debug info:', data);
}
```

### Server-Side

- Firebase Console for metrics
- Authentication logs
- Firestore usage stats
- Hosting analytics

---

## Future Architecture Enhancements

### Planned Improvements

1. **Backend Functions**
   - Cloud Functions for complex operations
   - Scheduled tasks (reminders, deadlines)
   - Email notifications

2. **Caching Layer**
   - Redis for frequently accessed data
   - Service Worker for offline support

3. **Real-time Features**
   - WebSocket for live updates
   - Collaborative editing
   - Chat/messaging

4. **Analytics**
   - User behavior tracking
   - Performance monitoring
   - Error tracking (Sentry)

5. **Multi-tenancy**
   - Support multiple schools
   - Organization management
   - Isolated data per tenant

---

## Development Best Practices

### Code Style

- Use ES6+ features
- Functional components only
- Hooks for state management
- Consistent naming conventions

### Git Workflow

- Feature branches
- Pull request reviews
- Semantic commit messages
- CI/CD on main branch

### Testing Strategy

- Unit tests for utilities
- Component tests for UI
- Integration tests for flows
- E2E tests for critical paths

### Documentation

- Code comments for complex logic
- JSDoc for functions
- README for setup
- Architecture docs for system design

