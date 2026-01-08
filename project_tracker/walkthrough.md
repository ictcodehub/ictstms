# Walkthrough: Submission Instructions Feature

## 🎯 Objective
Allow teachers to provide submission instructions (e.g., file naming conventions) that are prominently displayed to students before they submit their work, reducing repetitive questions.

---

## 📝 What Was Implemented

### Teacher Side - Task Form

#### 1. Data Model Update
Added `submissionInstructions` field to task structure:

```javascript
{
    title: string,
    description: string,
    deadline: string,
    assignedClasses: array,
    resources: array,
    submissionInstructions: string  // NEW
}
```

#### 2. Form Field
Added textarea input field in task creation form:

**Position:** Between "Resources & Links" and "Deadline"

**Features:**
- Optional field (not required)
- Multi-line textarea (min-height: 80px)
- Helpful placeholder: "Contoh: Beri nama file: NamaKamu_Tugas1.pdf"
- Helper text explaining where it will be shown

**File:** [Tasks.jsx (Teacher)](file:///c:/Project/src/pages/teacher/Tasks.jsx)

---

### Student Side - Alert Box Display

#### Desktop View ([Tasks.jsx](file:///c:/Project/src/pages/student/Tasks.jsx))

**Position:** Inside "Submit Task" section, BEFORE the textarea

**Design:**
```
┌─────────────────────────────────────────┐
│ ⚠️  Submission Instructions:             │
│     Beri nama file: NamaKamu_Tugas1.pdf │
└─────────────────────────────────────────┘
          ↓
    [ Textarea ]
```

**Styling:**
- Amber background (bg-amber-50)
- Amber border (border-amber-200)
- Alert icon (AlertCircle) in amber-600
- Bold title "Submission Instructions:"
- Text content with whitespace-pre-wrap (preserves line breaks)

**Conditional Rendering:**
```jsx
{task.submissionInstructions && (
    <div className="mb-4 p-3 bg-amber-50...">
        ...
    </div>
)}
```
Only shows if instructions exist!

---

#### Mobile View ([TasksMobile.jsx](file:///c:/Project/src/pages/student/TasksMobile.jsx))

**Same concept, optimized for mobile:**
- Smaller text (text-[10px])
- Compact padding (p-2.5)
- Smaller icon (h-4 w-4)
- Shortened label "Instructions:" instead of "Submission Instructions:"

---

## 🎨 Visual Design

### Alert Box Appearance

**Colors:**
- Background: Amber-50 (warm, attention-grabbing but not alarming)
- Border: Amber-200
- Icon: Amber-600 (warning color to draw attention)
- Title: Amber-900 (dark for contrast)
- Text: Amber-800

**Why Amber?**
- Not as severe as red (which implies error)
- More noticeable than blue (info)
- Perfect for "important information to read"

---

## 💡 Use Cases

### Example 1: File Naming
```
Teacher Input:
"Beri nama file: NamaKamu_Tugas1.pdf
Contoh: BudiSantoso_Tugas1.pdf"

Student Sees:
⚠️ Submission Instructions:
   Beri nama file: NamaKamu_Tugas1.pdf
   Contoh: BudiSantoso_Tugas1.pdf
```

### Example 2: Format Requirements
```
Teacher Input:
"Jawaban harus dalam format:
1. Pendahuluan
2. Isi
3. Kesimpulan"

Student Sees:
⚠️ Submission Instructions:
   Jawaban harus dalam format:
   1. Pendahuluan
   2. Isi
   3. Kesimpulan
```

### Example 3: File Size Limit
```
Teacher Input:
"Maksimal ukuran file: 5MB
Format: PDF atau Word (.docx)"

Student Sees:
⚠️ Submission Instructions:
   Maksimal ukuran file: 5MB
   Format: PDF atau Word (.docx)
```

---

## 📊 Files Modified

| File | Changes | Description |
|------|---------|-------------|
| [src/pages/teacher/Tasks.jsx](file:///c:/Project/src/pages/teacher/Tasks.jsx) | +20 lines | Added form field |
| [src/pages/student/Tasks.jsx](file:///c:/Project/src/pages/student/Tasks.jsx) | +10 lines | Added alert box (desktop) |
| [src/pages/student/TasksMobile.jsx](file:///c:/Project/src/pages/student/TasksMobile.jsx) | +11 lines | Added alert box (mobile) |

**Total:** ~41 lines added

---

## ✅ Benefits

1. **Reduces repetitive questions** - Students see instructions before asking
2. **Prominent placement** - Right before submission form, impossible to miss
3. **Flexible format** - Teachers can write whatever instructions needed
4. **Multi-line support** - Can include numbered lists, examples, etc.
5. **Optional** - Only shows if teacher provides instructions
6. **Consistent UX** - Same design on desktop and mobile

---

## 🚀 Usage Flow

### Teacher:
1. Create/Edit task
2. Scroll to "Submission Instructions (Optional)"
3. Enter instructions (e.g., file naming format)
4. Save task

### Student:
1. Open task
2. Expand to see details
3. Scroll to "Submit Task" section
4. **See amber alert box with instructions** ⚠️
5. Follow instructions and submit

---

## 🔍 Edge Cases Handled

✅ **No instructions provided** → Alert box doesn't appear  
✅ **Multi-line instructions** → `whitespace-pre-wrap` preserves formatting  
✅ **Long text** → Alert box expands vertically  
✅ **Already submitted** → Alert doesn't show (only shows in submit form)

---

Feature is complete and ready to use!
