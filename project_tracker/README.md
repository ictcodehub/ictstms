# Project Tracker

## 🚀 [2026-01-14 | 08:00 - 08:30] Enhancement: Dashboard UI & Pagination

### Overview
Refined the visual indicators for Exam types and implemented consistent pagination across Teacher Dashboard pages (Overview and Tasks) to match the Students page design.

### ✅ Key Features & Changes
1.  **Icon-Only Badges (`Overview.jsx`, `Exams.jsx`)**:
    *   Replaced text-based badges with clean icon-only indicators.
    *   **Globe Icon (Indigo)**: Guest Exam (Public Access).
    *   **Users Icon (Pink)**: Class Exam (Registered Students Only).
    *   Added tooltips for clarity on hover.

2.  **Pagination Implementation**:
    *   **Overview Page**: Added pagination for "Recent Activities" list. Now shows all historical activities instead of just the latest 10.
    *   **Tasks Page**: Implemented standard pagination (10 items/page) matching the design of the Students page, replacing the old standalone implementation.
    *   **UI Consistency**: Unified the look and feel of pagination controls (Previous/Next buttons, page numbers, status text) across Students, Tasks, and Overview pages.

3.  **Localization**:
    *   Standardized pagination text to Indonesian ("Showing ... dari ...") to be consistent with the rest of the application.

### 📁 Files Modified
| File | Changes |
|------|---------|
| `src/pages/teacher/Exams.jsx` | Replaced text badges with Globe/Users icons in "Akses" column |
| `src/pages/teacher/Overview.jsx` | Added pagination logic & UI, updated exam activity icons |
| `src/pages/teacher/Tasks.jsx` | Refactored pagination to match standard UI, localized text |

## 🚀 [2026-01-14 | 08:31 - 08:35] Enhancement: Task Reactivation UX

### Overview
Added explicit feedback when a teacher extends a deadline for an expired task, confirming that the task has been reactivated.

### ✅ Key Features
- **Reactivation Notification**: When editing an overdue task and setting a future deadline, a specific success toast ("Task berhasil diperpanjang dan kembali Aktif! 🚀") appears instead of the generic save message.

### 📁 Files Modified
| File | Changes |
|------|---------|
| `src/pages/teacher/Tasks.jsx` | Added logic to detect deadline extension and show custom toast |

## 🐛 [2026-01-14 | 08:40 - 08:45] Fix: Student Query Consistency

### Overview
Resolved a critical issue where students assigned via the new Multi-Class system (`classIds`) were not appearing in Task Detail or Class Statistics.

### ✅ Key Fixes
- **TaskDetail.jsx**: Updated student fetching logic to query both legacy `classId` and modern `classIds` array, ensuring all students are loaded.
- **Classes.jsx**: Fixed the student count indicator in the sidebar to correctly count unique students from both fields.

### 📁 Files Modified
| File | Changes |
|------|---------|
| `src/pages/teacher/TaskDetail.jsx` | Implemented dual-query strategy for student list |
| `src/pages/teacher/Classes.jsx` | Updated statistics calculation to support multi-class students |

## 🛡️ [2026-01-14 | 08:50 - 09:00] Feature: Guest Exam Security (Triple Lock)

### Overview
Implemented a robust 3-layer security mechanism to prevent Guest students from submitting the same exam multiple times.

### ✅ Security Layers
1.  **Browser Lock**: Uses `localStorage` to flag device after submission. Blocks re-entry from the same browser.
2.  **Identity Lock**: Checks `guest_attempts` database to see if "Name + Class" combination has already submitted.
3.  **Anti-Spoof Lock**: Checks `guest_attempts` to see if "Absen Number + Class" is already used, preventing users from slightly altering their name to bypass checks.

### 📁 Files Modified
| File | Changes |
|------|---------|
| `firestore.rules` | Added `guest_attempts` collection with public create/read but NO update/delete rules (Immutable). |
| `src/pages/guest/GuestExamEntry.jsx` | Added Absen Dropdown and implemented the 3-layer pre-flight check logic. |
| `src/pages/student/ExamTaker.jsx` | Updated submission logic to log attempts to `guest_attempts` and set local browser lock. |
| `src/utils/examReset.js` | Updated reset logic to also delete `guest_attempts` records, allowing guests to retake exams after reset. |

---

## 🚀 [2026-01-14 | 07:00 - 08:00] Feature: Guest Exam Access (Ujian Tamu)

### Overview
Implemented the "Guest Exam" feature, allowing students to take exams without logging in. This involves a new public entry point, guest session management, and modifications to the teacher dashboard to support guest results.

### ✅ Key Features
1.  **Teacher Side (`ExamEditor.jsx`, `ExamResults.jsx`)**:
    *   **Enable Guest Access**: Toggle in Exam Editor settings.
    *   **Public Link**: Generates a shareable public link (`/exam/guest/:id`).
    *   **Guest Results**: Exam Results table now supports displaying guest submissions with a distinctive "GUEST" badge.

2.  **Student/Guest Side (`GuestExamEntry.jsx`, `ExamTaker.jsx`)**:
    *   **Guest Entry Page**: Public landing page to input Name and optional Class.
    *   **Session Management**: Uses `localStorage` to persist guest sessions (resume support) without authentication.
    *   **Isolation**: Exam Taker logic updated to strictly separate guest vs. authenticated user queries.

3.  **Backend & Security**:
    *   **Firestore Rules**: Updated `firestore.rules` to allow public read access for exams and public write access for sessions/results.
    *   **Firebase Config**: Updated `firebase.json` to properly target firestore rules.

### 🐛 Bug Fixes
*   **Access Denied**: Fixed by deploying updated Firestore Rules.
*   **"Failed to load exam"**: Fixed race condition in `ExamTaker.jsx` where guest users triggered authenticated verification queries.

### 📁 Files Modified
| File | Changes |
|------|---------|
| `src/pages/teacher/ExamEditor.jsx` | Added Guest Access toggle & Link generation |
| `src/pages/teacher/ExamResults.jsx` | Added logic to display guest results & guest badges |
| `src/pages/guest/GuestExamEntry.jsx` | [NEW] Public landing page for guests |
| `src/pages/student/ExamTaker.jsx` | Refactored `loadExam` for guest isolation |
| `firestore.rules` | Allowed public access for guest exams |
| `src/App.jsx` | Added public routes |

---

## 🚀 [2026-01-12 | 12:15 - 12:30] Feature: Task Revision Workflow

### Overview
Implemented a "Request Revision" workflow allowing teachers to return assignments to students for feedback without grading them.

### ✅ Key Features
1.  **Teacher Side (`TaskDetail.jsx`)**:
    *   Added "Request Revision" button in Grading Modal.
    *   Added visual indicator for "Needs Revision" status in student list.
    *   Logic to set `status: 'needs_revision'` and `grade: null`.

2.  **Student Side (`Tasks.jsx`)**:
    *   Added "Revision Needed" status badge.
    *   Display teacher's feedback prominently in an alert box.
    *   Logic to reset status to `'submitted'` when student updates their answer, ensuring teacher knows it's ready for re-review.

3.  **Data Consistency**:
    *   Standardized on `feedback` field (Student view now reads `feedback` instead of legacy `teacherComment`).

### 📁 Files Modified
| File | Changes |
|------|---------|
| `src/pages/teacher/TaskDetail.jsx` | Added Revision UI & Logic, cleaned up modal footer |
| `src/pages/student/Tasks.jsx` | Added Revision Badge, Feedback Alert, Status Reset on Update |

## 🎨 [2026-01-09 | 11:15 - 11:20] Grading Modal: Clean Look & Navigation

### Overview
Complete visual overhaul of the Grading Modal to a "Clean Look" (SaaS-style minimalist design) and added navigation features for faster grading workflow.

### ✅ Key Features & Changes
1.  **Clean Look Design**:
    *   **Header**: Replaced gradient with clean white header, subtle borders, and refined text hierarchy.
    *   **Student Answer**: content-first design with `bg-white`, removing heavy containers to focus on readability.
    *   **Grading Panel**: distinct `bg-slate-50` area for grading controls, with modern input styles and sticky footer.
    *   **Typography**: Adjusted font sizes (Score input `text-sm`) for a professional dense feel.

2.  **Navigation System**:
    *   **Next/Previous** buttons in the modal header.
    *   Allows seamless switching between students without closing the modal.
    *   Respects current table sort/filter logic.

3.  **Bug Fixes**:
    *   **Z-Index Clipping**: Fixed issue where modal top was cut off by navbar using `createPortal` to render modal at `document.body` level.
    *   **Imports**: Resolved duplicate icon import errors.

### 📁 Files Modified
| File | Changes |
|------|---------|
| `src/pages/teacher/TaskDetail.jsx` | Full UI redesign, Navigation logic, Portal implementation |

### 📦 Git Commits
- `feat: grading modal clean look redesign and navigation system`



## 🎨 [2026-01-09 | 09:55 - 10:05] Grading Modal UI Refinements (Round 1)

### Overview
Refined the Grading Modal UI in `TaskDetail.jsx` to improve usability, enable scrolling, and translate text to English. Also applied clean-up requests from user.

### ✅ Changes Implemented
1.  **Layout Fixes**:
    *   Enabled scrolling for both Student Answer (Left) and Grading Controls (Right) panels.
    *   Ensured "Save" and "Cancel" buttons are always visible (sticky footer).
    *   Removed empty header/border lines for a cleaner look.

2.  **Visual & Text Updates**:
    *   **Translation**: Translated all Indonesian labels to English ("Submitted At", "Last Revised", "Score", "Feedback", etc.).
    *   **Typography**: Updated Student Answer text to be simpler (`text-sm font-normal font-sans`).
    *   **Terminology**: Changed "Grade" to "Score" and "Save Grade" to "Save".
    *   **Cleanup**: Removed redundant "Student Answer" header and "Submitted At" text label.

### 📁 Files Modified
| File | Changes |
|------|---------|
| `src/pages/teacher/TaskDetail.jsx` | Full UI refinement, flex layout fixes, text updates |

### 📦 Git Commits
- `feat: refine grading modal UI (english text, layout fixes, clean look)`



## 🐛 [2026-01-09 | 08:29 - 08:34] Fix: Question Duplication Focus

### Overview
Fixed `ExamEditor` issue where duplicating a question did not switch focus to the new question.

### ✅ Solutions Implemented
1. **ExamEditor.jsx**:
   - Added `setActiveQuestionId(newQuestion.id)` after adding duplication question to state

### 📁 Files Modified
| File | Changes |
|------|---------|
| `src/pages/teacher/ExamEditor.jsx` | Added focus switch logic |

### 📦 Git Commits
- `Fix: Auto-switch focus to new question on duplicate`

---

## 🐛 [2026-01-08 | 21:52 - 22:14] Critical Navigation & Login Bug Fixes

### Overview
Fixed critical bugs causing navigation freezing and login hanging after multiple menu switches.

### 🐛 Issues Fixed
1. **Navigation Freeze**: After multiple rapid menu clicks, navigation stopped working
2. **Login Hang**: After login, page would hang/blank requiring manual refresh
3. **Performance Degradation**: Browser became slower over time

### 🔧 Root Causes Identified
- **Race Conditions**: Async operations in `AuthContext` not properly guarded with mounted flags
- **Memory Leaks**: Event listeners in `DashboardLayout` not properly cleaned up
- **Performance**: 5 simultaneous activity listeners firing on every mouse move/click without debouncing
- **Async Blocking**: Firestore operations blocking navigation during rapid menu switches

### ✅ Solutions Implemented
1. **AuthContext.jsx**:
   - Added `isMounted` flag to prevent state updates after unmount
   - Proper cleanup of `onAuthStateChanged` subscription
   - Debounced activity tracking (1 second delay)
   - Passive event listeners for better scroll performance
   - Cleanup timeout on unmount

2. **DashboardLayout.jsx**:
   - Added `isMounted` flag for async session checks
   - AbortController for cancelling in-flight requests
   - Increased check interval from 5s to 10s (reduced CPU usage)
   - Proper guard checks before Firestore operations

### 📁 Files Modified
| File | Changes |
|------|---------|
| `src/contexts/AuthContext.jsx` | Added race condition guards, debounced activity tracking |
| `src/layouts/DashboardLayout.jsx` | Added async operation guards, reduced check frequency |

### 🧪 Verification
- ✅ Login works smoothly without hanging
- ✅ Rapid menu navigation (6 menus x 6 cycles = 36 clicks) works flawlessly
- ✅ No memory leaks after extended use
- ✅ Browser performance remains stable

### 📦 Git Commits
- `(pending)` - fix: critical navigation and login bugs

---

## Work Session: UI Consistency & Pagination Updates
**Date:** 2026-01-08
**Objective:** Improve UI consistency across pages and add pagination to the Exams list.

### Key Changes
1. **Tasks Page**:
   - Fixed header font size inconsistency (changed `text-3xl` to `text-2xl` to match other pages).

2. **Students Page**:
   - Removed redundant summary stats cards to clean up the UI.

3. **Exams Page**:
   - Added pagination support (10 exams per page).
   - Fixed a critical bug where the page would render blank due to missing state initialization (`currentPage`, `examsPerPage`).
   - Standardized layout with the Tasks page.

## Work Session: Build Optimization & Security Check
**Date:** 2026-01-08
**Objective:** Address build warnings and verify project security.

### Key Actions
1. **Security Audit**:
   - Ran `npm audit`: Found **0 vulnerabilities**.
   - Ran `npm outdated`: Identified minor non-critical updates for `firebase` and `vitest`.

2. **Build Optimization**:
   - Addressed "Large Chunk Size" warning in Vite build.
   - Optimized `vite.config.js` by splitting `manualChunks`.
   - Separated `firebase` into substeps (`app`, `auth`, `firestore`) and `ui` vendor chunks (`framer`, `lucide`) to improve load performance.


---

## 🎯 [2026-01-08 | 21:40 - 21:49] ExamResults Table Enhancements

### Overview
Added sorting functionality and design consistency improvements to ExamResults table layout.

### ✅ Completed Features
- **Sortable Headers**: All columns (Name, Class, Status, Attempts, Score) now clickable for sorting
- **Sort Indicators**: Visual feedback with Arrow icons (ArrowUp/ArrowDown/ArrowUpDown)
- **Sort Toggle**: Click same header to toggle asc/desc order
- **Center Alignment**: Attempts and Highest Score columns centered
- **Font Consistency**: Adjusted to `text-sm` matching Students page
- **Icon Fix**: Added missing `Clock` icon import

### 📁 Files Modified
| File | Changes |
|------|---------|
| `src/pages/teacher/ExamResults.jsx` | Added sorting state, handlers, clickable headers, font adjustments |

### 🎨 Design Changes
- Student name: `text-sm font-bold`
- Numbers: `text-sm`
- Score suffix "/100": `text-xs`
- Attempts & Score alignment: `text-center` (previously `text-right`)

### 🧪 Verification
- ✅ Sorting works on all columns
- ✅ Visual indicators show current sort state
- ✅ Font sizes consistent with Students page
- ✅ No blank page issues (Clock icon imported)

### 📦 Git Commits
- `fdeef47` - Combined: fix missing icon + sorting + alignment + font improvements

---

## 🎯 [2026-01-08 | 21:29 - 21:39] ExamResults Table Layout Refactor

### Overview
Major UI refactor: Converted ExamResults from card-based grid layout to table/list layout for better screen space utilization and improved data visibility.

### ✅ Completed Features
- **Table Structure**: 7 columns (No, Name, Class, Status, Attempts, Highest Score, Action)
- **Sticky Header**: Header stays visible when scrolling
- **Status Badges**: All status colors preserved (In Progress with pulse, Completed, Needs Grading, Remedial, Not Started)
- **Interactive Rows**: Click row to open student detail view (same as before)
- **Hover Effects**: Visual feedback on row hover
- **Empty State**: Shows "No students found" message in table when filtered results are empty
- **All Features Preserved**: Search, class filter, status filter, real-time updates

### 📁 Files Modified
| File | Changes |
|------|---------|
| `src/pages/teacher/ExamResults.jsx` | Replaced grid layout (lines 744-804) with table structure (122 insertions, 70 deletions) |

### 🎨 Table Styling
- Compact rows for more visible students per screen
- Zebra striping (subtle row alternation) via `divide-y`
- Student avatar with name + email
- Class badge
- Status badges with icons
- Responsive (horizontal scroll on mobile if needed)

### 🧪 Verification Results
- ✅ All students visible in table format
- ✅ Search works
- ✅ Class filter works  
- ✅ Status filter works
- ✅ Real-time status updates (pulse animation preserved)
- ✅ Click row opens detail view
- ✅ Status badges colored correctly
- ✅ No console errors
- ✅ Syntax errors fixed (modal positioning, table closing tags)

### 📦 Git Commits
- `aaa784b` - checkpoint: before ExamResults table layout refactor (safety backup)
- `aaa0917` - refactor: convert ExamResults from card grid to table layout

### 🎯 Impact
- **Screen utilization**: ↑ ~200% more students visible without scrolling
- **Data clarity**: Structured table format easier to scan
- **Performance**: Same (no logic changes, UI only)

---

## 🎯 [2026-01-08 | 21:23 - 21:25] Add Status Filter to ExamResults

### Overview
Added status filter dropdown next to class filter for filtering students by exam completion status.

### ✅ Completed Features
- Status filter dropdown with options: All Status, In Progress, Needs Grading, Completed, Remedial, Not Started
- Filter logic integrated with existing search and class filters
- Real-time filtering without page reload

### 📁 Files Modified
- `src/pages/teacher/ExamResults.jsx` - Added `selectedStatus` state and filter dropdown

### 📦 Git Commits
- `aaa784b` - feat: add status filter to ExamResults (without emoji icons)

---

## 🎯 [2026-01-08 | 20:00 - 21:19] Realtime Exam Status Implementation

### Overview
Implemented real-time status monitoring for student exams on Teacher's Exam Results page.

### ✅ Completed Features
- **Real-time Listener**: Added Firestore `onSnapshot` for `exam_sessions` collection
- **Status Priority Logic**:
  1. `in_progress` (active session) → "In Progress" (blue, pulsing)
  2. `completed`/`grading_pending`/`remedial` → from exam results
  3. `pending` → "Not Started"
- **Visual Indicators**: Pulse animation for "In Progress" badge
- **Network Configuration**: `vite --host` for mobile testing
- **Firewall Setup**: Windows Firewall rule for port 5173

### 🐛 Bugs Fixed
- **Field Mismatch**: Changed `userId` → `studentId` in session lookup (line 271)
- **Syntax Errors**: Corrected JSX structure in students grid

### 📁 Files Modified
| File | Changes |
|------|---------|
| `src/pages/teacher/ExamResults.jsx` | Added `sessions` state, listener, status logic |
| `package.json` | Added `--host` flag to dev script |

### 🧪 Verification
- ✅ Real-time sync tested (student on mobile, teacher on PC)
- ✅ "In Progress" status appears instantly when exam starts
- ✅ Status updates to "Completed"/"Needs Grading" on submission
- ✅ "Not Started" displays for unattempted exams

### 📦 Git Commits
- `3fb334f` - feat: implement real-time exam status and config mobile access
- `40ff102` - fix: correct field mapping for realtime session status

### 📝 Technical Notes
**Firestore Query:**
```javascript
const sessionsQuery = query(
    collection(db, 'exam_sessions'),
    where('examId', '==', examId),
    where('status', '==', 'in_progress')
);
```

**Troubleshooting:**
- Windows Firewall blocks mobile access → Add rule: `New-NetFirewallRule -DisplayName "React Dev Server" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow`
- Field name must match: `exam_sessions` uses `studentId`, not `userId`

---

## 📝 [Previous] Essay & Short Answer Implementation

**Status:** 🟡 Work In Progress (60% Complete)

## 📋 Current Implementation Status

### ✅ Completed (Teacher Side)
- [x] Added Essay & Short Answer to type dropdown in ExamEditor
- [x] Expected Answer UI (textarea for teacher reference)
- [x] Character limit field for Short Answer (optional, 50-1000 chars)
- [x] Updated `handleTypeChange()` to handle new types
- [x] Updated validation logic in `addQuestion()` and `handleSubmit()` to skip essay/short_answer
- [x] Added AlertCircle icon import

### ✅ Completed (Student Side - ExamTaker)
- [x] Added `handleTextAnswer()` function
- [x] Essay textarea UI (300px min height, auto-resize)
- [x] Short Answer text input (with maxLength enforcement)
- [x] Character counter for both types
- [x] Updated question type label display

### ⏳ TODO (Critical - Required for Feature to Work)

#### 1. **Scoring Logic** (`ExamTaker.jsx`)
- [ ] Update `calculateScore()` function to skip essay/short_answer types
- [ ] Essay/Short Answer questions should NOT be auto-graded
- [ ] Only return score for auto-graded questions (MC, TF, Matching)

#### 2. **Submission Logic** (`ExamTaker.jsx` - `confirmSubmit()`)
- [ ] Update submission to handle text answers
- [ ] Structure: `{ questionId, textAnswer: "...", score: null, maxScore: 10 }`
- [ ] Add grading status: `pending` | `partial` | `complete`
- [ ] Separate `autoGradedScore` from `manualGradedScore`

#### 3. **Manual Grading UI** (`ExamResults.jsx`)
- [ ] Create grading interface for teachers
- [ ] Display student's text answer vs expected answer side-by-side
- [ ] Score input field (0 to maxScore)
- [ ] Feedback textarea (optional)
- [ ] Save button to update submission

#### 4. **Review Mode** (`ExamReview.jsx`)
- [ ] Show grading status indicator (pending/partial/complete)
- [ ] Display text answer for essay questions
- [ ] Show expected answer (if `showResultToStudents` is enabled)
- [ ] Show teacher feedback (if provided)

#### 5. **Excel Import** (Optional - ExamEditor.jsx)
- [ ] Update Excel template to support essay/short_answer
- [ ] Update import parser to handle new types

---

## 🗂️ Files Modified

| File | Status | Changes |
|------|--------|---------|
| `src/pages/teacher/ExamEditor.jsx` | ✅ Complete | Type dropdown, Expected Answer UI, validation |
| `src/pages/student/ExamTaker.jsx` | 🟡 Partial | Text input UI done, scoring/submission TODO |
| `src/pages/teacher/ExamResults.jsx` | ❌ Not Started | Manual grading UI needed |
| `src/pages/student/ExamReview.jsx` | ❌ Not Started | Review mode for text answers |

---

## 📚 Documentation Files

- **task.md** - Detailed task checklist
- **implementation_plan.md** - Complete technical specification
- **walkthrough.md** - Documentation (will be updated when complete)

---

## 🚀 How to Continue

1. **Read** `implementation_plan.md` for detailed technical specs
2. **Start with** scoring logic in ExamTaker (`calculateScore()`)
3. **Then** update submission logic (`confirmSubmit()`)
4. **Finally** implement manual grading UI in ExamResults

---

## 💡 Key Design Decisions

### Data Structure for Essay Answers

```javascript
// Question in exam
{
  type: 'essay',
  text: "Explain...",
  expectedAnswer: "Sample answer...",
  points: 10,
  options: []  // Empty for essay
}

// Student submission
{
  answers: [
    {
      questionId: "q1",
      textAnswer: "Student's essay...",
      score: null,  // Pending grading
      maxScore: 10,
      feedback: "",
      gradedBy: null,
      gradedAt: null
    }
  ],
  autoGradedScore: 70,    // From MC questions
  manualGradedScore: 0,   // Pending
  totalScore: 70,
  gradingStatus: 'pending'  // pending | partial | complete
}
```

### Grading Workflow

```
Student submits exam
  ↓
Auto-grade MC/TF/Matching
  ↓
Essay questions marked as "Pending"
  ↓
Teacher opens ExamResults
  ↓
Manual grading interface appears
  ↓
Teacher enters score + feedback
  ↓
Total score updated
  ↓
Status changes to "complete"
```

---

## ⚠️ Important Notes

1. **Essay questions CANNOT be auto-graded** - always require manual teacher review
2. **Partial scoring enabled by default** for MC questions (teachers can disable)
3. **Expected Answer is optional** but highly recommended for consistency
4. **showResultToStudents** controls whether students see expected answers after submission
5. **Character limits** are enforced client-side (default: 500 for short answer)

---

## 🔗 Related Features (Future)

- [ ] AI-Assisted Grading (using Gemini API)
- [ ] Rubric-based scoring
- [ ] Bulk grading interface
- [ ] Export grades to Excel

---

## 💡 Key Design Decisions

### Data Structure for Essay Answers

```javascript
// Question in exam
{
  type: 'essay',
  text: "Explain...",
  expectedAnswer: "Sample answer...",
  points: 10,
  options: []  // Empty for essay
}

// Student submission
{
  answers: [
    {
      questionId: "q1",
      textAnswer: "Student's essay...",
      score: null,  // Pending grading
      maxScore: 10,
      feedback: "",
      gradedBy: null,
      gradedAt: null
    }
  ],
  autoGradedScore: 70,    // From MC questions
  manualGradedScore: 0,   // Pending
  totalScore: 70,
  gradingStatus: 'pending'  // pending | partial | complete
}
```

### Grading Workflow

```
Student submits exam
  ↓
Auto-grade MC/TF/Matching
  ↓
Essay questions marked as "Pending"
  ↓
Teacher opens ExamResults
  ↓
Manual grading interface appears
  ↓
Teacher enters score + feedback
  ↓
Total score updated
  ↓
Status changes to "complete"
```

---

## ⚠️ Important Notes

1. **Essay questions CANNOT be auto-graded** - always require manual teacher review
2. **Partial scoring enabled by default** for MC questions (teachers can disable)
3. **Expected Answer is optional** but highly recommended for consistency
4. **showResultToStudents** controls whether students see expected answers after submission
5. **Character limits** are enforced client-side (default: 500 for short answer)

---

## 🔗 Related Features (Future)

- [ ] AI-Assisted Grading (using Gemini API)
- [ ] Rubric-based scoring
- [ ] Bulk grading interface
- [ ] Export grades to Excel

---

**Need Help?** Check `implementation_plan.md` for detailed code examples.
