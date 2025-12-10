# Component Documentation

## Table of Contents
- [Reusable Components](#reusable-components)
- [Layout Components](#layout-components)
- [Page Components](#page-components)
- [Component Props](#component-props)

---

## Reusable Components

### Toast.jsx

Toast notification component for displaying messages.

**Props:**
```typescript
{
  id: string,
  message: string,
  type: 'success' | 'error' | 'warning' | 'info',
  onClose: (id: string) => void
}
```

**Usage:**
```jsx
<Toast
  id="toast-1"
  message="Task created successfully!"
  type="success"
  onClose={handleClose}
/>
```

**Features:**
- Auto-dismisses after 5 seconds
- Click to dismiss manually
- Smooth animations with Framer Motion
- Color-coded by type
- Icon for each type

---

### ToastContainer.jsx

Container for managing multiple toast notifications.

**Props:**
```typescript
{
  toasts: Array<{
    id: string,
    message: string,
    type: string
  }>,
  removeToast: (id: string) => void
}
```

**Usage:**
```jsx
<ToastContainer toasts={toasts} removeToast={removeToast} />
```

**Features:**
- Stacks toasts vertically
- Fixed position at top-right
- Manages z-index properly

---

### FileUpload.jsx

File upload component with validation and preview.

**Props:**
```typescript
{
  onFileSelect: (fileData: Object) => void,
  accept: string,
  maxSize: number,
  disabled: boolean
}
```

**Usage:**
```jsx
<FileUpload
  onFileSelect={(data) => setFile(data)}
  accept=".pdf,.docx,.png,.jpg"
  maxSize={2}
  disabled={uploading}
/>
```

**Features:**
- Drag & drop support
- File type validation
- File size validation
- Preview uploaded file
- Progress indicator
- Error messages

**File Data Format:**
```javascript
{
  fileData: "data:application/pdf;base64,...",
  fileName: "document.pdf",
  fileSize: 12345,
  fileType: "application/pdf"
}
```

---

### ProfileDropdown.jsx

User profile dropdown menu.

**Props:**
```typescript
{
  user: {
    name: string,
    email: string,
    role: string
  },
  onLogout: () => void
}
```

**Usage:**
```jsx
<ProfileDropdown
  user={{ name: 'John Doe', email: 'john@example.com', role: 'teacher' }}
  onLogout={handleLogout}
/>
```

**Features:**
- Shows user avatar (initials)
- Displays name, email, and role
- Logout button
- Dropdown animation
- Click outside to close

---

### HamburgerButton.jsx

Mobile menu toggle button.

**Props:**
```typescript
{
  isOpen: boolean,
  onClick: () => void
}
```

**Usage:**
```jsx
<HamburgerButton isOpen={isMobileMenuOpen} onClick={toggleMenu} />
```

**Features:**
- Animated hamburger to X transition
- Smooth CSS transitions
- Mobile-only visibility

---

### ErrorBoundary.jsx

Error boundary component for catching React errors.

**Props:**
```typescript
{
  children: ReactNode
}
```

**Usage:**
```jsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

**Features:**
- Catches JavaScript errors in child components
- Displays fallback UI with error message
- Logs errors to console
- Prevents app crash

---

## Layout Components

### DashboardLayout.jsx

Main layout wrapper for dashboard pages.

**Props:**
```typescript
{
  children: ReactNode
}
```

**Features:**
- Sidebar navigation
- Top header with profile
- Responsive mobile menu
- Logout functionality
- Role-based menu items

**Navigation Structure:**
```
Teacher:
- Overview
- Tasks
- Classes
- Students
- Exams
- Gradebook

Student:
- Overview
- Tasks
- Exams
- Grades

Admin:
- Dashboard
- User Management
```

---

## Page Components

### Teacher Pages

#### Tasks.jsx

Task management page for teachers.

**Features:**
- Create new tasks
- Edit existing tasks
- Delete tasks
- Filter by status (active/overdue)
- Filter by class
- Search tasks
- Sort by date/deadline
- Pagination
- View task details
- Assign to multiple classes

**State Management:**
```javascript
{
  tasks: [],
  loading: boolean,
  showModal: boolean,
  editingTask: object | null,
  formData: {
    title: string,
    description: string,
    deadline: string,
    assignedClasses: []
  },
  searchQuery: string,
  filterStatus: 'all' | 'active' | 'overdue',
  filterClass: string,
  sortBy: string,
  currentPage: number
}
```

---

#### TaskDetail.jsx

Detailed view of a task with student submissions.

**Features:**
- View task details
- List all student submissions
- Filter submissions by class
- Sort submissions
- Grade submissions
- Add feedback
- View submission history
- Statistics (total, submitted, graded, average)

---

#### Classes.jsx

Class management page.

**Features:**
- Create new classes
- Edit class information
- Delete classes
- View class details
- Search classes
- Sort classes alphabetically
- View student count per class

---

#### Students.jsx

Student management page.

**Features:**
- View all students
- Filter by class
- Search students
- Edit student information
- Delete students
- View student statistics
- Sort students
- Pagination

---

#### Gradebook.jsx

Comprehensive grade book view.

**Features:**
- View all student grades
- Filter by class
- Sort by name/grade
- View student details
- View task history
- Calculate statistics
- Export grades (future)

---

### Student Pages

#### Tasks.jsx (Student)

Student task list and submission page.

**Features:**
- View assigned tasks
- Submit task answers
- Edit submissions (before grading)
- View grades and feedback
- Filter by status
- Search tasks
- View task details
- Real-time submission status

---

#### Grades.jsx

Student grades overview.

**Features:**
- View all graded tasks
- View all exam grades
- Calculate average
- View feedback
- Sort by date
- Filter by type (task/exam)
- Statistics (total graded, average, highest)

---

### Admin Pages

#### UserManagement.jsx

User administration page.

**Features:**
- View all users
- Create new users
- Edit user information
- Delete users
- Ban/unban users
- Filter by role
- Search users
- Assign classes to students

---

## Component Patterns

### Loading States

**Standard pattern:**
```jsx
{loading ? (
  <div className="flex justify-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
) : (
  <Content />
)}
```

---

### Empty States

**Standard pattern:**
```jsx
{data.length === 0 ? (
  <div className="text-center py-16">
    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
      <Icon className="h-10 w-10 text-slate-400" />
    </div>
    <h3 className="text-xl font-bold text-slate-800 mb-2">No Data Found</h3>
    <p className="text-slate-500">Description of empty state</p>
  </div>
) : (
  <DataList />
)}
```

---

### Modal Pattern

**Standard pattern:**
```jsx
<AnimatePresence>
  {showModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white">
          <h2>Modal Title</h2>
        </div>
        <div className="p-6">
          {/* Modal Content */}
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>
```

---

### Form Pattern

**Standard pattern:**
```jsx
<form onSubmit={handleSubmit} className="space-y-5">
  <div>
    <label className="block text-sm font-semibold text-slate-700 mb-2">
      Field Name <span className="text-red-500">*</span>
    </label>
    <input
      type="text"
      required
      value={formData.field}
      onChange={(e) => setFormData({ ...formData, field: e.target.value })}
      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
    />
  </div>
  
  <div className="flex gap-3">
    <button type="button" onClick={onCancel} className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-400 bg-white text-slate-800 font-bold">
      Cancel
    </button>
    <button type="submit" disabled={loading} className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold">
      {loading ? 'Saving...' : 'Save'}
    </button>
  </div>
</form>
```

---

## Styling Guidelines

### Color Palette

```css
/* Primary Colors */
--blue-600: #2563eb;
--cyan-600: #0891b2;

/* Status Colors */
--success: #10b981; /* green */
--error: #ef4444;   /* red */
--warning: #f59e0b; /* amber */
--info: #3b82f6;    /* blue */

/* Neutral Colors */
--slate-50: #f8fafc;
--slate-100: #f1f5f9;
--slate-500: #64748b;
--slate-800: #1e293b;
```

### Typography

```css
/* Headings */
.heading-xl { font-size: 3rem; font-weight: 800; }
.heading-lg { font-size: 2rem; font-weight: 700; }
.heading-md { font-size: 1.5rem; font-weight: 600; }

/* Body */
.text-base { font-size: 1rem; }
.text-sm { font-size: 0.875rem; }
.text-xs { font-size: 0.75rem; }
```

### Spacing

```css
/* Consistent spacing scale */
.p-1  { padding: 0.25rem; }
.p-2  { padding: 0.5rem; }
.p-4  { padding: 1rem; }
.p-6  { padding: 1.5rem; }
.p-8  { padding: 2rem; }
```

---

## Accessibility

### Best Practices

1. **Semantic HTML**
   - Use proper heading hierarchy (h1, h2, h3)
   - Use `<button>` for clickable elements
   - Use `<form>` for forms

2. **ARIA Labels**
   ```jsx
   <button aria-label="Close modal">
     <X />
   </button>
   ```

3. **Keyboard Navigation**
   - All interactive elements focusable
   - Proper tab order
   - Escape to close modals

4. **Focus States**
   - Visible focus indicators
   - Use `focus:ring-2` for all inputs

---

## Performance

### Optimization Tips

1. **Code Splitting**
   - Use React.lazy() for route-based splitting
   - Load components on-demand

2. **Memoization**
   - Use React.memo() for expensive components
   - Use useMemo() for expensive calculations

3. **Image Optimization**
   - Lazy load images
   - Use appropriate formats (WebP)
   - Compress before upload

4. **Bundle Size**
   - Tree-shake unused code
   - Analyze with `npm run build`

---

## Testing Components

Example component test:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
  
  it('should handle click', () => {
    const onClick = vi.fn();
    render(<MyComponent onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

